-- Hardening for Supabase advisors plus isolated homologation organization.

-- Create covering indexes for public foreign keys that do not already have one.
-- This uses catalog metadata so it stays safe if a few indexes already exist.
DO $$
DECLARE
  fk record;
  index_name text;
BEGIN
  FOR fk IN
    SELECT
      con.conrelid,
      con.conname,
      nsp.nspname AS schema_name,
      rel.relname AS table_name,
      array_agg(att.attname ORDER BY ord.ordinality) AS column_names
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS ord(attnum, ordinality) ON true
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ord.attnum
    WHERE con.contype = 'f'
      AND nsp.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index idx
        WHERE idx.indrelid = con.conrelid
          AND idx.indisvalid
          AND (
            SELECT array_agg(key_attnum ORDER BY key_ordinality)::smallint[]
            FROM unnest(idx.indkey::smallint[]) WITH ORDINALITY AS key_cols(key_attnum, key_ordinality)
            WHERE key_ordinality <= array_length(con.conkey, 1)
          ) = con.conkey
      )
    GROUP BY con.conrelid, con.conname, nsp.nspname, rel.relname
  LOOP
    index_name := left(format('idx_%s_%s_fk', fk.table_name, array_to_string(fk.column_names, '_')), 63);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
      index_name,
      fk.schema_name,
      fk.table_name,
      (
        SELECT string_agg(format('%I', col), ', ')
        FROM unnest(fk.column_names) AS col
      )
    );
  END LOOP;
END $$;

-- Recreate the measurement insert policies with initplan-friendly auth calls.
DO $$
DECLARE
  p record;
  qual_sql text;
  check_sql text;
  cmd_sql text;
  role_sql text;
BEGIN
  FOR p IN
    SELECT *
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN (
        'measurement_periods_insert_with_role',
        'measurement_contract_items_insert_with_role',
        'measurement_memory_lines_insert_with_role',
        'measurement_financial_entries_insert_with_role',
        'measurement_billing_boletins_insert_with_role'
      )
  LOOP
    qual_sql := replace(replace(coalesce(p.qual, 'true'), 'auth.uid()', '(select auth.uid())'), 'public.user_org()', '(select public.user_org())');
    check_sql := replace(replace(coalesce(p.with_check, 'true'), 'auth.uid()', '(select auth.uid())'), 'public.user_org()', '(select public.user_org())');
    role_sql := (
      SELECT string_agg(format('%I', role_name), ', ')
      FROM unnest(p.roles) AS role_name
    );
    cmd_sql := CASE p.cmd
      WHEN 'ALL' THEN 'ALL'
      WHEN 'SELECT' THEN 'SELECT'
      WHEN 'INSERT' THEN 'INSERT'
      WHEN 'UPDATE' THEN 'UPDATE'
      WHEN 'DELETE' THEN 'DELETE'
      ELSE p.cmd
    END;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF cmd_sql = 'INSERT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I AS %s FOR INSERT TO %s WITH CHECK (%s)',
        p.policyname,
        p.schemaname,
        p.tablename,
        CASE WHEN p.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
        role_sql,
        check_sql
      );
    ELSIF cmd_sql = 'SELECT' OR cmd_sql = 'DELETE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s USING (%s)',
        p.policyname,
        p.schemaname,
        p.tablename,
        CASE WHEN p.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
        cmd_sql,
        role_sql,
        qual_sql
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s USING (%s) WITH CHECK (%s)',
        p.policyname,
        p.schemaname,
        p.tablename,
        CASE WHEN p.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
        cmd_sql,
        role_sql,
        qual_sql,
        check_sql
      );
    END IF;
  END LOOP;
END $$;

-- Lock function search_path for functions reported by the security advisor.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'set_updated_at',
        'measurement_source_quality_from_nc_status',
        'measurement_flag_status_from_nc_status',
        'try_numeric',
        'trg_set_updated_at'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.signature);
  END LOOP;
END $$;

-- Remove anonymous execute access from SECURITY DEFINER RPCs in public.
-- Authenticated app RPCs remain callable when the frontend uses them directly.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn.signature);
  END LOOP;
END $$;

-- Internal/trigger/service functions do not need direct authenticated RPC access.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN (
        'approve_pending_action_service',
        'reject_pending_action_service',
        'auto_provision_profile',
        'handle_new_user',
        'notify_worker_absent',
        'recompute_project_kpis',
        'sync_fvs_nc_to_lps',
        'sync_po_to_evm',
        'sync_quality_nc_to_measurement',
        'sync_rdo_sabesp_to_measurement',
        'sync_rdo_to_planejamento',
        'sync_regular_rdo_to_measurement',
        'touch_rdo_sabesp_parser_result',
        'trg_sync_quality_nc_measurement',
        'trg_sync_rdo_sabesp_measurement',
        'trg_sync_regular_rdo_measurement'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn.signature);
  END LOOP;
END $$;

-- Storage uploads use upsert in the app, which needs INSERT, SELECT and UPDATE.
DROP POLICY IF EXISTS rdo_sabesp_photos_update_own_org ON storage.objects;
CREATE POLICY rdo_sabesp_photos_update_own_org ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'rdo-sabesp-photos'
    AND split_part(name, '/', 1) = (select public.user_org())::text
  )
  WITH CHECK (
    bucket_id = 'rdo-sabesp-photos'
    AND split_part(name, '/', 1) = (select public.user_org())::text
  );

DROP POLICY IF EXISTS rdo_sabesp_photos_select_own_org ON storage.objects;
CREATE POLICY rdo_sabesp_photos_select_own_org ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rdo-sabesp-photos'
    AND split_part(name, '/', 1) = (select public.user_org())::text
  );

DROP POLICY IF EXISTS rdo_sabesp_photos_insert_own_org ON storage.objects;
CREATE POLICY rdo_sabesp_photos_insert_own_org ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rdo-sabesp-photos'
    AND split_part(name, '/', 1) = (select public.user_org())::text
  );

DROP POLICY IF EXISTS rdo_sabesp_photos_delete_own_org ON storage.objects;
CREATE POLICY rdo_sabesp_photos_delete_own_org ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'rdo-sabesp-photos'
    AND split_part(name, '/', 1) = (select public.user_org())::text
  );

-- Isolated homologation tenant for tests without touching the official company.
DO $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE lower(email::text) = 'joaodsouzanery@gmail.com'
    AND deleted_at IS NULL
  LIMIT 1;

  INSERT INTO public.organizations (
    name,
    slug,
    plan,
    max_users,
    max_projects,
    owner_id,
    environment,
    settings
  )
  VALUES (
    'Consorcio Se Liga na Rede - Obra Santos - Homologacao',
    'consorcio-se-liga-na-rede-obra-santos-homologacao',
    'pro',
    80,
    30,
    v_user_id,
    'homologation',
    jsonb_build_object(
      'environment', 'homologation',
      'approval_matrix', jsonb_build_object(
        'delete_fvs', 'diretor',
        'update_fvs_closed', 'gerente',
        'delete_rdo', 'gerente',
        'update_rdo_closed', 'gerente',
        'approve_budget', 'diretor',
        'delete_project', 'owner',
        'delete_organization', 'owner'
      ),
      'mfa_required_roles', jsonb_build_array('owner', 'diretor'),
      'soft_delete_days', 30
    )
  )
  ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        plan = EXCLUDED.plan,
        max_users = EXCLUDED.max_users,
        max_projects = EXCLUDED.max_projects,
        owner_id = COALESCE(public.organizations.owner_id, EXCLUDED.owner_id),
        environment = 'homologation',
        settings = COALESCE(public.organizations.settings, '{}'::jsonb) || EXCLUDED.settings,
        deleted_at = NULL,
        updated_at = now()
  RETURNING id INTO v_org_id;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.memberships (organization_id, user_id, role, status, joined_at)
    VALUES (v_org_id, v_user_id, 'owner', 'active', now())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Dashboard-only advisors left intentionally outside SQL:
-- 1. Enable leaked password protection in Supabase Auth settings.
-- 2. Move the citext extension out of public during a maintenance window if the project can tolerate it.
-- 3. Review "unused_index" rows before dropping; they may be unused only in the advisor observation window.
