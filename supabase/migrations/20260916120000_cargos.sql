-- 20260916120000_cargos.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- CADASTRO DE CARGOS, COM A DIÁRIA DE HORA EXTRA DE CADA UM
--
-- Até aqui "cargo" era só um texto solto dentro do funcionário (`Worker.role`): cada pessoa
-- digitava o seu, e o sistema derivava a lista de cargos fazendo `new Set(workers.map(w =>
-- w.role))`. Isso tem dois custos que apareceram no arquivo real do cliente:
--
--  - **Grafia dupla do mesmo cargo.** "ENCANADOR DE ÁGUA I" e "ENCANADOR DE AGUA I" convivem na
--    mesma planilha, como se fossem dois cargos. Sem cadastro não há onde normalizar.
--  - **Não há onde guardar a diária de hora extra.** O indicador "B4 — hora extra vs tabela por
--    cargo" (`indicadoresFinanceiro.ts`) está cinza no sistema desde que nasceu, com o texto
--    "não existe tabela de diária por cargo no sistema — cadastre a tabela". É esta tabela.
--
-- ⚠️ O VALOR AQUI É SUGESTÃO, NUNCA A VERDADE. Medido no arquivo do cliente: o mesmo
-- "AJUDANTE GERAL I" recebeu R$ 300 no sábado 01/08 e R$ 200 no sábado 08/08; "ENCANADOR DE
-- ESGOTO III" recebeu 350, 250, 300 e 400 em sábados diferentes. O que se paga é o valor da
-- célula daquele dia; o cargo só dá o ponto de partida de quem digita. `controleDeCaixaPlanilha.ts`
-- já registra essa regra por escrito, e a tela já avisa o usuário.
--
-- Mesmo padrão de `work_posts`/`labor_occurrences`: payload jsonb, RLS por `user_org()`,
-- exclusão por soft delete (UPDATE em `deleted_at`), DELETE bloqueado.
--
-- PAPÉIS QUE PODEM ESCREVER: a mesma lista das outras tabelas de Mão de Obra
-- (planejador, engenheiro, gerente, diretor, owner). `visualizador` fica de fora.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.cargos (
  id              uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome            text not null,
  payload         jsonb not null default '{}'::jsonb,
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists idx_cargos_org        on public.cargos(organization_id);
create index if not exists idx_cargos_org_active on public.cargos(organization_id) where deleted_at is null;

alter table public.cargos enable row level security;
alter table public.cargos force  row level security;

drop policy if exists cargos_select_own_org on public.cargos;
-- ⚠️ SELECT SEM `deleted_at is null`, de propósito — é o padrão adotado em
-- `20260824130000_desfazer_exclusao.sql` (seção 5, "A CAUSA RAIZ"). Com o filtro aqui, a linha
-- apagada fica invisível para a própria policy e **desfazer a exclusão é impossível a partir do
-- cliente**. Quem esconde o registro apagado é o `pullTable`, que já filtra `deleted_at is null`
-- no cliente por padrão (`activeOnly`).
create policy cargos_select_own_org on public.cargos for select to authenticated
  using (organization_id = public.user_org());

drop policy if exists cargos_insert_with_role on public.cargos;
create policy cargos_insert_with_role on public.cargos for insert to authenticated
  with check (organization_id = public.user_org() and created_by = auth.uid()
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));

drop policy if exists cargos_update_role on public.cargos;
-- `using` sem `deleted_at is null` pelo mesmo motivo: com ele, reexcluir ou restaurar a linha
-- não casaria com regra nenhuma.
create policy cargos_update_role on public.cargos for update to authenticated
  using (organization_id = public.user_org()
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  with check (organization_id = public.user_org());

-- Exclusão aqui é soft delete (UPDATE em `deleted_at`), como no resto do módulo.
drop policy if exists cargos_delete_blocked on public.cargos;
create policy cargos_delete_blocked on public.cargos for delete to authenticated using (false);

grant select, insert, update on public.cargos to authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────────
select
  case when count(*) = 1 then '  OK  ' else '❌ FALTA' end as situacao,
  count(*) || ' de 1 tabela criada (cargos)' as item
from information_schema.tables
where table_schema = 'public' and table_name = 'cargos';
