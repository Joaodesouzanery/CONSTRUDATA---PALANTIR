-- 0045_contractors_rdo_measurement.sql
-- Contractors, foreman links, RDO measurement sources and contractor invoices.

CREATE TABLE IF NOT EXISTS public.contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  legal_name text,
  cnpj text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT contractors_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS public.contractor_foremen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  normalized_name text NOT NULL,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.rdo_contractor_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  rdo_id text NOT NULL,
  rdo_type text NOT NULL,
  contractor_id uuid REFERENCES public.contractors(id) ON DELETE SET NULL,
  foreman_name text,
  normalized_foreman_name text,
  source text NOT NULL DEFAULT 'auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rdo_contractor_links_type_check CHECK (rdo_type IN ('regular', 'sabesp')),
  CONSTRAINT rdo_contractor_links_source_check CHECK (source IN ('auto', 'manual'))
);

CREATE TABLE IF NOT EXISTS public.measurement_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  measurement_id uuid,
  rdo_id text,
  rdo_type text,
  contractor_id uuid REFERENCES public.contractors(id) ON DELETE SET NULL,
  nucleo text,
  source_kind text NOT NULL DEFAULT 'rdo_sabesp',
  service_code text,
  service_description text NOT NULL,
  unit text,
  quantity numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  origin_label text NOT NULL DEFAULT 'RDO Sabesp',
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT measurement_sources_rdo_type_check CHECK (rdo_type IS NULL OR rdo_type IN ('regular', 'sabesp')),
  CONSTRAINT measurement_sources_kind_check CHECK (source_kind IN ('rdo', 'rdo_sabesp', 'spreadsheet', 'manual'))
);

CREATE TABLE IF NOT EXISTS public.measurement_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  contractor_id uuid REFERENCES public.contractors(id) ON DELETE SET NULL,
  nucleo text,
  kind text NOT NULL,
  description text NOT NULL,
  unit text,
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  source_id uuid REFERENCES public.measurement_sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT measurement_adjustments_kind_check CHECK (kind IN ('extra', 'discount', 'manual_adjustment'))
);

CREATE TABLE IF NOT EXISTS public.contractor_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  nucleo text,
  invoice_number text,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  issue_date date,
  payment_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT contractor_invoices_status_check CHECK (status IN ('pendente', 'enviada', 'aprovada', 'paga', 'glosada'))
);

CREATE TABLE IF NOT EXISTS public.contractor_invoice_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.contractor_invoices(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL,
  amount numeric,
  event_date date NOT NULL DEFAULT current_date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contractor_invoice_events_status_check CHECK (status IN ('pendente', 'enviada', 'aprovada', 'paga', 'glosada'))
);

CREATE INDEX IF NOT EXISTS idx_contractors_org_active ON public.contractors(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contractor_foremen_org_name ON public.contractor_foremen(organization_id, normalized_name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_contractor_foremen_org_name_active
  ON public.contractor_foremen(organization_id, normalized_name)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_rdo_contractor_links_org_rdo
  ON public.rdo_contractor_links(organization_id, rdo_type, rdo_id);
CREATE INDEX IF NOT EXISTS idx_measurement_sources_org_filters ON public.measurement_sources(organization_id, nucleo, contractor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_measurement_adjustments_org_filters ON public.measurement_adjustments(organization_id, nucleo, contractor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contractor_invoices_org_status ON public.contractor_invoices(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contractor_invoice_events_invoice ON public.contractor_invoice_events(invoice_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_contractors_updated_at ON public.contractors;
CREATE TRIGGER trg_contractors_updated_at BEFORE UPDATE ON public.contractors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_contractor_foremen_updated_at ON public.contractor_foremen;
CREATE TRIGGER trg_contractor_foremen_updated_at BEFORE UPDATE ON public.contractor_foremen
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_rdo_contractor_links_updated_at ON public.rdo_contractor_links;
CREATE TRIGGER trg_rdo_contractor_links_updated_at BEFORE UPDATE ON public.rdo_contractor_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_measurement_sources_updated_at ON public.measurement_sources;
CREATE TRIGGER trg_measurement_sources_updated_at BEFORE UPDATE ON public.measurement_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_measurement_adjustments_updated_at ON public.measurement_adjustments;
CREATE TRIGGER trg_measurement_adjustments_updated_at BEFORE UPDATE ON public.measurement_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_contractor_invoices_updated_at ON public.contractor_invoices;
CREATE TRIGGER trg_contractor_invoices_updated_at BEFORE UPDATE ON public.contractor_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_foremen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_contractor_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_invoice_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.contractors FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_foremen FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_contractor_links FORCE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_adjustments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_invoice_events FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'contractors',
    'contractor_foremen',
    'rdo_contractor_links',
    'measurement_sources',
    'measurement_adjustments',
    'contractor_invoices',
    'contractor_invoice_events'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_own_org ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_select_own_org ON public.%I FOR SELECT TO authenticated USING (organization_id = public.user_org() %s)',
      table_name,
      table_name,
      CASE WHEN table_name = 'rdo_contractor_links' OR table_name = 'contractor_invoice_events' THEN '' ELSE 'AND deleted_at IS NULL' END
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_insert_with_role ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_insert_with_role ON public.%I FOR INSERT TO authenticated WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid() AND public.has_role(ARRAY[''engenheiro'',''qualidade'',''gerente'',''diretor'',''owner'']::public.user_role[]))',
      table_name,
      table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_update_own_org ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_update_own_org ON public.%I FOR UPDATE TO authenticated USING (organization_id = public.user_org()) WITH CHECK (organization_id = public.user_org())',
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

COMMENT ON TABLE public.contractors IS 'Contractors/subcontractors used to tag RDOs and split measurements.';
COMMENT ON TABLE public.contractor_foremen IS 'Foreman names mapped to contractors for automatic RDO attribution.';
COMMENT ON TABLE public.rdo_contractor_links IS 'Manual or automatic link between an RDO and a contractor.';
COMMENT ON TABLE public.measurement_sources IS 'Auditable measurement rows generated from RDOs or imports.';
COMMENT ON TABLE public.measurement_adjustments IS 'Manual extras, discounts and adjustments for contractor measurement.';
COMMENT ON TABLE public.contractor_invoices IS 'Contractor invoice/payment control.';
COMMENT ON TABLE public.contractor_invoice_events IS 'Invoice status/event history.';
