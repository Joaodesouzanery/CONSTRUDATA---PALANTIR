-- 20260817130000_convite_valido.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- CONFERIR O CONVITE ANTES DE CRIAR CONTA
--
-- O PROBLEMA. Em `/aceitar-convite`, o token só era conferido por `accept_invitation` — que
-- exige `auth.uid()` e portanto só roda DEPOIS de a conta existir. O cliente então criava a
-- conta primeiro e perguntava depois. Duas consequências, as duas ruins:
--
--  1. **Oráculo de e-mail.** Com `enable_confirmations` desligado, `signUp` falha na hora para
--     um e-mail que já existe e tem sucesso para um livre. Os dois caminhos levavam a mensagens
--     diferentes na tela, então bastava trocar o endereço para descobrir quem é cliente. Uniformizar
--     a frase ajuda, mas não resolve sozinho: os dois caminhos continuam distinguíveis pelo tempo
--     de resposta (um ida-e-volta contra dois) e pelo efeito colateral do item seguinte.
--
--  2. **Conta criada com token de mentira.** Vinte caracteres quaisquer na URL bastavam para
--     gravar uma linha em `auth.users`, com senha escolhida por quem pediu. A conta ficava lá
--     depois do erro. Isso permite ocupar o endereço de alguém antes de a empresa convidá-lo:
--     quando o convite verdadeiro chegar, a pessoa esbarra numa conta que não é dela.
--
-- A SAÍDA. Uma função que responde apenas "este token serve?", chamável sem sessão, para o
-- cliente conferir antes de tocar no cadastro.
--
-- POR QUE ISTO NÃO ABRE UM ORÁCULO NOVO. O token tem 24 bytes aleatórios (192 bits) — não se
-- adivinha, e quem já o tem em mãos recebeu o e-mail. A função devolve um booleano seco: não
-- diz de quem é o convite, para qual empresa, nem se o e-mail existe. E ela não gasta nada:
-- nenhuma linha é criada, então não há efeito colateral para observar.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public.convite_valido(p_token text)
returns boolean
language sql
stable
security definer
-- `digest()` sem qualificar, e `extensions` no caminho: é exatamente o que `accept_invitation`
-- faz (0050_private_company_onboarding), e o pgcrypto pode estar em `public` ou em `extensions`
-- dependendo de quando o projeto foi criado. Espelhar a função que já funciona é mais seguro do
-- que apostar num schema.
set search_path = public, extensions
as $$
  select exists (
    select 1
      from public.invitations i
     where (
             -- Convites novos guardam só o hash. O ramo do texto puro existe porque convites
             -- criados antes de `0050_private_company_onboarding` gravavam o valor direto; é o
             -- mesmo par de condições que `accept_invitation` usa, para não divergirem.
             i.token_hash = encode(digest(p_token, 'sha256'), 'hex')
             or i.token = p_token
           )
       and i.accepted_at is null
       and i.revoked_at is null
       and i.expires_at > now()
  );
$$;

comment on function public.convite_valido(text) is
  'Responde apenas se um convite pendente corresponde ao token. Chamável sem sessão, para a tela '
  'conferir ANTES de criar conta. Não revela e-mail, organização nem existência de usuário.';

revoke all on function public.convite_valido(text) from public;
-- `anon` precisa: a pessoa que aceita convite ainda não tem sessão. É esse o ponto da função.
grant execute on function public.convite_valido(text) to anon, authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────────
select
  case when count(*) = 1 then '  OK  ' else '❌ FALTA' end as situacao,
  'convite_valido(text) criada e liberada para anon' as item
from pg_proc where proname = 'convite_valido';
