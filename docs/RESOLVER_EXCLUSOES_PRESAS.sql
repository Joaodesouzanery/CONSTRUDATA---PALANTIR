-- ⚠️ Rode o PASSO 1 primeiro (só leitura). O PASSO 2 apaga de verdade.
-- ═══════════════════════════════════════════════════════════════════════════════
-- AS EXCLUSÕES QUE FICARAM PRESAS EM PEDIDO DE APROVAÇÃO
--
-- O `docs/CONFERIR_EXCLUSAO.sql` encontrou 4 pedidos parados desde julho/2026:
--   3× delete_rdo            (rdo)
--   1× delete_master_activity (master_activities)
--
-- O que aconteceu: você mandou apagar, o app criou um pedido em `pending_actions` em vez de
-- apagar, e o pedido ficou esperando aprovação — numa tela sem link em menu nenhum, e que o
-- próprio autor não pode aprovar. **Os registros continuam lá.** O fluxo de aprovação foi
-- removido do app em 24/08/2026, então esses pedidos nunca vão ser processados.
--
-- Este script mostra QUAIS são os registros e, se você confirmar, apaga de verdade.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── PASSO 1 · O QUE SÃO ESSES REGISTROS (só leitura) ──────────────────────────
select
  '1. RDOs que você mandou apagar'          as bloco,
  pa.created_at::date                        as voce_pediu_em,
  r.id,
  r.data                                     as data_do_rdo,
  coalesce(s.name, '(obra não vinculada)')   as obra,
  case when r.deleted_at is null then '⚠️ AINDA EXISTE' else 'já apagado' end as situacao
from public.pending_actions pa
join public.rdo r on r.id = pa.target_id
left join public.construction_sites s on s.id = r.site_id
where pa.status = 'pending' and pa.target_table = 'rdo'
order by pa.created_at;

select
  '2. Atividades do planejamento'            as bloco,
  pa.created_at::date                        as voce_pediu_em,
  ma.id,
  ma.name                                    as atividade,
  case when ma.deleted_at is null then '⚠️ AINDA EXISTE' else 'já apagada' end as situacao
from public.pending_actions pa
join public.master_activities ma on ma.id = pa.target_id
where pa.status = 'pending' and pa.target_table = 'master_activities'
order by pa.created_at;


-- ── PASSO 2 · APAGAR DE VERDADE ───────────────────────────────────────────────
-- Só rode depois de olhar o PASSO 1 e confirmar que é isso mesmo que você quer apagar.
-- Descomente o bloco inteiro (tire o /* e o */).
--
-- Isto faz o soft delete que o app tentou fazer em julho, e marca os pedidos como
-- resolvidos para eles sumirem do diagnóstico.
/*
begin;

update public.rdo r
   set deleted_at = now()
  from public.pending_actions pa
 where pa.status = 'pending' and pa.target_table = 'rdo'
   and r.id = pa.target_id and r.deleted_at is null;

update public.master_activities ma
   set deleted_at = now()
  from public.pending_actions pa
 where pa.status = 'pending' and pa.target_table = 'master_activities'
   and ma.id = pa.target_id and ma.deleted_at is null;

update public.pending_actions
   set status = 'approved'
 where status = 'pending';

-- Confere antes de confirmar. Se algo estiver errado, rode ROLLBACK em vez de COMMIT.
select 'pedidos ainda pendentes' as conferencia, count(*) from public.pending_actions where status = 'pending';

commit;
*/


-- ── Se você NÃO quer mais apagar esses registros ──────────────────────────────
-- Basta descartar os pedidos: eles não fazem nada, só poluem o diagnóstico.
/*
update public.pending_actions set status = 'rejected' where status = 'pending';
*/
