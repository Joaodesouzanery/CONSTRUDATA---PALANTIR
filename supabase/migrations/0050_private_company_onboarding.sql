-- 0050_private_company_onboarding.sql
-- Private B2B onboarding: no public company signup, hashed invitation tokens.

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS token_hash text;

UPDATE public.invitations
   SET token_hash = encode(digest(token, 'sha256'), 'hex')
 WHERE token_hash IS NULL
   AND token IS NOT NULL
   AND token NOT LIKE 'hash:%';

CREATE UNIQUE INDEX IF NOT EXISTS ux_invitations_token_hash
  ON public.invitations(token_hash)
  WHERE token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.signup_with_org(
  p_org_name text,
  p_full_name text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'public company signup is disabled; company accounts are created by private invitation'
    USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_org_member(
  p_email text,
  p_role public.user_role
)
RETURNS TABLE(invitation_id uuid, invitation_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := public.user_org();
  v_token text := encode(gen_random_bytes(24), 'hex');
  v_token_hash text := encode(digest(v_token, 'sha256'), 'hex');
  v_invitation_id uuid;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[]) THEN
    RAISE EXCEPTION 'only managers can invite members' USING ERRCODE = '42501';
  END IF;

  IF p_role = 'owner'::public.user_role AND NOT public.has_role(ARRAY['owner']::public.user_role[]) THEN
    RAISE EXCEPTION 'only owner can invite another owner' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.invitations (organization_id, email, role, invited_by, token, token_hash)
  VALUES (
    v_org_id,
    lower(trim(p_email))::citext,
    p_role,
    auth.uid(),
    'hash:' || substring(v_token_hash, 1, 48),
    v_token_hash
  )
  RETURNING id INTO v_invitation_id;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (
    v_org_id,
    auth.uid(),
    'invite_member',
    'invitations',
    v_invitation_id::text,
    jsonb_build_object('email', lower(trim(p_email)), 'role', p_role)
  );

  invitation_id := v_invitation_id;
  invitation_token := v_token;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_token text,
  p_full_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_token_hash text := encode(digest(p_token, 'sha256'), 'hex');
  v_invitation public.invitations%ROWTYPE;
  v_membership_id uuid;
  v_profile_exists boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  SELECT *
    INTO v_invitation
  FROM public.invitations
  WHERE (token_hash = v_token_hash OR token = p_token)
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found or expired' USING ERRCODE = '02000';
  END IF;

  IF lower(v_invitation.email::text) != lower(v_email) THEN
    RAISE EXCEPTION 'invitation email does not match authenticated user' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id)
    INTO v_profile_exists;

  IF NOT v_profile_exists THEN
    INSERT INTO public.profiles (
      id, organization_id, full_name, email, role, invited_by, activated_at
    )
    VALUES (
      v_user_id,
      v_invitation.organization_id,
      COALESCE(NULLIF(trim(p_full_name), ''), v_email),
      v_email::citext,
      v_invitation.role,
      v_invitation.invited_by,
      now()
    );
  END IF;

  INSERT INTO public.memberships (
    organization_id, user_id, role, status, invited_by, joined_at
  )
  VALUES (
    v_invitation.organization_id,
    v_user_id,
    v_invitation.role,
    'active',
    v_invitation.invited_by,
    now()
  )
  ON CONFLICT (organization_id, user_id) WHERE deleted_at IS NULL
  DO UPDATE SET
    role = EXCLUDED.role,
    status = 'active',
    blocked_at = NULL,
    blocked_by = NULL,
    block_reason = NULL,
    joined_at = COALESCE(public.memberships.joined_at, now()),
    updated_at = now()
  RETURNING id INTO v_membership_id;

  UPDATE public.invitations
     SET accepted_at = now(),
         accepted_by = v_user_id,
         membership_id = v_membership_id
   WHERE id = v_invitation.id;

  UPDATE public.profiles
     SET organization_id = v_invitation.organization_id,
         role = v_invitation.role,
         updated_at = now()
   WHERE id = v_user_id
     AND deleted_at IS NULL;

  IF v_invitation.role = 'owner'::public.user_role THEN
    UPDATE public.organizations
       SET owner_id = v_user_id,
           updated_at = now()
     WHERE id = v_invitation.organization_id
       AND owner_id IS NULL;
  END IF;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (
    v_invitation.organization_id,
    v_user_id,
    'accept_invitation',
    'memberships',
    v_membership_id::text,
    jsonb_build_object('email', v_email, 'role', v_invitation.role)
  );

  RETURN v_membership_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.signup_with_org(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_org_member(text, public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text, text) TO authenticated;
