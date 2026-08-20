-- 20260822120000_estoque_ficha_de_retirada.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- A FICHA DE RETIRADA DE MATERIAL, EM COLUNAS
--
-- No almoxarifado a retirada é registrada num formulário de papel com oito campos:
--
--     Data · Hora · Colaborador · Obra · Material · Qtd. · Entregue por · Assinatura
--
-- Do lado do sistema existiam quatro: data (sem hora), obra, material e quantidade.
-- **Quem retirou não existia em lugar nenhum.** O `created_by` é o usuário logado — o
-- almoxarife que digitou —, não a pessoa que levou o material. Sem isso não há como responder
-- "quem retirou, quanto e quando", que é o motivo de a ficha de papel existir.
--
-- Quatro colunas, todas opcionais, todas idempotentes:
--
--   retirado_por     quem levou o material (texto: a empresa usa uma conta só, e amarrar isto a
--                    `auth.users` obrigaria a cadastrar cada colaborador como usuário)
--   entregue_por     quem entregou, o outro lado da assinatura
--   hora_movimento   a hora do dia; `data_movimento` é `date` e perde essa informação, que é o
--                    que separa duas retiradas do mesmo item no mesmo dia
--   custo_unitario   o custo NO MOMENTO da movimentação
--
-- A última é a mais importante e a menos óbvia. Hoje o valor de uma saída é calculado com o
-- `custo_unitario` ATUAL do item: mudar o preço de um produto reescreve, retroativamente, o valor
-- de todo o histórico de consumo dele. Nenhum relatório de custo de material fecha duas vezes
-- seguidas, e não existe CMV possível. Congelar o custo na linha da movimentação resolve.
--
-- Nada aqui é obrigatório, então movimentações antigas continuam válidas — só ficam sem o dado,
-- que é a verdade: ninguém registrou.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.suprimentos_estoque_movimentacoes
  add column if not exists retirado_por    text,
  add column if not exists entregue_por    text,
  add column if not exists hora_movimento  time,
  add column if not exists custo_unitario  numeric;

comment on column public.suprimentos_estoque_movimentacoes.retirado_por is
  'Quem levou o material (ficha de retirada). Texto livre: a empresa opera com uma conta só.';
comment on column public.suprimentos_estoque_movimentacoes.entregue_por is
  'Quem entregou o material (ficha de retirada).';
comment on column public.suprimentos_estoque_movimentacoes.hora_movimento is
  'Hora da retirada. data_movimento e date e nao guarda a hora.';
comment on column public.suprimentos_estoque_movimentacoes.custo_unitario is
  'Custo unitario congelado no momento da movimentacao. Sem ele, mudar o preco do item reescreve o valor de todo o historico.';

-- O extrato de retiradas é sempre "as últimas N desta obra", em ordem de data. Sem índice isso é
-- varredura na tabela inteira, que cresce todo dia.
create index if not exists idx_sup_est_mov_org_data
  on public.suprimentos_estoque_movimentacoes(organization_id, data_movimento desc)
  where deleted_at is null;

-- ── Conferência ─────────────────────────────────────────────────────────────────
select
  case when count(*) = 4 then '  OK  ' else '❌ FALTA(M) ' || (4 - count(*))::text end as situacao,
  'suprimentos_estoque_movimentacoes: ficha de retirada' as item
from information_schema.columns
where table_schema = 'public'
  and table_name = 'suprimentos_estoque_movimentacoes'
  and column_name in ('retirado_por', 'entregue_por', 'hora_movimento', 'custo_unitario');

-- ═══════════════════════════════════════════════════════════════════════════════
-- A BAIXA ATÔMICA PASSA A GRAVAR A FICHA
--
-- `baixar_estoque_item` monta a linha da movimentação DENTRO do servidor — é ela que garante que
-- a subtração do saldo e o registro da saída aconteçam juntos. Os campos novos não chegariam lá
-- por um UPDATE do cliente depois: seriam duas operações, e a segunda pode falhar.
--
-- O `custo_unitario` não vem do cliente de propósito: é lido do próprio item, na mesma instrução
-- que desconta o saldo. O cliente poderia mandar um valor desatualizado (ou errado), e o ponto
-- desta coluna é justamente ser a verdade do momento.
--
-- Vai junto um defeito antigo do mesmo caminho: `data_movimento` era `current_date`, a data do
-- SERVIDOR. O Supabase roda em UTC, então toda retirada feita depois das 21h no Brasil era gravada
-- com a data do dia seguinte — some do relatório de hoje e aparece num dia em que o almoxarifado
-- estava fechado. É o mesmo motivo de o app ter `hojeLocalISO()`. Agora a data e a hora vêm do
-- navegador de quem registra, com o servidor só como último recurso.
--
-- A assinatura antiga é REMOVIDA em vez de conviver com a nova. Duas funções de mesmo nome fazem
-- o PostgREST ter de escolher entre elas, e a escolha depende de quais argumentos vêm na chamada —
-- é a receita de "funciona no meu teste e falha em produção". O cliente chama por nome de
-- parâmetro, então a troca é transparente.
-- ═══════════════════════════════════════════════════════════════════════════════

drop function if exists public.baixar_estoque_item(uuid, numeric, text, text, uuid);
drop function if exists public.baixar_estoque_item(uuid, numeric, text, text, uuid, text, text, time);

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

-- ── Conferência da função ───────────────────────────────────────────────────────
select
  case when count(*) = 1 then '  OK  ' else '❌ ' || count(*)::text || ' versoes' end as situacao,
  'baixar_estoque_item (uma unica assinatura)' as item
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'baixar_estoque_item';
