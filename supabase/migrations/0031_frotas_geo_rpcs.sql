-- 0031_frotas_geo_rpcs.sql
-- Sprint 5 — Estende:
--   a) approval_matrix default + patch idempotente nas orgs existentes
--   b) approve_pending_action: novos action_types do Frotas/Geo
--   c) export_organization_data: adiciona as 18 novas tabelas (LGPD)

-- ════════════════════════════════════════════════════════════════════════
-- a) approval_matrix
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.organizations
  ALTER COLUMN settings SET DEFAULT jsonb_build_object(
    'approval_matrix',
      jsonb_build_object(
        -- Sprint 1-3
        'delete_fvs',                       'diretor',
        'update_fvs_closed',                'gerente',
        'delete_rdo',                       'gerente',
        'update_rdo_closed',                'gerente',
        'delete_po',                        'diretor',
        'update_po_approved',               'diretor',
        'delete_invoice',                   'diretor',
        'approve_budget',                   'diretor',
        'delete_plan_scenario',             'gerente',
        'delete_plan_trecho',               'gerente',
        'delete_project',                   'owner',
        'delete_organization',              'owner',
        'delete_worker',                    'diretor',
        'delete_labor_crew',                'gerente',
        'delete_timecard',                  'gerente',
        'delete_shift',                     'gerente',
        'delete_worker_absence',            'gerente',
        'delete_lps_activity',              'gerente',
        'delete_lps_restriction',           'gerente',
        'mark_restriction_resolved',        'gerente',
        'delete_lps_takt_zone',             'gerente',
        'delete_operacao_campo_activity',   'gerente',
        'delete_operacao_campo_day',        'gerente',
        'delete_master_activity',           'gerente',
        'delete_master_baseline',           'diretor'
      )
      ||
      jsonb_build_object(
        'delete_lookahead_derived',         'gerente',
        'delete_programacao_diaria',        'gerente',
        'delete_daily_report_activity',     'gerente',
        'delete_daily_report_equipment_log','gerente',
        'delete_daily_report_material_log', 'gerente',
        'delete_daily_report_photo',        'gerente',
        -- Sprint 4
        'delete_project_document',          'gerente',
        'delete_quantitativo_budget',       'gerente',
        'delete_quantitativo_custom_base',  'gerente',
        'delete_preconstrucao_session',     'gerente',
        'delete_bim_project',               'diretor',
        'delete_bim_segment',               'gerente',
        -- Sprint 5 — Frotas/Geo
        'delete_equipamento',               'diretor',
        'delete_equipamento_manutencao',    'gerente',
        'delete_veiculo',                   'diretor',
        'delete_fleet_driver',              'gerente',
        'delete_fleet_fuel_record',         'gerente',
        'delete_fleet_vehicle_maintenance', 'gerente',
        'delete_fleet_route',               'gerente',
        'delete_fleet_service_order',       'gerente',
        'delete_fleet_fine',                'diretor',
        'delete_fleet_alert',               'gerente',
        'delete_fleet_schedule',            'gerente',
        'delete_otimizacao_routing',        'gerente',
        'delete_otimizacao_health',         'gerente'
      )
      ||
      jsonb_build_object(
        'delete_otimizacao_buy_lease',      'diretor',
        'delete_mapa_interativo',           'gerente',
        'delete_rede_ativo',                'diretor',
        'delete_rede_service_order',        'gerente',
        'delete_rede_outage',               'gerente'
      ),
    'mfa_required_roles', jsonb_build_array('owner', 'diretor'),
    'soft_delete_days',   30
  );

UPDATE public.organizations
SET settings = jsonb_set(
  settings,
  '{approval_matrix}',
  COALESCE(settings->'approval_matrix', '{}'::jsonb) || jsonb_build_object(
    'delete_equipamento',               COALESCE(settings->'approval_matrix'->>'delete_equipamento',               'diretor'),
    'delete_equipamento_manutencao',    COALESCE(settings->'approval_matrix'->>'delete_equipamento_manutencao',    'gerente'),
    'delete_veiculo',                   COALESCE(settings->'approval_matrix'->>'delete_veiculo',                   'diretor'),
    'delete_fleet_driver',              COALESCE(settings->'approval_matrix'->>'delete_fleet_driver',              'gerente'),
    'delete_fleet_fuel_record',         COALESCE(settings->'approval_matrix'->>'delete_fleet_fuel_record',         'gerente'),
    'delete_fleet_vehicle_maintenance', COALESCE(settings->'approval_matrix'->>'delete_fleet_vehicle_maintenance', 'gerente'),
    'delete_fleet_route',               COALESCE(settings->'approval_matrix'->>'delete_fleet_route',               'gerente'),
    'delete_fleet_service_order',       COALESCE(settings->'approval_matrix'->>'delete_fleet_service_order',       'gerente'),
    'delete_fleet_fine',                COALESCE(settings->'approval_matrix'->>'delete_fleet_fine',                'diretor'),
    'delete_fleet_alert',               COALESCE(settings->'approval_matrix'->>'delete_fleet_alert',               'gerente'),
    'delete_fleet_schedule',            COALESCE(settings->'approval_matrix'->>'delete_fleet_schedule',            'gerente'),
    'delete_otimizacao_routing',        COALESCE(settings->'approval_matrix'->>'delete_otimizacao_routing',        'gerente'),
    'delete_otimizacao_health',         COALESCE(settings->'approval_matrix'->>'delete_otimizacao_health',         'gerente'),
    'delete_otimizacao_buy_lease',      COALESCE(settings->'approval_matrix'->>'delete_otimizacao_buy_lease',      'diretor'),
    'delete_mapa_interativo',           COALESCE(settings->'approval_matrix'->>'delete_mapa_interativo',           'gerente'),
    'delete_rede_ativo',                COALESCE(settings->'approval_matrix'->>'delete_rede_ativo',                'diretor'),
    'delete_rede_service_order',        COALESCE(settings->'approval_matrix'->>'delete_rede_service_order',        'gerente'),
    'delete_rede_outage',               COALESCE(settings->'approval_matrix'->>'delete_rede_outage',               'gerente')
  ),
  true
)
WHERE deleted_at IS NULL;

-- ════════════════════════════════════════════════════════════════════════
-- b) approve_pending_action — versão estendida
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approve_pending_action(p_action_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action  public.pending_actions%ROWTYPE;
  v_org_id  uuid := public.user_org();
BEGIN
  SELECT * INTO v_action FROM public.pending_actions WHERE id = p_action_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pending action not found' USING ERRCODE = '02000'; END IF;
  IF v_action.organization_id != v_org_id THEN RAISE EXCEPTION 'cross-tenant access denied' USING ERRCODE = '42501'; END IF;
  IF v_action.status != 'pending' THEN RAISE EXCEPTION 'action is not pending (status=%)', v_action.status USING ERRCODE = '22000'; END IF;
  IF v_action.expires_at < now() THEN
    UPDATE public.pending_actions SET status = 'expired' WHERE id = p_action_id;
    RAISE EXCEPTION 'action expired' USING ERRCODE = '22008';
  END IF;
  IF v_action.requested_by = auth.uid() THEN RAISE EXCEPTION 'requester cannot approve their own action' USING ERRCODE = '42501'; END IF;
  IF NOT public.has_role(ARRAY[v_action.required_role]::public.user_role[]) AND
     NOT public.has_role(ARRAY['owner']::public.user_role[]) THEN
    RAISE EXCEPTION 'role % required to approve', v_action.required_role USING ERRCODE = '42501';
  END IF;

  CASE v_action.action_type
    -- Sprint 1
    WHEN 'delete_fvs' THEN UPDATE public.fvs SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'update_fvs_closed' THEN UPDATE public.fvs SET payload = COALESCE(v_action.payload, payload), updated_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 2
    WHEN 'delete_rdo' THEN UPDATE public.rdo SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'update_rdo_closed' THEN UPDATE public.rdo SET payload = COALESCE(v_action.payload, payload), updated_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_po' THEN UPDATE public.purchase_orders SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'update_po_approved' THEN UPDATE public.purchase_orders SET payload = COALESCE(v_action.payload, payload), updated_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_invoice' THEN UPDATE public.invoices SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_plan_scenario' THEN UPDATE public.plan_scenarios SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_plan_trecho' THEN UPDATE public.plan_trechos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 3
    WHEN 'delete_worker' THEN UPDATE public.workers SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_labor_crew' THEN UPDATE public.labor_crews SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_timecard' THEN UPDATE public.timecards SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_shift' THEN UPDATE public.shifts SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_worker_absence' THEN UPDATE public.worker_absences SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_lps_activity' THEN UPDATE public.lps_activities SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_lps_restriction' THEN UPDATE public.lps_restrictions SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'mark_restriction_resolved' THEN UPDATE public.lps_restrictions SET status = 'resolvida', resolved_at = now(), updated_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_lps_takt_zone' THEN UPDATE public.lps_takt_zones SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_operacao_campo_activity' THEN UPDATE public.operacao_campo_activities SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_operacao_campo_day' THEN UPDATE public.operacao_campo_days SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_master_activity' THEN UPDATE public.master_activities SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_master_baseline' THEN UPDATE public.master_baselines SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_lookahead_derived' THEN UPDATE public.lookahead_derived_activities SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_programacao_diaria' THEN UPDATE public.programacao_diaria SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_daily_report_activity' THEN UPDATE public.daily_report_activities SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_daily_report_equipment_log' THEN UPDATE public.daily_report_equipment_logs SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_daily_report_material_log' THEN UPDATE public.daily_report_material_logs SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_daily_report_photo' THEN UPDATE public.daily_report_photos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 4
    WHEN 'delete_project' THEN UPDATE public.projects SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_project_document' THEN UPDATE public.project_documents SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_quantitativo_budget' THEN UPDATE public.quantitativos_budgets SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_quantitativo_custom_base' THEN UPDATE public.quantitativos_custom_base SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_preconstrucao_session' THEN UPDATE public.preconstrucao_sessions SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_bim_project' THEN UPDATE public.bim_projects SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_bim_segment' THEN UPDATE public.bim_segments SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    -- Sprint 5
    WHEN 'delete_equipamento' THEN UPDATE public.equipamentos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_equipamento_manutencao' THEN UPDATE public.equipamentos_manutencoes SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_veiculo' THEN UPDATE public.veiculos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_driver' THEN UPDATE public.fleet_drivers SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_fuel_record' THEN UPDATE public.fleet_fuel_records SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_vehicle_maintenance' THEN UPDATE public.fleet_vehicle_maintenance SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_route' THEN UPDATE public.fleet_routes SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_service_order' THEN UPDATE public.fleet_service_orders SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_fine' THEN UPDATE public.fleet_fines SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_alert' THEN UPDATE public.fleet_alerts SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_fleet_schedule' THEN UPDATE public.fleet_schedules SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_otimizacao_routing' THEN UPDATE public.otimizacao_routing_recommendations SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_otimizacao_health' THEN UPDATE public.otimizacao_health_scores SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_otimizacao_buy_lease' THEN UPDATE public.otimizacao_buy_lease_analyses SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_mapa_interativo' THEN UPDATE public.mapas_interativos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_rede_ativo' THEN UPDATE public.rede_ativos SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_rede_service_order' THEN UPDATE public.rede_service_orders SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;
    WHEN 'delete_rede_outage' THEN UPDATE public.rede_outages SET deleted_at = now() WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

    ELSE
      RAISE NOTICE 'action_type % approved but no handler defined', v_action.action_type;
  END CASE;

  UPDATE public.pending_actions
    SET status = 'approved', approved_by = auth.uid(), approved_at = now()
    WHERE id = p_action_id;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (v_org_id, auth.uid(), 'approve_action', 'pending_actions', p_action_id::text,
          jsonb_build_object('action_type', v_action.action_type));
END $$;

GRANT EXECUTE ON FUNCTION public.approve_pending_action(uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- c) export_organization_data — versão estendida com 18 novas tabelas
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.export_organization_data(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF public.user_org() != p_org_id THEN
    RAISE EXCEPTION 'cross-tenant export denied' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(ARRAY['owner']::public.user_role[]) THEN
    RAISE EXCEPTION 'only owner can export org data' USING ERRCODE = '42501';
  END IF;

  -- Postgres limita jsonb_build_object a 100 args (50 pares). Dividimos em 3 blocos
  -- e concatenamos com ||.
  v_result := jsonb_build_object(
    'exported_at',                       now(),
    'exported_by',                       auth.uid(),
    'organization',                      (SELECT to_jsonb(o) FROM public.organizations o WHERE o.id = p_org_id),
    'profiles',                          (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM public.profiles p WHERE p.organization_id = p_org_id),
    'invitations',                       (SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) FROM public.invitations i WHERE i.organization_id = p_org_id),
    'fvs',                               (SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb) FROM public.fvs f WHERE f.organization_id = p_org_id),
    'rdo',                               (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.rdo r WHERE r.organization_id = p_org_id),
    'plan_trechos',                      (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.plan_trechos t WHERE t.organization_id = p_org_id),
    'plan_teams',                        (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.plan_teams t WHERE t.organization_id = p_org_id),
    'plan_holidays',                     (SELECT COALESCE(jsonb_agg(to_jsonb(h)), '[]'::jsonb) FROM public.plan_holidays h WHERE h.organization_id = p_org_id),
    'plan_scenarios',                    (SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM public.plan_scenarios s WHERE s.organization_id = p_org_id),
    'suppliers',                         (SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM public.suppliers s WHERE s.organization_id = p_org_id),
    'purchase_orders',                   (SELECT COALESCE(jsonb_agg(to_jsonb(po)), '[]'::jsonb) FROM public.purchase_orders po WHERE po.organization_id = p_org_id),
    'goods_receipts',                    (SELECT COALESCE(jsonb_agg(to_jsonb(gr)), '[]'::jsonb) FROM public.goods_receipts gr WHERE gr.organization_id = p_org_id),
    'invoices',                          (SELECT COALESCE(jsonb_agg(to_jsonb(inv)), '[]'::jsonb) FROM public.invoices inv WHERE inv.organization_id = p_org_id),
    'workers',                           (SELECT COALESCE(jsonb_agg(to_jsonb(w)), '[]'::jsonb) FROM public.workers w WHERE w.organization_id = p_org_id),
    'labor_crews',                       (SELECT COALESCE(jsonb_agg(to_jsonb(lc)), '[]'::jsonb) FROM public.labor_crews lc WHERE lc.organization_id = p_org_id),
    'timecards',                         (SELECT COALESCE(jsonb_agg(to_jsonb(tc)), '[]'::jsonb) FROM public.timecards tc WHERE tc.organization_id = p_org_id),
    'shifts',                            (SELECT COALESCE(jsonb_agg(to_jsonb(sh)), '[]'::jsonb) FROM public.shifts sh WHERE sh.organization_id = p_org_id),
    'worker_absences',                   (SELECT COALESCE(jsonb_agg(to_jsonb(wa)), '[]'::jsonb) FROM public.worker_absences wa WHERE wa.organization_id = p_org_id),
    'lps_activities',                    (SELECT COALESCE(jsonb_agg(to_jsonb(la)), '[]'::jsonb) FROM public.lps_activities la WHERE la.organization_id = p_org_id),
    'lps_restrictions',                  (SELECT COALESCE(jsonb_agg(to_jsonb(lr)), '[]'::jsonb) FROM public.lps_restrictions lr WHERE lr.organization_id = p_org_id),
    'lps_takt_zones',                    (SELECT COALESCE(jsonb_agg(to_jsonb(lt)), '[]'::jsonb) FROM public.lps_takt_zones lt WHERE lt.organization_id = p_org_id),
    'operacao_campo_activities',         (SELECT COALESCE(jsonb_agg(to_jsonb(oa)), '[]'::jsonb) FROM public.operacao_campo_activities oa WHERE oa.organization_id = p_org_id),
    'operacao_campo_days',               (SELECT COALESCE(jsonb_agg(to_jsonb(od)), '[]'::jsonb) FROM public.operacao_campo_days od WHERE od.organization_id = p_org_id)
  );

  v_result := v_result || jsonb_build_object(
    'master_activities',                 (SELECT COALESCE(jsonb_agg(to_jsonb(ma)), '[]'::jsonb) FROM public.master_activities ma WHERE ma.organization_id = p_org_id),
    'master_baselines',                  (SELECT COALESCE(jsonb_agg(to_jsonb(mb)), '[]'::jsonb) FROM public.master_baselines mb WHERE mb.organization_id = p_org_id),
    'lookahead_derived_activities',      (SELECT COALESCE(jsonb_agg(to_jsonb(ld)), '[]'::jsonb) FROM public.lookahead_derived_activities ld WHERE ld.organization_id = p_org_id),
    'programacao_diaria',                (SELECT COALESCE(jsonb_agg(to_jsonb(pd)), '[]'::jsonb) FROM public.programacao_diaria pd WHERE pd.organization_id = p_org_id),
    'daily_report_activities',           (SELECT COALESCE(jsonb_agg(to_jsonb(dra)), '[]'::jsonb) FROM public.daily_report_activities dra WHERE dra.organization_id = p_org_id),
    'daily_report_equipment_logs',       (SELECT COALESCE(jsonb_agg(to_jsonb(dre)), '[]'::jsonb) FROM public.daily_report_equipment_logs dre WHERE dre.organization_id = p_org_id),
    'daily_report_material_logs',        (SELECT COALESCE(jsonb_agg(to_jsonb(drm)), '[]'::jsonb) FROM public.daily_report_material_logs drm WHERE drm.organization_id = p_org_id),
    'daily_report_photos',               (SELECT COALESCE(jsonb_agg(to_jsonb(drp)), '[]'::jsonb) FROM public.daily_report_photos drp WHERE drp.organization_id = p_org_id),
    'projects',                          (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM public.projects p WHERE p.organization_id = p_org_id),
    'project_documents',                 (SELECT COALESCE(jsonb_agg(to_jsonb(pd)), '[]'::jsonb) FROM public.project_documents pd WHERE pd.organization_id = p_org_id),
    'quantitativos_budgets',             (SELECT COALESCE(jsonb_agg(to_jsonb(qb)), '[]'::jsonb) FROM public.quantitativos_budgets qb WHERE qb.organization_id = p_org_id),
    'quantitativos_custom_base',         (SELECT COALESCE(jsonb_agg(to_jsonb(qc)), '[]'::jsonb) FROM public.quantitativos_custom_base qc WHERE qc.organization_id = p_org_id),
    'preconstrucao_sessions',            (SELECT COALESCE(jsonb_agg(to_jsonb(ps)), '[]'::jsonb) FROM public.preconstrucao_sessions ps WHERE ps.organization_id = p_org_id),
    'bim_projects',                      (SELECT COALESCE(jsonb_agg(to_jsonb(bp)), '[]'::jsonb) FROM public.bim_projects bp WHERE bp.organization_id = p_org_id),
    'bim_segments',                      (SELECT COALESCE(jsonb_agg(to_jsonb(bs)), '[]'::jsonb) FROM public.bim_segments bs WHERE bs.organization_id = p_org_id),
    'equipamentos',                      (SELECT COALESCE(jsonb_agg(to_jsonb(e)), '[]'::jsonb) FROM public.equipamentos e WHERE e.organization_id = p_org_id),
    'equipamentos_manutencoes',          (SELECT COALESCE(jsonb_agg(to_jsonb(em)), '[]'::jsonb) FROM public.equipamentos_manutencoes em WHERE em.organization_id = p_org_id),
    'veiculos',                          (SELECT COALESCE(jsonb_agg(to_jsonb(v)), '[]'::jsonb) FROM public.veiculos v WHERE v.organization_id = p_org_id),
    'fleet_drivers',                     (SELECT COALESCE(jsonb_agg(to_jsonb(fd)), '[]'::jsonb) FROM public.fleet_drivers fd WHERE fd.organization_id = p_org_id),
    'fleet_fuel_records',                (SELECT COALESCE(jsonb_agg(to_jsonb(ffr)), '[]'::jsonb) FROM public.fleet_fuel_records ffr WHERE ffr.organization_id = p_org_id),
    'fleet_vehicle_maintenance',         (SELECT COALESCE(jsonb_agg(to_jsonb(fvm)), '[]'::jsonb) FROM public.fleet_vehicle_maintenance fvm WHERE fvm.organization_id = p_org_id),
    'fleet_routes',                      (SELECT COALESCE(jsonb_agg(to_jsonb(fr)), '[]'::jsonb) FROM public.fleet_routes fr WHERE fr.organization_id = p_org_id),
    'fleet_service_orders',              (SELECT COALESCE(jsonb_agg(to_jsonb(fso)), '[]'::jsonb) FROM public.fleet_service_orders fso WHERE fso.organization_id = p_org_id),
    'fleet_fines',                       (SELECT COALESCE(jsonb_agg(to_jsonb(ff)), '[]'::jsonb) FROM public.fleet_fines ff WHERE ff.organization_id = p_org_id)
  );

  v_result := v_result || jsonb_build_object(
    'fleet_alerts',                      (SELECT COALESCE(jsonb_agg(to_jsonb(fa)), '[]'::jsonb) FROM public.fleet_alerts fa WHERE fa.organization_id = p_org_id),
    'fleet_schedules',                   (SELECT COALESCE(jsonb_agg(to_jsonb(fs)), '[]'::jsonb) FROM public.fleet_schedules fs WHERE fs.organization_id = p_org_id),
    'otimizacao_routing_recommendations',(SELECT COALESCE(jsonb_agg(to_jsonb(otrr)), '[]'::jsonb) FROM public.otimizacao_routing_recommendations otrr WHERE otrr.organization_id = p_org_id),
    'otimizacao_health_scores',          (SELECT COALESCE(jsonb_agg(to_jsonb(oths)), '[]'::jsonb) FROM public.otimizacao_health_scores oths WHERE oths.organization_id = p_org_id),
    'otimizacao_buy_lease_analyses',     (SELECT COALESCE(jsonb_agg(to_jsonb(otbl)), '[]'::jsonb) FROM public.otimizacao_buy_lease_analyses otbl WHERE otbl.organization_id = p_org_id),
    'mapas_interativos',                 (SELECT COALESCE(jsonb_agg(to_jsonb(mi)), '[]'::jsonb) FROM public.mapas_interativos mi WHERE mi.organization_id = p_org_id),
    'rede_ativos',                       (SELECT COALESCE(jsonb_agg(to_jsonb(ra)), '[]'::jsonb) FROM public.rede_ativos ra WHERE ra.organization_id = p_org_id),
    'rede_service_orders',               (SELECT COALESCE(jsonb_agg(to_jsonb(rso)), '[]'::jsonb) FROM public.rede_service_orders rso WHERE rso.organization_id = p_org_id),
    'rede_outages',                      (SELECT COALESCE(jsonb_agg(to_jsonb(ro)), '[]'::jsonb) FROM public.rede_outages ro WHERE ro.organization_id = p_org_id),
    'pending_actions',                   (SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM public.pending_actions a WHERE a.organization_id = p_org_id),
    'audit_log',                         (SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb) FROM public.audit_log l WHERE l.organization_id = p_org_id)
  );

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id)
  VALUES (p_org_id, auth.uid(), 'export', 'organizations', p_org_id::text);

  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.export_organization_data(uuid) TO authenticated;
