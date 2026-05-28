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
