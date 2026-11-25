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
  OccTransactionEntryDTO,
  PresenceUserDTO,
  ProfileDTO,
  SyncStatus
} from '@/types/domain.types';

const DEBOUNCE_SAVE_MS = 420;

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
  const [lastConflictNotice, setLastConflictNotice] = useState<string | null>(null);
  const [occTransactions, setOccTransactions] = useState<readonly OccTransactionEntryDTO[]>([]);

  const appendOccTransaction = useCallback((entry: Omit<OccTransactionEntryDTO, 'id' | 'timestamp'>) => {
    const record: OccTransactionEntryDTO = {
      ...entry,
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    setOccTransactions((prev) => [record, ...prev.slice(0, 24)]);
  }, []);

  // Refs to hold latest snapshots for debounced OCC Compare-And-Swap execution
  const baseSnapshotRef = useRef<{
    title: string;
    content: DocumentContentDTO;
    version: number;
  } | null>(null);
  const latestDraftRef = useRef<DocumentDTO | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<DocumentRealtimeChannel | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const hasLocalDirtyEditsRef = useRef<boolean>(false);

  // 1. Load initial document and verify RLS access
  const loadDocument = useCallback(async () => {
    if (!currentUser || !documentId) return;

    setIsLoading(true);
    setLoadError(null);
    try {
      const fetched = await DocumentService.getDocumentById(documentId, currentUser);
      const immutableDoc: DocumentDTO = {
        ...fetched,
        content: {
          blocks: fetched.content.blocks.map((b) => ({ ...b })),
          metadata: fetched.content.metadata ? { ...fetched.content.metadata } : undefined
        },
        collaborators: fetched.collaborators.map((c) => ({ ...c }))
      };

      setDocument(immutableDoc);
      latestDraftRef.current = immutableDoc;
      baseSnapshotRef.current = {
        title: immutableDoc.title,
        content: immutableDoc.content,
        version: immutableDoc.version
      };
      setSyncStatus('SYNCED');
      setHasPendingChanges(false);
      hasLocalDirtyEditsRef.current = false;
      setOccTransactions([
        {
          id: `tx-init-${fetched.version}`,
          timestamp: fetched.updatedAt,
          actorEmail: fetched.content.metadata?.lastEditedBy ?? currentUser.email,
          outcome: 'COMMITTED',
          expectedVersion: Math.max(1, fetched.version - 1),
          committedVersion: fetched.version,
          summary: `Hydrated baseline snapshot at v${fetched.version}`
        }
      ]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to load document.';
      setLoadError(msg);
      pushToast({
        type: 'error',
        title: 'Access or Network Error',
        message: msg
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, documentId, pushToast]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  // 2. Execute atomic OCC save to PostgreSQL / Local Store
  const performOptimisticSave = useCallback(
    async (draftToSave: DocumentDTO) => {
      if (!currentUser) return;
      if (draftToSave.effectivePermission === 'viewer') {
        pushToast({
          type: 'warning',
          title: 'Read-Only Access (Viewer)',
          message: 'Your role on this document is "viewer". Changes cannot be persisted.'
        });
        return;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('OFFLINE');
        return;
      }

      isSavingRef.current = true;
      setSyncStatus('SAVING');

      try {
        const baseSnap = baseSnapshotRef.current;
        const expectedVersion = baseSnap?.version ?? draftToSave.version;

        const result = await DocumentService.updateDocumentWithOCC(
          {
            documentId: draftToSave.id,
            title: draftToSave.title,
            content: draftToSave.content,
            expectedVersion,
            baseTitle: baseSnap?.title,
            baseContent: baseSnap?.content,
            actorEmail: currentUser.email
          },
          currentUser
        );

        const committedDoc = result.document;
        baseSnapshotRef.current = {
          title: committedDoc.title,
          content: committedDoc.content,
          version: committedDoc.version
        };
        latestDraftRef.current = committedDoc;

        setDocument({
          ...committedDoc,
          content: {
            blocks: committedDoc.content.blocks.map((b) => ({ ...b })),
            metadata: committedDoc.content.metadata
              ? { ...committedDoc.content.metadata }
              : undefined
          }
        });

        setHasPendingChanges(false);
        hasLocalDirtyEditsRef.current = false;

        if (result.wasMerged) {
          setSyncStatus('CONFLICT_MERGED');
          const detail =
            result.conflictDetails ??
            `Merged concurrent edits from v${result.previousVersion} → v${result.newVersion}.`;
          setLastConflictNotice(detail);
          appendOccTransaction({
            actorEmail: currentUser.email,
            outcome: 'MERGED_3WAY',
            expectedVersion: result.previousVersion,
            committedVersion: result.newVersion,
            summary: detail
          });
          pushToast({
            type: 'info',
            title: `OCC 3-Way Merge (v${result.previousVersion} → v${result.newVersion})`,
            message: detail
          });
        } else {
          setSyncStatus('SYNCED');
          appendOccTransaction({
            actorEmail: currentUser.email,
            outcome: 'COMMITTED',
            expectedVersion: result.previousVersion,
            committedVersion: result.newVersion,
            summary: `Atomic CAS WHERE version = ${result.previousVersion} → v${result.newVersion}`
          });
        }

        // Notify peer clients via Realtime bus that a new database version is committed
        channelRef.current?.notifyCommittedDocumentUpdate({
          id: committedDoc.id,
          title: committedDoc.title,
          content: committedDoc.content,
          version: committedDoc.version,
          updatedAt: committedDoc.updatedAt
        });
      } catch (error) {
        setSyncStatus('ERROR');
        const msg = error instanceof Error ? error.message : 'Failed to save document.';
        pushToast({
          type: 'error',
          title: 'Synchronization Error',
          message: msg
        });
      } finally {
        isSavingRef.current = false;
      }
    },
    [currentUser, pushToast]
  );

  // 3. Schedule debounced OCC auto-save & emit low-latency WebSocket broadcast
  const scheduleAutoSaveAndBroadcast = useCallback(
    (nextDraft: DocumentDTO, editedBlockId: string | null) => {
      if (!currentUser) return;

      latestDraftRef.current = nextDraft;
      hasLocalDirtyEditsRef.current = true;
      setHasPendingChanges(true);
      setSyncStatus((prev) => (prev === 'OFFLINE' ? 'OFFLINE' : 'PENDING'));

      // Update typing presence indicator
      void channelRef.current?.updateTypingPresence({
        isTyping: true,
        activeBlockId: editedBlockId
      });

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      typingTimerRef.current = setTimeout(() => {
        void channelRef.current?.updateTypingPresence({
          isTyping: false,
          activeBlockId: editedBlockId
        });
      }, 1800);

      // Emit instant WebSocket broadcast frame for low-latency live preview on peer screens
      void channelRef.current?.broadcastContentDelta({
        documentId: nextDraft.id,
        senderId: currentUser.id,
        senderEmail: currentUser.email,
        senderName: currentUser.fullName,
        title: nextDraft.title,
        content: nextDraft.content,
        baseVersion: baseSnapshotRef.current?.version ?? nextDraft.version,
        timestamp: new Date().toISOString()
      });

      // Debounce PostgreSQL OCC persistence
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (latestDraftRef.current) {
          void performOptimisticSave(latestDraftRef.current);
        }
      }, DEBOUNCE_SAVE_MS);
    },
    [currentUser, performOptimisticSave]
  );

  // 4. Subscribe to WebSocket room `room:doc_${documentId}`
  useEffect(() => {
    if (!currentUser || !document?.id) return;

    const channel = new DocumentRealtimeChannel({
      documentId: document.id,
      currentUser,
      effectiveRole:
        document.effectivePermission === 'owner'
          ? 'owner'
          : document.effectivePermission === 'admin'
            ? 'admin'
            : document.effectivePermission,
      callbacks: {
        onPresenceSync: (users) => {
          // Immutable presence array update
          setActiveUsers(users.map((u) => ({ ...u })));
        },
        onBroadcastDelta: (delta) => {
          if (delta.senderId === currentUser.id) return;

          setDocument((prev) => {
            if (!prev) return prev;
            if (!hasLocalDirtyEditsRef.current) {
              const adopted: DocumentDTO = {
                ...prev,
                title: delta.title,
                content: {
                  blocks: delta.content.blocks.map((b) => ({ ...b })),
                  metadata: delta.content.metadata ? { ...delta.content.metadata } : undefined
                }
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
              localAuthorEmail: currentUser.email
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
          setDocument((prev) => {
            if (!prev) return prev;
            if (remotePatch.version <= prev.version) return prev;

            const remoteTitle = remotePatch.title ?? prev.title;
            const remoteContent = remotePatch.content ?? prev.content;

            let finalTitle = remoteTitle;
            let finalContent: DocumentContentDTO = {
              blocks: remoteContent.blocks.map((b) => ({ ...b })),
              metadata: remoteContent.metadata ? { ...remoteContent.metadata } : undefined
            };

            if (hasLocalDirtyEditsRef.current) {
              const merged = ConcurrencyService.mergeConcurrentChanges({
                baseTitle: baseSnapshotRef.current?.title ?? prev.title,
                localTitle: prev.title,
                remoteTitle,
                baseContent: baseSnapshotRef.current?.content,
                localContent: prev.content,
                remoteContent,
                localAuthorEmail: currentUser.email
              });
              finalTitle = merged.mergedTitle;
              finalContent = merged.mergedContent;
            }

            baseSnapshotRef.current = {
              title: remoteTitle,
              content: remoteContent,
              version: remotePatch.version
            };

            const nextDoc: DocumentDTO = {
              ...prev,
              title: finalTitle,
              content: finalContent,
              version: remotePatch.version,
              updatedAt: remotePatch.updatedAt ?? new Date().toISOString()
            };
            latestDraftRef.current = nextDoc;
            appendOccTransaction({
              actorEmail: remoteContent.metadata?.lastEditedBy ?? 'peer@collabnotes.io',
              outcome: 'REMOTE_SYNC',
              expectedVersion: prev.version,
              committedVersion: remotePatch.version,
              summary: `Realtime commit received (v${prev.version} → v${remotePatch.version})`
            });
            return nextDoc;
          });
        },
        onPostgresCollaboratorChange: () => {
          void loadDocument();
        }
      }
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      void channel.unsubscribe();
      channelRef.current = null;
    };
    // Subscribe once per documentId + user session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.id, currentUser?.id]);

  // 5. Monitor browser network connectivity & protect pending changes on tab close (`beforeunload`)
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('SYNCED');
      if (hasPendingChanges && latestDraftRef.current) {
        void performOptimisticSave(latestDraftRef.current);
      }
    };

    const handleOffline = () => {
      setSyncStatus('OFFLINE');
      pushToast({
        type: 'warning',
        title: 'Offline Mode',
        message: 'Network connection lost. Edits are buffered locally until reconnection.'
      });
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasPendingChanges || isSavingRef.current || syncStatus === 'SAVING') {
        event.preventDefault();
        event.returnValue =
          'You have unsynchronized collaborative changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasPendingChanges, performOptimisticSave, pushToast, syncStatus]);

  // 6. Immutable Document & Block Mutation Actions
  const canEdit =
    document !== null &&
    (document.effectivePermission === 'owner' ||
      document.effectivePermission === 'admin' ||
      document.effectivePermission === 'editor');

  const updateTitle = useCallback(
    (newTitle: string) => {
      if (!document || !currentUser) return;
      if (!canEdit) {
        pushToast({
          type: 'warning',
          title: 'Permission Denied',
          message: 'Viewers cannot modify the document title.'
        });
        return;
      }

      const nextDoc: DocumentDTO = {
        ...document,
        title: newTitle
      };
      setDocument(nextDoc);
      scheduleAutoSaveAndBroadcast(nextDoc, null);
    },
    [canEdit, currentUser, document, pushToast, scheduleAutoSaveAndBroadcast]
  );

  const updateBlockText = useCallback(
    (blockId: string, newText: string) => {
      if (!document || !currentUser) return;
      if (!canEdit) return;

      const now = new Date().toISOString();
      const nextBlocks = document.content.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              text: newText,
              updatedBy: currentUser.email,
              updatedAt: now
            }
          : { ...block }
      );

      const nextDoc: DocumentDTO = {
        ...document,
        content: {
          ...document.content,
          blocks: nextBlocks
        }
      };

      setDocument(nextDoc);
      setActiveBlockId(blockId);
      scheduleAutoSaveAndBroadcast(nextDoc, blockId);
    },
    [canEdit, currentUser, document, scheduleAutoSaveAndBroadcast]
  );

  const updateBlockType = useCallback(
    (blockId: string, newType: BlockType) => {
      if (!document || !currentUser || !canEdit) return;

      const now = new Date().toISOString();
      const nextBlocks = document.content.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              type: newType,
              checked: newType === 'checklist' ? Boolean(block.checked) : undefined,
              updatedBy: currentUser.email,
              updatedAt: now
            }
          : { ...block }
      );

      const nextDoc: DocumentDTO = {
        ...document,
        content: {
          ...document.content,
          blocks: nextBlocks
        }
      };

      setDocument(nextDoc);
      scheduleAutoSaveAndBroadcast(nextDoc, blockId);
    },
    [canEdit, currentUser, document, scheduleAutoSaveAndBroadcast]
  );

  const toggleChecklistBlock = useCallback(
    (blockId: string) => {
      if (!document || !currentUser || !canEdit) return;

      const now = new Date().toISOString();
      const nextBlocks = document.content.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              checked: !block.checked,
              updatedBy: currentUser.email,
              updatedAt: now
            }
          : { ...block }
      );

      const nextDoc: DocumentDTO = {
        ...document,
        content: {
          ...document.content,
          blocks: nextBlocks
        }
      };

      setDocument(nextDoc);
      scheduleAutoSaveAndBroadcast(nextDoc, blockId);
    },
    [canEdit, currentUser, document, scheduleAutoSaveAndBroadcast]
  );

  const addBlockAfter = useCallback(
    (afterBlockId: string | null, type: BlockType = 'paragraph') => {
      if (!document || !currentUser || !canEdit) return;

      const now = new Date().toISOString();
      const newBlock: DocumentBlockDTO = {
        id: `blk-${Math.random().toString(36).slice(2, 9)}`,
        type,
        text: '',
        checked: type === 'checklist' ? false : undefined,
        updatedBy: currentUser.email,
        updatedAt: now
      };

      const existingBlocks = document.content.blocks.map((b) => ({ ...b }));
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
        ...document,
        content: {
          ...document.content,
          blocks: nextBlocks
        }
      };

      setDocument(nextDoc);
      setActiveBlockId(newBlock.id);
      scheduleAutoSaveAndBroadcast(nextDoc, newBlock.id);
    },
    [canEdit, currentUser, document, scheduleAutoSaveAndBroadcast]
  );

  const removeBlock = useCallback(
    (blockId: string) => {
      if (!document || !currentUser || !canEdit) return;
      if (document.content.blocks.length <= 1) {
        pushToast({
          type: 'info',
          title: 'Minimum Block Constraint',
          message: 'A document must contain at least one content block.'
        });
        return;
      }

      const nextBlocks = document.content.blocks
        .filter((b) => b.id !== blockId)
        .map((b) => ({ ...b }));

      const nextDoc: DocumentDTO = {
        ...document,
        content: {
          ...document.content,
          blocks: nextBlocks
        }
      };

      setDocument(nextDoc);
      scheduleAutoSaveAndBroadcast(nextDoc, null);
    },
    [canEdit, currentUser, document, pushToast, scheduleAutoSaveAndBroadcast]
  );

  const forceSaveNow = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (latestDraftRef.current) {
      await performOptimisticSave(latestDraftRef.current);
    }
  }, [performOptimisticSave]);

  /**
   * Simulates another collaborator editing the document concurrently while the current user
   * also edits locally, demonstrating live OCC version conflict detection and 3-way merge.
   */
  const simulateConcurrentCollaboratorEdit = useCallback(async () => {
    if (!document || !currentUser) return;

    try {
      // 1. External collaborator commits v(N+1) directly in DB while our local baseSnapshot is still at v(N)
      const simResult = await DocumentService.simulateConcurrentCollaboratorCommit(
        document.id,
        currentUser
      );

      // 2. Show the simulated collaborator in the live WebSocket Presence bar
      channelRef.current?.injectSimulatedCollaboratorPresence({
        userId: simResult.simulatedAuthor.id,
        email: simResult.simulatedAuthor.email,
        fullName: simResult.simulatedAuthor.fullName,
        avatarUrl: simResult.simulatedAuthor.avatarUrl,
        role: 'editor',
        isTyping: true,
        activeBlockId: document.content.blocks[0]?.id ?? null,
        lastActiveAt: new Date().toISOString(),
        color: pickColorForUser(simResult.simulatedAuthor.id)
      });

      // 3. Also make a local edit on our current draft still targeting old expectedVersion v(N)
      const now = new Date().toISOString();
      const localConcurrentDraft: DocumentDTO = {
        ...document,
        content: {
          ...document.content,
          blocks: document.content.blocks.map((b, idx) =>
            idx === 0
              ? {
                  ...b,
                  text: b.text.includes('[Verified OCC]')
                    ? b.text
                    : `${b.text} [Verified OCC]`,
                  updatedBy: currentUser.email,
                  updatedAt: now
                }
              : { ...b }
          )
        }
      };

      // 4. Trigger our OCC save with the stale expectedVersion -> forces 3-way merge -> saves v(N+2)!
      await performOptimisticSave(localConcurrentDraft);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Concurrency simulation failed.';
      pushToast({
        type: 'error',
        title: 'Simulation Error',
        message: msg
      });
    }
  }, [currentUser, document, performOptimisticSave, pushToast]);

  const shareDocument = useCallback(
    async (targetEmail: string, permission: CollaboratorPermission): Promise<boolean> => {
      if (!document || !currentUser) return false;
      try {
        const updatedDoc = await DocumentService.shareDocumentByEmail(
          {
            documentId: document.id,
            targetEmail,
            permission
          },
          currentUser
        );
        setDocument({ ...updatedDoc });
        channelRef.current?.notifyCollaboratorChange();
        pushToast({
          type: 'success',
          title: 'Collaborator Updated',
          message: `Assigned "${permission}" permission to ${targetEmail}.`
        });
        return true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unable to share document.';
        pushToast({
          type: 'error',
          title: 'Share Error',
          message: msg
        });
        return false;
      }
    },
    [currentUser, document, pushToast]
  );

  const revokeCollaborator = useCallback(
    async (targetUserId: string, targetEmail: string): Promise<boolean> => {
      if (!document || !currentUser) return false;
      try {
        const updatedDoc = await DocumentService.removeCollaborator({
          documentId: document.id,
          targetUserId,
          actor: currentUser
        });
        setDocument({ ...updatedDoc });
        channelRef.current?.notifyCollaboratorChange();
        pushToast({
          type: 'info',
          title: 'Access Revoked',
          message: `Removed ${targetEmail} from document collaborators.`
        });
        return true;
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : 'Unable to remove collaborator.';
        pushToast({
          type: 'error',
          title: 'Revoke Error',
          message: msg
        });
        return false;
      }
    },
    [currentUser, document, pushToast]
  );

  const handleBlockFocus = useCallback((blockId: string | null) => {
    setActiveBlockId(blockId);
    void channelRef.current?.updateTypingPresence({
      isTyping: false,
      activeBlockId: blockId
    });
  }, []);

  /**
   * Explicitly probes the PostgreSQL RLS UPDATE policy when connected as a read-only viewer,
   * demonstrating database-level rejection (SQLSTATE 42501).
   */
  const attemptViewerWriteProbe = useCallback(async () => {
    if (!document || !currentUser) return;
    try {
      await DocumentService.updateDocumentWithOCC(
        {
          documentId: document.id,
          title: `${document.title} (Unauthorized Mutation)`,
          content: document.content,
          expectedVersion: document.version,
          actorEmail: currentUser.email
        },
        currentUser
      );
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'PostgreSQL RLS rejected write attempt (SQLSTATE 42501).';
      appendOccTransaction({
        actorEmail: currentUser.email,
        outcome: 'RLS_REJECTED',
        expectedVersion: document.version,
        committedVersion: document.version,
        summary: 'SQLSTATE 42501 · Blocked by documents_update_owner_or_editor'
      });
      pushToast({
        type: 'warning',
        title: 'Blocked by PostgreSQL RLS (42501)',
        message: msg
      });
    }
  }, [appendOccTransaction, currentUser, document, pushToast]);

  return {
    document,
    isLoading,
    loadError,
    canEdit,
    syncStatus,
    hasPendingChanges,
    activeUsers,
    activeBlockId,
    lastConflictNotice,
    occTransactions,
    dismissConflictNotice: () => setLastConflictNotice(null),
    handleBlockFocus,
    updateTitle,
    updateBlockText,
    updateBlockType,
    toggleChecklistBlock,
    addBlockAfter,
    removeBlock,
    forceSaveNow,
    simulateConcurrentCollaboratorEdit,
    attemptViewerWriteProbe,
    shareDocument,
    revokeCollaborator
  };
}
