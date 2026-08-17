-- 20260817140000_work_posts_occurrences.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- DUAS COISAS QUE O USUÁRIO PREENCHE E NUNCA SAÍAM DA MÁQUINA
--
-- No módulo Mão de Obra, `workPosts` (postos de trabalho) e `occurrences` (ocorrências de
-- escalamento) só existiam no navegador:
--
--  - **Postos de trabalho**: `addWorkPost`/`updateWorkPost`/`removeWorkPost` gravavam só no
--    estado local, e o `pull()` não conhecia a tabela. O engenheiro cadastrava trinta postos,
--    trocava de computador, e encontrava a aba vazia. Eles alimentam a geração automática de
--    escala, então perder isso é perder a escala junto.
--
--  - **Ocorrências**: pior — `addOccurrence` gravava num pedaço do estado que nem sequer
--    estava no `partialize` do zustand. O registro aparecia na lista e sumia no primeiro F5.
--
-- Mesmo padrão de `rateio_consumo` e `financeiro_titulos`: payload jsonb, RLS por
-- `user_org()`, exclusão por soft delete (UPDATE em `deleted_at`), DELETE bloqueado.
--
-- PAPÉIS QUE PODEM ESCREVER: a mesma lista das outras tabelas do projeto
-- (planejador, engenheiro, gerente, diretor, owner). Fica de fora `visualizador`, que é
-- somente leitura, e os papéis prediais, que não têm nada a ver com escala de obra.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Postos de trabalho ──────────────────────────────────────────────────────────
create table if not exists public.work_posts (
  id              uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payload         jsonb not null default '{}'::jsonb,
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists idx_work_posts_org        on public.work_posts(organization_id);
create index if not exists idx_work_posts_org_active on public.work_posts(organization_id) where deleted_at is null;

alter table public.work_posts enable row level security;
alter table public.work_posts force  row level security;

drop policy if exists work_posts_select_own_org on public.work_posts;
create policy work_posts_select_own_org on public.work_posts for select to authenticated
  using (organization_id = public.user_org() and deleted_at is null);

drop policy if exists work_posts_insert_with_role on public.work_posts;
create policy work_posts_insert_with_role on public.work_posts for insert to authenticated
  with check (organization_id = public.user_org() and created_by = auth.uid()
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));

drop policy if exists work_posts_update_role on public.work_posts;
create policy work_posts_update_role on public.work_posts for update to authenticated
  using (organization_id = public.user_org() and deleted_at is null
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  with check (organization_id = public.user_org());

drop policy if exists work_posts_delete_blocked on public.work_posts;
create policy work_posts_delete_blocked on public.work_posts for delete to authenticated using (false);

-- ── Ocorrências de escalamento ──────────────────────────────────────────────────
create table if not exists public.labor_occurrences (
  id              uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payload         jsonb not null default '{}'::jsonb,
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists idx_labor_occ_org        on public.labor_occurrences(organization_id);
create index if not exists idx_labor_occ_org_active on public.labor_occurrences(organization_id) where deleted_at is null;

alter table public.labor_occurrences enable row level security;
alter table public.labor_occurrences force  row level security;

drop policy if exists labor_occ_select_own_org on public.labor_occurrences;
create policy labor_occ_select_own_org on public.labor_occurrences for select to authenticated
  using (organization_id = public.user_org() and deleted_at is null);

drop policy if exists labor_occ_insert_with_role on public.labor_occurrences;
create policy labor_occ_insert_with_role on public.labor_occurrences for insert to authenticated
  with check (organization_id = public.user_org() and created_by = auth.uid()
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));

drop policy if exists labor_occ_update_role on public.labor_occurrences;
create policy labor_occ_update_role on public.labor_occurrences for update to authenticated
  using (organization_id = public.user_org() and deleted_at is null
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  with check (organization_id = public.user_org());

drop policy if exists labor_occ_delete_blocked on public.labor_occurrences;
create policy labor_occ_delete_blocked on public.labor_occurrences for delete to authenticated using (false);

-- ── Grants ──────────────────────────────────────────────────────────────────────
-- O Supabase costuma conceder isso por default privileges, mas várias migrations do projeto
-- declaram mesmo assim (maintenance_plans, obra_levantamentos, quick_adaptation_*) — repetir é
-- barato e remove um modo de falha silenciosa. DELETE fica de fora de propósito: exclusão aqui
-- é soft delete, via UPDATE em `deleted_at`.
grant select, insert, update on public.work_posts        to authenticated;
grant select, insert, update on public.labor_occurrences to authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────────
select
  case when count(*) = 2 then '  OK  ' else '❌ FALTA' end as situacao,
  count(*) || ' de 2 tabelas criadas (work_posts, labor_occurrences)' as item
from information_schema.tables
where table_schema = 'public' and table_name in ('work_posts', 'labor_occurrences');
