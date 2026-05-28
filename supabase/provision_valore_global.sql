-- Manual admin SQL for the production Supabase SQL Editor.
-- Purpose:
-- 1. Ensure organization "Valore" exists.
-- 2. Link existing auth user joaopaulobrandaoj@gmail.com as Valore owner.
-- 3. Add an audit entry.
--
-- Run this after applying migrations, especially:
-- supabase/migrations/20260525190000_global_admin_all_org_access.sql

DO $$
DECLARE
  v_owner_id uuid;
  v_global_admin_id uuid;
  v_org_id uuid;
  v_membership_id uuid;
BEGIN
  SELECT u.id
    INTO v_owner_id
  FROM auth.users u
  WHERE lower(u.email) = 'joaopaulobrandaoj@gmail.com'
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Auth user joaopaulobrandaoj@gmail.com was not found. Create the Auth user first.';
  END IF;

  SELECT u.id
    INTO v_global_admin_id
  FROM auth.users u
  WHERE lower(u.email) = 'joaoneryflu@gmail.com'
  LIMIT 1;

  INSERT INTO public.organizations (
    name,
    slug,
    plan,
    max_users,
    max_projects,
    owner_id,
    deleted_at
  )
  VALUES (
    'Valore',
    'valore',
    'free',
    5,
    3,
    v_owner_id,
    NULL
  )
  ON CONFLICT (slug)
  DO UPDATE SET
    name = EXCLUDED.name,
    plan = COALESCE(public.organizations.plan, EXCLUDED.plan),
    max_users = GREATEST(public.organizations.max_users, EXCLUDED.max_users),
    max_projects = GREATEST(public.organizations.max_projects, EXCLUDED.max_projects),
    owner_id = EXCLUDED.owner_id,
    deleted_at = NULL,
    updated_at = now()
  RETURNING id INTO v_org_id;

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
    v_owner_id,
    v_org_id,
    'Joao Paulo Brandao',
    'joaopaulobrandaoj@gmail.com'::citext,
    'owner',
    now(),
    NULL
  )
  ON CONFLICT (id)
  DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    email = EXCLUDED.email,
    role = 'owner',
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
    v_owner_id,
    'owner',
    'active',
    now(),
    NULL
  )
  ON CONFLICT (organization_id, user_id) WHERE deleted_at IS NULL
  DO UPDATE SET
    role = 'owner',
    status = 'active',
    joined_at = COALESCE(public.memberships.joined_at, now()),
    blocked_at = NULL,
    blocked_by = NULL,
    block_reason = NULL,
    updated_at = now()
  RETURNING id INTO v_membership_id;

  UPDATE public.organizations
     SET owner_id = v_owner_id,
         updated_at = now()
   WHERE id = v_org_id;

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
    COALESCE(v_global_admin_id, v_owner_id),
    'manual_provision_valore',
    'organizations',
    v_org_id::text,
    jsonb_build_object(
      'organization_name', 'Valore',
      'owner_email', 'joaopaulobrandaoj@gmail.com',
      'owner_id', v_owner_id,
      'membership_id', v_membership_id
    )
  );

  RAISE NOTICE 'Valore provisioned. organization_id=%, owner_id=%, membership_id=%', v_org_id, v_owner_id, v_membership_id;
END $$;

SELECT
  o.id AS organization_id,
  o.name AS organization_name,
  o.slug,
  p.email AS owner_email,
  p.role AS profile_role,
  m.status AS membership_status,
  m.role AS membership_role
FROM public.organizations o
JOIN public.profiles p
  ON p.organization_id = o.id
 AND lower(p.email::text) = 'joaopaulobrandaoj@gmail.com'
JOIN public.memberships m
  ON m.organization_id = o.id
 AND m.user_id = p.id
 AND m.deleted_at IS NULL
WHERE o.slug = 'valore'
  AND o.deleted_at IS NULL;
