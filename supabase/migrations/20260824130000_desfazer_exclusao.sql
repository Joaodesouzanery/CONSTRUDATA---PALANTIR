-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção)
-- ═══════════════════════════════════════════════════════════════════════════════
-- SOFT DELETE QUE FUNCIONA + DESFAZER EXCLUSÃO
--
-- POR QUE: o cliente foi direto — "se eu decidi apagar algo, eu quero apagar e pronto,
-- podendo desfazer". Hoje NADA no app consegue desfazer uma exclusão: toda policy de
-- UPDATE tem `deleted_at IS NULL` no USING, então uma linha já apagada não casa com regra
-- nenhuma e é impossível zerar o `deleted_at` a partir do cliente.
--
-- POR QUE UMA FUNÇÃO EM VEZ DE MEXER NAS POLICIES: relaxar o USING de ~40 tabelas para
-- aceitar linha excluída abriria UPDATE geral em registro apagado — o contrário do que a
-- policy existe para impedir. E `WITH CHECK` valida a linha NOVA, não o que mudou: ele
-- impediria terminar com `deleted_at` preenchido, mas não impediria alterar outro campo no
-- mesmo comando. A função abaixo escreve UM campo e só ele, numa lista fechada de tabelas.
--
-- SEGURANÇA: é SECURITY DEFINER (contorna RLS de propósito), então ela mesma faz as três
-- checagens que a RLS faria — organização, papel e "a linha está mesmo excluída". O papel
-- exigido por tabela é o MESMO da policy de UPDATE correspondente; não afrouxa nada.
--
-- IDEMPOTENTE: pode rodar duas vezes. Termina com um select de conferência.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1) A função de desfazer ───────────────────────────────────────────────────
create or replace function public.restaurar_registro(
  p_tabela text,
  p_id     uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_papeis public.user_role[];
  v_org    uuid;
  v_linhas int;
begin
  v_org := public.user_org();
  if v_org is null then
    raise exception 'sem organização ativa';
  end if;

  -- LISTA FECHADA. Uma tabela que não esteja aqui não pode ser restaurada por este caminho,
  -- e o `p_tabela` só chega ao SQL dinâmico depois de casar com um destes literais — não há
  -- superfície para injeção.
  v_papeis := case p_tabela
    -- Mão de obra: mesmo papel da policy de UPDATE (0020_grupo_operacional_rls.sql)
    when 'worker_absences'     then array['engenheiro','planejador','gerente','diretor','owner']
    when 'workers'             then array['engenheiro','planejador','gerente','diretor','owner']
    when 'timecards'           then array['engenheiro','planejador','gerente','diretor','owner']
    when 'shifts'              then array['engenheiro','planejador','gerente','diretor','owner']
    when 'worker_assessments'  then array['engenheiro','planejador','gerente','diretor','owner']
    when 'work_posts'          then array['engenheiro','planejador','gerente','diretor','owner']
    when 'labor_occurrences'   then array['engenheiro','planejador','gerente','diretor','owner']
    when 'labor_crews'         then array['engenheiro','planejador','gerente','diretor','owner']
    -- Obra e contrato (0033_sprint6_rls.sql)
    when 'construction_sites'  then array['engenheiro','planejador','gerente','diretor','owner']
    -- RDO (20260728120100_rdo_update_policy_unblock.sql)
    when 'rdo'                 then array['gerente','diretor','owner']
    when 'fvs'                 then array['gerente','diretor','owner']
    -- Financeiro (20260723120000_financeiro_titulos.sql)
    when 'financeiro_titulos'  then array['planejador','engenheiro','gerente','diretor','owner']
    -- Suprimentos (0044 / 20260518133035): UPDATE sem gate de papel, mas restaurar estoque
    -- pede mais do que ver — exige quem compra.
    when 'suprimentos_estoque_itens' then array['comprador','engenheiro','gerente','diretor','owner']
    when 'suprimentos_depositos'     then array['comprador','engenheiro','gerente','diretor','owner']
    when 'purchase_orders'           then array['comprador','gerente','diretor','owner']
    -- Planejamento
    when 'master_baselines'    then array['planejador','gerente','diretor','owner']
    -- Rotinas: a policy de UPDATE não tem gate de papel de propósito (marcar "feito" barrado
    -- por RLS produziria fila presa em silêncio). Restaurar segue o mesmo critério.
    when 'rotinas'             then array['visualizador','zelador','morador','comprador','qualidade','planejador','engenheiro','gerente','diretor','owner']
    when 'rotina_execucoes'    then array['visualizador','zelador','morador','comprador','qualidade','planejador','engenheiro','gerente','diretor','owner']
    else null
  end::public.user_role[];

  if v_papeis is null then
    raise exception 'tabela % não pode ser restaurada por aqui', p_tabela;
  end if;

  if not public.has_role(v_papeis) then
    raise exception 'o seu papel não autoriza restaurar em %', p_tabela;
  end if;

  -- ESCREVE UM CAMPO E SÓ ELE. `deleted_at is not null` no WHERE torna a função inócua
  -- contra linha viva: não há como usá-la para editar um registro que não foi excluído.
  execute format(
    'update public.%I set deleted_at = null where id = $1 and organization_id = $2 and deleted_at is not null',
    p_tabela
  ) using p_id, v_org;

  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

revoke all on function public.restaurar_registro(text, uuid) from public;
grant execute on function public.restaurar_registro(text, uuid) to authenticated;

comment on function public.restaurar_registro(text, uuid) is
  'Desfaz um soft delete: zera deleted_at. Lista fechada de tabelas, papel igual ao da policy de UPDATE, e só age em linha já excluída.';


-- ── 2) FVS fechada pode ser excluída ──────────────────────────────────────────
-- A policy tinha `closed = false`, então uma FVS FECHADA não podia ser nem editada nem
-- soft-deletada. Como o cliente sempre fecha a FVS ao concluir, na prática nenhuma FVS
-- concluída podia ser apagada — a op sumia da tela e voltava no pull. É o mesmo defeito
-- que `20260728120100_rdo_update_policy_unblock` teve de desfazer no RDO.
do $$
begin
  if to_regclass('public.fvs') is null then
    raise notice 'pulando fvs: tabela não existe neste banco';
  else
    execute $sql$drop policy if exists fvs_update_author_or_manager on public.fvs$sql$;
    execute $sql$create policy fvs_update_author_or_manager on public.fvs
  for update to authenticated
  using (
    organization_id = public.user_org()
    -- SEM `deleted_at is null`: com o filtro, restaurar seria impossível e reexcluir também.
    and (
      -- FVS aberta: autor ou gestor edita à vontade
      (closed = false and (created_by = auth.uid() or public.has_role(array['gerente','diretor','owner']::public.user_role[])))
      -- FVS fechada: só gestor, e o conteúdo segue protegido pelo app
      or public.has_role(array['gerente','diretor','owner']::public.user_role[])
    )
  )
  with check (organization_id = public.user_org())$sql$;
  end if;
end $$;


-- ── 3) Ordem de compra fechada pode ser editada e excluída ────────────────────
-- Tinha `status != 'closed'`, com o comentário "closed só via RPC update_po_approved". Esse
-- RPC nunca aplicou nada: `request_action` só cria uma linha em `pending_actions`, e o pedido
-- ia para uma fila sem link em menu nenhum que o próprio autor não pode aprovar. Editar uma
-- OC fechada era, na prática, impossível.
do $$
begin
  if to_regclass('public.purchase_orders') is null then
    raise notice 'pulando purchase_orders: tabela não existe neste banco';
  else
    execute $sql$drop policy if exists po_update_role on public.purchase_orders$sql$;
    execute $sql$create policy po_update_role on public.purchase_orders
  for update to authenticated
  using (
    organization_id = public.user_org()
    and public.has_role(array['comprador','gerente','diretor','owner']::public.user_role[])
  )
  with check (organization_id = public.user_org())$sql$;
  end if;
end $$;


-- ── 4) Linha de base do planejamento pode ser excluída ────────────────────────
-- O UPDATE estava bloqueado com `USING (false)` porque a linha de base é imutável. A intenção
-- é boa, mas fechava também o soft delete — e apagar só era possível pelo RPC de aprovação,
-- que ninguém consegue aprovar. Aqui o conteúdo CONTINUA imutável: o WITH CHECK exige que a
-- linha resultante esteja excluída, então o único update possível é preencher `deleted_at`.
-- Restaurar é feito por `restaurar_registro`, que é SECURITY DEFINER e não passa por aqui.
do $$
begin
  if to_regclass('public.master_baselines') is null then
    raise notice 'pulando master_baselines: tabela não existe neste banco';
  else
    execute $sql$drop policy if exists master_baselines_update_blocked on public.master_baselines$sql$;
    execute $sql$drop policy if exists master_baselines_soft_delete_only on public.master_baselines$sql$;
    execute $sql$create policy master_baselines_soft_delete_only on public.master_baselines
  for update to authenticated
  using (
    organization_id = public.user_org()
    and deleted_at is null
    and public.has_role(array['planejador','gerente','diretor','owner']::public.user_role[])
  )
  with check (
    organization_id = public.user_org()
    and deleted_at is not null   -- só permite SAIR para o estado "excluída"
  )$sql$;
  end if;
end $$;




-- ── 5) ⛔ A CAUSA RAIZ: a policy de LEITURA impedia o soft delete ─────────────
--
-- Isto foi MEDIDO em PostgreSQL 16.15, com caso mínimo reproduzível:
--
--   create policy p_sel on t for select using (dono = 'eu' and del = false);
--   create policy p_upd on t for update using (dono = 'eu') with check (dono = 'eu');
--   update t set del = true;   -->  ERROR: new row violates row-level security policy
--
-- O Postgres exige que a linha CONTINUE VISÍVEL pela policy de SELECT depois do UPDATE. Como
-- todas estas 18 tabelas têm `deleted_at IS NULL` no SELECT, marcar `deleted_at` torna a linha
-- invisível — e o comando é RECUSADO. Não é "0 linhas afetadas": é erro, sempre, para qualquer
-- papel, inclusive o dono da empresa.
--
-- Ou seja: **o soft delete nestas tabelas nunca funcionou**. É por isso que o cliente dizia
-- "só de apagar algo, já deveria ser apagado". Não era permissão, não era rede, não era o teto
-- de tentativas — era isto, debaixo de tudo.
--
-- A correção é a MESMA que `20260518160000_fix_almoxarifado_soft_delete_rls.sql` já aplicou às
-- três tabelas do almoxarifado em maio: tirar `deleted_at IS NULL` do SELECT. Quem esconde o
-- registro apagado passa a ser o cliente, que já faz isso — `pullTable(activeOnly)` sempre
-- filtra (`storeSync.ts:712`, e nenhum chamador passa `activeOnly: false`). Conferido também que
-- nenhuma tela lê estas tabelas fora do `pullTable`.
--
-- ⚠️ Junto com esta migração vai a correção de `storeSync.ts`: a conferência pós-exclusão
-- passa a olhar SE `deleted_at` FOI PREENCHIDO, em vez de "a linha sumiu da leitura" — que com
-- esta mudança seria um falso positivo permanente.

-- Um laço, e não 18 comandos soltos, por um motivo prático: se UMA tabela não existir no banco
-- (migração anterior não aplicada), a série inteira abortaria no meio e deixaria metade das
-- tabelas destravadas e metade não — o pior estado possível, e silencioso. Aqui a que falta é
-- pulada e anunciada no aviso final.
do $$
declare
  r record;
begin
  for r in
    select * from (values
    ('worker_absences','worker_absences_select_own_org'),
    ('workers','workers_select_own_org'),
    ('timecards','timecards_select_own_org'),
    ('shifts','shifts_select_own_org'),
    ('worker_assessments','worker_assessments_select_own_org'),
    ('work_posts','work_posts_select_own_org'),
    ('labor_occurrences','labor_occ_select_own_org'),
    ('labor_crews','labor_crews_select_own_org'),
    ('rdo','rdo_select_own_org'),
    ('fvs','fvs_select_own_org'),
    ('construction_sites','sites_select_own_org'),
    ('financeiro_titulos','fin_titulos_select_own_org'),
    ('rotinas','rotinas_select_own_org'),
    ('rotina_execucoes','rotina_execucoes_select_own_org'),
    ('master_baselines','master_baselines_select_own_org'),
    ('purchase_orders','po_select_own_org'),
    ('projects','projects_select_own_org'),
    ('obra_dias_sem_producao','dias_sem_prod_select_own_org')
    ) as v(tabela, policy_nome)
  loop
    if to_regclass('public.' || r.tabela) is null then
      raise notice 'pulando %: tabela não existe neste banco', r.tabela;
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', r.policy_nome, r.tabela);
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = public.user_org())',
      r.policy_nome, r.tabela
    );
  end loop;
end $$;


-- ── Conferência ───────────────────────────────────────────────────────────────
-- Lista o que FALTOU. Silêncio (linha "OK") é o resultado bom.
with esperado(parte, aplicado) as (
  select 'restaurar_registro',
         to_regprocedure('public.restaurar_registro(text, uuid)') is not null
  union all
  select 'fvs aceita FVS fechada e linha excluída',
         exists (select 1 from pg_policies
                  where schemaname='public' and tablename='fvs' and cmd='UPDATE'
                    and policyname='fvs_update_author_or_manager'
                    and qual not like '%deleted_at%')
  union all
  select 'ordem de compra fechada pode ser editada',
         exists (select 1 from pg_policies
                  where schemaname='public' and tablename='purchase_orders' and cmd='UPDATE'
                    and policyname='po_update_role'
                    and qual not like '%status%')
  union all
  select 'linha de base aceita soft delete',
         exists (select 1 from pg_policies
                  where schemaname='public' and tablename='master_baselines' and cmd='UPDATE'
                    and policyname='master_baselines_soft_delete_only')
  union all
  select 'soft delete destravado nas 18 tabelas',
         not exists (select 1 from pg_policies
                      where schemaname='public' and cmd='SELECT'
                        and tablename in ('worker_absences','workers','timecards','shifts','worker_assessments','work_posts','labor_occurrences','labor_crews','rdo','fvs','construction_sites','financeiro_titulos','rotinas','rotina_execucoes','master_baselines','purchase_orders','projects','obra_dias_sem_producao')
                        and qual like '%deleted_at%')
)
select case when bool_and(aplicado) then 'OK — as 5 partes foram aplicadas'
            else 'FALTOU: ' || string_agg(parte, ' · ') filter (where not aplicado)
       end as resultado
from esperado;
