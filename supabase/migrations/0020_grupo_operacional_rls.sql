-- 0020_grupo_operacional_rls.sql
-- Sprint 3 — RLS para as 17 tabelas do Grupo Operacional.
-- Padrão idêntico ao 0011/0016: SELECT/INSERT/UPDATE com role + DELETE bloqueado
-- (apenas via request_action RPC). FORCE RLS em todas.

-- ════════════════════════════════════════════════════════════════════════
-- Mão-de-Obra
-- (roles: engenheiro, planejador, gerente, diretor, owner)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workers_select_own_org ON public.workers;
CREATE POLICY workers_select_own_org ON public.workers FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS workers_insert_with_role ON public.workers;
CREATE POLICY workers_insert_with_role ON public.workers FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS workers_update_role ON public.workers;
CREATE POLICY workers_update_role ON public.workers FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS workers_delete_blocked ON public.workers;
CREATE POLICY workers_delete_blocked ON public.workers FOR DELETE TO authenticated USING (false);

ALTER TABLE public.labor_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_crews FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS labor_crews_select_own_org ON public.labor_crews;
CREATE POLICY labor_crews_select_own_org ON public.labor_crews FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS labor_crews_insert_with_role ON public.labor_crews;
CREATE POLICY labor_crews_insert_with_role ON public.labor_crews FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS labor_crews_update_role ON public.labor_crews;
CREATE POLICY labor_crews_update_role ON public.labor_crews FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS labor_crews_delete_blocked ON public.labor_crews;
CREATE POLICY labor_crews_delete_blocked ON public.labor_crews FOR DELETE TO authenticated USING (false);

ALTER TABLE public.timecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timecards FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS timecards_select_own_org ON public.timecards;
CREATE POLICY timecards_select_own_org ON public.timecards FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS timecards_insert_with_role ON public.timecards;
CREATE POLICY timecards_insert_with_role ON public.timecards FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS timecards_update_role ON public.timecards;
CREATE POLICY timecards_update_role ON public.timecards FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS timecards_delete_blocked ON public.timecards;
CREATE POLICY timecards_delete_blocked ON public.timecards FOR DELETE TO authenticated USING (false);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shifts_select_own_org ON public.shifts;
CREATE POLICY shifts_select_own_org ON public.shifts FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS shifts_insert_with_role ON public.shifts;
CREATE POLICY shifts_insert_with_role ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS shifts_update_role ON public.shifts;
CREATE POLICY shifts_update_role ON public.shifts FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS shifts_delete_blocked ON public.shifts;
CREATE POLICY shifts_delete_blocked ON public.shifts FOR DELETE TO authenticated USING (false);

ALTER TABLE public.worker_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_absences FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS worker_absences_select_own_org ON public.worker_absences;
CREATE POLICY worker_absences_select_own_org ON public.worker_absences FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS worker_absences_insert_with_role ON public.worker_absences;
CREATE POLICY worker_absences_insert_with_role ON public.worker_absences FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS worker_absences_update_role ON public.worker_absences;
CREATE POLICY worker_absences_update_role ON public.worker_absences FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS worker_absences_delete_blocked ON public.worker_absences;
CREATE POLICY worker_absences_delete_blocked ON public.worker_absences FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- LPS-Lean
-- (roles: planejador, engenheiro, gerente, diretor, owner)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.lps_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lps_activities FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lps_activities_select_own_org ON public.lps_activities;
CREATE POLICY lps_activities_select_own_org ON public.lps_activities FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS lps_activities_insert_with_role ON public.lps_activities;
CREATE POLICY lps_activities_insert_with_role ON public.lps_activities FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS lps_activities_update_role ON public.lps_activities;
CREATE POLICY lps_activities_update_role ON public.lps_activities FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS lps_activities_delete_blocked ON public.lps_activities;
CREATE POLICY lps_activities_delete_blocked ON public.lps_activities FOR DELETE TO authenticated USING (false);

ALTER TABLE public.lps_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lps_restrictions FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lps_restrictions_select_own_org ON public.lps_restrictions;
CREATE POLICY lps_restrictions_select_own_org ON public.lps_restrictions FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS lps_restrictions_insert_with_role ON public.lps_restrictions;
CREATE POLICY lps_restrictions_insert_with_role ON public.lps_restrictions FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS lps_restrictions_update_role ON public.lps_restrictions;
CREATE POLICY lps_restrictions_update_role ON public.lps_restrictions FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS lps_restrictions_delete_blocked ON public.lps_restrictions;
CREATE POLICY lps_restrictions_delete_blocked ON public.lps_restrictions FOR DELETE TO authenticated USING (false);

ALTER TABLE public.lps_takt_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lps_takt_zones FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lps_takt_zones_select_own_org ON public.lps_takt_zones;
CREATE POLICY lps_takt_zones_select_own_org ON public.lps_takt_zones FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS lps_takt_zones_insert_with_role ON public.lps_takt_zones;
CREATE POLICY lps_takt_zones_insert_with_role ON public.lps_takt_zones FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS lps_takt_zones_update_role ON public.lps_takt_zones;
CREATE POLICY lps_takt_zones_update_role ON public.lps_takt_zones FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS lps_takt_zones_delete_blocked ON public.lps_takt_zones;
CREATE POLICY lps_takt_zones_delete_blocked ON public.lps_takt_zones FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Operação-Campo
-- (roles: planejador, engenheiro, gerente, diretor, owner)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.operacao_campo_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacao_campo_activities FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operacao_campo_activities_select_own_org ON public.operacao_campo_activities;
CREATE POLICY operacao_campo_activities_select_own_org ON public.operacao_campo_activities FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS operacao_campo_activities_insert_with_role ON public.operacao_campo_activities;
CREATE POLICY operacao_campo_activities_insert_with_role ON public.operacao_campo_activities FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS operacao_campo_activities_update_role ON public.operacao_campo_activities;
CREATE POLICY operacao_campo_activities_update_role ON public.operacao_campo_activities FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS operacao_campo_activities_delete_blocked ON public.operacao_campo_activities;
CREATE POLICY operacao_campo_activities_delete_blocked ON public.operacao_campo_activities FOR DELETE TO authenticated USING (false);

ALTER TABLE public.operacao_campo_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacao_campo_days FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operacao_campo_days_select_own_org ON public.operacao_campo_days;
CREATE POLICY operacao_campo_days_select_own_org ON public.operacao_campo_days FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS operacao_campo_days_insert_with_role ON public.operacao_campo_days;
CREATE POLICY operacao_campo_days_insert_with_role ON public.operacao_campo_days FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS operacao_campo_days_update_role ON public.operacao_campo_days;
CREATE POLICY operacao_campo_days_update_role ON public.operacao_campo_days FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS operacao_campo_days_delete_blocked ON public.operacao_campo_days;
CREATE POLICY operacao_campo_days_delete_blocked ON public.operacao_campo_days FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Planejamento-Mestre
-- (roles: planejador, engenheiro, gerente, diretor, owner)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.master_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_activities FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS master_activities_select_own_org ON public.master_activities;
CREATE POLICY master_activities_select_own_org ON public.master_activities FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS master_activities_insert_with_role ON public.master_activities;
CREATE POLICY master_activities_insert_with_role ON public.master_activities FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS master_activities_update_role ON public.master_activities;
CREATE POLICY master_activities_update_role ON public.master_activities FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS master_activities_delete_blocked ON public.master_activities;
CREATE POLICY master_activities_delete_blocked ON public.master_activities FOR DELETE TO authenticated USING (false);

ALTER TABLE public.master_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_baselines FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS master_baselines_select_own_org ON public.master_baselines;
CREATE POLICY master_baselines_select_own_org ON public.master_baselines FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS master_baselines_insert_with_role ON public.master_baselines;
CREATE POLICY master_baselines_insert_with_role ON public.master_baselines FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','gerente','diretor','owner']::public.user_role[])
  );
-- Baselines são imutáveis: bloqueia UPDATE direto
DROP POLICY IF EXISTS master_baselines_update_blocked ON public.master_baselines;
CREATE POLICY master_baselines_update_blocked ON public.master_baselines FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS master_baselines_delete_blocked ON public.master_baselines;
CREATE POLICY master_baselines_delete_blocked ON public.master_baselines FOR DELETE TO authenticated USING (false);

ALTER TABLE public.lookahead_derived_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookahead_derived_activities FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lookahead_derived_activities_select_own_org ON public.lookahead_derived_activities;
CREATE POLICY lookahead_derived_activities_select_own_org ON public.lookahead_derived_activities FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS lookahead_derived_activities_insert_with_role ON public.lookahead_derived_activities;
CREATE POLICY lookahead_derived_activities_insert_with_role ON public.lookahead_derived_activities FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS lookahead_derived_activities_update_role ON public.lookahead_derived_activities;
CREATE POLICY lookahead_derived_activities_update_role ON public.lookahead_derived_activities FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS lookahead_derived_activities_delete_blocked ON public.lookahead_derived_activities;
CREATE POLICY lookahead_derived_activities_delete_blocked ON public.lookahead_derived_activities FOR DELETE TO authenticated USING (false);

ALTER TABLE public.programacao_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programacao_diaria FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS programacao_diaria_select_own_org ON public.programacao_diaria;
CREATE POLICY programacao_diaria_select_own_org ON public.programacao_diaria FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS programacao_diaria_insert_with_role ON public.programacao_diaria;
CREATE POLICY programacao_diaria_insert_with_role ON public.programacao_diaria FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS programacao_diaria_update_role ON public.programacao_diaria;
CREATE POLICY programacao_diaria_update_role ON public.programacao_diaria FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS programacao_diaria_delete_blocked ON public.programacao_diaria;
CREATE POLICY programacao_diaria_delete_blocked ON public.programacao_diaria FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Relatório 360
-- (roles: engenheiro, qualidade, gerente, diretor, owner)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.daily_report_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_activities FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_report_activities_select_own_org ON public.daily_report_activities;
CREATE POLICY daily_report_activities_select_own_org ON public.daily_report_activities FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS daily_report_activities_insert_with_role ON public.daily_report_activities;
CREATE POLICY daily_report_activities_insert_with_role ON public.daily_report_activities FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS daily_report_activities_update_role ON public.daily_report_activities;
CREATE POLICY daily_report_activities_update_role ON public.daily_report_activities FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS daily_report_activities_delete_blocked ON public.daily_report_activities;
CREATE POLICY daily_report_activities_delete_blocked ON public.daily_report_activities FOR DELETE TO authenticated USING (false);

ALTER TABLE public.daily_report_equipment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_equipment_logs FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_report_equipment_logs_select_own_org ON public.daily_report_equipment_logs;
CREATE POLICY daily_report_equipment_logs_select_own_org ON public.daily_report_equipment_logs FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS daily_report_equipment_logs_insert_with_role ON public.daily_report_equipment_logs;
CREATE POLICY daily_report_equipment_logs_insert_with_role ON public.daily_report_equipment_logs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS daily_report_equipment_logs_update_role ON public.daily_report_equipment_logs;
CREATE POLICY daily_report_equipment_logs_update_role ON public.daily_report_equipment_logs FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS daily_report_equipment_logs_delete_blocked ON public.daily_report_equipment_logs;
CREATE POLICY daily_report_equipment_logs_delete_blocked ON public.daily_report_equipment_logs FOR DELETE TO authenticated USING (false);

ALTER TABLE public.daily_report_material_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_material_logs FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_report_material_logs_select_own_org ON public.daily_report_material_logs;
CREATE POLICY daily_report_material_logs_select_own_org ON public.daily_report_material_logs FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS daily_report_material_logs_insert_with_role ON public.daily_report_material_logs;
CREATE POLICY daily_report_material_logs_insert_with_role ON public.daily_report_material_logs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS daily_report_material_logs_update_role ON public.daily_report_material_logs;
CREATE POLICY daily_report_material_logs_update_role ON public.daily_report_material_logs FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS daily_report_material_logs_delete_blocked ON public.daily_report_material_logs;
CREATE POLICY daily_report_material_logs_delete_blocked ON public.daily_report_material_logs FOR DELETE TO authenticated USING (false);

ALTER TABLE public.daily_report_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_photos FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_report_photos_select_own_org ON public.daily_report_photos;
CREATE POLICY daily_report_photos_select_own_org ON public.daily_report_photos FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS daily_report_photos_insert_with_role ON public.daily_report_photos;
CREATE POLICY daily_report_photos_insert_with_role ON public.daily_report_photos FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS daily_report_photos_update_role ON public.daily_report_photos;
CREATE POLICY daily_report_photos_update_role ON public.daily_report_photos FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS daily_report_photos_delete_blocked ON public.daily_report_photos;
CREATE POLICY daily_report_photos_delete_blocked ON public.daily_report_photos FOR DELETE TO authenticated USING (false);
