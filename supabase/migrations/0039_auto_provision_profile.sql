-- ============================================================================
-- 0039_auto_provision_profile.sql
-- Auto-creates a profile row when a new auth user is created (e.g. via
-- the Supabase Dashboard). The profile is placed in the first organization
-- with role 'visualizador'. The admin can change the role later.
--
-- Also adds an RPC for existing auth users that lack a profile (one-time fix).
-- ============================================================================

-- ─── Trigger: auto-create profile on auth.users INSERT ─────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Pick the first (usually only) organization
  SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, organization_id, full_name, email, role, activated_at)
    VALUES (
      NEW.id,
      v_org_id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email::text, '@', 1)),
      NEW.email,
      'visualizador'::public.user_role,
      now()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- The trigger fires AFTER INSERT on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─── RPC: auto-provision for EXISTING auth users without profile ───────────

CREATE OR REPLACE FUNCTION public.auto_provision_profile()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_email     text;
  v_org_id    uuid;
  v_profile   json;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Already has a profile? Return it.
  SELECT to_json(p) INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_user_id AND p.deleted_at IS NULL;

  IF v_profile IS NOT NULL THEN
    RETURN v_profile;
  END IF;

  -- No profile — create one in the first organization
  SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'no organization found' USING ERRCODE = 'P0002';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.profiles (id, organization_id, full_name, email, role, activated_at)
  VALUES (
    v_user_id,
    v_org_id,
    split_part(v_email, '@', 1),
    v_email,
    'visualizador'::public.user_role,
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT to_json(p) INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_user_id;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_provision_profile() TO authenticated;


-- ─── One-time fix: provision profiles for existing auth users ──────────────

DO $$
DECLARE
  v_org_id uuid;
  v_user   RECORD;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_user IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
  LOOP
    INSERT INTO public.profiles (id, organization_id, full_name, email, role, activated_at)
    VALUES (
      v_user.id,
      v_org_id,
      COALESCE(v_user.raw_user_meta_data->>'full_name', split_part(v_user.email::text, '@', 1)),
      v_user.email,
      'visualizador'::public.user_role,
      now()
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;
