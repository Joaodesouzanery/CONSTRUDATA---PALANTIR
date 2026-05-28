-- Quick adaptation sessions for global/admin onboarding diagnostics.

CREATE TABLE IF NOT EXISTS public.quick_adaptation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  source_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  extracted_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  linked_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT quick_adaptation_sessions_status_check
    CHECK (status IN ('draft', 'reviewed', 'converted', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.quick_adaptation_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.quick_adaptation_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  storage_path text,
  extracted_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_quick_adaptation_sessions_org
  ON public.quick_adaptation_sessions(organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_quick_adaptation_files_session
  ON public.quick_adaptation_files(session_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_quick_adaptation_sessions_updated_at ON public.quick_adaptation_sessions;
CREATE TRIGGER trg_quick_adaptation_sessions_updated_at
  BEFORE UPDATE ON public.quick_adaptation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.quick_adaptation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_adaptation_files ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.quick_adaptation_sessions TO authenticated;
GRANT SELECT, INSERT ON public.quick_adaptation_files TO authenticated;

DROP POLICY IF EXISTS quick_adaptation_sessions_select ON public.quick_adaptation_sessions;
CREATE POLICY quick_adaptation_sessions_select
  ON public.quick_adaptation_sessions
  FOR SELECT
  USING (
    public.has_org_role(organization_id, ARRAY['owner','diretor']::public.user_role[])
  );

DROP POLICY IF EXISTS quick_adaptation_sessions_insert ON public.quick_adaptation_sessions;
CREATE POLICY quick_adaptation_sessions_insert
  ON public.quick_adaptation_sessions
  FOR INSERT
  WITH CHECK (
    public.has_org_role(organization_id, ARRAY['owner','diretor']::public.user_role[])
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS quick_adaptation_sessions_update ON public.quick_adaptation_sessions;
CREATE POLICY quick_adaptation_sessions_update
  ON public.quick_adaptation_sessions
  FOR UPDATE
  USING (
    public.has_org_role(organization_id, ARRAY['owner','diretor']::public.user_role[])
  )
  WITH CHECK (
    public.has_org_role(organization_id, ARRAY['owner','diretor']::public.user_role[])
  );

DROP POLICY IF EXISTS quick_adaptation_files_select ON public.quick_adaptation_files;
CREATE POLICY quick_adaptation_files_select
  ON public.quick_adaptation_files
  FOR SELECT
  USING (
    public.has_org_role(organization_id, ARRAY['owner','diretor']::public.user_role[])
  );

DROP POLICY IF EXISTS quick_adaptation_files_insert ON public.quick_adaptation_files;
CREATE POLICY quick_adaptation_files_insert
  ON public.quick_adaptation_files
  FOR INSERT
  WITH CHECK (
    public.has_org_role(organization_id, ARRAY['owner','diretor']::public.user_role[])
    AND created_by = auth.uid()
  );

COMMENT ON TABLE public.quick_adaptation_sessions IS
  'Global/admin onboarding diagnostics that map uploaded client documents to ConstruData modules and missing checklist items.';

COMMENT ON TABLE public.quick_adaptation_files IS
  'Optional per-file metadata and extracted payloads for quick adaptation diagnostics.';
