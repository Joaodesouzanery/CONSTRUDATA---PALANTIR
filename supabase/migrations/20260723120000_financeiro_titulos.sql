-- 20260723120000_financeiro_titulos.sql
-- Financeiro — Pagamentos e Cobranças: tabela tenant-synced (payload jsonb +
-- soft delete) para contas a pagar / a receber (títulos). Mesmo padrão de
-- financeiro_contratos (20260612120000_financeiro_manejo.sql) e RLS de 0033.
-- Exclusão é SOFT delete via UPDATE de deleted_at (sem approval RPC).

CREATE TABLE IF NOT EXISTS public.financeiro_titulos (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fin_titulos_org         ON public.financeiro_titulos(organization_id);
CREATE INDEX IF NOT EXISTS idx_fin_titulos_org_created ON public.financeiro_titulos(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_titulos_org_active  ON public.financeiro_titulos(organization_id) WHERE deleted_at IS NULL;

ALTER TABLE public.financeiro_titulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_titulos FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fin_titulos_select_own_org ON public.financeiro_titulos;
CREATE POLICY fin_titulos_select_own_org ON public.financeiro_titulos FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS fin_titulos_insert_with_role ON public.financeiro_titulos;
CREATE POLICY fin_titulos_insert_with_role ON public.financeiro_titulos FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));

DROP POLICY IF EXISTS fin_titulos_update_role ON public.financeiro_titulos;
CREATE POLICY fin_titulos_update_role ON public.financeiro_titulos FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS fin_titulos_delete_blocked ON public.financeiro_titulos;
CREATE POLICY fin_titulos_delete_blocked ON public.financeiro_titulos FOR DELETE TO authenticated USING (false);
