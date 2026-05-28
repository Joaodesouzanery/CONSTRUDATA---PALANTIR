-- Allow the ConstruData global admin account to inspect and switch into every
-- active customer organization without creating one membership per tenant.

CREATE OR REPLACE FUNCTION public.user_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.organization_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.deleted_at IS NULL
    AND (
      public.is_global_admin()
      OR EXISTS (
        SELECT 1
        FROM public.memberships m
        WHERE m.organization_id = p.organization_id
          AND m.user_id = p.id
          AND m.status = 'active'
          AND m.deleted_at IS NULL
      )
    )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_global_admin() THEN 'owner'::public.user_role
    ELSE (
      SELECT m.role
      FROM public.profiles p
      JOIN public.memberships m
        ON m.organization_id = p.organization_id
       AND m.user_id = p.id
       AND m.status = 'active'
       AND m.deleted_at IS NULL
      WHERE p.id = auth.uid()
        AND p.deleted_at IS NULL
      LIMIT 1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(roles public.user_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (public.is_global_admin() AND 'owner'::public.user_role = ANY(roles))
    OR EXISTS (
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
  SELECT
    public.is_global_admin()
    OR EXISTS (
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
  SELECT
    (public.is_global_admin() AND 'owner'::public.user_role = ANY(roles))
    OR EXISTS (
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
  v_is_global_admin boolean := public.is_global_admin();
  v_role public.user_role;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = p_org_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'organization not found' USING ERRCODE = '02000';
  END IF;

  SELECT *
    INTO v_membership
  FROM public.memberships
  WHERE organization_id = p_org_id
    AND user_id = auth.uid()
    AND status = 'active'
    AND deleted_at IS NULL;

  IF NOT FOUND AND NOT v_is_global_admin THEN
    RAISE EXCEPTION 'active membership not found' USING ERRCODE = '42501';
  END IF;

  v_role := CASE
    WHEN v_is_global_admin THEN 'owner'::public.user_role
    ELSE v_membership.role
  END;

  UPDATE public.profiles
     SET organization_id = p_org_id,
         role = v_role,
         updated_at = now()
   WHERE id = auth.uid()
     AND deleted_at IS NULL;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (
    p_org_id,
    auth.uid(),
    CASE WHEN v_is_global_admin THEN 'global_set_default_organization' ELSE 'set_default_organization' END,
    'organizations',
    p_org_id::text,
    jsonb_build_object('organization_id', p_org_id, 'role', v_role)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_org_memberships()
RETURNS TABLE (
  membership_id uuid,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  organization_environment text,
  role public.user_role,
  status text,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH current_profile AS (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.deleted_at IS NULL
    LIMIT 1
  ),
  normal_memberships AS (
    SELECT
      m.id AS membership_id,
      m.organization_id,
      o.name AS organization_name,
      o.slug AS organization_slug,
      COALESCE(o.environment, o.settings->>'environment', 'production') AS organization_environment,
      m.role,
      m.status,
      cp.organization_id = m.organization_id AS is_active
    FROM public.memberships m
    JOIN public.organizations o
      ON o.id = m.organization_id
     AND o.deleted_at IS NULL
    CROSS JOIN current_profile cp
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.deleted_at IS NULL
  ),
  global_memberships AS (
    SELECT
      o.id AS membership_id,
      o.id AS organization_id,
      o.name AS organization_name,
      o.slug AS organization_slug,
      COALESCE(o.environment, o.settings->>'environment', 'production') AS organization_environment,
      'owner'::public.user_role AS role,
      'active'::text AS status,
      cp.organization_id = o.id AS is_active
    FROM public.organizations o
    CROSS JOIN current_profile cp
    WHERE public.is_global_admin()
      AND o.deleted_at IS NULL
  )
  SELECT *
  FROM (
    SELECT * FROM global_memberships
    UNION ALL
    SELECT nm.*
    FROM normal_memberships nm
    WHERE NOT public.is_global_admin()
  ) visible
  ORDER BY
    CASE WHEN visible.is_active THEN 0 ELSE 1 END,
    visible.organization_name;
$$;

GRANT EXECUTE ON FUNCTION public.user_org() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(public.user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, public.user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_org_memberships() TO authenticated;

COMMENT ON FUNCTION public.get_my_org_memberships() IS
  'Returns active memberships for normal users and all active organizations for the ConstruData global admin account.';
