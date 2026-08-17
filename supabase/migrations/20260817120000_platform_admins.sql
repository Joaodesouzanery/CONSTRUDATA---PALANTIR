-- 20260817120000_platform_admins.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- O ADMINISTRADOR DA PLATAFORMA SAI DO CÓDIGO E VIRA DADO
--
-- O QUE MUDA. `is_global_admin()` comparava `auth.users.email` com um literal escrito dentro
-- da própria função. Esse mesmo endereço estava escrito, de novo e à mão, em
-- `src/lib/globalAdmin.ts` — ou seja, no JavaScript que qualquer visitante da landing baixa —
-- e ainda era impresso na tela em três páginas administrativas. Duas cópias independentes da
-- mesma verdade, sem nada que forçasse as duas a andarem juntas.
--
-- POR QUE ISSO IMPORTA MAIS DO QUE PARECE. Esta função não decide uma telinha: ela está
-- embutida dentro de `user_org()`, `user_role()`, `has_role()`, `has_org_access()`,
-- `has_org_role()` e `set_default_organization()` (20260525190000_global_admin_all_org_access).
-- Na prática, quem ela aprova é `owner` de TODA organização em TODA policy do banco. Trocar
-- esse endereço, ou revogá-lo, era editar código e fazer deploy.
--
-- O QUE ESTA MIGRATION NÃO FAZ. Ela não reduz o poder da conta — continua sendo acesso total a
-- todos os clientes. Ela só move a decisão para um lugar onde dá para consultar, revogar e
-- auditar sem deploy. Reduzir o poder (por exemplo, exigir segundo fator para essa conta, ou
-- registrar cada entrada em organização de cliente) está anotado no SECURITY.md.
--
-- ORDEM DE APLICAÇÃO: pode aplicar antes ou depois do deploy do front. O cliente novo pergunta
-- ao servidor via RPC `is_global_admin()`, que existe nos dois estados e responde certo nos
-- dois. Rodar duas vezes não faz nada.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── A tabela ────────────────────────────────────────────────────────────────────
create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  nota        text,                                   -- para que serve esta conta
  criado_em   timestamptz not null default now(),
  revogado_em timestamptz                             -- revogar sem apagar preserva o histórico
);

comment on table public.platform_admins is
  'Contas com acesso a todas as organizações. Lida apenas por public.is_global_admin(). '
  'Para revogar, preencha revogado_em — não apague a linha, o histórico importa.';

-- ── Ninguém lê esta tabela direto ───────────────────────────────────────────────
-- RLS ligada sem NENHUMA policy: nem `anon` nem `authenticated` conseguem selecionar. O único
-- acesso é pela função abaixo, que é SECURITY DEFINER e devolve só um booleano sobre quem
-- perguntou. Sem isso, qualquer usuário autenticado poderia listar quem são os administradores
-- da plataforma — e saber a quem atacar.
alter table public.platform_admins enable row level security;
alter table public.platform_admins force  row level security;
revoke all on table public.platform_admins from anon, authenticated;

-- ── Semear com a conta atual, preservando o comportamento de hoje ───────────────
-- Se o e-mail não existir em auth.users, o insert simplesmente não acontece e a função cai no
-- caminho de compatibilidade abaixo — nada quebra.
insert into public.platform_admins (user_id, nota)
select u.id, 'Conta de operação da ConstruData (migrada do literal em is_global_admin)'
  from auth.users u
 where lower(u.email) = 'joaoneryflu@gmail.com'
on conflict (user_id) do nothing;

-- ── A função passa a consultar a tabela ─────────────────────────────────────────
create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
      from public.platform_admins pa
     where pa.user_id = auth.uid()
       and pa.revogado_em is null
  )
  -- NÃO EXISTE REDE DE SEGURANÇA COM O E-MAIL ANTIGO, e a ausência é deliberada.
  --
  -- A primeira versão desta migration mantinha um `or` com o literal, válido enquanto a tabela
  -- estivesse vazia, para ninguém ficar trancado para fora caso a semente não encontrasse a
  -- conta. Duas passagens de teste mostraram que a ideia é pior que o problema:
  --
  --  1. A chave é `on delete cascade`. Apagar a conta em Authentication → Users — um botão —
  --     esvazia a tabela e **rearma o literal**.
  --  2. Rearmado, ele aprova qualquer sessão cujo e-mail seja aquele. Com `enable_signup`
  --     ligado e confirmação de e-mail desligada, conseguir essa sessão é criar uma conta com
  --     o endereço, que ficou livre justamente porque a conta foi apagada.
  --
  -- O resultado seria acesso de owner a TODOS os inquilinos por um caminho de um clique. Um
  -- travamento é recuperável com um `insert` no SQL Editor; isso não seria.
  ;
$$;

revoke all     on function public.is_global_admin() from public;
revoke execute on function public.is_global_admin() from anon;
-- `authenticated` precisa executar: o app chama esta RPC para saber se mostra as telas de
-- administração. Ela responde apenas sobre quem chamou, nunca lista ninguém.
grant  execute on function public.is_global_admin() to authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────────
-- ⚠️ SE VIER "VAZIA", LEIA: a semente não encontrou a conta em auth.users e NINGUÉM é
-- administrador de plataforma agora — as três telas administrativas somem para todo mundo.
-- Não é perda de dado e conserta-se com uma linha, pegando o id em Authentication → Users:
--   insert into public.platform_admins (user_id, nota) values ('<uuid>', 'conta de operação');
select
  case when count(*) filter (where revogado_em is null) > 0
       then '  OK  ' else '❌ VAZIA — ver a instrução logo acima desta consulta' end as situacao,
  count(*) filter (where revogado_em is null) as admins_ativos,
  count(*) filter (where revogado_em is not null) as revogados
from public.platform_admins;
