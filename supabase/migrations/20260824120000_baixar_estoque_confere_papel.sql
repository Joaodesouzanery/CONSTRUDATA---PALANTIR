-- 20260824120000_baixar_estoque_confere_papel.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- A BAIXA DE ESTOQUE PASSA A CONFERIR O PAPEL
--
-- `baixar_estoque_item` é `SECURITY DEFINER`: ela roda com os poderes do dono da função, não os de
-- quem chamou. Isso é proposital — é o que permite fazer a subtração do saldo e o registro da saída
-- numa transação só, sem depender de duas policies concordarem.
--
-- O efeito colateral é que ela **pula a RLS de escrita**. E a policy que ela pula é justamente a
-- `sup_est_mov_insert_with_role`, que exige comprador/engenheiro/gerente/diretor/owner. Resultado:
-- um `visualizador` — o papel criado para só olhar — conseguia dar baixa no estoque pela ficha de
-- retirada, enquanto o mesmo `visualizador` seria barrado ao inserir a movimentação diretamente.
-- O caminho "seguro" ficou mais permissivo que o caminho comum.
--
-- Não foi um descuido da migration original: naquele momento a função não gravava `retirado_por`
-- nem custo, e a baixa manual era um caminho de exceção. Depois que a ficha de retirada virou a
-- porta principal, a brecha passou a valer alguma coisa. A culpa é da migration de 22/08, que
-- reescreveu a função e manteve o buraco.
--
-- A checagem é a MESMA lista da policy que ela contorna — nem mais rígida, nem mais frouxa.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public.baixar_estoque_item(
  p_item_id         uuid,
  p_qtd             numeric,
  p_lps_activity_id text DEFAULT NULL,
  p_observacoes     text DEFAULT NULL,
  p_site_id         uuid DEFAULT NULL,
  p_retirado_por    text DEFAULT NULL,
  p_entregue_por    text DEFAULT NULL,
  p_hora            time DEFAULT NULL,
  p_data            date DEFAULT NULL
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
  v_custo    numeric;
BEGIN
  IF p_qtd IS NULL OR p_qtd <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida (deve ser > 0)';
  END IF;

  -- A mesma exigência de `sup_est_mov_insert_with_role`. Sem isto, o SECURITY DEFINER faz a função
  -- contornar a única regra que protege a movimentação de estoque.
  IF NOT public.has_role(ARRAY['comprador','engenheiro','gerente','diretor','owner']::public.user_role[]) THEN
    RAISE EXCEPTION 'Seu perfil não tem permissão para dar baixa no estoque'
      USING ERRCODE = '42501';
  END IF;

  -- Subtração atômica. Sem clamp em 0: saldo negativo é alerta de inventário
  -- (o material já saiu fisicamente), tratado na UI — não bloqueia a baixa.
  UPDATE public.suprimentos_estoque_itens
     SET qtd_disponivel = qtd_disponivel - p_qtd,
         updated_at = now()
   WHERE id = p_item_id
     AND organization_id = v_org
     AND deleted_at IS NULL
   RETURNING qtd_disponivel, deposito_id, custo_unitario INTO v_new, v_deposito, v_custo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de estoque não encontrado na sua organização';
  END IF;

  INSERT INTO public.suprimentos_estoque_movimentacoes
    (organization_id, item_id, deposito_id, tipo, quantidade, data_movimento, hora_movimento,
     lps_activity_id, observacoes, origem, site_id, retirado_por, entregue_por, custo_unitario,
     created_by)
  VALUES
    (v_org, p_item_id, v_deposito, 'saida', p_qtd, coalesce(p_data, current_date), coalesce(p_hora, localtime),
     p_lps_activity_id, p_observacoes, 'manual', p_site_id, p_retirado_por, p_entregue_por, v_custo,
     v_uid);

  RETURN jsonb_build_object('qtd_disponivel', v_new, 'deposito_id', v_deposito);
END;
$$;

REVOKE ALL  ON FUNCTION public.baixar_estoque_item(uuid, numeric, text, text, uuid, text, text, time, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.baixar_estoque_item(uuid, numeric, text, text, uuid, text, text, time, date) TO authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────────
select
  case when count(*) = 1 then '  OK  ' else '❌ ' || count(*)::text || ' versoes' end as situacao,
  'baixar_estoque_item (uma assinatura, com checagem de papel)' as item
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'baixar_estoque_item'
  and pg_get_functiondef(p.oid) like '%has_role%';
