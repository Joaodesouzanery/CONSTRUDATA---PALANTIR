-- 20260918160000_colaborador_so_o_ponto.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor, DEPOIS de `20260918150000_ponto_registros.sql`.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- A CERCA DE LEITURA DO COLABORADOR
--
-- ─── O DEFEITO QUE ESTA MIGRAÇÃO FECHA ─────────────────────────────────────────
-- A promessa do módulo é "o funcionário só bate o ponto". Sem esta migração ela é falsa, e de um
-- jeito grave: assim que qualquer conta entra, `refreshProfile` dispara `syncAllTenantStores()`
-- (src/lib/auth.ts) e TODOS os stores baixam a empresa inteira para o `localStorage` do aparelho.
-- No celular do canteiro isso é o cadastro dos colegas COM SALÁRIO, o financeiro, as medições.
--
-- E a RLS não segurava, porque o padrão do projeto é LEITURA AMPLA: quase toda policy de SELECT
-- diz só `organization_id = public.user_org()`, sem olhar papel (registrado em SECURITY.md e na
-- decisão do dono de 08/09/2026 — "só por papel, por enquanto", valendo para ESCRITA). Para os
-- onze papéis que administram a obra isso é intencional. Para o `colaborador`, que nasceu agora e
-- cuja única função é tocar um botão, não: ele é a primeira conta do sistema que pertence a quem
-- NÃO é da gestão.
--
-- ─── COMO ─────────────────────────────────────────────────────────────────────
-- Policy RESTRITIVA. Ela não concede nada; ela é somada com `AND` a todas as permissivas que já
-- existem. Assim nenhuma policy atual precisa ser reescrita (e nenhuma corre o risco de ser
-- reescrita errado), e o dia em que uma tabela nova aparecer, ela nasce liberada como hoje — o
-- preço consciente de não mexer em 40 arquivos de migração.
--
-- ⚠️ POR ISSO O `DO` VARRE: toda tabela de `public` com RLS ligada, menos a lista de exceções.
-- Rodar de novo depois de criar tabelas novas é o que estende a cerca a elas — e é idempotente.
--
-- ─── O QUE O COLABORADOR CONTINUA LENDO, E POR QUÊ ────────────────────────────
--   · `ponto_registros`  — as PRÓPRIAS batidas (o recorte está na policy da 20260918150000).
--   · `organizations`, `profiles`, `memberships` — sem isto não há login: é daqui que saem
--     `user_org()` e o papel que todas as outras policies consultam.
--   · `construction_sites` — a tela precisa do nome e da coordenada da obra para desenhar a cerca.
--     É o único dado da empresa que ele vê, e é o endereço do lugar onde ele trabalha.
--   · `workers` — só a PRÓPRIA linha, pela policy restritiva específica lá embaixo. A tela do
--     ponto acha a pessoa por `workers.find(w => w.authUserId === user.id)`; sem a linha dela, não
--     há batida. Com todas as linhas, haveria o salário de todo mundo no celular.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Quem é colaborador, em uma função só ────────────────────────────────────────
-- `security definer` porque lê `memberships`, que tem RLS. `stable` para o planner reusar dentro
-- da mesma consulta em vez de reavaliar linha a linha.
create or replace function public.e_colaborador()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.user_id = auth.uid()
      and m.organization_id = p.organization_id
      and m.role = 'colaborador'::public.user_role
      and m.status = 'active'
      and m.deleted_at is null
  );
$fn$;

grant execute on function public.e_colaborador() to authenticated;

-- ── A cerca, tabela por tabela ──────────────────────────────────────────────────
do $$
declare
  t record;
  liberadas text[] := array[
    'ponto_registros',      -- o recorte por titular está na policy própria
    'organizations',
    'profiles',
    'memberships',
    'invitations',
    'construction_sites',   -- nome e coordenada da obra: é o que desenha a cerca
    'workers'               -- tratada à parte logo abaixo: só a própria linha
  ];
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      and not (c.relname = any (liberadas))
    order by c.relname
  loop
    execute format('drop policy if exists colaborador_sem_leitura on public.%I', t.relname);
    execute format(
      'create policy colaborador_sem_leitura on public.%I as restrictive for select to authenticated using (not public.e_colaborador())',
      t.relname);
  end loop;
end $$;

-- ── `workers`: só a própria linha ───────────────────────────────────────────────
-- ⚠️ Restritiva também para INSERT/UPDATE/DELETE não seria necessário (o colaborador já não passa
-- em nenhuma policy de escrita de `workers`), mas SELECT precisa: é a tabela que carrega
-- `grossSalary`, `hourlyRate` e o CPF mascarado de toda a empresa dentro do `payload`.
drop policy if exists colaborador_so_o_proprio_cadastro on public.workers;
create policy colaborador_so_o_proprio_cadastro on public.workers
  as restrictive for select to authenticated
  using (
    not public.e_colaborador()
    or payload->>'authUserId' = auth.uid()::text
  );

-- ── Conferência ─────────────────────────────────────────────────────────────────
-- Esperado: a contagem de tabelas com a cerca, e 1 para o recorte de `workers`.
select
  count(*) || ' tabelas com a cerca de leitura do colaborador' as item
from pg_policies
where schemaname = 'public' and policyname = 'colaborador_sem_leitura'
union all
select
  case when count(*) = 1 then '  OK  — workers recortado por titular' else '❌ FALTA o recorte de workers' end
from pg_policies
where schemaname = 'public' and policyname = 'colaborador_so_o_proprio_cadastro'
union all
select
  case when count(*) = 0 then '  OK  — nenhuma tabela com RLS ficou de fora'
       else '⚠️  ' || count(*) || ' tabela(s) com RLS sem a cerca: ' || string_agg(nome, ', ') end
from (
  select c.relname as nome
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and c.relname not in ('ponto_registros','organizations','profiles','memberships','invitations','construction_sites','workers')
    and not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname and p.policyname = 'colaborador_sem_leitura')
) faltando;
