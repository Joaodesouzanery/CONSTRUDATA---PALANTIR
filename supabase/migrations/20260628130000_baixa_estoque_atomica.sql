-- 20260628130000_baixa_estoque_atomica.sql
-- Tier 1b: baixa de estoque MANUAL atômica no servidor (evita last-write-wins).
-- Antes: o cliente lia qtd_disponivel, calculava o novo saldo e mandava o valor absoluto —
-- dois usuários baixando o mesmo item ao mesmo tempo perdiam uma baixa.
-- Agora: subtração atômica no servidor (qtd_disponivel = qtd_disponivel - p_qtd) + movimentação.
-- (O caminho do RDO já era atômico via trigger sync_rdo_to_estoque.)
-- Idempotente. ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.baixar_estoque_item(
  p_item_id         uuid,
  p_qtd             numeric,
  p_lps_activity_id text DEFAULT NULL,
  p_observacoes     text DEFAULT NULL,
  p_site_id         uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org      uuid := public.user_org();
  v_uid      uuid := auth.uid();
  v_deposito uuid;
  v_new      numeric;
BEGIN
  IF p_qtd IS NULL OR p_qtd <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida (deve ser > 0)';
  END IF;

  -- Subtração atômica. Sem clamp em 0: saldo negativo é alerta de inventário
  -- (o material já saiu fisicamente), tratado na UI — não bloqueia a baixa.
  UPDATE public.suprimentos_estoque_itens
     SET qtd_disponivel = qtd_disponivel - p_qtd,
         updated_at = now()
   WHERE id = p_item_id
     AND organization_id = v_org
     AND deleted_at IS NULL
   RETURNING qtd_disponivel, deposito_id INTO v_new, v_deposito;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de estoque não encontrado na sua organização';
  END IF;

  INSERT INTO public.suprimentos_estoque_movimentacoes
    (organization_id, item_id, deposito_id, tipo, quantidade, data_movimento,
     lps_activity_id, observacoes, origem, site_id, created_by)
  VALUES
    (v_org, p_item_id, v_deposito, 'saida', p_qtd, current_date,
     p_lps_activity_id, p_observacoes, 'manual', p_site_id, v_uid);

  RETURN jsonb_build_object('qtd_disponivel', v_new, 'deposito_id', v_deposito);
END;
$$;

-- FORCE RLS está ligado em suprimentos_estoque_movimentacoes; a função SECURITY DEFINER
-- ainda passa pelas policies com o contexto do chamador. Política de INSERT para origem='manual'
-- (espelha sup_est_mov_insert_rdo) — permite a baixa sem depender de papel de compras.
DROP POLICY IF EXISTS sup_est_mov_insert_manual ON public.suprimentos_estoque_movimentacoes;
CREATE POLICY sup_est_mov_insert_manual ON public.suprimentos_estoque_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND origem = 'manual'
    AND created_by = auth.uid()
  );

REVOKE ALL  ON FUNCTION public.baixar_estoque_item(uuid, numeric, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.baixar_estoque_item(uuid, numeric, text, text, uuid) TO authenticated;
