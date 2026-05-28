-- 0024_quantitativos.sql
-- Sprint 4 — Quantitativos e Orçamento.
-- Tabelas: quantitativos_budgets (1 row por OrcamentoBudget, items[] em payload),
-- quantitativos_custom_base (entradas customizadas reutilizáveis cross-budget).

CREATE TABLE IF NOT EXISTS public.quantitativos_budgets (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  name            text NOT NULL,
  cost_base       text,            -- 'sinapi' | 'seinfra' | 'manual' | 'custom'
  bdi_global      numeric(5,2),
  total_brl       numeric(14,2),
  reference_date  text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- items[], description
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_quantitativos_budgets_org          ON public.quantitativos_budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_quantitativos_budgets_org_created  ON public.quantitativos_budgets(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quantitativos_budgets_org_active   ON public.quantitativos_budgets(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quantitativos_budgets_project      ON public.quantitativos_budgets(project_id);

CREATE TABLE IF NOT EXISTS public.quantitativos_custom_base (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code            text NOT NULL,
  description     text,
  unit            text,
  unit_cost       numeric(12,2),
  category        text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT quantitativos_custom_base_unique_code UNIQUE (organization_id, code)
);
CREATE INDEX IF NOT EXISTS idx_quantitativos_custom_base_org          ON public.quantitativos_custom_base(organization_id);
CREATE INDEX IF NOT EXISTS idx_quantitativos_custom_base_org_created  ON public.quantitativos_custom_base(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quantitativos_custom_base_org_active   ON public.quantitativos_custom_base(organization_id) WHERE deleted_at IS NULL;
