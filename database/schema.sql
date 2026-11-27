-- =============================================================================
-- COLLABNOTES REALTIME — SUPABASE POSTGRESQL 15+ SCHEMA, RLS & REALTIME ENGINE
-- =============================================================================
-- Architecture: Hybrid Relational (ACID) + JSONB Document Store with OCC
-- Security: Row Level Security (RLS), Role ENUMs, Auth Triggers (Module 0488)
-- Concurrency: Optimistic Concurrency Control via atomic version increments
-- =============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. CUSTOM ENUM TYPES
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');
    END IF;
END$$;

-- -----------------------------------------------------------------------------
-- 2. PROFILES TABLE & AUTH.USERS AUTOMATION TRIGGER
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role public.app_role NOT NULL DEFAULT 'editor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Application user profiles linked 1:1 with GoTrue auth.users.';
COMMENT ON COLUMN public.profiles.role IS 'Global platform role assigned via public.app_role ENUM.';

-- Trigger function to automatically populate public.profiles on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role public.app_role := 'editor';
    v_full_name TEXT;
    v_email TEXT;
    v_avatar TEXT;
BEGIN
    v_email := LOWER(TRIM(COALESCE(NEW.email, NEW.id::text || '@user.local')));

    v_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(split_part(v_email, '@', 1), ''),
        'Usuario'
    );

    v_avatar := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), ''),
        'https://api.dicebear.com/7.x/initials/svg?seed=' || encode(convert_to(v_full_name, 'UTF8'), 'hex')
    );

    -- Remove stale orphaned profile with the same email if auth.users was recreated
    DELETE FROM public.profiles
    WHERE LOWER(email) = v_email AND id <> NEW.id;

    INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
    VALUES (
        NEW.id,
        v_email,
        v_full_name,
        v_avatar,
        v_role
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW();

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Never block GoTrue user creation with an unhandled 500 trigger error
    RAISE WARNING 'handle_new_user fallback for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 3. DOCUMENTS TABLE (HYBRID RELATIONAL + JSONB + OCC VERSIONING)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'Untitled Document' CHECK (char_length(title) <= 255),
    content JSONB NOT NULL DEFAULT '{"blocks": []}'::jsonb
        CHECK (jsonb_typeof(content) = 'object' AND (content ? 'blocks')),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.documents IS 'Collaborative documents storing structured blocks in JSONB and integer version for Optimistic Concurrency Control.';
COMMENT ON COLUMN public.documents.content IS 'Flexible JSONB payload containing structured blocks: {"blocks": [{"id", "type", "text", "checked", "updatedBy", "updatedAt"}], "metadata": {...}}.';
COMMENT ON COLUMN public.documents.version IS 'Monotonically increasing OCC version counter to prevent Lost Updates.';

-- -----------------------------------------------------------------------------
-- 4. DOCUMENT COLLABORATORS TABLE (COMPOSITE PK & CASCADE DELETE)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_collaborators (
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    permission public.app_role NOT NULL DEFAULT 'viewer'
        CHECK (permission IN ('editor', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (document_id, user_id)
);

COMMENT ON TABLE public.document_collaborators IS 'Access control matrix linking documents to collaborators with granular editor/viewer permissions.';

-- -----------------------------------------------------------------------------
-- 5. AUTOMATIC TIMESTAMP MAINTENANCE TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_documents_updated_at ON public.documents;
CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

-- -----------------------------------------------------------------------------
-- 6. QUERY-ORIENTED COMPOSITE & GIN INDEXES
-- -----------------------------------------------------------------------------
-- Pattern 1: Dashboard listing of a user's owned documents sorted by most recent modification
CREATE INDEX IF NOT EXISTS idx_documents_owner_updated
    ON public.documents (owner_id, updated_at DESC);

-- Pattern 2: Resolving all documents shared with a specific collaborator user_id
CREATE INDEX IF NOT EXISTS idx_collaborators_user_doc
    ON public.document_collaborators (user_id, document_id);

-- Pattern 3: Fast permission lookup during RLS evaluation (document_id + user_id + permission)
CREATE INDEX IF NOT EXISTS idx_collaborators_doc_user_perm
    ON public.document_collaborators (document_id, user_id, permission);

-- Pattern 4: GIN index with jsonb_path_ops for high-speed containment queries inside JSONB blocks
CREATE INDEX IF NOT EXISTS idx_documents_content_gin
    ON public.documents USING GIN (content jsonb_path_ops);

-- Pattern 5: Case-insensitive email lookup for inviting collaborators by email address
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower
    ON public.profiles (LOWER(email));

-- -----------------------------------------------------------------------------
-- 7. SECURITY DEFINER HELPER FUNCTIONS FOR NON-RECURSIVE RLS EVALUATION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = p_user_id AND role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_read_document(p_document_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.documents d
        WHERE d.id = p_document_id
          AND (
              d.owner_id = p_user_id
              OR public.is_platform_admin(p_user_id)
              OR EXISTS (
                  SELECT 1
                  FROM public.document_collaborators dc
                  WHERE dc.document_id = d.id
                    AND dc.user_id = p_user_id
              )
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_document(p_document_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.documents d
        WHERE d.id = p_document_id
          AND (
              d.owner_id = p_user_id
              OR public.is_platform_admin(p_user_id)
              OR EXISTS (
                  SELECT 1
                  FROM public.document_collaborators dc
                  WHERE dc.document_id = d.id
                    AND dc.user_id = p_user_id
                    AND dc.permission = 'editor'
              )
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_document_owner(p_document_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.documents d
        WHERE d.id = p_document_id
          AND (d.owner_id = p_user_id OR public.is_platform_admin(p_user_id))
    );
$$;

-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_collaborators ENABLE ROW LEVEL SECURITY;

-- ---- 8.1 PROFILES POLICIES ----
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_admin"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id OR public.is_platform_admin(auth.uid()))
    WITH CHECK (auth.uid() = id OR public.is_platform_admin(auth.uid()));

-- ---- 8.2 DOCUMENTS POLICIES ----
DROP POLICY IF EXISTS "documents_select_owner_or_collaborator" ON public.documents;
CREATE POLICY "documents_select_owner_or_collaborator"
    ON public.documents
    FOR SELECT
    TO authenticated
    USING (
        owner_id = auth.uid()
        OR public.is_platform_admin(auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.document_collaborators dc
            WHERE dc.document_id = public.documents.id
              AND dc.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "documents_insert_owner" ON public.documents;
CREATE POLICY "documents_insert_owner"
    ON public.documents
    FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "documents_update_owner_or_editor" ON public.documents;
CREATE POLICY "documents_update_owner_or_editor"
    ON public.documents
    FOR UPDATE
    TO authenticated
    USING (public.can_edit_document(id, auth.uid()))
    WITH CHECK (public.can_edit_document(id, auth.uid()));

DROP POLICY IF EXISTS "documents_delete_owner_only" ON public.documents;
CREATE POLICY "documents_delete_owner_only"
    ON public.documents
    FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid() OR public.is_platform_admin(auth.uid()));

-- ---- 8.3 DOCUMENT COLLABORATORS POLICIES ----
DROP POLICY IF EXISTS "collaborators_select_document_members" ON public.document_collaborators;
CREATE POLICY "collaborators_select_document_members"
    ON public.document_collaborators
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.can_read_document(document_id, auth.uid())
    );

DROP POLICY IF EXISTS "collaborators_insert_owner_only" ON public.document_collaborators;
CREATE POLICY "collaborators_insert_owner_only"
    ON public.document_collaborators
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_document_owner(document_id, auth.uid())
        AND user_id <> auth.uid()
    );

DROP POLICY IF EXISTS "collaborators_update_owner_only" ON public.document_collaborators;
CREATE POLICY "collaborators_update_owner_only"
    ON public.document_collaborators
    FOR UPDATE
    TO authenticated
    USING (public.is_document_owner(document_id, auth.uid()))
    WITH CHECK (public.is_document_owner(document_id, auth.uid()));

DROP POLICY IF EXISTS "collaborators_delete_owner_or_self" ON public.document_collaborators;
CREATE POLICY "collaborators_delete_owner_or_self"
    ON public.document_collaborators
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_document_owner(document_id, auth.uid())
    );

-- -----------------------------------------------------------------------------
-- 9. OPTIMISTIC CONCURRENCY CONTROL (OCC) ATOMIC RPC FUNCTION
-- -----------------------------------------------------------------------------
-- Performs an atomic Compare-And-Swap (CAS) update on public.documents:
-- Only increments version = version + 1 if current database version == p_expected_version.
CREATE OR REPLACE FUNCTION public.update_document_occ(
    p_document_id UUID,
    p_title TEXT,
    p_content JSONB,
    p_expected_version INTEGER,
    p_bump_version BOOLEAN DEFAULT true
)
RETURNS TABLE (
    success BOOLEAN,
    current_version INTEGER,
    current_title TEXT,
    current_content JSONB,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_updated_row public.documents%ROWTYPE;
    v_existing_row public.documents%ROWTYPE;
BEGIN
    IF NOT public.can_edit_document(p_document_id, auth.uid()) THEN
        RAISE EXCEPTION 'Insufficient permissions to edit document %', p_document_id
            USING ERRCODE = '42501';
    END IF;

    UPDATE public.documents d
    SET
        title = p_title,
        content = p_content,
        version = CASE WHEN p_bump_version THEN d.version + 1 ELSE d.version END,
        updated_at = NOW()
    WHERE d.id = p_document_id
      AND d.version = p_expected_version
    RETURNING * INTO v_updated_row;

    IF FOUND THEN
        RETURN QUERY SELECT
            true,
            v_updated_row.version,
            v_updated_row.title,
            v_updated_row.content,
            v_updated_row.updated_at;
    ELSE
        SELECT * INTO v_existing_row
        FROM public.documents d
        WHERE d.id = p_document_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Document % not found', p_document_id
                USING ERRCODE = 'P0002';
        END IF;

        RETURN QUERY SELECT
            false,
            v_existing_row.version,
            v_existing_row.title,
            v_existing_row.content,
            v_existing_row.updated_at;
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. SUPABASE REALTIME ENGINE CONFIGURATION (ELIXIR / PHOENIX WEBSOCKETS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.documents REPLICA IDENTITY FULL;
ALTER TABLE public.document_collaborators REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.document_collaborators;
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END$$;


-- -----------------------------------------------------------------------------
-- 11. PRIVILEGE-ESCALATION GUARD (only platform admins may change profiles.role)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role AND auth.uid() IS NOT NULL
       AND NOT public.is_platform_admin(auth.uid()) THEN
        NEW.role := OLD.role;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_profiles_prevent_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();
