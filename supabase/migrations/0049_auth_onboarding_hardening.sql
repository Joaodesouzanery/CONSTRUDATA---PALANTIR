-- 0049_auth_onboarding_hardening.sql
-- Harden onboarding for multi-company auth.
-- New auth users must enter through signup_with_org or accept_invitation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Intentionally no-op.
  -- Profiles and memberships are created only by explicit onboarding flows:
  -- 1) signup_with_org: creates a new organization and owner membership.
  -- 2) accept_invitation: creates/reactivates membership for an invited user.
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_provision_profile()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile json;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT to_json(p)
    INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_user_id
    AND p.deleted_at IS NULL;

  IF v_profile IS NOT NULL THEN
    RETURN v_profile;
  END IF;

  RAISE EXCEPTION 'profile missing; user must create an organization or accept an invitation'
    USING ERRCODE = 'P0002';
END;
$$;

CREATE OR REPLACE FUNCTION public.signup_with_org(
  p_org_name text,
  p_full_name text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_org_id uuid;
  v_slug text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = v_user_id
      AND status = 'active'
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'user already belongs to an organization' USING ERRCODE = '23505';
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

  INSERT INTO public.profiles (id, organization_id, full_name, email, role, activated_at, deleted_at)
  VALUES (
    v_user_id,
    v_org_id,
    p_full_name,
    v_email::citext,
    'owner'::public.user_role,
    now(),
    NULL
  )
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    activated_at = COALESCE(public.profiles.activated_at, now()),
    deleted_at = NULL,
    updated_at = now();

  INSERT INTO public.memberships (organization_id, user_id, role, status, joined_at)
  VALUES (v_org_id, v_user_id, 'owner'::public.user_role, 'active', now())
  ON CONFLICT (organization_id, user_id) WHERE deleted_at IS NULL
  DO UPDATE SET
    role = 'owner'::public.user_role,
    status = 'active',
    blocked_at = NULL,
    blocked_by = NULL,
    block_reason = NULL,
    joined_at = COALESCE(public.memberships.joined_at, now()),
    updated_at = now();

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
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_provision_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.signup_with_org(text, text) TO authenticated;
