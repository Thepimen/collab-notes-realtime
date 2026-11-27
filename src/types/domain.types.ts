/**
 * Strict Domain Types & Data Transfer Objects (DTOs)
 * Enforces strong typing across the Service Layer, Custom Hooks, and UI Components.
 */

export type AppRole = 'admin' | 'editor' | 'viewer';

export type CollaboratorPermission = 'editor' | 'viewer';

export type BlockType =
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'paragraph'
  | 'bullet'
  | 'checklist'
  | 'callout'
  | 'code'
  | 'quote'
  | 'image'
  | 'divider';

export type ImageBlockSize = 'compact' | 'normal' | 'full';

export type SyncStatus =
  | 'SYNCED'
  | 'SAVING'
  | 'PENDING'
  | 'CONFLICT_MERGED'
  | 'OFFLINE'
  | 'ERROR';

export interface ProfileDTO {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly avatarUrl: string;
  readonly role: AppRole;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type SignUpResultDTO =
  | {
      readonly status: 'AUTHENTICATED';
      readonly profile: ProfileDTO;
      readonly message: string;
    }
  | {
      readonly status: 'CONFIRMATION_REQUIRED';
      readonly email: string;
      readonly message: string;
    };

export interface DocumentBlockDTO {
  readonly id: string;
  readonly type: BlockType;
  readonly text: string;
  readonly checked?: boolean;
  readonly imageUrl?: string;
  readonly imageCaption?: string;
  readonly imageSize?: ImageBlockSize;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export interface DocumentMetadataDTO {
  readonly tags?: readonly string[];
  readonly lastEditedBy?: string;
  readonly pinned?: boolean;
  readonly icon?: string;
  readonly lastSessionId?: string;
  readonly lastSaveId?: string;
}

export interface DocumentContentDTO {
  readonly blocks: readonly DocumentBlockDTO[];
  readonly metadata?: DocumentMetadataDTO;
}

export interface CollaboratorDTO {
  readonly documentId: string;
  readonly userId: string;
  readonly permission: CollaboratorPermission;
  readonly createdAt: string;
  readonly profile: ProfileDTO;
}

export interface DocumentDTO {
  readonly id: string;
  readonly title: string;
  readonly content: DocumentContentDTO;
  readonly ownerId: string;
  readonly ownerProfile?: ProfileDTO;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly collaborators: readonly CollaboratorDTO[];
  readonly effectivePermission: 'owner' | 'admin' | 'editor' | 'viewer';
}

export interface CreateDocumentDTO {
  readonly title: string;
  readonly content?: DocumentContentDTO;
  readonly ownerId: string;
}

export interface UpdateDocumentOCCRequestDTO {
  readonly documentId: string;
  readonly title: string;
  readonly content: DocumentContentDTO;
  readonly expectedVersion: number;
  readonly baseContent?: DocumentContentDTO;
  readonly baseTitle?: string;
  readonly actorEmail: string;
  readonly currentSnapshot?: DocumentDTO;
  /**
   * When false (active editing session), persists content atomically WITHOUT incrementing
   * `version`. When true (closing/leaving the note), commits the session and increments `version` once.
   */
  readonly bumpVersion?: boolean;
  readonly clientSessionId?: string;
  readonly clientSaveId?: string;
  readonly expectedRemoteSaveId?: string;
}

export interface OptimisticUpdateResultDTO {
  readonly document: DocumentDTO;
  readonly wasMerged: boolean;
  readonly previousVersion: number;
  readonly newVersion: number;
  readonly conflictDetails?: string;
}

export interface ShareDocumentRequestDTO {
  readonly documentId: string;
  readonly targetEmail: string;
  readonly permission: CollaboratorPermission;
}

export interface PresenceUserDTO {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly avatarUrl: string;
  readonly role: AppRole | 'owner';
  readonly isTyping: boolean;
  readonly activeBlockId: string | null;
  readonly lastActiveAt: string;
  readonly color: string;
}

export interface BroadcastContentDeltaDTO {
  readonly documentId: string;
  readonly senderId: string;
  readonly senderSessionId?: string;
  readonly senderEmail: string;
  readonly senderName: string;
  readonly title: string;
  readonly content: DocumentContentDTO;
  readonly baseVersion: number;
  readonly timestamp: string;
}

export interface ToastNotificationDTO {
  readonly id: string;
  readonly type: 'success' | 'error' | 'warning' | 'info';
  readonly title: string;
  readonly message: string;
  readonly createdAt: number;
}

export interface OccTransactionEntryDTO {
  readonly id: string;
  readonly timestamp: string;
  readonly actorEmail: string;
  readonly outcome: 'COMMITTED' | 'MERGED_3WAY' | 'RLS_REJECTED' | 'REMOTE_SYNC';
  readonly expectedVersion: number;
  readonly committedVersion: number;
  readonly summary: string;
}
