-- 0022_projects.sql
-- Sprint 4 — Cria a entidade central `projects` e a tabela `project_documents`
-- (metadata para arquivos no Supabase Storage bucket project-documents/).

CREATE TABLE IF NOT EXISTS public.projects (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code            text NOT NULL,
  name            text NOT NULL,
  status          text NOT NULL DEFAULT 'planning',  -- planning|active|on_hold|completed|cancelled
  start_date      date,
  end_date        date,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- planningPhases[], executionPhases[], notas, budgetLines[]
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT projects_unique_code_per_org UNIQUE (organization_id, code)
);
CREATE INDEX IF NOT EXISTS idx_projects_org          ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_created  ON public.projects(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_org_active   ON public.projects(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_status       ON public.projects(status);

-- ────────────────────────────────────────────────────────────────────────
-- project_documents — metadata para PDFs/anexos
-- O conteúdo binário fica no bucket Supabase Storage `project-documents`,
-- referenciado por storage_path. URL signed gerada on-demand pelo cliente.
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_documents (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  mime_type       text,
  size_bytes      bigint,
  storage_path    text NOT NULL,   -- ex: 'project-documents/{org}/{project}/{uuid}.pdf'
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- tags, descrição
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_project_documents_org         ON public.project_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_org_created ON public.project_documents(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_documents_org_active  ON public.project_documents(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_documents_project     ON public.project_documents(project_id);
