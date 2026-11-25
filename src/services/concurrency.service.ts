import type {
  DocumentBlockDTO,
  DocumentContentDTO
} from '@/types/domain.types';

/**
 * Result of a deterministic 3-way JSONB Document Merge for Optimistic Concurrency Control (OCC).
 */
export interface MergeDocumentResult {
  readonly mergedTitle: string;
  readonly mergedContent: DocumentContentDTO;
  readonly conflictSummary: readonly string[];
}

/**
 * Pure, immutable service that implements 3-Way Block-Level Merging on JSONB document structures
 * to prevent Lost Updates when concurrent editors modify the same document version simultaneously.
 */
export class ConcurrencyService {
  /**
   * Performs an immutable 3-way merge between:
   * - base: The snapshot at the version the client originally read (v_N)
   * - local: The client's local unsaved state
   * - remote: The latest committed state in PostgreSQL (v_N+k)
   */
  public static mergeConcurrentChanges(params: {
    readonly baseTitle: string;
    readonly localTitle: string;
    readonly remoteTitle: string;
    readonly baseContent?: DocumentContentDTO;
    readonly localContent: DocumentContentDTO;
    readonly remoteContent: DocumentContentDTO;
    readonly localAuthorEmail: string;
  }): MergeDocumentResult {
    const {
      baseTitle,
      localTitle,
      remoteTitle,
      baseContent,
      localContent,
      remoteContent,
      localAuthorEmail
    } = params;

    const conflicts: string[] = [];

    // 1. Resolve Title via 3-way comparison
    let mergedTitle = remoteTitle;
    const localTitleChanged = localTitle.trim() !== baseTitle.trim();
    const remoteTitleChanged = remoteTitle.trim() !== baseTitle.trim();

    if (localTitleChanged && !remoteTitleChanged) {
      mergedTitle = localTitle;
    } else if (localTitleChanged && remoteTitleChanged && localTitle.trim() !== remoteTitle.trim()) {
      mergedTitle = `${remoteTitle} / ${localTitle}`;
      conflicts.push('Both users edited the title concurrently; combined both titles.');
    }

    // 2. Index base, remote, and local JSONB blocks by immutable ID
    const baseBlockMap = new Map<string, DocumentBlockDTO>(
      (baseContent?.blocks ?? []).map((b) => [b.id, { ...b }])
    );
    const remoteBlockMap = new Map<string, DocumentBlockDTO>(
      remoteContent.blocks.map((b) => [b.id, { ...b }])
    );
    const localBlockMap = new Map<string, DocumentBlockDTO>(
      localContent.blocks.map((b) => [b.id, { ...b }])
    );

    // Build ordered union of block IDs preserving remote order + local insertions
    const orderedIds: string[] = [...remoteContent.blocks.map((b) => b.id)];
    localContent.blocks.forEach((localBlock, index) => {
      if (!orderedIds.includes(localBlock.id)) {
        const prevBlockId = index > 0 ? localContent.blocks[index - 1]?.id : undefined;
        const insertAfterIdx = prevBlockId ? orderedIds.indexOf(prevBlockId) : -1;
        if (insertAfterIdx >= 0) {
          let insertPos = insertAfterIdx + 1;
          while (
            insertPos < orderedIds.length &&
            !baseBlockMap.has(orderedIds[insertPos]!)
          ) {
            insertPos += 1;
          }
          orderedIds.splice(insertPos, 0, localBlock.id);
        } else {
          orderedIds.push(localBlock.id);
        }
      }
    });

    const mergedBlocks: DocumentBlockDTO[] = [];

    for (const blockId of orderedIds) {
      const baseBlock = baseBlockMap.get(blockId);
      const remoteBlock = remoteBlockMap.get(blockId);
      const localBlock = localBlockMap.get(blockId);

      // Case A: Block exists in both remote and local
      if (remoteBlock && localBlock) {
        const localModified =
          !baseBlock ||
          localBlock.text !== baseBlock.text ||
          localBlock.type !== baseBlock.type ||
          localBlock.checked !== baseBlock.checked;

        const remoteModified =
          !baseBlock ||
          remoteBlock.text !== baseBlock.text ||
          remoteBlock.type !== baseBlock.type ||
          remoteBlock.checked !== baseBlock.checked;

        if (localModified && !remoteModified) {
          mergedBlocks.push({ ...localBlock });
        } else if (!localModified && remoteModified) {
          mergedBlocks.push({ ...remoteBlock });
        } else if (localModified && remoteModified) {
          // True block-level collision: both clients modified the same block ID concurrently
          if (
            localBlock.text === remoteBlock.text &&
            localBlock.type === remoteBlock.type &&
            localBlock.checked === remoteBlock.checked
          ) {
            mergedBlocks.push({ ...remoteBlock });
          } else {
            const combinedText = ConcurrencyService.combineConflictingBlockText(
              baseBlock?.text ?? '',
              remoteBlock.text,
              localBlock.text,
              remoteBlock.updatedBy,
              localAuthorEmail
            );
            conflicts.push(
              `Block "${blockId}" had concurrent edits from ${remoteBlock.updatedBy} and ${localAuthorEmail}; merged non-destructively.`
            );
            mergedBlocks.push({
              ...remoteBlock,
              type: localBlock.type,
              text: combinedText,
              checked: localBlock.checked ?? remoteBlock.checked,
              updatedBy: localAuthorEmail,
              updatedAt: new Date().toISOString()
            });
          }
        } else {
          mergedBlocks.push({ ...remoteBlock });
        }
        continue;
      }

      // Case B: Block exists only in local (newly inserted by local user, or deleted remotely)
      if (localBlock && !remoteBlock) {
        const existedInBase = baseBlockMap.has(blockId);
        if (!existedInBase) {
          // Newly added by local user -> keep it!
          mergedBlocks.push({ ...localBlock });
        } else {
          // Existed in base, deleted by remote user. Keep only if local user modified it
          const localEditedBeforeRemoteDelete =
            baseBlock && localBlock.text !== baseBlock.text;
          if (localEditedBeforeRemoteDelete) {
            conflicts.push(
              `Block "${blockId}" was edited locally while deleted remotely; preserved local edit.`
            );
            mergedBlocks.push({ ...localBlock });
          }
        }
        continue;
      }

      // Case C: Block exists only in remote (newly inserted by remote user, or deleted locally)
      if (remoteBlock && !localBlock) {
        const existedInBase = baseBlockMap.has(blockId);
        if (!existedInBase) {
          // Newly added by remote user -> keep it!
          mergedBlocks.push({ ...remoteBlock });
        } else {
          // Existed in base, deleted by local user. Keep only if remote user modified it
          const remoteEditedBeforeLocalDelete =
            baseBlock && remoteBlock.text !== baseBlock.text;
          if (remoteEditedBeforeLocalDelete) {
            conflicts.push(
              `Block "${blockId}" was edited remotely while deleted locally; preserved remote edit.`
            );
            mergedBlocks.push({ ...remoteBlock });
          }
        }
      }
    }

    // Merge tags immutably
    const mergedTags = Array.from(
      new Set([
        ...(remoteContent.metadata?.tags ?? []),
        ...(localContent.metadata?.tags ?? [])
      ])
    );

    return {
      mergedTitle,
      mergedContent: {
        blocks: mergedBlocks,
        metadata: {
          ...remoteContent.metadata,
          ...localContent.metadata,
          tags: mergedTags,
          lastEditedBy: localAuthorEmail
        }
      },
      conflictSummary: conflicts
    };
  }

  /**
   * Combines text from two concurrent edits on the exact same block without losing either contribution.
   */
  private static combineConflictingBlockText(
    baseText: string,
    remoteText: string,
    localText: string,
    remoteAuthor: string,
    localAuthor: string
  ): string {
    if (remoteText.includes(localText)) {
      return remoteText;
    }
    if (localText.includes(remoteText)) {
      return localText;
    }
    // If both appended to baseText, concatenate both suffixes cleanly
    if (baseText && remoteText.startsWith(baseText) && localText.startsWith(baseText)) {
      const remoteSuffix = remoteText.slice(baseText.length);
      const localSuffix = localText.slice(baseText.length);
      return `${baseText}${remoteSuffix} ${localSuffix}`.trim();
    }
    return `${remoteText}\n[Concurrent edit by ${localAuthor}]: ${localText}`;
  }
}
