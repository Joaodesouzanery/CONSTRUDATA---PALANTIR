-- 0042_quality_non_conformities.sql
-- Entidade própria para Registro de Não Conformidade no módulo Qualidade.

CREATE TABLE IF NOT EXISTS public.quality_non_conformities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  number          integer NOT NULL,
  nc_number       text NOT NULL,
  date            date NOT NULL,
  location        text,
  status          text NOT NULL DEFAULT 'aberta'
                    CHECK (status IN ('aberta', 'em_tratamento', 'concluida', 'ineficaz')),
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT quality_nc_unique_number_per_org UNIQUE (organization_id, number)
);

CREATE INDEX IF NOT EXISTS idx_quality_nc_org
  ON public.quality_non_conformities(organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_nc_org_date
  ON public.quality_non_conformities(organization_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_quality_nc_org_status
  ON public.quality_non_conformities(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_quality_nc_org_active
  ON public.quality_non_conformities(organization_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_quality_nc_updated_at ON public.quality_non_conformities;
CREATE TRIGGER trg_quality_nc_updated_at
  BEFORE UPDATE ON public.quality_non_conformities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.quality_non_conformities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_non_conformities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quality_nc_select_own_org ON public.quality_non_conformities;
CREATE POLICY quality_nc_select_own_org ON public.quality_non_conformities
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS quality_nc_insert_with_role ON public.quality_non_conformities;
CREATE POLICY quality_nc_insert_with_role ON public.quality_non_conformities
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS quality_nc_update_author_or_manager ON public.quality_non_conformities;
CREATE POLICY quality_nc_update_author_or_manager ON public.quality_non_conformities
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND (
      created_by = auth.uid()
      OR public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[])
    )
  )
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS quality_nc_delete_blocked ON public.quality_non_conformities;
CREATE POLICY quality_nc_delete_blocked ON public.quality_non_conformities
  FOR DELETE TO authenticated
  USING (false);

COMMENT ON TABLE public.quality_non_conformities IS
  'Registros FOR-Q-01 / Registro de Não Conformidade do módulo Qualidade.';
