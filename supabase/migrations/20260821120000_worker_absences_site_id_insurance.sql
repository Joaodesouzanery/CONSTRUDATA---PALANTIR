-- 20260821120000_worker_absences_site_id_insurance.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- SEGURO PARA `worker_absences.site_id`
--
-- A coluna nasceu em `20260627120000_obra_scoping_fase1.sql`, que é de aplicação manual. Se aquela
-- migration não tiver sido aplicada neste banco, todo registro de falta passa a falhar com
-- PGRST204 ("Could not find the 'site_id' column"), porque o cliente começou a escrevê-la.
--
-- O projeto já teve exatamente este problema com a tabela `rdo`, e a solução foi a mesma:
-- `20260722120000_rdo_site_id_insurance.sql`. Esta é a irmã que faltava.
--
-- É idempotente e barata: se a coluna já existe, não faz nada. Rodar duas vezes não dói.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.worker_absences
  add column if not exists site_id uuid references public.construction_sites(id) on delete set null;

-- O índice acompanha o padrão das outras tabelas escopadas por obra: só as linhas vivas, porque
-- toda consulta do app filtra `deleted_at is null`.
create index if not exists idx_worker_absences_org_site
  on public.worker_absences(organization_id, site_id)
  where deleted_at is null;

-- ── Conferência ─────────────────────────────────────────────────────────────────
select
  case when count(*) = 1 then '  OK  ' else '❌ FALTA' end as situacao,
  'worker_absences.site_id' as item
from information_schema.columns
where table_schema = 'public' and table_name = 'worker_absences' and column_name = 'site_id';
