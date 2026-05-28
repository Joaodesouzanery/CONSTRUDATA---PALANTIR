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
-- 0023_projects_fk_retro.sql
-- Sprint 4 — Adiciona coluna `project_id` (nullable) + FK + index nas tabelas
-- Sprint 1-3 que já têm o conceito de projeto. Nullable pois dados existentes
-- ainda não estão vinculados; backfill manual conforme owner amarra projetos.

DO $$
DECLARE
  v_tables text[] := ARRAY[
    -- Sprint 2 — RDO/Planejamento/Suprimentos
    'rdo','plan_trechos','plan_teams','plan_holidays','plan_scenarios',
    'suppliers','purchase_orders','goods_receipts','invoices',
    -- Sprint 3 — Mão-de-Obra
    'workers','labor_crews','timecards','shifts','worker_absences',
    -- Sprint 3 — LPS
    'lps_activities','lps_restrictions','lps_takt_zones',
    -- Sprint 3 — Operação-Campo
    'operacao_campo_activities','operacao_campo_days',
    -- Sprint 3 — Planejamento-Mestre
    'master_activities','master_baselines','lookahead_derived_activities','programacao_diaria',
    -- Sprint 3 — Relatório 360
    'daily_report_activities','daily_report_equipment_logs','daily_report_material_logs','daily_report_photos'
  ];
  v_tbl text;
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL', v_tbl);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_project ON public.%I(project_id)', v_tbl, v_tbl);
  END LOOP;
END $$;
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
-- 0026_bim.sql
-- Sprint 4 — BIM 3D/4D/5D.
-- bim_projects: 1 row por modelo BIM importado (shapefile/DXF/levantamento).
-- bim_segments: 1 row por elemento geométrico (vertices em payload jsonb).
-- Arquivos-fonte (.shp/.dxf/.ifc) NÃO ficam no banco — vão para Supabase
-- Storage bucket `bim-uploads/` referenciados por `source_file_path`.

CREATE TABLE IF NOT EXISTS public.bim_projects (
  id                 uuid PRIMARY KEY,
  organization_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id         uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  name               text NOT NULL,
  type               text,             -- 'sanitation' | 'building' | 'generic'
  source_file_path   text,             -- caminho no bucket bim-uploads/, opcional
  payload            jsonb NOT NULL DEFAULT '{}'::jsonb,  -- layers[], shapefileSourceName, uploadedAt
  created_by         uuid NOT NULL REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_bim_projects_org          ON public.bim_projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_bim_projects_org_created  ON public.bim_projects(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bim_projects_org_active   ON public.bim_projects(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bim_projects_project      ON public.bim_projects(project_id);

CREATE TABLE IF NOT EXISTS public.bim_segments (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bim_project_id  uuid NOT NULL REFERENCES public.bim_projects(id) ON DELETE CASCADE,
  trecho_code     text,
  diameter        numeric(8,2),
  material        text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- vertices[][3], attributes, lengthM, custos, datas
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_bim_segments_org          ON public.bim_segments(organization_id);
CREATE INDEX IF NOT EXISTS idx_bim_segments_org_created  ON public.bim_segments(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bim_segments_org_active   ON public.bim_segments(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bim_segments_project      ON public.bim_segments(bim_project_id);
CREATE INDEX IF NOT EXISTS idx_bim_segments_trecho       ON public.bim_segments(trecho_code);
-- 0027_grupo_nucleo_rls.sql
-- Sprint 4 — RLS para as 7 novas tabelas do Núcleo + BIM.
-- Padrão idêntico a 0016/0020: SELECT/INSERT/UPDATE com has_role + DELETE bloqueado.

-- ════════════════════════════════════════════════════════════════════════
-- projects
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS projects_select_own_org ON public.projects;
CREATE POLICY projects_select_own_org ON public.projects FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS projects_insert_with_role ON public.projects;
CREATE POLICY projects_insert_with_role ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS projects_update_role ON public.projects;
CREATE POLICY projects_update_role ON public.projects FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS projects_delete_blocked ON public.projects;
CREATE POLICY projects_delete_blocked ON public.projects FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- project_documents
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_documents_select_own_org ON public.project_documents;
CREATE POLICY project_documents_select_own_org ON public.project_documents FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS project_documents_insert_with_role ON public.project_documents;
CREATE POLICY project_documents_insert_with_role ON public.project_documents FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','qualidade','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS project_documents_update_role ON public.project_documents;
CREATE POLICY project_documents_update_role ON public.project_documents FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','qualidade','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS project_documents_delete_blocked ON public.project_documents;
CREATE POLICY project_documents_delete_blocked ON public.project_documents FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- quantitativos_budgets
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.quantitativos_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quantitativos_budgets FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quantitativos_budgets_select_own_org ON public.quantitativos_budgets;
CREATE POLICY quantitativos_budgets_select_own_org ON public.quantitativos_budgets FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS quantitativos_budgets_insert_with_role ON public.quantitativos_budgets;
CREATE POLICY quantitativos_budgets_insert_with_role ON public.quantitativos_budgets FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS quantitativos_budgets_update_role ON public.quantitativos_budgets;
CREATE POLICY quantitativos_budgets_update_role ON public.quantitativos_budgets FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS quantitativos_budgets_delete_blocked ON public.quantitativos_budgets;
CREATE POLICY quantitativos_budgets_delete_blocked ON public.quantitativos_budgets FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- quantitativos_custom_base
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.quantitativos_custom_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quantitativos_custom_base FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quantitativos_custom_base_select_own_org ON public.quantitativos_custom_base;
CREATE POLICY quantitativos_custom_base_select_own_org ON public.quantitativos_custom_base FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS quantitativos_custom_base_insert_with_role ON public.quantitativos_custom_base;
CREATE POLICY quantitativos_custom_base_insert_with_role ON public.quantitativos_custom_base FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS quantitativos_custom_base_update_role ON public.quantitativos_custom_base;
CREATE POLICY quantitativos_custom_base_update_role ON public.quantitativos_custom_base FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS quantitativos_custom_base_delete_blocked ON public.quantitativos_custom_base;
CREATE POLICY quantitativos_custom_base_delete_blocked ON public.quantitativos_custom_base FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- preconstrucao_sessions
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.preconstrucao_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preconstrucao_sessions FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS preconstrucao_sessions_select_own_org ON public.preconstrucao_sessions;
CREATE POLICY preconstrucao_sessions_select_own_org ON public.preconstrucao_sessions FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS preconstrucao_sessions_insert_with_role ON public.preconstrucao_sessions;
CREATE POLICY preconstrucao_sessions_insert_with_role ON public.preconstrucao_sessions FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS preconstrucao_sessions_update_role ON public.preconstrucao_sessions;
CREATE POLICY preconstrucao_sessions_update_role ON public.preconstrucao_sessions FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS preconstrucao_sessions_delete_blocked ON public.preconstrucao_sessions;
CREATE POLICY preconstrucao_sessions_delete_blocked ON public.preconstrucao_sessions FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- bim_projects
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.bim_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bim_projects FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bim_projects_select_own_org ON public.bim_projects;
CREATE POLICY bim_projects_select_own_org ON public.bim_projects FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS bim_projects_insert_with_role ON public.bim_projects;
CREATE POLICY bim_projects_insert_with_role ON public.bim_projects FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS bim_projects_update_role ON public.bim_projects;
CREATE POLICY bim_projects_update_role ON public.bim_projects FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS bim_projects_delete_blocked ON public.bim_projects;
CREATE POLICY bim_projects_delete_blocked ON public.bim_projects FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- bim_segments
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.bim_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bim_segments FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bim_segments_select_own_org ON public.bim_segments;
CREATE POLICY bim_segments_select_own_org ON public.bim_segments FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS bim_segments_insert_with_role ON public.bim_segments;
CREATE POLICY bim_segments_insert_with_role ON public.bim_segments FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS bim_segments_update_role ON public.bim_segments;
CREATE POLICY bim_segments_update_role ON public.bim_segments FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS bim_segments_delete_blocked ON public.bim_segments;
CREATE POLICY bim_segments_delete_blocked ON public.bim_segments FOR DELETE TO authenticated USING (false);
-- 0028_grupo_nucleo_rpcs.sql
-- Sprint 4 — Estende:
--   a) approval_matrix default + patch idempotente nas orgs existentes
--   b) approve_pending_action: novos action_types do Núcleo + BIM
--   c) export_organization_data: adiciona as 7 novas tabelas (LGPD)

-- ════════════════════════════════════════════════════════════════════════
-- a) approval_matrix
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.organizations
  ALTER COLUMN settings SET DEFAULT jsonb_build_object(
    'approval_matrix', jsonb_build_object(
      -- Sprint 1-3
      'delete_fvs',                       'diretor',
      'update_fvs_closed',                'gerente',
      'delete_rdo',                       'gerente',
      'update_rdo_closed',                'gerente',
      'delete_po',                        'diretor',
      'update_po_approved',               'diretor',
      'delete_invoice',                   'diretor',
      'approve_budget',                   'diretor',
      'delete_plan_scenario',             'gerente',
      'delete_plan_trecho',               'gerente',
      'delete_project',                   'owner',
      'delete_organization',              'owner',
      'delete_worker',                    'diretor',
      'delete_labor_crew',                'gerente',
      'delete_timecard',                  'gerente',
      'delete_shift',                     'gerente',
      'delete_worker_absence',            'gerente',
      'delete_lps_activity',              'gerente',
      'delete_lps_restriction',           'gerente',
      'mark_restriction_resolved',        'gerente',
      'delete_lps_takt_zone',             'gerente',
      'delete_operacao_campo_activity',   'gerente',
      'delete_operacao_campo_day',        'gerente',
      'delete_master_activity',           'gerente',
      'delete_master_baseline',           'diretor',
      'delete_lookahead_derived',         'gerente',
      'delete_programacao_diaria',        'gerente',
      'delete_daily_report_activity',     'gerente',
      'delete_daily_report_equipment_log','gerente',
      'delete_daily_report_material_log', 'gerente',
      'delete_daily_report_photo',        'gerente',
      -- Sprint 4 — Núcleo + BIM
      'delete_project_document',          'gerente',
      'delete_quantitativo_budget',       'gerente',
      'delete_quantitativo_custom_base',  'gerente',
      'delete_preconstrucao_session',     'gerente',
      'delete_bim_project',               'diretor',
      'delete_bim_segment',               'gerente'
    ),
    'mfa_required_roles', jsonb_build_array('owner', 'diretor'),
    'soft_delete_days',   30
  );

UPDATE public.organizations
SET settings = jsonb_set(
  settings,
  '{approval_matrix}',
  COALESCE(settings->'approval_matrix', '{}'::jsonb) || jsonb_build_object(
    'delete_project_document',         COALESCE(settings->'approval_matrix'->>'delete_project_document',         'gerente'),
    'delete_quantitativo_budget',      COALESCE(settings->'approval_matrix'->>'delete_quantitativo_budget',      'gerente'),
    'delete_quantitativo_custom_base', COALESCE(settings->'approval_matrix'->>'delete_quantitativo_custom_base', 'gerente'),
    'delete_preconstrucao_session',    COALESCE(settings->'approval_matrix'->>'delete_preconstrucao_session',    'gerente'),
    'delete_bim_project',              COALESCE(settings->'approval_matrix'->>'delete_bim_project',              'diretor'),
    'delete_bim_segment',              COALESCE(settings->'approval_matrix'->>'delete_bim_segment',              'gerente')
  ),
  true
)
WHERE deleted_at IS NULL;

-- ════════════════════════════════════════════════════════════════════════
-- b) approve_pending_action — versão estendida
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approve_pending_action(p_action_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action  public.pending_actions%ROWTYPE;
  v_org_id  uuid := public.user_org();
BEGIN
  SELECT * INTO v_action FROM public.pending_actions WHERE id = p_action_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pending action not found' USING ERRCODE = '02000'; END IF;
  IF v_action.organization_id != v_org_id THEN RAISE EXCEPTION 'cross-tenant access denied' USING ERRCODE = '42501'; END IF;
  IF v_action.status != 'pending' THEN RAISE EXCEPTION 'action is not pending (status=%)', v_action.status USING ERRCODE = '22000'; END IF;
  IF v_action.expires_at < now() THEN
    UPDATE public.pending_actions SET status = 'expired' WHERE id = p_action_id;
    RAISE EXCEPTION 'action expired' USING ERRCODE = '22008';
  END IF;
  IF v_action.requested_by = auth.uid() THEN RAISE EXCEPTION 'requester cannot approve their own action' USING ERRCODE = '42501'; END IF;
  IF NOT public.has_role(ARRAY[v_action.required_role]::public.user_role[]) AND
     NOT public.has_role(ARRAY['owner']::public.user_role[]) THEN
    RAISE EXCEPTION 'role % required to approve', v_action.required_role USING ERRCODE = '42501';
  END IF;

  CASE v_action.action_type
    -- Sprint 1
    WHEN 'delete_fvs' THEN
      UPDATE public.fvs SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'update_fvs_closed' THEN
      UPDATE public.fvs SET payload = COALESCE(v_action.payload, payload), updated_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 2
    WHEN 'delete_rdo' THEN
      UPDATE public.rdo SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'update_rdo_closed' THEN
      UPDATE public.rdo SET payload = COALESCE(v_action.payload, payload), updated_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_po' THEN
      UPDATE public.purchase_orders SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'update_po_approved' THEN
      UPDATE public.purchase_orders SET payload = COALESCE(v_action.payload, payload), updated_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_invoice' THEN
      UPDATE public.invoices SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_plan_scenario' THEN
      UPDATE public.plan_scenarios SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_plan_trecho' THEN
      UPDATE public.plan_trechos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 3 — Mão-de-Obra
    WHEN 'delete_worker' THEN
      UPDATE public.workers SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_labor_crew' THEN
      UPDATE public.labor_crews SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_timecard' THEN
      UPDATE public.timecards SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_shift' THEN
      UPDATE public.shifts SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_worker_absence' THEN
      UPDATE public.worker_absences SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 3 — LPS
    WHEN 'delete_lps_activity' THEN
      UPDATE public.lps_activities SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_lps_restriction' THEN
      UPDATE public.lps_restrictions SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'mark_restriction_resolved' THEN
      UPDATE public.lps_restrictions
        SET status = 'resolvida', resolved_at = now(), updated_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_lps_takt_zone' THEN
      UPDATE public.lps_takt_zones SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 3 — Operação-Campo
    WHEN 'delete_operacao_campo_activity' THEN
      UPDATE public.operacao_campo_activities SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_operacao_campo_day' THEN
      UPDATE public.operacao_campo_days SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 3 — Planejamento-Mestre
    WHEN 'delete_master_activity' THEN
      UPDATE public.master_activities SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_master_baseline' THEN
      UPDATE public.master_baselines SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_lookahead_derived' THEN
      UPDATE public.lookahead_derived_activities SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_programacao_diaria' THEN
      UPDATE public.programacao_diaria SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 3 — Relatório 360
    WHEN 'delete_daily_report_activity' THEN
      UPDATE public.daily_report_activities SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_daily_report_equipment_log' THEN
      UPDATE public.daily_report_equipment_logs SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_daily_report_material_log' THEN
      UPDATE public.daily_report_material_logs SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_daily_report_photo' THEN
      UPDATE public.daily_report_photos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 4 — Núcleo + BIM
    WHEN 'delete_project' THEN
      UPDATE public.projects SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_project_document' THEN
      UPDATE public.project_documents SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_quantitativo_budget' THEN
      UPDATE public.quantitativos_budgets SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_quantitativo_custom_base' THEN
      UPDATE public.quantitativos_custom_base SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_preconstrucao_session' THEN
      UPDATE public.preconstrucao_sessions SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_bim_project' THEN
      UPDATE public.bim_projects SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_bim_segment' THEN
      UPDATE public.bim_segments SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

    ELSE
      RAISE NOTICE 'action_type % approved but no handler defined', v_action.action_type;
  END CASE;

  UPDATE public.pending_actions
    SET status = 'approved', approved_by = auth.uid(), approved_at = now()
    WHERE id = p_action_id;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (v_org_id, auth.uid(), 'approve_action', 'pending_actions', p_action_id::text,
          jsonb_build_object('action_type', v_action.action_type));
END $$;

GRANT EXECUTE ON FUNCTION public.approve_pending_action(uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- c) export_organization_data — versão estendida
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.export_organization_data(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF public.user_org() != p_org_id THEN
    RAISE EXCEPTION 'cross-tenant export denied' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(ARRAY['owner']::public.user_role[]) THEN
    RAISE EXCEPTION 'only owner can export org data' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'exported_at',                  now(),
    'exported_by',                  auth.uid(),
    'organization',                 (SELECT to_jsonb(o) FROM public.organizations o WHERE o.id = p_org_id),
    'profiles',                     (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM public.profiles p WHERE p.organization_id = p_org_id),
    'invitations',                  (SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) FROM public.invitations i WHERE i.organization_id = p_org_id),
    'fvs',                          (SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb) FROM public.fvs f WHERE f.organization_id = p_org_id),
    'rdo',                          (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.rdo r WHERE r.organization_id = p_org_id),
    'plan_trechos',                 (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.plan_trechos t WHERE t.organization_id = p_org_id),
    'plan_teams',                   (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.plan_teams t WHERE t.organization_id = p_org_id),
    'plan_holidays',                (SELECT COALESCE(jsonb_agg(to_jsonb(h)), '[]'::jsonb) FROM public.plan_holidays h WHERE h.organization_id = p_org_id),
    'plan_scenarios',               (SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM public.plan_scenarios s WHERE s.organization_id = p_org_id),
    'suppliers',                    (SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM public.suppliers s WHERE s.organization_id = p_org_id),
    'purchase_orders',              (SELECT COALESCE(jsonb_agg(to_jsonb(po)), '[]'::jsonb) FROM public.purchase_orders po WHERE po.organization_id = p_org_id),
    'goods_receipts',               (SELECT COALESCE(jsonb_agg(to_jsonb(gr)), '[]'::jsonb) FROM public.goods_receipts gr WHERE gr.organization_id = p_org_id),
    'invoices',                     (SELECT COALESCE(jsonb_agg(to_jsonb(inv)), '[]'::jsonb) FROM public.invoices inv WHERE inv.organization_id = p_org_id),
    'workers',                      (SELECT COALESCE(jsonb_agg(to_jsonb(w)), '[]'::jsonb) FROM public.workers w WHERE w.organization_id = p_org_id),
    'labor_crews',                  (SELECT COALESCE(jsonb_agg(to_jsonb(lc)), '[]'::jsonb) FROM public.labor_crews lc WHERE lc.organization_id = p_org_id),
    'timecards',                    (SELECT COALESCE(jsonb_agg(to_jsonb(tc)), '[]'::jsonb) FROM public.timecards tc WHERE tc.organization_id = p_org_id),
    'shifts',                       (SELECT COALESCE(jsonb_agg(to_jsonb(sh)), '[]'::jsonb) FROM public.shifts sh WHERE sh.organization_id = p_org_id),
    'worker_absences',              (SELECT COALESCE(jsonb_agg(to_jsonb(wa)), '[]'::jsonb) FROM public.worker_absences wa WHERE wa.organization_id = p_org_id),
    'lps_activities',               (SELECT COALESCE(jsonb_agg(to_jsonb(la)), '[]'::jsonb) FROM public.lps_activities la WHERE la.organization_id = p_org_id),
    'lps_restrictions',             (SELECT COALESCE(jsonb_agg(to_jsonb(lr)), '[]'::jsonb) FROM public.lps_restrictions lr WHERE lr.organization_id = p_org_id),
    'lps_takt_zones',               (SELECT COALESCE(jsonb_agg(to_jsonb(lt)), '[]'::jsonb) FROM public.lps_takt_zones lt WHERE lt.organization_id = p_org_id),
    'operacao_campo_activities',    (SELECT COALESCE(jsonb_agg(to_jsonb(oa)), '[]'::jsonb) FROM public.operacao_campo_activities oa WHERE oa.organization_id = p_org_id),
    'operacao_campo_days',          (SELECT COALESCE(jsonb_agg(to_jsonb(od)), '[]'::jsonb) FROM public.operacao_campo_days od WHERE od.organization_id = p_org_id),
    'master_activities',            (SELECT COALESCE(jsonb_agg(to_jsonb(ma)), '[]'::jsonb) FROM public.master_activities ma WHERE ma.organization_id = p_org_id),
    'master_baselines',             (SELECT COALESCE(jsonb_agg(to_jsonb(mb)), '[]'::jsonb) FROM public.master_baselines mb WHERE mb.organization_id = p_org_id),
    'lookahead_derived_activities', (SELECT COALESCE(jsonb_agg(to_jsonb(ld)), '[]'::jsonb) FROM public.lookahead_derived_activities ld WHERE ld.organization_id = p_org_id),
    'programacao_diaria',           (SELECT COALESCE(jsonb_agg(to_jsonb(pd)), '[]'::jsonb) FROM public.programacao_diaria pd WHERE pd.organization_id = p_org_id),
    'daily_report_activities',      (SELECT COALESCE(jsonb_agg(to_jsonb(dra)), '[]'::jsonb) FROM public.daily_report_activities dra WHERE dra.organization_id = p_org_id),
    'daily_report_equipment_logs',  (SELECT COALESCE(jsonb_agg(to_jsonb(dre)), '[]'::jsonb) FROM public.daily_report_equipment_logs dre WHERE dre.organization_id = p_org_id),
    'daily_report_material_logs',   (SELECT COALESCE(jsonb_agg(to_jsonb(drm)), '[]'::jsonb) FROM public.daily_report_material_logs drm WHERE drm.organization_id = p_org_id),
    'daily_report_photos',          (SELECT COALESCE(jsonb_agg(to_jsonb(drp)), '[]'::jsonb) FROM public.daily_report_photos drp WHERE drp.organization_id = p_org_id),
    -- Sprint 4 — Núcleo + BIM
    'projects',                     (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM public.projects p WHERE p.organization_id = p_org_id),
    'project_documents',            (SELECT COALESCE(jsonb_agg(to_jsonb(pd)), '[]'::jsonb) FROM public.project_documents pd WHERE pd.organization_id = p_org_id),
    'quantitativos_budgets',        (SELECT COALESCE(jsonb_agg(to_jsonb(qb)), '[]'::jsonb) FROM public.quantitativos_budgets qb WHERE qb.organization_id = p_org_id),
    'quantitativos_custom_base',    (SELECT COALESCE(jsonb_agg(to_jsonb(qc)), '[]'::jsonb) FROM public.quantitativos_custom_base qc WHERE qc.organization_id = p_org_id),
    'preconstrucao_sessions',       (SELECT COALESCE(jsonb_agg(to_jsonb(ps)), '[]'::jsonb) FROM public.preconstrucao_sessions ps WHERE ps.organization_id = p_org_id),
    'bim_projects',                 (SELECT COALESCE(jsonb_agg(to_jsonb(bp)), '[]'::jsonb) FROM public.bim_projects bp WHERE bp.organization_id = p_org_id),
    'bim_segments',                 (SELECT COALESCE(jsonb_agg(to_jsonb(bs)), '[]'::jsonb) FROM public.bim_segments bs WHERE bs.organization_id = p_org_id),
    'pending_actions',              (SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM public.pending_actions a WHERE a.organization_id = p_org_id),
    'audit_log',                    (SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb) FROM public.audit_log l WHERE l.organization_id = p_org_id)
  ) INTO v_result;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id)
  VALUES (p_org_id, auth.uid(), 'export', 'organizations', p_org_id::text);

  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.export_organization_data(uuid) TO authenticated;
