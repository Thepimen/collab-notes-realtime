import { getSupabaseClient, isSupabaseConfigured } from './supabase.client';
import {
  LocalDatabaseAdapter,
  type RawStoredCollaborator,
  type RawStoredDocument,
  SEED_PROFILES
} from './localStore.adapter';
import { ConcurrencyService } from './concurrency.service';
import { AuthService } from './auth.service';
import type {
  CollaboratorPermission,
  CreateDocumentDTO,
  DocumentContentDTO,
  DocumentDTO,
  OptimisticUpdateResultDTO,
  ProfileDTO,
  ShareDocumentRequestDTO,
  UpdateDocumentOCCRequestDTO
} from '@/types/domain.types';
import type {
  DatabaseCollaboratorRow,
  DatabaseDocumentRow,
  DatabaseProfileRow
} from '@/types/database.types';

function hydrateSupabaseRows(params: {
  readonly docRows: readonly DatabaseDocumentRow[];
  readonly collabRows: readonly DatabaseCollaboratorRow[];
  readonly profileRows: readonly DatabaseProfileRow[];
  readonly actor: ProfileDTO;
}): DocumentDTO[] {
  const profileMap = new Map<string, ProfileDTO>();
  params.profileRows.forEach((r) => {
    profileMap.set(r.id, {
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      avatarUrl:
        r.avatar_url ??
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(r.full_name)}`,
      role: r.role,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    });
  });

  const collabsByDoc = new Map<string, DatabaseCollaboratorRow[]>();
  params.collabRows.forEach((c) => {
    const bucket = collabsByDoc.get(c.document_id);
    if (bucket) {
      bucket.push(c);
    } else {
      collabsByDoc.set(c.document_id, [c]);
    }
  });

  const results: DocumentDTO[] = [];

  for (const docRow of params.docRows) {
    const rawCollabs = collabsByDoc.get(docRow.id) ?? [];
    const collaborators = rawCollabs.map((c) => ({
      documentId: c.document_id,
      userId: c.user_id,
      permission: c.permission as CollaboratorPermission,
      createdAt: c.created_at,
      profile: profileMap.get(c.user_id) ?? {
        id: c.user_id,
        email: 'colaborador@collabnotes.io',
        fullName: 'Colaborador',
        avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=C',
        role: 'viewer' as const,
        createdAt: c.created_at,
        updatedAt: c.created_at
      }
    }));

    const isOwner = docRow.owner_id === params.actor.id;
    const isAdmin = params.actor.role === 'admin';
    const userCollab = collaborators.find((c) => c.userId === params.actor.id);

    if (!isOwner && !isAdmin && !userCollab) {
      continue;
    }

    const effectivePermission: DocumentDTO['effectivePermission'] = isOwner
      ? 'owner'
      : isAdmin
        ? 'admin'
        : userCollab
          ? userCollab.permission
          : 'viewer';

    results.push({
      id: docRow.id,
      title: docRow.title,
      content: {
        blocks: Array.isArray(docRow.content?.blocks)
          ? docRow.content.blocks.map((b) => ({ ...b }))
          : [],
        metadata: docRow.content?.metadata ? { ...docRow.content.metadata } : undefined
      },
      ownerId: docRow.owner_id,
      ownerProfile: profileMap.get(docRow.owner_id),
      version: docRow.version,
      createdAt: docRow.created_at,
      updatedAt: docRow.updated_at,
      collaborators,
      effectivePermission
    });
  }

  return results;
}

/**
 * Document & Collaborator Service
 * Encapsulates persistence, permission enforcement, draft saving (without version spam),
 * and version-on-exit Optimistic Concurrency Control (OCC).
 */
export class DocumentService {
  /**
   * Lists all documents accessible by the current user in a single parallel batch (zero N+1).
   */
  public static async listAccessibleDocuments(actor: ProfileDTO): Promise<readonly DocumentDTO[]> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const [docsRes, collabsRes, profilesRes] = await Promise.all([
          supabase.from('documents').select('*').order('updated_at', { ascending: false }),
          supabase.from('document_collaborators').select('*'),
          supabase.from('profiles').select('*')
        ]);

        if (docsRes.error) {
          throw new Error(docsRes.error.message);
        }

        return hydrateSupabaseRows({
          docRows: (docsRes.data ?? []) as DatabaseDocumentRow[],
          collabRows: (collabsRes.data ?? []) as DatabaseCollaboratorRow[],
          profileRows: (profilesRes.data ?? []) as DatabaseProfileRow[],
          actor
        });
      }

      const rawDocs = LocalDatabaseAdapter.getRawDocuments();
      const hydrated = rawDocs
        .map((doc) => LocalDatabaseAdapter.hydrateDocumentForUser(doc, actor))
        .filter((doc): doc is DocumentDTO => doc !== null)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return hydrated;
    } catch (error) {
      console.error('[DocumentService.listAccessibleDocuments] Failed:', error);
      throw new Error('No se pudieron cargar tus notas. Comprueba tu conexión e inténtalo de nuevo.');
    }
  }

  public static async getDocumentById(
    documentId: string,
    actor: ProfileDTO
  ): Promise<DocumentDTO> {
    try {
      if (isSupabaseConfigured()) {
        const dto = await this.fetchAndHydrateSupabaseDocument(documentId, actor);
        if (dto) return dto;
        throw new Error('No se encontró la nota o no tienes permisos para verla.');
      }

      const rawDocs = LocalDatabaseAdapter.getRawDocuments();
      const target = rawDocs.find((d) => d.id === documentId);

      if (!target) {
        throw new Error('Esta nota ya no existe o fue eliminada.');
      }

      const hydrated = LocalDatabaseAdapter.hydrateDocumentForUser(target, actor);
      if (!hydrated) {
        throw new Error('No tienes permisos para acceder a esta nota.');
      }

      return hydrated;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo abrir la nota.';
      throw new Error(msg);
    }
  }

  public static async createDocument(
    payload: CreateDocumentDTO,
    actor: ProfileDTO
  ): Promise<DocumentDTO> {
    const now = new Date().toISOString();
    const initialContent: DocumentContentDTO = payload.content ?? {
      blocks: [
        {
          id: `blk-${crypto.randomUUID().slice(0, 8)}`,
          type: 'paragraph',
          text: '',
          updatedBy: actor.email,
          updatedAt: now
        }
      ],
      metadata: {
        tags: [],
        lastEditedBy: actor.email
      }
    };

    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('documents')
          .insert({
            title: payload.title.trim() || 'Nota sin título',
            content: initialContent,
            owner_id: actor.id,
            version: 1
          })
          .select('*')
          .single();

        if (error || !data) {
          throw new Error(error?.message ?? 'No se pudo crear la nota.');
        }

        const row = data as DatabaseDocumentRow;
        return {
          id: row.id,
          title: row.title,
          content: row.content,
          ownerId: row.owner_id,
          ownerProfile: actor,
          version: row.version,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          collaborators: [],
          effectivePermission: 'owner'
        };
      }

      const newRawDoc: RawStoredDocument = {
        id: crypto.randomUUID(),
        title: payload.title.trim() || 'Nota sin título',
        content: initialContent,
        ownerId: actor.id,
        version: 1,
        createdAt: now,
        updatedAt: now
      };

      const existingDocs = LocalDatabaseAdapter.getRawDocuments();
      LocalDatabaseAdapter.saveRawDocuments([newRawDoc, ...existingDocs]);

      const hydrated = LocalDatabaseAdapter.hydrateDocumentForUser(newRawDoc, actor);
      if (!hydrated) {
        throw new Error('No se pudo inicializar la nueva nota.');
      }
      return hydrated;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo crear la nota.';
      throw new Error(msg);
    }
  }

  /**
   * Saves document changes with session-aware Optimistic Concurrency Control:
   * - `bumpVersion = false` (active editing): persists content WITHOUT incrementing `version`.
   *   Never conflicts with the same tab's own session (`clientSessionId`). Only merges if a
   *   DIFFERENT collaborator session wrote newer changes concurrently.
   * - `bumpVersion = true` (leaving/closing the note): atomically increments `version = version + 1`
   *   once for the entire editing session.
   */
  public static async updateDocumentWithOCC(
    request: UpdateDocumentOCCRequestDTO,
    actor: ProfileDTO
  ): Promise<OptimisticUpdateResultDTO> {
    const MAX_OCC_RETRIES = 3;
    const shouldBumpVersion = request.bumpVersion ?? true;
    const saveId =
      request.clientSaveId ?? `save-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    let attempt = 0;
    let candidateTitle = request.title;
    let candidateContent = request.content;
    let candidateExpectedVersion = request.expectedVersion;
    let wasMerged = false;
    let conflictDetails: string | undefined;

    const buildTaggedContent = (content: DocumentContentDTO): DocumentContentDTO => ({
      blocks: content.blocks.map((b) => ({ ...b })),
      metadata: {
        ...content.metadata,
        lastEditedBy: actor.email,
        lastSessionId: request.clientSessionId ?? content.metadata?.lastSessionId,
        lastSaveId: saveId
      }
    });

    while (attempt < MAX_OCC_RETRIES) {
      attempt += 1;
      const taggedContent = buildTaggedContent(candidateContent);

      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();

        // PATH A: Active Editing Save (DO NOT bump version — keep `version` stable until exit!)
        if (!shouldBumpVersion) {
          const { data: currentRow, error: readErr } = await supabase
            .from('documents')
            .select('id, title, content, version, updated_at')
            .eq('id', request.documentId)
            .maybeSingle();

          if (readErr) {
            throw new Error(`No se pudieron guardar los cambios: ${readErr.message}`);
          }
          if (!currentRow) {
            throw new Error('Esta nota ya no existe.');
          }

          const serverRow = currentRow as Pick<
            DatabaseDocumentRow,
            'id' | 'title' | 'content' | 'version' | 'updated_at'
          >;
          const serverSessionId = serverRow.content?.metadata?.lastSessionId;
          const serverSaveId = serverRow.content?.metadata?.lastSaveId;

          const isOwnSession =
            Boolean(request.clientSessionId) && serverSessionId === request.clientSessionId;
          const isSameKnownState =
            !serverSaveId ||
            !request.expectedRemoteSaveId ||
            serverSaveId === request.expectedRemoteSaveId;
          const versionMatches = serverRow.version === candidateExpectedVersion;

          // Only merge if a DIFFERENT session actually wrote a newer revision or draft!
          const hasTrueExternalConflict =
            !isOwnSession && (!versionMatches || !isSameKnownState);

          if (hasTrueExternalConflict) {
            const mergeResult = ConcurrencyService.mergeConcurrentChanges({
              baseTitle: request.baseTitle ?? serverRow.title,
              localTitle: candidateTitle,
              remoteTitle: serverRow.title,
              baseContent: request.baseContent,
              localContent: candidateContent,
              remoteContent: serverRow.content,
              localAuthorEmail: request.actorEmail
            });
            candidateTitle = mergeResult.mergedTitle;
            candidateContent = mergeResult.mergedContent;
            candidateExpectedVersion = serverRow.version;
            wasMerged = mergeResult.conflictSummary.length > 0;
            if (wasMerged) {
              conflictDetails = mergeResult.conflictSummary.join(' ');
            }
          }

          const finalTagged = buildTaggedContent(candidateContent);
          const { data: updatedRow, error: updateErr } = await supabase
            .from('documents')
            .update({
              title: candidateTitle,
              content: finalTagged
            })
            .eq('id', request.documentId)
            .eq('version', serverRow.version)
            .select('id, title, content, version, updated_at')
            .maybeSingle();

          if (updateErr) {
            if (updateErr.code === '42501') {
              throw new Error('No tienes permisos de edición sobre esta nota.');
            }
            throw new Error(`No se pudieron guardar los cambios: ${updateErr.message}`);
          }

          if (updatedRow) {
            const committed = updatedRow as Pick<
              DatabaseDocumentRow,
              'id' | 'title' | 'content' | 'version' | 'updated_at'
            >;
            const updatedDto: DocumentDTO = request.currentSnapshot
              ? {
                  ...request.currentSnapshot,
                  title: committed.title,
                  content: committed.content,
                  version: committed.version,
                  updatedAt: committed.updated_at
                }
              : await this.getDocumentById(request.documentId, actor);

            return {
              document: updatedDto,
              wasMerged,
              previousVersion: request.expectedVersion,
              newVersion: committed.version,
              conflictDetails
            };
          }

          // Row version changed mid-flight right between read & update -> loop and merge cleanly
          continue;
        }

        // PATH B: Final Session Exit Commit (bump version atomically ONCE via RPC)
        const { data: rpcRows, error: rpcError } = await supabase.rpc('update_document_occ', {
          p_document_id: request.documentId,
          p_title: candidateTitle,
          p_content: taggedContent,
          p_expected_version: candidateExpectedVersion
        });

        if (rpcError) {
          if (rpcError.code === '42501') {
            throw new Error('No tienes permisos de edición sobre esta nota.');
          }
          throw new Error(`No se pudieron guardar los cambios: ${rpcError.message}`);
        }

        const outcome = rpcRows?.[0];
        if (!outcome) {
          throw new Error('Respuesta inesperada al guardar la nota.');
        }

        if (outcome.success) {
          const updatedDto: DocumentDTO = request.currentSnapshot
            ? {
                ...request.currentSnapshot,
                title: outcome.current_title,
                content: outcome.current_content,
                version: outcome.current_version,
                updatedAt: outcome.updated_at
              }
            : await this.getDocumentById(request.documentId, actor);

          return {
            document: updatedDto,
            wasMerged,
            previousVersion: request.expectedVersion,
            newVersion: outcome.current_version,
            conflictDetails
          };
        }

        // Conflict detected on server! Perform 3-way merge against server state
        const mergeResult = ConcurrencyService.mergeConcurrentChanges({
          baseTitle: request.baseTitle ?? candidateTitle,
          localTitle: candidateTitle,
          remoteTitle: outcome.current_title,
          baseContent: request.baseContent,
          localContent: candidateContent,
          remoteContent: outcome.current_content,
          localAuthorEmail: request.actorEmail
        });

        candidateTitle = mergeResult.mergedTitle;
        candidateContent = mergeResult.mergedContent;
        candidateExpectedVersion = outcome.current_version;
        wasMerged = true;
        conflictDetails =
          mergeResult.conflictSummary.join(' ') ||
          'Se combinaron ediciones simultáneas de otro colaborador sin perder datos.';
        continue;
      }

      // LOCAL / HYBRID ENGINE
      const rawDocs = LocalDatabaseAdapter.getRawDocuments();
      const docIndex = rawDocs.findIndex((d) => d.id === request.documentId);

      if (docIndex === -1) {
        throw new Error('Esta nota ya no existe.');
      }

      const currentDbDoc = rawDocs[docIndex]!;
      const hydratedPermissionCheck = LocalDatabaseAdapter.hydrateDocumentForUser(
        currentDbDoc,
        actor
      );

      if (
        !hydratedPermissionCheck ||
        hydratedPermissionCheck.effectivePermission === 'viewer'
      ) {
        throw new Error('Tu rol en esta nota es solo lectura y no puedes guardar cambios.');
      }

      const serverSessionId = currentDbDoc.content.metadata?.lastSessionId;
      const serverSaveId = currentDbDoc.content.metadata?.lastSaveId;
      const isOwnSession =
        Boolean(request.clientSessionId) && serverSessionId === request.clientSessionId;
      const isSameKnownState =
        !serverSaveId ||
        !request.expectedRemoteSaveId ||
        serverSaveId === request.expectedRemoteSaveId;
      const versionMatches = currentDbDoc.version === candidateExpectedVersion;

      // Never self-conflict with the same active session
      if (isOwnSession || (versionMatches && isSameKnownState)) {
        const nextVersion = shouldBumpVersion
          ? currentDbDoc.version + 1
          : currentDbDoc.version;
        const now = new Date().toISOString();

        const updatedRawDoc: RawStoredDocument = {
          ...currentDbDoc,
          title: candidateTitle,
          content: taggedContent,
          version: nextVersion,
          updatedAt: now
        };

        const nextDocs = rawDocs.map((d, idx) => (idx === docIndex ? updatedRawDoc : d));
        LocalDatabaseAdapter.saveRawDocuments(nextDocs);

        const hydrated = LocalDatabaseAdapter.hydrateDocumentForUser(updatedRawDoc, actor)!;
        return {
          document: hydrated,
          wasMerged,
          previousVersion: request.expectedVersion,
          newVersion: nextVersion,
          conflictDetails
        };
      }

      // Genuine external collaborator conflict -> merge 3-way and retry
      const mergeResult = ConcurrencyService.mergeConcurrentChanges({
        baseTitle: request.baseTitle ?? currentDbDoc.title,
        localTitle: candidateTitle,
        remoteTitle: currentDbDoc.title,
        baseContent: request.baseContent,
        localContent: candidateContent,
        remoteContent: currentDbDoc.content,
        localAuthorEmail: request.actorEmail
      });

      candidateTitle = mergeResult.mergedTitle;
      candidateContent = mergeResult.mergedContent;
      candidateExpectedVersion = currentDbDoc.version;
      wasMerged = mergeResult.conflictSummary.length > 0;
      if (wasMerged) {
        conflictDetails = mergeResult.conflictSummary.join(' ');
      }
      // On next iteration commit against currentDbDoc.version
      const finalTagged = buildTaggedContent(candidateContent);
      const nextVersion = shouldBumpVersion ? currentDbDoc.version + 1 : currentDbDoc.version;
      const now = new Date().toISOString();

      const mergedRawDoc: RawStoredDocument = {
        ...currentDbDoc,
        title: candidateTitle,
        content: finalTagged,
        version: nextVersion,
        updatedAt: now
      };

      const nextDocs = rawDocs.map((d, idx) => (idx === docIndex ? mergedRawDoc : d));
      LocalDatabaseAdapter.saveRawDocuments(nextDocs);

      const hydrated = LocalDatabaseAdapter.hydrateDocumentForUser(mergedRawDoc, actor)!;
      return {
        document: hydrated,
        wasMerged,
        previousVersion: request.expectedVersion,
        newVersion: nextVersion,
        conflictDetails
      };
    }

    throw new Error(
      'Hubo demasiadas ediciones simultáneas al mismo tiempo. Vuelve a intentarlo en un segundo.'
    );
  }

  public static async simulateConcurrentCollaboratorCommit(
    documentId: string,
    currentUser: ProfileDTO
  ): Promise<{
    readonly committedVersion: number;
    readonly simulatedAuthor: ProfileDTO;
    readonly updatedDoc: DocumentDTO;
  }> {
    const peerAuthor =
      SEED_PROFILES.find((p) => p.id !== currentUser.id && p.role !== 'viewer') ??
      SEED_PROFILES[1]!;

    const rawDocs = LocalDatabaseAdapter.getRawDocuments();
    const docIndex = rawDocs.findIndex((d) => d.id === documentId);
    if (docIndex === -1) {
      throw new Error('No se encontró la nota.');
    }

    const targetDoc = rawDocs[docIndex]!;
    const now = new Date().toISOString();
    const newBlockId = `blk-peer-${Math.random().toString(36).slice(2, 6)}`;

    const updatedBlocks = [
      ...targetDoc.content.blocks.map((b) => ({ ...b })),
      {
        id: newBlockId,
        type: 'callout' as const,
        text: `Nota añadida simultáneamente por ${peerAuthor.fullName.replace(/\s*\(.*\)/, '')}.`,
        updatedBy: peerAuthor.email,
        updatedAt: now
      }
    ];

    const nextVersion = targetDoc.version + 1;
    const updatedRaw: RawStoredDocument = {
      ...targetDoc,
      content: {
        ...targetDoc.content,
        blocks: updatedBlocks,
        metadata: {
          ...targetDoc.content.metadata,
          lastEditedBy: peerAuthor.email,
          lastSessionId: `sim-${Date.now()}`,
          lastSaveId: `sim-save-${Date.now()}`
        }
      },
      version: nextVersion,
      updatedAt: now
    };

    const nextDocs = rawDocs.map((d, idx) => (idx === docIndex ? updatedRaw : d));
    LocalDatabaseAdapter.saveRawDocuments(nextDocs);

    const hydrated = LocalDatabaseAdapter.hydrateDocumentForUser(updatedRaw, currentUser)!;
    return {
      committedVersion: nextVersion,
      simulatedAuthor: peerAuthor,
      updatedDoc: hydrated
    };
  }

  public static async deleteDocument(documentId: string, actor: ProfileDTO): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('documents').delete().eq('id', documentId);
      if (error) {
        throw new Error('Solo el propietario puede eliminar esta nota.');
      }
      return;
    }

    const rawDocs = LocalDatabaseAdapter.getRawDocuments();
    const target = rawDocs.find((d) => d.id === documentId);
    if (!target) {
      throw new Error('No se encontró la nota.');
    }

    if (target.ownerId !== actor.id && actor.role !== 'admin') {
      throw new Error('Solo el propietario puede eliminar esta nota.');
    }

    LocalDatabaseAdapter.saveRawDocuments(rawDocs.filter((d) => d.id !== documentId));
    const collabs = LocalDatabaseAdapter.getRawCollaborators();
    LocalDatabaseAdapter.saveRawCollaborators(
      collabs.filter((c) => c.documentId !== documentId)
    );
  }

  public static async shareDocumentByEmail(
    request: ShareDocumentRequestDTO,
    actor: ProfileDTO
  ): Promise<DocumentDTO> {
    const targetEmail = request.targetEmail.trim().toLowerCase();
    if (!targetEmail) {
      throw new Error('Introduce un correo electrónico válido.');
    }

    const doc = await this.getDocumentById(request.documentId, actor);
    if (doc.ownerId !== actor.id && actor.role !== 'admin') {
      throw new Error('Solo el propietario de la nota puede gestionar colaboradores.');
    }

    if (
      targetEmail === actor.email.toLowerCase() ||
      targetEmail === doc.ownerProfile?.email.toLowerCase()
    ) {
      throw new Error('El propietario de la nota ya cuenta con acceso completo.');
    }

    let targetProfile = await AuthService.findProfileByEmail(targetEmail);
    if (!targetProfile && !isSupabaseConfigured()) {
      const displayName = targetEmail.split('@')[0] ?? 'Colaborador';
      targetProfile = LocalDatabaseAdapter.createProfileViaAuthTrigger({
        email: targetEmail,
        fullName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
        role: request.permission
      });
    }

    if (!targetProfile) {
      throw new Error(`No existe ningún usuario registrado con el correo "${targetEmail}".`);
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('document_collaborators').upsert(
        {
          document_id: request.documentId,
          user_id: targetProfile.id,
          permission: request.permission
        },
        { onConflict: 'document_id,user_id' }
      );

      if (error) {
        throw new Error(error.message);
      }
      return this.getDocumentById(request.documentId, actor);
    }

    const allCollabs = LocalDatabaseAdapter.getRawCollaborators();
    const existingIdx = allCollabs.findIndex(
      (c) => c.documentId === request.documentId && c.userId === targetProfile!.id
    );

    const newCollab: RawStoredCollaborator = {
      documentId: request.documentId,
      userId: targetProfile.id,
      permission: request.permission,
      createdAt: new Date().toISOString()
    };

    const nextCollabs =
      existingIdx >= 0
        ? allCollabs.map((c, idx) => (idx === existingIdx ? newCollab : c))
        : [...allCollabs, newCollab];

    LocalDatabaseAdapter.saveRawCollaborators(nextCollabs);
    return this.getDocumentById(request.documentId, actor);
  }

  public static async removeCollaborator(params: {
    readonly documentId: string;
    readonly targetUserId: string;
    readonly actor: ProfileDTO;
  }): Promise<DocumentDTO> {
    const doc = await this.getDocumentById(params.documentId, params.actor);
    if (
      doc.ownerId !== params.actor.id &&
      params.actor.role !== 'admin' &&
      params.targetUserId !== params.actor.id
    ) {
      throw new Error('No tienes permisos para revocar el acceso de este colaborador.');
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('document_collaborators')
        .delete()
        .eq('document_id', params.documentId)
        .eq('user_id', params.targetUserId);

      if (error) {
        throw new Error(error.message);
      }
      return this.getDocumentById(params.documentId, params.actor);
    }

    const allCollabs = LocalDatabaseAdapter.getRawCollaborators();
    const nextCollabs = allCollabs.filter(
      (c) => !(c.documentId === params.documentId && c.userId === params.targetUserId)
    );
    LocalDatabaseAdapter.saveRawCollaborators(nextCollabs);
    return this.getDocumentById(params.documentId, params.actor);
  }

  private static async fetchAndHydrateSupabaseDocument(
    documentId: string,
    actor: ProfileDTO
  ): Promise<DocumentDTO | null> {
    const supabase = getSupabaseClient();
    const [docRes, collabRes, profilesRes] = await Promise.all([
      supabase.from('documents').select('*').eq('id', documentId).maybeSingle(),
      supabase.from('document_collaborators').select('*').eq('document_id', documentId),
      supabase.from('profiles').select('*')
    ]);

    if (docRes.error || !docRes.data) return null;

    const hydrated = hydrateSupabaseRows({
      docRows: [docRes.data as DatabaseDocumentRow],
      collabRows: (collabRes.data ?? []) as DatabaseCollaboratorRow[],
      profileRows: (profilesRes.data ?? []) as DatabaseProfileRow[],
      actor
    });

    return hydrated[0] ?? null;
  }
}
