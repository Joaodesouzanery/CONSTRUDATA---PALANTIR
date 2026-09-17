-- 20260916130000_horas_extras.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- HORA EXTRA ANTES DE SER PAGA
--
-- Até aqui a hora extra só existia DEPOIS de paga. O único registro era o `financeiro_entries`
-- que a importação da planilha criava, e a regra do próprio importador — "só o que está pago
-- vira despesa", `controleDeCaixaImport.ts` — significa que o estado intermediário não tinha
-- onde morar:
--
--   célula preenchida, sem "PG" ao lado  →  a empresa deve, mas ainda não pagou
--
-- Esse é justamente o estado que a grade do cliente passa o mês inteiro mostrando. Sem tabela,
-- lançar hora extra no sistema só era possível importando a planilha já fechada e paga.
--
-- Duas apurações convivem na mesma tabela, separadas por `tipo` no payload:
--   'fim-de-semana' → diária negociada (sábado/domingo/feriado)
--   'ponto-saida'   → devolução de hora descontada + hora extra do dia, calculada por hora
--                     (salário ÷ 220 × 1,6). Conferida ao centavo contra o arquivo real.
--
-- Mesmo padrão de `cargos`/`work_posts`: payload jsonb, RLS por `user_org()`, exclusão por soft
-- delete (UPDATE em `deleted_at`), DELETE bloqueado.
--
-- PAPÉIS QUE PODEM ESCREVER: a mesma lista das outras tabelas de Mão de Obra.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.horas_extras (
  id              uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Promovidas para fora do payload porque são o recorte de toda consulta da tela (mês × pessoa)
  -- e o que um índice consegue usar.
  worker_id       uuid,
  data            date not null,
  pago            boolean not null default false,
  payload         jsonb not null default '{}'::jsonb,
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists idx_horas_extras_org        on public.horas_extras(organization_id);
create index if not exists idx_horas_extras_org_active on public.horas_extras(organization_id) where deleted_at is null;
create index if not exists idx_horas_extras_org_data   on public.horas_extras(organization_id, data) where deleted_at is null;

alter table public.horas_extras enable row level security;
alter table public.horas_extras force  row level security;

drop policy if exists horas_extras_select_own_org on public.horas_extras;
-- ⚠️ SELECT SEM `deleted_at is null`, de propósito — é o padrão adotado em
-- `20260824130000_desfazer_exclusao.sql` (seção 5, "A CAUSA RAIZ"). Com o filtro aqui, a linha
-- apagada fica invisível para a própria policy e **desfazer a exclusão é impossível a partir do
-- cliente**. Quem esconde o registro apagado é o `pullTable`, que já filtra `deleted_at is null`
-- no cliente por padrão (`activeOnly`).
create policy horas_extras_select_own_org on public.horas_extras for select to authenticated
  using (organization_id = public.user_org());

drop policy if exists horas_extras_insert_with_role on public.horas_extras;
create policy horas_extras_insert_with_role on public.horas_extras for insert to authenticated
  with check (organization_id = public.user_org() and created_by = auth.uid()
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));

drop policy if exists horas_extras_update_role on public.horas_extras;
-- `using` sem `deleted_at is null` pelo mesmo motivo: com ele, reexcluir ou restaurar a linha
-- não casaria com regra nenhuma.
create policy horas_extras_update_role on public.horas_extras for update to authenticated
  using (organization_id = public.user_org()
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  with check (organization_id = public.user_org());

drop policy if exists horas_extras_delete_blocked on public.horas_extras;
create policy horas_extras_delete_blocked on public.horas_extras for delete to authenticated using (false);

grant select, insert, update on public.horas_extras to authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────────
select
  case when count(*) = 1 then '  OK  ' else '❌ FALTA' end as situacao,
  count(*) || ' de 1 tabela criada (horas_extras)' as item
from information_schema.tables
where table_schema = 'public' and table_name = 'horas_extras';
