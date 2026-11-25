import type {
  BlockType,
  DocumentBlockDTO,
  DocumentContentDTO
} from '@/types/domain.types';

export interface BlockDiffSummary {
  readonly added: number;
  readonly modified: number;
  readonly removed: number;
  readonly unchanged: number;
}

/**
 * Bidirectional Markdown <-> JSONB Document Block Serializer & Structural Differ (v1.1 Preview)
 * Enables importing external `.md` RFCs directly into typed PostgreSQL JSONB blocks
 * and computing structural diffs between OCC versions.
 */
export class MarkdownSerializationService {
  public static parseMarkdownToBlocks(
    markdown: string,
    authorEmail: string
  ): DocumentContentDTO {
    const now = new Date().toISOString();
    const rawLines = markdown.replace(/\r\n/g, '\n').split('\n');
    const blocks: DocumentBlockDTO[] = [];

    let inCodeFence = false;
    let codeBuffer: string[] = [];

    const pushBlock = (type: BlockType, text: string, checked?: boolean) => {
      blocks.push({
        id: `blk-md-${blocks.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        text,
        checked,
        updatedBy: authorEmail,
        updatedAt: now
      });
    };

    for (const line of rawLines) {
      if (line.trim().startsWith('```')) {
        if (inCodeFence) {
          pushBlock('code', codeBuffer.join('\n'));
          codeBuffer = [];
          inCodeFence = false;
        } else {
          inCodeFence = true;
        }
        continue;
      }

      if (inCodeFence) {
        codeBuffer.push(line);
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('# ')) {
        pushBlock('heading-1', trimmed.slice(2).trim());
      } else if (trimmed.startsWith('## ')) {
        pushBlock('heading-2', trimmed.slice(3).trim());
      } else if (/^- \[[ xX]\] /.test(trimmed)) {
        const isChecked = trimmed[3]?.toLowerCase() === 'x';
        pushBlock('checklist', trimmed.slice(6).trim(), isChecked);
      } else if (trimmed.startsWith('> ')) {
        pushBlock('quote', trimmed.slice(2).trim());
      } else {
        pushBlock('paragraph', trimmed);
      }
    }

    if (inCodeFence && codeBuffer.length > 0) {
      pushBlock('code', codeBuffer.join('\n'));
    }

    if (blocks.length === 0) {
      pushBlock('paragraph', '');
    }

    return {
      blocks,
      metadata: {
        tags: ['Imported', 'Markdown'],
        lastEditedBy: authorEmail
      }
    };
  }

  public static serializeBlocksToMarkdown(
    title: string,
    content: DocumentContentDTO
  ): string {
    const out: string[] = [`# ${title}`, ''];
    for (const block of content.blocks) {
      switch (block.type) {
        case 'heading-1':
          out.push(`# ${block.text}`, '');
          break;
        case 'heading-2':
          out.push(`## ${block.text}`, '');
          break;
        case 'checklist':
          out.push(`- [${block.checked ? 'x' : ' '}] ${block.text}`);
          break;
        case 'code':
          out.push('```', block.text, '```', '');
          break;
        case 'quote':
          out.push(`> ${block.text}`, '');
          break;
        default:
          out.push(block.text, '');
          break;
      }
    }
    return out.join('\n').trimEnd() + '\n';
  }

  public static diffDocumentVersions(
    previous: DocumentContentDTO,
    next: DocumentContentDTO
  ): BlockDiffSummary {
    const prevMap = new Map(previous.blocks.map((b) => [b.id, b]));
    const nextMap = new Map(next.blocks.map((b) => [b.id, b]));

    let added = 0;
    let modified = 0;
    let unchanged = 0;
    let removed = 0;

    nextMap.forEach((nb, id) => {
      const pb = prevMap.get(id);
      if (!pb) {
        added += 1;
      } else if (pb.text !== nb.text || pb.type !== nb.type || pb.checked !== nb.checked) {
        modified += 1;
      } else {
        unchanged += 1;
      }
    });

    prevMap.forEach((_pb, id) => {
      if (!nextMap.has(id)) removed += 1;
    });

    return { added, modified, removed, unchanged };
  }
}
