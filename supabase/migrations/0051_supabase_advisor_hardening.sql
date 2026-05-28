-- 0051_supabase_advisor_hardening.sql
-- Security/performance hardening from Supabase Advisors.
-- Scope:
-- - remove anonymous execution from SECURITY DEFINER RPCs;
-- - remove direct API access to project_dashboard_view;
-- - rewrite RLS policy auth.uid() calls as initplans: (select auth.uid()).

-- ─── Security: anonymous users must not execute privileged RPCs ─────────────

REVOKE EXECUTE ON FUNCTION public.accept_invitation(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_pending_action(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_pending_action_service(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_provision_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.block_member(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.change_member_role(uuid, public.user_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.export_organization_data(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_project_dashboard() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_org_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, public.user_role[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(public.user_role[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.invite_org_member(text, public.user_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_worker_absent() FROM anon;
REVOKE EXECUTE ON FUNCTION public.reactivate_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recompute_project_kpis(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_project_dashboard() FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_pending_action(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_pending_action_service(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_action(text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.required_approver_for(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_default_organization(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.signup_with_org(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_fvs_nc_to_lps() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_po_to_evm() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_quality_nc_to_measurement(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_rdo_sabesp_to_measurement(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_rdo_to_planejamento() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_regular_rdo_to_measurement(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.touch_rdo_sabesp_parser_result(uuid, text, text, text, jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_sync_quality_nc_measurement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_sync_rdo_sabesp_measurement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_sync_regular_rdo_measurement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_org() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_role() FROM anon;

-- Trigger-only/service-only functions should not be callable from the client.
REVOKE EXECUTE ON FUNCTION public.trg_sync_quality_nc_measurement() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_rdo_sabesp_measurement() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_regular_rdo_measurement() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- Keep deliberate authenticated RPC surface.
GRANT EXECUTE ON FUNCTION public.accept_invitation(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_provision_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_member_role(uuid, public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_organization_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, public.user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(public.user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_org_member(text, public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.required_approver_for(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.signup_with_org(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_org() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;

-- ─── Security: materialized view should not be exposed directly via API ─────

REVOKE SELECT ON public.project_dashboard_view FROM anon;
REVOKE SELECT ON public.project_dashboard_view FROM authenticated;

-- The safe access path is public.get_project_dashboard(), which filters by
-- the authenticated user's active organization.
GRANT EXECUTE ON FUNCTION public.get_project_dashboard() TO authenticated;

-- ─── Performance: convert auth.uid() in policies to initplan form ──────────

DO $$
DECLARE
  p record;
  v_using text;
  v_check text;
  v_roles text;
  v_using_clause text;
  v_check_clause text;
BEGIN
  FOR p IN
    SELECT *
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        qual LIKE '%auth.uid()%'
        OR with_check LIKE '%auth.uid()%'
      )
  LOOP
    v_using := CASE
      WHEN p.qual IS NULL THEN NULL
      ELSE replace(p.qual, 'auth.uid()', '(select auth.uid())')
    END;

    v_check := CASE
      WHEN p.with_check IS NULL THEN NULL
      ELSE replace(p.with_check, 'auth.uid()', '(select auth.uid())')
    END;

    SELECT string_agg(
      CASE WHEN r = 'public' THEN 'public' ELSE quote_ident(r) END,
      ', '
    )
      INTO v_roles
    FROM unnest(p.roles) AS r;

    v_using_clause := CASE WHEN v_using IS NULL THEN '' ELSE ' USING (' || v_using || ')' END;
    v_check_clause := CASE WHEN v_check IS NULL THEN '' ELSE ' WITH CHECK (' || v_check || ')' END;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      p.policyname,
      p.schemaname,
      p.tablename,
      p.permissive,
      p.cmd,
      v_roles,
      v_using_clause,
      v_check_clause
    );
  END LOOP;
END;
$$;

