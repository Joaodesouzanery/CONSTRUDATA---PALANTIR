-- 20260917120000_operacional_linhas.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- O MÓDULO OPERACIONAL GANHA CHÃO
--
-- O `sabespStore` era o ÚNICO store de dado do projeto sem `persist` e sem `pendingSync` — os
-- outros 42 usam os dois. Ele guardava o workbook inteiro em memória e empurrava um blob para
-- `app_state`. Na prática: importar a planilha, apertar F5 e a tela voltava vazia; offline, o
-- módulo abria sem nada.
--
-- Esta tabela troca o blob por LINHAS, que é o que o módulo precisa para o pedido do cliente:
-- editar no sistema e, quando a planilha vier, saber o que foi alterado.
--
-- ─── POR QUE UMA TABELA SÓ, COM `aba` ──────────────────────────────────────────
-- São 20 abas operacionais com colunas totalmente diferentes (de 16 a 36 colunas), e o cliente
-- muda a planilha a cada revisão. Uma tabela por aba significaria 20 migrações a cada revisão
-- nova. O payload jsonb já é o padrão do projeto justamente para isso.
--
-- ─── AS COLUNAS PROMOVIDAS, E POR QUE CADA UMA ─────────────────────────────────
--   `aba`    — todo recorte de tela começa por ela;
--   `chave`  — a identidade da linha na planilha; é o que faz a reimportação ATUALIZAR em vez de
--              duplicar. Única por (org, aba, chave);
--   `origem` — 'planilha' ou 'sistema'. É ela que sustenta a conferência: sem saber quem escreveu
--              por último, não há como mostrar "isto você editou, a planilha discorda".
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.operacional_linhas (
  id              uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  aba             text not null,
  chave           text not null,
  origem          text not null default 'planilha',
  editado_por     text,
  editado_em      timestamptz,
  payload         jsonb not null default '{}'::jsonb,
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists idx_op_linhas_org      on public.operacional_linhas(organization_id);
create index if not exists idx_op_linhas_org_aba  on public.operacional_linhas(organization_id, aba) where deleted_at is null;
-- ⚠️ Índice único PARCIAL (`where deleted_at is null`): sem o parcial, arquivar uma linha e
-- reimportá-la com a mesma chave colidiria para sempre. Mesma decisão de `obra_dias_sem_producao`.
create unique index if not exists idx_op_linhas_chave
  on public.operacional_linhas(organization_id, aba, chave) where deleted_at is null;

alter table public.operacional_linhas enable row level security;
alter table public.operacional_linhas force  row level security;

-- ⚠️ SELECT SEM `deleted_at is null` — é o padrão adotado em `20260824130000` (seção 5, "A CAUSA
-- RAIZ"): com o filtro, a linha apagada some da própria policy e desfazer a exclusão fica
-- impossível a partir do cliente. Quem esconde o apagado é o `pullTable`, que já filtra no cliente.
drop policy if exists op_linhas_select_own_org on public.operacional_linhas;
create policy op_linhas_select_own_org on public.operacional_linhas for select to authenticated
  using (organization_id = public.user_org());

drop policy if exists op_linhas_insert_with_role on public.operacional_linhas;
create policy op_linhas_insert_with_role on public.operacional_linhas for insert to authenticated
  with check (organization_id = public.user_org() and created_by = auth.uid()
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));

drop policy if exists op_linhas_update_role on public.operacional_linhas;
create policy op_linhas_update_role on public.operacional_linhas for update to authenticated
  using (organization_id = public.user_org()
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  with check (organization_id = public.user_org());

drop policy if exists op_linhas_delete_blocked on public.operacional_linhas;
create policy op_linhas_delete_blocked on public.operacional_linhas for delete to authenticated using (false);

grant select, insert, update on public.operacional_linhas to authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────────
select
  case when count(*) = 1 then '  OK  ' else '❌ FALTA' end as situacao,
  count(*) || ' de 1 tabela criada (operacional_linhas)' as item
from information_schema.tables
where table_schema = 'public' and table_name = 'operacional_linhas';
