-- Permite confirmar UPDATE/soft delete via PostgREST returning.
-- O frontend continua filtrando deleted_at IS NULL no pullTable(activeOnly).

DROP POLICY IF EXISTS sup_dep_select_own_org ON public.suprimentos_depositos;
CREATE POLICY sup_dep_select_own_org ON public.suprimentos_depositos
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org());

DROP POLICY IF EXISTS sup_est_itens_select_own_org ON public.suprimentos_estoque_itens;
CREATE POLICY sup_est_itens_select_own_org ON public.suprimentos_estoque_itens
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org());

DROP POLICY IF EXISTS sup_est_mov_select_own_org ON public.suprimentos_estoque_movimentacoes;
CREATE POLICY sup_est_mov_select_own_org ON public.suprimentos_estoque_movimentacoes
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org());
