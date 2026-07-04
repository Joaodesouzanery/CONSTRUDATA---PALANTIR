-- 20260704120000_clt_settings.sql
-- Configurações CLT / produtividade por organização (inclui a meta TCPO de RUP).
-- 1 linha por organização (id = organization_id), payload jsonb com o objeto CLTSettings.
-- Multi-tenant por organization_id. Upsert idempotente (onConflict id) pelo engine de sync.
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (testar em homologação antes de produção).

CREATE TABLE IF NOT EXISTS public.clt_settings (
  id               uuid        PRIMARY KEY,   -- = organization_id (1 linha por org)
  organization_id  uuid        NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  payload          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_by       uuid        NOT NULL REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_clt_settings_org
  ON public.clt_settings(organization_id) WHERE deleted_at IS NULL;

-- updated_at automático (função já existente no schema)
DROP TRIGGER IF EXISTS trg_clt_settings_updated_at ON public.clt_settings;
CREATE TRIGGER trg_clt_settings_updated_at
  BEFORE UPDATE ON public.clt_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──
ALTER TABLE public.clt_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clt_settings FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clt_settings_select_own_org ON public.clt_settings;
CREATE POLICY clt_settings_select_own_org ON public.clt_settings
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.user_org()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS clt_settings_insert_own_org ON public.clt_settings;
CREATE POLICY clt_settings_insert_own_org ON public.clt_settings
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.user_org()) AND created_by = auth.uid());

DROP POLICY IF EXISTS clt_settings_update_own_org ON public.clt_settings;
CREATE POLICY clt_settings_update_own_org ON public.clt_settings
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT public.user_org()))
  WITH CHECK (organization_id = (SELECT public.user_org()));

DROP POLICY IF EXISTS clt_settings_delete_blocked ON public.clt_settings;
CREATE POLICY clt_settings_delete_blocked ON public.clt_settings
  FOR DELETE TO authenticated USING (false);
