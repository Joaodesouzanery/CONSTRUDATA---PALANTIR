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
-- 0020_grupo_operacional_rls.sql
-- Sprint 3 — RLS para as 17 tabelas do Grupo Operacional.
-- Padrão idêntico ao 0011/0016: SELECT/INSERT/UPDATE com role + DELETE bloqueado
-- (apenas via request_action RPC). FORCE RLS em todas.

-- ════════════════════════════════════════════════════════════════════════
-- Mão-de-Obra
-- (roles: engenheiro, planejador, gerente, diretor, owner)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workers_select_own_org ON public.workers;
CREATE POLICY workers_select_own_org ON public.workers FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS workers_insert_with_role ON public.workers;
CREATE POLICY workers_insert_with_role ON public.workers FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS workers_update_role ON public.workers;
CREATE POLICY workers_update_role ON public.workers FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS workers_delete_blocked ON public.workers;
CREATE POLICY workers_delete_blocked ON public.workers FOR DELETE TO authenticated USING (false);

ALTER TABLE public.labor_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_crews FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS labor_crews_select_own_org ON public.labor_crews;
CREATE POLICY labor_crews_select_own_org ON public.labor_crews FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS labor_crews_insert_with_role ON public.labor_crews;
CREATE POLICY labor_crews_insert_with_role ON public.labor_crews FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS labor_crews_update_role ON public.labor_crews;
CREATE POLICY labor_crews_update_role ON public.labor_crews FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS labor_crews_delete_blocked ON public.labor_crews;
CREATE POLICY labor_crews_delete_blocked ON public.labor_crews FOR DELETE TO authenticated USING (false);

ALTER TABLE public.timecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timecards FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS timecards_select_own_org ON public.timecards;
CREATE POLICY timecards_select_own_org ON public.timecards FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS timecards_insert_with_role ON public.timecards;
CREATE POLICY timecards_insert_with_role ON public.timecards FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS timecards_update_role ON public.timecards;
CREATE POLICY timecards_update_role ON public.timecards FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS timecards_delete_blocked ON public.timecards;
CREATE POLICY timecards_delete_blocked ON public.timecards FOR DELETE TO authenticated USING (false);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shifts_select_own_org ON public.shifts;
CREATE POLICY shifts_select_own_org ON public.shifts FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS shifts_insert_with_role ON public.shifts;
CREATE POLICY shifts_insert_with_role ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS shifts_update_role ON public.shifts;
CREATE POLICY shifts_update_role ON public.shifts FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS shifts_delete_blocked ON public.shifts;
CREATE POLICY shifts_delete_blocked ON public.shifts FOR DELETE TO authenticated USING (false);

ALTER TABLE public.worker_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_absences FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS worker_absences_select_own_org ON public.worker_absences;
CREATE POLICY worker_absences_select_own_org ON public.worker_absences FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS worker_absences_insert_with_role ON public.worker_absences;
CREATE POLICY worker_absences_insert_with_role ON public.worker_absences FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS worker_absences_update_role ON public.worker_absences;
CREATE POLICY worker_absences_update_role ON public.worker_absences FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS worker_absences_delete_blocked ON public.worker_absences;
CREATE POLICY worker_absences_delete_blocked ON public.worker_absences FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- LPS-Lean
-- (roles: planejador, engenheiro, gerente, diretor, owner)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.lps_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lps_activities FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lps_activities_select_own_org ON public.lps_activities;
CREATE POLICY lps_activities_select_own_org ON public.lps_activities FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS lps_activities_insert_with_role ON public.lps_activities;
CREATE POLICY lps_activities_insert_with_role ON public.lps_activities FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS lps_activities_update_role ON public.lps_activities;
CREATE POLICY lps_activities_update_role ON public.lps_activities FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS lps_activities_delete_blocked ON public.lps_activities;
CREATE POLICY lps_activities_delete_blocked ON public.lps_activities FOR DELETE TO authenticated USING (false);

ALTER TABLE public.lps_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lps_restrictions FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lps_restrictions_select_own_org ON public.lps_restrictions;
CREATE POLICY lps_restrictions_select_own_org ON public.lps_restrictions FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS lps_restrictions_insert_with_role ON public.lps_restrictions;
CREATE POLICY lps_restrictions_insert_with_role ON public.lps_restrictions FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS lps_restrictions_update_role ON public.lps_restrictions;
CREATE POLICY lps_restrictions_update_role ON public.lps_restrictions FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS lps_restrictions_delete_blocked ON public.lps_restrictions;
CREATE POLICY lps_restrictions_delete_blocked ON public.lps_restrictions FOR DELETE TO authenticated USING (false);

ALTER TABLE public.lps_takt_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lps_takt_zones FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lps_takt_zones_select_own_org ON public.lps_takt_zones;
CREATE POLICY lps_takt_zones_select_own_org ON public.lps_takt_zones FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS lps_takt_zones_insert_with_role ON public.lps_takt_zones;
CREATE POLICY lps_takt_zones_insert_with_role ON public.lps_takt_zones FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS lps_takt_zones_update_role ON public.lps_takt_zones;
CREATE POLICY lps_takt_zones_update_role ON public.lps_takt_zones FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS lps_takt_zones_delete_blocked ON public.lps_takt_zones;
CREATE POLICY lps_takt_zones_delete_blocked ON public.lps_takt_zones FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Operação-Campo
-- (roles: planejador, engenheiro, gerente, diretor, owner)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.operacao_campo_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacao_campo_activities FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operacao_campo_activities_select_own_org ON public.operacao_campo_activities;
CREATE POLICY operacao_campo_activities_select_own_org ON public.operacao_campo_activities FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS operacao_campo_activities_insert_with_role ON public.operacao_campo_activities;
CREATE POLICY operacao_campo_activities_insert_with_role ON public.operacao_campo_activities FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS operacao_campo_activities_update_role ON public.operacao_campo_activities;
CREATE POLICY operacao_campo_activities_update_role ON public.operacao_campo_activities FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS operacao_campo_activities_delete_blocked ON public.operacao_campo_activities;
CREATE POLICY operacao_campo_activities_delete_blocked ON public.operacao_campo_activities FOR DELETE TO authenticated USING (false);

ALTER TABLE public.operacao_campo_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacao_campo_days FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operacao_campo_days_select_own_org ON public.operacao_campo_days;
CREATE POLICY operacao_campo_days_select_own_org ON public.operacao_campo_days FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS operacao_campo_days_insert_with_role ON public.operacao_campo_days;
CREATE POLICY operacao_campo_days_insert_with_role ON public.operacao_campo_days FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS operacao_campo_days_update_role ON public.operacao_campo_days;
CREATE POLICY operacao_campo_days_update_role ON public.operacao_campo_days FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS operacao_campo_days_delete_blocked ON public.operacao_campo_days;
CREATE POLICY operacao_campo_days_delete_blocked ON public.operacao_campo_days FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Planejamento-Mestre
-- (roles: planejador, engenheiro, gerente, diretor, owner)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.master_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_activities FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS master_activities_select_own_org ON public.master_activities;
CREATE POLICY master_activities_select_own_org ON public.master_activities FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS master_activities_insert_with_role ON public.master_activities;
CREATE POLICY master_activities_insert_with_role ON public.master_activities FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS master_activities_update_role ON public.master_activities;
CREATE POLICY master_activities_update_role ON public.master_activities FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS master_activities_delete_blocked ON public.master_activities;
CREATE POLICY master_activities_delete_blocked ON public.master_activities FOR DELETE TO authenticated USING (false);

ALTER TABLE public.master_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_baselines FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS master_baselines_select_own_org ON public.master_baselines;
CREATE POLICY master_baselines_select_own_org ON public.master_baselines FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS master_baselines_insert_with_role ON public.master_baselines;
CREATE POLICY master_baselines_insert_with_role ON public.master_baselines FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','gerente','diretor','owner']::public.user_role[])
  );
-- Baselines são imutáveis: bloqueia UPDATE direto
DROP POLICY IF EXISTS master_baselines_update_blocked ON public.master_baselines;
CREATE POLICY master_baselines_update_blocked ON public.master_baselines FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS master_baselines_delete_blocked ON public.master_baselines;
CREATE POLICY master_baselines_delete_blocked ON public.master_baselines FOR DELETE TO authenticated USING (false);

ALTER TABLE public.lookahead_derived_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookahead_derived_activities FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lookahead_derived_activities_select_own_org ON public.lookahead_derived_activities;
CREATE POLICY lookahead_derived_activities_select_own_org ON public.lookahead_derived_activities FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS lookahead_derived_activities_insert_with_role ON public.lookahead_derived_activities;
CREATE POLICY lookahead_derived_activities_insert_with_role ON public.lookahead_derived_activities FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS lookahead_derived_activities_update_role ON public.lookahead_derived_activities;
CREATE POLICY lookahead_derived_activities_update_role ON public.lookahead_derived_activities FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS lookahead_derived_activities_delete_blocked ON public.lookahead_derived_activities;
CREATE POLICY lookahead_derived_activities_delete_blocked ON public.lookahead_derived_activities FOR DELETE TO authenticated USING (false);

ALTER TABLE public.programacao_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programacao_diaria FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS programacao_diaria_select_own_org ON public.programacao_diaria;
CREATE POLICY programacao_diaria_select_own_org ON public.programacao_diaria FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS programacao_diaria_insert_with_role ON public.programacao_diaria;
CREATE POLICY programacao_diaria_insert_with_role ON public.programacao_diaria FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS programacao_diaria_update_role ON public.programacao_diaria;
CREATE POLICY programacao_diaria_update_role ON public.programacao_diaria FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS programacao_diaria_delete_blocked ON public.programacao_diaria;
CREATE POLICY programacao_diaria_delete_blocked ON public.programacao_diaria FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Relatório 360
-- (roles: engenheiro, qualidade, gerente, diretor, owner)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.daily_report_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_activities FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_report_activities_select_own_org ON public.daily_report_activities;
CREATE POLICY daily_report_activities_select_own_org ON public.daily_report_activities FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS daily_report_activities_insert_with_role ON public.daily_report_activities;
CREATE POLICY daily_report_activities_insert_with_role ON public.daily_report_activities FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS daily_report_activities_update_role ON public.daily_report_activities;
CREATE POLICY daily_report_activities_update_role ON public.daily_report_activities FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS daily_report_activities_delete_blocked ON public.daily_report_activities;
CREATE POLICY daily_report_activities_delete_blocked ON public.daily_report_activities FOR DELETE TO authenticated USING (false);

ALTER TABLE public.daily_report_equipment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_equipment_logs FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_report_equipment_logs_select_own_org ON public.daily_report_equipment_logs;
CREATE POLICY daily_report_equipment_logs_select_own_org ON public.daily_report_equipment_logs FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS daily_report_equipment_logs_insert_with_role ON public.daily_report_equipment_logs;
CREATE POLICY daily_report_equipment_logs_insert_with_role ON public.daily_report_equipment_logs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS daily_report_equipment_logs_update_role ON public.daily_report_equipment_logs;
CREATE POLICY daily_report_equipment_logs_update_role ON public.daily_report_equipment_logs FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS daily_report_equipment_logs_delete_blocked ON public.daily_report_equipment_logs;
CREATE POLICY daily_report_equipment_logs_delete_blocked ON public.daily_report_equipment_logs FOR DELETE TO authenticated USING (false);

ALTER TABLE public.daily_report_material_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_material_logs FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_report_material_logs_select_own_org ON public.daily_report_material_logs;
CREATE POLICY daily_report_material_logs_select_own_org ON public.daily_report_material_logs FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS daily_report_material_logs_insert_with_role ON public.daily_report_material_logs;
CREATE POLICY daily_report_material_logs_insert_with_role ON public.daily_report_material_logs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS daily_report_material_logs_update_role ON public.daily_report_material_logs;
CREATE POLICY daily_report_material_logs_update_role ON public.daily_report_material_logs FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS daily_report_material_logs_delete_blocked ON public.daily_report_material_logs;
CREATE POLICY daily_report_material_logs_delete_blocked ON public.daily_report_material_logs FOR DELETE TO authenticated USING (false);

ALTER TABLE public.daily_report_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_photos FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_report_photos_select_own_org ON public.daily_report_photos;
CREATE POLICY daily_report_photos_select_own_org ON public.daily_report_photos FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS daily_report_photos_insert_with_role ON public.daily_report_photos;
CREATE POLICY daily_report_photos_insert_with_role ON public.daily_report_photos FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS daily_report_photos_update_role ON public.daily_report_photos;
CREATE POLICY daily_report_photos_update_role ON public.daily_report_photos FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS daily_report_photos_delete_blocked ON public.daily_report_photos;
CREATE POLICY daily_report_photos_delete_blocked ON public.daily_report_photos FOR DELETE TO authenticated USING (false);
-- 0021_grupo_operacional_rpcs.sql
-- Sprint 3 — Estende:
--   a) approval_matrix default + patch idempotente nas orgs existentes
--   b) approve_pending_action: novos action_types do Grupo Operacional
--   c) export_organization_data: adiciona as 17 novas tabelas (LGPD)

-- ════════════════════════════════════════════════════════════════════════
-- a) approval_matrix — default novo + patch idempotente
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.organizations
  ALTER COLUMN settings SET DEFAULT jsonb_build_object(
    'approval_matrix', jsonb_build_object(
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
      -- Sprint 3 — Grupo Operacional
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
      'delete_daily_report_photo',        'gerente'
    ),
    'mfa_required_roles', jsonb_build_array('owner', 'diretor'),
    'soft_delete_days',   30
  );

-- Patch idempotente: adiciona as chaves novas em orgs existentes sem
-- sobrescrever as que o owner já customizou.
UPDATE public.organizations
SET settings = jsonb_set(
  settings,
  '{approval_matrix}',
  COALESCE(settings->'approval_matrix', '{}'::jsonb) || jsonb_build_object(
    'delete_worker',                    COALESCE(settings->'approval_matrix'->>'delete_worker',                    'diretor'),
    'delete_labor_crew',                COALESCE(settings->'approval_matrix'->>'delete_labor_crew',                'gerente'),
    'delete_timecard',                  COALESCE(settings->'approval_matrix'->>'delete_timecard',                  'gerente'),
    'delete_shift',                     COALESCE(settings->'approval_matrix'->>'delete_shift',                     'gerente'),
    'delete_worker_absence',            COALESCE(settings->'approval_matrix'->>'delete_worker_absence',            'gerente'),
    'delete_lps_activity',              COALESCE(settings->'approval_matrix'->>'delete_lps_activity',              'gerente'),
    'delete_lps_restriction',           COALESCE(settings->'approval_matrix'->>'delete_lps_restriction',           'gerente'),
    'mark_restriction_resolved',        COALESCE(settings->'approval_matrix'->>'mark_restriction_resolved',        'gerente'),
    'delete_lps_takt_zone',             COALESCE(settings->'approval_matrix'->>'delete_lps_takt_zone',             'gerente'),
    'delete_operacao_campo_activity',   COALESCE(settings->'approval_matrix'->>'delete_operacao_campo_activity',   'gerente'),
    'delete_operacao_campo_day',        COALESCE(settings->'approval_matrix'->>'delete_operacao_campo_day',        'gerente'),
    'delete_master_activity',           COALESCE(settings->'approval_matrix'->>'delete_master_activity',           'gerente'),
    'delete_master_baseline',           COALESCE(settings->'approval_matrix'->>'delete_master_baseline',           'diretor'),
    'delete_lookahead_derived',         COALESCE(settings->'approval_matrix'->>'delete_lookahead_derived',         'gerente'),
    'delete_programacao_diaria',        COALESCE(settings->'approval_matrix'->>'delete_programacao_diaria',        'gerente'),
    'delete_daily_report_activity',     COALESCE(settings->'approval_matrix'->>'delete_daily_report_activity',     'gerente'),
    'delete_daily_report_equipment_log',COALESCE(settings->'approval_matrix'->>'delete_daily_report_equipment_log','gerente'),
    'delete_daily_report_material_log', COALESCE(settings->'approval_matrix'->>'delete_daily_report_material_log', 'gerente'),
    'delete_daily_report_photo',        COALESCE(settings->'approval_matrix'->>'delete_daily_report_photo',        'gerente')
  ),
  true
)
WHERE deleted_at IS NULL;

-- ════════════════════════════════════════════════════════════════════════
-- b) approve_pending_action — versão estendida com novos handlers
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approve_pending_action(p_action_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action  public.pending_actions%ROWTYPE;
  v_org_id  uuid := public.user_org();
BEGIN
  SELECT * INTO v_action FROM public.pending_actions WHERE id = p_action_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pending action not found' USING ERRCODE = '02000';
  END IF;

  IF v_action.organization_id != v_org_id THEN
    RAISE EXCEPTION 'cross-tenant access denied' USING ERRCODE = '42501';
  END IF;

  IF v_action.status != 'pending' THEN
    RAISE EXCEPTION 'action is not pending (status=%)', v_action.status USING ERRCODE = '22000';
  END IF;

  IF v_action.expires_at < now() THEN
    UPDATE public.pending_actions SET status = 'expired' WHERE id = p_action_id;
    RAISE EXCEPTION 'action expired' USING ERRCODE = '22008';
  END IF;

  IF v_action.requested_by = auth.uid() THEN
    RAISE EXCEPTION 'requester cannot approve their own action' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(ARRAY[v_action.required_role]::public.user_role[]) AND
     NOT public.has_role(ARRAY['owner']::public.user_role[]) THEN
    RAISE EXCEPTION 'role % required to approve', v_action.required_role USING ERRCODE = '42501';
  END IF;

  CASE v_action.action_type
    -- Sprint 1 — Qualidade
    WHEN 'delete_fvs' THEN
      UPDATE public.fvs SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'update_fvs_closed' THEN
      UPDATE public.fvs SET payload = COALESCE(v_action.payload, payload), updated_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

    -- Sprint 2 — RDO
    WHEN 'delete_rdo' THEN
      UPDATE public.rdo SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'update_rdo_closed' THEN
      UPDATE public.rdo SET payload = COALESCE(v_action.payload, payload), updated_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

    -- Sprint 2 — Suprimentos
    WHEN 'delete_po' THEN
      UPDATE public.purchase_orders SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'update_po_approved' THEN
      UPDATE public.purchase_orders SET payload = COALESCE(v_action.payload, payload), updated_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_invoice' THEN
      UPDATE public.invoices SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

    -- Sprint 2 — Planejamento
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

    -- Sprint 3 — LPS-Lean
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
-- c) export_organization_data — versão estendida com 17 novas tabelas
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
    -- Sprint 3 — Grupo Operacional
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
    'pending_actions',              (SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM public.pending_actions a WHERE a.organization_id = p_org_id),
    'audit_log',                    (SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb) FROM public.audit_log l WHERE l.organization_id = p_org_id)
  ) INTO v_result;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id)
  VALUES (p_org_id, auth.uid(), 'export', 'organizations', p_org_id::text);

  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.export_organization_data(uuid) TO authenticated;
