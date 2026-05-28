-- Persist legacy-expanded measurement boletins while the normalized unified
-- measurement tables mature. Each row is still tenant/environment scoped.

CREATE TABLE IF NOT EXISTS public.measurement_billing_boletins (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'production',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  periodo text NOT NULL,
  contrato text,
  consorcio text,
  status text NOT NULL DEFAULT 'rascunho',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT measurement_billing_boletins_status_check
    CHECK (status IN ('rascunho', 'em_conferencia', 'finalizado')),
  CONSTRAINT measurement_billing_boletins_environment_check
    CHECK (environment IN ('production', 'homologation', 'demo'))
);

CREATE INDEX IF NOT EXISTS idx_measurement_billing_boletins_org_period
  ON public.measurement_billing_boletins(organization_id, environment, periodo, updated_at DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_measurement_billing_boletins_updated_at ON public.measurement_billing_boletins;
CREATE TRIGGER trg_measurement_billing_boletins_updated_at
  BEFORE UPDATE ON public.measurement_billing_boletins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.measurement_billing_boletins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_billing_boletins FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS measurement_billing_boletins_select_own_org ON public.measurement_billing_boletins;
CREATE POLICY measurement_billing_boletins_select_own_org
  ON public.measurement_billing_boletins
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS measurement_billing_boletins_insert_with_role ON public.measurement_billing_boletins;
CREATE POLICY measurement_billing_boletins_insert_with_role
  ON public.measurement_billing_boletins
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','planejador','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS measurement_billing_boletins_update_own_org ON public.measurement_billing_boletins;
CREATE POLICY measurement_billing_boletins_update_own_org
  ON public.measurement_billing_boletins
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS measurement_billing_boletins_delete_blocked ON public.measurement_billing_boletins;
CREATE POLICY measurement_billing_boletins_delete_blocked
  ON public.measurement_billing_boletins
  FOR DELETE TO authenticated
  USING (false);

COMMENT ON TABLE public.measurement_billing_boletins IS
  'Persisted legacy-expanded measurement boletins by organization and environment.';
