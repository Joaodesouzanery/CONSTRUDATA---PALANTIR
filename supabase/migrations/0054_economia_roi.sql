-- 0054_economia_roi.sql
-- Modulo Economia: baseline, eventos de valor, regras de calculo e relatorios mensais.

CREATE TABLE IF NOT EXISTS public.economy_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid,
  project_name text NOT NULL,
  period text NOT NULL,
  captured_at date NOT NULL,
  ppc_percent numeric NOT NULL DEFAULT 0,
  material_deviation_percent numeric NOT NULL DEFAULT 0,
  platform_monthly_fee_brl numeric NOT NULL DEFAULT 5000,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.economy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid,
  project_name text NOT NULL,
  period text NOT NULL,
  source_module text NOT NULL,
  source_id text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'detected',
  impact_brl numeric NOT NULL DEFAULT 0,
  stable_key text NOT NULL,
  event_date date NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT economy_events_status_check CHECK (status IN ('detected','validated','dismissed','reported')),
  CONSTRAINT economy_events_category_check CHECK (category IN (
    'material_waste',
    'production_stoppage',
    'restriction_removed',
    'equipment_idle',
    'management_hours',
    'measurement_discrepancy',
    'schedule_alert',
    'cost_deviation'
  )),
  CONSTRAINT economy_events_source_check CHECK (source_module IN (
    'suprimentos',
    'lps',
    'planejamento',
    'rdo',
    'relatorio360',
    'equipamentos',
    'medicao',
    'evm',
    'manual'
  )),
  CONSTRAINT economy_events_stable_key_unique UNIQUE (organization_id, stable_key)
);

CREATE TABLE IF NOT EXISTS public.economy_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid,
  project_name text NOT NULL,
  period text NOT NULL,
  baseline_id uuid REFERENCES public.economy_baselines(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  avoided_loss_brl numeric NOT NULL DEFAULT 0,
  roi_percent numeric NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT economy_reports_status_check CHECK (status IN ('draft','sent','archived'))
);

CREATE TABLE IF NOT EXISTS public.economy_valuation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category text NOT NULL,
  label text NOT NULL,
  formula text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT economy_valuation_rules_unique UNIQUE (organization_id, category, label)
);

CREATE INDEX IF NOT EXISTS idx_economy_baselines_org_period
  ON public.economy_baselines(organization_id, period, project_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_economy_events_org_period
  ON public.economy_events(organization_id, period, project_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_economy_events_org_source
  ON public.economy_events(organization_id, source_module, category, event_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_economy_reports_org_period
  ON public.economy_reports(organization_id, period, project_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_economy_rules_org_category
  ON public.economy_valuation_rules(organization_id, category)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_economy_baselines_updated_at ON public.economy_baselines;
CREATE TRIGGER trg_economy_baselines_updated_at
  BEFORE UPDATE ON public.economy_baselines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_economy_events_updated_at ON public.economy_events;
CREATE TRIGGER trg_economy_events_updated_at
  BEFORE UPDATE ON public.economy_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_economy_reports_updated_at ON public.economy_reports;
CREATE TRIGGER trg_economy_reports_updated_at
  BEFORE UPDATE ON public.economy_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_economy_rules_updated_at ON public.economy_valuation_rules;
CREATE TRIGGER trg_economy_rules_updated_at
  BEFORE UPDATE ON public.economy_valuation_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.economy_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economy_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economy_valuation_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.economy_baselines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.economy_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.economy_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.economy_valuation_rules FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'economy_baselines',
    'economy_events',
    'economy_reports',
    'economy_valuation_rules'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_own_org ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select_own_org ON public.%I FOR SELECT TO authenticated USING (organization_id = public.user_org() AND deleted_at IS NULL)',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_insert_with_role ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_insert_with_role ON public.%I FOR INSERT TO authenticated WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid() AND public.has_role(ARRAY[''engenheiro'',''planejador'',''comprador'',''gerente'',''diretor'',''owner'']::public.user_role[]))',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_update_own_org ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_update_own_org ON public.%I FOR UPDATE TO authenticated USING (organization_id = public.user_org() AND deleted_at IS NULL) WITH CHECK (organization_id = public.user_org())',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_delete_blocked ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_delete_blocked ON public.%I FOR DELETE TO authenticated USING (false)',
      t, t
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.economy_baselines IS 'Baseline semana 0 para provar ROI por obra ou carteira.';
COMMENT ON TABLE public.economy_events IS 'Eventos de economia detectados ou validados a partir dos modulos operacionais.';
COMMENT ON TABLE public.economy_reports IS 'Relatorios mensais de valor entregue e ROI.';
COMMENT ON TABLE public.economy_valuation_rules IS 'Premissas e formulas editaveis para monetizar eventos de economia.';
