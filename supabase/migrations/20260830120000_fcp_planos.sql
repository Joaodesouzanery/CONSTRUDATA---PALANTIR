-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.
--
-- Fluxo de Caixa Projetado — a tabela dos planos.
--
-- Um plano é um documento de premissas por obra: calendário, cenário, tickets, custos, regime com
-- o consórcio. TUDO que o motor calcula (semanal, mensal, econômico, viabilidade) é derivado e
-- NÃO é gravado — guardar resultado calculado é convite para ele envelhecer e discordar da conta.
--
-- O que é gravado além das premissas: a PRODUÇÃO REALIZADA lançada semana a semana, que é a única
-- entrada que muda ao longo do mês.

create table if not exists public.fcp_planos (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  obra_id         uuid,
  nome            text not null default '',
  -- rascunho → enviado → aprovado. A tela trava a edição a partir de 'aprovado'.
  status          text not null default 'rascunho' check (status in ('rascunho','enviado','aprovado')),
  -- O documento inteiro (premissas + realizado) vive aqui: campo novo não precisa de migração.
  payload         jsonb not null default '{}'::jsonb,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists idx_fcp_planos_org  on public.fcp_planos(organization_id);
create index if not exists idx_fcp_planos_obra on public.fcp_planos(obra_id);

alter table public.fcp_planos enable row level security;

-- ⚠️ SEM `deleted_at is null` na policy de SELECT.
-- O Postgres recusa um UPDATE que torne a linha invisível à própria policy de leitura — com o
-- filtro aqui, o soft delete nasceria QUEBRADO (erro, não "0 linhas"). Foi a causa raiz de "apagar
-- não funciona" em 75 tabelas deste projeto. Quem esconde o registro apagado é o cliente, que já
-- filtra. Ver `20260825120000_soft_delete_resto_do_schema`.
drop policy if exists fcp_planos_select on public.fcp_planos;
create policy fcp_planos_select on public.fcp_planos
  for select to authenticated
  using (organization_id = public.user_org());

drop policy if exists fcp_planos_insert on public.fcp_planos;
create policy fcp_planos_insert on public.fcp_planos
  for insert to authenticated
  with check (organization_id = public.user_org());

drop policy if exists fcp_planos_update on public.fcp_planos;
create policy fcp_planos_update on public.fcp_planos
  for update to authenticated
  using (organization_id = public.user_org())
  with check (organization_id = public.user_org());

drop policy if exists fcp_planos_delete on public.fcp_planos;
create policy fcp_planos_delete on public.fcp_planos
  for delete to authenticated
  using (organization_id = public.user_org());

grant select, insert, update, delete on public.fcp_planos to authenticated;

-- ── updated_at, no molde das outras 49 tabelas ────────────────────────────────
drop trigger if exists set_updated_at on public.fcp_planos;
create trigger set_updated_at before update on public.fcp_planos
  for each row execute function public.set_updated_at();

-- ── ⚠️ A auditoria NÃO se liga sozinha numa tabela criada depois ──────────────
--
-- `20260829120000_auditoria_generica` aplica os gatilhos por VARREDURA do `information_schema` —
-- e a varredura rodou naquele momento. Tabela criada depois nasce fora da auditoria, em silêncio.
-- Por isso toda migração que cria tabela nova precisa repetir estas duas linhas.
--
-- (A alternativa seria um event trigger em `ddl_command_end`; ficou de fora porque exige
--  superusuário, que o Supabase gerenciado não dá.)
alter table public.fcp_planos
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

drop trigger if exists trg_updated_by on public.fcp_planos;
create trigger trg_updated_by before insert or update on public.fcp_planos
  for each row execute function public.set_updated_by();

drop trigger if exists trg_auditoria on public.fcp_planos;
create trigger trg_auditoria after insert or update or delete on public.fcp_planos
  for each row execute function public.registrar_auditoria();

comment on table public.fcp_planos is
  'Fluxo de Caixa Projetado: premissas e producao realizada. O calculado e derivado, nao gravado.';

-- ── Conferência ───────────────────────────────────────────────────────────────
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'fcp_planos')                  as tabela_criada,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'fcp_planos')                     as policies,
  (select count(distinct trigger_name) from information_schema.triggers
    where event_object_table = 'fcp_planos')                                      as gatilhos;
