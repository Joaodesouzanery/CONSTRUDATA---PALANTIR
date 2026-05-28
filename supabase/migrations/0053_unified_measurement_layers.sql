-- 0053_unified_measurement_layers.sql
-- Unified measurement workflow:
-- RDO/import/manual source -> memory lines -> contract items -> financial closing.

ALTER TABLE public.measurement_sources
  DROP CONSTRAINT IF EXISTS measurement_sources_kind_check;

ALTER TABLE public.measurement_sources
  ADD CONSTRAINT measurement_sources_kind_check
  CHECK (
    source_kind IN (
      'rdo',
      'rdo_sabesp',
      'spreadsheet',
      'manual',
      'manual_entry',
      'engineering_adjustment',
      'financial_adjustment',
      'suprimentos',
      'quality_return'
    )
  );

ALTER TABLE public.measurement_sources
  ADD COLUMN IF NOT EXISTS period_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS manual_reason text,
  ADD COLUMN IF NOT EXISTS evidence_url text,
  ADD COLUMN IF NOT EXISTS unit_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS project_id uuid,
  ADD COLUMN IF NOT EXISTS contract_no text,
  ADD COLUMN IF NOT EXISTS local text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS service_order text,
  ADD COLUMN IF NOT EXISTS n_preco text,
  ADD COLUMN IF NOT EXISTS source_workbook_name text,
  ADD COLUMN IF NOT EXISTS source_sheet text,
  ADD COLUMN IF NOT EXISTS source_row integer,
  ADD COLUMN IF NOT EXISTS parse_confidence numeric,
  ADD COLUMN IF NOT EXISTS import_warnings text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS blocking_issues text[] NOT NULL DEFAULT ARRAY[]::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'measurement_sources_status_check'
      AND conrelid = 'public.measurement_sources'::regclass
  ) THEN
    ALTER TABLE public.measurement_sources
      ADD CONSTRAINT measurement_sources_status_check
      CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'glossed', 'blocked'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.measurement_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  period_label text NOT NULL,
  starts_on date,
  ends_on date,
  contract_no text,
  status text NOT NULL DEFAULT 'draft',
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT measurement_periods_status_check CHECK (status IN ('draft', 'in_review', 'closed', 'canceled'))
);

CREATE TABLE IF NOT EXISTS public.measurement_contract_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid,
  period_id uuid REFERENCES public.measurement_periods(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  item_code text,
  n_preco text,
  description text NOT NULL,
  unit text,
  contracted_quantity numeric NOT NULL DEFAULT 0,
  previous_quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  retention_percent numeric NOT NULL DEFAULT 0,
  retention_rule text,
  measurement_rule text,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.measurement_memory_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid,
  period_id uuid REFERENCES public.measurement_periods(id) ON DELETE SET NULL,
  source_id uuid REFERENCES public.measurement_sources(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  rdo_id text,
  rdo_type text,
  contractor_id uuid REFERENCES public.contractors(id) ON DELETE SET NULL,
  contract_item_id uuid REFERENCES public.measurement_contract_items(id) ON DELETE SET NULL,
  n_preco text,
  service_description text NOT NULL,
  unit text,
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  nucleo text,
  location_text text,
  street text,
  number text,
  service_order text,
  croqui text,
  trecho_inicial text,
  trecho_final text,
  pv_pi_estaca_inicial text,
  pv_pi_estaca_final text,
  derivation_type text,
  intra_executada boolean,
  evidence_url text,
  manual_reason text,
  review_status text NOT NULL DEFAULT 'pending_review',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  notes text,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT measurement_memory_lines_rdo_type_check CHECK (rdo_type IS NULL OR rdo_type IN ('regular', 'sabesp')),
  CONSTRAINT measurement_memory_lines_review_status_check CHECK (review_status IN ('draft', 'pending_review', 'approved', 'rejected', 'blocked'))
);

CREATE TABLE IF NOT EXISTS public.measurement_financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid,
  period_id uuid REFERENCES public.measurement_periods(id) ON DELETE SET NULL,
  source_id uuid REFERENCES public.measurement_sources(id) ON DELETE SET NULL,
  contractor_id uuid REFERENCES public.contractors(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  nucleo text,
  entry_type text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  competence text,
  invoice_number text,
  status text NOT NULL DEFAULT 'draft',
  manual_reason text,
  evidence_url text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT measurement_financial_entries_type_check CHECK (
    entry_type IN (
      'retention',
      'discount',
      'rh',
      'machine',
      'vehicle',
      'fuel',
      'material',
      'epi',
      'third_party_service',
      'invoice',
      'advance',
      'previous_closing',
      'other',
      'manual_adjustment'
    )
  ),
  CONSTRAINT measurement_financial_entries_status_check CHECK (status IN ('draft', 'pending_review', 'approved', 'paid', 'glossed', 'blocked'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'measurement_sources_period_fk'
      AND conrelid = 'public.measurement_sources'::regclass
  ) THEN
    ALTER TABLE public.measurement_sources
      ADD CONSTRAINT measurement_sources_period_fk
      FOREIGN KEY (period_id) REFERENCES public.measurement_periods(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.measurement_sources
  ADD COLUMN IF NOT EXISTS contract_item_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'measurement_sources_contract_item_fk'
      AND conrelid = 'public.measurement_sources'::regclass
  ) THEN
    ALTER TABLE public.measurement_sources
      ADD CONSTRAINT measurement_sources_contract_item_fk
      FOREIGN KEY (contract_item_id) REFERENCES public.measurement_contract_items(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_measurement_periods_org_status
  ON public.measurement_periods(organization_id, status, starts_on DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_measurement_contract_items_org_lookup
  ON public.measurement_contract_items(organization_id, n_preco, item_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_measurement_sources_org_operational_key
  ON public.measurement_sources(organization_id, contract_no, nucleo, local, n_preco, source_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_measurement_memory_lines_org_period
  ON public.measurement_memory_lines(organization_id, period_id, contractor_id, nucleo)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_measurement_memory_lines_source
  ON public.measurement_memory_lines(source_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_measurement_financial_entries_org_period
  ON public.measurement_financial_entries(organization_id, period_id, entry_type, contractor_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_measurement_periods_updated_at ON public.measurement_periods;
CREATE TRIGGER trg_measurement_periods_updated_at
  BEFORE UPDATE ON public.measurement_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_measurement_contract_items_updated_at ON public.measurement_contract_items;
CREATE TRIGGER trg_measurement_contract_items_updated_at
  BEFORE UPDATE ON public.measurement_contract_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_measurement_memory_lines_updated_at ON public.measurement_memory_lines;
CREATE TRIGGER trg_measurement_memory_lines_updated_at
  BEFORE UPDATE ON public.measurement_memory_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_measurement_financial_entries_updated_at ON public.measurement_financial_entries;
CREATE TRIGGER trg_measurement_financial_entries_updated_at
  BEFORE UPDATE ON public.measurement_financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.measurement_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_contract_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_memory_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_financial_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.measurement_periods FORCE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_contract_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_memory_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_financial_entries FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'measurement_periods',
    'measurement_contract_items',
    'measurement_memory_lines',
    'measurement_financial_entries'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_own_org ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_select_own_org ON public.%I FOR SELECT TO authenticated USING (organization_id = public.user_org() AND deleted_at IS NULL)',
      table_name,
      table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_insert_with_role ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_insert_with_role ON public.%I FOR INSERT TO authenticated WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid() AND public.has_role(ARRAY[''engenheiro'',''qualidade'',''planejador'',''comprador'',''gerente'',''diretor'',''owner'']::public.user_role[]))',
      table_name,
      table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_update_own_org ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_update_own_org ON public.%I FOR UPDATE TO authenticated USING (organization_id = public.user_org() AND deleted_at IS NULL) WITH CHECK (organization_id = public.user_org())',
      table_name,
      table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_delete_blocked ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_delete_blocked ON public.%I FOR DELETE TO authenticated USING (false)',
      table_name,
      table_name
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.measurement_periods IS 'Monthly measurement periods by organization/project.';
COMMENT ON TABLE public.measurement_contract_items IS 'Contract catalog items that give price, unit and measurement rules to operational quantities.';
COMMENT ON TABLE public.measurement_memory_lines IS 'Auditable calculation memory lines generated from RDOs, imports or manual input.';
COMMENT ON TABLE public.measurement_financial_entries IS 'Financial closing entries: discounts, retention, invoices, RH, equipment, materials and manual adjustments.';
