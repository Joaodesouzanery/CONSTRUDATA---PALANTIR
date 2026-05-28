-- 0025_preconstrucao.sql
-- Sprint 4 — Pré-construção: persiste apenas snapshots de AnalysisSession
-- finalizadas. Pipeline em andamento (upload/extração/normalização/matching)
-- continua 100% local-only.

CREATE TABLE IF NOT EXISTS public.preconstrucao_sessions (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  file_names      text[] DEFAULT '{}',
  total_items     integer,
  total_cost      numeric(14,2),
  status          text NOT NULL DEFAULT 'proposal',  -- proposal|completed|archived
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- snapshot completo: takeoffItems, costMatches, clauses, bdiConfig
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_preconstrucao_sessions_org          ON public.preconstrucao_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_preconstrucao_sessions_org_created  ON public.preconstrucao_sessions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_preconstrucao_sessions_org_active   ON public.preconstrucao_sessions(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_preconstrucao_sessions_project      ON public.preconstrucao_sessions(project_id);
