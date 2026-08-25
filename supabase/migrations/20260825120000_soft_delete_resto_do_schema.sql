-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção)
-- ═══════════════════════════════════════════════════════════════════════════════
-- SOFT DELETE — o resto do schema
--
-- POR QUE: a migração `20260824130000` consertou 18 tabelas, e eu tratei aquilo como se fosse o
-- problema inteiro. Não era. Levantando de novo, com o app na mão, são 75 tabelas com
-- `deleted_at IS NULL` na policy de SELECT e escritas pelo app — 75 lugares onde apagar pode
-- falhar em silêncio.
--
-- O defeito é o mesmo, e foi MEDIDO em PostgreSQL 16.15:
--
--   create policy p_sel on t for select using (dono = 'eu' and del = false);
--   update t set del = true;   -->  ERROR: new row violates row-level security policy
--
-- O Postgres exige que a linha CONTINUE VISÍVEL pela policy de SELECT depois do UPDATE. Marcar
-- `deleted_at` torna a linha invisível, e o comando é recusado — para qualquer papel, inclusive o
-- dono da empresa. Não é "0 linhas afetadas": é erro.
--
-- Esta é a terceira vez que o projeto trata este mesmo bug: `20260518160000` fez 3 tabelas do
-- almoxarifado em maio, `20260824130000` fez 18 ontem. Esta fecha o resto, e por isso é GERADA a
-- partir das policies reais em vez de digitada — para não sobrar nenhuma de novo.
--
-- SEGURANÇA: quem esconde o registro apagado passa a ser o cliente, que já faz isso —
-- `pullTable(activeOnly)` filtra por padrão e nenhum chamador passa `false`. Conferido também que
-- os únicos três `select` diretos do app (rdo_contractor_links, contractor_invoice_events,
-- predial_chamados_publicos) NÃO estão nesta lista.
--
-- IDEMPOTENTE e tolerante: tabela ausente é pulada e anunciada, em vez de abortar no meio.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
declare
  r record;
  n_ok int := 0;
  n_pulou int := 0;
begin
  for r in
    select * from (values
      ('agenda_tasks','agenda_tasks_select_own_org'),
      ('bim_projects','bim_projects_select_own_org'),
      ('bim_segments','bim_segments_select_own_org'),
      ('change_order_photos','co_photos_select_own_org'),
      ('change_orders','co_select_own_org'),
      ('clt_settings','clt_settings_select_own_org'),
      ('company_logos','company_logos_select_own_org'),
      ('construction_sites','sites_select_own_org'),
      ('daily_report_photos','daily_report_photos_select_own_org'),
      ('equipamentos','equipamentos_select_own_org'),
      ('equipamentos_manutencoes','eq_man_select_own_org'),
      ('evm_cost_accounts','evm_ca_select_own_org'),
      ('evm_measurements','evm_meas_select_own_org'),
      ('evm_work_packages','evm_wp_select_own_org'),
      ('financeiro_contratos','fin_contratos_select_own_org'),
      ('financeiro_distribuicoes','financeiro_distribuicoes_select'),
      ('financeiro_entries','financeiro_entries_select'),
      ('financeiro_impostos_nf','fin_impostos_select_own_org'),
      ('financeiro_orcamentos','fin_orcamentos_select_own_org'),
      ('financeiro_titulos','fin_titulos_select_own_org'),
      ('fleet_alerts','fa_select_own_org'),
      ('fleet_drivers','fd_select_own_org'),
      ('fleet_fines','ff_select_own_org'),
      ('fleet_fuel_records','ffr_select_own_org'),
      ('fleet_routes','fr_select_own_org'),
      ('fleet_schedules','fs_select_own_org'),
      ('fleet_service_orders','fso_select_own_org'),
      ('fleet_vehicle_maintenance','fvm_select_own_org'),
      ('goods_receipts','gr_select_own_org'),
      ('invoices','inv_select_own_org'),
      ('labor_crews','labor_crews_select_own_org'),
      ('labor_occurrences','labor_occ_select_own_org'),
      ('lookahead_derived_activities','lookahead_derived_activities_select_own_org'),
      ('lps_activities','lps_activities_select_own_org'),
      ('lps_restrictions','lps_restrictions_select_own_org'),
      ('lps_takt_zones','lps_takt_zones_select_own_org'),
      ('maintenance_monitoring_points','maintenance_monitoring_points_select'),
      ('maintenance_plan_assets','maintenance_plan_assets_select'),
      ('maintenance_plans','maintenance_plans_select'),
      ('maintenance_work_orders','maintenance_work_orders_select'),
      ('mapas_interativos','mapas_select_own_org'),
      ('master_activities','master_activities_select_own_org'),
      ('master_baselines','master_baselines_select_own_org'),
      ('obra_dias_sem_producao','dias_sem_prod_select_own_org'),
      ('operacao_campo_days','operacao_campo_days_select_own_org'),
      ('otimizacao_buy_lease_analyses','otbl_select_own_org'),
      ('otimizacao_health_scores','oths_select_own_org'),
      ('otimizacao_routing_recommendations','otrr_select_own_org'),
      ('plan_holidays','plan_holidays_select_own_org'),
      ('plan_scenarios','plan_scenarios_select_own_org'),
      ('plan_teams','plan_teams_select_own_org'),
      ('plan_trechos','plan_trechos_select_own_org'),
      ('plano_execucao','plano_execucao_select_own_org'),
      ('preconstrucao_sessions','preconstrucao_sessions_select_own_org'),
      ('predial_laudos','predial_laudos_select'),
      ('project_documents','project_documents_select_own_org'),
      ('projects','projects_select_own_org'),
      ('purchase_orders','po_select_own_org'),
      ('quantitativos_budgets','quantitativos_budgets_select_own_org'),
      ('quantitativos_custom_base','quantitativos_custom_base_select_own_org'),
      ('rateio_consumo','rateio_select_own_org'),
      ('rdo','rdo_select_own_org'),
      ('rede_ativos','rede_ativos_select_own_org'),
      ('rede_service_orders','rso_select_own_org'),
      ('rotina_execucoes','rotina_execucoes_select_own_org'),
      ('rotinas','rotinas_select_own_org'),
      ('servicos','servicos_select_own_org'),
      ('shifts','shifts_select_own_org'),
      ('suppliers','suppliers_select_own_org'),
      ('timecards','timecards_select_own_org'),
      ('veiculos','veiculos_select_own_org'),
      ('work_posts','work_posts_select_own_org'),
      ('worker_absences','worker_absences_select_own_org'),
      ('worker_assessments','worker_assessments_select_own_org'),
      ('workers','workers_select_own_org')
    ) as v(tabela, policy_nome)
  loop
    if to_regclass('public.' || r.tabela) is null then
      raise notice 'pulando %: tabela não existe neste banco', r.tabela;
      n_pulou := n_pulou + 1;
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', r.policy_nome, r.tabela);
    -- `(select public.user_org())` e não `public.user_org()`: a subconsulta é avaliada uma vez por
    -- comando em vez de uma vez por linha. Três tabelas já usavam essa forma; agora todas usam.
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = (select public.user_org()))',
      r.policy_nome, r.tabela
    );
    n_ok := n_ok + 1;
  end loop;
  raise notice 'soft delete destravado em % tabela(s); % pulada(s) por não existirem', n_ok, n_pulou;
end $$;


-- ── Conferência ───────────────────────────────────────────────────────────────
-- Lista o que FALTOU. "OK" é o resultado bom.
select
  case when count(*) = 0 then 'OK — nenhuma tabela do app trava mais o soft delete'
       else 'FALTOU em: ' || string_agg(tablename, ', ')
  end as resultado
from pg_policies
where schemaname = 'public'
  and cmd = 'SELECT'
  and qual like '%deleted_at%'
  and tablename in (
    'agenda_tasks', 'bim_projects', 'bim_segments', 'change_order_photos', 'change_orders', 'clt_settings',
    'company_logos', 'construction_sites', 'daily_report_photos', 'equipamentos', 'equipamentos_manutencoes', 'evm_cost_accounts',
    'evm_measurements', 'evm_work_packages', 'financeiro_contratos', 'financeiro_distribuicoes', 'financeiro_entries', 'financeiro_impostos_nf',
    'financeiro_orcamentos', 'financeiro_titulos', 'fleet_alerts', 'fleet_drivers', 'fleet_fines', 'fleet_fuel_records',
    'fleet_routes', 'fleet_schedules', 'fleet_service_orders', 'fleet_vehicle_maintenance', 'goods_receipts', 'invoices',
    'labor_crews', 'labor_occurrences', 'lookahead_derived_activities', 'lps_activities', 'lps_restrictions', 'lps_takt_zones',
    'maintenance_monitoring_points', 'maintenance_plan_assets', 'maintenance_plans', 'maintenance_work_orders', 'mapas_interativos', 'master_activities',
    'master_baselines', 'obra_dias_sem_producao', 'operacao_campo_days', 'otimizacao_buy_lease_analyses', 'otimizacao_health_scores', 'otimizacao_routing_recommendations',
    'plan_holidays', 'plan_scenarios', 'plan_teams', 'plan_trechos', 'plano_execucao', 'preconstrucao_sessions',
    'predial_laudos', 'project_documents', 'projects', 'purchase_orders', 'quantitativos_budgets', 'quantitativos_custom_base',
    'rateio_consumo', 'rdo', 'rede_ativos', 'rede_service_orders', 'rotina_execucoes', 'rotinas',
    'servicos', 'shifts', 'suppliers', 'timecards', 'veiculos', 'work_posts',
    'worker_absences', 'worker_assessments', 'workers'
  );
