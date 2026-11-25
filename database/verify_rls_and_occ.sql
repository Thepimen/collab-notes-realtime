-- =============================================================================
-- Automated SQL Verification Script for RLS Policies & Atomic OCC RPC
-- Run inside psql or Supabase SQL Editor after schema.sql + seed.sql
-- =============================================================================

BEGIN;

-- 1. Verify GIN & Composite Indexes exist on public.documents
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('documents', 'document_collaborators')
ORDER BY indexname;

-- 2. Simulate Authenticated Editor Session (Elena Rostova) -> Expect CAS Success
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-4222-8222-222222222222';

SELECT *
FROM public.update_document_occ(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
  'System Architecture RFC: Real-Time OCC & Hybrid JSONB',
  '{"blocks":[{"id":"blk-101","type":"heading-1","text":"Verified CAS v5","updatedBy":"elena.editor@collabnotes.io","updatedAt":"2026-11-22T20:30:00Z"}]}'::jsonb,
  4
);

-- 3. Simulate Stale Version Write (expected_version = 4 when DB is now 5) -> Expect success = false
SELECT *
FROM public.update_document_occ(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
  'Stale Write Probe',
  '{"blocks":[]}'::jsonb,
  4
);

ROLLBACK;
