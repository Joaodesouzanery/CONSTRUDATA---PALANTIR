-- 20260918150000_ponto_registros.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
-- ⚠️ DEPOIS de `20260918140000_user_role_colaborador.sql` — esta migração CITA o valor
--    'colaborador' do enum, e o Postgres não aceita usar um valor de enum na mesma transação em
--    que ele foi criado.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- PONTO ELETRÔNICO — o registro da jornada (CLT art. 74, Portaria 671/2021)
--
-- Uma linha por BATIDA. Não é apontamento de produção (`timecards`) nem escala (`shifts`): é o
-- instante em que uma pessoa registrou entrada, intervalo ou saída.
--
-- ─── O QUE ESTA TABELA FAZ DE DIFERENTE DAS OUTRAS ─────────────────────────────
--
-- 1. `momento_servidor default now()` — a hora do APARELHO chega no payload e é falsificável
--    (basta mudar o relógio do celular). A do servidor é gravada aqui, e `divergencia_relogio_s`
--    guarda a diferença entre as duas, calculada pelo gatilho. Sem essa coluna as duas horas
--    ficavam guardadas e nunca comparadas — que é o mesmo que não ter a segunda.
--
-- 2. `nsr` — Número Sequencial de Registro, exigido pela Portaria 671, atribuído por GATILHO.
--    Não pode vir do cliente: dois celulares offline gerariam o mesmo número. A sequência é POR
--    ORGANIZAÇÃO (cada empresa tem a sua numeração, começando em 1).
--
-- 3. `worker_id` + `auth_user_id` promovidos e NOT NULL. A identidade não pode depender de
--    `created_by`: o `fixOrg` do cliente (src/lib/storeSync.ts) reescreve aquele campo para quem
--    está sincronizando — num celular compartilhado no canteiro, a batida de um sairia com a
--    autoria de outro. Para cartão de ponto isso é falsificação.
--
-- 4. UPDATE existe, mas NÃO altera a prova: um gatilho congela identidade, tipo e horas. Corrige-se
--    com uma batida de `origem = 'ajuste'`, que preserva a original. DELETE é bloqueado.
--
-- ⚠️ `created_by` existe porque o `fixOrg` INJETA essa coluna em toda op da fila — tabela sem ela
-- devolve PGRST204, que o storeSync trata como "aguardando servidor": retry infinito e silencioso.
-- Foi o defeito que o Operacional teve.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.ponto_registros (
  id                     uuid primary key,
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  worker_id              uuid not null,
  auth_user_id           uuid not null references auth.users(id),
  site_id                uuid,
  tipo                   text not null check (tipo in ('entrada','inicio_intervalo','fim_intervalo','saida')),
  data                   date not null,
  momento_dispositivo    timestamptz not null,
  momento_servidor       timestamptz not null default now(),
  -- Segundos entre a hora do servidor e a do aparelho. Positivo = o aparelho está atrasado, o que
  -- é o NORMAL de uma batida feita sem rede e sincronizada depois. NEGATIVO é o sinal que importa:
  -- o aparelho diz ter batido no FUTURO do servidor, e isso só acontece com relógio adulterado.
  divergencia_relogio_s  integer,
  nsr                    bigint,
  origem                 text not null default 'app' check (origem in ('app','ajuste')),
  payload                jsonb not null default '{}'::jsonb,
  created_by             uuid not null references auth.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);

-- Reaplicação em banco que já tem a tabela da primeira versão desta migração.
alter table public.ponto_registros add column if not exists divergencia_relogio_s integer;
-- ⚠️ A auditoria genérica (20260829120000) liga os gatilhos por VARREDURA do information_schema, e
-- a varredura já rodou: tabela criada depois nasce FORA da auditoria, em silêncio. A coluna e os
-- dois gatilhos abaixo são o que a traz de volta — mesmo remendo de `fcp_planos`.
alter table public.ponto_registros
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

create index if not exists idx_ponto_org            on public.ponto_registros(organization_id);
create index if not exists idx_ponto_org_data       on public.ponto_registros(organization_id, data desc) where deleted_at is null;
create index if not exists idx_ponto_worker_data    on public.ponto_registros(organization_id, worker_id, data desc) where deleted_at is null;
-- ⚠️ A policy de SELECT do colaborador filtra por `auth_user_id`. Sem este índice, cada abertura
-- da tela do ponto no canteiro varre a tabela inteira da empresa.
create index if not exists idx_ponto_conta_data     on public.ponto_registros(organization_id, auth_user_id, data desc) where deleted_at is null;
create unique index if not exists idx_ponto_nsr     on public.ponto_registros(organization_id, nsr) where nsr is not null;

-- ── O NSR, por organização ──────────────────────────────────────────────────────
create or replace function public.ponto_atribuir_nsr()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.nsr is null then
    -- ⚠️ TRAVA POR ORGANIZAÇÃO, com lock consultivo — e NÃO com `select max(...) for update`.
    -- Aquela forma nem roda: o Postgres recusa `FOR UPDATE` junto de função de agregação
    -- ("FOR UPDATE is not allowed with aggregate functions"), então TODO insert falharia. E,
    -- mesmo que rodasse, `for update` não tranca nada numa tabela vazia — a primeira batida de
    -- duas organizações simultâneas passaria pelo mesmo caminho.
    --
    -- O lock consultivo é de TRANSAÇÃO (`_xact_`): solta sozinho no commit ou no rollback, sem
    -- depender de o gatilho terminar bem. Dois celulares sincronizando ao mesmo tempo entram em
    -- fila; sem isso os dois leriam o mesmo `max(nsr)` e um quebraria no índice único — op presa
    -- na fila para sempre.
    perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 0));

    select coalesce(max(r.nsr), 0) + 1 into new.nsr
    from public.ponto_registros r
    where r.organization_id = new.organization_id;
  end if;

  -- A comparação dos dois relógios, feita no servidor porque só ele tem o relógio confiável.
  new.divergencia_relogio_s :=
    extract(epoch from (coalesce(new.momento_servidor, now()) - new.momento_dispositivo))::integer;

  return new;
end;
$fn$;

drop trigger if exists trg_ponto_nsr on public.ponto_registros;
create trigger trg_ponto_nsr before insert on public.ponto_registros
  for each row execute function public.ponto_atribuir_nsr();

-- ── A prova não se reescreve ────────────────────────────────────────────────────
-- ⚠️ Este gatilho é o que torna "inalterável" um fato e não um comentário. Sem ele, a policy de
-- UPDATE do gestor permitiria reescrever hora, tipo e dono da batida — exatamente o que a
-- Portaria 671 proíbe, e exatamente o que o texto acima promete que não acontece.
--
-- Também é ele que faz o REENVIO funcionar. Todo insert do `storeSync` é `upsert(onConflict:id)`:
-- quando o ACK da rede se perde, a fila reenvia a MESMA batida e o Postgres cai no caminho de
-- UPDATE. Sem uma policy de UPDATE para o autor, isso devolve 42501 — classe bloqueante — numa
-- batida que JÁ está gravada. Com a policy abaixo + este gatilho, o reenvio vira uma gravação
-- inofensiva dos mesmos valores.
create or replace function public.ponto_congelar_prova()
returns trigger
language plpgsql
as $fn$
begin
  new.id                  := old.id;
  new.organization_id     := old.organization_id;
  new.worker_id           := old.worker_id;
  new.auth_user_id        := old.auth_user_id;
  new.tipo                := old.tipo;
  new.data                := old.data;
  new.momento_dispositivo := old.momento_dispositivo;
  new.momento_servidor    := old.momento_servidor;
  new.divergencia_relogio_s := old.divergencia_relogio_s;
  new.nsr                 := old.nsr;
  new.origem              := old.origem;
  new.created_by          := old.created_by;
  new.created_at          := old.created_at;
  new.updated_at          := now();
  -- Sobram mutáveis, de propósito: `site_id` (obra cadastrada depois), `payload` (anotação de
  -- conferência) e `deleted_at` (o soft delete é como o projeto inteiro apaga — e aqui ele só
  -- ESCONDE da lista, sem tirar a linha do banco).
  return new;
end;
$fn$;

drop trigger if exists trg_ponto_congelar on public.ponto_registros;
create trigger trg_ponto_congelar before update on public.ponto_registros
  for each row execute function public.ponto_congelar_prova();

-- Autor de criação/alteração e trilha de auditoria, no molde do resto do projeto.
-- ⚠️ A ordem importa e é alfabética entre gatilhos do mesmo momento: `trg_ponto_congelar` roda
-- ANTES de `trg_updated_by`, então congelar a prova não apaga o autor da alteração.
drop trigger if exists trg_updated_by on public.ponto_registros;
create trigger trg_updated_by before insert or update on public.ponto_registros
  for each row execute function public.set_updated_by();

drop trigger if exists trg_auditoria on public.ponto_registros;
create trigger trg_auditoria after insert or update or delete on public.ponto_registros
  for each row execute function public.registrar_auditoria();

-- ── RLS ─────────────────────────────────────────────────────────────────────────
alter table public.ponto_registros enable row level security;
alter table public.ponto_registros force  row level security;

-- SELECT sem `deleted_at is null` — o padrão adotado em `20260824130000`.
-- ⚠️ O COLABORADOR só enxerga as PRÓPRIAS batidas. É o único papel com leitura recortada no
-- projeto, e é deliberado: cartão de ponto alheio não é assunto de colega.
drop policy if exists ponto_select_own_org on public.ponto_registros;
create policy ponto_select_own_org on public.ponto_registros for select to authenticated
  using (
    organization_id = public.user_org()
    and (
      public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
      or auth_user_id = auth.uid()
    )
  );

-- ⚠️ O colaborador PODE inserir — é a única escrita dele no sistema inteiro. E só a própria:
-- `auth_user_id = auth.uid()` impede bater o ponto NO LUGAR de outra pessoa.
--
-- ⚠️ E `worker_id` tem de ser o cadastro DAQUELA conta. Sem esta segunda amarra, `auth_user_id`
-- sozinho não protege nada que importe: a batida sairia com a conta certa e o FUNCIONÁRIO errado,
-- e é `worker_id` que nomeia a pessoa no espelho, na folha e no relatório da contabilidade. O
-- vínculo mora em `workers.payload->>'authUserId'` (viaja no jsonb, sem coluna própria).
drop policy if exists ponto_insert on public.ponto_registros;
create policy ponto_insert on public.ponto_registros for insert to authenticated
  with check (
    organization_id = public.user_org()
    and created_by = auth.uid()
    and auth_user_id = auth.uid()
    and origem = 'app'
    and public.has_role(array['colaborador','planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
    and exists (
      select 1 from public.workers w
      where w.id = worker_id
        and w.organization_id = public.user_org()
        and w.deleted_at is null
        and w.payload->>'authUserId' = auth.uid()::text
    )
  );

-- Ajuste e inclusão retroativa: só gestor, e sempre marcados como 'ajuste'.
drop policy if exists ponto_insert_ajuste on public.ponto_registros;
create policy ponto_insert_ajuste on public.ponto_registros for insert to authenticated
  with check (
    organization_id = public.user_org()
    and created_by = auth.uid()
    and origem = 'ajuste'
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );

-- ⚠️ Duas policies de UPDATE, e as duas passam pelo gatilho `trg_ponto_congelar` — nenhuma delas
-- consegue mexer em hora, tipo ou dono.
--   · gestor: anota conferência no payload, corrige a obra, esconde por soft delete.
--   · autor:  existe só para o REENVIO da fila (upsert que vira UPDATE) não travar em 42501.
drop policy if exists ponto_update_gestor on public.ponto_registros;
create policy ponto_update_gestor on public.ponto_registros for update to authenticated
  using (organization_id = public.user_org()
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  with check (organization_id = public.user_org());

drop policy if exists ponto_update_autor_reenvio on public.ponto_registros;
create policy ponto_update_autor_reenvio on public.ponto_registros for update to authenticated
  using (organization_id = public.user_org() and auth_user_id = auth.uid())
  with check (organization_id = public.user_org() and auth_user_id = auth.uid());

drop policy if exists ponto_delete_blocked on public.ponto_registros;
create policy ponto_delete_blocked on public.ponto_registros for delete to authenticated using (false);

grant select, insert, update on public.ponto_registros to authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────────
select
  case when count(*) = 1 then '  OK  ' else '❌ FALTA' end as situacao,
  count(*) || ' de 1 tabela criada (ponto_registros)' as item
from information_schema.tables
where table_schema = 'public' and table_name = 'ponto_registros'
union all
select
  -- ⚠️ `count(DISTINCT trigger_name)`, não `count(*)`. `information_schema.triggers` devolve UMA
  -- LINHA POR EVENTO: `trg_updated_by` (insert ou update) conta 2 e `trg_auditoria` (insert, update
  -- ou delete) conta 3 — os quatro gatilhos somam SETE linhas. A primeira versão desta conferência
  -- dizia "❌ FALTA — 7 de 4" num banco perfeitamente correto.
  case when count(distinct trigger_name) = 4 then '  OK  ' else '❌ FALTA' end,
  count(distinct trigger_name) || ' de 4 gatilhos (NSR, congelar a prova, autor, auditoria)'
from information_schema.triggers
where event_object_table = 'ponto_registros'
  and trigger_name in ('trg_ponto_nsr','trg_ponto_congelar','trg_updated_by','trg_auditoria')
union all
select
  case when count(*) = 6 then '  OK  ' else '❌ FALTA' end,
  count(*) || ' de 6 policies'
from pg_policies
where schemaname = 'public' and tablename = 'ponto_registros';
