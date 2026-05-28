-- 0023_projects_fk_retro.sql
-- Sprint 4 — Adiciona coluna `project_id` (nullable) + FK + index nas tabelas
-- Sprint 1-3 que já têm o conceito de projeto. Nullable pois dados existentes
-- ainda não estão vinculados; backfill manual conforme owner amarra projetos.

DO $$
DECLARE
  v_tables text[] := ARRAY[
    -- Sprint 2 — RDO/Planejamento/Suprimentos
    'rdo','plan_trechos','plan_teams','plan_holidays','plan_scenarios',
    'suppliers','purchase_orders','goods_receipts','invoices',
    -- Sprint 3 — Mão-de-Obra
    'workers','labor_crews','timecards','shifts','worker_absences',
    -- Sprint 3 — LPS
    'lps_activities','lps_restrictions','lps_takt_zones',
    -- Sprint 3 — Operação-Campo
    'operacao_campo_activities','operacao_campo_days',
    -- Sprint 3 — Planejamento-Mestre
    'master_activities','master_baselines','lookahead_derived_activities','programacao_diaria',
    -- Sprint 3 — Relatório 360
    'daily_report_activities','daily_report_equipment_logs','daily_report_material_logs','daily_report_photos'
  ];
  v_tbl text;
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL', v_tbl);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_project ON public.%I(project_id)', v_tbl, v_tbl);
  END LOOP;
END $$;
