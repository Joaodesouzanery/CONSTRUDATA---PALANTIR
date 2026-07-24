-- 20260724120000_rateio_consumo.sql
-- Predial — Rateio de Consumo: tabela tenant-synced (payload jsonb + soft delete) para
-- rateio de faturas de água/energia entre unidades/obras. Mesmo padrão de
-- financeiro_titulos (20260723120000) e RLS de 0033. Exclusão é SOFT via UPDATE deleted_at.

CREATE TABLE IF NOT EXISTS public.rateio_consumo (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_rateio_org         ON public.rateio_consumo(organization_id);
CREATE INDEX IF NOT EXISTS idx_rateio_org_created ON public.rateio_consumo(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rateio_org_active  ON public.rateio_consumo(organization_id) WHERE deleted_at IS NULL;

ALTER TABLE public.rateio_consumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rateio_consumo FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rateio_select_own_org ON public.rateio_consumo;
CREATE POLICY rateio_select_own_org ON public.rateio_consumo FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS rateio_insert_with_role ON public.rateio_consumo;
CREATE POLICY rateio_insert_with_role ON public.rateio_consumo FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));

DROP POLICY IF EXISTS rateio_update_role ON public.rateio_consumo;
CREATE POLICY rateio_update_role ON public.rateio_consumo FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS rateio_delete_blocked ON public.rateio_consumo;
CREATE POLICY rateio_delete_blocked ON public.rateio_consumo FOR DELETE TO authenticated USING (false);
