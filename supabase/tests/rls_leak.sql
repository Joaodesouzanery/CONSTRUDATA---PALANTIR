-- rls_leak.sql
-- Suite de testes de vazamento entre tenants. DEVE passar 100% antes de
-- qualquer dado real entrar no banco.
--
-- Como rodar (psql conectado como postgres/service_role):
--   psql "$DATABASE_URL" -f supabase/tests/rls_leak.sql
--
-- O script:
--   1. Cria 2 organizações fictícias (org A e org B) com 1 owner cada
--   2. Insere dados de FVS em cada
--   3. Simula login como owner A e tenta acessar dados de B → deve falhar
--   4. Tenta forjar organization_id em INSERT → deve falhar
--
-- Qualquer linha de B visível para A é FALHA CRÍTICA.

BEGIN;

-- Limpa execução anterior se existir
DELETE FROM public.audit_log         WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
-- Sprint 6 — Final cleanup
DELETE FROM public.company_logos          WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.user_routines          WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.agenda_tasks           WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.agenda_resources       WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.obra_levantamentos     WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.change_order_photos    WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.change_orders          WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.construction_sites     WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.evm_measurements       WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.evm_cost_accounts      WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.evm_work_packages      WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
-- Sprint 5 — Frotas/Geo cleanup
DELETE FROM public.rede_outages                       WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.rede_service_orders                WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.rede_ativos                        WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.mapas_interativos                  WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.otimizacao_buy_lease_analyses      WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.otimizacao_health_scores           WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.otimizacao_routing_recommendations WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.fleet_schedules                    WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.fleet_alerts                       WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.fleet_fines                        WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.fleet_service_orders               WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.fleet_routes                       WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.fleet_vehicle_maintenance          WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.fleet_fuel_records                 WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.fleet_drivers                      WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.veiculos                           WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.maintenance_work_order_assets      WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.maintenance_work_orders            WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.maintenance_monitoring_points      WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.maintenance_plan_assets            WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.maintenance_plans                  WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.equipamentos_manutencoes           WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.equipamentos                       WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
-- Sprint 4 — Núcleo + BIM cleanup
DELETE FROM public.bim_segments              WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.bim_projects              WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.preconstrucao_sessions    WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.quantitativos_custom_base WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.quantitativos_budgets     WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.project_documents         WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.projects                  WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
-- Sprint 3 — Grupo Operacional cleanup
DELETE FROM public.daily_report_photos          WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.daily_report_material_logs   WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.daily_report_equipment_logs  WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.daily_report_activities      WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.programacao_diaria           WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.lookahead_derived_activities WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.master_baselines             WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.master_activities            WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.operacao_campo_days          WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.operacao_campo_activities    WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.lps_takt_zones               WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.lps_restrictions             WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.lps_activities               WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.worker_absences              WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.shifts                       WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.timecards                    WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.labor_crews                  WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.workers                      WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.invoices          WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.goods_receipts    WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.purchase_orders   WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.suppliers         WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.suprimentos_estoque_movimentacoes WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.suprimentos_estoque_itens         WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.suprimentos_depositos             WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.suprimentos_ordens                WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.suprimentos_itens                 WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.suprimentos_ruas                  WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.suprimentos_nucleos               WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.plan_scenarios    WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.plan_holidays     WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.plan_teams        WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.plan_trechos      WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.rdo               WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.fvs               WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.memberships       WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.profiles          WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug LIKE 'rls-test-%');
DELETE FROM public.organizations     WHERE slug LIKE 'rls-test-%';
DELETE FROM auth.users               WHERE email LIKE 'rls-test-%@example.com';

-- ─── Setup: criar 2 users + 2 orgs + 2 profiles ────────────────────────
DO $$
DECLARE
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_user_c uuid := gen_random_uuid();
  v_org_a  uuid := gen_random_uuid();
  v_org_b  uuid := gen_random_uuid();
  v_dep_a uuid := gen_random_uuid();
  v_dep_b uuid := gen_random_uuid();
  v_item_a uuid := gen_random_uuid();
  v_item_b uuid := gen_random_uuid();
  v_asset_a uuid := gen_random_uuid();
  v_asset_b uuid := gen_random_uuid();
  v_maintenance_plan_a uuid := gen_random_uuid();
  v_maintenance_plan_b uuid := gen_random_uuid();
  v_maintenance_order_a uuid := gen_random_uuid();
  v_maintenance_order_b uuid := gen_random_uuid();
  v_nucleo_a uuid := gen_random_uuid();
  v_nucleo_b uuid := gen_random_uuid();
  v_rua_a uuid := gen_random_uuid();
  v_rua_b uuid := gen_random_uuid();
BEGIN
  -- Insere direto em auth.users (só funciona como service_role)
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_user_a, '00000000-0000-0000-0000-000000000000', 'rls-test-a@example.com', crypt('test123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_user_b, '00000000-0000-0000-0000-000000000000', 'rls-test-b@example.com', crypt('test123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_user_c, '00000000-0000-0000-0000-000000000000', 'rls-test-global@example.com', crypt('test123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.organizations (id, name, slug, owner_id) VALUES
    (v_org_a, 'Org A Test', 'rls-test-a', v_user_a),
    (v_org_b, 'Org B Test', 'rls-test-b', v_user_b);

  INSERT INTO public.profiles (id, organization_id, full_name, email, role, activated_at) VALUES
    (v_user_a, v_org_a, 'Owner A', 'rls-test-a@example.com', 'owner', now()),
    (v_user_b, v_org_b, 'Owner B', 'rls-test-b@example.com', 'owner', now()),
    (v_user_c, v_org_a, 'Global Owner', 'rls-test-global@example.com', 'owner', now());

  INSERT INTO public.memberships (organization_id, user_id, role, status, joined_at) VALUES
    (v_org_a, v_user_a, 'owner', 'active', now()),
    (v_org_b, v_user_b, 'owner', 'active', now()),
    (v_org_a, v_user_c, 'owner', 'active', now()),
    (v_org_b, v_user_c, 'owner', 'active', now());

  INSERT INTO public.fvs (organization_id, number, document_code, contract_no, date, payload, created_by) VALUES
    (v_org_a, 1, 'FOR-FVS-A', 'CONTRACT-A', current_date, '{"items":[]}'::jsonb, v_user_a),
    (v_org_b, 1, 'FOR-FVS-B', 'CONTRACT-B', current_date, '{"items":[]}'::jsonb, v_user_b);

  -- Sprint 2 entities
  INSERT INTO public.rdo (organization_id, number, date, payload, created_by) VALUES
    (v_org_a, 1, current_date, '{}'::jsonb, v_user_a),
    (v_org_b, 1, current_date, '{}'::jsonb, v_user_b);

  INSERT INTO public.plan_trechos (organization_id, code, description, created_by) VALUES
    (v_org_a, 'T01', 'Trecho A', v_user_a),
    (v_org_b, 'T01', 'Trecho B', v_user_b);

  INSERT INTO public.purchase_orders (organization_id, code, supplier, issued_date, created_by) VALUES
    (v_org_a, 'PO-001', 'Fornecedor A', current_date, v_user_a),
    (v_org_b, 'PO-001', 'Fornecedor B', current_date, v_user_b);

  INSERT INTO public.obra_levantamentos (organization_id, obra, contratante, numero_orcamento, status, payload, created_by) VALUES
    (v_org_a, 'Levantamento A', 'Cliente A', 'A-001', 'rascunho', '{"obra":"Levantamento A"}'::jsonb, v_user_a),
    (v_org_b, 'Levantamento B', 'Cliente B', 'B-001', 'rascunho', '{"obra":"Levantamento B"}'::jsonb, v_user_b);

  INSERT INTO public.suprimentos_depositos (id, organization_id, frente, descricao, created_by) VALUES
    (v_dep_a, v_org_a, 'Dep A', 'Almox A', v_user_a),
    (v_dep_b, v_org_b, 'Dep B', 'Almox B', v_user_b);
  INSERT INTO public.suprimentos_estoque_itens (id, organization_id, deposito_id, descricao, unidade, qtd_disponivel, estoque_minimo, created_by) VALUES
    (v_item_a, v_org_a, v_dep_a, 'Material A CEARA', 'un', 10, 1, v_user_a),
    (v_item_b, v_org_b, v_dep_b, 'Material B CEARA', 'un', 20, 2, v_user_b);
  INSERT INTO public.suprimentos_estoque_movimentacoes (organization_id, item_id, deposito_id, tipo, quantidade, created_by) VALUES
    (v_org_a, v_item_a, v_dep_a, 'entrada', 10, v_user_a),
    (v_org_b, v_item_b, v_dep_b, 'entrada', 20, v_user_b);

  INSERT INTO public.suprimentos_nucleos (id, organization_id, nome, tipo, created_by) VALUES
    (v_nucleo_a, v_org_a, 'Nucleo A', 'AG', v_user_a),
    (v_nucleo_b, v_org_b, 'Nucleo B', 'AG', v_user_b);
  INSERT INTO public.suprimentos_ruas (id, organization_id, nucleo_id, nome, created_by) VALUES
    (v_rua_a, v_org_a, v_nucleo_a, 'Rua A', v_user_a),
    (v_rua_b, v_org_b, v_nucleo_b, 'Rua B', v_user_b);
  INSERT INTO public.suprimentos_itens (organization_id, rua_id, material, unidade, quantidade, rede, status, created_by) VALUES
    (v_org_a, v_rua_a, 'Planilha A', 'm', 1, 'AG', 'pend', v_user_a),
    (v_org_b, v_rua_b, 'Planilha B', 'm', 1, 'AG', 'pend', v_user_b);
  INSERT INTO public.suprimentos_ordens (organization_id, codigo, status, created_by) VALUES
    (v_org_a, 'SUP-A', 'aberta', v_user_a),
    (v_org_b, 'SUP-B', 'aberta', v_user_b);

  -- Sprint 3 — Grupo Operacional fixtures (1 row each, per org)
  INSERT INTO public.workers (id, organization_id, name, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'Worker A', v_user_a),
    (gen_random_uuid(), v_org_b, 'Worker B', v_user_b);
  INSERT INTO public.labor_crews (id, organization_id, name, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'Crew A', v_user_a),
    (gen_random_uuid(), v_org_b, 'Crew B', v_user_b);
  INSERT INTO public.timecards (id, organization_id, date, created_by) VALUES
    (gen_random_uuid(), v_org_a, current_date, v_user_a),
    (gen_random_uuid(), v_org_b, current_date, v_user_b);
  INSERT INTO public.shifts (id, organization_id, date, type, created_by) VALUES
    (gen_random_uuid(), v_org_a, current_date, 'regular', v_user_a),
    (gen_random_uuid(), v_org_b, current_date, 'regular', v_user_b);
  INSERT INTO public.worker_absences (id, organization_id, date, type, created_by) VALUES
    (gen_random_uuid(), v_org_a, current_date, 'sick_leave', v_user_a),
    (gen_random_uuid(), v_org_b, current_date, 'sick_leave', v_user_b);
  INSERT INTO public.lps_activities (id, organization_id, week, created_by) VALUES
    (gen_random_uuid(), v_org_a, '2026-W15', v_user_a),
    (gen_random_uuid(), v_org_b, '2026-W15', v_user_b);
  INSERT INTO public.lps_restrictions (id, organization_id, tema, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'Tema A', v_user_a),
    (gen_random_uuid(), v_org_b, 'Tema B', v_user_b);
  INSERT INTO public.lps_takt_zones (id, organization_id, code, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'TKA', v_user_a),
    (gen_random_uuid(), v_org_b, 'TKB', v_user_b);
  INSERT INTO public.operacao_campo_activities (id, organization_id, name, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'Field A', v_user_a),
    (gen_random_uuid(), v_org_b, 'Field B', v_user_b);
  INSERT INTO public.operacao_campo_days (id, organization_id, date, created_by) VALUES
    (gen_random_uuid(), v_org_a, current_date, v_user_a),
    (gen_random_uuid(), v_org_b, current_date, v_user_b);
  INSERT INTO public.master_activities (id, organization_id, name, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'Master A', v_user_a),
    (gen_random_uuid(), v_org_b, 'Master B', v_user_b);
  INSERT INTO public.master_baselines (id, organization_id, name, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'BL A', v_user_a),
    (gen_random_uuid(), v_org_b, 'BL B', v_user_b);
  INSERT INTO public.lookahead_derived_activities (id, organization_id, week_iso, created_by) VALUES
    (gen_random_uuid(), v_org_a, '2026-W15', v_user_a),
    (gen_random_uuid(), v_org_b, '2026-W15', v_user_b);
  INSERT INTO public.programacao_diaria (id, organization_id, date, created_by) VALUES
    (gen_random_uuid(), v_org_a, current_date, v_user_a),
    (gen_random_uuid(), v_org_b, current_date, v_user_b);
  INSERT INTO public.daily_report_activities (id, organization_id, report_date, created_by) VALUES
    (gen_random_uuid(), v_org_a, current_date, v_user_a),
    (gen_random_uuid(), v_org_b, current_date, v_user_b);
  INSERT INTO public.daily_report_equipment_logs (id, organization_id, report_date, created_by) VALUES
    (gen_random_uuid(), v_org_a, current_date, v_user_a),
    (gen_random_uuid(), v_org_b, current_date, v_user_b);
  INSERT INTO public.daily_report_material_logs (id, organization_id, report_date, created_by) VALUES
    (gen_random_uuid(), v_org_a, current_date, v_user_a),
    (gen_random_uuid(), v_org_b, current_date, v_user_b);
  INSERT INTO public.daily_report_photos (id, organization_id, report_date, created_by) VALUES
    (gen_random_uuid(), v_org_a, current_date, v_user_a),
    (gen_random_uuid(), v_org_b, current_date, v_user_b);

  -- Sprint 4 — Núcleo + BIM fixtures
  INSERT INTO public.projects (id, organization_id, code, name, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'PRJ-A', 'Projeto A', v_user_a),
    (gen_random_uuid(), v_org_b, 'PRJ-B', 'Projeto B', v_user_b);
  INSERT INTO public.project_documents (id, organization_id, project_id, name, storage_path, created_by)
    SELECT gen_random_uuid(), v_org_a, p.id, 'doc.pdf', v_org_a || '/' || p.id || '/doc.pdf', v_user_a
      FROM public.projects p WHERE p.organization_id = v_org_a LIMIT 1;
  INSERT INTO public.project_documents (id, organization_id, project_id, name, storage_path, created_by)
    SELECT gen_random_uuid(), v_org_b, p.id, 'doc.pdf', v_org_b || '/' || p.id || '/doc.pdf', v_user_b
      FROM public.projects p WHERE p.organization_id = v_org_b LIMIT 1;
  INSERT INTO public.quantitativos_budgets (id, organization_id, name, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'Budget A', v_user_a),
    (gen_random_uuid(), v_org_b, 'Budget B', v_user_b);
  INSERT INTO public.quantitativos_custom_base (id, organization_id, code, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'CUST-A', v_user_a),
    (gen_random_uuid(), v_org_b, 'CUST-B', v_user_b);
  INSERT INTO public.preconstrucao_sessions (id, organization_id, created_by) VALUES
    (gen_random_uuid(), v_org_a, v_user_a),
    (gen_random_uuid(), v_org_b, v_user_b);
  INSERT INTO public.bim_projects (id, organization_id, name, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'BIM A', v_user_a),
    (gen_random_uuid(), v_org_b, 'BIM B', v_user_b);
  INSERT INTO public.bim_segments (id, organization_id, bim_project_id, created_by)
    SELECT gen_random_uuid(), v_org_a, bp.id, v_user_a FROM public.bim_projects bp WHERE bp.organization_id = v_org_a LIMIT 1;
  INSERT INTO public.bim_segments (id, organization_id, bim_project_id, created_by)
    SELECT gen_random_uuid(), v_org_b, bp.id, v_user_b FROM public.bim_projects bp WHERE bp.organization_id = v_org_b LIMIT 1;

  -- Sprint 5 — Frotas/Geo fixtures
  INSERT INTO public.equipamentos (id, organization_id, code, name, created_by) VALUES
    (v_asset_a, v_org_a, 'EQ-A', 'Eq A', v_user_a),
    (v_asset_b, v_org_b, 'EQ-B', 'Eq B', v_user_b);
  INSERT INTO public.equipamentos_manutencoes (id, organization_id, type, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'preventive', v_user_a),
    (gen_random_uuid(), v_org_b, 'preventive', v_user_b);
  INSERT INTO public.maintenance_plans (id, organization_id, code, title, created_by) VALUES
    (v_maintenance_plan_a, v_org_a, 'MP-A', 'Plano A', v_user_a),
    (v_maintenance_plan_b, v_org_b, 'MP-B', 'Plano B', v_user_b);
  INSERT INTO public.maintenance_plan_assets (organization_id, plan_id, asset_id, created_by) VALUES
    (v_org_a, v_maintenance_plan_a, v_asset_a, v_user_a),
    (v_org_b, v_maintenance_plan_b, v_asset_b, v_user_b);
  INSERT INTO public.maintenance_work_orders (id, organization_id, plan_id, code, title, created_by) VALUES
    (v_maintenance_order_a, v_org_a, v_maintenance_plan_a, 'MWO-A', 'OS A', v_user_a),
    (v_maintenance_order_b, v_org_b, v_maintenance_plan_b, 'MWO-B', 'OS B', v_user_b);
  INSERT INTO public.maintenance_work_order_assets (organization_id, work_order_id, asset_id, created_by) VALUES
    (v_org_a, v_maintenance_order_a, v_asset_a, v_user_a),
    (v_org_b, v_maintenance_order_b, v_asset_b, v_user_b);
  INSERT INTO public.maintenance_monitoring_points (organization_id, asset_id, location_part, description, unit, last_reading_date, last_reading_value, created_by) VALUES
    (v_org_a, v_asset_a, 'Chiller A', 'Pressao baixa', '(PSI) Pressao', current_date, '12', v_user_a),
    (v_org_b, v_asset_b, 'Chiller B', 'Temperatura', '(C) Celsius', current_date, '24', v_user_b);
  INSERT INTO public.veiculos (id, organization_id, plate, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'AAA-0001', v_user_a),
    (gen_random_uuid(), v_org_b, 'BBB-0001', v_user_b);
  INSERT INTO public.fleet_drivers (id, organization_id, name, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'Driver A', v_user_a),
    (gen_random_uuid(), v_org_b, 'Driver B', v_user_b);
  INSERT INTO public.fleet_fuel_records (id, organization_id, date, created_by) VALUES
    (gen_random_uuid(), v_org_a, current_date, v_user_a),
    (gen_random_uuid(), v_org_b, current_date, v_user_b);
  INSERT INTO public.fleet_vehicle_maintenance (id, organization_id, service_date, created_by) VALUES
    (gen_random_uuid(), v_org_a, current_date, v_user_a),
    (gen_random_uuid(), v_org_b, current_date, v_user_b);
  INSERT INTO public.fleet_routes (id, organization_id, date, created_by) VALUES
    (gen_random_uuid(), v_org_a, current_date, v_user_a),
    (gen_random_uuid(), v_org_b, current_date, v_user_b);
  INSERT INTO public.fleet_service_orders (id, organization_id, code, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'OS-A', v_user_a),
    (gen_random_uuid(), v_org_b, 'OS-B', v_user_b);
  INSERT INTO public.fleet_fines (id, organization_id, date, created_by) VALUES
    (gen_random_uuid(), v_org_a, current_date, v_user_a),
    (gen_random_uuid(), v_org_b, current_date, v_user_b);
  INSERT INTO public.fleet_alerts (id, organization_id, severity, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'high', v_user_a),
    (gen_random_uuid(), v_org_b, 'high', v_user_b);
  INSERT INTO public.fleet_schedules (id, organization_id, scheduled_date, created_by) VALUES
    (gen_random_uuid(), v_org_a, current_date, v_user_a),
    (gen_random_uuid(), v_org_b, current_date, v_user_b);
  INSERT INTO public.otimizacao_routing_recommendations (id, organization_id, priority, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'high', v_user_a),
    (gen_random_uuid(), v_org_b, 'high', v_user_b);
  INSERT INTO public.otimizacao_health_scores (id, organization_id, risk_level, health_score, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'medium', 70, v_user_a),
    (gen_random_uuid(), v_org_b, 'medium', 70, v_user_b);
  INSERT INTO public.otimizacao_buy_lease_analyses (id, organization_id, equipment_type, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'escavadeira', v_user_a),
    (gen_random_uuid(), v_org_b, 'escavadeira', v_user_b);
  INSERT INTO public.mapas_interativos (id, organization_id, name, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'Mapa A', v_user_a),
    (gen_random_uuid(), v_org_b, 'Mapa B', v_user_b);
  INSERT INTO public.rede_ativos (id, organization_id, asset_type, code, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'network', 'RA-A', v_user_a),
    (gen_random_uuid(), v_org_b, 'network', 'RA-B', v_user_b);
  INSERT INTO public.rede_service_orders (id, organization_id, code, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'RSO-A', v_user_a),
    (gen_random_uuid(), v_org_b, 'RSO-B', v_user_b);
  INSERT INTO public.rede_outages (id, organization_id, type, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'water', v_user_a),
    (gen_random_uuid(), v_org_b, 'water', v_user_b);

  -- Sprint 6 — Final fixtures
  INSERT INTO public.evm_work_packages (id, organization_id, code, name, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'WP-A', 'WP A', v_user_a),
    (gen_random_uuid(), v_org_b, 'WP-B', 'WP B', v_user_b);
  INSERT INTO public.evm_cost_accounts (id, organization_id, pillar, total_cost_brl, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'material', 1000, v_user_a),
    (gen_random_uuid(), v_org_b, 'material', 1000, v_user_b);
  INSERT INTO public.evm_measurements (id, organization_id, composite_score, created_by) VALUES
    (gen_random_uuid(), v_org_a, 0.85, v_user_a),
    (gen_random_uuid(), v_org_b, 0.85, v_user_b);
  INSERT INTO public.construction_sites (id, organization_id, name, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'Site A', v_user_a),
    (gen_random_uuid(), v_org_b, 'Site B', v_user_b);
  INSERT INTO public.change_orders (id, organization_id, title, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'CO A', v_user_a),
    (gen_random_uuid(), v_org_b, 'CO B', v_user_b);
  INSERT INTO public.change_order_photos (id, organization_id, change_order_id, storage_path, created_by)
    SELECT gen_random_uuid(), v_org_a, co.id, v_org_a || '/' || co.id || '/p.jpg', v_user_a
      FROM public.change_orders co WHERE co.organization_id = v_org_a LIMIT 1;
  INSERT INTO public.change_order_photos (id, organization_id, change_order_id, storage_path, created_by)
    SELECT gen_random_uuid(), v_org_b, co.id, v_org_b || '/' || co.id || '/p.jpg', v_user_b
      FROM public.change_orders co WHERE co.organization_id = v_org_b LIMIT 1;
  INSERT INTO public.agenda_resources (id, organization_id, name, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'Res A', v_user_a),
    (gen_random_uuid(), v_org_b, 'Res B', v_user_b);
  INSERT INTO public.agenda_tasks (id, organization_id, start_date, end_date, created_by) VALUES
    (gen_random_uuid(), v_org_a, current_date, current_date + 1, v_user_a),
    (gen_random_uuid(), v_org_b, current_date, current_date + 1, v_user_b);
  INSERT INTO public.user_routines (user_id, organization_id, persona) VALUES
    (v_user_a, v_org_a, 'engenheiro'),
    (v_user_b, v_org_b, 'engenheiro');
  INSERT INTO public.company_logos (id, organization_id, name, storage_path, created_by) VALUES
    (gen_random_uuid(), v_org_a, 'Logo A', v_org_a || '/logos/a.png', v_user_a),
    (gen_random_uuid(), v_org_b, 'Logo B', v_org_b || '/logos/b.png', v_user_b);

  -- Guarda IDs em temp table para uso pelas asserções
  CREATE TEMP TABLE rls_test_ctx (
    user_a uuid, user_b uuid, user_c uuid, org_a uuid, org_b uuid, dep_a uuid, dep_b uuid, item_a uuid, item_b uuid
  );
  INSERT INTO rls_test_ctx VALUES (v_user_a, v_user_b, v_user_c, v_org_a, v_org_b, v_dep_a, v_dep_b, v_item_a, v_item_b);
END $$;

-- ─── Testes ─────────────────────────────────────────────────────────────
-- Função helper para simular auth.uid() = um usuário específico
-- (isso só funciona dentro de uma sessão; em produção o JWT define isso)

DO $$
DECLARE
  v_user_a uuid;
  v_user_b uuid;
  v_user_c uuid;
  v_org_a  uuid;
  v_org_b  uuid;
  v_dep_a uuid;
  v_dep_b uuid;
  v_item_a uuid;
  v_item_b uuid;
  v_count  integer;
  v_failed integer := 0;
BEGIN
  SELECT user_a, user_b, user_c, org_a, org_b, dep_a, dep_b, item_a, item_b
    INTO v_user_a, v_user_b, v_user_c, v_org_a, v_org_b, v_dep_a, v_dep_b, v_item_a, v_item_b
  FROM rls_test_ctx;

  -- Simula login como user A
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- TESTE 1: SELECT em fvs deve retornar APENAS a FVS de A
  SELECT count(*) INTO v_count FROM public.fvs;
  IF v_count != 1 THEN
    RAISE WARNING 'TEST 1 FAILED: expected 1 fvs visible to user A, got %', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 1 PASS: user A sees only own fvs';
  END IF;

  -- TESTE 2: SELECT específico em fvs de B deve retornar 0
  SELECT count(*) INTO v_count FROM public.fvs WHERE organization_id = v_org_b;
  IF v_count != 0 THEN
    RAISE WARNING 'TEST 2 FAILED: user A sees % rows of org B', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 2 PASS: user A cannot see org B fvs';
  END IF;

  -- TESTE 3: Tentar INSERT forjando organization_id de B deve falhar
  BEGIN
    INSERT INTO public.fvs (organization_id, number, document_code, contract_no, date, payload, created_by)
    VALUES (v_org_b, 99, 'FORGED', 'X', current_date, '{}'::jsonb, v_user_a);
    RAISE WARNING 'TEST 3 FAILED: forged INSERT into org B was allowed';
    v_failed := v_failed + 1;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'TEST 3 PASS: forged INSERT blocked by RLS';
  END;

  -- TESTE 4: SELECT em profiles deve mostrar só profiles da org A
  SELECT count(*) INTO v_count FROM public.profiles;
  IF v_count != 1 THEN
    RAISE WARNING 'TEST 4 FAILED: expected 1 profile visible, got %', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 4 PASS: user A sees only profiles in own org';
  END IF;

  -- TESTE 5: SELECT em organizations deve retornar só org A
  SELECT count(*) INTO v_count FROM public.organizations;
  IF v_count != 1 THEN
    RAISE WARNING 'TEST 5 FAILED: user A sees % organizations', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 5 PASS: user A sees only own organization';
  END IF;

  -- TESTE 6: DELETE direto em fvs deve falhar (precisa pendência aprovada)
  BEGIN
    DELETE FROM public.fvs WHERE organization_id = v_org_a;
    IF FOUND THEN
      RAISE WARNING 'TEST 6 FAILED: direct DELETE on fvs allowed';
      v_failed := v_failed + 1;
    ELSE
      RAISE NOTICE 'TEST 6 PASS: direct DELETE blocked';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 6 PASS: direct DELETE rejected';
  END;

  -- TESTE 7: UPDATE em fvs de B deve afetar 0 linhas
  UPDATE public.fvs SET document_code = 'HACKED' WHERE organization_id = v_org_b;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count != 0 THEN
    RAISE WARNING 'TEST 7 FAILED: user A updated % rows of org B', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 7 PASS: cross-tenant UPDATE has zero effect';
  END IF;

  -- TESTE 8: audit_log de B deve ser invisível
  SELECT count(*) INTO v_count FROM public.audit_log WHERE organization_id = v_org_b;
  IF v_count != 0 THEN
    RAISE WARNING 'TEST 8 FAILED: user A sees % audit rows of org B', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 8 PASS: cross-tenant audit_log invisible';
  END IF;

  -- ─── Sprint 2 — Batch 1 leak tests ─────────────────────────────────

  -- TESTE 9: rdo de B invisível para A
  SELECT count(*) INTO v_count FROM public.rdo WHERE organization_id = v_org_b;
  IF v_count != 0 THEN
    RAISE WARNING 'TEST 9 FAILED: user A sees % rdo of org B', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 9 PASS: cross-tenant rdo invisible';
  END IF;

  -- TESTE 10: plan_trechos de B invisível para A
  SELECT count(*) INTO v_count FROM public.plan_trechos WHERE organization_id = v_org_b;
  IF v_count != 0 THEN
    RAISE WARNING 'TEST 10 FAILED: user A sees % plan_trechos of org B', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 10 PASS: cross-tenant plan_trechos invisible';
  END IF;

  -- TESTE 11: purchase_orders de B invisível para A
  SELECT count(*) INTO v_count FROM public.purchase_orders WHERE organization_id = v_org_b;
  IF v_count != 0 THEN
    RAISE WARNING 'TEST 11 FAILED: user A sees % purchase_orders of org B', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 11 PASS: cross-tenant purchase_orders invisible';
  END IF;

  -- TESTE 11a: levantamento de obra de B invisivel para A
  SELECT count(*) INTO v_count FROM public.obra_levantamentos WHERE organization_id = v_org_b;
  IF v_count != 0 THEN
    RAISE WARNING 'TEST 11a FAILED: user A sees % obra_levantamentos of org B', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 11a PASS: cross-tenant obra_levantamentos invisible';
  END IF;

  -- TESTE 11b: almoxarifado de B invisivel para A
  SELECT count(*) INTO v_count FROM public.suprimentos_depositos WHERE organization_id = v_org_b;
  IF v_count != 0 THEN
    RAISE WARNING 'TEST 11b FAILED: user A sees % suprimentos_depositos of org B', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 11b PASS: cross-tenant suprimentos_depositos invisible';
  END IF;

  SELECT count(*) INTO v_count FROM public.suprimentos_estoque_itens WHERE organization_id = v_org_b;
  IF v_count != 0 THEN
    RAISE WARNING 'TEST 11c FAILED: user A sees % suprimentos_estoque_itens of org B', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 11c PASS: cross-tenant suprimentos_estoque_itens invisible';
  END IF;

  SELECT count(*) INTO v_count FROM public.suprimentos_estoque_movimentacoes WHERE organization_id = v_org_b;
  IF v_count != 0 THEN
    RAISE WARNING 'TEST 11d FAILED: user A sees % suprimentos_estoque_movimentacoes of org B', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 11d PASS: cross-tenant suprimentos_estoque_movimentacoes invisible';
  END IF;

  -- TESTE 12: DELETE direto em rdo bloqueado
  BEGIN
    DELETE FROM public.rdo WHERE organization_id = v_org_a;
    IF FOUND THEN
      RAISE WARNING 'TEST 12 FAILED: direct DELETE on rdo allowed';
      v_failed := v_failed + 1;
    ELSE
      RAISE NOTICE 'TEST 12 PASS: direct DELETE on rdo blocked';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 12 PASS: direct DELETE on rdo rejected';
  END;

  -- TESTE 13: DELETE direto em purchase_orders bloqueado
  BEGIN
    DELETE FROM public.purchase_orders WHERE organization_id = v_org_a;
    IF FOUND THEN
      RAISE WARNING 'TEST 13 FAILED: direct DELETE on purchase_orders allowed';
      v_failed := v_failed + 1;
    ELSE
      RAISE NOTICE 'TEST 13 PASS: direct DELETE on purchase_orders blocked';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 13 PASS: direct DELETE on purchase_orders rejected';
  END;

  -- ─── Sprint 3 — Grupo Operacional leak tests ─────────────────────────

  -- TESTE 14a..s: cross-tenant SELECT em cada tabela do Grupo Operacional deve = 0
  DECLARE
    v_tbl text;
    v_tables text[] := ARRAY[
      'workers','labor_crews','timecards','shifts','worker_absences',
      'lps_activities','lps_restrictions','lps_takt_zones',
      'operacao_campo_activities','operacao_campo_days',
      'master_activities','master_baselines','lookahead_derived_activities','programacao_diaria',
      'daily_report_activities','daily_report_equipment_logs','daily_report_material_logs','daily_report_photos',
      -- Sprint 4
      'projects','project_documents','quantitativos_budgets','quantitativos_custom_base',
      'preconstrucao_sessions','bim_projects','bim_segments',
      -- Sprint 5
      'equipamentos','equipamentos_manutencoes','maintenance_plans','maintenance_plan_assets',
      'maintenance_work_orders','maintenance_work_order_assets','maintenance_monitoring_points','veiculos','fleet_drivers','fleet_fuel_records',
      'fleet_vehicle_maintenance','fleet_routes','fleet_service_orders','fleet_fines','fleet_alerts',
      'fleet_schedules','otimizacao_routing_recommendations','otimizacao_health_scores',
      'otimizacao_buy_lease_analyses','mapas_interativos','rede_ativos','rede_service_orders','rede_outages',
      -- Sprint 6 (sem user_routines — testado separado por user_id)
      'evm_work_packages','evm_cost_accounts','evm_measurements','construction_sites',
      'change_orders','change_order_photos','agenda_tasks','agenda_resources','company_logos',
      -- Suprimentos / Almoxarifado e planilhas operacionais
      'suprimentos_depositos','suprimentos_estoque_itens','suprimentos_estoque_movimentacoes',
      'suprimentos_nucleos','suprimentos_ruas','suprimentos_itens','suprimentos_ordens'
    ];
  BEGIN
    FOREACH v_tbl IN ARRAY v_tables LOOP
      EXECUTE format('SELECT count(*) FROM public.%I WHERE organization_id = $1', v_tbl)
        INTO v_count USING v_org_b;
      IF v_count != 0 THEN
        RAISE WARNING 'TEST GO-LEAK FAILED: user A sees % rows of org B in %', v_count, v_tbl;
        v_failed := v_failed + 1;
      ELSE
        RAISE NOTICE 'TEST GO-LEAK PASS: cross-tenant % invisible', v_tbl;
      END IF;

      -- DELETE direto deve ser bloqueado
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE organization_id = $1', v_tbl) USING v_org_a;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count > 0 THEN
          RAISE WARNING 'TEST GO-DELETE FAILED: direct DELETE on % allowed', v_tbl;
          v_failed := v_failed + 1;
        ELSE
          RAISE NOTICE 'TEST GO-DELETE PASS: direct DELETE on % blocked', v_tbl;
        END IF;
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'TEST GO-DELETE PASS: direct DELETE on % rejected', v_tbl;
      END;
    END LOOP;
  END;

  -- TESTE 14: forge INSERT cross-tenant em qualquer das 3 falha
  BEGIN
    INSERT INTO public.rdo (organization_id, number, date, payload, created_by)
    VALUES (v_org_b, 99, current_date, '{}'::jsonb, v_user_a);
    RAISE WARNING 'TEST 14 FAILED: forged INSERT into rdo of org B was allowed';
    v_failed := v_failed + 1;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'TEST 14 PASS: forged INSERT into rdo blocked';
  END;

  -- TESTE 15: forge INSERT cross-tenant em almoxarifado falha
  BEGIN
    INSERT INTO public.suprimentos_estoque_itens (organization_id, deposito_id, descricao, unidade, qtd_disponivel, created_by)
    VALUES (v_org_b, v_dep_b, 'FORGED CEARA', 'un', 1, v_user_a);
    RAISE WARNING 'TEST 15 FAILED: forged INSERT into suprimentos_estoque_itens of org B was allowed';
    v_failed := v_failed + 1;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'TEST 15 PASS: forged almoxarifado INSERT blocked';
  END;

  -- TESTE 16: item da org A nao pode apontar para deposito da org B
  BEGIN
    INSERT INTO public.suprimentos_estoque_itens (organization_id, deposito_id, descricao, unidade, qtd_disponivel, created_by)
    VALUES (v_org_a, v_dep_b, 'CROSS DEP CEARA', 'un', 1, v_user_a);
    RAISE WARNING 'TEST 16 FAILED: item with cross-tenant deposito was allowed';
    v_failed := v_failed + 1;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'TEST 16 PASS: cross-tenant deposito link blocked';
  END;

  -- TESTE 17: movimentacao da org A nao pode apontar para item da org B
  BEGIN
    INSERT INTO public.suprimentos_estoque_movimentacoes (organization_id, item_id, deposito_id, tipo, quantidade, created_by)
    VALUES (v_org_a, v_item_b, v_dep_a, 'entrada', 1, v_user_a);
    RAISE WARNING 'TEST 17 FAILED: movement with cross-tenant item was allowed';
    v_failed := v_failed + 1;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'TEST 17 PASS: cross-tenant item movement blocked';
  END;

  -- TESTE 18: owner global com duas memberships ve apenas a organizacao ativa
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_c, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT count(*) INTO v_count FROM public.suprimentos_depositos WHERE organization_id = v_org_b;
  IF v_count != 0 THEN
    RAISE WARNING 'TEST 18 FAILED: global owner active in org A sees % dep rows of org B', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 18 PASS: global owner active in org A cannot see org B almoxarifado';
  END IF;

  PERFORM public.set_default_organization(v_org_b);

  SELECT count(*) INTO v_count FROM public.suprimentos_depositos WHERE organization_id = v_org_a;
  IF v_count != 0 THEN
    RAISE WARNING 'TEST 19 FAILED: global owner active in org B sees % dep rows of org A', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 19 PASS: global owner active in org B cannot see org A almoxarifado';
  END IF;

  SELECT count(*) INTO v_count FROM public.suprimentos_depositos WHERE organization_id = v_org_b;
  IF v_count != 1 THEN
    RAISE WARNING 'TEST 20 FAILED: global owner active in org B expected 1 dep row, got %', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 20 PASS: global owner sees selected org almoxarifado only';
  END IF;

  -- TESTE 21: todas as tabelas tenant-scoped precisam ter FORCE RLS e SELECT por user_org().
  SELECT count(*) INTO v_count
  FROM (
    WITH org_tables AS (
      SELECT c.oid,
             n.nspname,
             c.relname,
             c.relrowsecurity,
             c.relforcerowsecurity,
             EXISTS (
               SELECT 1
               FROM pg_attribute a
               WHERE a.attrelid = c.oid
                 AND a.attname = 'deleted_at'
                 AND NOT a.attisdropped
             ) AS has_deleted_at
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND EXISTS (
          SELECT 1
          FROM pg_attribute a
          WHERE a.attrelid = c.oid
            AND a.attname = 'organization_id'
            AND NOT a.attisdropped
        )
    )
    SELECT ot.relname
    FROM org_tables ot
    LEFT JOIN pg_policies p
      ON p.schemaname = ot.nspname
     AND p.tablename = ot.relname
     AND p.cmd IN ('SELECT', 'ALL')
    WHERE ot.relname NOT IN ('profiles', 'memberships', 'quick_adaptation_files', 'quick_adaptation_sessions')
      AND (
        ot.relrowsecurity IS FALSE
        OR ot.relforcerowsecurity IS FALSE
        OR p.policyname IS NULL
        OR p.qual !~ 'user_org\(\)'
        OR (ot.has_deleted_at AND p.qual !~ 'deleted_at')
      )
  ) violations;

  IF v_count != 0 THEN
    RAISE WARNING 'TEST 21 FAILED: % tenant tables have weak RLS/SELECT policy', v_count;
    v_failed := v_failed + 1;
  ELSE
    RAISE NOTICE 'TEST 21 PASS: tenant tables have FORCE RLS and active-org SELECT policies';
  END IF;

  -- TESTE 22: nenhum FK entre tabelas com organization_id pode cruzar tenant.
  DECLARE
    v_fk record;
    v_fk_mismatches integer;
  BEGIN
    FOR v_fk IN
      WITH org_tables AS (
        SELECT c.oid, n.nspname, c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND EXISTS (
            SELECT 1
            FROM pg_attribute a
            WHERE a.attrelid = c.oid
              AND a.attname = 'organization_id'
              AND NOT a.attisdropped
          )
      )
      SELECT child.nspname AS child_schema,
             child.relname AS child_table,
             parent.nspname AS parent_schema,
             parent.relname AS parent_table,
             ca.attname AS child_col,
             pa.attname AS parent_col
      FROM pg_constraint con
      JOIN org_tables child ON child.oid = con.conrelid
      JOIN org_tables parent ON parent.oid = con.confrelid
      JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS x(attnum, pattnum, ord) ON TRUE
      JOIN pg_attribute ca ON ca.attrelid = con.conrelid AND ca.attnum = x.attnum
      JOIN pg_attribute pa ON pa.attrelid = con.confrelid AND pa.attnum = x.pattnum
      WHERE con.contype = 'f'
        AND array_length(con.conkey, 1) = 1
        AND array_length(con.confkey, 1) = 1
    LOOP
      EXECUTE format(
        'SELECT count(*) FROM %I.%I c JOIN %I.%I p ON c.%I::text = p.%I::text WHERE c.%I IS NOT NULL AND c.organization_id IS DISTINCT FROM p.organization_id',
        v_fk.child_schema, v_fk.child_table, v_fk.parent_schema, v_fk.parent_table,
        v_fk.child_col, v_fk.parent_col, v_fk.child_col
      ) INTO v_fk_mismatches;

      IF v_fk_mismatches != 0 THEN
        RAISE WARNING 'TEST 22 FAILED: % cross-tenant FK rows in %.% -> %.%', v_fk_mismatches, v_fk.child_table, v_fk.child_col, v_fk.parent_table, v_fk.parent_col;
        v_failed := v_failed + 1;
      END IF;
    END LOOP;

    IF v_failed = 0 THEN
      RAISE NOTICE 'TEST 22 PASS: no cross-tenant FK mismatches found';
    END IF;
  END;

  -- Reset role
  PERFORM set_config('role', 'postgres', true);

  IF v_failed > 0 THEN
    RAISE EXCEPTION '❌ % RLS LEAK TESTS FAILED — DO NOT DEPLOY', v_failed;
  ELSE
    RAISE NOTICE '✅ ALL RLS LEAK TESTS PASSED';
  END IF;
END $$;

ROLLBACK;
