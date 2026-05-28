-- Persistencia do Estoque/Almoxarifado por organizacao.

CREATE TABLE IF NOT EXISTS public.suprimentos_depositos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  frente text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.suprimentos_estoque_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deposito_id uuid REFERENCES public.suprimentos_depositos(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  unidade text,
  qtd_disponivel numeric NOT NULL DEFAULT 0,
  qtd_reservada numeric NOT NULL DEFAULT 0,
  qtd_transito numeric NOT NULL DEFAULT 0,
  estoque_minimo numeric NOT NULL DEFAULT 0,
  custo_unitario numeric,
  lps_activity_id text,
  categoria text,
  fornecedor_principal text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.suprimentos_estoque_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.suprimentos_estoque_itens(id) ON DELETE CASCADE,
  deposito_id uuid REFERENCES public.suprimentos_depositos(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida','transferencia','ajuste')),
  quantidade numeric NOT NULL DEFAULT 0,
  data_movimento date NOT NULL DEFAULT current_date,
  data_compra date,
  fornecedor text,
  nf text,
  lead_time_dias integer,
  lps_activity_id text,
  observacoes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sup_dep_org ON public.suprimentos_depositos(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sup_est_itens_org ON public.suprimentos_estoque_itens(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sup_est_itens_deposito ON public.suprimentos_estoque_itens(deposito_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sup_est_mov_org ON public.suprimentos_estoque_movimentacoes(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sup_est_mov_item ON public.suprimentos_estoque_movimentacoes(item_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_suprimentos_depositos_updated_at ON public.suprimentos_depositos;
CREATE TRIGGER trg_suprimentos_depositos_updated_at
  BEFORE UPDATE ON public.suprimentos_depositos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_suprimentos_estoque_itens_updated_at ON public.suprimentos_estoque_itens;
CREATE TRIGGER trg_suprimentos_estoque_itens_updated_at
  BEFORE UPDATE ON public.suprimentos_estoque_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_suprimentos_estoque_movimentacoes_updated_at ON public.suprimentos_estoque_movimentacoes;
CREATE TRIGGER trg_suprimentos_estoque_movimentacoes_updated_at
  BEFORE UPDATE ON public.suprimentos_estoque_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.suprimentos_depositos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suprimentos_estoque_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suprimentos_estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.suprimentos_depositos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.suprimentos_estoque_itens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.suprimentos_estoque_movimentacoes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sup_dep_select_own_org ON public.suprimentos_depositos;
CREATE POLICY sup_dep_select_own_org ON public.suprimentos_depositos
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS sup_dep_insert_with_role ON public.suprimentos_depositos;
CREATE POLICY sup_dep_insert_with_role ON public.suprimentos_depositos
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['comprador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS sup_dep_update_own_org ON public.suprimentos_depositos;
CREATE POLICY sup_dep_update_own_org ON public.suprimentos_depositos
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS sup_dep_delete_blocked ON public.suprimentos_depositos;
CREATE POLICY sup_dep_delete_blocked ON public.suprimentos_depositos
  FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS sup_est_itens_select_own_org ON public.suprimentos_estoque_itens;
CREATE POLICY sup_est_itens_select_own_org ON public.suprimentos_estoque_itens
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS sup_est_itens_insert_with_role ON public.suprimentos_estoque_itens;
CREATE POLICY sup_est_itens_insert_with_role ON public.suprimentos_estoque_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['comprador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS sup_est_itens_update_own_org ON public.suprimentos_estoque_itens;
CREATE POLICY sup_est_itens_update_own_org ON public.suprimentos_estoque_itens
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS sup_est_itens_delete_blocked ON public.suprimentos_estoque_itens;
CREATE POLICY sup_est_itens_delete_blocked ON public.suprimentos_estoque_itens
  FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS sup_est_mov_select_own_org ON public.suprimentos_estoque_movimentacoes;
CREATE POLICY sup_est_mov_select_own_org ON public.suprimentos_estoque_movimentacoes
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS sup_est_mov_insert_with_role ON public.suprimentos_estoque_movimentacoes;
CREATE POLICY sup_est_mov_insert_with_role ON public.suprimentos_estoque_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['comprador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS sup_est_mov_update_own_org ON public.suprimentos_estoque_movimentacoes;
CREATE POLICY sup_est_mov_update_own_org ON public.suprimentos_estoque_movimentacoes
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS sup_est_mov_delete_blocked ON public.suprimentos_estoque_movimentacoes;
CREATE POLICY sup_est_mov_delete_blocked ON public.suprimentos_estoque_movimentacoes
  FOR DELETE TO authenticated USING (false);

COMMENT ON TABLE public.suprimentos_depositos IS 'Depositos/frentes de estoque do modulo Suprimentos.';
COMMENT ON TABLE public.suprimentos_estoque_itens IS 'Itens do estoque/almoxarifado por organizacao.';
COMMENT ON TABLE public.suprimentos_estoque_movimentacoes IS 'Movimentacoes de entrada, saida, transferencia e ajuste do estoque.';
