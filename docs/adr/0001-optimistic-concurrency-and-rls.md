# ADR 0001: Optimistic Concurrency Control (CAS) & PostgreSQL Row Level Security

- **Status:** Accepted
- **Date:** 2026-11-20
- **Context:** Multi-user real-time collaborative document editing over WebSockets & PostgREST

## 1. Problem Statement

When two or more collaborators edit a structured document simultaneously, naive `UPDATE documents SET content = $1 WHERE id = $2` statements suffer from the classic **Lost Update** anomaly: whichever client flushes its debounced HTTP/RPC request second silently overwrites the intermediate blocks committed by the first writer.

At the same time, relying on client-side UI conditionals (`if (role === 'viewer') disableInput()`) is insufficient for perimeter security when clients interact directly with PostgREST or WebSocket channels.

## 2. Evaluated Concurrency Alternatives

| Strategy | Pros | Trade-offs | Decision |
| :--- | :--- | :--- | :--- |
| **Pessimistic Locking (`SELECT ... FOR UPDATE`)** | Simple mental model | Terrible UX over WAN/WebSockets; idle tabs lock paragraphs indefinitely | Rejected |
| **Full Byte-Stream CRDTs (Yjs / Automerge)** | Character-level offline convergence | Binary state-vector bloat in PostgreSQL; opaque blobs break SQL/JSONB indexing | Deferred to optional v2 adapter |
| **Optimistic Concurrency Control (`version` CAS) + Deterministic 3-Way JSONB Block Merge** | Zero locks, human-readable `JSONB` indexed via `GIN`, deterministic retry on mismatch | Requires block-ID lineage (`base`, `local`, `remote`) | **Selected** |

## 3. Implementation Architecture

1. **Monotonic Version Guard (`public.update_document_occ`):**
   Every write supplies `p_expected_version`. PostgreSQL executes an atomic Compare-And-Swap (`WHERE id = p_document_id AND version = p_expected_version`). If `FOUND` is false, the RPC returns the authoritative `current_version` and `current_content` without mutating disk state.
2. **Deterministic 3-Way Block Merge (`ConcurrencyService`):**
   On mismatch, the client compares `base` (the version originally hydrated), `local` (unsaved edits), and `remote` (latest committed row), preserving non-overlapping block edits, concurrent block insertions, and intra-block text additions before retrying `CAS` against `current_version`.
3. **Engine-Level Row Level Security (`SQLSTATE 42501`):**
   All `SELECT`, `INSERT`, `UPDATE`, and `DELETE` paths on `public.documents` and `public.document_collaborators` are gated by RLS policies (`documents_update_owner_or_editor`), ensuring `viewer` sessions can subscribe to live broadcast frames without ever mutating persistent rows.
