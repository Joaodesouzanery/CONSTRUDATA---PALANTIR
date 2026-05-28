-- 0017_batch1_rpcs.sql
-- Estende approve_pending_action para suportar os novos action_types do Batch 1.
-- Estende export_organization_data para incluir as 9 novas tabelas.

-- ════════════════════════════════════════════════════════════════════════
-- approve_pending_action — versão estendida
-- (Replace por causa do CASE expandido)
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approve_pending_action(p_action_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action  public.pending_actions%ROWTYPE;
  v_org_id  uuid := public.user_org();
BEGIN
  SELECT * INTO v_action FROM public.pending_actions WHERE id = p_action_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pending action not found' USING ERRCODE = '02000';
  END IF;

  IF v_action.organization_id != v_org_id THEN
    RAISE EXCEPTION 'cross-tenant access denied' USING ERRCODE = '42501';
  END IF;

  IF v_action.status != 'pending' THEN
    RAISE EXCEPTION 'action is not pending (status=%)', v_action.status USING ERRCODE = '22000';
  END IF;

  IF v_action.expires_at < now() THEN
    UPDATE public.pending_actions SET status = 'expired' WHERE id = p_action_id;
    RAISE EXCEPTION 'action expired' USING ERRCODE = '22008';
  END IF;

  IF v_action.requested_by = auth.uid() THEN
    RAISE EXCEPTION 'requester cannot approve their own action' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(ARRAY[v_action.required_role]::public.user_role[]) AND
     NOT public.has_role(ARRAY['owner']::public.user_role[]) THEN
    RAISE EXCEPTION 'role % required to approve', v_action.required_role USING ERRCODE = '42501';
  END IF;

  -- Aplica o efeito conforme action_type
  CASE v_action.action_type
    -- Sprint 1 — Qualidade
    WHEN 'delete_fvs' THEN
      UPDATE public.fvs SET deleted_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

    WHEN 'update_fvs_closed' THEN
      UPDATE public.fvs
        SET payload = COALESCE(v_action.payload, payload), updated_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

    -- Sprint 2 — RDO
    WHEN 'delete_rdo' THEN
      UPDATE public.rdo SET deleted_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

    WHEN 'update_rdo_closed' THEN
      UPDATE public.rdo
        SET payload = COALESCE(v_action.payload, payload), updated_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

    -- Sprint 2 — Suprimentos
    WHEN 'delete_po' THEN
      UPDATE public.purchase_orders SET deleted_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

    WHEN 'update_po_approved' THEN
      UPDATE public.purchase_orders
        SET payload = COALESCE(v_action.payload, payload), updated_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

    WHEN 'delete_invoice' THEN
      UPDATE public.invoices SET deleted_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

    -- Sprint 2 — Planejamento
    WHEN 'delete_plan_scenario' THEN
      UPDATE public.plan_scenarios SET deleted_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

    WHEN 'delete_plan_trecho' THEN
      UPDATE public.plan_trechos SET deleted_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

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
-- export_organization_data — versão estendida
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

  SELECT jsonb_build_object(
    'exported_at',     now(),
    'exported_by',     auth.uid(),
    'organization',    (SELECT to_jsonb(o) FROM public.organizations o WHERE o.id = p_org_id),
    'profiles',        (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM public.profiles p WHERE p.organization_id = p_org_id),
    'invitations',     (SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) FROM public.invitations i WHERE i.organization_id = p_org_id),
    'fvs',             (SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb) FROM public.fvs f WHERE f.organization_id = p_org_id),
    'rdo',             (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.rdo r WHERE r.organization_id = p_org_id),
    'plan_trechos',    (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.plan_trechos t WHERE t.organization_id = p_org_id),
    'plan_teams',      (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.plan_teams t WHERE t.organization_id = p_org_id),
    'plan_holidays',   (SELECT COALESCE(jsonb_agg(to_jsonb(h)), '[]'::jsonb) FROM public.plan_holidays h WHERE h.organization_id = p_org_id),
    'plan_scenarios',  (SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM public.plan_scenarios s WHERE s.organization_id = p_org_id),
    'suppliers',       (SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM public.suppliers s WHERE s.organization_id = p_org_id),
    'purchase_orders', (SELECT COALESCE(jsonb_agg(to_jsonb(po)), '[]'::jsonb) FROM public.purchase_orders po WHERE po.organization_id = p_org_id),
    'goods_receipts',  (SELECT COALESCE(jsonb_agg(to_jsonb(gr)), '[]'::jsonb) FROM public.goods_receipts gr WHERE gr.organization_id = p_org_id),
    'invoices',        (SELECT COALESCE(jsonb_agg(to_jsonb(inv)), '[]'::jsonb) FROM public.invoices inv WHERE inv.organization_id = p_org_id),
    'pending_actions', (SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM public.pending_actions a WHERE a.organization_id = p_org_id),
    'audit_log',       (SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb) FROM public.audit_log l WHERE l.organization_id = p_org_id)
  ) INTO v_result;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id)
  VALUES (p_org_id, auth.uid(), 'export', 'organizations', p_org_id::text);

  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.export_organization_data(uuid) TO authenticated;
