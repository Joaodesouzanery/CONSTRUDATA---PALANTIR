-- 0046_rdo_sabesp_parser_assets.sql
-- Persistent RDO Sabesp assets and parser audit.

ALTER TABLE public.rdo_sabesp
  ADD COLUMN IF NOT EXISTS planilha_foto_uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS planilha_foto_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS parser_status text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS parser_provider text,
  ADD COLUMN IF NOT EXISTS parser_model text,
  ADD COLUMN IF NOT EXISTS parser_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS parser_error text,
  ADD COLUMN IF NOT EXISTS parser_ran_at timestamptz,
  ADD CONSTRAINT rdo_sabesp_parser_status_check
    CHECK (parser_status IN ('not_requested', 'pending', 'success', 'failed', 'manual_fallback'));

CREATE TABLE IF NOT EXISTS public.rdo_sabesp_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rdo_sabesp_id uuid REFERENCES public.rdo_sabesp(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  asset_kind text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'rdo-sabesp-photos',
  storage_path text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT rdo_sabesp_assets_kind_check CHECK (
    asset_kind IN (
      'source_sheet',
      'attachment',
      'signature_contractor',
      'signature_consortium',
      'pdf',
      'other'
    )
  )
);

CREATE TABLE IF NOT EXISTS public.rdo_sabesp_parser_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rdo_sabesp_id uuid REFERENCES public.rdo_sabesp(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.rdo_sabesp_assets(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  mode text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  input_storage_path text,
  input_mime_type text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT rdo_sabesp_parser_runs_mode_check CHECK (mode IN ('image', 'text')),
  CONSTRAINT rdo_sabesp_parser_runs_status_check CHECK (status IN ('pending', 'success', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_rdo_sabesp_assets_org_rdo
  ON public.rdo_sabesp_assets(organization_id, rdo_sabesp_id, asset_kind)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rdo_sabesp_assets_org_user
  ON public.rdo_sabesp_assets(organization_id, uploaded_by, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_rdo_sabesp_assets_storage_active
  ON public.rdo_sabesp_assets(organization_id, storage_bucket, storage_path)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rdo_sabesp_parser_runs_org_created
  ON public.rdo_sabesp_parser_runs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rdo_sabesp_parser_runs_org_rdo
  ON public.rdo_sabesp_parser_runs(organization_id, rdo_sabesp_id, created_at DESC);

ALTER TABLE public.rdo_sabesp_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_sabesp_parser_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_sabesp_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_sabesp_parser_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rdo_sabesp_assets_select_own_org ON public.rdo_sabesp_assets;
CREATE POLICY rdo_sabesp_assets_select_own_org ON public.rdo_sabesp_assets
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS rdo_sabesp_assets_insert_own_org ON public.rdo_sabesp_assets;
CREATE POLICY rdo_sabesp_assets_insert_own_org ON public.rdo_sabesp_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS rdo_sabesp_assets_update_own_org ON public.rdo_sabesp_assets;
CREATE POLICY rdo_sabesp_assets_update_own_org ON public.rdo_sabesp_assets
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS rdo_sabesp_assets_delete_blocked ON public.rdo_sabesp_assets;
CREATE POLICY rdo_sabesp_assets_delete_blocked ON public.rdo_sabesp_assets
  FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS rdo_sabesp_parser_runs_select_own_org ON public.rdo_sabesp_parser_runs;
CREATE POLICY rdo_sabesp_parser_runs_select_own_org ON public.rdo_sabesp_parser_runs
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org());

DROP POLICY IF EXISTS rdo_sabesp_parser_runs_insert_own_org ON public.rdo_sabesp_parser_runs;
CREATE POLICY rdo_sabesp_parser_runs_insert_own_org ON public.rdo_sabesp_parser_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS rdo_sabesp_parser_runs_update_own_org ON public.rdo_sabesp_parser_runs;
CREATE POLICY rdo_sabesp_parser_runs_update_own_org ON public.rdo_sabesp_parser_runs
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org())
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS rdo_sabesp_parser_runs_delete_blocked ON public.rdo_sabesp_parser_runs;
CREATE POLICY rdo_sabesp_parser_runs_delete_blocked ON public.rdo_sabesp_parser_runs
  FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS rdo_sabesp_photos_update_own_org ON storage.objects;
CREATE POLICY rdo_sabesp_photos_update_own_org ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'rdo-sabesp-photos'
    AND split_part(name, '/', 1)::uuid = public.user_org()
  )
  WITH CHECK (
    bucket_id = 'rdo-sabesp-photos'
    AND split_part(name, '/', 1)::uuid = public.user_org()
  );

CREATE OR REPLACE FUNCTION public.touch_rdo_sabesp_parser_result(
  p_rdo_sabesp_id uuid,
  p_status text,
  p_provider text,
  p_model text,
  p_result jsonb DEFAULT '{}'::jsonb,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rdo_sabesp
     SET parser_status = p_status,
         parser_provider = p_provider,
         parser_model = p_model,
         parser_result = COALESCE(p_result, '{}'::jsonb),
         parser_error = p_error,
         parser_ran_at = now()
   WHERE id = p_rdo_sabesp_id
     AND organization_id = public.user_org();
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_rdo_sabesp_parser_result(uuid, text, text, text, jsonb, text)
  TO authenticated;

COMMENT ON TABLE public.rdo_sabesp_assets IS
  'Private RDO Sabesp files saved by organization and profile/user: source sheet photos, attachments, signatures and generated PDFs.';

COMMENT ON TABLE public.rdo_sabesp_parser_runs IS
  'Auditable OCR/AI parser attempts for RDO Sabesp. No API keys are stored here.';
