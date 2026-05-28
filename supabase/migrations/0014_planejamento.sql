-- 0014_planejamento.sql
-- Tabelas do módulo Planejamento (cronograma, trechos, equipes, feriados, cenários).
-- Decisão: 1 tabela por entidade (não tudo em jsonb), porque queries/relatórios
-- precisam acessar trechos e teams individualmente.

-- ════════════════════════════════════════════════════════════════════════
-- plan_trechos
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.plan_trechos (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  code                text          NOT NULL,
  description         text          NOT NULL,
  length_m            numeric(10,2) NOT NULL DEFAULT 0,
  depth_m             numeric(8,2)  NOT NULL DEFAULT 0,
  diameter_mm         integer       NOT NULL DEFAULT 0,
  soil_type           text          NOT NULL DEFAULT 'normal',
  requires_shoring    boolean       NOT NULL DEFAULT false,
  unit_cost_brl       numeric(14,2),
  notes               text,

  -- Derivados (atualizados pelo schedule engine ou sync com RDO)
  assigned_team_index integer,
  planned_start_date  date,
  planned_end_date    date,
  abc_zone            text,
  executed_meters     numeric(10,2) NOT NULL DEFAULT 0,
  execution_status    text          NOT NULL DEFAULT 'not_started',
  last_rdo_date       date,

  -- payload jsonb para campos extras / extensões futuras
  payload             jsonb         NOT NULL DEFAULT '{}'::jsonb,

  created_by          uuid          NOT NULL REFERENCES auth.users(id),
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),
  deleted_at          timestamptz,

  CONSTRAINT plan_trechos_unique_code_per_org UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_plan_trechos_org        ON public.plan_trechos(organization_id);
CREATE INDEX IF NOT EXISTS idx_plan_trechos_org_active ON public.plan_trechos(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_plan_trechos_org_code   ON public.plan_trechos(organization_id, code);

DROP TRIGGER IF EXISTS trg_plan_trechos_updated_at ON public.plan_trechos;
CREATE TRIGGER trg_plan_trechos_updated_at
  BEFORE UPDATE ON public.plan_trechos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- plan_teams
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.plan_teams (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  name                     text          NOT NULL,
  foreman_count            integer       NOT NULL DEFAULT 0,
  worker_count             integer       NOT NULL DEFAULT 0,
  helper_count             integer       NOT NULL DEFAULT 0,
  operator_count           integer       NOT NULL DEFAULT 0,
  retroescavadeira         integer       NOT NULL DEFAULT 0,
  compactador              integer       NOT NULL DEFAULT 0,
  caminhao_basculante      integer       NOT NULL DEFAULT 0,
  labor_hourly_rate_brl    numeric(10,2) NOT NULL DEFAULT 0,
  equipment_daily_rate_brl numeric(10,2) NOT NULL DEFAULT 0,
  max_manual_excav_depth_m numeric(5,2)  NOT NULL DEFAULT 1.5,

  payload                  jsonb         NOT NULL DEFAULT '{}'::jsonb,

  created_by               uuid          NOT NULL REFERENCES auth.users(id),
  created_at               timestamptz   NOT NULL DEFAULT now(),
  updated_at               timestamptz   NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

CREATE INDEX IF NOT EXISTS idx_plan_teams_org        ON public.plan_teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_plan_teams_org_active ON public.plan_teams(organization_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_plan_teams_updated_at ON public.plan_teams;
CREATE TRIGGER trg_plan_teams_updated_at
  BEFORE UPDATE ON public.plan_teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- plan_holidays
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.plan_holidays (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  date            date          NOT NULL,
  description     text          NOT NULL,
  recurring       boolean       NOT NULL DEFAULT false,

  created_by      uuid          NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  deleted_at      timestamptz,

  CONSTRAINT plan_holidays_unique_date_per_org UNIQUE (organization_id, date)
);

CREATE INDEX IF NOT EXISTS idx_plan_holidays_org      ON public.plan_holidays(organization_id);
CREATE INDEX IF NOT EXISTS idx_plan_holidays_org_date ON public.plan_holidays(organization_id, date);

DROP TRIGGER IF EXISTS trg_plan_holidays_updated_at ON public.plan_holidays;
CREATE TRIGGER trg_plan_holidays_updated_at
  BEFORE UPDATE ON public.plan_holidays
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- plan_scenarios
-- (snapshot completo de what-if: trechos, teams, productivity, schedule config)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.plan_scenarios (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  name            text          NOT NULL,
  description     text,
  is_baseline     boolean       NOT NULL DEFAULT false,

  -- Snapshot completo no payload
  payload         jsonb         NOT NULL DEFAULT '{}'::jsonb,

  created_by      uuid          NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_plan_scenarios_org        ON public.plan_scenarios(organization_id);
CREATE INDEX IF NOT EXISTS idx_plan_scenarios_org_active ON public.plan_scenarios(organization_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_plan_scenarios_updated_at ON public.plan_scenarios;
CREATE TRIGGER trg_plan_scenarios_updated_at
  BEFORE UPDATE ON public.plan_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.plan_trechos   IS 'Trechos de obra (linear assets) — Planejamento.';
COMMENT ON TABLE public.plan_teams     IS 'Equipes de produção — Planejamento.';
COMMENT ON TABLE public.plan_holidays  IS 'Feriados que afetam o cronograma.';
COMMENT ON TABLE public.plan_scenarios IS 'Cenários what-if (snapshots completos).';
