-- 0019_grupo_operacional.sql
-- Sprint 3 — Grupo Operacional: cria 17 tabelas para os 5 módulos
-- (Mão-de-Obra, LPS, Operação-Campo, Planejamento-Mestre, Relatório 360).
--
-- Padrão: idêntico ao 0013-0015 (FVS/RDO/Suprimentos).
--   - PK uuid
--   - organization_id NOT NULL FK -> organizations(id)
--   - created_by FK -> auth.users
--   - created_at / updated_at / deleted_at (soft-delete)
--   - payload jsonb com a entidade completa serializada
--   - colunas top-level apenas para campos indexáveis (datas, status, FKs)
-- RLS é aplicada em 0020. Aprovações em 0021.

-- ════════════════════════════════════════════════════════════════════════
-- Mão-de-Obra (5 tabelas)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.workers (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  role            text,
  status          text NOT NULL DEFAULT 'active',
  crew_id         uuid,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_workers_org             ON public.workers(organization_id);
CREATE INDEX IF NOT EXISTS idx_workers_org_created     ON public.workers(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workers_org_active      ON public.workers(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workers_crew            ON public.workers(crew_id);

CREATE TABLE IF NOT EXISTS public.labor_crews (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_labor_crews_org         ON public.labor_crews(organization_id);
CREATE INDEX IF NOT EXISTS idx_labor_crews_org_created ON public.labor_crews(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_labor_crews_org_active  ON public.labor_crews(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.timecards (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id       uuid,
  date            date NOT NULL,
  hours_worked    numeric(6,2),
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_timecards_org           ON public.timecards(organization_id);
CREATE INDEX IF NOT EXISTS idx_timecards_org_created   ON public.timecards(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timecards_org_active    ON public.timecards(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timecards_worker        ON public.timecards(worker_id);
CREATE INDEX IF NOT EXISTS idx_timecards_date          ON public.timecards(date);

CREATE TABLE IF NOT EXISTS public.shifts (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id       uuid,
  date            date NOT NULL,
  type            text,
  status          text NOT NULL DEFAULT 'scheduled',
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_shifts_org              ON public.shifts(organization_id);
CREATE INDEX IF NOT EXISTS idx_shifts_org_created      ON public.shifts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_org_active       ON public.shifts(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shifts_worker_date      ON public.shifts(worker_id, date);

CREATE TABLE IF NOT EXISTS public.worker_absences (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id       uuid,
  date            date NOT NULL,
  type            text,
  status          text NOT NULL DEFAULT 'open',
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_worker_absences_org           ON public.worker_absences(organization_id);
CREATE INDEX IF NOT EXISTS idx_worker_absences_org_created   ON public.worker_absences(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_absences_org_active    ON public.worker_absences(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_worker_absences_worker        ON public.worker_absences(worker_id);

-- ════════════════════════════════════════════════════════════════════════
-- LPS-Lean (3 tabelas)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lps_activities (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  week            text NOT NULL,
  trecho_code     text,
  ready_status    text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_lps_activities_org          ON public.lps_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_lps_activities_org_created  ON public.lps_activities(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lps_activities_org_active   ON public.lps_activities(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lps_activities_week         ON public.lps_activities(week);

CREATE TABLE IF NOT EXISTS public.lps_restrictions (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tema            text NOT NULL,
  categoria       text,
  status          text NOT NULL DEFAULT 'identificada',
  prazo_remocao   date,
  resolved_at     timestamptz,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_lps_restrictions_org          ON public.lps_restrictions(organization_id);
CREATE INDEX IF NOT EXISTS idx_lps_restrictions_org_created  ON public.lps_restrictions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lps_restrictions_org_active   ON public.lps_restrictions(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lps_restrictions_status       ON public.lps_restrictions(status);

CREATE TABLE IF NOT EXISTS public.lps_takt_zones (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code            text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_lps_takt_zones_org          ON public.lps_takt_zones(organization_id);
CREATE INDEX IF NOT EXISTS idx_lps_takt_zones_org_created  ON public.lps_takt_zones(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lps_takt_zones_org_active   ON public.lps_takt_zones(organization_id) WHERE deleted_at IS NULL;

-- ════════════════════════════════════════════════════════════════════════
-- Operação-Campo (2 tabelas)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.operacao_campo_activities (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text,
  trecho_code     text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_operacao_campo_activities_org          ON public.operacao_campo_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_operacao_campo_activities_org_created  ON public.operacao_campo_activities(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operacao_campo_activities_org_active   ON public.operacao_campo_activities(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.operacao_campo_days (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  date            date NOT NULL,
  activity_id     uuid,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_operacao_campo_days_org          ON public.operacao_campo_days(organization_id);
CREATE INDEX IF NOT EXISTS idx_operacao_campo_days_org_created  ON public.operacao_campo_days(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operacao_campo_days_org_active   ON public.operacao_campo_days(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_operacao_campo_days_date         ON public.operacao_campo_days(date);
CREATE INDEX IF NOT EXISTS idx_operacao_campo_days_activity     ON public.operacao_campo_days(activity_id);

-- ════════════════════════════════════════════════════════════════════════
-- Planejamento-Mestre (4 tabelas)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.master_activities (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  wbs_code        text,
  name            text,
  parent_id       uuid,
  level           integer,
  planned_start   date,
  planned_end     date,
  status          text NOT NULL DEFAULT 'not_started',
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_master_activities_org          ON public.master_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_master_activities_org_created  ON public.master_activities(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_master_activities_org_active   ON public.master_activities(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_master_activities_parent       ON public.master_activities(parent_id);

CREATE TABLE IF NOT EXISTS public.master_baselines (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_master_baselines_org          ON public.master_baselines(organization_id);
CREATE INDEX IF NOT EXISTS idx_master_baselines_org_created  ON public.master_baselines(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_master_baselines_org_active   ON public.master_baselines(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.lookahead_derived_activities (
  id                 uuid PRIMARY KEY,
  organization_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  master_activity_id uuid,
  week_iso           text,
  status             text,
  payload            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by         uuid NOT NULL REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_lookahead_derived_activities_org          ON public.lookahead_derived_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_lookahead_derived_activities_org_created  ON public.lookahead_derived_activities(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lookahead_derived_activities_org_active   ON public.lookahead_derived_activities(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lookahead_derived_activities_week         ON public.lookahead_derived_activities(week_iso);

CREATE TABLE IF NOT EXISTS public.programacao_diaria (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  activity_id     uuid,
  date            date NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_programacao_diaria_org          ON public.programacao_diaria(organization_id);
CREATE INDEX IF NOT EXISTS idx_programacao_diaria_org_created  ON public.programacao_diaria(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_programacao_diaria_org_active   ON public.programacao_diaria(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_programacao_diaria_date         ON public.programacao_diaria(date);

-- ════════════════════════════════════════════════════════════════════════
-- Relatório 360 (4 tabelas)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.daily_report_activities (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_date     date NOT NULL,
  status          text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_daily_report_activities_org          ON public.daily_report_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_report_activities_org_created  ON public.daily_report_activities(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_report_activities_org_active   ON public.daily_report_activities(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_daily_report_activities_date         ON public.daily_report_activities(report_date);

CREATE TABLE IF NOT EXISTS public.daily_report_equipment_logs (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_date     date NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_daily_report_equipment_logs_org          ON public.daily_report_equipment_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_report_equipment_logs_org_created  ON public.daily_report_equipment_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_report_equipment_logs_org_active   ON public.daily_report_equipment_logs(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_daily_report_equipment_logs_date         ON public.daily_report_equipment_logs(report_date);

CREATE TABLE IF NOT EXISTS public.daily_report_material_logs (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_date     date NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_daily_report_material_logs_org          ON public.daily_report_material_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_report_material_logs_org_created  ON public.daily_report_material_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_report_material_logs_org_active   ON public.daily_report_material_logs(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_daily_report_material_logs_date         ON public.daily_report_material_logs(report_date);

CREATE TABLE IF NOT EXISTS public.daily_report_photos (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_date     date NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_daily_report_photos_org          ON public.daily_report_photos(organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_report_photos_org_created  ON public.daily_report_photos(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_report_photos_org_active   ON public.daily_report_photos(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_daily_report_photos_date         ON public.daily_report_photos(report_date);
