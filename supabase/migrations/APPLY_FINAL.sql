-- ============================================================================
-- APPLY_FINAL.sql
-- UM ÚNICO SQL para colar no Supabase. Tudo idempotente (pode rodar 2x).
--
-- Contém:
--   1) Fix do 0037 Medição (DROP POLICY antes de CREATE)
--   2) 0038 supplier_closures (idempotente)
--   3) 0039 auto_provision_profile (trigger + RPC)
--   4) 0035 triggers cross-module
--   5) 0036 materialized view
--   6) Org + profiles para os 2 users
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) FIX 0037 — Drop policies que já existem e recria
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  DROP POLICY IF EXISTS "cpi_select" ON contract_price_items;
  DROP POLICY IF EXISTS "cpi_insert" ON contract_price_items;
  DROP POLICY IF EXISTS "cpi_update" ON contract_price_items;
  DROP POLICY IF EXISTS "cpi_delete" ON contract_price_items;
  DROP POLICY IF EXISTS "mb_select" ON measurement_bulletins;
  DROP POLICY IF EXISTS "mb_insert" ON measurement_bulletins;
  DROP POLICY IF EXISTS "mb_update" ON measurement_bulletins;
  DROP POLICY IF EXISTS "mb_delete" ON measurement_bulletins;
  DROP POLICY IF EXISTS "mbi_select" ON measurement_bulletin_items;
  DROP POLICY IF EXISTS "mbi_insert" ON measurement_bulletin_items;
  DROP POLICY IF EXISTS "mbi_update" ON measurement_bulletin_items;
  DROP POLICY IF EXISTS "mbi_delete" ON measurement_bulletin_items;
END $$;

CREATE POLICY "cpi_select" ON contract_price_items FOR SELECT USING (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY "cpi_insert" ON contract_price_items FOR INSERT WITH CHECK (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY "cpi_update" ON contract_price_items FOR UPDATE USING (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY "cpi_delete" ON contract_price_items FOR DELETE USING (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY "mb_select" ON measurement_bulletins FOR SELECT USING (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY "mb_insert" ON measurement_bulletins FOR INSERT WITH CHECK (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY "mb_update" ON measurement_bulletins FOR UPDATE USING (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY "mb_delete" ON measurement_bulletins FOR DELETE USING (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY "mbi_select" ON measurement_bulletin_items FOR SELECT USING (bulletin_id IN (SELECT id FROM measurement_bulletins WHERE organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid())));
CREATE POLICY "mbi_insert" ON measurement_bulletin_items FOR INSERT WITH CHECK (bulletin_id IN (SELECT id FROM measurement_bulletins WHERE organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid())));
CREATE POLICY "mbi_update" ON measurement_bulletin_items FOR UPDATE USING (bulletin_id IN (SELECT id FROM measurement_bulletins WHERE organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid())));
CREATE POLICY "mbi_delete" ON measurement_bulletin_items FOR DELETE USING (bulletin_id IN (SELECT id FROM measurement_bulletins WHERE organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid())));

CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS set_updated_at_cpi ON contract_price_items;
CREATE TRIGGER set_updated_at_cpi BEFORE UPDATE ON contract_price_items FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_mb ON measurement_bulletins;
CREATE TRIGGER set_updated_at_mb BEFORE UPDATE ON measurement_bulletins FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_mbi ON measurement_bulletin_items;
CREATE TRIGGER set_updated_at_mbi BEFORE UPDATE ON measurement_bulletin_items FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) 0038 SUPPLIER CLOSURES (idempotente via IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS supplier_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bulletin_id uuid NOT NULL REFERENCES measurement_bulletins(id) ON DELETE CASCADE,
  supplier_name text NOT NULL DEFAULT '', gross_value numeric(14,4) NOT NULL DEFAULT 0,
  discounts jsonb NOT NULL DEFAULT '[]', admin_tax_pct numeric(5,2) NOT NULL DEFAULT 0,
  advances jsonb NOT NULL DEFAULT '[]', previous_month_closure numeric(14,4) NOT NULL DEFAULT 0,
  retention_pct numeric(5,2) NOT NULL DEFAULT 5, retention_released numeric(14,4) NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '', created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);

ALTER TABLE supplier_closures ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS "sc_select" ON supplier_closures;
  DROP POLICY IF EXISTS "sc_insert" ON supplier_closures;
  DROP POLICY IF EXISTS "sc_update" ON supplier_closures;
  DROP POLICY IF EXISTS "sc_delete" ON supplier_closures;
END $$;
CREATE POLICY "sc_select" ON supplier_closures FOR SELECT USING (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY "sc_insert" ON supplier_closures FOR INSERT WITH CHECK (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY "sc_update" ON supplier_closures FOR UPDATE USING (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY "sc_delete" ON supplier_closures FOR DELETE USING (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE INDEX IF NOT EXISTS idx_sc_org ON supplier_closures(organization_id);
CREATE INDEX IF NOT EXISTS idx_sc_bulletin ON supplier_closures(bulletin_id);
DROP TRIGGER IF EXISTS set_updated_at_sc ON supplier_closures;
CREATE TRIGGER set_updated_at_sc BEFORE UPDATE ON supplier_closures FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) 0039 AUTO PROVISION PROFILE
-- ═══════════════════════════════════════════════════════════════════════════

-- Garante org existe ANTES dos triggers/RPCs
INSERT INTO public.organizations (id, name, slug, owner_id)
VALUES ('a0000000-0000-0000-0000-000000000001','Atlântico ConstruData','atlantico-construdata','0cba1433-7f6a-4a94-99fd-967ab0dc47a8')
ON CONFLICT (slug) DO NOTHING;

-- Trigger: auto-create profile quando user é criado no Dashboard
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, organization_id, full_name, email, role, activated_at)
    VALUES (NEW.id, v_org_id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email::text,'@',1)),
            NEW.email, 'visualizador'::public.user_role, now())
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC: auto-provision para users existentes sem profile
CREATE OR REPLACE FUNCTION public.auto_provision_profile()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid:=auth.uid(); v_email text; v_org_id uuid; v_profile json;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='28000'; END IF;
  SELECT to_json(p) INTO v_profile FROM public.profiles p WHERE p.id=v_user_id AND p.deleted_at IS NULL;
  IF v_profile IS NOT NULL THEN RETURN v_profile; END IF;
  SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'no organization found' USING ERRCODE='P0002'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id=v_user_id;
  INSERT INTO public.profiles (id,organization_id,full_name,email,role,activated_at)
  VALUES (v_user_id,v_org_id,split_part(v_email,'@',1),v_email,'visualizador'::public.user_role,now())
  ON CONFLICT (id) DO NOTHING;
  SELECT to_json(p) INTO v_profile FROM public.profiles p WHERE p.id=v_user_id;
  RETURN v_profile;
END $$;
GRANT EXECUTE ON FUNCTION public.auto_provision_profile() TO authenticated;

-- One-time fix: provision profiles para users existentes que não têm
DO $$
DECLARE v_org_id uuid; v_user RECORD;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;
  FOR v_user IN SELECT u.id,u.email,u.raw_user_meta_data FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id WHERE p.id IS NULL
  LOOP
    INSERT INTO public.profiles (id,organization_id,full_name,email,role,activated_at)
    VALUES (v_user.id,v_org_id,COALESCE(v_user.raw_user_meta_data->>'full_name',split_part(v_user.email::text,'@',1)),v_user.email,'visualizador'::public.user_role,now())
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- Agora promove o João owner (sobrescreve o role 'visualizador' que o one-time fix pode ter dado)
UPDATE public.profiles SET role='owner', full_name='João Souza Nery' WHERE email='joaodsouzanery@gmail.com';
UPDATE public.profiles SET role='diretor', full_name='João Nery' WHERE email='joaoneryflu@gmail.com';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) TRIGGERS CROSS-MODULE (0035)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_rdo_to_planejamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_trecho jsonb; v_code text; v_executed numeric;
BEGIN
  IF jsonb_typeof(NEW.payload->'trechos')='array' THEN
    FOR v_trecho IN SELECT * FROM jsonb_array_elements(NEW.payload->'trechos') LOOP
      v_code:=v_trecho->>'trechoCode'; v_executed:=COALESCE((v_trecho->>'executedMeters')::numeric,0);
      IF v_code IS NOT NULL AND v_executed>0 THEN
        UPDATE public.plan_trechos pt SET payload=jsonb_set(COALESCE(pt.payload,'{}'::jsonb),'{executedMeters}',to_jsonb(GREATEST(COALESCE((pt.payload->>'executedMeters')::numeric,0),v_executed)),true),updated_at=now()
        WHERE pt.code=v_code AND pt.organization_id=NEW.organization_id AND pt.deleted_at IS NULL;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_rdo_to_planejamento ON public.rdo;
CREATE TRIGGER trg_rdo_to_planejamento AFTER INSERT OR UPDATE ON public.rdo FOR EACH ROW EXECUTE FUNCTION public.sync_rdo_to_planejamento();

CREATE OR REPLACE FUNCTION public.sync_po_to_evm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status='closed' AND (OLD.status IS DISTINCT FROM 'closed') AND COALESCE(NEW.total_brl,0)>0 THEN
    INSERT INTO public.evm_cost_accounts (id,organization_id,work_package_id,activity_id,pillar,total_cost_brl,payload,created_by,created_at,updated_at)
    SELECT gen_random_uuid(),NEW.organization_id,NULLIF(NEW.payload->>'workPackageId','')::uuid,NEW.payload->>'activityId','material',NEW.total_brl,
           jsonb_build_object('source','po_auto','po_id',NEW.id,'po_code',NEW.code,'created_at',now()),NEW.created_by,now(),now()
    WHERE NOT EXISTS (SELECT 1 FROM public.evm_cost_accounts WHERE organization_id=NEW.organization_id AND payload->>'po_id'=NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_po_to_evm ON public.purchase_orders;
CREATE TRIGGER trg_po_to_evm AFTER UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.sync_po_to_evm();

CREATE OR REPLACE FUNCTION public.sync_fvs_nc_to_lps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item jsonb; v_nc text; v_desc text;
BEGIN
  IF jsonb_typeof(NEW.payload->'items')='array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.payload->'items') LOOP
      IF (v_item->>'ncRequired')::boolean IS TRUE AND v_item->>'ncNumber' IS NOT NULL THEN
        v_nc:=v_item->>'ncNumber'; v_desc:=COALESCE(v_item->>'description',v_item->>'observation','Sem descrição');
        INSERT INTO public.lps_restrictions (id,organization_id,tema,categoria,status,payload,created_by,created_at,updated_at)
        SELECT gen_random_uuid(),NEW.organization_id,'NC '||v_nc||' — '||left(v_desc,80),'projeto_engenharia','identificada',
               jsonb_build_object('source','fvs_auto','fvs_id',NEW.id,'fvs_number',NEW.number,'nc_number',v_nc,'description',v_desc,'created_at',now()),
               NEW.created_by,now(),now()
        WHERE NOT EXISTS (SELECT 1 FROM public.lps_restrictions WHERE organization_id=NEW.organization_id AND payload->>'fvs_id'=NEW.id::text AND payload->>'nc_number'=v_nc);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_fvs_nc_to_lps ON public.fvs;
CREATE TRIGGER trg_fvs_nc_to_lps AFTER INSERT OR UPDATE ON public.fvs FOR EACH ROW EXECUTE FUNCTION public.sync_fvs_nc_to_lps();

CREATE OR REPLACE FUNCTION public.notify_worker_absent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status='open' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'open') THEN
    INSERT INTO public.audit_log (organization_id,actor_id,action,table_name,record_id,after)
    VALUES (NEW.organization_id,NEW.created_by,'worker_absent','worker_absences',NEW.id::text,jsonb_build_object('worker_id',NEW.worker_id,'date',NEW.date,'type',NEW.type));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_worker_absent_notify ON public.worker_absences;
CREATE TRIGGER trg_worker_absent_notify AFTER INSERT OR UPDATE ON public.worker_absences FOR EACH ROW EXECUTE FUNCTION public.notify_worker_absent();

CREATE OR REPLACE FUNCTION public.recompute_project_kpis(p_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid:=public.user_org(); v_bac numeric; v_ac numeric; v_pct numeric; v_r int; v_n int; v_d int; v_h text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id=p_project_id AND organization_id=v_org AND deleted_at IS NULL) THEN RAISE EXCEPTION 'not found' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(SUM(total_budget_brl),0) INTO v_bac FROM evm_work_packages WHERE project_id=p_project_id AND deleted_at IS NULL;
  SELECT COALESCE(SUM(total_cost_brl),0) INTO v_ac FROM evm_cost_accounts WHERE organization_id=v_org AND deleted_at IS NULL;
  SELECT COALESCE(AVG((payload->>'percentComplete')::numeric),0) INTO v_pct FROM plan_trechos WHERE project_id=p_project_id AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_r FROM lps_restrictions WHERE organization_id=v_org AND status!='resolvida' AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_n FROM fvs WHERE organization_id=v_org AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_d FROM rdo WHERE project_id=p_project_id AND deleted_at IS NULL;
  v_h:=CASE WHEN v_pct<30 THEN 'red' WHEN v_r>5 THEN 'yellow' ELSE 'green' END;
  RETURN jsonb_build_object('project_id',p_project_id,'bac_brl',v_bac,'ac_brl',v_ac,'percent_complete',v_pct,'open_restrictions',v_r,'open_ncs',v_n,'rdo_count',v_d,'health',v_h,'computed_at',now());
END $$;
GRANT EXECUTE ON FUNCTION public.recompute_project_kpis(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5) MATERIALIZED VIEW (0036)
-- ═══════════════════════════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS public.project_dashboard_view;
CREATE MATERIALIZED VIEW public.project_dashboard_view AS
SELECT
  p.id AS project_id, p.organization_id, p.code, p.name, p.status, p.start_date, p.end_date,
  COALESCE((SELECT SUM(ewp.total_budget_brl) FROM evm_work_packages ewp WHERE ewp.project_id::uuid=p.id AND ewp.deleted_at IS NULL),0)::numeric(14,2) AS bac_brl,
  COALESCE((SELECT SUM(eca.total_cost_brl) FROM evm_cost_accounts eca WHERE eca.organization_id=p.organization_id AND eca.deleted_at IS NULL),0)::numeric(14,2) AS ac_brl,
  COALESCE((SELECT AVG((pt.payload->>'percentComplete')::numeric) FROM plan_trechos pt WHERE pt.project_id::uuid=p.id AND pt.deleted_at IS NULL),0)::numeric(5,2) AS percent_complete,
  (SELECT COUNT(*) FROM rdo r WHERE r.project_id::uuid=p.id AND r.deleted_at IS NULL)::int AS rdo_count,
  (SELECT MAX(r.date) FROM rdo r WHERE r.project_id::uuid=p.id AND r.deleted_at IS NULL) AS last_rdo_date,
  (SELECT COUNT(*) FROM fvs f WHERE f.organization_id=p.organization_id AND f.deleted_at IS NULL)::int AS fvs_count,
  (SELECT COUNT(*) FROM lps_restrictions lr WHERE lr.organization_id=p.organization_id AND lr.status!='resolvida' AND lr.deleted_at IS NULL)::int AS open_restrictions,
  (SELECT COUNT(*) FROM workers w WHERE w.organization_id=p.organization_id AND w.deleted_at IS NULL)::int AS worker_count,
  (SELECT COUNT(*) FROM worker_absences wa WHERE wa.organization_id=p.organization_id AND wa.status='open' AND wa.deleted_at IS NULL)::int AS open_absences,
  (SELECT COUNT(*) FROM equipamentos e WHERE e.project_id::uuid=p.id AND e.deleted_at IS NULL)::int AS equipment_count,
  (SELECT COUNT(*) FROM purchase_orders po WHERE po.organization_id=p.organization_id AND po.status!='closed' AND po.deleted_at IS NULL)::int AS open_pos,
  CASE WHEN p.status='completed' THEN 'green'
    WHEN COALESCE((SELECT AVG((pt2.payload->>'percentComplete')::numeric) FROM plan_trechos pt2 WHERE pt2.project_id::uuid=p.id AND pt2.deleted_at IS NULL),0)<30 AND p.status='active' THEN 'red'
    WHEN (SELECT COUNT(*) FROM lps_restrictions lr2 WHERE lr2.organization_id=p.organization_id AND lr2.status!='resolvida' AND lr2.deleted_at IS NULL)>5 THEN 'yellow'
    ELSE 'green' END AS health,
  now() AS computed_at
FROM projects p WHERE p.deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pdv_pk ON project_dashboard_view(project_id);
CREATE INDEX IF NOT EXISTS idx_pdv_org ON project_dashboard_view(organization_id);

CREATE OR REPLACE FUNCTION public.get_project_dashboard()
RETURNS SETOF project_dashboard_view LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT * FROM project_dashboard_view WHERE organization_id=user_org() ORDER BY computed_at DESC;
$$;
GRANT EXECUTE ON FUNCTION get_project_dashboard() TO authenticated;
GRANT SELECT ON project_dashboard_view TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_project_dashboard()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY project_dashboard_view;
EXCEPTION WHEN feature_not_supported THEN REFRESH MATERIALIZED VIEW project_dashboard_view; END $$;
GRANT EXECUTE ON FUNCTION refresh_project_dashboard() TO authenticated;

REFRESH MATERIALIZED VIEW project_dashboard_view;
