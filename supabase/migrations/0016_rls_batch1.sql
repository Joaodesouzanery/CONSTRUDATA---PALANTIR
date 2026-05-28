-- 0016_rls_batch1.sql
-- RLS para todas as 9 tabelas novas do Batch 1 (RDO + Planejamento + Suprimentos).
-- Padrão idêntico ao 0011_qualidade_rls.sql:
--   - SELECT: própria org, deleted_at IS NULL
--   - INSERT: própria org, created_by = auth.uid(), role operacional+
--   - UPDATE: autor (não fechado) ou gerente+ (não fechado)
--   - DELETE: bloqueado direto (forçar via request_action RPC)

-- ════════════════════════════════════════════════════════════════════════
-- Macro pattern (aplicado individualmente abaixo a cada tabela)
-- ════════════════════════════════════════════════════════════════════════

-- ─────────── RDO ──────────────────────────────────────────────────────
ALTER TABLE public.rdo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rdo_select_own_org ON public.rdo;
CREATE POLICY rdo_select_own_org ON public.rdo
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS rdo_insert_with_role ON public.rdo;
CREATE POLICY rdo_insert_with_role ON public.rdo
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS rdo_update_author_or_manager ON public.rdo;
CREATE POLICY rdo_update_author_or_manager ON public.rdo
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND closed = false
    AND (created_by = auth.uid() OR public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[]))
  )
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS rdo_delete_blocked ON public.rdo;
CREATE POLICY rdo_delete_blocked ON public.rdo
  FOR DELETE TO authenticated USING (false);

-- ─────────── plan_trechos ─────────────────────────────────────────────
ALTER TABLE public.plan_trechos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_trechos FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_trechos_select_own_org ON public.plan_trechos;
CREATE POLICY plan_trechos_select_own_org ON public.plan_trechos
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS plan_trechos_insert_with_role ON public.plan_trechos;
CREATE POLICY plan_trechos_insert_with_role ON public.plan_trechos
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS plan_trechos_update_role ON public.plan_trechos;
CREATE POLICY plan_trechos_update_role ON public.plan_trechos
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS plan_trechos_delete_blocked ON public.plan_trechos;
CREATE POLICY plan_trechos_delete_blocked ON public.plan_trechos
  FOR DELETE TO authenticated USING (false);

-- ─────────── plan_teams ───────────────────────────────────────────────
ALTER TABLE public.plan_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_teams FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_teams_select_own_org ON public.plan_teams;
CREATE POLICY plan_teams_select_own_org ON public.plan_teams
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS plan_teams_insert_with_role ON public.plan_teams;
CREATE POLICY plan_teams_insert_with_role ON public.plan_teams
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS plan_teams_update_role ON public.plan_teams;
CREATE POLICY plan_teams_update_role ON public.plan_teams
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS plan_teams_delete_blocked ON public.plan_teams;
CREATE POLICY plan_teams_delete_blocked ON public.plan_teams
  FOR DELETE TO authenticated USING (false);

-- ─────────── plan_holidays ────────────────────────────────────────────
ALTER TABLE public.plan_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_holidays FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_holidays_select_own_org ON public.plan_holidays;
CREATE POLICY plan_holidays_select_own_org ON public.plan_holidays
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS plan_holidays_insert_with_role ON public.plan_holidays;
CREATE POLICY plan_holidays_insert_with_role ON public.plan_holidays
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS plan_holidays_update_role ON public.plan_holidays;
CREATE POLICY plan_holidays_update_role ON public.plan_holidays
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS plan_holidays_delete_role ON public.plan_holidays;
CREATE POLICY plan_holidays_delete_role ON public.plan_holidays
  FOR DELETE TO authenticated
  USING (
    organization_id = public.user_org()
    AND public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[])
  );

-- ─────────── plan_scenarios ───────────────────────────────────────────
ALTER TABLE public.plan_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_scenarios FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_scenarios_select_own_org ON public.plan_scenarios;
CREATE POLICY plan_scenarios_select_own_org ON public.plan_scenarios
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS plan_scenarios_insert_with_role ON public.plan_scenarios;
CREATE POLICY plan_scenarios_insert_with_role ON public.plan_scenarios
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS plan_scenarios_update_role ON public.plan_scenarios;
CREATE POLICY plan_scenarios_update_role ON public.plan_scenarios
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS plan_scenarios_delete_blocked ON public.plan_scenarios;
CREATE POLICY plan_scenarios_delete_blocked ON public.plan_scenarios
  FOR DELETE TO authenticated USING (false);

-- ─────────── suppliers ────────────────────────────────────────────────
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suppliers_select_own_org ON public.suppliers;
CREATE POLICY suppliers_select_own_org ON public.suppliers
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS suppliers_insert_with_role ON public.suppliers;
CREATE POLICY suppliers_insert_with_role ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['comprador','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS suppliers_update_role ON public.suppliers;
CREATE POLICY suppliers_update_role ON public.suppliers
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['comprador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS suppliers_delete_role ON public.suppliers;
CREATE POLICY suppliers_delete_role ON public.suppliers
  FOR DELETE TO authenticated
  USING (
    organization_id = public.user_org()
    AND public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[])
  );

-- ─────────── purchase_orders ──────────────────────────────────────────
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS po_select_own_org ON public.purchase_orders;
CREATE POLICY po_select_own_org ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS po_insert_with_role ON public.purchase_orders;
CREATE POLICY po_insert_with_role ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['comprador','gerente','diretor','owner']::public.user_role[])
  );

-- UPDATE: status='open'/'partial' livre para comprador+
-- Status='closed' só pode ser atualizado via RPC update_po_approved
DROP POLICY IF EXISTS po_update_role ON public.purchase_orders;
CREATE POLICY po_update_role ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND status != 'closed'  -- closed só via RPC update_po_approved
    AND public.has_role(ARRAY['comprador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS po_delete_blocked ON public.purchase_orders;
CREATE POLICY po_delete_blocked ON public.purchase_orders
  FOR DELETE TO authenticated USING (false);

-- ─────────── goods_receipts ───────────────────────────────────────────
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gr_select_own_org ON public.goods_receipts;
CREATE POLICY gr_select_own_org ON public.goods_receipts
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS gr_insert_with_role ON public.goods_receipts;
CREATE POLICY gr_insert_with_role ON public.goods_receipts
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['comprador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS gr_update_role ON public.goods_receipts;
CREATE POLICY gr_update_role ON public.goods_receipts
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['comprador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS gr_delete_blocked ON public.goods_receipts;
CREATE POLICY gr_delete_blocked ON public.goods_receipts
  FOR DELETE TO authenticated USING (false);

-- ─────────── invoices ─────────────────────────────────────────────────
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inv_select_own_org ON public.invoices;
CREATE POLICY inv_select_own_org ON public.invoices
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS inv_insert_with_role ON public.invoices;
CREATE POLICY inv_insert_with_role ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['comprador','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS inv_update_role ON public.invoices;
CREATE POLICY inv_update_role ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND status != 'approved'  -- approved só via RPC
    AND public.has_role(ARRAY['comprador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS inv_delete_blocked ON public.invoices;
CREATE POLICY inv_delete_blocked ON public.invoices
  FOR DELETE TO authenticated USING (false);
