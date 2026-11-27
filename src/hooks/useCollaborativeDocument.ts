'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DocumentService } from '@/services/document.service';
import { DocumentRealtimeChannel, pickColorForUser } from '@/services/realtime.service';
import { ConcurrencyService } from '@/services/concurrency.service';
import { useToast } from './useToast';
import type {
  BlockType,
  CollaboratorPermission,
  DocumentBlockDTO,
  DocumentContentDTO,
  DocumentDTO,
  ImageBlockSize,
  OccTransactionEntryDTO,
  PresenceUserDTO,
  ProfileDTO,
  SyncStatus
} from '@/types/domain.types';

const DEBOUNCE_SAVE_MS = 2200;
const BROADCAST_THROTTLE_MS = 180;
const MAX_HISTORY_STACK = 40;

interface HistorySnapshot {
  readonly title: string;
  readonly content: DocumentContentDTO;
}

function contentSignature(title: string, content: DocumentContentDTO): string {
  return JSON.stringify({
    title,
    tags: content.metadata?.tags ?? [],
    pinned: Boolean(content.metadata?.pinned),
    icon: content.metadata?.icon ?? '',
    blocks: content.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      text: b.text,
      checked: b.checked,
      imageUrl: b.imageUrl,
      imageCaption: b.imageCaption,
      imageSize: b.imageSize
    }))
  });
}

function cloneContent(content: DocumentContentDTO): DocumentContentDTO {
  return {
    blocks: content.blocks.map((b) => ({ ...b })),
    metadata: content.metadata
      ? {
          ...content.metadata,
          tags: content.metadata.tags ? [...content.metadata.tags] : undefined
        }
      : undefined
  };
}

export function useCollaborativeDocument(
  documentId: string,
  currentUser: ProfileDTO | null
) {
  const { pushToast } = useToast();

  const [document, setDocument] = useState<DocumentDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('SYNCED');
  const [hasPendingChanges, setHasPendingChanges] = useState<boolean>(false);
  const [activeUsers, setActiveUsers] = useState<readonly PresenceUserDTO[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [focusRequestId, setFocusRequestId] = useState<string | null>(null);
  const [lastConflictNotice, setLastConflictNotice] = useState<string | null>(null);
  const [occTransactions, setOccTransactions] = useState<readonly OccTransactionEntryDTO[]>([]);
  const [undoStack, setUndoStack] = useState<readonly HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<readonly HistorySnapshot[]>([]);

  // Per-tab unique session ID & own-save ledger -> guarantees ZERO false self-merges!
  const tabSessionIdRef = useRef<string>(
    `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const ownSaveIdsRef = useRef<Set<string>>(new Set());
  const lastKnownRemoteSaveIdRef = useRef<string | undefined>(undefined);

  const currentUserRef = useRef<ProfileDTO | null>(currentUser);
  currentUserRef.current = currentUser;

  const loadedKeyRef = useRef<string | null>(null);
  const baseSnapshotRef = useRef<{
    title: string;
    content: DocumentContentDTO;
    version: number;
    signature: string;
  } | null>(null);
  const latestDraftRef = useRef<DocumentDTO | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<DocumentRealtimeChannel | null>(null);

  const isSavingRef = useRef<boolean>(false);
  const queuedSaveAfterFlightRef = useRef<boolean>(false);
  const hasLocalDirtyEditsRef = useRef<boolean>(false);
  const hasEditedInCurrentVisitRef = useRef<boolean>(false);
  const hasFinalizedExitVersionRef = useRef<boolean>(false);
  const editSeqRef = useRef<number>(0);
  const isCurrentlyTypingPresenceRef = useRef<boolean>(false);
  const lastPresenceBlockRef = useRef<string | null>(null);
  const lastHistoryPushAtRef = useRef<number>(0);

  const userId = currentUser?.id ?? null;

  const appendOccTransaction = useCallback(
    (entry: Omit<OccTransactionEntryDTO, 'id' | 'timestamp'>) => {
      const record: OccTransactionEntryDTO = {
        ...entry,
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString()
      };
      setOccTransactions((prev) => [record, ...prev.slice(0, 24)]);
    },
    []
  );

  // 1. Load document ONLY when documentId or userId genuinely changes
  const loadDocument = useCallback(
    async (options?: { readonly silent?: boolean }) => {
      const actor = currentUserRef.current;
      if (!actor || !documentId) return;

      const targetKey = `${documentId}:${actor.id}`;
      const isInitialForTarget = loadedKeyRef.current !== targetKey;

      if (isInitialForTarget && !options?.silent) {
        setIsLoading(true);
        setLoadError(null);
      }

      try {
        const fetched = await DocumentService.getDocumentById(documentId, actor);
        const immutableDoc: DocumentDTO = {
          ...fetched,
          content: cloneContent(fetched.content),
          collaborators: fetched.collaborators.map((c) => ({ ...c }))
        };

        if (options?.silent && hasLocalDirtyEditsRef.current && latestDraftRef.current) {
          const patched: DocumentDTO = {
            ...latestDraftRef.current,
            collaborators: immutableDoc.collaborators,
            effectivePermission: immutableDoc.effectivePermission,
            ownerProfile: immutableDoc.ownerProfile
          };
          latestDraftRef.current = patched;
          setDocument(patched);
          return;
        }

        setDocument(immutableDoc);
        latestDraftRef.current = immutableDoc;
        lastKnownRemoteSaveIdRef.current = immutableDoc.content.metadata?.lastSaveId;
        baseSnapshotRef.current = {
          title: immutableDoc.title,
          content: immutableDoc.content,
          version: immutableDoc.version,
          signature: contentSignature(immutableDoc.title, immutableDoc.content)
        };
        loadedKeyRef.current = targetKey;
        setSyncStatus('SYNCED');
        setHasPendingChanges(false);
        hasLocalDirtyEditsRef.current = false;

        if (isInitialForTarget) {
          hasEditedInCurrentVisitRef.current = false;
          hasFinalizedExitVersionRef.current = false;
          setUndoStack([]);
          setRedoStack([]);
          setOccTransactions([
            {
              id: `tx-init-${fetched.version}`,
              timestamp: fetched.updatedAt,
              actorEmail: fetched.content.metadata?.lastEditedBy ?? actor.email,
              outcome: 'COMMITTED',
              expectedVersion: Math.max(1, fetched.version - 1),
              committedVersion: fetched.version,
              summary: 'Nota abierta y sincronizada'
            }
          ]);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'No se pudo cargar la nota.';
        if (isInitialForTarget) {
          setLoadError(msg);
        }
        pushToast({
          type: 'error',
          title: 'Error al abrir la nota',
          message: msg
        });
      } finally {
        setIsLoading(false);
      }
    },
    [documentId, pushToast]
  );

  useEffect(() => {
    void loadDocument();
  }, [documentId, userId, loadDocument]);

  // 2. Single-flight save (bumpVersion = false during editing, true ONLY on leaving the note!)
  const performSave = useCallback(
    async (
      draftToSave: DocumentDTO,
      options?: { readonly bumpVersion?: boolean; readonly forceEvenIfClean?: boolean }
    ) => {
      const actor = currentUserRef.current;
      if (!actor) return;
      if (draftToSave.effectivePermission === 'viewer') return;

      const bumpVersion = Boolean(options?.bumpVersion);

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('OFFLINE');
        return;
      }

      const baseSnap = baseSnapshotRef.current;
      const draftSig = contentSignature(draftToSave.title, draftToSave.content);

      // Skip redundant saves if content hasn't changed (unless bumping version once on exit)
      if (!bumpVersion && !options?.forceEvenIfClean && baseSnap && baseSnap.signature === draftSig) {
        setHasPendingChanges(false);
        hasLocalDirtyEditsRef.current = false;
        setSyncStatus('SYNCED');
        return;
      }

      if (isSavingRef.current) {
        if (!bumpVersion) {
          queuedSaveAfterFlightRef.current = true;
          return;
        }
        // If leaving the note while a draft save is in flight, wait briefly for it to finish
        for (let i = 0; i < 15 && isSavingRef.current; i += 1) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      isSavingRef.current = true;
      queuedSaveAfterFlightRef.current = false;
      const saveStartSeq = editSeqRef.current;
      const clientSaveId = `sv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      ownSaveIdsRef.current.add(clientSaveId);

      // Keep ownSaveIds set bounded
      if (ownSaveIdsRef.current.size > 60) {
        const oldest = ownSaveIdsRef.current.values().next().value;
        if (oldest) ownSaveIdsRef.current.delete(oldest);
      }

      if (!bumpVersion) {
        setSyncStatus('SAVING');
      }

      try {
        const currentBase = baseSnapshotRef.current;
        const expectedVersion = currentBase?.version ?? draftToSave.version;

        const result = await DocumentService.updateDocumentWithOCC(
          {
            documentId: draftToSave.id,
            title: draftToSave.title,
            content: draftToSave.content,
            expectedVersion,
            baseTitle: currentBase?.title,
            baseContent: currentBase?.content,
            actorEmail: actor.email,
            currentSnapshot: draftToSave,
            bumpVersion,
            clientSessionId: tabSessionIdRef.current,
            clientSaveId,
            expectedRemoteSaveId: lastKnownRemoteSaveIdRef.current
          },
          actor
        );

        const committedDoc = result.document;
        const committedContentClone = cloneContent(committedDoc.content);
        lastKnownRemoteSaveIdRef.current =
          committedContentClone.metadata?.lastSaveId ?? clientSaveId;

        baseSnapshotRef.current = {
          title: committedDoc.title,
          content: committedContentClone,
          version: committedDoc.version,
          signature: contentSignature(committedDoc.title, committedContentClone)
        };

        const userKeptTypingDuringSave = editSeqRef.current !== saveStartSeq;

        if (!userKeptTypingDuringSave) {
          setDocument((prev) => {
            if (!prev) return committedDoc;
            const nextDoc: DocumentDTO = result.wasMerged
              ? {
                  ...prev,
                  title: committedDoc.title,
                  content: committedContentClone,
                  version: committedDoc.version,
                  updatedAt: committedDoc.updatedAt
                }
              : {
                  ...prev,
                  version: committedDoc.version,
                  updatedAt: committedDoc.updatedAt
                };
            latestDraftRef.current = nextDoc;
            return nextDoc;
          });
          setHasPendingChanges(false);
          hasLocalDirtyEditsRef.current = false;
        } else {
          setDocument((prev) => {
            if (!prev) return prev;
            let nextTitle = prev.title;
            let nextContent = prev.content;

            if (result.wasMerged) {
              const mergedLive = ConcurrencyService.mergeConcurrentChanges({
                baseTitle: draftToSave.title,
                localTitle: prev.title,
                remoteTitle: committedDoc.title,
                baseContent: draftToSave.content,
                localContent: prev.content,
                remoteContent: committedContentClone,
                localAuthorEmail: actor.email
              });
              nextTitle = mergedLive.mergedTitle;
              nextContent = mergedLive.mergedContent;
            }

            const nextDoc: DocumentDTO = {
              ...prev,
              title: nextTitle,
              content: nextContent,
              version: committedDoc.version,
              updatedAt: committedDoc.updatedAt
            };
            latestDraftRef.current = nextDoc;
            return nextDoc;
          });
          hasLocalDirtyEditsRef.current = true;
          setHasPendingChanges(true);
        }

        if (result.wasMerged && result.conflictDetails) {
          setSyncStatus('CONFLICT_MERGED');
          setLastConflictNotice(result.conflictDetails);
          appendOccTransaction({
            actorEmail: actor.email,
            outcome: 'MERGED_3WAY',
            expectedVersion: result.previousVersion,
            committedVersion: result.newVersion,
            summary: result.conflictDetails
          });
        } else {
          setSyncStatus(userKeptTypingDuringSave ? 'PENDING' : 'SYNCED');
          if (bumpVersion) {
            appendOccTransaction({
              actorEmail: actor.email,
              outcome: 'COMMITTED',
              expectedVersion: result.previousVersion,
              committedVersion: result.newVersion,
              summary: 'Revisión cerrada al salir de la nota'
            });
          } else {
            appendOccTransaction({
              actorEmail: actor.email,
              outcome: 'COMMITTED',
              expectedVersion: result.previousVersion,
              committedVersion: result.newVersion,
              summary: 'Cambios guardados automáticamente'
            });
          }
        }

        channelRef.current?.notifyCommittedDocumentUpdate({
          id: committedDoc.id,
          title: committedDoc.title,
          content: committedContentClone,
          version: committedDoc.version,
          updatedAt: committedDoc.updatedAt
        });
      } catch (error) {
        setSyncStatus('ERROR');
        const msg =
          error instanceof Error ? error.message : 'No se pudieron guardar los cambios.';
        pushToast({
          type: 'error',
          title: 'Error al guardar',
          message: msg
        });
      } finally {
        isSavingRef.current = false;
        if (queuedSaveAfterFlightRef.current && latestDraftRef.current) {
          queuedSaveAfterFlightRef.current = false;
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            if (latestDraftRef.current && hasLocalDirtyEditsRef.current) {
              void performSave(latestDraftRef.current, { bumpVersion: false });
            }
          }, DEBOUNCE_SAVE_MS);
        }
      }
    },
    [appendOccTransaction, pushToast]
  );

  /**
   * Finalizes the current editing session and bumps the document version ONCE
   * when the user leaves this note (back to dashboard, switching notes, closing tab, or sign-out).
   */
  const finalizeSessionOnLeave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const draft = latestDraftRef.current;
    if (
      !draft ||
      draft.effectivePermission === 'viewer' ||
      !hasEditedInCurrentVisitRef.current ||
      hasFinalizedExitVersionRef.current
    ) {
      return;
    }

    hasFinalizedExitVersionRef.current = true;
    await performSave(draft, { bumpVersion: true, forceEvenIfClean: true });
  }, [performSave]);

  const recordUndoSnapshot = useCallback((docBeforeEdit: DocumentDTO, forceStep = false) => {
    const now = Date.now();
    if (!forceStep && now - lastHistoryPushAtRef.current < 1200) {
      return;
    }
    lastHistoryPushAtRef.current = now;
    const snap: HistorySnapshot = {
      title: docBeforeEdit.title,
      content: cloneContent(docBeforeEdit.content)
    };
    setUndoStack((prev) => [...prev.slice(-(MAX_HISTORY_STACK - 1)), snap]);
    setRedoStack([]);
  }, []);

  // 3. Schedule debounced draft save (bumpVersion = false!) & throttled broadcast
  const scheduleAutoSaveAndBroadcast = useCallback(
    (
      nextDraft: DocumentDTO,
      editedBlockId: string | null,
      options?: { readonly immediate?: boolean }
    ) => {
      const actor = currentUserRef.current;
      if (!actor) return;

      editSeqRef.current += 1;
      latestDraftRef.current = nextDraft;
      hasLocalDirtyEditsRef.current = true;
      hasEditedInCurrentVisitRef.current = true;
      hasFinalizedExitVersionRef.current = false;
      setHasPendingChanges(true);
      setSyncStatus((prev) =>
        prev === 'OFFLINE' ? 'OFFLINE' : prev === 'SAVING' ? 'SAVING' : 'PENDING'
      );

      if (
        !isCurrentlyTypingPresenceRef.current ||
        lastPresenceBlockRef.current !== editedBlockId
      ) {
        isCurrentlyTypingPresenceRef.current = true;
        lastPresenceBlockRef.current = editedBlockId;
        void channelRef.current?.updateTypingPresence({
          isTyping: true,
          activeBlockId: editedBlockId
        });
      }

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      typingTimerRef.current = setTimeout(() => {
        isCurrentlyTypingPresenceRef.current = false;
        void channelRef.current?.updateTypingPresence({
          isTyping: false,
          activeBlockId: lastPresenceBlockRef.current
        });
      }, 2500);

      if (!broadcastTimerRef.current) {
        broadcastTimerRef.current = setTimeout(() => {
          broadcastTimerRef.current = null;
          const draft = latestDraftRef.current;
          const curActor = currentUserRef.current;
          if (!draft || !curActor) return;
          void channelRef.current?.broadcastContentDelta({
            documentId: draft.id,
            senderId: curActor.id,
            senderSessionId: tabSessionIdRef.current,
            senderEmail: curActor.email,
            senderName: curActor.fullName,
            title: draft.title,
            content: draft.content,
            baseVersion: baseSnapshotRef.current?.version ?? draft.version,
            timestamp: new Date().toISOString()
          });
        }, BROADCAST_THROTTLE_MS);
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      const delay = options?.immediate ? 250 : DEBOUNCE_SAVE_MS;
      debounceTimerRef.current = setTimeout(() => {
        if (latestDraftRef.current && hasLocalDirtyEditsRef.current) {
          void performSave(latestDraftRef.current, { bumpVersion: false });
        }
      }, delay);
    },
    [performSave]
  );

  // 4. Subscribe to WebSocket room (ignoring OWN echoes completely!)
  const loadedDocId = document?.id ?? null;
  const loadedPermission = document?.effectivePermission ?? 'viewer';

  useEffect(() => {
    const actor = currentUserRef.current;
    if (!actor || !loadedDocId) return;

    const channel = new DocumentRealtimeChannel({
      documentId: loadedDocId,
      currentUser: actor,
      effectiveRole:
        loadedPermission === 'owner'
          ? 'owner'
          : loadedPermission === 'admin'
            ? 'admin'
            : loadedPermission,
      callbacks: {
        onPresenceSync: (users) => {
          setActiveUsers(users.map((u) => ({ ...u })));
        },
        onBroadcastDelta: (delta) => {
          const curActor = currentUserRef.current;
          if (!curActor) return;
          // Ignore echoes from THIS exact tab session
          if (delta.senderSessionId === tabSessionIdRef.current) return;
          if (!delta.senderSessionId && delta.senderId === curActor.id) return;

          setDocument((prev) => {
            if (!prev) return prev;
            if (!hasLocalDirtyEditsRef.current) {
              const adopted: DocumentDTO = {
                ...prev,
                title: delta.title,
                content: cloneContent(delta.content)
              };
              latestDraftRef.current = adopted;
              return adopted;
            }

            const merged = ConcurrencyService.mergeConcurrentChanges({
              baseTitle: baseSnapshotRef.current?.title ?? prev.title,
              localTitle: prev.title,
              remoteTitle: delta.title,
              baseContent: baseSnapshotRef.current?.content,
              localContent: prev.content,
              remoteContent: delta.content,
              localAuthorEmail: curActor.email
            });

            const updated: DocumentDTO = {
              ...prev,
              title: merged.mergedTitle,
              content: merged.mergedContent
            };
            latestDraftRef.current = updated;
            return updated;
          });
        },
        onPostgresDocumentUpdate: (remotePatch) => {
          const curActor = currentUserRef.current;
          if (!curActor) return;

          const incomingSaveId = remotePatch.content?.metadata?.lastSaveId;
          const incomingSessionId = remotePatch.content?.metadata?.lastSessionId;

          // CRITICAL: Ignore our OWN database echo coming back through Realtime WebSockets!
          if (
            (incomingSaveId && ownSaveIdsRef.current.has(incomingSaveId)) ||
            (incomingSessionId && incomingSessionId === tabSessionIdRef.current)
          ) {
            return;
          }

          // Ignore already-applied remote saves
          if (
            incomingSaveId &&
            lastKnownRemoteSaveIdRef.current === incomingSaveId &&
            remotePatch.version <= (baseSnapshotRef.current?.version ?? 0)
          ) {
            return;
          }

          if (incomingSaveId) {
            lastKnownRemoteSaveIdRef.current = incomingSaveId;
          }

          setDocument((prev) => {
            if (!prev) return prev;
            const remoteTitle = remotePatch.title ?? prev.title;
            const remoteContent = remotePatch.content
              ? cloneContent(remotePatch.content)
              : prev.content;

            let finalTitle = remoteTitle;
            let finalContent: DocumentContentDTO = remoteContent;

            if (hasLocalDirtyEditsRef.current) {
              const merged = ConcurrencyService.mergeConcurrentChanges({
                baseTitle: baseSnapshotRef.current?.title ?? prev.title,
                localTitle: prev.title,
                remoteTitle,
                baseContent: baseSnapshotRef.current?.content,
                localContent: prev.content,
                remoteContent,
                localAuthorEmail: curActor.email
              });
              finalTitle = merged.mergedTitle;
              finalContent = merged.mergedContent;
            }

            baseSnapshotRef.current = {
              title: remoteTitle,
              content: remoteContent,
              version: Math.max(prev.version, remotePatch.version),
              signature: contentSignature(remoteTitle, remoteContent)
            };

            const nextDoc: DocumentDTO = {
              ...prev,
              title: finalTitle,
              content: finalContent,
              version: Math.max(prev.version, remotePatch.version),
              updatedAt: remotePatch.updatedAt ?? new Date().toISOString()
            };
            latestDraftRef.current = nextDoc;
            appendOccTransaction({
              actorEmail: remoteContent.metadata?.lastEditedBy ?? 'colaborador',
              outcome: 'REMOTE_SYNC',
              expectedVersion: prev.version,
              committedVersion: nextDoc.version,
              summary: 'Cambios de otro colaborador sincronizados'
            });
            return nextDoc;
          });
        },
        onPostgresCollaboratorChange: () => {
          void loadDocument({ silent: true });
        }
      }
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current);
      // Commit ONE session version bump when unmounting / leaving this note
      void finalizeSessionOnLeave();
      void channel.unsubscribe();
      channelRef.current = null;
    };
  }, [
    loadedDocId,
    userId,
    loadedPermission,
    appendOccTransaction,
    finalizeSessionOnLeave,
    loadDocument
  ]);

  // 5. Monitor connectivity, pagehide exit version commit, and beforeunload guard
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('SYNCED');
      if (hasLocalDirtyEditsRef.current && latestDraftRef.current) {
        void performSave(latestDraftRef.current, { bumpVersion: false });
      }
    };

    const handleOffline = () => {
      setSyncStatus('OFFLINE');
      pushToast({
        type: 'warning',
        title: 'Sin conexión',
        message: 'Tus cambios se guardarán automáticamente cuando recuperes la conexión.'
      });
    };

    const handlePageHide = () => {
      // Bump version once when the user closes the tab / navigates away from the note
      void finalizeSessionOnLeave();
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasLocalDirtyEditsRef.current || isSavingRef.current) {
        event.preventDefault();
        event.returnValue =
          'Tienes cambios sin guardar. ¿Seguro que quieres cerrar esta pestaña?';
      } else if (hasEditedInCurrentVisitRef.current && !hasFinalizedExitVersionRef.current) {
        void finalizeSessionOnLeave();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [finalizeSessionOnLeave, performSave, pushToast]);

  // 6. Immutable Document & Block Actions
  const canEdit =
    document !== null &&
    (document.effectivePermission === 'owner' ||
      document.effectivePermission === 'admin' ||
      document.effectivePermission === 'editor');

  const updateTitle = useCallback(
    (newTitle: string) => {
      const current = latestDraftRef.current;
      if (!current || !currentUserRef.current || !canEdit) return;

      recordUndoSnapshot(current);
      const nextDoc: DocumentDTO = { ...current, title: newTitle };
      setDocument(nextDoc);
      scheduleAutoSaveAndBroadcast(nextDoc, null);
    },
    [canEdit, recordUndoSnapshot, scheduleAutoSaveAndBroadcast]
  );

  const updateBlockText = useCallback(
    (blockId: string, newText: string) => {
      const current = latestDraftRef.current;
      const actor = currentUserRef.current;
      if (!current || !actor || !canEdit) return;

      recordUndoSnapshot(current);
      const now = new Date().toISOString();
      const nextBlocks = current.content.blocks.map((block) =>
        block.id === blockId
          ? { ...block, text: newText, updatedBy: actor.email, updatedAt: now }
          : block
      );

      const nextDoc: DocumentDTO = {
        ...current,
        content: { ...current.content, blocks: nextBlocks }
      };

      setDocument(nextDoc);
      scheduleAutoSaveAndBroadcast(nextDoc, blockId);
    },
    [canEdit, recordUndoSnapshot, scheduleAutoSaveAndBroadcast]
  );

  const updateBlockType = useCallback(
    (blockId: string, newType: BlockType, overrideText?: string) => {
      const current = latestDraftRef.current;
      const actor = currentUserRef.current;
      if (!current || !actor || !canEdit) return;

      recordUndoSnapshot(current, true);
      const now = new Date().toISOString();
      const nextBlocks = current.content.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              type: newType,
              text:
                overrideText !== undefined
                  ? overrideText
                  : newType === 'divider' || newType === 'image'
                    ? ''
                    : block.text,
              checked: newType === 'checklist' ? Boolean(block.checked) : undefined,
              updatedBy: actor.email,
              updatedAt: now
            }
          : block
      );

      const nextDoc: DocumentDTO = {
        ...current,
        content: { ...current.content, blocks: nextBlocks }
      };

      setDocument(nextDoc);
      scheduleAutoSaveAndBroadcast(nextDoc, blockId);
    },
    [canEdit, recordUndoSnapshot, scheduleAutoSaveAndBroadcast]
  );

  const toggleChecklistBlock = useCallback(
    (blockId: string) => {
      const current = latestDraftRef.current;
      const actor = currentUserRef.current;
      if (!current || !actor || !canEdit) return;

      recordUndoSnapshot(current, true);
      const now = new Date().toISOString();
      const nextBlocks = current.content.blocks.map((block) =>
        block.id === blockId
          ? { ...block, checked: !block.checked, updatedBy: actor.email, updatedAt: now }
          : block
      );

      const nextDoc: DocumentDTO = {
        ...current,
        content: { ...current.content, blocks: nextBlocks }
      };

      setDocument(nextDoc);
      scheduleAutoSaveAndBroadcast(nextDoc, blockId);
    },
    [canEdit, recordUndoSnapshot, scheduleAutoSaveAndBroadcast]
  );

  const addBlockAfter = useCallback(
    (
      afterBlockId: string | null,
      type: BlockType = 'paragraph',
      initialText = ''
    ): string | null => {
      const current = latestDraftRef.current;
      const actor = currentUserRef.current;
      if (!current || !actor || !canEdit) return null;

      recordUndoSnapshot(current, true);
      const now = new Date().toISOString();
      const newBlock: DocumentBlockDTO = {
        id: `blk-${Math.random().toString(36).slice(2, 9)}`,
        type,
        text: initialText,
        checked: type === 'checklist' ? false : undefined,
        updatedBy: actor.email,
        updatedAt: now
      };

      const existingBlocks = [...current.content.blocks];
      const targetIndex = afterBlockId
        ? existingBlocks.findIndex((b) => b.id === afterBlockId)
        : existingBlocks.length - 1;

      const nextBlocks =
        targetIndex >= 0
          ? [
              ...existingBlocks.slice(0, targetIndex + 1),
              newBlock,
              ...existingBlocks.slice(targetIndex + 1)
            ]
          : [...existingBlocks, newBlock];

      const nextDoc: DocumentDTO = {
        ...current,
        content: { ...current.content, blocks: nextBlocks }
      };

      setDocument(nextDoc);
      setActiveBlockId(newBlock.id);
      setFocusRequestId(newBlock.id);
      scheduleAutoSaveAndBroadcast(nextDoc, newBlock.id);
      return newBlock.id;
    },
    [canEdit, recordUndoSnapshot, scheduleAutoSaveAndBroadcast]
  );

  /**
   * Inserts an image block (from clipboard Ctrl+V, drag-and-drop file, upload, or URL).
   */
  const insertImageBlock = useCallback(
    (params: {
      readonly afterBlockId: string | null;
      readonly imageUrl: string;
      readonly imageCaption?: string;
      readonly imageSize?: ImageBlockSize;
    }): string | null => {
      const current = latestDraftRef.current;
      const actor = currentUserRef.current;
      if (!current || !actor || !canEdit) return null;

      recordUndoSnapshot(current, true);
      const now = new Date().toISOString();
      const newBlock: DocumentBlockDTO = {
        id: `img-${Math.random().toString(36).slice(2, 9)}`,
        type: 'image',
        text: params.imageCaption ?? '',
        imageUrl: params.imageUrl,
        imageCaption: params.imageCaption ?? '',
        imageSize: params.imageSize ?? 'normal',
        updatedBy: actor.email,
        updatedAt: now
      };

      const existingBlocks = [...current.content.blocks];
      const targetIndex = params.afterBlockId
        ? existingBlocks.findIndex((b) => b.id === params.afterBlockId)
        : existingBlocks.length - 1;

      const nextBlocks =
        targetIndex >= 0
          ? [
              ...existingBlocks.slice(0, targetIndex + 1),
              newBlock,
              ...existingBlocks.slice(targetIndex + 1)
            ]
          : [...existingBlocks, newBlock];

      const nextDoc: DocumentDTO = {
        ...current,
        content: { ...current.content, blocks: nextBlocks }
      };

      setDocument(nextDoc);
      setActiveBlockId(newBlock.id);
      scheduleAutoSaveAndBroadcast(nextDoc, newBlock.id, { immediate: true });
      return newBlock.id;
    },
    [canEdit, recordUndoSnapshot, scheduleAutoSaveAndBroadcast]
  );

  const updateImageBlock = useCallback(
    (
      blockId: string,
      patch: {
        readonly imageCaption?: string;
        readonly imageSize?: ImageBlockSize;
        readonly imageUrl?: string;
      }
    ) => {
      const current = latestDraftRef.current;
      const actor = currentUserRef.current;
      if (!current || !actor || !canEdit) return;

      const now = new Date().toISOString();
      const nextBlocks = current.content.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              imageUrl: patch.imageUrl !== undefined ? patch.imageUrl : block.imageUrl,
              imageCaption:
                patch.imageCaption !== undefined ? patch.imageCaption : block.imageCaption,
              text: patch.imageCaption !== undefined ? patch.imageCaption : block.text,
              imageSize: patch.imageSize !== undefined ? patch.imageSize : block.imageSize,
              updatedBy: actor.email,
              updatedAt: now
            }
          : block
      );

      const nextDoc: DocumentDTO = {
        ...current,
        content: { ...current.content, blocks: nextBlocks }
      };

      setDocument(nextDoc);
      scheduleAutoSaveAndBroadcast(nextDoc, blockId);
    },
    [canEdit, scheduleAutoSaveAndBroadcast]
  );

  const duplicateBlock = useCallback(
    (blockId: string) => {
      const current = latestDraftRef.current;
      const actor = currentUserRef.current;
      if (!current || !actor || !canEdit) return;

      const idx = current.content.blocks.findIndex((b) => b.id === blockId);
      if (idx === -1) return;
      const source = current.content.blocks[idx]!;

      recordUndoSnapshot(current, true);
      const copy: DocumentBlockDTO = {
        ...source,
        id: `blk-${Math.random().toString(36).slice(2, 9)}`,
        updatedBy: actor.email,
        updatedAt: new Date().toISOString()
      };

      const nextBlocks = [
        ...current.content.blocks.slice(0, idx + 1),
        copy,
        ...current.content.blocks.slice(idx + 1)
      ];

      const nextDoc: DocumentDTO = {
        ...current,
        content: { ...current.content, blocks: nextBlocks }
      };

      setDocument(nextDoc);
      setActiveBlockId(copy.id);
      if (copy.type !== 'image' && copy.type !== 'divider') {
        setFocusRequestId(copy.id);
      }
      scheduleAutoSaveAndBroadcast(nextDoc, copy.id);
    },
    [canEdit, recordUndoSnapshot, scheduleAutoSaveAndBroadcast]
  );

  /**
   * Moves a block cleanly from `fromIndex` to `toIndex` (supports Drag & Drop above/below,
   * Up/Down buttons, and Alt + Up/Down shortcuts).
   */
  const moveBlock = useCallback(
    (fromIndex: number, toIndex: number) => {
      const current = latestDraftRef.current;
      const actor = currentUserRef.current;
      if (!current || !actor || !canEdit) return;

      const blocks = [...current.content.blocks];
      const clampedTo = Math.max(0, Math.min(blocks.length - 1, toIndex));
      if (fromIndex < 0 || fromIndex >= blocks.length || fromIndex === clampedTo) {
        return;
      }

      recordUndoSnapshot(current, true);
      const [moved] = blocks.splice(fromIndex, 1);
      if (!moved) return;
      blocks.splice(clampedTo, 0, {
        ...moved,
        updatedBy: actor.email,
        updatedAt: new Date().toISOString()
      });

      const nextDoc: DocumentDTO = {
        ...current,
        content: { ...current.content, blocks }
      };

      setDocument(nextDoc);
      setActiveBlockId(moved.id);
      scheduleAutoSaveAndBroadcast(nextDoc, moved.id);
    },
    [canEdit, recordUndoSnapshot, scheduleAutoSaveAndBroadcast]
  );

  const moveBlockByOffset = useCallback(
    (blockId: string, delta: -1 | 1) => {
      const current = latestDraftRef.current;
      if (!current) return;
      const idx = current.content.blocks.findIndex((b) => b.id === blockId);
      if (idx === -1) return;
      moveBlock(idx, idx + delta);
    },
    [moveBlock]
  );

  const removeBlock = useCallback(
    (blockId: string) => {
      const current = latestDraftRef.current;
      if (!current || !currentUserRef.current || !canEdit) return;

      const idx = current.content.blocks.findIndex((b) => b.id === blockId);
      if (idx === -1) return;

      if (current.content.blocks.length <= 1) {
        if (current.content.blocks[0]?.type === 'image') {
          updateBlockType(blockId, 'paragraph', '');
        } else {
          updateBlockText(blockId, '');
        }
        return;
      }

      recordUndoSnapshot(current, true);
      const prevSibling = current.content.blocks[Math.max(0, idx - 1)];
      const nextBlocks = current.content.blocks.filter((b) => b.id !== blockId);

      const nextDoc: DocumentDTO = {
        ...current,
        content: { ...current.content, blocks: nextBlocks }
      };

      setDocument(nextDoc);
      if (prevSibling) {
        setActiveBlockId(prevSibling.id);
        if (prevSibling.type !== 'image' && prevSibling.type !== 'divider') {
          setFocusRequestId(prevSibling.id);
        }
      }
      scheduleAutoSaveAndBroadcast(nextDoc, prevSibling?.id ?? null);
    },
    [canEdit, recordUndoSnapshot, scheduleAutoSaveAndBroadcast, updateBlockText, updateBlockType]
  );

  const togglePinned = useCallback(() => {
    const current = latestDraftRef.current;
    if (!current || !canEdit) return;
    const nextPinned = !Boolean(current.content.metadata?.pinned);
    const nextDoc: DocumentDTO = {
      ...current,
      content: {
        ...current.content,
        metadata: { ...current.content.metadata, pinned: nextPinned }
      }
    };
    setDocument(nextDoc);
    scheduleAutoSaveAndBroadcast(nextDoc, null, { immediate: true });
    pushToast({
      type: 'info',
      title: nextPinned ? 'Nota fijada en favoritos' : 'Quitada de favoritos',
      message: nextPinned
        ? 'Aparecerá destacada al principio de tu espacio.'
        : 'Se ha quitado de tus notas destacadas.'
    });
  }, [canEdit, pushToast, scheduleAutoSaveAndBroadcast]);

  const setDocumentIcon = useCallback(
    (icon: string) => {
      const current = latestDraftRef.current;
      if (!current || !canEdit) return;
      const nextDoc: DocumentDTO = {
        ...current,
        content: {
          ...current.content,
          metadata: { ...current.content.metadata, icon: icon || undefined }
        }
      };
      setDocument(nextDoc);
      scheduleAutoSaveAndBroadcast(nextDoc, null, { immediate: true });
    },
    [canEdit, scheduleAutoSaveAndBroadcast]
  );

  const addTag = useCallback(
    (rawTag: string) => {
      const current = latestDraftRef.current;
      if (!current || !canEdit) return;
      const clean = rawTag.trim().replace(/^#/, '');
      if (!clean) return;
      const existing = current.content.metadata?.tags ?? [];
      if (existing.some((t) => t.toLowerCase() === clean.toLowerCase())) return;

      const nextDoc: DocumentDTO = {
        ...current,
        content: {
          ...current.content,
          metadata: {
            ...current.content.metadata,
            tags: [...existing, clean]
          }
        }
      };
      setDocument(nextDoc);
      scheduleAutoSaveAndBroadcast(nextDoc, null);
    },
    [canEdit, scheduleAutoSaveAndBroadcast]
  );

  const removeTag = useCallback(
    (tagToRemove: string) => {
      const current = latestDraftRef.current;
      if (!current || !canEdit) return;
      const existing = current.content.metadata?.tags ?? [];
      const nextDoc: DocumentDTO = {
        ...current,
        content: {
          ...current.content,
          metadata: {
            ...current.content.metadata,
            tags: existing.filter((t) => t !== tagToRemove)
          }
        }
      };
      setDocument(nextDoc);
      scheduleAutoSaveAndBroadcast(nextDoc, null);
    },
    [canEdit, scheduleAutoSaveAndBroadcast]
  );

  const undo = useCallback(() => {
    const current = latestDraftRef.current;
    if (!current || !canEdit || undoStack.length === 0) return;

    const previous = undoStack[undoStack.length - 1]!;
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [
      ...prev.slice(-(MAX_HISTORY_STACK - 1)),
      { title: current.title, content: cloneContent(current.content) }
    ]);

    const restored: DocumentDTO = {
      ...current,
      title: previous.title,
      content: cloneContent(previous.content)
    };
    setDocument(restored);
    scheduleAutoSaveAndBroadcast(restored, activeBlockId);
  }, [activeBlockId, canEdit, scheduleAutoSaveAndBroadcast, undoStack]);

  const redo = useCallback(() => {
    const current = latestDraftRef.current;
    if (!current || !canEdit || redoStack.length === 0) return;

    const nextSnap = redoStack[redoStack.length - 1]!;
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [
      ...prev.slice(-(MAX_HISTORY_STACK - 1)),
      { title: current.title, content: cloneContent(current.content) }
    ]);

    const restored: DocumentDTO = {
      ...current,
      title: nextSnap.title,
      content: cloneContent(nextSnap.content)
    };
    setDocument(restored);
    scheduleAutoSaveAndBroadcast(restored, activeBlockId);
  }, [activeBlockId, canEdit, redoStack, scheduleAutoSaveAndBroadcast]);

  // Manual save inside the note (saves immediately WITHOUT bumping version!)
  const forceSaveNow = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (latestDraftRef.current && hasLocalDirtyEditsRef.current) {
      await performSave(latestDraftRef.current, { bumpVersion: false });
    }
  }, [performSave]);

  const simulateConcurrentCollaboratorEdit = useCallback(async () => {
    const current = latestDraftRef.current;
    const actor = currentUserRef.current;
    if (!current || !actor) return;

    try {
      const simResult = await DocumentService.simulateConcurrentCollaboratorCommit(
        current.id,
        actor
      );

      channelRef.current?.injectSimulatedCollaboratorPresence({
        userId: simResult.simulatedAuthor.id,
        email: simResult.simulatedAuthor.email,
        fullName: simResult.simulatedAuthor.fullName,
        avatarUrl: simResult.simulatedAuthor.avatarUrl,
        role: 'editor',
        isTyping: true,
        activeBlockId: current.content.blocks[0]?.id ?? null,
        lastActiveAt: new Date().toISOString(),
        color: pickColorForUser(simResult.simulatedAuthor.id)
      });

      const now = new Date().toISOString();
      const localConcurrentDraft: DocumentDTO = {
        ...current,
        content: {
          ...current.content,
          blocks: current.content.blocks.map((b, idx) =>
            idx === 0
              ? {
                  ...b,
                  text: b.text.includes('✓') ? b.text : `${b.text} ✓`,
                  updatedBy: actor.email,
                  updatedAt: now
                }
              : b
          )
        }
      };

      hasLocalDirtyEditsRef.current = true;
      await performSave(localConcurrentDraft, { bumpVersion: false });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo completar la acción.';
      pushToast({
        type: 'error',
        title: 'Error',
        message: msg
      });
    }
  }, [performSave, pushToast]);

  const shareDocument = useCallback(
    async (targetEmail: string, permission: CollaboratorPermission): Promise<boolean> => {
      const current = latestDraftRef.current;
      const actor = currentUserRef.current;
      if (!current || !actor) return false;
      try {
        const updatedDoc = await DocumentService.shareDocumentByEmail(
          {
            documentId: current.id,
            targetEmail,
            permission
          },
          actor
        );
        setDocument((prev) =>
          prev
            ? {
                ...prev,
                collaborators: updatedDoc.collaborators
              }
            : updatedDoc
        );
        channelRef.current?.notifyCollaboratorChange();
        pushToast({
          type: 'success',
          title: 'Acceso actualizado',
          message: `${targetEmail} ahora tiene acceso de ${permission === 'editor' ? 'edición' : 'lectura'}.`
        });
        return true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'No se pudo compartir la nota.';
        pushToast({
          type: 'error',
          title: 'Error al compartir',
          message: msg
        });
        return false;
      }
    },
    [pushToast]
  );

  const revokeCollaborator = useCallback(
    async (targetUserId: string, targetEmail: string): Promise<boolean> => {
      const current = latestDraftRef.current;
      const actor = currentUserRef.current;
      if (!current || !actor) return false;
      try {
        const updatedDoc = await DocumentService.removeCollaborator({
          documentId: current.id,
          targetUserId,
          actor
        });
        setDocument((prev) =>
          prev
            ? {
                ...prev,
                collaborators: updatedDoc.collaborators
              }
            : updatedDoc
        );
        channelRef.current?.notifyCollaboratorChange();
        pushToast({
          type: 'info',
          title: 'Acceso revocado',
          message: `Se ha retirado el acceso a ${targetEmail}.`
        });
        return true;
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : 'No se pudo quitar al colaborador.';
        pushToast({
          type: 'error',
          title: 'Error al revocar',
          message: msg
        });
        return false;
      }
    },
    [pushToast]
  );

  const handleBlockFocus = useCallback((blockId: string | null) => {
    setActiveBlockId(blockId);
    if (lastPresenceBlockRef.current !== blockId) {
      lastPresenceBlockRef.current = blockId;
      void channelRef.current?.updateTypingPresence({
        isTyping: false,
        activeBlockId: blockId
      });
    }
  }, []);

  const clearFocusRequest = useCallback(() => {
    setFocusRequestId(null);
  }, []);

  const attemptViewerWriteProbe = useCallback(async () => {
    pushToast({
      type: 'warning',
      title: 'Modo solo lectura',
      message:
        'Esta nota fue compartida contigo solo para lectura. Pide permiso de edición al propietario si necesitas modificarla.'
    });
  }, [pushToast]);

  return {
    document,
    isLoading,
    loadError,
    canEdit,
    syncStatus,
    hasPendingChanges,
    activeUsers,
    activeBlockId,
    focusRequestId,
    clearFocusRequest,
    lastConflictNotice,
    occTransactions,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    dismissConflictNotice: () => setLastConflictNotice(null),
    handleBlockFocus,
    updateTitle,
    updateBlockText,
    updateBlockType,
    toggleChecklistBlock,
    addBlockAfter,
    insertImageBlock,
    updateImageBlock,
    duplicateBlock,
    moveBlock,
    moveBlockByOffset,
    removeBlock,
    togglePinned,
    setDocumentIcon,
    addTag,
    removeTag,
    undo,
    redo,
    forceSaveNow,
    finalizeSessionOnLeave,
    simulateConcurrentCollaboratorEdit,
    attemptViewerWriteProbe,
    shareDocument,
    revokeCollaborator
  };
}
