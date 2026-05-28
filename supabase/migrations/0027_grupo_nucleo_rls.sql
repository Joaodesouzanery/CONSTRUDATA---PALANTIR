-- 0027_grupo_nucleo_rls.sql
-- Sprint 4 — RLS para as 7 novas tabelas do Núcleo + BIM.
-- Padrão idêntico a 0016/0020: SELECT/INSERT/UPDATE com has_role + DELETE bloqueado.

-- ════════════════════════════════════════════════════════════════════════
-- projects
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS projects_select_own_org ON public.projects;
CREATE POLICY projects_select_own_org ON public.projects FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS projects_insert_with_role ON public.projects;
CREATE POLICY projects_insert_with_role ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS projects_update_role ON public.projects;
CREATE POLICY projects_update_role ON public.projects FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS projects_delete_blocked ON public.projects;
CREATE POLICY projects_delete_blocked ON public.projects FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- project_documents
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_documents_select_own_org ON public.project_documents;
CREATE POLICY project_documents_select_own_org ON public.project_documents FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS project_documents_insert_with_role ON public.project_documents;
CREATE POLICY project_documents_insert_with_role ON public.project_documents FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','qualidade','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS project_documents_update_role ON public.project_documents;
CREATE POLICY project_documents_update_role ON public.project_documents FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','qualidade','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS project_documents_delete_blocked ON public.project_documents;
CREATE POLICY project_documents_delete_blocked ON public.project_documents FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- quantitativos_budgets
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.quantitativos_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quantitativos_budgets FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quantitativos_budgets_select_own_org ON public.quantitativos_budgets;
CREATE POLICY quantitativos_budgets_select_own_org ON public.quantitativos_budgets FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS quantitativos_budgets_insert_with_role ON public.quantitativos_budgets;
CREATE POLICY quantitativos_budgets_insert_with_role ON public.quantitativos_budgets FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS quantitativos_budgets_update_role ON public.quantitativos_budgets;
CREATE POLICY quantitativos_budgets_update_role ON public.quantitativos_budgets FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS quantitativos_budgets_delete_blocked ON public.quantitativos_budgets;
CREATE POLICY quantitativos_budgets_delete_blocked ON public.quantitativos_budgets FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- quantitativos_custom_base
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.quantitativos_custom_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quantitativos_custom_base FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quantitativos_custom_base_select_own_org ON public.quantitativos_custom_base;
CREATE POLICY quantitativos_custom_base_select_own_org ON public.quantitativos_custom_base FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS quantitativos_custom_base_insert_with_role ON public.quantitativos_custom_base;
CREATE POLICY quantitativos_custom_base_insert_with_role ON public.quantitativos_custom_base FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS quantitativos_custom_base_update_role ON public.quantitativos_custom_base;
CREATE POLICY quantitativos_custom_base_update_role ON public.quantitativos_custom_base FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['planejador','engenheiro','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS quantitativos_custom_base_delete_blocked ON public.quantitativos_custom_base;
CREATE POLICY quantitativos_custom_base_delete_blocked ON public.quantitativos_custom_base FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- preconstrucao_sessions
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.preconstrucao_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preconstrucao_sessions FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS preconstrucao_sessions_select_own_org ON public.preconstrucao_sessions;
CREATE POLICY preconstrucao_sessions_select_own_org ON public.preconstrucao_sessions FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS preconstrucao_sessions_insert_with_role ON public.preconstrucao_sessions;
CREATE POLICY preconstrucao_sessions_insert_with_role ON public.preconstrucao_sessions FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS preconstrucao_sessions_update_role ON public.preconstrucao_sessions;
CREATE POLICY preconstrucao_sessions_update_role ON public.preconstrucao_sessions FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS preconstrucao_sessions_delete_blocked ON public.preconstrucao_sessions;
CREATE POLICY preconstrucao_sessions_delete_blocked ON public.preconstrucao_sessions FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- bim_projects
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.bim_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bim_projects FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bim_projects_select_own_org ON public.bim_projects;
CREATE POLICY bim_projects_select_own_org ON public.bim_projects FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS bim_projects_insert_with_role ON public.bim_projects;
CREATE POLICY bim_projects_insert_with_role ON public.bim_projects FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS bim_projects_update_role ON public.bim_projects;
CREATE POLICY bim_projects_update_role ON public.bim_projects FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS bim_projects_delete_blocked ON public.bim_projects;
CREATE POLICY bim_projects_delete_blocked ON public.bim_projects FOR DELETE TO authenticated USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- bim_segments
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.bim_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bim_segments FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bim_segments_select_own_org ON public.bim_segments;
CREATE POLICY bim_segments_select_own_org ON public.bim_segments FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);
DROP POLICY IF EXISTS bim_segments_insert_with_role ON public.bim_segments;
CREATE POLICY bim_segments_insert_with_role ON public.bim_segments FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );
DROP POLICY IF EXISTS bim_segments_update_role ON public.bim_segments;
CREATE POLICY bim_segments_update_role ON public.bim_segments FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());
DROP POLICY IF EXISTS bim_segments_delete_blocked ON public.bim_segments;
CREATE POLICY bim_segments_delete_blocked ON public.bim_segments FOR DELETE TO authenticated USING (false);
