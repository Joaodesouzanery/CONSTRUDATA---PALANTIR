-- 20260820120000_obra_dias_sem_producao.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- "NÃO TEVE PRODUÇÃO HOJE"
--
-- O painel de alertas do RDO cobra, todo dia útil, um RDO por obra. Mas obra para: chove, a área
-- não é liberada, falta material. Sem um jeito de justificar, o gestor aprenderia a ignorar o
-- alerta vermelho — e um alerta que se ignora não vale nada.
--
-- ── POR QUE UMA TABELA, E NÃO UM RDO COM FLAG ─────────────────────────────────────────────────
-- A tentação óbvia é gravar um RDO com `semProducao: true` e reusar toda a infraestrutura que já
-- existe. Esse experimento JÁ FOI FEITO neste código, e falhou: `status: 'rascunho'` é exatamente
-- um RDO fantasma com flag, tem até predicado pronto (`isRdoFinalized`), e é honrado em TRÊS
-- lugares. Os outros ~20 consumidores contam rascunho — inclusive em produção hoje, onde
-- `rdosDoPlano` não filtra e o RUP do plano sai subestimado por causa disso.
--
-- E há um custo que nenhum `if` no cliente conserta: o trigger `trg_assign_rdo_number` queima um
-- número sequencial de RDO e o torna imutável no UPDATE. Num contrato fiscalizado, "RDO nº 47 =
-- não teve produção" é irreversível.
--
-- O nome da tabela é deliberadamente longe de "rdo", para ninguém daqui a seis meses dar `join`
-- nela nos agregados de RDO e recriar o problema que ela existe para evitar.
--
-- Mesmo padrão de `work_posts`/`labor_occurrences`: payload jsonb, RLS por `user_org()`, soft
-- delete, DELETE bloqueado. Com DUAS diferenças deliberadas, explicadas onde aparecem.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.obra_dias_sem_producao (
  id              uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id         uuid not null references public.construction_sites(id) on delete cascade,
  data            date not null,
  payload         jsonb not null default '{}'::jsonb,   -- { categoria, motivo, registradoPor }
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists idx_dias_sem_prod_org      on public.obra_dias_sem_producao(organization_id);
create index if not exists idx_dias_sem_prod_obra_dia on public.obra_dias_sem_producao(organization_id, site_id, data desc);

-- DIFERENÇA 1 — índice único PARCIAL.
-- O cliente gera o id de forma determinística (`sem-prod:<siteId>:<data>`), então dois aparelhos
-- offline marcando a mesma obra no mesmo dia produzem o MESMO id e o upsert resolve. O índice
-- aqui é o cinto de segurança para qualquer caminho que escape disso.
-- Precisa ser PARCIAL (`where deleted_at is null`): sem isso, desmarcar um dia (soft delete) e
-- remarcar depois colidiria com a linha apagada e a operação ficaria presa na fila para sempre —
-- é exatamente o incidente já documentado em `planejamentoStore` com os feriados.
create unique index if not exists uq_dias_sem_prod_obra_dia
  on public.obra_dias_sem_producao(organization_id, site_id, data)
  where deleted_at is null;

alter table public.obra_dias_sem_producao enable row level security;
alter table public.obra_dias_sem_producao force  row level security;

drop policy if exists dias_sem_prod_select_own_org on public.obra_dias_sem_producao;
create policy dias_sem_prod_select_own_org on public.obra_dias_sem_producao for select to authenticated
  using (organization_id = public.user_org() and deleted_at is null);

drop policy if exists dias_sem_prod_insert_with_role on public.obra_dias_sem_producao;
create policy dias_sem_prod_insert_with_role on public.obra_dias_sem_producao for insert to authenticated
  with check (organization_id = public.user_org() and created_by = auth.uid()
    and public.has_role(array['planejador','engenheiro','qualidade','gerente','diretor','owner']::public.user_role[]));

-- DIFERENÇA 2 — o USING do UPDATE **não** filtra `deleted_at is null`.
-- Em `work_posts` ele filtra, e ali faz sentido. Aqui não: desmarcar um dia é soft delete, e com
-- o filtro no USING a linha apagada some do UPDATE — nem o update direto nem o
-- `upsert on conflict (id)` a enxergariam, casariam 0 linhas, e a operação travaria na fila.
-- É o mesmo defeito que a migration `20260728120100_rdo_update_policy_unblock` teve de desfazer.
drop policy if exists dias_sem_prod_update_role on public.obra_dias_sem_producao;
create policy dias_sem_prod_update_role on public.obra_dias_sem_producao for update to authenticated
  using (organization_id = public.user_org()
    and public.has_role(array['planejador','engenheiro','qualidade','gerente','diretor','owner']::public.user_role[]))
  with check (organization_id = public.user_org());

drop policy if exists dias_sem_prod_delete_blocked on public.obra_dias_sem_producao;
create policy dias_sem_prod_delete_blocked on public.obra_dias_sem_producao for delete to authenticated using (false);

-- DELETE fica de fora de propósito: exclusão aqui é soft delete, via UPDATE em `deleted_at`.
grant select, insert, update on public.obra_dias_sem_producao to authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────────
select
  case when (select count(*) from information_schema.tables
              where table_schema='public' and table_name='obra_dias_sem_producao') = 1
        and (select count(*) from pg_policies
              where schemaname='public' and tablename='obra_dias_sem_producao') = 4
        and (select count(*) from pg_indexes
              where schemaname='public' and indexname='uq_dias_sem_prod_obra_dia') = 1
       then '  OK  ' else '❌ FALTA' end as situacao,
  'tabela + 4 policies + índice único parcial' as item;
