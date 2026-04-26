-- 0041_rdo_sabesp.sql
-- Modulo RDO Sabesp (Consorcio Se Liga Na Rede).
-- Consolida as migrations do pacote export-rdo-sabesp e adapta para o modelo multi-tenant atual.

CREATE TABLE IF NOT EXISTS public.rdo_sabesp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),

  report_date date NOT NULL,
  encarregado text,
  rua_beco text,
  criadouro text,
  criadouro_outro text,
  epi_utilizado boolean,

  condicoes_climaticas jsonb NOT NULL DEFAULT '{}'::jsonb,
  qualidade jsonb NOT NULL DEFAULT '{}'::jsonb,
  paralisacoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  paralisacao_outro text,
  horarios jsonb NOT NULL DEFAULT '{}'::jsonb,
  mao_de_obra jsonb NOT NULL DEFAULT '[]'::jsonb,
  equipamentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  servicos_esgoto jsonb NOT NULL DEFAULT '[]'::jsonb,
  servicos_agua jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacoes text,

  planilha_foto_url text,
  whatsapp_text text,
  photo_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  assinatura_empreiteira_url text,
  assinatura_consorcio_url text,
  responsavel_empreiteira text,
  responsavel_consorcio text,

  status text NOT NULL DEFAULT 'draft',
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT rdo_sabesp_status_check CHECK (status IN ('draft', 'finalized'))
);

CREATE INDEX IF NOT EXISTS idx_rdo_sabesp_org ON public.rdo_sabesp(organization_id);
CREATE INDEX IF NOT EXISTS idx_rdo_sabesp_org_date ON public.rdo_sabesp(organization_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_rdo_sabesp_org_active ON public.rdo_sabesp(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rdo_sabesp_project ON public.rdo_sabesp(project_id);
CREATE INDEX IF NOT EXISTS idx_rdo_sabesp_status ON public.rdo_sabesp(status);

DROP TRIGGER IF EXISTS trg_rdo_sabesp_updated_at ON public.rdo_sabesp;
CREATE TRIGGER trg_rdo_sabesp_updated_at
  BEFORE UPDATE ON public.rdo_sabesp
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.rdo_sabesp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_sabesp FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rdo_sabesp_select_own_org ON public.rdo_sabesp;
CREATE POLICY rdo_sabesp_select_own_org ON public.rdo_sabesp
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS rdo_sabesp_insert_with_role ON public.rdo_sabesp;
CREATE POLICY rdo_sabesp_insert_with_role ON public.rdo_sabesp
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS rdo_sabesp_update_author_or_manager ON public.rdo_sabesp;
CREATE POLICY rdo_sabesp_update_author_or_manager ON public.rdo_sabesp
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND (
      created_by = auth.uid()
      OR public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[])
    )
  )
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS rdo_sabesp_delete_blocked ON public.rdo_sabesp;
CREATE POLICY rdo_sabesp_delete_blocked ON public.rdo_sabesp
  FOR DELETE TO authenticated USING (false);

INSERT INTO storage.buckets (id, name, public)
VALUES ('rdo-sabesp-photos', 'rdo-sabesp-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS rdo_sabesp_photos_select_own_org ON storage.objects;
CREATE POLICY rdo_sabesp_photos_select_own_org ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rdo-sabesp-photos'
    AND split_part(name, '/', 1)::uuid = public.user_org()
  );

DROP POLICY IF EXISTS rdo_sabesp_photos_insert_own_org ON storage.objects;
CREATE POLICY rdo_sabesp_photos_insert_own_org ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rdo-sabesp-photos'
    AND split_part(name, '/', 1)::uuid = public.user_org()
  );

DROP POLICY IF EXISTS rdo_sabesp_photos_delete_own_org ON storage.objects;
CREATE POLICY rdo_sabesp_photos_delete_own_org ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'rdo-sabesp-photos'
    AND split_part(name, '/', 1)::uuid = public.user_org()
  );

COMMENT ON TABLE public.rdo_sabesp IS
  'RDO Sabesp/CSLNR. Dados estruturados da planilha padrao, fotos privadas no bucket rdo-sabesp-photos.';
