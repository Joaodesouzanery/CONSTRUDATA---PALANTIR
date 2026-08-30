-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.
-- Requer `20260830120000_fcp_planos` e `20260830130000_auditoria_origem`.
--
-- A porta de entrada da integração: lançar produção realizada de fora do app.
--
-- ⚠️ **Por que uma RPC e não um UPDATE direto pelo cliente HTTP.** A origem só é registrada se
-- `set_config('app.origem', …, true)` acontecer na MESMA transação do UPDATE — e o `true` (escopo
-- de transação) é obrigatório, senão a marca vaza para a próxima requisição da mesma conexão do
-- pool, e uma escrita de pessoa sairia carimbada como n8n. O supabase-js não dá transação; uma
-- função dá, porque o corpo dela É uma transação. Então a única forma de garantir as duas coisas
-- juntas é fazer as duas aqui dentro.

create or replace function public.fcp_lancar_producao(
  p_plano_id  uuid,
  p_cidade_id text,
  p_semana    integer,
  p_valor     numeric,
  p_origem    text default 'integracao'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano   public.fcp_planos%rowtype;
  v_atual   jsonb;
  v_cidade  jsonb;
  v_anterior numeric;
begin
  if p_semana is null or p_semana < 1 or p_semana > 260 then
    raise exception 'semana fora da faixa (1 a 260): %', p_semana using errcode = '22023';
  end if;

  select * into v_plano from public.fcp_planos where id = p_plano_id and deleted_at is null;
  if not found then
    raise exception 'plano nao encontrado: %', p_plano_id using errcode = 'P0002';
  end if;

  -- A marca de origem. `true` = só nesta transação — ver o comentário do topo.
  perform set_config('app.origem', coalesce(nullif(p_origem, ''), 'integracao'), true);

  v_atual  := coalesce(v_plano.payload -> 'realizado', '{}'::jsonb);
  v_cidade := coalesce(v_atual -> p_cidade_id, '{}'::jsonb);
  v_anterior := nullif(v_cidade ->> p_semana::text, '')::numeric;

  -- ⚠️ `null` APAGA o lançamento; a semana volta a usar o previsto. É o que desfazer um número
  -- digitado errado precisa fazer — e é diferente de lançar zero, que quer dizer "não produziu".
  if p_valor is null then
    v_cidade := v_cidade - p_semana::text;
  else
    v_cidade := jsonb_set(v_cidade, array[p_semana::text], to_jsonb(p_valor));
  end if;

  update public.fcp_planos
     set payload = jsonb_set(payload, '{realizado}', jsonb_set(v_atual, array[p_cidade_id], v_cidade))
   where id = p_plano_id;

  return jsonb_build_object(
    'plano',     p_plano_id,
    'cidade',    p_cidade_id,
    'semana',    p_semana,
    'anterior',  v_anterior,
    'agora',     p_valor,
    'origem',    coalesce(nullif(p_origem, ''), 'integracao')
  );
end $$;

-- ⚠️ NÃO é liberada para `authenticated`. Quem escreve pelo app usa o store, que passa pela RLS
-- normal e é auditado com o nome da pessoa. Esta função existe para a service role (Edge Function
-- do webhook), e liberá-la ao usuário comum daria a qualquer um a capacidade de escrever num
-- plano de outra obra, porque ela é SECURITY DEFINER e não checa `user_org()`.
revoke all on function public.fcp_lancar_producao(uuid, text, integer, numeric, text) from public;
revoke all on function public.fcp_lancar_producao(uuid, text, integer, numeric, text) from authenticated;

comment on function public.fcp_lancar_producao(uuid, text, integer, numeric, text) is
  'Lanca producao realizada no FCP de fora do app, marcando a origem no audit_log. Service role apenas.';

select
  (select count(*) from pg_proc where proname = 'fcp_lancar_producao')                as rpc_criada,
  (select count(*) from information_schema.role_routine_grants
    where routine_name = 'fcp_lancar_producao' and grantee = 'authenticated')         as liberada_ao_usuario;
