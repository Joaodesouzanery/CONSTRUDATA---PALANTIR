-- 0040_approval_email.sql
-- Service-role RPCs for email-based approval (called by handle-approval Edge Function).
-- These bypass RLS since the email link doesn't carry a user session.

-- ════════════════════════════════════════════════════════════════════════
-- approve_pending_action_service
-- Same logic as approve_pending_action but uses service role (no auth.uid check).
-- Only called by the handle-approval Edge Function with service_role key.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approve_pending_action_service(
  p_action_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action  record;
BEGIN
  SELECT * INTO v_action FROM public.pending_actions WHERE id = p_action_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'action not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_action.status <> 'pending' THEN
    RAISE EXCEPTION 'action already processed (%)' , v_action.status USING ERRCODE = 'P0003';
  END IF;

  -- Mark as approved
  UPDATE public.pending_actions
  SET status = 'approved', approved_by = NULL, updated_at = now()
  WHERE id = p_action_id;

  -- Apply the effect (same logic as approve_pending_action)
  IF v_action.action_type LIKE 'delete_%' THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', v_action.target_table)
    USING v_action.target_id::uuid;
  END IF;

  -- Audit
  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (v_action.organization_id, v_action.requested_by, 'approve_via_email',
          'pending_actions', v_action.id::text,
          jsonb_build_object('action_type', v_action.action_type));
END $$;

-- ════════════════════════════════════════════════════════════════════════
-- reject_pending_action_service
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.reject_pending_action_service(
  p_action_id uuid,
  p_reason    text DEFAULT 'Rejeitado via email'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action  record;
BEGIN
  SELECT * INTO v_action FROM public.pending_actions WHERE id = p_action_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'action not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_action.status <> 'pending' THEN
    RAISE EXCEPTION 'action already processed (%)' , v_action.status USING ERRCODE = 'P0003';
  END IF;

  UPDATE public.pending_actions
  SET status = 'rejected', rejected_reason = p_reason, updated_at = now()
  WHERE id = p_action_id;

  -- Audit
  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (v_action.organization_id, v_action.requested_by, 'reject_via_email',
          'pending_actions', v_action.id::text,
          jsonb_build_object('action_type', v_action.action_type, 'reason', p_reason));
END $$;

-- Grant execute to service_role only (Edge Functions use service_role key)
-- These should NOT be callable by authenticated users directly
REVOKE ALL ON FUNCTION public.approve_pending_action_service(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_pending_action_service(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_pending_action_service(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_pending_action_service(uuid, text) TO service_role;
