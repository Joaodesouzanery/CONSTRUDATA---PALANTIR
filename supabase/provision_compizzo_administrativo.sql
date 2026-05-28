-- Manual admin SQL for the production Supabase SQL Editor.
-- Purpose:
-- 1. Link existing auth user administrativo@grupocompizzo.com.br to the official Compizzo tenant.
-- 2. Ensure profile and membership are active.
-- 3. Add an audit entry.
--
-- Target organization:
--   public.organizations.slug = 'compizzo'
--
-- Assumption:
--   The Auth user already exists. If it does not, create the Auth user first.

DO $$
DECLARE
  v_user_id uuid;
  v_global_admin_id uuid;
  v_org_id uuid;
  v_membership_id uuid;
BEGIN
  SELECT u.id
    INTO v_user_id
  FROM auth.users u
  WHERE lower(u.email) = 'administrativo@grupocompizzo.com.br'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user administrativo@grupocompizzo.com.br was not found. Create the Auth user first.';
  END IF;

  SELECT o.id
    INTO v_org_id
  FROM public.organizations o
  WHERE o.slug = 'compizzo'
    AND o.deleted_at IS NULL
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Official Compizzo organization was not found with slug=compizzo.';
  END IF;

  SELECT u.id
    INTO v_global_admin_id
  FROM auth.users u
  WHERE lower(u.email) = 'joaoneryflu@gmail.com'
  LIMIT 1;

  INSERT INTO public.profiles (
    id,
    organization_id,
    full_name,
    email,
    role,
    activated_at,
    deleted_at
  )
  VALUES (
    v_user_id,
    v_org_id,
    'Administrativo Compizzo',
    'administrativo@grupocompizzo.com.br'::citext,
    'diretor',
    now(),
    NULL
  )
  ON CONFLICT (id)
  DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    email = EXCLUDED.email,
    role = 'diretor',
    activated_at = COALESCE(public.profiles.activated_at, now()),
    deleted_at = NULL,
    updated_at = now();

  INSERT INTO public.memberships (
    organization_id,
    user_id,
    role,
    status,
    joined_at,
    deleted_at
  )
  VALUES (
    v_org_id,
    v_user_id,
    'diretor',
    'active',
    now(),
    NULL
  )
  ON CONFLICT (organization_id, user_id) WHERE deleted_at IS NULL
  DO UPDATE SET
    role = 'diretor',
    status = 'active',
    joined_at = COALESCE(public.memberships.joined_at, now()),
    blocked_at = NULL,
    blocked_by = NULL,
    block_reason = NULL,
    updated_at = now()
  RETURNING id INTO v_membership_id;

  INSERT INTO public.audit_log (
    organization_id,
    actor_id,
    action,
    table_name,
    record_id,
    after
  )
  VALUES (
    v_org_id,
    COALESCE(v_global_admin_id, v_user_id),
    'manual_provision_compizzo_administrativo',
    'memberships',
    v_membership_id::text,
    jsonb_build_object(
      'organization_slug', 'compizzo',
      'user_email', 'administrativo@grupocompizzo.com.br',
      'user_id', v_user_id,
      'membership_id', v_membership_id,
      'role', 'diretor',
      'status', 'active'
    )
  );

  RAISE NOTICE 'Compizzo administrative user linked. organization_id=%, user_id=%, membership_id=%', v_org_id, v_user_id, v_membership_id;
END $$;

SELECT
  o.id AS organization_id,
  o.name AS organization_name,
  o.slug,
  p.email,
  p.role AS profile_role,
  p.activated_at,
  m.status AS membership_status,
  m.role AS membership_role,
  m.joined_at
FROM public.organizations o
JOIN public.profiles p
  ON p.organization_id = o.id
 AND lower(p.email::text) = 'administrativo@grupocompizzo.com.br'
JOIN public.memberships m
  ON m.organization_id = o.id
 AND m.user_id = p.id
 AND m.deleted_at IS NULL
WHERE o.slug = 'compizzo'
  AND o.deleted_at IS NULL;
