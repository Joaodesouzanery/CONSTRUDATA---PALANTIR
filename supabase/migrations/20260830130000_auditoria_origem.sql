-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.
-- Requer a `20260829120000_auditoria_generica` aplicada antes.
--
-- A auditoria passa a registrar a ORIGEM da escrita.
--
-- O problema: o gatilho grava `auth.uid()` como ator. Quem escreve pela service role — o webhook
-- do n8n, um script, uma Edge Function — não tem `auth.uid()`, e a linha do log sai com ator nulo.
-- Na tela isso vira "sistema", que é verdade e é inútil: não distingue o webhook do n8n de um
-- gatilho interno, e era exatamente isso que o pedido queria ("identificando a origem como
-- integração").
--
-- A solução é uma variável de sessão. Quem escreve declara de onde está escrevendo:
--
--   select set_config('app.origem', 'n8n:producao-semanal', true);
--   update public.fcp_planos set ... ;
--
-- O `true` faz a variável valer só até o fim da TRANSAÇÃO — sem isso ela vazaria para a próxima
-- operação da mesma conexão, e o pool do Supabase reusa conexão entre requisições de gente
-- diferente. Uma escrita do João sairia marcada como n8n.
--
-- Onde a origem é gravada: na coluna `user_agent`, que já existe e é exatamente isto — "o que fez
-- esta requisição". Não é coluna nova.

create or replace function public.registrar_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_antes  jsonb;
  v_depois jsonb;
  v_acao   text;
  v_org    uuid;
  v_id     text;
  v_origem text;
begin
  -- Quem não declarar origem fica sem — e "sem origem" quer dizer "veio do app", que é o caso
  -- normal e já está identificado pelo ator.
  v_origem := nullif(current_setting('app.origem', true), '');

  if TG_OP = 'DELETE' then
    v_antes  := to_jsonb(OLD);
    v_depois := null;
    v_acao   := 'delete';
  elsif TG_OP = 'INSERT' then
    v_antes := null;
    v_depois := to_jsonb(NEW);
    v_acao := 'insert';
  else
    v_antes  := to_jsonb(OLD);
    v_depois := to_jsonb(NEW);

    -- Nada mudou de fato → não registra. `updated_at` e `updated_by` são carimbos automáticos.
    if (v_antes - 'updated_at' - 'updated_by') = (v_depois - 'updated_at' - 'updated_by') then
      return NEW;
    end if;

    -- Soft delete é exclusão, e restauração é restauração.
    if  (v_antes ->> 'deleted_at') is null and (v_depois ->> 'deleted_at') is not null then
      v_acao := 'delete';
    elsif (v_antes ->> 'deleted_at') is not null and (v_depois ->> 'deleted_at') is null then
      v_acao := 'restore';
    else
      v_acao := 'update';
    end if;

    -- Payload igual dos dois lados sai dos dois lados.
    if (v_antes -> 'payload') is not distinct from (v_depois -> 'payload') then
      v_antes  := v_antes  - 'payload';
      v_depois := v_depois - 'payload';
    end if;
  end if;

  v_org := coalesce(v_depois ->> 'organization_id', v_antes ->> 'organization_id')::uuid;
  v_id  := coalesce(v_depois ->> 'id',              v_antes ->> 'id');

  if v_org is null then
    return coalesce(NEW, OLD);
  end if;

  insert into public.audit_log
    (organization_id, actor_id, action, table_name, record_id, before, after, user_agent)
  values
    (v_org, auth.uid(), v_acao, TG_TABLE_NAME, v_id, v_antes, v_depois, v_origem);

  return coalesce(NEW, OLD);
exception when others then
  -- ⚠️ Auditoria NUNCA derruba a operação do usuário.
  return coalesce(NEW, OLD);
end $$;

-- A RPC da tela passa a devolver a origem, para a Auditoria mostrar "veio do n8n".
drop function if exists public.auditoria_da_organizacao(timestamptz, timestamptz, uuid, text, text, integer, integer);
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
  action text, table_name text, record_id text, before jsonb, after jsonb, origem text
)
language sql stable security definer set search_path = public as $$
  select a.id, a.created_at, a.actor_id, p.full_name,
         a.action, a.table_name, a.record_id, a.before, a.after, a.user_agent
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

comment on function public.registrar_auditoria() is
  'Gatilho generico de auditoria. Grava a origem de app.origem em user_agent quando declarada.';

select
  (select count(*) from pg_proc where proname = 'registrar_auditoria')       as gatilho_atualizado,
  (select count(*) from pg_proc where proname = 'auditoria_da_organizacao')  as rpc_atualizada;
