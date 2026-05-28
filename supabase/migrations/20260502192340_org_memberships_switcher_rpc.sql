-- Robust organization switcher API.
-- Avoids nested RLS surprises when the frontend joins memberships -> organizations.

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
  SELECT
    m.id AS membership_id,
    m.organization_id,
    o.name AS organization_name,
    o.slug AS organization_slug,
    COALESCE(o.environment, o.settings->>'environment', 'production') AS organization_environment,
    m.role,
    m.status,
    p.organization_id = m.organization_id AS is_active
  FROM public.memberships m
  JOIN public.organizations o
    ON o.id = m.organization_id
   AND o.deleted_at IS NULL
  LEFT JOIN public.profiles p
    ON p.id = auth.uid()
   AND p.deleted_at IS NULL
  WHERE m.user_id = auth.uid()
    AND m.status = 'active'
    AND m.deleted_at IS NULL
  ORDER BY
    CASE WHEN p.organization_id = m.organization_id THEN 0 ELSE 1 END,
    o.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_org_memberships() TO authenticated;

COMMENT ON FUNCTION public.get_my_org_memberships() IS
  'Returns active organization memberships for the authenticated user, including organization display fields, for the app organization switcher.';
