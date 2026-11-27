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

function sameIdSequence(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isBlockDifferent(a: DocumentBlockDTO, b: DocumentBlockDTO | undefined): boolean {
  if (!b) return true;
  return (
    a.text !== b.text ||
    a.type !== b.type ||
    a.checked !== b.checked ||
    a.imageUrl !== b.imageUrl ||
    a.imageCaption !== b.imageCaption ||
    a.imageSize !== b.imageSize
  );
}

/**
 * Pure, immutable service that implements 3-Way Block-Level Merging on JSONB document structures
 * to prevent Lost Updates when concurrent editors modify the same document simultaneously.
 */
export class ConcurrencyService {
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
    } else if (
      localTitleChanged &&
      remoteTitleChanged &&
      localTitle.trim() !== remoteTitle.trim()
    ) {
      mergedTitle = `${remoteTitle} / ${localTitle}`;
      conflicts.push('Se combinaron ediciones simultáneas en el título.');
    }

    // 2. Index base, remote, and local blocks by immutable ID
    const baseIds = (baseContent?.blocks ?? []).map((b) => b.id);
    const remoteIds = remoteContent.blocks.map((b) => b.id);
    const localIds = localContent.blocks.map((b) => b.id);

    const baseBlockMap = new Map<string, DocumentBlockDTO>(
      (baseContent?.blocks ?? []).map((b) => [b.id, { ...b }])
    );
    const remoteBlockMap = new Map<string, DocumentBlockDTO>(
      remoteContent.blocks.map((b) => [b.id, { ...b }])
    );
    const localBlockMap = new Map<string, DocumentBlockDTO>(
      localContent.blocks.map((b) => [b.id, { ...b }])
    );

    // Preserve local block reordering when remote did not reorder blocks
    const remoteReordered = baseIds.length > 0 && !sameIdSequence(baseIds, remoteIds);
    const localReordered = baseIds.length > 0 && !sameIdSequence(baseIds, localIds);

    let orderedIds: string[];
    if (localReordered && !remoteReordered) {
      orderedIds = [...localIds];
      remoteContent.blocks.forEach((remoteBlock, index) => {
        if (!orderedIds.includes(remoteBlock.id)) {
          const prevBlockId = index > 0 ? remoteContent.blocks[index - 1]?.id : undefined;
          const insertAfterIdx = prevBlockId ? orderedIds.indexOf(prevBlockId) : -1;
          if (insertAfterIdx >= 0) {
            orderedIds.splice(insertAfterIdx + 1, 0, remoteBlock.id);
          } else {
            orderedIds.push(remoteBlock.id);
          }
        }
      });
    } else {
      orderedIds = [...remoteIds];
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
    }

    const mergedBlocks: DocumentBlockDTO[] = [];

    for (const blockId of orderedIds) {
      const baseBlock = baseBlockMap.get(blockId);
      const remoteBlock = remoteBlockMap.get(blockId);
      const localBlock = localBlockMap.get(blockId);

      if (remoteBlock && localBlock) {
        const localModified = isBlockDifferent(localBlock, baseBlock);
        const remoteModified = isBlockDifferent(remoteBlock, baseBlock);

        if (localModified && !remoteModified) {
          mergedBlocks.push({ ...localBlock });
        } else if (!localModified && remoteModified) {
          mergedBlocks.push({ ...remoteBlock });
        } else if (localModified && remoteModified) {
          if (!isBlockDifferent(localBlock, remoteBlock)) {
            mergedBlocks.push({ ...remoteBlock });
          } else if (localBlock.type === 'image' || remoteBlock.type === 'image') {
            mergedBlocks.push({
              ...remoteBlock,
              ...localBlock,
              imageUrl: localBlock.imageUrl ?? remoteBlock.imageUrl,
              imageCaption: localBlock.imageCaption ?? remoteBlock.imageCaption,
              updatedBy: localAuthorEmail,
              updatedAt: new Date().toISOString()
            });
          } else {
            const combinedText = ConcurrencyService.combineConflictingBlockText(
              baseBlock?.text ?? '',
              remoteBlock.text,
              localBlock.text,
              localAuthorEmail
            );
            conflicts.push(
              'Se fusionó una edición simultánea en el mismo bloque conservando ambos textos.'
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

      if (localBlock && !remoteBlock) {
        const existedInBase = baseBlockMap.has(blockId);
        if (!existedInBase) {
          mergedBlocks.push({ ...localBlock });
        } else if (isBlockDifferent(localBlock, baseBlock)) {
          conflicts.push('Se conservó un bloque editado mientras otro colaborador lo eliminaba.');
          mergedBlocks.push({ ...localBlock });
        }
        continue;
      }

      if (remoteBlock && !localBlock) {
        const existedInBase = baseBlockMap.has(blockId);
        if (!existedInBase) {
          mergedBlocks.push({ ...remoteBlock });
        } else if (isBlockDifferent(remoteBlock, baseBlock)) {
          conflicts.push('Se conservó un bloque actualizado por otro colaborador.');
          mergedBlocks.push({ ...remoteBlock });
        }
      }
    }

    const baseTags = baseContent?.metadata?.tags ?? [];
    const localTags = localContent.metadata?.tags ?? [];
    const remoteTags = remoteContent.metadata?.tags ?? [];
    const localTagsChanged = JSON.stringify(localTags) !== JSON.stringify(baseTags);
    const remoteTagsChanged = JSON.stringify(remoteTags) !== JSON.stringify(baseTags);

    const mergedTags =
      localTagsChanged && !remoteTagsChanged
        ? [...localTags]
        : !localTagsChanged && remoteTagsChanged
          ? [...remoteTags]
          : Array.from(new Set([...remoteTags, ...localTags]));

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

  private static combineConflictingBlockText(
    baseText: string,
    remoteText: string,
    localText: string,
    localAuthor: string
  ): string {
    if (remoteText.includes(localText)) {
      return remoteText;
    }
    if (localText.includes(remoteText)) {
      return localText;
    }
    if (baseText && remoteText.startsWith(baseText) && localText.startsWith(baseText)) {
      const remoteSuffix = remoteText.slice(baseText.length);
      const localSuffix = localText.slice(baseText.length);
      return `${baseText}${remoteSuffix} ${localSuffix}`.trim();
    }
    const shortAuthor = localAuthor.split('@')[0] ?? localAuthor;
    return `${remoteText}\n[${shortAuthor}]: ${localText}`;
  }
}
