-- 0010_qualidade.sql
-- Tabela do módulo Qualidade (FVS - Ficha de Verificação de Serviço).
-- v1 desnormalizado: items + problems vão dentro de payload jsonb.
-- v2 quando precisar de query: extrair para fvs_items / fvs_problems / non_conformities.

CREATE TABLE IF NOT EXISTS public.fvs (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Numeração sequencial por organização (calculada na app via max+1; v2: trigger)
  number               integer       NOT NULL,

  document_code        text          NOT NULL,         -- "FOR-FVS-02"
  revision             text          NOT NULL DEFAULT '00',
  identification_no    text,
  contract_no          text          NOT NULL,
  date                 date          NOT NULL,

  nc_required          boolean       NOT NULL DEFAULT false,
  nc_number            text,

  responsible_leader   text,
  weld_tracking_no     text,
  welder_signature     text,
  quality_signature    text,
  logo_id              text,

  -- payload: { items: FvsItem[], problems: FvsProblemAction[] }
  payload              jsonb         NOT NULL DEFAULT '{}'::jsonb,

  closed               boolean       NOT NULL DEFAULT false,  -- true após assinatura final

  created_by           uuid          NOT NULL REFERENCES auth.users(id),
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now(),
  deleted_at           timestamptz,

  CONSTRAINT fvs_unique_number_per_org UNIQUE (organization_id, number)
);

-- Indexes obrigatórios para multi-tenant performance (10k orgs)
CREATE INDEX IF NOT EXISTS idx_fvs_org           ON public.fvs(organization_id);
CREATE INDEX IF NOT EXISTS idx_fvs_org_created   ON public.fvs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fvs_org_active    ON public.fvs(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fvs_org_contract  ON public.fvs(organization_id, contract_no);

DROP TRIGGER IF EXISTS trg_fvs_updated_at ON public.fvs;
CREATE TRIGGER trg_fvs_updated_at
  BEFORE UPDATE ON public.fvs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.fvs IS
  'Fichas de Verificação de Serviço. payload jsonb contém items e problemas (denormalizado v1).';
