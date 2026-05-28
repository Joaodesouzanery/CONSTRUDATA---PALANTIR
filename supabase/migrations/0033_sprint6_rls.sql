-- 0033_sprint6_rls.sql
-- Sprint 6 — RLS para as 9 tabelas. Padrão idêntico aos sprints anteriores,
-- exceto user_routines que tem RLS por user_id (não por org).

-- ════════════════════════════════════════════════════════════════════════
-- EVM (3 tabelas)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.evm_work_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evm_work_packages FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS evm_wp_select_own_org ON public.evm_work_packages;
CREATE POLICY evm_wp_select_own_org ON public.evm_work_packages FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS evm_wp_insert_with_role ON public.evm_work_packages;
CREATE POLICY evm_wp_insert_with_role ON public.evm_work_packages FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS evm_wp_update_role ON public.evm_work_packages;
CREATE POLICY evm_wp_update_role ON public.evm_work_packages FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS evm_wp_delete_blocked ON public.evm_work_packages;
CREATE POLICY evm_wp_delete_blocked ON public.evm_work_packages FOR DELETE TO authenticated USING (false);

ALTER TABLE public.evm_cost_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evm_cost_accounts FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS evm_ca_select_own_org ON public.evm_cost_accounts;
CREATE POLICY evm_ca_select_own_org ON public.evm_cost_accounts FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS evm_ca_insert_with_role ON public.evm_cost_accounts;
CREATE POLICY evm_ca_insert_with_role ON public.evm_cost_accounts FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS evm_ca_update_role ON public.evm_cost_accounts;
CREATE POLICY evm_ca_update_role ON public.evm_cost_accounts FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS evm_ca_delete_blocked ON public.evm_cost_accounts;
CREATE POLICY evm_ca_delete_blocked ON public.evm_cost_accounts FOR DELETE TO authenticated USING (false);

ALTER TABLE public.evm_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evm_measurements FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS evm_meas_select_own_org ON public.evm_measurements;
CREATE POLICY evm_meas_select_own_org ON public.evm_measurements FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS evm_meas_insert_with_role ON public.evm_measurements;
CREATE POLICY evm_meas_insert_with_role ON public.evm_measurements FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS evm_meas_update_role ON public.evm_measurements;
CREATE POLICY evm_meas_update_role ON public.evm_measurements FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS evm_meas_delete_blocked ON public.evm_measurements;
CREATE POLICY evm_meas_delete_blocked ON public.evm_measurements FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Construction Sites (Torre)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.construction_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_sites FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sites_select_own_org ON public.construction_sites;
CREATE POLICY sites_select_own_org ON public.construction_sites FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS sites_insert_with_role ON public.construction_sites;
CREATE POLICY sites_insert_with_role ON public.construction_sites FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS sites_update_role ON public.construction_sites;
CREATE POLICY sites_update_role ON public.construction_sites FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS sites_delete_blocked ON public.construction_sites;
CREATE POLICY sites_delete_blocked ON public.construction_sites FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Change Orders (2 tabelas)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_orders FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS co_select_own_org ON public.change_orders;
CREATE POLICY co_select_own_org ON public.change_orders FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS co_insert_with_role ON public.change_orders;
CREATE POLICY co_insert_with_role ON public.change_orders FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS co_update_role ON public.change_orders;
CREATE POLICY co_update_role ON public.change_orders FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS co_delete_blocked ON public.change_orders;
CREATE POLICY co_delete_blocked ON public.change_orders FOR DELETE TO authenticated USING (false);

ALTER TABLE public.change_order_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_order_photos FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS co_photos_select_own_org ON public.change_order_photos;
CREATE POLICY co_photos_select_own_org ON public.change_order_photos FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS co_photos_insert_with_role ON public.change_order_photos;
CREATE POLICY co_photos_insert_with_role ON public.change_order_photos FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS co_photos_update_role ON public.change_order_photos;
CREATE POLICY co_photos_update_role ON public.change_order_photos FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS co_photos_delete_blocked ON public.change_order_photos;
CREATE POLICY co_photos_delete_blocked ON public.change_order_photos FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Agenda (2 tabelas)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.agenda_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_resources FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agenda_res_select_own_org ON public.agenda_resources;
CREATE POLICY agenda_res_select_own_org ON public.agenda_resources FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS agenda_res_insert_with_role ON public.agenda_resources;
CREATE POLICY agenda_res_insert_with_role ON public.agenda_resources FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS agenda_res_update_role ON public.agenda_resources;
CREATE POLICY agenda_res_update_role ON public.agenda_resources FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS agenda_res_delete_blocked ON public.agenda_resources;
CREATE POLICY agenda_res_delete_blocked ON public.agenda_resources FOR DELETE TO authenticated USING (false);

ALTER TABLE public.agenda_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_tasks FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agenda_tasks_select_own_org ON public.agenda_tasks;
CREATE POLICY agenda_tasks_select_own_org ON public.agenda_tasks FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS agenda_tasks_insert_with_role ON public.agenda_tasks;
CREATE POLICY agenda_tasks_insert_with_role ON public.agenda_tasks FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS agenda_tasks_update_role ON public.agenda_tasks;
CREATE POLICY agenda_tasks_update_role ON public.agenda_tasks FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS agenda_tasks_delete_blocked ON public.agenda_tasks;
CREATE POLICY agenda_tasks_delete_blocked ON public.agenda_tasks FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- User Routines — RLS POR user_id (não por org)
-- O usuário só vê/edita a própria rotina. Tenant isolation via organization_id
-- ainda é checado no INSERT (tem que ser da org dele).
-- DELETE permitido (sem aprovação) — usuário pode resetar a própria rotina.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_routines FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_routines_select_own ON public.user_routines;
CREATE POLICY user_routines_select_own ON public.user_routines FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS user_routines_insert_own ON public.user_routines;
CREATE POLICY user_routines_insert_own ON public.user_routines FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND organization_id = public.user_org());
DROP POLICY IF EXISTS user_routines_update_own ON public.user_routines;
CREATE POLICY user_routines_update_own ON public.user_routines FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND organization_id = public.user_org());
DROP POLICY IF EXISTS user_routines_delete_own ON public.user_routines;
CREATE POLICY user_routines_delete_own ON public.user_routines FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════
-- Company Logos
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.company_logos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_logos FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_logos_select_own_org ON public.company_logos;
CREATE POLICY company_logos_select_own_org ON public.company_logos FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS company_logos_insert_with_role ON public.company_logos;
CREATE POLICY company_logos_insert_with_role ON public.company_logos FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS company_logos_update_role ON public.company_logos;
CREATE POLICY company_logos_update_role ON public.company_logos FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS company_logos_delete_blocked ON public.company_logos;
CREATE POLICY company_logos_delete_blocked ON public.company_logos FOR DELETE TO authenticated USING (false);
