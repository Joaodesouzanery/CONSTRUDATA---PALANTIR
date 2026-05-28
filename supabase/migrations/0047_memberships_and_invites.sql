-- 0047_memberships_and_invites.sql
-- Multi-company memberships, invitation lifecycle and member administration.

CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'visualizador',
  status text NOT NULL DEFAULT 'active',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamptz,
  blocked_at timestamptz,
  blocked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  block_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT memberships_status_check CHECK (status IN ('invited', 'active', 'blocked', 'left'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_memberships_org_user_active
  ON public.memberships(organization_id, user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_memberships_user_active
  ON public.memberships(user_id, status, organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_memberships_org_role
  ON public.memberships(organization_id, role)
  WHERE deleted_at IS NULL AND status = 'active';

DROP TRIGGER IF EXISTS trg_memberships_updated_at ON public.memberships;
CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL;

ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_unique_pending;

CREATE UNIQUE INDEX IF NOT EXISTS ux_invitations_pending_org_email
  ON public.invitations(organization_id, lower(email::text))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

INSERT INTO public.memberships (
  organization_id, user_id, role, status, invited_by, joined_at, created_at, updated_at, deleted_at
)
SELECT
  p.organization_id,
  p.id,
  p.role,
  CASE WHEN p.deleted_at IS NULL THEN 'active' ELSE 'left' END,
  p.invited_by,
  COALESCE(p.activated_at, p.created_at),
  p.created_at,
  p.updated_at,
  p.deleted_at
FROM public.profiles p
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.user_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.organization_id
  FROM public.profiles p
  JOIN public.memberships m
    ON m.organization_id = p.organization_id
   AND m.user_id = p.id
   AND m.status = 'active'
   AND m.deleted_at IS NULL
  WHERE p.id = auth.uid()
    AND p.deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role
  FROM public.profiles p
  JOIN public.memberships m
    ON m.organization_id = p.organization_id
   AND m.user_id = p.id
   AND m.status = 'active'
   AND m.deleted_at IS NULL
  WHERE p.id = auth.uid()
    AND p.deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(roles public.user_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.memberships m
      ON m.organization_id = p.organization_id
     AND m.user_id = p.id
     AND m.status = 'active'
     AND m.deleted_at IS NULL
    WHERE p.id = auth.uid()
      AND p.deleted_at IS NULL
      AND m.role = ANY(roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_access(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.organization_id = p_org_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(p_org_id uuid, roles public.user_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.organization_id = p_org_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.deleted_at IS NULL
      AND m.role = ANY(roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.set_default_organization(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership public.memberships%ROWTYPE;
BEGIN
  SELECT *
    INTO v_membership
  FROM public.memberships
  WHERE organization_id = p_org_id
    AND user_id = auth.uid()
    AND status = 'active'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active membership not found' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET organization_id = v_membership.organization_id,
         role = v_membership.role,
         updated_at = now()
   WHERE id = auth.uid()
     AND deleted_at IS NULL;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (
    p_org_id,
    auth.uid(),
    'set_default_organization',
    'memberships',
    v_membership.id::text,
    jsonb_build_object('organization_id', p_org_id)
  );
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

  INSERT INTO public.invitations (organization_id, email, role, invited_by, token)
  VALUES (v_org_id, lower(trim(p_email))::citext, p_role, auth.uid(), v_token)
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
  WHERE token = p_token
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.memberships m
      ON m.organization_id = p.organization_id
     AND m.user_id = p.id
     AND m.status = 'active'
     AND m.deleted_at IS NULL
    WHERE p.id = v_user_id
  ) THEN
    UPDATE public.profiles
       SET organization_id = v_invitation.organization_id,
           role = v_invitation.role,
           updated_at = now()
     WHERE id = v_user_id;
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

CREATE OR REPLACE FUNCTION public.change_member_role(
  p_membership_id uuid,
  p_role public.user_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := public.user_org();
  v_membership public.memberships%ROWTYPE;
BEGIN
  SELECT *
    INTO v_membership
  FROM public.memberships
  WHERE id = p_membership_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'membership not found' USING ERRCODE = '02000';
  END IF;

  IF NOT public.has_role(ARRAY['diretor','owner']::public.user_role[]) THEN
    RAISE EXCEPTION 'only diretor or owner can change roles' USING ERRCODE = '42501';
  END IF;

  IF p_role = 'owner'::public.user_role AND NOT public.has_role(ARRAY['owner']::public.user_role[]) THEN
    RAISE EXCEPTION 'only owner can grant owner role' USING ERRCODE = '42501';
  END IF;

  UPDATE public.memberships
     SET role = p_role,
         updated_at = now()
   WHERE id = p_membership_id;

  UPDATE public.profiles
     SET role = p_role,
         updated_at = now()
   WHERE id = v_membership.user_id
     AND organization_id = v_org_id
     AND deleted_at IS NULL;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, before, after)
  VALUES (
    v_org_id,
    auth.uid(),
    'change_member_role',
    'memberships',
    p_membership_id::text,
    jsonb_build_object('role', v_membership.role),
    jsonb_build_object('role', p_role)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.block_member(
  p_membership_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := public.user_org();
  v_membership public.memberships%ROWTYPE;
BEGIN
  SELECT *
    INTO v_membership
  FROM public.memberships
  WHERE id = p_membership_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'membership not found' USING ERRCODE = '02000';
  END IF;

  IF v_membership.user_id = auth.uid() THEN
    RAISE EXCEPTION 'you cannot block your own membership' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(ARRAY['diretor','owner']::public.user_role[]) THEN
    RAISE EXCEPTION 'only diretor or owner can block members' USING ERRCODE = '42501';
  END IF;

  UPDATE public.memberships
     SET status = 'blocked',
         blocked_at = now(),
         blocked_by = auth.uid(),
         block_reason = p_reason,
         updated_at = now()
   WHERE id = p_membership_id;

  UPDATE public.profiles p
     SET organization_id = next_membership.organization_id,
         role = next_membership.role,
         updated_at = now()
    FROM (
      SELECT organization_id, role
      FROM public.memberships
      WHERE user_id = v_membership.user_id
        AND organization_id != v_org_id
        AND status = 'active'
        AND deleted_at IS NULL
      ORDER BY joined_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    ) next_membership
   WHERE p.id = v_membership.user_id
     AND p.organization_id = v_org_id
     AND p.deleted_at IS NULL;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (
    v_org_id,
    auth.uid(),
    'block_member',
    'memberships',
    p_membership_id::text,
    jsonb_build_object('reason', p_reason)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_member(p_membership_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := public.user_org();
  v_membership public.memberships%ROWTYPE;
BEGIN
  SELECT *
    INTO v_membership
  FROM public.memberships
  WHERE id = p_membership_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'membership not found' USING ERRCODE = '02000';
  END IF;

  IF NOT public.has_role(ARRAY['diretor','owner']::public.user_role[]) THEN
    RAISE EXCEPTION 'only diretor or owner can reactivate members' USING ERRCODE = '42501';
  END IF;

  UPDATE public.memberships
     SET status = 'active',
         blocked_at = NULL,
         blocked_by = NULL,
         block_reason = NULL,
         updated_at = now()
   WHERE id = p_membership_id;

  UPDATE public.profiles
     SET deleted_at = NULL,
         role = v_membership.role,
         organization_id = v_org_id,
         updated_at = now()
   WHERE id = v_membership.user_id;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id)
  VALUES (v_org_id, auth.uid(), 'reactivate_member', 'memberships', p_membership_id::text);
END;
$$;

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS memberships_select_own_org ON public.memberships;
CREATE POLICY memberships_select_own_org ON public.memberships
  FOR SELECT TO authenticated
  USING (public.has_org_access(organization_id));

DROP POLICY IF EXISTS memberships_insert_blocked ON public.memberships;
CREATE POLICY memberships_insert_blocked ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS memberships_update_blocked ON public.memberships;
CREATE POLICY memberships_update_blocked ON public.memberships
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS memberships_delete_blocked ON public.memberships;
CREATE POLICY memberships_delete_blocked ON public.memberships
  FOR DELETE TO authenticated
  USING (false);

GRANT EXECUTE ON FUNCTION public.has_org_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, public.user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_org_member(text, public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_member_role(uuid, public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_member(uuid) TO authenticated;

COMMENT ON TABLE public.memberships IS
  'User-to-organization memberships. Supports multiple users per company and one user in multiple companies without deleting history.';

COMMENT ON FUNCTION public.set_default_organization(uuid) IS
  'Switches the active/default organization used by legacy RLS helpers that depend on profiles.organization_id.';

COMMENT ON FUNCTION public.invite_org_member(text, public.user_role) IS
  'Creates an auditable invitation token for a member. Email delivery is handled by the app or an Edge Function.';

COMMENT ON FUNCTION public.accept_invitation(text, text) IS
  'Accepts an invitation for the authenticated user and creates or reactivates the membership.';

CREATE OR REPLACE FUNCTION public.signup_with_org(
  p_org_name text,
  p_full_name text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_org_id uuid;
  v_slug text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'user already has a profile' USING ERRCODE = '23505';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  v_slug := lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);

  IF v_slug = '' THEN
    v_slug := 'empresa';
  END IF;

  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
  END IF;

  INSERT INTO public.organizations (name, slug, owner_id)
  VALUES (p_org_name, v_slug, v_user_id)
  RETURNING id INTO v_org_id;

  INSERT INTO public.profiles (id, organization_id, full_name, email, role, activated_at)
  VALUES (v_user_id, v_org_id, p_full_name, v_email::citext, 'owner'::public.user_role, now());

  INSERT INTO public.memberships (organization_id, user_id, role, status, joined_at)
  VALUES (v_org_id, v_user_id, 'owner'::public.user_role, 'active', now());

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (
    v_org_id,
    v_user_id,
    'signup',
    'organizations',
    v_org_id::text,
    jsonb_build_object('name', p_org_name, 'slug', v_slug)
  );

  RETURN v_org_id;
END $$;

GRANT EXECUTE ON FUNCTION public.signup_with_org(text, text) TO authenticated;
