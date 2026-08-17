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
  -- REDE DE SEGURANÇA contra ficar trancado para fora, e só isso.
  --
  -- Ela vale APENAS enquanto a tabela estiver COMPLETAMENTE VAZIA — o que só acontece se o
  -- insert acima não encontrou o e-mail em auth.users. Repare que a condição é "nenhuma linha",
  -- e não "nenhuma linha ativa": a diferença é o que faz a revogação funcionar de verdade.
  -- Com "nenhuma linha ativa", revogar o último administrador esvaziaria o conjunto ativo, a
  -- rede de segurança reativaria o literal, e a revogação não teria efeito nenhum — um botão
  -- de emergência que parece funcionar e não funciona é pior que não ter botão.
  --
  -- Assim que a linha existir, este ramo fica inerte para sempre. Pode removê-lo numa migration
  -- futura; deixá-lo não custa nada além de uma linha de comentário.
  or (
    not exists (select 1 from public.platform_admins)
    and exists (
      select 1 from auth.users u
       where u.id = auth.uid() and lower(u.email) = 'joaoneryflu@gmail.com'
    )
  );
$$;

revoke all     on function public.is_global_admin() from public;
revoke execute on function public.is_global_admin() from anon;
-- `authenticated` precisa executar: o app chama esta RPC para saber se mostra as telas de
-- administração. Ela responde apenas sobre quem chamou, nunca lista ninguém.
grant  execute on function public.is_global_admin() to authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────────
select
  case when count(*) filter (where revogado_em is null) > 0
       then '  OK  ' else '❌ VAZIA — a rede de segurança do literal ainda está ativa' end as situacao,
  count(*) filter (where revogado_em is null) as admins_ativos,
  count(*) filter (where revogado_em is not null) as revogados
from public.platform_admins;
