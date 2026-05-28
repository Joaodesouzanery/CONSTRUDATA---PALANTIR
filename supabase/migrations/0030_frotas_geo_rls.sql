-- 0030_frotas_geo_rls.sql
-- Sprint 5 — RLS para as 18 tabelas. Padrão idêntico a 0027.

-- Macro: aplica template SELECT/INSERT/UPDATE/DELETE para cada tabela.
-- Roles operacional: engenheiro,planejador,gerente,diretor,owner

-- ════════════════════════════════════════════════════════════════════════
-- Equipamentos
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamentos FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS equipamentos_select_own_org ON public.equipamentos;
CREATE POLICY equipamentos_select_own_org ON public.equipamentos FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS equipamentos_insert_with_role ON public.equipamentos;
CREATE POLICY equipamentos_insert_with_role ON public.equipamentos FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS equipamentos_update_role ON public.equipamentos;
CREATE POLICY equipamentos_update_role ON public.equipamentos FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS equipamentos_delete_blocked ON public.equipamentos;
CREATE POLICY equipamentos_delete_blocked ON public.equipamentos FOR DELETE TO authenticated USING (false);

ALTER TABLE public.equipamentos_manutencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamentos_manutencoes FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS eq_man_select_own_org ON public.equipamentos_manutencoes;
CREATE POLICY eq_man_select_own_org ON public.equipamentos_manutencoes FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS eq_man_insert_with_role ON public.equipamentos_manutencoes;
CREATE POLICY eq_man_insert_with_role ON public.equipamentos_manutencoes FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS eq_man_update_role ON public.equipamentos_manutencoes;
CREATE POLICY eq_man_update_role ON public.equipamentos_manutencoes FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS eq_man_delete_blocked ON public.equipamentos_manutencoes;
CREATE POLICY eq_man_delete_blocked ON public.equipamentos_manutencoes FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Frota Veicular (9 tabelas)
-- ════════════════════════════════════════════════════════════════════════

-- Helper inline para todas as 9 tabelas com mesmo padrão.
-- veiculos
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS veiculos_select_own_org ON public.veiculos;
CREATE POLICY veiculos_select_own_org ON public.veiculos FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS veiculos_insert_with_role ON public.veiculos;
CREATE POLICY veiculos_insert_with_role ON public.veiculos FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS veiculos_update_role ON public.veiculos;
CREATE POLICY veiculos_update_role ON public.veiculos FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS veiculos_delete_blocked ON public.veiculos;
CREATE POLICY veiculos_delete_blocked ON public.veiculos FOR DELETE TO authenticated USING (false);

-- fleet_drivers
ALTER TABLE public.fleet_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_drivers FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fd_select_own_org ON public.fleet_drivers;
CREATE POLICY fd_select_own_org ON public.fleet_drivers FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS fd_insert_with_role ON public.fleet_drivers;
CREATE POLICY fd_insert_with_role ON public.fleet_drivers FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS fd_update_role ON public.fleet_drivers;
CREATE POLICY fd_update_role ON public.fleet_drivers FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS fd_delete_blocked ON public.fleet_drivers;
CREATE POLICY fd_delete_blocked ON public.fleet_drivers FOR DELETE TO authenticated USING (false);

-- fleet_fuel_records
ALTER TABLE public.fleet_fuel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_fuel_records FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ffr_select_own_org ON public.fleet_fuel_records;
CREATE POLICY ffr_select_own_org ON public.fleet_fuel_records FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS ffr_insert_with_role ON public.fleet_fuel_records;
CREATE POLICY ffr_insert_with_role ON public.fleet_fuel_records FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS ffr_update_role ON public.fleet_fuel_records;
CREATE POLICY ffr_update_role ON public.fleet_fuel_records FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS ffr_delete_blocked ON public.fleet_fuel_records;
CREATE POLICY ffr_delete_blocked ON public.fleet_fuel_records FOR DELETE TO authenticated USING (false);

-- fleet_vehicle_maintenance
ALTER TABLE public.fleet_vehicle_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_vehicle_maintenance FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_select_own_org ON public.fleet_vehicle_maintenance;
CREATE POLICY fvm_select_own_org ON public.fleet_vehicle_maintenance FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS fvm_insert_with_role ON public.fleet_vehicle_maintenance;
CREATE POLICY fvm_insert_with_role ON public.fleet_vehicle_maintenance FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS fvm_update_role ON public.fleet_vehicle_maintenance;
CREATE POLICY fvm_update_role ON public.fleet_vehicle_maintenance FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS fvm_delete_blocked ON public.fleet_vehicle_maintenance;
CREATE POLICY fvm_delete_blocked ON public.fleet_vehicle_maintenance FOR DELETE TO authenticated USING (false);

-- fleet_routes
ALTER TABLE public.fleet_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_routes FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fr_select_own_org ON public.fleet_routes;
CREATE POLICY fr_select_own_org ON public.fleet_routes FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS fr_insert_with_role ON public.fleet_routes;
CREATE POLICY fr_insert_with_role ON public.fleet_routes FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS fr_update_role ON public.fleet_routes;
CREATE POLICY fr_update_role ON public.fleet_routes FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS fr_delete_blocked ON public.fleet_routes;
CREATE POLICY fr_delete_blocked ON public.fleet_routes FOR DELETE TO authenticated USING (false);

-- fleet_service_orders
ALTER TABLE public.fleet_service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_service_orders FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fso_select_own_org ON public.fleet_service_orders;
CREATE POLICY fso_select_own_org ON public.fleet_service_orders FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS fso_insert_with_role ON public.fleet_service_orders;
CREATE POLICY fso_insert_with_role ON public.fleet_service_orders FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS fso_update_role ON public.fleet_service_orders;
CREATE POLICY fso_update_role ON public.fleet_service_orders FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS fso_delete_blocked ON public.fleet_service_orders;
CREATE POLICY fso_delete_blocked ON public.fleet_service_orders FOR DELETE TO authenticated USING (false);

-- fleet_fines
ALTER TABLE public.fleet_fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_fines FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ff_select_own_org ON public.fleet_fines;
CREATE POLICY ff_select_own_org ON public.fleet_fines FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS ff_insert_with_role ON public.fleet_fines;
CREATE POLICY ff_insert_with_role ON public.fleet_fines FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS ff_update_role ON public.fleet_fines;
CREATE POLICY ff_update_role ON public.fleet_fines FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS ff_delete_blocked ON public.fleet_fines;
CREATE POLICY ff_delete_blocked ON public.fleet_fines FOR DELETE TO authenticated USING (false);

-- fleet_alerts
ALTER TABLE public.fleet_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_alerts FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fa_select_own_org ON public.fleet_alerts;
CREATE POLICY fa_select_own_org ON public.fleet_alerts FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS fa_insert_with_role ON public.fleet_alerts;
CREATE POLICY fa_insert_with_role ON public.fleet_alerts FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS fa_update_role ON public.fleet_alerts;
CREATE POLICY fa_update_role ON public.fleet_alerts FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS fa_delete_blocked ON public.fleet_alerts;
CREATE POLICY fa_delete_blocked ON public.fleet_alerts FOR DELETE TO authenticated USING (false);

-- fleet_schedules
ALTER TABLE public.fleet_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_schedules FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fs_select_own_org ON public.fleet_schedules;
CREATE POLICY fs_select_own_org ON public.fleet_schedules FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS fs_insert_with_role ON public.fleet_schedules;
CREATE POLICY fs_insert_with_role ON public.fleet_schedules FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS fs_update_role ON public.fleet_schedules;
CREATE POLICY fs_update_role ON public.fleet_schedules FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS fs_delete_blocked ON public.fleet_schedules;
CREATE POLICY fs_delete_blocked ON public.fleet_schedules FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Otimização Frota (3)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.otimizacao_routing_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otimizacao_routing_recommendations FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS otrr_select_own_org ON public.otimizacao_routing_recommendations;
CREATE POLICY otrr_select_own_org ON public.otimizacao_routing_recommendations FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS otrr_insert_with_role ON public.otimizacao_routing_recommendations;
CREATE POLICY otrr_insert_with_role ON public.otimizacao_routing_recommendations FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS otrr_update_role ON public.otimizacao_routing_recommendations;
CREATE POLICY otrr_update_role ON public.otimizacao_routing_recommendations FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS otrr_delete_blocked ON public.otimizacao_routing_recommendations;
CREATE POLICY otrr_delete_blocked ON public.otimizacao_routing_recommendations FOR DELETE TO authenticated USING (false);

ALTER TABLE public.otimizacao_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otimizacao_health_scores FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS oths_select_own_org ON public.otimizacao_health_scores;
CREATE POLICY oths_select_own_org ON public.otimizacao_health_scores FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS oths_insert_with_role ON public.otimizacao_health_scores;
CREATE POLICY oths_insert_with_role ON public.otimizacao_health_scores FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS oths_update_role ON public.otimizacao_health_scores;
CREATE POLICY oths_update_role ON public.otimizacao_health_scores FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS oths_delete_blocked ON public.otimizacao_health_scores;
CREATE POLICY oths_delete_blocked ON public.otimizacao_health_scores FOR DELETE TO authenticated USING (false);

ALTER TABLE public.otimizacao_buy_lease_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otimizacao_buy_lease_analyses FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS otbl_select_own_org ON public.otimizacao_buy_lease_analyses;
CREATE POLICY otbl_select_own_org ON public.otimizacao_buy_lease_analyses FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS otbl_insert_with_role ON public.otimizacao_buy_lease_analyses;
CREATE POLICY otbl_insert_with_role ON public.otimizacao_buy_lease_analyses FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS otbl_update_role ON public.otimizacao_buy_lease_analyses;
CREATE POLICY otbl_update_role ON public.otimizacao_buy_lease_analyses FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS otbl_delete_blocked ON public.otimizacao_buy_lease_analyses;
CREATE POLICY otbl_delete_blocked ON public.otimizacao_buy_lease_analyses FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Mapa Interativo (1)
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.mapas_interativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapas_interativos FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mapas_select_own_org ON public.mapas_interativos;
CREATE POLICY mapas_select_own_org ON public.mapas_interativos FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS mapas_insert_with_role ON public.mapas_interativos;
CREATE POLICY mapas_insert_with_role ON public.mapas_interativos FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS mapas_update_role ON public.mapas_interativos;
CREATE POLICY mapas_update_role ON public.mapas_interativos FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS mapas_delete_blocked ON public.mapas_interativos;
CREATE POLICY mapas_delete_blocked ON public.mapas_interativos FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Rede 360 (3)
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.rede_ativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rede_ativos FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rede_ativos_select_own_org ON public.rede_ativos;
CREATE POLICY rede_ativos_select_own_org ON public.rede_ativos FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS rede_ativos_insert_with_role ON public.rede_ativos;
CREATE POLICY rede_ativos_insert_with_role ON public.rede_ativos FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS rede_ativos_update_role ON public.rede_ativos;
CREATE POLICY rede_ativos_update_role ON public.rede_ativos FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS rede_ativos_delete_blocked ON public.rede_ativos;
CREATE POLICY rede_ativos_delete_blocked ON public.rede_ativos FOR DELETE TO authenticated USING (false);

ALTER TABLE public.rede_service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rede_service_orders FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rso_select_own_org ON public.rede_service_orders;
CREATE POLICY rso_select_own_org ON public.rede_service_orders FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS rso_insert_with_role ON public.rede_service_orders;
CREATE POLICY rso_insert_with_role ON public.rede_service_orders FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS rso_update_role ON public.rede_service_orders;
CREATE POLICY rso_update_role ON public.rede_service_orders FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS rso_delete_blocked ON public.rede_service_orders;
CREATE POLICY rso_delete_blocked ON public.rede_service_orders FOR DELETE TO authenticated USING (false);

ALTER TABLE public.rede_outages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rede_outages FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS routages_select_own_org ON public.rede_outages;
CREATE POLICY routages_select_own_org ON public.rede_outages FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS routages_insert_with_role ON public.rede_outages;
CREATE POLICY routages_insert_with_role ON public.rede_outages FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[]));
DROP POLICY IF EXISTS routages_update_role ON public.rede_outages;
CREATE POLICY routages_update_role ON public.rede_outages FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[]))
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS routages_delete_blocked ON public.rede_outages;
CREATE POLICY routages_delete_blocked ON public.rede_outages FOR DELETE TO authenticated USING (false);
