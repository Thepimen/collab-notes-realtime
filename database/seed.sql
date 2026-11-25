-- =============================================================================
-- COLLABNOTES REALTIME — REPRODUCIBLE SEED DATA (AUTH.USERS, PROFILES, DOCS)
-- =============================================================================
-- Test Users (Password for all accounts: CollabNotes2026!):
--   1. Admin  : admin@collabnotes.io        (UUID: 11111111-1111-4111-8111-111111111111)
--   2. Editor : elena.editor@collabnotes.io (UUID: 22222222-2222-4222-8222-222222222222)
--   3. Viewer : marco.viewer@collabnotes.io (UUID: 33333333-3333-4333-8333-333333333333)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. SEED AUTH.USERS (TRIGGERS on_auth_user_created -> public.handle_new_user)
-- -----------------------------------------------------------------------------
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
)
VALUES
    (
        '00000000-0000-0000-0000-000000000000',
        '11111111-1111-4111-8111-111111111111',
        'authenticated',
        'authenticated',
        'admin@collabnotes.io',
        crypt('CollabNotes2026!', gen_salt('bf')),
        NOW(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Luis Lázaro (Architect Admin)", "role": "admin", "avatar_url": "https://api.dicebear.com/7.x/initials/svg?seed=LL"}'::jsonb,
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        '22222222-2222-4222-8222-222222222222',
        'authenticated',
        'authenticated',
        'elena.editor@collabnotes.io',
        crypt('CollabNotes2026!', gen_salt('bf')),
        NOW(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Elena Rostova (Lead Editor)", "role": "editor", "avatar_url": "https://api.dicebear.com/7.x/initials/svg?seed=ER"}'::jsonb,
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        '33333333-3333-4333-8333-333333333333',
        'authenticated',
        'authenticated',
        'marco.viewer@collabnotes.io',
        crypt('CollabNotes2026!', gen_salt('bf')),
        NOW(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Marco Silva (QA Auditor)", "role": "viewer", "avatar_url": "https://api.dicebear.com/7.x/initials/svg?seed=MS"}'::jsonb,
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    )
ON CONFLICT (id) DO NOTHING;

-- Ensure public.profiles rows exist even if trigger was created after existing users
INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
VALUES
    (
        '11111111-1111-4111-8111-111111111111',
        'admin@collabnotes.io',
        'Luis Lázaro (Architect Admin)',
        'https://api.dicebear.com/7.x/initials/svg?seed=LL',
        'admin'
    ),
    (
        '22222222-2222-4222-8222-222222222222',
        'elena.editor@collabnotes.io',
        'Elena Rostova (Lead Editor)',
        'https://api.dicebear.com/7.x/initials/svg?seed=ER',
        'editor'
    ),
    (
        '33333333-3333-4333-8333-333333333333',
        'marco.viewer@collabnotes.io',
        'Marco Silva (QA Auditor)',
        'https://api.dicebear.com/7.x/initials/svg?seed=MS',
        'viewer'
    )
ON CONFLICT (id) DO UPDATE
SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

-- -----------------------------------------------------------------------------
-- 2. SEED DOCUMENTS WITH STRUCTURED JSONB BLOCKS & VERSIONING
-- -----------------------------------------------------------------------------
INSERT INTO public.documents (id, title, content, owner_id, version, created_at, updated_at)
VALUES
    (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        'System Architecture RFC: Real-Time OCC & Hybrid JSONB',
        '{
            "blocks": [
                {
                    "id": "blk-101",
                    "type": "heading-1",
                    "text": "Distributed Real-Time Collaborative Engine",
                    "updatedBy": "admin@collabnotes.io",
                    "updatedAt": "2026-11-22T18:00:00.000Z"
                },
                {
                    "id": "blk-102",
                    "type": "paragraph",
                    "text": "This document defines the hybrid relational + JSONB persistence strategy combined with Optimistic Concurrency Control (OCC) over Supabase Realtime WebSockets (Elixir/Phoenix).",
                    "updatedBy": "admin@collabnotes.io",
                    "updatedAt": "2026-11-22T18:05:00.000Z"
                },
                {
                    "id": "blk-103",
                    "type": "heading-2",
                    "text": "Key Engineering Guarantees",
                    "updatedBy": "elena.editor@collabnotes.io",
                    "updatedAt": "2026-11-22T18:10:00.000Z"
                },
                {
                    "id": "blk-104",
                    "type": "checklist",
                    "text": "Row Level Security (RLS) enforced at PostgreSQL engine level for owners, editors, and viewers.",
                    "checked": true,
                    "updatedBy": "admin@collabnotes.io",
                    "updatedAt": "2026-11-22T18:12:00.000Z"
                },
                {
                    "id": "blk-105",
                    "type": "checklist",
                    "text": "Compare-And-Swap (CAS) version checking on every debounced UPDATE to prevent Lost Updates.",
                    "checked": true,
                    "updatedBy": "elena.editor@collabnotes.io",
                    "updatedAt": "2026-11-22T18:15:00.000Z"
                },
                {
                    "id": "blk-106",
                    "type": "code",
                    "text": "UPDATE public.documents SET content = $1, version = version + 1 WHERE id = $2 AND version = $3;",
                    "updatedBy": "admin@collabnotes.io",
                    "updatedAt": "2026-11-22T18:20:00.000Z"
                }
            ],
            "metadata": {
                "tags": ["Architecture", "PostgreSQL", "WebSockets", "OCC"],
                "lastEditedBy": "elena.editor@collabnotes.io"
            }
        }'::jsonb,
        '11111111-1111-4111-8111-111111111111',
        4,
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '15 minutes'
    ),
    (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
        'Q4 Security Audit & RLS Verification Playbook',
        '{
            "blocks": [
                {
                    "id": "blk-201",
                    "type": "heading-1",
                    "text": "PostgreSQL 15+ Security & Access Control Audit",
                    "updatedBy": "admin@collabnotes.io",
                    "updatedAt": "2026-11-22T16:00:00.000Z"
                },
                {
                    "id": "blk-202",
                    "type": "quote",
                    "text": "Never delegate data authorization exclusively to the frontend UI; enforce perimeter policies via PostgreSQL Row Level Security.",
                    "updatedBy": "admin@collabnotes.io",
                    "updatedAt": "2026-11-22T16:10:00.000Z"
                },
                {
                    "id": "blk-203",
                    "type": "paragraph",
                    "text": "Collaborators with the viewer role can observe real-time presence and live block updates via room:doc_{id}, but any direct mutation attempt is rejected both by the UI and by the documents_update_owner_or_editor RLS policy.",
                    "updatedBy": "marco.viewer@collabnotes.io",
                    "updatedAt": "2026-11-22T16:30:00.000Z"
                }
            ],
            "metadata": {
                "tags": ["Security", "RLS", "Audit"],
                "lastEditedBy": "admin@collabnotes.io"
            }
        }'::jsonb,
        '11111111-1111-4111-8111-111111111111',
        2,
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 hours'
    ),
    (
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
        'Product Design Sprint: Accessible UI & Mobile-First Tokens',
        '{
            "blocks": [
                {
                    "id": "blk-301",
                    "type": "heading-1",
                    "text": "UI/UX Guidelines & WCAG 2.1 AA Compliance",
                    "updatedBy": "elena.editor@collabnotes.io",
                    "updatedAt": "2026-11-22T19:00:00.000Z"
                },
                {
                    "id": "blk-302",
                    "type": "paragraph",
                    "text": "All interactive regions expose semantic ARIA roles, aria-labelledby bindings, live toast announcements, skeleton loaders, and pending changes navigation guards.",
                    "updatedBy": "elena.editor@collabnotes.io",
                    "updatedAt": "2026-11-22T19:15:00.000Z"
                },
                {
                    "id": "blk-303",
                    "type": "checklist",
                    "text": "Preserve returnUrl query parameter when redirecting unauthenticated sessions.",
                    "checked": true,
                    "updatedBy": "elena.editor@collabnotes.io",
                    "updatedAt": "2026-11-22T19:20:00.000Z"
                }
            ],
            "metadata": {
                "tags": ["UI/UX", "Accessibility", "TailwindCSS"],
                "lastEditedBy": "elena.editor@collabnotes.io"
            }
        }'::jsonb,
        '22222222-2222-4222-8222-222222222222',
        3,
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '45 minutes'
    )
ON CONFLICT (id) DO UPDATE
SET
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    version = EXCLUDED.version,
    updated_at = NOW();

-- -----------------------------------------------------------------------------
-- 3. SEED DOCUMENT COLLABORATORS (COMPOSITE PERMISSIONS)
-- -----------------------------------------------------------------------------
INSERT INTO public.document_collaborators (document_id, user_id, permission)
VALUES
    -- Document 1 owned by Admin: Elena is 'editor', Marco is 'viewer'
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '22222222-2222-4222-8222-222222222222', 'editor'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '33333333-3333-4333-8333-333333333333', 'viewer'),
    -- Document 2 owned by Admin: Marco is 'viewer'
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '33333333-3333-4333-8333-333333333333', 'viewer'),
    -- Document 3 owned by Elena: Admin is 'editor', Marco is 'viewer'
    ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', '11111111-1111-4111-8111-111111111111', 'editor'),
    ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', '33333333-3333-4333-8333-333333333333', 'viewer')
ON CONFLICT (document_id, user_id) DO UPDATE
SET
    permission = EXCLUDED.permission;

COMMIT;
