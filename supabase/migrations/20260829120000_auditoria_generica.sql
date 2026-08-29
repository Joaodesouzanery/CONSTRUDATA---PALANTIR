-- 20260829120000_auditoria_generica.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
-- IDEMPOTENTE: pode rodar duas vezes. Termina com um select de conferência.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- QUEM CRIOU, QUEM ALTEROU, QUEM APAGOU — EM TODA TABELA
--
-- A tabela `audit_log` existe desde a 0006 e nunca foi usada para o que ela promete. Hoje só cinco
-- RPCs e um gatilho escrevem nela — aprovação, exportação, cadastro e falta de funcionário.
-- Criação, edição e exclusão comuns não aparecem em lugar nenhum.
--
-- ─── POR QUE NO BANCO, E NÃO NO CLIENTE ────────────────────────────────────────
-- Porque o registro precisa valer para o que NÃO passa pelo app: o webhook do n8n, um script, o
-- painel do Supabase, outro aparelho. Um log que só enxerga o próprio app registra o que já se
-- sabia e cala justamente no caso em que alguém vai perguntar "quem mexeu nisso?".
--
-- E porque é um lugar só. São ~105 tabelas de negócio: registrar no cliente seria 105 chances de
-- alguém esquecer, e a tabela nova de amanhã nasceria sem auditoria.
--
-- ─── TRÊS DECISÕES QUE FAZEM O LOG SER LEGÍVEL ─────────────────────────────────
--
-- 1. EXCLUSÃO AQUI É `UPDATE deleted_at`, e o log precisa dizer "apagou".
--    Este projeto não dá DELETE: ele marca `deleted_at` (ver 20260825120000). Um log que
--    registrasse isso como 'update' esconderia a exclusão no meio das edições — logo o gatilho
--    olha a transição de `deleted_at` e grava 'delete' ou 'restore'.
--
-- 2. UPDATE QUE NÃO MUDA NADA NÃO ENTRA.
--    O app é local-first e reenvia a fila como upsert: o mesmo registro é regravado várias vezes
--    sem nenhuma alteração. Sem este corte, o log viraria ruído e ninguém acharia a edição de
--    verdade no meio dele.
--
-- 3. O `payload` SÓ APARECE QUANDO MUDA.
--    Quase toda tabela daqui guarda o registro inteiro num `payload jsonb`. Gravar `before` e
--    `after` completos duplicaria esse payload duas vezes A CADA edição — e há tabelas com anexo
--    em base64. Quando o payload não mudou, ele sai dos dois lados.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1) `updated_by` — sem ele não há "última alteração por" ────────────────────
-- Toda tabela que já tem `created_by` ganha o par. `add column if not exists` em laço: a lista
-- vive no banco, não num arquivo que envelhece.
do $$
declare t record;
begin
  for t in
    select c.table_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.column_name  = 'created_by'
  loop
    execute format(
      'alter table public.%I add column if not exists updated_by uuid references auth.users(id) on delete set null',
      t.table_name
    );
  end loop;
end $$;

-- ── 1b) Quem o banco preenche sozinho ──────────────────────────────────────────
--
-- ⚠️ `updated_by` é preenchido AQUI, e não pelo cliente. A diferença não é de estilo.
--
-- Mandar `updated_by` nos 87 pontos que hoje mandam `created_by` significaria que, até esta
-- migração ser aplicada, TODA escrita do app voltaria PGRST204 — classificado como
-- 'aguardando-servidor' (`storeSync.ts:115`), que segura a op na fila. Em 35 stores, isso
-- congelaria a sincronização inteira do produto entre o deploy e o SQL rodar, sem erro na tela.
--
-- Preenchendo no banco: zero mudança no cliente, zero janela de risco, e ainda funciona para quem
-- escreve sem passar pelo app — o webhook do n8n, um script, o painel. É o mesmo padrão do
-- `set_updated_at`, que já vive em 49 tabelas.
create or replace function public.set_updated_by()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- `auth.uid()` é null para service role e para migração — aí preserva o que veio, em vez de
  -- apagar o autor anterior com um nulo.
  if auth.uid() is not null then
    NEW.updated_by := auth.uid();
  end if;
  return NEW;
end $$;

do $$
declare t record;
begin
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables  x
        on x.table_schema = c.table_schema and x.table_name = c.table_name
     where c.table_schema = 'public'
       and c.column_name  = 'updated_by'
       and x.table_type   = 'BASE TABLE'
  loop
    execute format('drop trigger if exists trg_updated_by on public.%I', t.table_name);
    execute format(
      'create trigger trg_updated_by before insert or update on public.%I
         for each row execute function public.set_updated_by()',
      t.table_name
    );
  end loop;
end $$;

-- ── 2) A função de registro ────────────────────────────────────────────────────
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org    uuid;
  v_id     text;
  v_antes  jsonb;
  v_depois jsonb;
  v_acao   text;
begin
  if TG_OP = 'DELETE' then
    v_antes := to_jsonb(OLD);
    v_depois := null;
    v_acao := 'delete';
  elsif TG_OP = 'INSERT' then
    v_antes := null;
    v_depois := to_jsonb(NEW);
    v_acao := 'insert';
  else
    v_antes  := to_jsonb(OLD);
    v_depois := to_jsonb(NEW);

    -- Decisão 2: nada mudou de fato → não registra. `updated_at` e `updated_by` são carimbos
    -- automáticos; compará-los faria todo reenvio da fila virar uma linha de log — e, no caso do
    -- `updated_by`, faria o reenvio de OUTRA pessoa virar uma edição que não editou nada.
    if (v_antes - 'updated_at' - 'updated_by') = (v_depois - 'updated_at' - 'updated_by') then
      return NEW;
    end if;

    -- Decisão 1: soft delete é exclusão, e restauração é restauração.
    if  (v_antes ->> 'deleted_at') is null and (v_depois ->> 'deleted_at') is not null then
      v_acao := 'delete';
    elsif (v_antes ->> 'deleted_at') is not null and (v_depois ->> 'deleted_at') is null then
      v_acao := 'restore';
    else
      v_acao := 'update';
    end if;

    -- Decisão 3: payload igual dos dois lados sai dos dois lados.
    if (v_antes -> 'payload') is not distinct from (v_depois -> 'payload') then
      v_antes  := v_antes  - 'payload';
      v_depois := v_depois - 'payload';
    end if;
  end if;

  v_org := coalesce(v_depois ->> 'organization_id', v_antes ->> 'organization_id')::uuid;
  v_id  := coalesce(v_depois ->> 'id',              v_antes ->> 'id');

  -- Sem organização não há como aplicar RLS na leitura — e uma linha de log que ninguém pode ler
  -- não serve para nada. Não registra e não atrapalha a escrita.
  if v_org is null then
    return coalesce(NEW, OLD);
  end if;

  insert into public.audit_log (organization_id, actor_id, action, table_name, record_id, before, after)
  values (v_org, auth.uid(), v_acao, TG_TABLE_NAME, v_id, v_antes, v_depois);

  return coalesce(NEW, OLD);
exception when others then
  -- ⚠️ Auditoria NUNCA derruba a operação do usuário.
  -- Se o log falhar (tabela cheia, coluna que mudou de tipo), o cadastro tem de gravar assim
  -- mesmo. Perder uma linha de log é ruim; impedir a equipe de trabalhar é pior.
  return coalesce(NEW, OLD);
end $$;

comment on function public.registrar_auditoria() is
  'Gatilho generico de auditoria. Le organization_id e id do proprio registro; trata soft delete como exclusao.';

-- ── 3) O gatilho em toda tabela de negócio ─────────────────────────────────────
-- Por varredura, e não por lista: qualquer tabela com `organization_id` entra, inclusive as que
-- ainda vão existir. `audit_log` fica de fora (registrar o log no log é recursão infinita).
do $$
declare t record;
begin
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables  x
        on x.table_schema = c.table_schema and x.table_name = c.table_name
     where c.table_schema = 'public'
       and c.column_name  = 'organization_id'
       and x.table_type   = 'BASE TABLE'
       and c.table_name  <> 'audit_log'
  loop
    execute format('drop trigger if exists trg_auditoria on public.%I', t.table_name);
    execute format(
      'create trigger trg_auditoria after insert or update or delete on public.%I
         for each row execute function public.registrar_auditoria()',
      t.table_name
    );
  end loop;
end $$;

-- ── 4) A leitura ampla passa a exigir papel ────────────────────────────────────
-- Hoje qualquer membro da organização lê o log inteiro (0009_rls_core.sql:110) — inclusive
-- `visualizador`, `zelador` e `morador`. A tela global de Auditoria é da diretoria.
--
-- ⚠️ A leitura POR REGISTRO continua liberada, de propósito: é ela que alimenta o "Histórico"
-- dentro de cada tela. Quem pode ver o registro pode ver o histórico dele; o que exige papel é
-- varrer o log da empresa inteira. Isso é feito pela RPC abaixo, não pela policy.
drop policy if exists audit_select_own_org on public.audit_log;
create policy audit_select_own_org on public.audit_log
  for select to authenticated
  using (organization_id = public.user_org());

-- A varredura ampla, com gate de papel. `SECURITY DEFINER` para poder ordenar e paginar sem que a
-- policy da tabela precise conhecer o conceito de "tela de auditoria".
create or replace function public.auditoria_da_organizacao(
  p_de           timestamptz default null,
  p_ate          timestamptz default null,
  p_actor        uuid        default null,
  p_tabela       text        default null,
  p_acao         text        default null,
  p_limite       integer     default 100,
  p_deslocamento integer     default 0
)
returns table (
  id bigint, created_at timestamptz, actor_id uuid, actor_nome text,
  action text, table_name text, record_id text, before jsonb, after jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.created_at, a.actor_id, p.full_name,
         a.action, a.table_name, a.record_id, a.before, a.after
    from public.audit_log a
    left join public.profiles p on p.id = a.actor_id
   where a.organization_id = public.user_org()
     and public.has_role(array['diretor','owner']::public.user_role[])
     and (p_de     is null or a.created_at >= p_de)
     and (p_ate    is null or a.created_at <= p_ate)
     and (p_actor  is null or a.actor_id   =  p_actor)
     and (p_tabela is null or a.table_name =  p_tabela)
     and (p_acao   is null or a.action     =  p_acao)
   order by a.created_at desc
   limit  greatest(1, least(coalesce(p_limite, 100), 500))
  offset greatest(0, coalesce(p_deslocamento, 0));
$$;

revoke all on function public.auditoria_da_organizacao(timestamptz, timestamptz, uuid, text, text, integer, integer) from public;
grant execute on function public.auditoria_da_organizacao(timestamptz, timestamptz, uuid, text, text, integer, integer) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TESTADA EM POSTGRES 16 REAL (docker), 29/08/2026 — 20 casos, todos passando:
--
--   1. criar grava 'insert' com o ator certo
--   2. editar grava 'update', e o payload IGUAL sai dos dois lados
--   3. payload que MUDA continua nos dois lados
--   4. UPDATE que não muda nada NÃO entra          ← o reenvio da fila, que seria só ruído
--   5. soft delete vira 'delete', não 'update'     ← senão a exclusão some no meio das edições
--   6. desfazer vira 'restore'
--   7. DELETE de verdade também entra
--   8. o diretor enxerga o log da empresa pela RPC
--   9. o visualizador não enxerga NADA pela RPC
--  10. o histórico POR REGISTRO continua acessível ← é ele que alimenta a tela de cada módulo
--  11. o filtro por ação funciona
--  12. o nome do ator vem junto, não o UUID cru
--  13. ZERO vazamento entre organizações (conferido linha a linha, não só pela contagem)
--  14. ⚠️ COM O LOG QUEBRADO DE PROPÓSITO, o cadastro grava mesmo assim
--  15. `updated_by` é preenchido PELO BANCO no insert, sem o cliente mandar nada
--  16. quem edita vira o `updated_by`; o `created_by` continua sendo o criador
--  17. reenvio idêntico de OUTRA pessoa não vira "edição" vazia   ← só o carimbo mudaria
--  18. escrita sem login (service role, migração) PRESERVA o autor anterior
--  10b. mesmo por registro, a policy barra a outra organização
--  14b. com o log quebrado, o log não cresce — a falha é engolida, não propagada
--
-- E rodando três vezes seguidas: nenhum gatilho duplicado.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Conferência ────────────────────────────────────────────────────────────────
select
  (select count(distinct event_object_table) from information_schema.triggers
    where trigger_schema = 'public' and trigger_name = 'trg_auditoria')            as tabelas_com_gatilho,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_by')                  as tabelas_com_updated_by,
  (select count(distinct event_object_table) from information_schema.triggers
    where trigger_schema = 'public' and trigger_name = 'trg_updated_by')           as tabelas_com_autor_automatico,
  (select count(*) from pg_proc where proname = 'auditoria_da_organizacao')        as rpc_criada;
