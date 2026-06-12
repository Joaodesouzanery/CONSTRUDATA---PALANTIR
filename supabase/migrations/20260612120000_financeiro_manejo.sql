-- 20260612120000_financeiro_manejo.sql
-- Financeiro — Manejo: cria 3 tabelas tenant-synced (padrão Sprint 6,
-- payload jsonb + soft delete) para Manejo Financeiro (contratos),
-- Manejo Orçamento (autorizações) e Impostos de Notas Fiscais
-- (Plano de Contas). RLS idêntica ao padrão de 0033_sprint6_rls.sql.

-- ════════════════════════════════════════════════════════════════════════
-- Tabelas
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.financeiro_contratos (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fin_contratos_org         ON public.financeiro_contratos(organization_id);
CREATE INDEX IF NOT EXISTS idx_fin_contratos_org_created ON public.financeiro_contratos(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_contratos_org_active  ON public.financeiro_contratos(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.financeiro_orcamentos (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fin_orcamentos_org         ON public.financeiro_orcamentos(organization_id);
CREATE INDEX IF NOT EXISTS idx_fin_orcamentos_org_created ON public.financeiro_orcamentos(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_orcamentos_org_active  ON public.financeiro_orcamentos(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.financeiro_impostos_nf (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fin_impostos_org         ON public.financeiro_impostos_nf(organization_id);
CREATE INDEX IF NOT EXISTS idx_fin_impostos_org_created ON public.financeiro_impostos_nf(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_impostos_org_active  ON public.financeiro_impostos_nf(organization_id) WHERE deleted_at IS NULL;

-- ════════════════════════════════════════════════════════════════════════
-- RLS (padrão 0033: select por org, insert/update com role, delete bloqueado
-- — exclusão é soft delete via update de deleted_at)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.financeiro_contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_contratos FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fin_contratos_select_own_org ON public.financeiro_contratos;
CREATE POLICY fin_contratos_select_own_org ON public.financeiro_contratos FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS fin_contratos_insert_with_role ON public.financeiro_contratos;
CREATE POLICY fin_contratos_insert_with_role ON public.financeiro_contratos FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS fin_contratos_update_role ON public.financeiro_contratos;
CREATE POLICY fin_contratos_update_role ON public.financeiro_contratos FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS fin_contratos_delete_blocked ON public.financeiro_contratos;
CREATE POLICY fin_contratos_delete_blocked ON public.financeiro_contratos FOR DELETE TO authenticated USING (false);

ALTER TABLE public.financeiro_orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_orcamentos FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fin_orcamentos_select_own_org ON public.financeiro_orcamentos;
CREATE POLICY fin_orcamentos_select_own_org ON public.financeiro_orcamentos FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS fin_orcamentos_insert_with_role ON public.financeiro_orcamentos;
CREATE POLICY fin_orcamentos_insert_with_role ON public.financeiro_orcamentos FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS fin_orcamentos_update_role ON public.financeiro_orcamentos;
CREATE POLICY fin_orcamentos_update_role ON public.financeiro_orcamentos FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS fin_orcamentos_delete_blocked ON public.financeiro_orcamentos;
CREATE POLICY fin_orcamentos_delete_blocked ON public.financeiro_orcamentos FOR DELETE TO authenticated USING (false);

ALTER TABLE public.financeiro_impostos_nf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_impostos_nf FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fin_impostos_select_own_org ON public.financeiro_impostos_nf;
CREATE POLICY fin_impostos_select_own_org ON public.financeiro_impostos_nf FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS fin_impostos_insert_with_role ON public.financeiro_impostos_nf;
CREATE POLICY fin_impostos_insert_with_role ON public.financeiro_impostos_nf FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS fin_impostos_update_role ON public.financeiro_impostos_nf;
CREATE POLICY fin_impostos_update_role ON public.financeiro_impostos_nf FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS fin_impostos_delete_blocked ON public.financeiro_impostos_nf;
CREATE POLICY fin_impostos_delete_blocked ON public.financeiro_impostos_nf FOR DELETE TO authenticated USING (false);
