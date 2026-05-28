-- Restrict global onboarding diagnostics to the single global admin login.

CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(u.email) = 'joaoneryflu@gmail.com'
  );
$$;

REVOKE ALL ON FUNCTION public.is_global_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_global_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_global_admin() TO authenticated;

DROP POLICY IF EXISTS quick_adaptation_sessions_select ON public.quick_adaptation_sessions;
CREATE POLICY quick_adaptation_sessions_select
  ON public.quick_adaptation_sessions
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_global_admin()));

DROP POLICY IF EXISTS quick_adaptation_sessions_insert ON public.quick_adaptation_sessions;
CREATE POLICY quick_adaptation_sessions_insert
  ON public.quick_adaptation_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_global_admin())
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS quick_adaptation_sessions_update ON public.quick_adaptation_sessions;
CREATE POLICY quick_adaptation_sessions_update
  ON public.quick_adaptation_sessions
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_global_admin()))
  WITH CHECK ((SELECT public.is_global_admin()));

DROP POLICY IF EXISTS quick_adaptation_files_select ON public.quick_adaptation_files;
CREATE POLICY quick_adaptation_files_select
  ON public.quick_adaptation_files
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_global_admin()));

DROP POLICY IF EXISTS quick_adaptation_files_insert ON public.quick_adaptation_files;
CREATE POLICY quick_adaptation_files_insert
  ON public.quick_adaptation_files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_global_admin())
    AND created_by = auth.uid()
  );

COMMENT ON FUNCTION public.is_global_admin() IS
  'Returns true only for the ConstruData global admin login joaoneryflu@gmail.com.';
