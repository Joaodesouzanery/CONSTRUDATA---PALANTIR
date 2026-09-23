-- 20260923130000_ponto_solicitacoes.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor, DEPOIS de `20260923120000_ponto_meu_contexto.sql`.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- O PEDIDO DE CORREÇÃO DE PONTO, FEITO PELO PRÓPRIO FUNCIONÁRIO
--
-- ─── POR QUE PRECISA DE MIGRAÇÃO ───────────────────────────────────────────────
-- `ponto_insert` (20260918150000) exige literalmente `origem = 'app'`, e `ponto_insert_ajuste`
-- exige papel de gestor. Um funcionário NÃO TEM COMO criar um pedido hoje: qualquer caminho volta
-- 42501. Então a escolha não é "se", é ONDE.
--
-- ─── POR QUE TABELA PRÓPRIA, E NÃO UMA `origem` NOVA EM `ponto_registros` ───────
-- Quatro razões, todas verificadas no código, e cada uma sozinha bastaria:
--
--   1. 🔴 O ESPELHO CONTAMINA NA HORA. Nem `jornadasDoPeriodo` (jornada.ts) nem `jornadaAberta`
--      (batida.ts) filtram por `origem` — as duas montam a jornada POR PARIDADE sobre todos os
--      registros do trabalhador. Um pedido pendente viraria mais uma marcação na cadeia, mudando
--      o intervalo, os minutos trabalhados e **o banco de horas, antes de qualquer aprovação**.
--      Sem erro nenhum na tela.
--
--   2. 🔴 O NSR. `trg_ponto_nsr` atribui número a TODO insert. Um pedido consumiria um número da
--      sequência da Portaria 671, e o espelho imprimiria NSRs que não correspondem a marcação
--      nenhuma.
--
--   3. 🔴 O CLIENTE APAGARIA A MARCA. `pontoStore.pull()` faz `origem === 'ajuste' ? 'ajuste' :
--      'app'` — qualquer valor desconhecido volta do servidor carimbado como batida do
--      funcionário.
--
--   4. Pedido tem CICLO DE VIDA (pendente → aprovada/recusada). `trg_ponto_congelar` deixa
--      mutáveis só `site_id`, `payload` e `deleted_at`: o estado do fluxo moraria dentro do
--      documento que a lei manda ser inalterável.
--
-- Com tabela própria, o motor de jornada não muda **uma linha** — e é essa a vantagem.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.ponto_solicitacoes (
  id               uuid primary key,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  worker_id        uuid not null,
  auth_user_id     uuid not null references auth.users(id),
  -- O dia da JORNADA, não o dia civil da batida: turno que começa 22h de segunda é jornada de
  -- segunda. Mesma régua de `dataDaJornada`.
  data             date not null,
  acao             text not null check (acao in ('incluir','corrigir')),
  tipo             text not null check (tipo in ('entrada','inicio_intervalo','fim_intervalo','saida')),
  hora_pedida      time not null,
  -- Sem FK para `ponto_registros`, de propósito: a batida que se quer corrigir pode ainda estar na
  -- fila do celular e não existir no servidor.
  corrige_id       uuid,
  motivo           text not null check (char_length(btrim(motivo)) >= 8),
  situacao         text not null default 'pendente' check (situacao in ('pendente','aprovada','recusada')),
  respondida_por   uuid references auth.users(id),
  respondida_em    timestamptz,
  resposta         text,
  /** A batida `origem='ajuste'` que a aprovação gerou. */
  ajuste_id        uuid,
  payload          jsonb not null default '{}'::jsonb,
  -- ⚠️ `created_by` é OBRIGATÓRIA em toda tabela que a fila de sincronização toca: o `fixOrg` do
  -- storeSync injeta esta coluna em toda op. Sem ela o servidor devolve PGRST204, que a fila
  -- classifica como "aguardando servidor" — retry infinito e silencioso.
  created_by       uuid not null references auth.users(id),
  updated_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- ⚠️ `deleted_at`: `pullTable` filtra por ela por padrão. Sem a coluna, o pull cai no fallback.
  deleted_at       timestamptz
);

create index if not exists idx_ponto_sol_org_situacao
  on public.ponto_solicitacoes(organization_id, situacao) where deleted_at is null;
create index if not exists idx_ponto_sol_conta
  on public.ponto_solicitacoes(organization_id, auth_user_id, data desc) where deleted_at is null;

-- ⚠️ A auditoria genérica (20260829120000) liga os gatilhos por VARREDURA, e a varredura já rodou:
-- tabela criada depois nasce FORA da auditoria, em silêncio. Mesmo remendo de `ponto_registros`.
drop trigger if exists trg_updated_by on public.ponto_solicitacoes;
create trigger trg_updated_by before insert or update on public.ponto_solicitacoes
  for each row execute function public.set_updated_by();
drop trigger if exists trg_auditoria on public.ponto_solicitacoes;
create trigger trg_auditoria after insert or update or delete on public.ponto_solicitacoes
  for each row execute function public.registrar_auditoria();

-- ── O gatilho que impede o autor de aprovar o próprio pedido ────────────────────
--
-- ⚠️ A policy de UPDATE do autor existe por um motivo mecânico: todo insert do `storeSync` é
-- `upsert`, então o REENVIO de um pedido cujo ACK se perdeu chega como UPDATE. Sem este
-- congelamento, essa policy seria uma porta para o funcionário reescrever a própria resposta.
create or replace function public.ponto_sol_congelar()
returns trigger language plpgsql as $fn$
begin
  -- A identidade e o teor do pedido não mudam NUNCA — nem para o gestor.
  new.id := old.id; new.organization_id := old.organization_id;
  new.worker_id := old.worker_id; new.auth_user_id := old.auth_user_id;
  new.data := old.data; new.acao := old.acao; new.tipo := old.tipo;
  new.hora_pedida := old.hora_pedida; new.corrige_id := old.corrige_id;
  new.motivo := old.motivo;
  new.created_by := old.created_by; new.created_at := old.created_at;
  -- O desfecho só o gestor escreve.
  if not public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]) then
    new.situacao := old.situacao; new.respondida_por := old.respondida_por;
    new.respondida_em := old.respondida_em; new.resposta := old.resposta;
    new.ajuste_id := old.ajuste_id;
  end if;
  new.updated_at := now();
  return new;
end; $fn$;
drop trigger if exists trg_ponto_sol_congelar on public.ponto_solicitacoes;
create trigger trg_ponto_sol_congelar before update on public.ponto_solicitacoes
  for each row execute function public.ponto_sol_congelar();

alter table public.ponto_solicitacoes enable row level security;
alter table public.ponto_solicitacoes force  row level security;

drop policy if exists ponto_sol_select on public.ponto_solicitacoes;
create policy ponto_sol_select on public.ponto_solicitacoes for select to authenticated
  using (organization_id = public.user_org()
    and (public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
         or auth_user_id = auth.uid()));

-- As MESMAS duas amarras de `ponto_insert`: a conta é de quem está logado, E o cadastro é o dela.
-- Sem a segunda, o pedido sairia com a conta certa e o FUNCIONÁRIO errado.
drop policy if exists ponto_sol_insert on public.ponto_solicitacoes;
create policy ponto_sol_insert on public.ponto_solicitacoes for insert to authenticated
  with check (
    organization_id = public.user_org()
    and created_by = auth.uid()
    and auth_user_id = auth.uid()
    and situacao = 'pendente' and respondida_por is null and ajuste_id is null
    and public.has_role(array['colaborador','planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
    and exists (
      select 1 from public.workers w
      where w.id = worker_id
        and w.organization_id = public.user_org()
        and w.deleted_at is null
        and w.payload->>'authUserId' = auth.uid()::text
    )
  );

drop policy if exists ponto_sol_update_gestor on public.ponto_solicitacoes;
create policy ponto_sol_update_gestor on public.ponto_solicitacoes for update to authenticated
  using (organization_id = public.user_org()
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  with check (organization_id = public.user_org());

-- Existe só para o reenvio da fila não travar em 42501. O gatilho acima a torna inofensiva.
drop policy if exists ponto_sol_update_autor on public.ponto_solicitacoes;
create policy ponto_sol_update_autor on public.ponto_solicitacoes for update to authenticated
  using  (organization_id = public.user_org() and auth_user_id = auth.uid() and situacao = 'pendente')
  with check (organization_id = public.user_org() and auth_user_id = auth.uid());

drop policy if exists ponto_sol_delete_blocked on public.ponto_solicitacoes;
create policy ponto_sol_delete_blocked on public.ponto_solicitacoes for delete to authenticated using (false);

grant select, insert, update on public.ponto_solicitacoes to authenticated;

-- ── A cerca do colaborador, estendida a esta tabela ────────────────────────────
--
-- ⚠️ A varredura de `20260918160000` é um RETRATO do schema no momento em que rodou: tabela criada
-- depois nasce **liberada**. Sem esta policy, o colaborador leria os pedidos de toda a empresa.
-- O recorte por titular já está em `ponto_sol_select`; aqui a restritiva o reforça de fora.
drop policy if exists colaborador_so_o_proprio_pedido on public.ponto_solicitacoes;
create policy colaborador_so_o_proprio_pedido on public.ponto_solicitacoes
  as restrictive for select to authenticated
  using (not public.e_colaborador() or auth_user_id = auth.uid());

-- ── Conferência ────────────────────────────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'ponto_solicitacoes';
  raise notice '%  ponto_solicitacoes com % policies (esperado 6)',
    case when n = 6 then '  OK  ' else '❌ CONFERIR' end, n;
end $$;
