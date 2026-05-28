-- 0013_rdo.sql
-- Tabela do módulo RDO (Relatório Diário de Obras).
-- Padrão: campos planos para o que é consultado/filtrado, payload jsonb para o resto.

CREATE TABLE IF NOT EXISTS public.rdo (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Numeração sequencial por organização (cliente calcula via max+1)
  number               integer       NOT NULL,

  -- Campos planos consultáveis
  date                 date          NOT NULL,
  responsible          text,
  project_id           text,                         -- ref textual a projetos.id (free-form v1)
  contract_no          text,
  service_order_no     text,

  -- Payload denormalizado: weather, manpower, equipment[], services[],
  -- trechos[], photos[], geolocation, observations, incidents, contract fields
  payload              jsonb         NOT NULL DEFAULT '{}'::jsonb,

  -- Estado
  closed               boolean       NOT NULL DEFAULT false,

  -- Auditoria padrão
  created_by           uuid          NOT NULL REFERENCES auth.users(id),
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now(),
  deleted_at           timestamptz,

  CONSTRAINT rdo_unique_number_per_org UNIQUE (organization_id, number)
);

-- Indexes obrigatórios para multi-tenant performance
CREATE INDEX IF NOT EXISTS idx_rdo_org           ON public.rdo(organization_id);
CREATE INDEX IF NOT EXISTS idx_rdo_org_date      ON public.rdo(organization_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_rdo_org_active    ON public.rdo(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rdo_org_project   ON public.rdo(organization_id, project_id);

-- Trigger updated_at (reutiliza public.set_updated_at criada no Sprint 1)
DROP TRIGGER IF EXISTS trg_rdo_updated_at ON public.rdo;
CREATE TRIGGER trg_rdo_updated_at
  BEFORE UPDATE ON public.rdo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.rdo IS
  'Relatórios Diários de Obra. payload jsonb contém weather, manpower, equipment, services, trechos, photos, etc.';
