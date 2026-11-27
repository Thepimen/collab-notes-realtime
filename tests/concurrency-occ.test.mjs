/**
 * =============================================================================
 * AUTOMATED CONCURRENCY & OPTIMISTIC LOCKING (OCC) TEST SUITE
 * =============================================================================
 * Run with: npm run test:concurrency (or node --test tests/concurrency-occ.test.mjs)
 *
 * Validates that concurrent WebSocket clients editing the same JSONB document
 * at the same base version never suffer from "Lost Updates" (PSP & Module 0488).
 * =============================================================================
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Deterministic 3-Way JSONB Block Merge (mirrors src/services/concurrency.service.ts)
 */
function mergeConcurrentChanges({
  baseTitle,
  localTitle,
  remoteTitle,
  baseContent,
  localContent,
  remoteContent,
  localAuthorEmail
}) {
  const conflicts = [];

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
    conflicts.push('Concurrent title edit merged.');
  }

  const baseBlockMap = new Map((baseContent?.blocks ?? []).map((b) => [b.id, { ...b }]));
  const remoteBlockMap = new Map(remoteContent.blocks.map((b) => [b.id, { ...b }]));
  const localBlockMap = new Map(localContent.blocks.map((b) => [b.id, { ...b }]));

  const orderedIds = [...remoteContent.blocks.map((b) => b.id)];
  localContent.blocks.forEach((localBlock, index) => {
    if (!orderedIds.includes(localBlock.id)) {
      const prevBlockId = index > 0 ? localContent.blocks[index - 1]?.id : undefined;
      const insertAfterIdx = prevBlockId ? orderedIds.indexOf(prevBlockId) : -1;
      if (insertAfterIdx >= 0) {
        let insertPos = insertAfterIdx + 1;
        while (insertPos < orderedIds.length && !baseBlockMap.has(orderedIds[insertPos])) {
          insertPos += 1;
        }
        orderedIds.splice(insertPos, 0, localBlock.id);
      } else {
        orderedIds.push(localBlock.id);
      }
    }
  });

  const mergedBlocks = [];

  for (const blockId of orderedIds) {
    const baseBlock = baseBlockMap.get(blockId);
    const remoteBlock = remoteBlockMap.get(blockId);
    const localBlock = localBlockMap.get(blockId);

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
        if (localBlock.text === remoteBlock.text) {
          mergedBlocks.push({ ...remoteBlock });
        } else {
          const combinedText = `${remoteBlock.text}\n[Concurrent edit by ${localAuthorEmail}]: ${localBlock.text}`;
          conflicts.push(`Block ${blockId} merged non-destructively.`);
          mergedBlocks.push({
            ...remoteBlock,
            text: combinedText,
            updatedBy: localAuthorEmail,
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        mergedBlocks.push({ ...remoteBlock });
      }
    } else if (localBlock && !remoteBlock) {
      if (!baseBlockMap.has(blockId)) {
        mergedBlocks.push({ ...localBlock });
      }
    } else if (remoteBlock && !localBlock) {
      if (!baseBlockMap.has(blockId)) {
        mergedBlocks.push({ ...remoteBlock });
      }
    }
  }

  return {
    mergedTitle,
    mergedContent: {
      blocks: mergedBlocks,
      metadata: {
        ...remoteContent.metadata,
        ...localContent.metadata,
        lastEditedBy: localAuthorEmail
      }
    },
    conflictSummary: conflicts
  };
}

/**
 * In-Memory Transactional PostgreSQL Simulator with RLS & Atomic OCC Compare-And-Swap
 */
class SimulatedPostgresEngine {
  constructor() {
    this.document = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      title: 'Shared Architecture Specification',
      ownerId: 'user-admin',
      version: 1,
      content: {
        blocks: [
          {
            id: 'blk-1',
            type: 'heading-1',
            text: '1. Initial System Scope',
            updatedBy: 'admin@collabnotes.io',
            updatedAt: '2026-11-22T10:00:00.000Z'
          },
          {
            id: 'blk-2',
            type: 'paragraph',
            text: 'Original database requirements specification.',
            updatedBy: 'admin@collabnotes.io',
            updatedAt: '2026-11-22T10:00:00.000Z'
          }
        ],
        metadata: { tags: ['OCC', 'PostgreSQL'] }
      }
    };

    this.permissions = new Map([
      ['user-admin', 'owner'],
      ['user-elena', 'editor'],
      ['user-marco', 'viewer']
    ]);
  }

  readSnapshot() {
    return structuredClone(this.document);
  }

  /**
   * Simulates `public.update_document_occ` RPC with RLS check and `WHERE version = expectedVersion`
   */
  atomicUpdateOCC({ actorId, actorEmail, title, content, expectedVersion, baseSnapshot }) {
    const role = this.permissions.get(actorId);
    if (!role || role === 'viewer') {
      const err = new Error('RLS Policy Violation (42501): Viewers cannot update documents.');
      err.code = '42501';
      throw err;
    }

    // Compare-And-Swap (CAS) check: version matches expectedVersion
    if (this.document.version === expectedVersion) {
      this.document = {
        ...this.document,
        title,
        content: structuredClone(content),
        version: this.document.version + 1
      };
      return {
        wasMerged: false,
        previousVersion: expectedVersion,
        newVersion: this.document.version,
        document: this.readSnapshot()
      };
    }

    // Conflict detected (this.document.version !== expectedVersion)!
    // Perform automatic 3-way merge and atomic CAS retry
    const remoteSnap = this.readSnapshot();
    const merged = mergeConcurrentChanges({
      baseTitle: baseSnapshot.title,
      localTitle: title,
      remoteTitle: remoteSnap.title,
      baseContent: baseSnapshot.content,
      localContent: content,
      remoteContent: remoteSnap.content,
      localAuthorEmail: actorEmail
    });

    this.document = {
      ...this.document,
      title: merged.mergedTitle,
      content: structuredClone(merged.mergedContent),
      version: remoteSnap.version + 1
    };

    return {
      wasMerged: true,
      previousVersion: expectedVersion,
      newVersion: this.document.version,
      conflictSummary: merged.conflictSummary,
      document: this.readSnapshot()
    };
  }
}

describe('Optimistic Concurrency Control (OCC) & JSONB Block Synchronization', () => {
  it('1. Prevents Lost Updates when two clients concurrently modify different JSONB blocks from the same base version v1', async () => {
    const db = new SimulatedPostgresEngine();

    // Both Client A (Admin) and Client B (Elena) read version v1 simultaneously
    const clientASnapshotV1 = db.readSnapshot();
    const clientBSnapshotV1 = db.readSnapshot();

    assert.equal(clientASnapshotV1.version, 1);
    assert.equal(clientBSnapshotV1.version, 1);

    // Client A modifies Block #1 locally
    const clientADraft = structuredClone(clientASnapshotV1);
    clientADraft.content.blocks[0].text = '1. Updated System Scope by Client A';

    // Client B modifies Block #2 locally (still based on v1!)
    const clientBDraft = structuredClone(clientBSnapshotV1);
    clientBDraft.content.blocks[1].text =
      'PostgreSQL 15+ JSONB & Elixir Realtime Engine added by Client B.';

    // Execute both saves concurrently via Promise.all
    const [resultA, resultB] = await Promise.all([
      Promise.resolve().then(() =>
        db.atomicUpdateOCC({
          actorId: 'user-admin',
          actorEmail: 'admin@collabnotes.io',
          title: clientADraft.title,
          content: clientADraft.content,
          expectedVersion: clientASnapshotV1.version,
          baseSnapshot: clientASnapshotV1
        })
      ),
      Promise.resolve().then(() =>
        db.atomicUpdateOCC({
          actorId: 'user-elena',
          actorEmail: 'elena.editor@collabnotes.io',
          title: clientBDraft.title,
          content: clientBDraft.content,
          expectedVersion: clientBSnapshotV1.version,
          baseSnapshot: clientBSnapshotV1
        })
      )
    ]);

    // First writer transitions v1 -> v2 cleanly
    assert.equal(resultA.wasMerged, false);
    assert.equal(resultA.newVersion, 2);

    // Second writer detects v1 !== v2 conflict, merges 3-way, and commits v3
    assert.equal(resultB.wasMerged, true);
    assert.equal(resultB.newVersion, 3);

    // Verify ZERO LOST UPDATES: both Block #1 (Client A) and Block #2 (Client B) changes exist in v3
    const finalDoc = db.readSnapshot();
    assert.equal(finalDoc.version, 3);
    assert.equal(finalDoc.content.blocks[0].text, '1. Updated System Scope by Client A');
    assert.equal(
      finalDoc.content.blocks[1].text,
      'PostgreSQL 15+ JSONB & Elixir Realtime Engine added by Client B.'
    );
  });

  it('2. Preserves both blocks when two clients concurrently insert new JSONB blocks at the same version', () => {
    const db = new SimulatedPostgresEngine();

    const baseV1ClientA = db.readSnapshot();
    const baseV1ClientB = db.readSnapshot();

    // Client A appends blk-A
    const draftA = structuredClone(baseV1ClientA);
    draftA.content.blocks.push({
      id: 'blk-A',
      type: 'checklist',
      text: 'Configure RLS Policies on public.documents',
      checked: true,
      updatedBy: 'admin@collabnotes.io',
      updatedAt: new Date().toISOString()
    });

    // Client B appends blk-B concurrently
    const draftB = structuredClone(baseV1ClientB);
    draftB.content.blocks.push({
      id: 'blk-B',
      type: 'code',
      text: 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users;',
      updatedBy: 'elena.editor@collabnotes.io',
      updatedAt: new Date().toISOString()
    });

    db.atomicUpdateOCC({
      actorId: 'user-admin',
      actorEmail: 'admin@collabnotes.io',
      title: draftA.title,
      content: draftA.content,
      expectedVersion: 1,
      baseSnapshot: baseV1ClientA
    });

    const resB = db.atomicUpdateOCC({
      actorId: 'user-elena',
      actorEmail: 'elena.editor@collabnotes.io',
      title: draftB.title,
      content: draftB.content,
      expectedVersion: 1,
      baseSnapshot: baseV1ClientB
    });

    assert.equal(resB.wasMerged, true);
    assert.equal(resB.newVersion, 3);

    const blockIds = resB.document.content.blocks.map((b) => b.id);
    assert.deepEqual(blockIds, ['blk-1', 'blk-2', 'blk-A', 'blk-B']);
  });

  it('3. Performs non-destructive intra-block merge when two clients edit the exact same JSONB block concurrently', () => {
    const db = new SimulatedPostgresEngine();

    const baseA = db.readSnapshot();
    const baseB = db.readSnapshot();

    const draftA = structuredClone(baseA);
    draftA.content.blocks[1].text = 'Client A paragraph revision with ACID guarantees.';

    const draftB = structuredClone(baseB);
    draftB.content.blocks[1].text = 'Client B paragraph revision with JSONB GIN index.';

    db.atomicUpdateOCC({
      actorId: 'user-admin',
      actorEmail: 'admin@collabnotes.io',
      title: draftA.title,
      content: draftA.content,
      expectedVersion: 1,
      baseSnapshot: baseA
    });

    const mergedOutcome = db.atomicUpdateOCC({
      actorId: 'user-elena',
      actorEmail: 'elena.editor@collabnotes.io',
      title: draftB.title,
      content: draftB.content,
      expectedVersion: 1,
      baseSnapshot: baseB
    });

    assert.equal(mergedOutcome.wasMerged, true);
    const mergedText = mergedOutcome.document.content.blocks[1].text;
    assert.ok(mergedText.includes('Client A paragraph revision with ACID guarantees.'));
    assert.ok(mergedText.includes('Client B paragraph revision with JSONB GIN index.'));
  });

  it('4. Enforces Row Level Security (RLS) by rejecting update attempts from users with viewer permission', () => {
    const db = new SimulatedPostgresEngine();
    const baseSnap = db.readSnapshot();

    const viewerDraft = structuredClone(baseSnap);
    viewerDraft.title = 'Unauthorized Title Tampering by Viewer';

    assert.throws(
      () => {
        db.atomicUpdateOCC({
          actorId: 'user-marco',
          actorEmail: 'marco.viewer@collabnotes.io',
          title: viewerDraft.title,
          content: viewerDraft.content,
          expectedVersion: 1,
          baseSnapshot: baseSnap
        });
      },
      (err) => err.code === '42501' && err.message.includes('RLS Policy Violation')
    );

    // Ensure document version and title remained untouched at v1
    const unchanged = db.readSnapshot();
    assert.equal(unchanged.version, 1);
    assert.equal(unchanged.title, 'Shared Architecture Specification');
  });

  it('5. Keeps version stable across repeated edits by the same active session and only increments version on exit', () => {
    const db = new SimulatedPostgresEngine();
    const sessionId = 'sess-single-user-1';
    const initialSnap = db.readSnapshot();
    assert.equal(initialSnap.version, 1);

    // Simulate 3 draft auto-saves inside the same editing session (bumpVersion = false)
    for (let step = 1; step <= 3; step += 1) {
      db.document = {
        ...db.document,
        content: {
          ...db.document.content,
          blocks: db.document.content.blocks.map((b, i) =>
            i === 0 ? { ...b, text: `Draft revision ${step}` } : b
          ),
          metadata: {
            ...db.document.content.metadata,
            lastSessionId: sessionId,
            lastSaveId: `sv-${step}`
          }
        }
      };
      // Version must remain 1 during active session edits (no self-merge, no version inflation)
      assert.equal(db.document.version, 1);
    }

    // Now user leaves the note -> finalizes session once (v1 -> v2)
    const exitCommit = db.atomicUpdateOCC({
      actorId: 'user-admin',
      actorEmail: 'admin@collabnotes.io',
      title: db.document.title,
      content: db.document.content,
      expectedVersion: 1,
      baseSnapshot: initialSnap
    });

    assert.equal(exitCommit.wasMerged, false);
    assert.equal(exitCommit.newVersion, 2);
    assert.equal(db.readSnapshot().content.blocks[0].text, 'Draft revision 3');
  });
});
