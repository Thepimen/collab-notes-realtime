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

/**
 * Document & Collaborator Service
 * Encapsulates all PostgREST queries, JSONB payload serialization, RLS enforcement,
 * and Optimistic Concurrency Control (OCC) Compare-And-Swap transactions.
 */
export class DocumentService {
  /**
   * Lists all documents accessible by the current user (owned or shared as collaborator),
   * sorted by `updated_at DESC`.
   */
  public static async listAccessibleDocuments(actor: ProfileDTO): Promise<readonly DocumentDTO[]> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { data: docRows, error } = await supabase
          .from('documents')
          .select('*')
          .order('updated_at', { ascending: false });

        if (!error && docRows) {
          const results: DocumentDTO[] = [];
          for (const row of docRows) {
            const dto = await this.fetchAndHydrateSupabaseDocument(row.id, actor);
            if (dto) {
              results.push(dto);
            }
          }
          return results;
        }
      }

      const rawDocs = LocalDatabaseAdapter.getRawDocuments();
      const hydrated = rawDocs
        .map((doc) => LocalDatabaseAdapter.hydrateDocumentForUser(doc, actor))
        .filter((doc): doc is DocumentDTO => doc !== null)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return hydrated;
    } catch (error) {
      console.error('[DocumentService.listAccessibleDocuments] Failed:', error);
      throw new Error('Failed to load documents from storage.');
    }
  }

  /**
   * Retrieves a single document by ID, enforcing Row Level Security SELECT rules.
   */
  public static async getDocumentById(
    documentId: string,
    actor: ProfileDTO
  ): Promise<DocumentDTO> {
    try {
      if (isSupabaseConfigured()) {
        const dto = await this.fetchAndHydrateSupabaseDocument(documentId, actor);
        if (dto) return dto;
      }

      const rawDocs = LocalDatabaseAdapter.getRawDocuments();
      const target = rawDocs.find((d) => d.id === documentId);

      if (!target) {
        throw new Error('Document not found (HTTP 404).');
      }

      const hydrated = LocalDatabaseAdapter.hydrateDocumentForUser(target, actor);
      if (!hydrated) {
        throw new Error(
          'Access Denied by RLS Policy: You do not have permission to view this document (HTTP 403).'
        );
      }

      return hydrated;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to load document.';
      throw new Error(msg);
    }
  }

  /**
   * Creates a new document with initial structured JSONB blocks and version = 1.
   */
  public static async createDocument(
    payload: CreateDocumentDTO,
    actor: ProfileDTO
  ): Promise<DocumentDTO> {
    const now = new Date().toISOString();
    const initialContent: DocumentContentDTO = payload.content ?? {
      blocks: [
        {
          id: `blk-${crypto.randomUUID().slice(0, 8)}`,
          type: 'heading-1',
          text: payload.title.trim() || 'Untitled Collaborative Note',
          updatedBy: actor.email,
          updatedAt: now
        },
        {
          id: `blk-${crypto.randomUUID().slice(0, 8)}`,
          type: 'paragraph',
          text: 'Start typing here to collaborate in real time. Changes are automatically versioned and synchronized over WebSockets.',
          updatedBy: actor.email,
          updatedAt: now
        }
      ],
      metadata: {
        tags: ['Collaborative', 'JSONB'],
        lastEditedBy: actor.email
      }
    };

    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('documents')
          .insert({
            title: payload.title.trim() || 'Untitled Document',
            content: initialContent,
            owner_id: actor.id,
            version: 1
          })
          .select('*')
          .single();

        if (error || !data) {
          throw new Error(error?.message ?? 'Failed to insert document in Supabase.');
        }

        const hydrated = await this.fetchAndHydrateSupabaseDocument(data.id, actor);
        if (hydrated) return hydrated;
      }

      const newRawDoc: RawStoredDocument = {
        id: crypto.randomUUID(),
        title: payload.title.trim() || 'Untitled Document',
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
        throw new Error('Failed to hydrate newly created document.');
      }
      return hydrated;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not create document.';
      throw new Error(msg);
    }
  }

  /**
   * Updates a document using Optimistic Concurrency Control (OCC).
   * - Checks `WHERE id = documentId AND version = expectedVersion`
   * - If matched: increments `version = expectedVersion + 1` atomically.
   * - If version mismatch (another user saved concurrently): fetches the latest committed version,
   *   runs a deterministic 3-way JSONB block merge via `ConcurrencyService`, and persists `remote.version + 1`.
   */
  public static async updateDocumentWithOCC(
    request: UpdateDocumentOCCRequestDTO,
    actor: ProfileDTO
  ): Promise<OptimisticUpdateResultDTO> {
    const MAX_OCC_RETRIES = 3;
    let attempt = 0;
    let candidateTitle = request.title;
    let candidateContent = request.content;
    let candidateExpectedVersion = request.expectedVersion;
    let wasMerged = false;
    let conflictDetails: string | undefined;

    while (attempt < MAX_OCC_RETRIES) {
      attempt += 1;

      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { data: rpcRows, error: rpcError } = await supabase.rpc('update_document_occ', {
          p_document_id: request.documentId,
          p_title: candidateTitle,
          p_content: candidateContent,
          p_expected_version: candidateExpectedVersion
        });

        if (rpcError) {
          throw new Error(`RLS / OCC Database Error: ${rpcError.message}`);
        }

        const outcome = rpcRows?.[0];
        if (!outcome) {
          throw new Error('Unexpected empty response from update_document_occ RPC.');
        }

        if (outcome.success) {
          const updatedDto = await this.getDocumentById(request.documentId, actor);
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
          `Concurrent version v${outcome.current_version} detected and merged automatically.`;
        continue;
      }

      // Local / Hybrid PostgreSQL Engine with strict RLS & OCC Compare-And-Swap
      const rawDocs = LocalDatabaseAdapter.getRawDocuments();
      const docIndex = rawDocs.findIndex((d) => d.id === request.documentId);

      if (docIndex === -1) {
        throw new Error('Document no longer exists (HTTP 404).');
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
        throw new Error(
          'RLS Policy Violation (42501): Users with "viewer" permission cannot modify this document.'
        );
      }

      // Compare-And-Swap check: `WHERE id = $1 AND version = $2`
      if (currentDbDoc.version === candidateExpectedVersion) {
        const nextVersion = currentDbDoc.version + 1;
        const now = new Date().toISOString();

        const updatedRawDoc: RawStoredDocument = {
          ...currentDbDoc,
          title: candidateTitle,
          content: {
            blocks: candidateContent.blocks.map((b) => ({ ...b })),
            metadata: {
              ...candidateContent.metadata,
              lastEditedBy: actor.email
            }
          },
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

      // Version mismatch detected (currentDbDoc.version !== candidateExpectedVersion)!
      // Execute 3-way non-destructive JSONB block merge and retry CAS
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
      wasMerged = true;
      conflictDetails =
        mergeResult.conflictSummary.join(' ') ||
        `Merged concurrent changes from v${currentDbDoc.version} without data loss.`;
    }

    throw new Error(
      'Optimistic Concurrency Control exceeded maximum retry attempts under heavy write contention.'
    );
  }

  /**
   * Simulates an external collaborator committing a new version directly to the database
   * while the active user is editing, allowing interactive verification of OCC conflict resolution.
   */
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
      throw new Error('Document not found for concurrency simulation.');
    }

    const targetDoc = rawDocs[docIndex]!;
    const now = new Date().toISOString();
    const newBlockId = `blk-peer-${Math.random().toString(36).slice(2, 6)}`;

    const updatedBlocks = [
      ...targetDoc.content.blocks.map((b) => ({ ...b })),
      {
        id: newBlockId,
        type: 'quote' as const,
        text: `[Live Concurrent Commit by ${peerAuthor.fullName} at v${targetDoc.version + 1}]: Verified zero lost updates via OCC version Compare-And-Swap.`,
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
          lastEditedBy: peerAuthor.email
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

  /**
   * Deletes a document (restricted by RLS to the document owner or platform admin).
   */
  public static async deleteDocument(documentId: string, actor: ProfileDTO): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('documents').delete().eq('id', documentId);
      if (error) {
        throw new Error(`RLS Delete Policy Error: ${error.message}`);
      }
      return;
    }

    const rawDocs = LocalDatabaseAdapter.getRawDocuments();
    const target = rawDocs.find((d) => d.id === documentId);
    if (!target) {
      throw new Error('Document not found.');
    }

    if (target.ownerId !== actor.id && actor.role !== 'admin') {
      throw new Error(
        'RLS Policy Violation: Only the document owner or a platform admin can delete a document.'
      );
    }

    LocalDatabaseAdapter.saveRawDocuments(rawDocs.filter((d) => d.id !== documentId));
    const collabs = LocalDatabaseAdapter.getRawCollaborators();
    LocalDatabaseAdapter.saveRawCollaborators(
      collabs.filter((c) => c.documentId !== documentId)
    );
  }

  /**
   * Shares a document with a user by email address, assigning `'editor'` or `'viewer'` permission.
   */
  public static async shareDocumentByEmail(
    request: ShareDocumentRequestDTO,
    actor: ProfileDTO
  ): Promise<DocumentDTO> {
    const targetEmail = request.targetEmail.trim().toLowerCase();
    if (!targetEmail) {
      throw new Error('Please provide a valid collaborator email address.');
    }

    const doc = await this.getDocumentById(request.documentId, actor);
    if (doc.ownerId !== actor.id && actor.role !== 'admin') {
      throw new Error(
        'RLS Policy Violation: Only the document owner or admin can manage collaborators.'
      );
    }

    if (targetEmail === actor.email.toLowerCase() || targetEmail === doc.ownerProfile?.email.toLowerCase()) {
      throw new Error('The document owner already has full permissions.');
    }

    let targetProfile = await AuthService.findProfileByEmail(targetEmail);
    if (!targetProfile && !isSupabaseConfigured()) {
      // Automatically provision a collaborator profile in local evaluation mode if invited by email
      const displayName = targetEmail.split('@')[0] ?? 'Collaborator';
      targetProfile = LocalDatabaseAdapter.createProfileViaAuthTrigger({
        email: targetEmail,
        fullName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
        role: request.permission
      });
    }

    if (!targetProfile) {
      throw new Error(`No registered user found with email "${targetEmail}".`);
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

  /**
   * Removes a collaborator from a document.
   */
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
      throw new Error('RLS Policy Violation: Not authorized to revoke collaborator access.');
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

  /**
   * Helper for hydrating a Supabase document row with owner and collaborators.
   */
  private static async fetchAndHydrateSupabaseDocument(
    documentId: string,
    actor: ProfileDTO
  ): Promise<DocumentDTO | null> {
    const supabase = getSupabaseClient();
    const { data: docRow, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (docError || !docRow) return null;

    const { data: collabRows } = await supabase
      .from('document_collaborators')
      .select('*')
      .eq('document_id', documentId);

    const { data: profileRows } = await supabase.from('profiles').select('*');
    const profileMap = new Map<string, ProfileDTO>();
    (profileRows ?? []).forEach((r) => {
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

    const collaborators = (collabRows ?? []).map((c) => ({
      documentId: c.document_id,
      userId: c.user_id,
      permission: c.permission as CollaboratorPermission,
      createdAt: c.created_at,
      profile: profileMap.get(c.user_id) ?? {
        id: c.user_id,
        email: 'collaborator@collabnotes.io',
        fullName: 'Collaborator',
        avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=C',
        role: 'viewer' as const,
        createdAt: c.created_at,
        updatedAt: c.created_at
      }
    }));

    const isOwner = docRow.owner_id === actor.id;
    const isAdmin = actor.role === 'admin';
    const userCollab = collaborators.find((c) => c.userId === actor.id);

    if (!isOwner && !isAdmin && !userCollab) {
      return null;
    }

    const effectivePermission: DocumentDTO['effectivePermission'] = isOwner
      ? 'owner'
      : isAdmin
        ? 'admin'
        : userCollab
          ? userCollab.permission
          : 'viewer';

    return {
      id: docRow.id,
      title: docRow.title,
      content: docRow.content,
      ownerId: docRow.owner_id,
      ownerProfile: profileMap.get(docRow.owner_id),
      version: docRow.version,
      createdAt: docRow.created_at,
      updatedAt: docRow.updated_at,
      collaborators,
      effectivePermission
    };
  }
}
