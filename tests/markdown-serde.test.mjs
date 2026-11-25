import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function parseMarkdownPreview(md) {
  const lines = md.trim().split('\n');
  const blocks = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    if (t.startsWith('# ')) blocks.push({ type: 'heading-1', text: t.slice(2) });
    else if (t.startsWith('## ')) blocks.push({ type: 'heading-2', text: t.slice(3) });
    else if (/^- \[[ xX]\] /.test(t)) {
      blocks.push({ type: 'checklist', checked: t[3].toLowerCase() === 'x', text: t.slice(6) });
    } else if (t.startsWith('> ')) blocks.push({ type: 'quote', text: t.slice(2) });
    else blocks.push({ type: 'paragraph', text: t });
  }
  return blocks;
}

describe('Markdown <-> JSONB Block AST Serializer (v1.1 Feature Branch)', () => {
  it('parses headings, checklists, quotes, and paragraphs into typed JSONB blocks', () => {
    const sample = [
      '# Architecture RFC',
      '## Goals',
      '- [x] Enforce PostgreSQL RLS',
      '- [ ] Add Markdown importer',
      '> Never trust frontend-only guards.',
      'Body paragraph text.'
    ].join('\n');

    const blocks = parseMarkdownPreview(sample);
    assert.equal(blocks.length, 6);
    assert.equal(blocks[0].type, 'heading-1');
    assert.equal(blocks[2].type, 'checklist');
    assert.equal(blocks[2].checked, true);
    assert.equal(blocks[3].checked, false);
    assert.equal(blocks[4].type, 'quote');
  });
});
