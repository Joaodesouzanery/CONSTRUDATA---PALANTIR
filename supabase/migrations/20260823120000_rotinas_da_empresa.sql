-- 20260823120000_rotinas_da_empresa.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- AS ROTINAS DA EMPRESA
--
-- Hoje "rotina" no produto é uma lista de ATALHOS de módulo fixados, agrupados em diário/semanal/
-- mensal, com um preset por cargo. Não existe tarefa, não existe responsável, e não existe
-- feito/não feito. E a tabela `user_routines` tem RLS POR USUÁRIO: ninguém da empresa vê a rotina
-- de outro — o oposto do que uma rotina de equipe precisa ser.
--
-- Duas tabelas, no molde dos planos preventivos de Manutenções (`maintenance_plans`), que já
-- resolveram exatamente este problema — inclusive com `quinzenal` no enum de frequência:
--
--   rotinas            a tarefa recorrente: o que é, com que frequência, de quem é
--   rotina_execucoes   uma linha por (rotina, período): feita ou não
--
-- ─── DUAS DECISÕES QUE VALE REGISTRAR ─────────────────────────────────────────
--
-- 1. O RESPONSÁVEL É TEXTO, não um `auth.users`.
--    A empresa opera com UMA conta para todos. Amarrar a `user_id` obrigaria a cadastrar cada
--    pessoa como usuário só para aparecer numa lista — e produziria uma precisão falsa: o
--    registro diria "feito por João" quando quem clicou foi quem estava com o notebook. Texto
--    diz a verdade: "esta tarefa é do Valim", e quem marcou foi a conta da empresa.
--
-- 2. A EXECUÇÃO É POR PERÍODO, não por data solta.
--    A chave é `(rotina_id, periodo)`, onde `periodo` é a etiqueta do ciclo — `2026-08-20` para
--    diária, `2026-W34` para semanal, `2026-08-Q1` para quinzenal, `2026-08` para mensal. Assim
--    marcar duas vezes o mesmo ciclo não cria dois registros, e "esta semana foi feita?" é uma
--    consulta por igualdade, não uma varredura de intervalo. O índice único garante a primeira
--    parte no BANCO, não só no app.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.rotinas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  titulo text not null,
  descricao text,
  -- Onde no sistema a tarefa é feita: '/app/rdo'. Vira um atalho na tela; opcional.
  modulo text,
  frequencia text not null default 'diaria',
  -- Nome de quem é a tarefa. Ver a decisão 1 acima.
  responsavel text,
  -- Para ordenar dentro da frequência sem depender do título.
  ordem integer not null default 0,
  ativa boolean not null default true,
  -- Campos que ainda não existem entram aqui sem migração (o padrão do projeto).
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint rotinas_frequencia_check
    check (frequencia in ('diaria', 'semanal', 'quinzenal', 'mensal'))
);

create table if not exists public.rotina_execucoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rotina_id uuid not null references public.rotinas(id) on delete cascade,
  -- A etiqueta do ciclo: '2026-08-20' | '2026-W34' | '2026-08-Q1' | '2026-08'. Ver a decisão 2.
  periodo text not null,
  feita boolean not null default true,
  -- Quando foi marcada, no fuso de quem marcou (o servidor roda em UTC).
  marcada_em timestamptz not null default now(),
  observacao text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_rotinas_org
  on public.rotinas(organization_id, frequencia, ordem)
  where deleted_at is null;

create index if not exists idx_rotina_execucoes_org_periodo
  on public.rotina_execucoes(organization_id, periodo)
  where deleted_at is null;

-- Uma execução por rotina por ciclo. Sem isto, dois cliques (ou duas abas abertas) criariam duas
-- linhas, e "quantas rotinas foram feitas esta semana" passaria a contar errado.
create unique index if not exists ux_rotina_execucoes_ciclo
  on public.rotina_execucoes(rotina_id, periodo)
  where deleted_at is null;

-- ── updated_at ──────────────────────────────────────────────────────────────────
drop trigger if exists trg_rotinas_updated_at on public.rotinas;
create trigger trg_rotinas_updated_at
  before update on public.rotinas
  for each row execute function public.set_updated_at();

drop trigger if exists trg_rotina_execucoes_updated_at on public.rotina_execucoes;
create trigger trg_rotina_execucoes_updated_at
  before update on public.rotina_execucoes
  for each row execute function public.set_updated_at();

-- ── RLS: POR ORGANIZAÇÃO, e é este o ponto ──────────────────────────────────────
--
-- `user_routines` era por usuário, o que impedia a equipe de ver a rotina da equipe. Aqui todo
-- mundo da empresa lê e escreve tudo: a rotina é da empresa, não de quem a cadastrou.
--
-- Escrita SEM gate de papel, de propósito. Marcar "feito" é o gesto mais banal da tela, e barrar
-- um papel aqui produziria exatamente a fila presa que já custou caro no módulo de Mão de Obra:
-- o clique parece funcionar, o servidor recusa, e ninguém fica sabendo. Ver `lib/roles.ts`.

alter table public.rotinas enable row level security;
alter table public.rotinas force  row level security;

drop policy if exists rotinas_select_own_org on public.rotinas;
create policy rotinas_select_own_org on public.rotinas for select to authenticated
  using (organization_id = public.user_org() and deleted_at is null);

drop policy if exists rotinas_insert_own_org on public.rotinas;
create policy rotinas_insert_own_org on public.rotinas for insert to authenticated
  with check (organization_id = public.user_org() and created_by = auth.uid());

drop policy if exists rotinas_update_own_org on public.rotinas;
create policy rotinas_update_own_org on public.rotinas for update to authenticated
  using (organization_id = public.user_org() and deleted_at is null)
  with check (organization_id = public.user_org());

-- Exclusão é soft delete (update de deleted_at), como no resto do projeto.
drop policy if exists rotinas_delete_blocked on public.rotinas;
create policy rotinas_delete_blocked on public.rotinas for delete to authenticated using (false);

alter table public.rotina_execucoes enable row level security;
alter table public.rotina_execucoes force  row level security;

drop policy if exists rotina_execucoes_select_own_org on public.rotina_execucoes;
create policy rotina_execucoes_select_own_org on public.rotina_execucoes for select to authenticated
  using (organization_id = public.user_org() and deleted_at is null);

drop policy if exists rotina_execucoes_insert_own_org on public.rotina_execucoes;
create policy rotina_execucoes_insert_own_org on public.rotina_execucoes for insert to authenticated
  with check (organization_id = public.user_org() and created_by = auth.uid());

drop policy if exists rotina_execucoes_update_own_org on public.rotina_execucoes;
create policy rotina_execucoes_update_own_org on public.rotina_execucoes for update to authenticated
  using (organization_id = public.user_org() and deleted_at is null)
  with check (organization_id = public.user_org());

drop policy if exists rotina_execucoes_delete_blocked on public.rotina_execucoes;
create policy rotina_execucoes_delete_blocked on public.rotina_execucoes for delete to authenticated using (false);

comment on table public.rotinas is
  'Rotinas recorrentes da empresa (diaria/semanal/quinzenal/mensal). RLS por organizacao: todos da empresa veem todas.';
comment on table public.rotina_execucoes is
  'Uma linha por (rotina, ciclo). O ciclo e uma etiqueta: 2026-08-20 | 2026-W34 | 2026-08-Q1 | 2026-08.';

-- ── Conferência ─────────────────────────────────────────────────────────────────
select
  case when count(*) = 2 then '  OK  ' else '❌ FALTA(M) ' || (2 - count(*))::text end as situacao,
  'tabelas rotinas + rotina_execucoes' as item
from information_schema.tables
where table_schema = 'public' and table_name in ('rotinas', 'rotina_execucoes');
