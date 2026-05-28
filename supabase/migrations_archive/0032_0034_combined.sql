-- 0032_sprint6_final.sql
-- Sprint 6 — Final: cria 9 tabelas para os 6 stores restantes (EVM, Torre,
-- Gestão360, Agenda, UserRoutine, CompanySettings).
-- Após esta migration, 100% dos stores reais estão migrados.

-- ════════════════════════════════════════════════════════════════════════
-- EVM (3 tabelas)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.evm_work_packages (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  code            text,
  name            text,
  total_budget_brl numeric(14,2),
  is_template     boolean DEFAULT false,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_evm_wp_org          ON public.evm_work_packages(organization_id);
CREATE INDEX IF NOT EXISTS idx_evm_wp_org_created  ON public.evm_work_packages(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evm_wp_org_active   ON public.evm_work_packages(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_evm_wp_project      ON public.evm_work_packages(project_id);

CREATE TABLE IF NOT EXISTS public.evm_cost_accounts (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  work_package_id uuid,
  activity_id     text,
  pillar          text,        -- 'material'|'equipamento'|'mao_de_obra'|'impostos_indiretos'
  total_cost_brl  numeric(14,2),
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_evm_ca_org          ON public.evm_cost_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_evm_ca_org_created  ON public.evm_cost_accounts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evm_ca_org_active   ON public.evm_cost_accounts(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_evm_ca_wp           ON public.evm_cost_accounts(work_package_id);
CREATE INDEX IF NOT EXISTS idx_evm_ca_pillar       ON public.evm_cost_accounts(pillar);

CREATE TABLE IF NOT EXISTS public.evm_measurements (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  work_package_id uuid,
  activity_id     text,
  composite_score numeric(8,4),
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_evm_meas_org          ON public.evm_measurements(organization_id);
CREATE INDEX IF NOT EXISTS idx_evm_meas_org_created  ON public.evm_measurements(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evm_meas_org_active   ON public.evm_measurements(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_evm_meas_wp           ON public.evm_measurements(work_package_id);

-- ════════════════════════════════════════════════════════════════════════
-- Torre de Controle (1 tabela — risks aninhados em payload)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.construction_sites (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  code            text,
  name            text,
  status          text,
  city            text,
  state           text,
  lat             double precision,
  lng             double precision,
  start_date      date,
  expected_end    date,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- company, owner, manager, address, areas, milestones, risks[]
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sites_org          ON public.construction_sites(organization_id);
CREATE INDEX IF NOT EXISTS idx_sites_org_created  ON public.construction_sites(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sites_org_active   ON public.construction_sites(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sites_status       ON public.construction_sites(status);

-- ════════════════════════════════════════════════════════════════════════
-- Gestão 360 (2 tabelas)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.change_orders (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  project_code    text,
  title           text,
  type            text,
  status          text NOT NULL DEFAULT 'draft',
  impact_cost_brl numeric(14,2),
  impact_days     integer,
  submitted_at    timestamptz,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_co_org          ON public.change_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_co_org_created  ON public.change_orders(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_co_org_active   ON public.change_orders(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_co_project      ON public.change_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_co_status       ON public.change_orders(status);

CREATE TABLE IF NOT EXISTS public.change_order_photos (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  change_order_id uuid NOT NULL REFERENCES public.change_orders(id) ON DELETE CASCADE,
  storage_path    text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_co_photos_org          ON public.change_order_photos(organization_id);
CREATE INDEX IF NOT EXISTS idx_co_photos_org_created  ON public.change_order_photos(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_co_photos_org_active   ON public.change_order_photos(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_co_photos_change_order ON public.change_order_photos(change_order_id);

-- ════════════════════════════════════════════════════════════════════════
-- Agenda (2 tabelas)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.agenda_resources (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code            text,
  name            text,
  type            text,        -- 'equipment'|'crew'|'other'
  status          text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_agenda_res_org          ON public.agenda_resources(organization_id);
CREATE INDEX IF NOT EXISTS idx_agenda_res_org_created  ON public.agenda_resources(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agenda_res_org_active   ON public.agenda_resources(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.agenda_tasks (
  id                uuid PRIMARY KEY,
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_id       uuid,
  start_date        date,
  end_date          date,
  status            text,
  priority          text,
  linked_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by        uuid NOT NULL REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_agenda_tasks_org          ON public.agenda_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_agenda_tasks_org_created  ON public.agenda_tasks(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agenda_tasks_org_active   ON public.agenda_tasks(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agenda_tasks_resource     ON public.agenda_tasks(resource_id);
CREATE INDEX IF NOT EXISTS idx_agenda_tasks_dates        ON public.agenda_tasks(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_agenda_tasks_project      ON public.agenda_tasks(linked_project_id);

-- ════════════════════════════════════════════════════════════════════════
-- User Routine (1 tabela — escopo USER, 1 row por usuário)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_routines (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  persona         text NOT NULL DEFAULT 'engenheiro',
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- pinnedDaily, pinnedWeekly, pinnedMonthly, hasOnboarded
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_routines_org ON public.user_routines(organization_id);

-- ════════════════════════════════════════════════════════════════════════
-- Company Logos (1 tabela — binário no Storage)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.company_logos (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  storage_path    text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_company_logos_org          ON public.company_logos(organization_id);
CREATE INDEX IF NOT EXISTS idx_company_logos_org_created  ON public.company_logos(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_logos_org_active   ON public.company_logos(organization_id) WHERE deleted_at IS NULL;
-- 0033_sprint6_rls.sql
-- Sprint 6 — RLS para as 9 tabelas. Padrão idêntico aos sprints anteriores,
-- exceto user_routines que tem RLS por user_id (não por org).

-- ════════════════════════════════════════════════════════════════════════
-- EVM (3 tabelas)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.evm_work_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evm_work_packages FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS evm_wp_select_own_org ON public.evm_work_packages;
CREATE POLICY evm_wp_select_own_org ON public.evm_work_packages FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS evm_wp_insert_with_role ON public.evm_work_packages;
CREATE POLICY evm_wp_insert_with_role ON public.evm_work_packages FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS evm_wp_update_role ON public.evm_work_packages;
CREATE POLICY evm_wp_update_role ON public.evm_work_packages FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS evm_wp_delete_blocked ON public.evm_work_packages;
CREATE POLICY evm_wp_delete_blocked ON public.evm_work_packages FOR DELETE TO authenticated USING (false);

ALTER TABLE public.evm_cost_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evm_cost_accounts FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS evm_ca_select_own_org ON public.evm_cost_accounts;
CREATE POLICY evm_ca_select_own_org ON public.evm_cost_accounts FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS evm_ca_insert_with_role ON public.evm_cost_accounts;
CREATE POLICY evm_ca_insert_with_role ON public.evm_cost_accounts FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS evm_ca_update_role ON public.evm_cost_accounts;
CREATE POLICY evm_ca_update_role ON public.evm_cost_accounts FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS evm_ca_delete_blocked ON public.evm_cost_accounts;
CREATE POLICY evm_ca_delete_blocked ON public.evm_cost_accounts FOR DELETE TO authenticated USING (false);

ALTER TABLE public.evm_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evm_measurements FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS evm_meas_select_own_org ON public.evm_measurements;
CREATE POLICY evm_meas_select_own_org ON public.evm_measurements FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS evm_meas_insert_with_role ON public.evm_measurements;
CREATE POLICY evm_meas_insert_with_role ON public.evm_measurements FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS evm_meas_update_role ON public.evm_measurements;
CREATE POLICY evm_meas_update_role ON public.evm_measurements FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS evm_meas_delete_blocked ON public.evm_measurements;
CREATE POLICY evm_meas_delete_blocked ON public.evm_measurements FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Construction Sites (Torre)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.construction_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_sites FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sites_select_own_org ON public.construction_sites;
CREATE POLICY sites_select_own_org ON public.construction_sites FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS sites_insert_with_role ON public.construction_sites;
CREATE POLICY sites_insert_with_role ON public.construction_sites FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS sites_update_role ON public.construction_sites;
CREATE POLICY sites_update_role ON public.construction_sites FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS sites_delete_blocked ON public.construction_sites;
CREATE POLICY sites_delete_blocked ON public.construction_sites FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Change Orders (2 tabelas)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_orders FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS co_select_own_org ON public.change_orders;
CREATE POLICY co_select_own_org ON public.change_orders FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS co_insert_with_role ON public.change_orders;
CREATE POLICY co_insert_with_role ON public.change_orders FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS co_update_role ON public.change_orders;
CREATE POLICY co_update_role ON public.change_orders FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS co_delete_blocked ON public.change_orders;
CREATE POLICY co_delete_blocked ON public.change_orders FOR DELETE TO authenticated USING (false);

ALTER TABLE public.change_order_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_order_photos FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS co_photos_select_own_org ON public.change_order_photos;
CREATE POLICY co_photos_select_own_org ON public.change_order_photos FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS co_photos_insert_with_role ON public.change_order_photos;
CREATE POLICY co_photos_insert_with_role ON public.change_order_photos FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS co_photos_update_role ON public.change_order_photos;
CREATE POLICY co_photos_update_role ON public.change_order_photos FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS co_photos_delete_blocked ON public.change_order_photos;
CREATE POLICY co_photos_delete_blocked ON public.change_order_photos FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Agenda (2 tabelas)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.agenda_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_resources FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agenda_res_select_own_org ON public.agenda_resources;
CREATE POLICY agenda_res_select_own_org ON public.agenda_resources FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS agenda_res_insert_with_role ON public.agenda_resources;
CREATE POLICY agenda_res_insert_with_role ON public.agenda_resources FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS agenda_res_update_role ON public.agenda_resources;
CREATE POLICY agenda_res_update_role ON public.agenda_resources FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS agenda_res_delete_blocked ON public.agenda_resources;
CREATE POLICY agenda_res_delete_blocked ON public.agenda_resources FOR DELETE TO authenticated USING (false);

ALTER TABLE public.agenda_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_tasks FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agenda_tasks_select_own_org ON public.agenda_tasks;
CREATE POLICY agenda_tasks_select_own_org ON public.agenda_tasks FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS agenda_tasks_insert_with_role ON public.agenda_tasks;
CREATE POLICY agenda_tasks_insert_with_role ON public.agenda_tasks FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS agenda_tasks_update_role ON public.agenda_tasks;
CREATE POLICY agenda_tasks_update_role ON public.agenda_tasks FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS agenda_tasks_delete_blocked ON public.agenda_tasks;
CREATE POLICY agenda_tasks_delete_blocked ON public.agenda_tasks FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- User Routines — RLS POR user_id (não por org)
-- O usuário só vê/edita a própria rotina. Tenant isolation via organization_id
-- ainda é checado no INSERT (tem que ser da org dele).
-- DELETE permitido (sem aprovação) — usuário pode resetar a própria rotina.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_routines FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_routines_select_own ON public.user_routines;
CREATE POLICY user_routines_select_own ON public.user_routines FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS user_routines_insert_own ON public.user_routines;
CREATE POLICY user_routines_insert_own ON public.user_routines FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND organization_id = public.user_org());
DROP POLICY IF EXISTS user_routines_update_own ON public.user_routines;
CREATE POLICY user_routines_update_own ON public.user_routines FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND organization_id = public.user_org());
DROP POLICY IF EXISTS user_routines_delete_own ON public.user_routines;
CREATE POLICY user_routines_delete_own ON public.user_routines FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════
-- Company Logos
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.company_logos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_logos FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_logos_select_own_org ON public.company_logos;
CREATE POLICY company_logos_select_own_org ON public.company_logos FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS company_logos_insert_with_role ON public.company_logos;
CREATE POLICY company_logos_insert_with_role ON public.company_logos FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS company_logos_update_role ON public.company_logos;
CREATE POLICY company_logos_update_role ON public.company_logos FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS company_logos_delete_blocked ON public.company_logos;
CREATE POLICY company_logos_delete_blocked ON public.company_logos FOR DELETE TO authenticated USING (false);
-- 0034_sprint6_rpcs.sql
-- Sprint 6 — Estende:
--   a) approval_matrix default (já dividido em 3 blocos por causa do limite de 100 args)
--   b) approve_pending_action: 8 novos action_types
--   c) export_organization_data: + 9 novas tabelas (mantém divisão em blocos)

-- ════════════════════════════════════════════════════════════════════════
-- a) approval_matrix
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.organizations
  ALTER COLUMN settings SET DEFAULT jsonb_build_object(
    'approval_matrix',
      jsonb_build_object(
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
        'delete_master_baseline',           'diretor'
      )
      ||
      jsonb_build_object(
        'delete_lookahead_derived',         'gerente',
        'delete_programacao_diaria',        'gerente',
        'delete_daily_report_activity',     'gerente',
        'delete_daily_report_equipment_log','gerente',
        'delete_daily_report_material_log', 'gerente',
        'delete_daily_report_photo',        'gerente',
        -- Sprint 4
        'delete_project_document',          'gerente',
        'delete_quantitativo_budget',       'gerente',
        'delete_quantitativo_custom_base',  'gerente',
        'delete_preconstrucao_session',     'gerente',
        'delete_bim_project',               'diretor',
        'delete_bim_segment',               'gerente',
        -- Sprint 5
        'delete_equipamento',               'diretor',
        'delete_equipamento_manutencao',    'gerente',
        'delete_veiculo',                   'diretor',
        'delete_fleet_driver',              'gerente',
        'delete_fleet_fuel_record',         'gerente',
        'delete_fleet_vehicle_maintenance', 'gerente',
        'delete_fleet_route',               'gerente',
        'delete_fleet_service_order',       'gerente',
        'delete_fleet_fine',                'diretor',
        'delete_fleet_alert',               'gerente',
        'delete_fleet_schedule',            'gerente',
        'delete_otimizacao_routing',        'gerente',
        'delete_otimizacao_health',         'gerente'
      )
      ||
      jsonb_build_object(
        'delete_otimizacao_buy_lease',      'diretor',
        'delete_mapa_interativo',           'gerente',
        'delete_rede_ativo',                'diretor',
        'delete_rede_service_order',        'gerente',
        'delete_rede_outage',               'gerente',
        -- Sprint 6
        'delete_evm_work_package',          'gerente',
        'delete_evm_cost_account',          'gerente',
        'delete_evm_measurement',           'gerente',
        'delete_construction_site',         'diretor',
        'delete_change_order',              'gerente',
        'delete_agenda_task',               'gerente',
        'delete_agenda_resource',           'gerente',
        'delete_company_logo',              'gerente',
        'delete_change_order_photo',        'gerente'
      ),
    'mfa_required_roles', jsonb_build_array('owner', 'diretor'),
    'soft_delete_days',   30
  );

UPDATE public.organizations
SET settings = jsonb_set(
  settings,
  '{approval_matrix}',
  COALESCE(settings->'approval_matrix', '{}'::jsonb) || jsonb_build_object(
    'delete_evm_work_package',  COALESCE(settings->'approval_matrix'->>'delete_evm_work_package',  'gerente'),
    'delete_evm_cost_account',  COALESCE(settings->'approval_matrix'->>'delete_evm_cost_account',  'gerente'),
    'delete_evm_measurement',   COALESCE(settings->'approval_matrix'->>'delete_evm_measurement',   'gerente'),
    'delete_construction_site', COALESCE(settings->'approval_matrix'->>'delete_construction_site', 'diretor'),
    'delete_change_order',      COALESCE(settings->'approval_matrix'->>'delete_change_order',      'gerente'),
    'delete_change_order_photo',COALESCE(settings->'approval_matrix'->>'delete_change_order_photo','gerente'),
    'delete_agenda_task',       COALESCE(settings->'approval_matrix'->>'delete_agenda_task',       'gerente'),
    'delete_agenda_resource',   COALESCE(settings->'approval_matrix'->>'delete_agenda_resource',   'gerente'),
    'delete_company_logo',      COALESCE(settings->'approval_matrix'->>'delete_company_logo',      'gerente')
  ),
  true
)
WHERE deleted_at IS NULL;

-- ════════════════════════════════════════════════════════════════════════
-- b) approve_pending_action — versão final estendida
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
    WHEN 'delete_fvs' THEN UPDATE public.fvs SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'update_fvs_closed' THEN UPDATE public.fvs SET payload = COALESCE(v_action.payload, payload), updated_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 2
    WHEN 'delete_rdo' THEN UPDATE public.rdo SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'update_rdo_closed' THEN UPDATE public.rdo SET payload = COALESCE(v_action.payload, payload), updated_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_po' THEN UPDATE public.purchase_orders SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'update_po_approved' THEN UPDATE public.purchase_orders SET payload = COALESCE(v_action.payload, payload), updated_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_invoice' THEN UPDATE public.invoices SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_plan_scenario' THEN UPDATE public.plan_scenarios SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_plan_trecho' THEN UPDATE public.plan_trechos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 3
    WHEN 'delete_worker' THEN UPDATE public.workers SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_labor_crew' THEN UPDATE public.labor_crews SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_timecard' THEN UPDATE public.timecards SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_shift' THEN UPDATE public.shifts SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_worker_absence' THEN UPDATE public.worker_absences SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_lps_activity' THEN UPDATE public.lps_activities SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_lps_restriction' THEN UPDATE public.lps_restrictions SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'mark_restriction_resolved' THEN UPDATE public.lps_restrictions SET status = 'resolvida', resolved_at = now(), updated_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_lps_takt_zone' THEN UPDATE public.lps_takt_zones SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_operacao_campo_activity' THEN UPDATE public.operacao_campo_activities SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_operacao_campo_day' THEN UPDATE public.operacao_campo_days SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_master_activity' THEN UPDATE public.master_activities SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_master_baseline' THEN UPDATE public.master_baselines SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_lookahead_derived' THEN UPDATE public.lookahead_derived_activities SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_programacao_diaria' THEN UPDATE public.programacao_diaria SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_daily_report_activity' THEN UPDATE public.daily_report_activities SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_daily_report_equipment_log' THEN UPDATE public.daily_report_equipment_logs SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_daily_report_material_log' THEN UPDATE public.daily_report_material_logs SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_daily_report_photo' THEN UPDATE public.daily_report_photos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 4
    WHEN 'delete_project' THEN UPDATE public.projects SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_project_document' THEN UPDATE public.project_documents SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_quantitativo_budget' THEN UPDATE public.quantitativos_budgets SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_quantitativo_custom_base' THEN UPDATE public.quantitativos_custom_base SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_preconstrucao_session' THEN UPDATE public.preconstrucao_sessions SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_bim_project' THEN UPDATE public.bim_projects SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_bim_segment' THEN UPDATE public.bim_segments SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 5
    WHEN 'delete_equipamento' THEN UPDATE public.equipamentos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_equipamento_manutencao' THEN UPDATE public.equipamentos_manutencoes SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_veiculo' THEN UPDATE public.veiculos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_driver' THEN UPDATE public.fleet_drivers SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_fuel_record' THEN UPDATE public.fleet_fuel_records SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_vehicle_maintenance' THEN UPDATE public.fleet_vehicle_maintenance SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_route' THEN UPDATE public.fleet_routes SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_service_order' THEN UPDATE public.fleet_service_orders SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_fine' THEN UPDATE public.fleet_fines SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_alert' THEN UPDATE public.fleet_alerts SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_schedule' THEN UPDATE public.fleet_schedules SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_otimizacao_routing' THEN UPDATE public.otimizacao_routing_recommendations SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_otimizacao_health' THEN UPDATE public.otimizacao_health_scores SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_otimizacao_buy_lease' THEN UPDATE public.otimizacao_buy_lease_analyses SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_mapa_interativo' THEN UPDATE public.mapas_interativos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_rede_ativo' THEN UPDATE public.rede_ativos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_rede_service_order' THEN UPDATE public.rede_service_orders SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_rede_outage' THEN UPDATE public.rede_outages SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 6
    WHEN 'delete_evm_work_package' THEN UPDATE public.evm_work_packages SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_evm_cost_account' THEN UPDATE public.evm_cost_accounts SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_evm_measurement' THEN UPDATE public.evm_measurements SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_construction_site' THEN UPDATE public.construction_sites SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_change_order' THEN UPDATE public.change_orders SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_change_order_photo' THEN UPDATE public.change_order_photos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_agenda_task' THEN UPDATE public.agenda_tasks SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_agenda_resource' THEN UPDATE public.agenda_resources SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_company_logo' THEN UPDATE public.company_logos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

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
-- c) export_organization_data — versão final, dividida em 4 blocos
--    (Sprint 6 adicionou 9 novas tabelas; precisamos de mais um bloco ||)
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

  v_result := jsonb_build_object(
    'exported_at',                       now(),
    'exported_by',                       auth.uid(),
    'organization',                      (SELECT to_jsonb(o) FROM public.organizations o WHERE o.id = p_org_id),
    'profiles',                          (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM public.profiles p WHERE p.organization_id = p_org_id),
    'invitations',                       (SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) FROM public.invitations i WHERE i.organization_id = p_org_id),
    'fvs',                               (SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb) FROM public.fvs f WHERE f.organization_id = p_org_id),
    'rdo',                               (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.rdo r WHERE r.organization_id = p_org_id),
    'plan_trechos',                      (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.plan_trechos t WHERE t.organization_id = p_org_id),
    'plan_teams',                        (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.plan_teams t WHERE t.organization_id = p_org_id),
    'plan_holidays',                     (SELECT COALESCE(jsonb_agg(to_jsonb(h)), '[]'::jsonb) FROM public.plan_holidays h WHERE h.organization_id = p_org_id),
    'plan_scenarios',                    (SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM public.plan_scenarios s WHERE s.organization_id = p_org_id),
    'suppliers',                         (SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM public.suppliers s WHERE s.organization_id = p_org_id),
    'purchase_orders',                   (SELECT COALESCE(jsonb_agg(to_jsonb(po)), '[]'::jsonb) FROM public.purchase_orders po WHERE po.organization_id = p_org_id),
    'goods_receipts',                    (SELECT COALESCE(jsonb_agg(to_jsonb(gr)), '[]'::jsonb) FROM public.goods_receipts gr WHERE gr.organization_id = p_org_id),
    'invoices',                          (SELECT COALESCE(jsonb_agg(to_jsonb(inv)), '[]'::jsonb) FROM public.invoices inv WHERE inv.organization_id = p_org_id),
    'workers',                           (SELECT COALESCE(jsonb_agg(to_jsonb(w)), '[]'::jsonb) FROM public.workers w WHERE w.organization_id = p_org_id),
    'labor_crews',                       (SELECT COALESCE(jsonb_agg(to_jsonb(lc)), '[]'::jsonb) FROM public.labor_crews lc WHERE lc.organization_id = p_org_id),
    'timecards',                         (SELECT COALESCE(jsonb_agg(to_jsonb(tc)), '[]'::jsonb) FROM public.timecards tc WHERE tc.organization_id = p_org_id),
    'shifts',                            (SELECT COALESCE(jsonb_agg(to_jsonb(sh)), '[]'::jsonb) FROM public.shifts sh WHERE sh.organization_id = p_org_id),
    'worker_absences',                   (SELECT COALESCE(jsonb_agg(to_jsonb(wa)), '[]'::jsonb) FROM public.worker_absences wa WHERE wa.organization_id = p_org_id),
    'lps_activities',                    (SELECT COALESCE(jsonb_agg(to_jsonb(la)), '[]'::jsonb) FROM public.lps_activities la WHERE la.organization_id = p_org_id),
    'lps_restrictions',                  (SELECT COALESCE(jsonb_agg(to_jsonb(lr)), '[]'::jsonb) FROM public.lps_restrictions lr WHERE lr.organization_id = p_org_id),
    'lps_takt_zones',                    (SELECT COALESCE(jsonb_agg(to_jsonb(lt)), '[]'::jsonb) FROM public.lps_takt_zones lt WHERE lt.organization_id = p_org_id),
    'operacao_campo_activities',         (SELECT COALESCE(jsonb_agg(to_jsonb(oa)), '[]'::jsonb) FROM public.operacao_campo_activities oa WHERE oa.organization_id = p_org_id),
    'operacao_campo_days',               (SELECT COALESCE(jsonb_agg(to_jsonb(od)), '[]'::jsonb) FROM public.operacao_campo_days od WHERE od.organization_id = p_org_id)
  );

  v_result := v_result || jsonb_build_object(
    'master_activities',                 (SELECT COALESCE(jsonb_agg(to_jsonb(ma)), '[]'::jsonb) FROM public.master_activities ma WHERE ma.organization_id = p_org_id),
    'master_baselines',                  (SELECT COALESCE(jsonb_agg(to_jsonb(mb)), '[]'::jsonb) FROM public.master_baselines mb WHERE mb.organization_id = p_org_id),
    'lookahead_derived_activities',      (SELECT COALESCE(jsonb_agg(to_jsonb(ld)), '[]'::jsonb) FROM public.lookahead_derived_activities ld WHERE ld.organization_id = p_org_id),
    'programacao_diaria',                (SELECT COALESCE(jsonb_agg(to_jsonb(pd)), '[]'::jsonb) FROM public.programacao_diaria pd WHERE pd.organization_id = p_org_id),
    'daily_report_activities',           (SELECT COALESCE(jsonb_agg(to_jsonb(dra)), '[]'::jsonb) FROM public.daily_report_activities dra WHERE dra.organization_id = p_org_id),
    'daily_report_equipment_logs',       (SELECT COALESCE(jsonb_agg(to_jsonb(dre)), '[]'::jsonb) FROM public.daily_report_equipment_logs dre WHERE dre.organization_id = p_org_id),
    'daily_report_material_logs',        (SELECT COALESCE(jsonb_agg(to_jsonb(drm)), '[]'::jsonb) FROM public.daily_report_material_logs drm WHERE drm.organization_id = p_org_id),
    'daily_report_photos',               (SELECT COALESCE(jsonb_agg(to_jsonb(drp)), '[]'::jsonb) FROM public.daily_report_photos drp WHERE drp.organization_id = p_org_id),
    'projects',                          (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM public.projects p WHERE p.organization_id = p_org_id),
    'project_documents',                 (SELECT COALESCE(jsonb_agg(to_jsonb(pd)), '[]'::jsonb) FROM public.project_documents pd WHERE pd.organization_id = p_org_id),
    'quantitativos_budgets',             (SELECT COALESCE(jsonb_agg(to_jsonb(qb)), '[]'::jsonb) FROM public.quantitativos_budgets qb WHERE qb.organization_id = p_org_id),
    'quantitativos_custom_base',         (SELECT COALESCE(jsonb_agg(to_jsonb(qc)), '[]'::jsonb) FROM public.quantitativos_custom_base qc WHERE qc.organization_id = p_org_id),
    'preconstrucao_sessions',            (SELECT COALESCE(jsonb_agg(to_jsonb(ps)), '[]'::jsonb) FROM public.preconstrucao_sessions ps WHERE ps.organization_id = p_org_id),
    'bim_projects',                      (SELECT COALESCE(jsonb_agg(to_jsonb(bp)), '[]'::jsonb) FROM public.bim_projects bp WHERE bp.organization_id = p_org_id),
    'bim_segments',                      (SELECT COALESCE(jsonb_agg(to_jsonb(bs)), '[]'::jsonb) FROM public.bim_segments bs WHERE bs.organization_id = p_org_id),
    'equipamentos',                      (SELECT COALESCE(jsonb_agg(to_jsonb(e)), '[]'::jsonb) FROM public.equipamentos e WHERE e.organization_id = p_org_id),
    'equipamentos_manutencoes',          (SELECT COALESCE(jsonb_agg(to_jsonb(em)), '[]'::jsonb) FROM public.equipamentos_manutencoes em WHERE em.organization_id = p_org_id),
    'veiculos',                          (SELECT COALESCE(jsonb_agg(to_jsonb(v)), '[]'::jsonb) FROM public.veiculos v WHERE v.organization_id = p_org_id),
    'fleet_drivers',                     (SELECT COALESCE(jsonb_agg(to_jsonb(fd)), '[]'::jsonb) FROM public.fleet_drivers fd WHERE fd.organization_id = p_org_id),
    'fleet_fuel_records',                (SELECT COALESCE(jsonb_agg(to_jsonb(ffr)), '[]'::jsonb) FROM public.fleet_fuel_records ffr WHERE ffr.organization_id = p_org_id),
    'fleet_vehicle_maintenance',         (SELECT COALESCE(jsonb_agg(to_jsonb(fvm)), '[]'::jsonb) FROM public.fleet_vehicle_maintenance fvm WHERE fvm.organization_id = p_org_id),
    'fleet_routes',                      (SELECT COALESCE(jsonb_agg(to_jsonb(fr)), '[]'::jsonb) FROM public.fleet_routes fr WHERE fr.organization_id = p_org_id),
    'fleet_service_orders',              (SELECT COALESCE(jsonb_agg(to_jsonb(fso)), '[]'::jsonb) FROM public.fleet_service_orders fso WHERE fso.organization_id = p_org_id),
    'fleet_fines',                       (SELECT COALESCE(jsonb_agg(to_jsonb(ff)), '[]'::jsonb) FROM public.fleet_fines ff WHERE ff.organization_id = p_org_id)
  );

  v_result := v_result || jsonb_build_object(
    'fleet_alerts',                      (SELECT COALESCE(jsonb_agg(to_jsonb(fa)), '[]'::jsonb) FROM public.fleet_alerts fa WHERE fa.organization_id = p_org_id),
    'fleet_schedules',                   (SELECT COALESCE(jsonb_agg(to_jsonb(fs)), '[]'::jsonb) FROM public.fleet_schedules fs WHERE fs.organization_id = p_org_id),
    'otimizacao_routing_recommendations',(SELECT COALESCE(jsonb_agg(to_jsonb(otrr)), '[]'::jsonb) FROM public.otimizacao_routing_recommendations otrr WHERE otrr.organization_id = p_org_id),
    'otimizacao_health_scores',          (SELECT COALESCE(jsonb_agg(to_jsonb(oths)), '[]'::jsonb) FROM public.otimizacao_health_scores oths WHERE oths.organization_id = p_org_id),
    'otimizacao_buy_lease_analyses',     (SELECT COALESCE(jsonb_agg(to_jsonb(otbl)), '[]'::jsonb) FROM public.otimizacao_buy_lease_analyses otbl WHERE otbl.organization_id = p_org_id),
    'mapas_interativos',                 (SELECT COALESCE(jsonb_agg(to_jsonb(mi)), '[]'::jsonb) FROM public.mapas_interativos mi WHERE mi.organization_id = p_org_id),
    'rede_ativos',                       (SELECT COALESCE(jsonb_agg(to_jsonb(ra)), '[]'::jsonb) FROM public.rede_ativos ra WHERE ra.organization_id = p_org_id),
    'rede_service_orders',               (SELECT COALESCE(jsonb_agg(to_jsonb(rso)), '[]'::jsonb) FROM public.rede_service_orders rso WHERE rso.organization_id = p_org_id),
    'rede_outages',                      (SELECT COALESCE(jsonb_agg(to_jsonb(ro)), '[]'::jsonb) FROM public.rede_outages ro WHERE ro.organization_id = p_org_id),
    -- Sprint 6
    'evm_work_packages',                 (SELECT COALESCE(jsonb_agg(to_jsonb(ewp)), '[]'::jsonb) FROM public.evm_work_packages ewp WHERE ewp.organization_id = p_org_id),
    'evm_cost_accounts',                 (SELECT COALESCE(jsonb_agg(to_jsonb(eca)), '[]'::jsonb) FROM public.evm_cost_accounts eca WHERE eca.organization_id = p_org_id),
    'evm_measurements',                  (SELECT COALESCE(jsonb_agg(to_jsonb(emt)), '[]'::jsonb) FROM public.evm_measurements emt WHERE emt.organization_id = p_org_id),
    'construction_sites',                (SELECT COALESCE(jsonb_agg(to_jsonb(cs)), '[]'::jsonb) FROM public.construction_sites cs WHERE cs.organization_id = p_org_id),
    'change_orders',                     (SELECT COALESCE(jsonb_agg(to_jsonb(co)), '[]'::jsonb) FROM public.change_orders co WHERE co.organization_id = p_org_id)
  );

  v_result := v_result || jsonb_build_object(
    'change_order_photos',               (SELECT COALESCE(jsonb_agg(to_jsonb(cop)), '[]'::jsonb) FROM public.change_order_photos cop WHERE cop.organization_id = p_org_id),
    'agenda_resources',                  (SELECT COALESCE(jsonb_agg(to_jsonb(ar)), '[]'::jsonb) FROM public.agenda_resources ar WHERE ar.organization_id = p_org_id),
    'agenda_tasks',                      (SELECT COALESCE(jsonb_agg(to_jsonb(at)), '[]'::jsonb) FROM public.agenda_tasks at WHERE at.organization_id = p_org_id),
    'user_routines',                     (SELECT COALESCE(jsonb_agg(to_jsonb(ur)), '[]'::jsonb) FROM public.user_routines ur WHERE ur.organization_id = p_org_id),
    'company_logos',                     (SELECT COALESCE(jsonb_agg(to_jsonb(cl)), '[]'::jsonb) FROM public.company_logos cl WHERE cl.organization_id = p_org_id),
    'pending_actions',                   (SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM public.pending_actions a WHERE a.organization_id = p_org_id),
    'audit_log',                         (SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb) FROM public.audit_log l WHERE l.organization_id = p_org_id)
  );

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id)
  VALUES (p_org_id, auth.uid(), 'export', 'organizations', p_org_id::text);

  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.export_organization_data(uuid) TO authenticated;
