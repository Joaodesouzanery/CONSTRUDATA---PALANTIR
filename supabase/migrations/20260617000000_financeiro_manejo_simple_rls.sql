-- 20260617000000_financeiro_manejo_simple_rls.sql
-- Versão compatível: sem FK para organizations, sem funções customizadas.
-- Aplique este arquivo no SQL Editor do Supabase (em vez do 20260612120000).

-- ════════════════════════════════════════════════════════════════════════
-- Tabelas
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.financeiro_contratos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
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
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
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
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
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
-- RLS simplificado: usuário autenticado acessa/edita os próprios registros
-- (organização é controlada pelo app via organization_id)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.financeiro_contratos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fin_contratos_auth ON public.financeiro_contratos;
CREATE POLICY fin_contratos_auth ON public.financeiro_contratos
  TO authenticated USING (true) WITH CHECK (created_by = auth.uid());

ALTER TABLE public.financeiro_orcamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fin_orcamentos_auth ON public.financeiro_orcamentos;
CREATE POLICY fin_orcamentos_auth ON public.financeiro_orcamentos
  TO authenticated USING (true) WITH CHECK (created_by = auth.uid());

ALTER TABLE public.financeiro_impostos_nf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fin_impostos_auth ON public.financeiro_impostos_nf;
CREATE POLICY fin_impostos_auth ON public.financeiro_impostos_nf
  TO authenticated USING (true) WITH CHECK (created_by = auth.uid());
