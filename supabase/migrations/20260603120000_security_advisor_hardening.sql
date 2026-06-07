-- Security Advisor hardening prepared from the Supabase lint export.
-- This migration is intentionally conservative: it removes direct API execution
-- from internal SECURITY DEFINER functions while preserving RPCs used by the app.

-- 0011_function_search_path_mutable
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.measurement_source_quality_from_nc_status(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.measurement_flag_status_from_nc_status(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.try_numeric(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_set_updated_at() SET search_path = public, pg_temp;

-- Lock down SECURITY DEFINER functions from implicit PUBLIC execution first.
REVOKE EXECUTE ON FUNCTION public.accept_invitation(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_pending_action(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_pending_action_service(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_provision_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_member(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.change_member_role(uuid, public.user_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.export_organization_data(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_org_memberships() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_project_dashboard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_org_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, public.user_role[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(public.user_role[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invite_org_member(text, public.user_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_global_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_worker_absent() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reactivate_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_project_kpis(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_project_dashboard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_pending_action(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_pending_action_service(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.request_action(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.required_approver_for(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_default_organization(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.signup_with_org(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.soft_delete_suprimentos_deposito(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.soft_delete_suprimentos_estoque_item(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_fvs_nc_to_lps() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_po_to_evm() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_quality_nc_to_measurement(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_rdo_sabesp_to_measurement(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_rdo_to_planejamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_regular_rdo_to_measurement(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_rdo_sabesp_parser_result(uuid, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_quality_nc_measurement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_rdo_sabesp_measurement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_regular_rdo_measurement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_org() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_role() FROM PUBLIC, anon, authenticated;

-- Public invitation acceptance is intentionally available before login.
GRANT EXECUTE ON FUNCTION public.accept_invitation(text, text) TO anon, authenticated;

-- RPCs called by the authenticated frontend.
GRANT EXECUTE ON FUNCTION public.approve_pending_action(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_organization_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_org_memberships() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_project_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_pending_action(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_action(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_suprimentos_deposito(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_suprimentos_estoque_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_rdo_sabesp_to_measurement(uuid) TO authenticated;

-- Helper functions used by RLS policies and authenticated tenant scoping.
GRANT EXECUTE ON FUNCTION public.has_org_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, public.user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(public.user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_global_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.required_approver_for(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_org() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;

-- Service-only functions used by Edge Functions or background service flows.
GRANT EXECUTE ON FUNCTION public.approve_pending_action_service(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_pending_action_service(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_rdo_sabesp_parser_result(uuid, text, text, text, jsonb, text) TO service_role;

-- Notes:
-- - citext remains in public for now. Moving an installed extension can affect
--   existing column types and should be validated against the live schema first.
-- - leaked password protection is an Auth dashboard setting, not a SQL migration.
