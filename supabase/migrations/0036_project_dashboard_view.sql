-- 0036_project_dashboard_view.sql
-- Sprint Ontologia Unificada — Camada 4: materialized view que agrega
-- KPIs cross-module para o dashboard "Comando Central".
--
-- Por que materialized view (não view comum):
--   - View comum re-executa TODOS os subqueries a cada SELECT (caro com 70+ tabelas)
--   - Materialized view armazena o resultado e só recomputa em REFRESH
--   - Trade-off: dados podem estar até X minutos defasados (REFRESH a cada 1min via cron)
--
-- RLS: a view herda RLS pela WHERE organization_id = user_org() na consulta.
-- Como materialized views não têm RLS própria nativa, criamos uma SECURITY DEFINER
-- wrapper function que filtra por org.

-- ════════════════════════════════════════════════════════════════════════
-- A view propriamente dita
-- ════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_project_dashboard();
DROP MATERIALIZED VIEW IF EXISTS public.project_dashboard_view;

CREATE MATERIALIZED VIEW public.project_dashboard_view AS
SELECT
  p.id              AS project_id,
  p.organization_id,
  p.code,
  p.name,
  p.status,
  p.start_date,
  p.end_date,

  -- ── Custo (EVM) ─────────────────────────────────────────────────────
  COALESCE((
    SELECT SUM(ewp.total_budget_brl)
    FROM public.evm_work_packages ewp
    WHERE ewp.project_id::uuid = p.id
      AND ewp.deleted_at IS NULL
  ), 0)::numeric(14,2) AS bac_brl,

  COALESCE((
    SELECT SUM(eca.total_cost_brl)
    FROM public.evm_cost_accounts eca
    WHERE eca.organization_id = p.organization_id
      AND eca.deleted_at IS NULL
  ), 0)::numeric(14,2) AS ac_brl,

  -- ── Progresso (Planejamento) ────────────────────────────────────────
  COALESCE((
    SELECT AVG((pt.payload->>'percentComplete')::numeric)
    FROM public.plan_trechos pt
    WHERE pt.project_id::uuid = p.id
      AND pt.deleted_at IS NULL
  ), 0)::numeric(5,2) AS percent_complete,

  -- ── RDO (Campo) ─────────────────────────────────────────────────────
  (
    SELECT COUNT(*)
    FROM public.rdo r
    WHERE r.project_id::uuid = p.id AND r.deleted_at IS NULL
  )::int AS rdo_count,

  (
    SELECT MAX(r.date)
    FROM public.rdo r
    WHERE r.project_id::uuid = p.id AND r.deleted_at IS NULL
  ) AS last_rdo_date,

  -- ── Qualidade (FVS) ─────────────────────────────────────────────────
  (
    SELECT COUNT(*)
    FROM public.fvs f
    WHERE f.organization_id = p.organization_id
      AND f.deleted_at IS NULL
  )::int AS fvs_count,

  -- ── LPS restrições abertas ──────────────────────────────────────────
  (
    SELECT COUNT(*)
    FROM public.lps_restrictions lr
    WHERE lr.organization_id = p.organization_id
      AND lr.status != 'resolvida'
      AND lr.deleted_at IS NULL
  )::int AS open_restrictions,

  -- ── Mão de obra ─────────────────────────────────────────────────────
  (
    SELECT COUNT(*)
    FROM public.workers w
    WHERE w.organization_id = p.organization_id
      AND w.deleted_at IS NULL
  )::int AS worker_count,

  (
    SELECT COUNT(*)
    FROM public.worker_absences wa
    WHERE wa.organization_id = p.organization_id
      AND wa.status = 'open'
      AND wa.deleted_at IS NULL
  )::int AS open_absences,

  -- ── Equipamentos alocados ───────────────────────────────────────────
  (
    SELECT COUNT(*)
    FROM public.equipamentos e
    WHERE e.project_id::uuid = p.id AND e.deleted_at IS NULL
  )::int AS equipment_count,

  -- ── Suprimentos: POs abertas ────────────────────────────────────────
  (
    SELECT COUNT(*)
    FROM public.purchase_orders po
    WHERE po.organization_id = p.organization_id
      AND po.status != 'closed'
      AND po.deleted_at IS NULL
  )::int AS open_pos,

  -- ── Health derivado ─────────────────────────────────────────────────
  CASE
    WHEN p.status = 'completed' THEN 'green'
    WHEN COALESCE((
      SELECT AVG((pt.payload->>'percentComplete')::numeric)
      FROM public.plan_trechos pt WHERE pt.project_id = p.id AND pt.deleted_at IS NULL
    ), 0) < 30 AND p.status = 'active' THEN 'red'
    WHEN (
      SELECT COUNT(*)
      FROM public.lps_restrictions lr
      WHERE lr.organization_id = p.organization_id
        AND lr.status != 'resolvida' AND lr.deleted_at IS NULL
    ) > 5 THEN 'yellow'
    ELSE 'green'
  END AS health,

  now() AS computed_at
FROM public.projects p
WHERE p.deleted_at IS NULL;

-- Index único para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_dashboard_view_pk
  ON public.project_dashboard_view(project_id);
CREATE INDEX IF NOT EXISTS idx_project_dashboard_view_org
  ON public.project_dashboard_view(organization_id);

-- ════════════════════════════════════════════════════════════════════════
-- RLS via wrapper SECURITY DEFINER
-- ════════════════════════════════════════════════════════════════════════
-- Materialized views não suportam RLS direto. Solução: function que filtra
-- por organization do JWT do user atual.

CREATE OR REPLACE FUNCTION public.get_project_dashboard()
RETURNS SETOF public.project_dashboard_view
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.project_dashboard_view
  WHERE organization_id = public.user_org()
  ORDER BY computed_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_dashboard() TO authenticated;

-- Permissão de SELECT direto na view (com checagem manual de org)
GRANT SELECT ON public.project_dashboard_view TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Função de refresh — chamada manualmente ou via pg_cron
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.refresh_project_dashboard()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.project_dashboard_view;
EXCEPTION WHEN feature_not_supported THEN
  -- Fallback: REFRESH normal se CONCURRENTLY não estiver disponível
  REFRESH MATERIALIZED VIEW public.project_dashboard_view;
END $$;

GRANT EXECUTE ON FUNCTION public.refresh_project_dashboard() TO authenticated;

-- Refresh inicial para popular a view com dados atuais
REFRESH MATERIALIZED VIEW public.project_dashboard_view;
