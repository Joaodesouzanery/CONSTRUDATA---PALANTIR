-- 20260829130000_org_wcr_saneamento.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
-- IDEMPOTENTE: pode rodar duas vezes. Termina com um select de conferência.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ORGANIZAÇÃO: WCR SANEAMENTO
--
-- Cliente novo. Esta migração cria SÓ a organização — os `settings` saem do default da
-- `0003_organizations` (matriz de aprovação, MFA para owner/diretor, 30 dias de soft delete).
--
-- ─── ISTO NÃO CRIA O PRIMEIRO USUÁRIO, E ISSO É DE PROPÓSITO ────────────────────
-- Criar usuário é competência do Supabase Auth, não de uma migração: exige linha em `auth.users`
-- com senha, confirmação de e-mail e o resto do ciclo. Migração que escreve em `auth.users` na mão
-- produz conta que não loga.
--
-- O caminho oficial faz os dois de uma vez e está documentado em
-- `docs/EMPRESAS_USUARIOS_RDO_MEDICAO.md:65` — a Edge Function `admin-provision-company`, que cria
-- organização + dono e dispara o convite. Se você rodar aquele `curl`, NÃO precisa desta migração:
-- ela existe para o caso de a organização ter que existir antes (por exemplo, para já cadastrar as
-- obras) e o dono entrar depois pelo fluxo de convite.
--
-- Rodar os dois é seguro: o `on conflict (slug) do nothing` faz esta migração não duplicar nada.
-- ═══════════════════════════════════════════════════════════════════════════════

insert into public.organizations (name, slug, plan, max_users, max_projects)
values ('WCR Saneamento', 'wcr-saneamento', 'free', 5, 3)
on conflict (slug) do nothing;

-- ── Conferência ────────────────────────────────────────────────────────────────
select
  o.name,
  o.slug,
  o.id,
  case when o.owner_id is null
       then 'sem dono ainda — crie o primeiro usuario por convite ou por admin-provision-company'
       else 'com dono' end as situacao
from public.organizations o
where o.slug = 'wcr-saneamento';
