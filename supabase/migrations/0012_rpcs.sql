-- 0012_rpcs.sql
-- RPCs principais: signup com criação de organização, fluxo de aprovação,
-- export por organização (LGPD), soft-delete de FVS via aprovação.

-- ════════════════════════════════════════════════════════════════════════
-- signup_with_org
-- Cria uma nova organização + profile owner para o usuário recém-criado.
-- Chamada APÓS supabase.auth.signUp(), passando o nome da empresa e o nome
-- completo. O e-mail vem de auth.users automaticamente.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.signup_with_org(
  p_org_name   text,
  p_full_name  text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_email     text;
  v_org_id    uuid;
  v_slug      text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Bloqueia se o usuário já tem profile (já pertence a uma org)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'user already belongs to an organization' USING ERRCODE = '23505';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  -- Slug baseado no nome (lowercase, espaços→hyphen, alfanumérico)
  v_slug := lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  -- Se já existe, sufixa com 6 chars do uuid
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
  END IF;

  INSERT INTO public.organizations (name, slug, owner_id)
  VALUES (p_org_name, v_slug, v_user_id)
  RETURNING id INTO v_org_id;

  INSERT INTO public.profiles (id, organization_id, full_name, email, role, activated_at)
  VALUES (v_user_id, v_org_id, p_full_name, v_email, 'owner'::public.user_role, now());

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (v_org_id, v_user_id, 'signup', 'organizations', v_org_id::text,
          jsonb_build_object('name', p_org_name, 'slug', v_slug));

  RETURN v_org_id;
END $$;

GRANT EXECUTE ON FUNCTION public.signup_with_org(text, text) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- request_action
-- Cria uma pending_action que precisa ser aprovada por alguém com o role
-- definido na approval_matrix da organização.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.request_action(
  p_action_type   text,
  p_target_table  text,
  p_target_id     text,
  p_payload       jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id    uuid := public.user_org();
  v_required  public.user_role;
  v_action_id uuid;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  v_required := public.required_approver_for(p_action_type);

  INSERT INTO public.pending_actions (
    organization_id, requested_by, action_type, target_table, target_id, payload, required_role
  ) VALUES (
    v_org_id, auth.uid(), p_action_type, p_target_table, p_target_id, p_payload, v_required
  ) RETURNING id INTO v_action_id;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (v_org_id, auth.uid(), 'request_action', 'pending_actions', v_action_id::text,
          jsonb_build_object('action_type', p_action_type, 'target', p_target_table || ':' || COALESCE(p_target_id,'')));

  RETURN v_action_id;
END $$;

GRANT EXECUTE ON FUNCTION public.request_action(text, text, text, jsonb) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- approve_pending_action
-- Aprova uma pending_action e APLICA o efeito no banco.
-- Apenas usuários com role >= required_role da action podem chamar.
-- O próprio requester NÃO pode aprovar (separation of duties).
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
    WHEN 'delete_fvs' THEN
      UPDATE public.fvs
        SET deleted_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

    WHEN 'update_fvs_closed' THEN
      UPDATE public.fvs
        SET payload = COALESCE(v_action.payload, payload),
            updated_at = now()
        WHERE id = v_action.target_id::uuid AND organization_id = v_org_id;

    -- Outros tipos serão adicionados conforme módulos forem migrados.
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
-- reject_pending_action
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.reject_pending_action(p_action_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action  public.pending_actions%ROWTYPE;
  v_org_id  uuid := public.user_org();
BEGIN
  SELECT * INTO v_action FROM public.pending_actions WHERE id = p_action_id;

  IF NOT FOUND OR v_action.organization_id != v_org_id THEN
    RAISE EXCEPTION 'pending action not found' USING ERRCODE = '02000';
  END IF;

  IF v_action.status != 'pending' THEN
    RAISE EXCEPTION 'action is not pending' USING ERRCODE = '22000';
  END IF;

  IF NOT public.has_role(ARRAY[v_action.required_role]::public.user_role[]) AND
     NOT public.has_role(ARRAY['owner']::public.user_role[]) THEN
    RAISE EXCEPTION 'role % required to reject', v_action.required_role USING ERRCODE = '42501';
  END IF;

  UPDATE public.pending_actions
    SET status = 'rejected', approved_by = auth.uid(), approved_at = now(), rejected_reason = p_reason
    WHERE id = p_action_id;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (v_org_id, auth.uid(), 'reject_action', 'pending_actions', p_action_id::text,
          jsonb_build_object('reason', p_reason));
END $$;

GRANT EXECUTE ON FUNCTION public.reject_pending_action(uuid, text) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- export_organization_data
-- Exporta TODOS os dados de uma organização em JSON. Apenas o owner da
-- organização pode chamar. Usado para LGPD / portabilidade / rescisão.
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
    'pending_actions', (SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM public.pending_actions a WHERE a.organization_id = p_org_id),
    'audit_log',       (SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb) FROM public.audit_log l WHERE l.organization_id = p_org_id)
  ) INTO v_result;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id)
  VALUES (p_org_id, auth.uid(), 'export', 'organizations', p_org_id::text);

  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.export_organization_data(uuid) TO authenticated;
