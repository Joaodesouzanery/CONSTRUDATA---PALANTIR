-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.
--
-- Nota Fiscal — a tabela da aba "Nota Fiscal" do Financeiro.
--
-- POR QUE TABELA PRÓPRIA, e não `financeiro_titulos` (que já guarda boleto no payload):
-- um cupom fiscal não é um título. Não tem vencimento, já nasce pago, e o `PagamentosPanel`
-- lista TODOS os títulos sem filtro — centenas de cupons entrariam naquela tela e nos KPIs de
-- "a vencer" e "vencidas". A nota também tem ciclo próprio (arquivada → lançada), que
-- `status: pendente|pago|cancelado` não modela.
--
-- ⚠️ A IDENTIDADE É A CHAVE DE ACESSO, e ela vem de fora pronta:
-- `id = seededId(organization_id, 'nota-fiscal', chave44)`, calculado no cliente. Como o insert
-- da fila vira upsert por id, a mesma foto importada em dois celulares chega ao MESMO id e o
-- segundo upsert regrava a mesma linha.
--
-- Deliberadamente NÃO há índice único sobre `chave_acesso`: a PK já carrega esse fato, e uma
-- segunda restrição sobre a mesma coisa só cria um segundo jeito de receber um 23505 que ninguém
-- sabe explicar na tela.

create table if not exists public.financeiro_notas (
  id              uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  obra_id         uuid,
  -- Colunas promovidas para filtrar e agrupar sem abrir o jsonb. O payload continua sendo a
  -- fonte: quem lê, lê dele.
  chave_acesso    text not null,
  cnpj_emitente   text,
  competencia     text,
  status          text not null default 'arquivada' check (status in ('arquivada','lancada','cancelada')),
  payload         jsonb not null default '{}'::jsonb,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists idx_fin_notas_org         on public.financeiro_notas(organization_id);
create index if not exists idx_fin_notas_obra        on public.financeiro_notas(obra_id);
create index if not exists idx_fin_notas_cnpj        on public.financeiro_notas(organization_id, cnpj_emitente);
create index if not exists idx_fin_notas_competencia on public.financeiro_notas(organization_id, competencia);

alter table public.financeiro_notas enable row level security;

-- ⚠️ SEM `deleted_at is null` na policy de SELECT.
-- O Postgres recusa um UPDATE que torne a linha invisível à própria policy de leitura — com o
-- filtro aqui, o soft delete nasceria QUEBRADO (erro, não "0 linhas"). Foi a causa raiz de "apagar
-- não funciona" em 75 tabelas deste projeto. Quem esconde o registro apagado é o cliente.
drop policy if exists fin_notas_select on public.financeiro_notas;
create policy fin_notas_select on public.financeiro_notas
  for select to authenticated
  using (organization_id = public.user_org());

-- Escrita com o MESMO gate de papel dos títulos: cupom é documento financeiro, e quem não pode
-- lançar um pagamento também não pode arquivar uma despesa.
drop policy if exists fin_notas_insert on public.financeiro_notas;
create policy fin_notas_insert on public.financeiro_notas
  for insert to authenticated
  with check (
    organization_id = public.user_org()
    and public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );

drop policy if exists fin_notas_update on public.financeiro_notas;
create policy fin_notas_update on public.financeiro_notas
  for update to authenticated
  using (
    organization_id = public.user_org()
    and public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  with check (organization_id = public.user_org());

-- Delete físico bloqueado: aqui só existe soft delete, como em `financeiro_titulos`.
drop policy if exists fin_notas_delete_blocked on public.financeiro_notas;
create policy fin_notas_delete_blocked on public.financeiro_notas
  for delete to authenticated
  using (false);

grant select, insert, update, delete on public.financeiro_notas to authenticated;

-- ── updated_at, no molde das outras tabelas ───────────────────────────────────
drop trigger if exists set_updated_at on public.financeiro_notas;
create trigger set_updated_at before update on public.financeiro_notas
  for each row execute function public.set_updated_at();

-- ── ⚠️ A auditoria NÃO se liga sozinha numa tabela criada depois ──────────────
--
-- `20260829120000_auditoria_generica` aplica os gatilhos por VARREDURA do `information_schema` —
-- e a varredura rodou naquele momento. Tabela criada depois nasce fora da auditoria, em silêncio.
alter table public.financeiro_notas
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

drop trigger if exists trg_updated_by on public.financeiro_notas;
create trigger trg_updated_by before insert or update on public.financeiro_notas
  for each row execute function public.set_updated_by();

drop trigger if exists trg_auditoria on public.financeiro_notas;
create trigger trg_auditoria after insert or update or delete on public.financeiro_notas
  for each row execute function public.registrar_auditoria();

comment on table public.financeiro_notas is
  'Notas fiscais (NFC-e/NF-e) importadas por foto. O id deriva da chave de acesso: reimportar nao duplica.';

-- ── Rede de segurança: um lançamento por nota ─────────────────────────────────
--
-- O `id` do lançamento também é determinístico (`seededId(org,'nota-fiscal-lancamento',notaId)`),
-- então a duplicata já é impossível pelo caminho normal. Este índice existe pela mesma razão do
-- `20260814120000_idempotencia_financeira`: se algum caminho futuro escrever direto, o banco
-- recusa.
--
-- ⚠️ Aqui havia um bloco `do $$` que contava duplicatas antes de criar o índice, no molde daquela
-- migração. Ele falhou no editor do Supabase com `42P01: relation "duplicadas" does not exist` e
-- travou a migração inteira. Foi removido em vez de consertado, e o motivo é simples: `sourceNotaId`
-- nasceu nesta mesma migração, então NENHUMA linha do banco pode tê-lo preenchido — não existe
-- duplicata possível para contar. Era cerimônia defensiva que criou um modo de falha em algo que
-- não podia falhar.
create unique index if not exists uniq_fin_entries_source_nota
  on public.financeiro_entries (organization_id, (payload->>'sourceNotaId'))
  where deleted_at is null and coalesce(payload->>'sourceNotaId','') <> '';

-- ── Conferência ───────────────────────────────────────────────────────────────
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'financeiro_notas')            as tabela_criada,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'financeiro_notas')               as policies,
  (select count(distinct trigger_name) from information_schema.triggers
    where event_object_table = 'financeiro_notas')                                as gatilhos,
  (select count(*) from pg_indexes
    where schemaname = 'public' and indexname = 'uniq_fin_entries_source_nota')   as indice_idempotencia;
