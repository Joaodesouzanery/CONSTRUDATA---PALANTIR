-- 0044_suprimentos_planilhas.sql
-- Dados operacionais do fluxo Resumo -> Controle -> Compras do modulo Suprimentos.

CREATE TABLE IF NOT EXISTS public.suprimentos_nucleos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text CHECK (tipo IN ('AG','ESG')),

  tr_total numeric NOT NULL DEFAULT 0,
  tr_obra numeric NOT NULL DEFAULT 0,
  tr_cad numeric NOT NULL DEFAULT 0,
  tr_exec numeric NOT NULL DEFAULT 0,
  tr_pend numeric NOT NULL DEFAULT 0,
  km_obra numeric NOT NULL DEFAULT 0,
  km_exec numeric NOT NULL DEFAULT 0,
  km_pend numeric NOT NULL DEFAULT 0,
  km_cad numeric NOT NULL DEFAULT 0,
  km_real numeric NOT NULL DEFAULT 0,
  ratio text,
  pct_exec numeric NOT NULL DEFAULT 0,

  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT suprimentos_nucleos_unique_nome_tipo UNIQUE (organization_id, nome, tipo)
);

CREATE TABLE IF NOT EXISTS public.suprimentos_ruas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nucleo_id uuid NOT NULL REFERENCES public.suprimentos_nucleos(id) ON DELETE CASCADE,
  nome text NOT NULL,

  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT suprimentos_ruas_unique_nome UNIQUE (organization_id, nucleo_id, nome)
);

CREATE TABLE IF NOT EXISTS public.suprimentos_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rua_id uuid NOT NULL REFERENCES public.suprimentos_ruas(id) ON DELETE CASCADE,
  material text NOT NULL,
  unidade text,
  quantidade numeric NOT NULL DEFAULT 0,
  rede text CHECK (rede IN ('AG','ESG')),
  status text NOT NULL DEFAULT 'pend' CHECK (status IN ('exec','pend','cad')),
  km_exec numeric NOT NULL DEFAULT 0,
  km_pend numeric NOT NULL DEFAULT 0,
  auxiliares jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT suprimentos_itens_unique_material UNIQUE (organization_id, rua_id, material, rede, status)
);

CREATE TABLE IF NOT EXISTS public.suprimentos_ordens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','emitida','cancelada')),
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_itens integer NOT NULL DEFAULT 0,

  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT suprimentos_ordens_unique_codigo UNIQUE (organization_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_suprimentos_nucleos_org ON public.suprimentos_nucleos(organization_id);
CREATE INDEX IF NOT EXISTS idx_suprimentos_nucleos_active ON public.suprimentos_nucleos(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suprimentos_ruas_org ON public.suprimentos_ruas(organization_id);
CREATE INDEX IF NOT EXISTS idx_suprimentos_ruas_nucleo ON public.suprimentos_ruas(nucleo_id);
CREATE INDEX IF NOT EXISTS idx_suprimentos_itens_org ON public.suprimentos_itens(organization_id);
CREATE INDEX IF NOT EXISTS idx_suprimentos_itens_rua ON public.suprimentos_itens(rua_id);
CREATE INDEX IF NOT EXISTS idx_suprimentos_itens_status ON public.suprimentos_itens(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_suprimentos_ordens_org ON public.suprimentos_ordens(organization_id);

DROP TRIGGER IF EXISTS trg_suprimentos_nucleos_updated_at ON public.suprimentos_nucleos;
CREATE TRIGGER trg_suprimentos_nucleos_updated_at
  BEFORE UPDATE ON public.suprimentos_nucleos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_suprimentos_ruas_updated_at ON public.suprimentos_ruas;
CREATE TRIGGER trg_suprimentos_ruas_updated_at
  BEFORE UPDATE ON public.suprimentos_ruas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_suprimentos_itens_updated_at ON public.suprimentos_itens;
CREATE TRIGGER trg_suprimentos_itens_updated_at
  BEFORE UPDATE ON public.suprimentos_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_suprimentos_ordens_updated_at ON public.suprimentos_ordens;
CREATE TRIGGER trg_suprimentos_ordens_updated_at
  BEFORE UPDATE ON public.suprimentos_ordens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.suprimentos_nucleos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suprimentos_ruas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suprimentos_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suprimentos_ordens ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.suprimentos_nucleos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.suprimentos_ruas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.suprimentos_itens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.suprimentos_ordens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suprimentos_nucleos_select_own_org ON public.suprimentos_nucleos;
CREATE POLICY suprimentos_nucleos_select_own_org ON public.suprimentos_nucleos
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS suprimentos_nucleos_insert_with_role ON public.suprimentos_nucleos;
CREATE POLICY suprimentos_nucleos_insert_with_role ON public.suprimentos_nucleos
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['comprador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS suprimentos_nucleos_update_own_org ON public.suprimentos_nucleos;
CREATE POLICY suprimentos_nucleos_update_own_org ON public.suprimentos_nucleos
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS suprimentos_ruas_select_own_org ON public.suprimentos_ruas;
CREATE POLICY suprimentos_ruas_select_own_org ON public.suprimentos_ruas
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS suprimentos_ruas_insert_with_role ON public.suprimentos_ruas;
CREATE POLICY suprimentos_ruas_insert_with_role ON public.suprimentos_ruas
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['comprador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS suprimentos_ruas_update_own_org ON public.suprimentos_ruas;
CREATE POLICY suprimentos_ruas_update_own_org ON public.suprimentos_ruas
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS suprimentos_itens_select_own_org ON public.suprimentos_itens;
CREATE POLICY suprimentos_itens_select_own_org ON public.suprimentos_itens
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS suprimentos_itens_insert_with_role ON public.suprimentos_itens;
CREATE POLICY suprimentos_itens_insert_with_role ON public.suprimentos_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['comprador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS suprimentos_itens_update_own_org ON public.suprimentos_itens;
CREATE POLICY suprimentos_itens_update_own_org ON public.suprimentos_itens
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS suprimentos_ordens_select_own_org ON public.suprimentos_ordens;
CREATE POLICY suprimentos_ordens_select_own_org ON public.suprimentos_ordens
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS suprimentos_ordens_insert_with_role ON public.suprimentos_ordens;
CREATE POLICY suprimentos_ordens_insert_with_role ON public.suprimentos_ordens
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['comprador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS suprimentos_ordens_update_own_org ON public.suprimentos_ordens;
CREATE POLICY suprimentos_ordens_update_own_org ON public.suprimentos_ordens
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS suprimentos_planilhas_delete_blocked ON public.suprimentos_nucleos;
CREATE POLICY suprimentos_planilhas_delete_blocked ON public.suprimentos_nucleos
  FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS suprimentos_ruas_delete_blocked ON public.suprimentos_ruas;
CREATE POLICY suprimentos_ruas_delete_blocked ON public.suprimentos_ruas
  FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS suprimentos_itens_delete_blocked ON public.suprimentos_itens;
CREATE POLICY suprimentos_itens_delete_blocked ON public.suprimentos_itens
  FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS suprimentos_ordens_delete_blocked ON public.suprimentos_ordens;
CREATE POLICY suprimentos_ordens_delete_blocked ON public.suprimentos_ordens
  FOR DELETE TO authenticated USING (false);

COMMENT ON TABLE public.suprimentos_nucleos IS 'Nucleos/frentes de Suprimentos importados do Resumo.';
COMMENT ON TABLE public.suprimentos_ruas IS 'Ruas vinculadas aos nucleos de Suprimentos.';
COMMENT ON TABLE public.suprimentos_itens IS 'Itens planejados e materiais pendentes por rua/status.';
COMMENT ON TABLE public.suprimentos_ordens IS 'Ordens de compra geradas a partir dos itens pendentes selecionados.';
