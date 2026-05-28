-- ============================================================================
-- APPLY_CLEAN.sql — TUDO que falta, do zero, em ordem correta.
-- Pré-condição: 0037 foi removido do banco. Sprints 1-6 já aplicados.
-- Cole INTEIRO no SQL Editor → Run.
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 0037 MEDIÇÃO (tabelas + RLS + indexes + triggers)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contract_price_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL, description text NOT NULL DEFAULT '', unit text NOT NULL DEFAULT 'un',
  unit_price numeric(14,4) NOT NULL DEFAULT 0, contract_quantity numeric(14,4) NOT NULL DEFAULT 0,
  "group" text NOT NULL DEFAULT '', subgroup text NOT NULL DEFAULT '', frente text NOT NULL DEFAULT '',
  measurement_rule text NOT NULL DEFAULT '', created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS measurement_bulletins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reference_month text NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE (organization_id, reference_month)
);

CREATE TABLE IF NOT EXISTS measurement_bulletin_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_id uuid NOT NULL REFERENCES measurement_bulletins(id) ON DELETE CASCADE,
  price_item_id uuid NOT NULL REFERENCES contract_price_items(id) ON DELETE CASCADE,
  measured_quantity numeric(14,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bulletin_id, price_item_id)
);

ALTER TABLE contract_price_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_bulletins ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_bulletin_items ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX IF NOT EXISTS idx_cpi_org ON contract_price_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_mb_org_month ON measurement_bulletins(organization_id, reference_month);
CREATE INDEX IF NOT EXISTS idx_mbi_bulletin ON measurement_bulletin_items(bulletin_id);

CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS set_updated_at_cpi ON contract_price_items;
CREATE TRIGGER set_updated_at_cpi BEFORE UPDATE ON contract_price_items FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_mb ON measurement_bulletins;
CREATE TRIGGER set_updated_at_mb BEFORE UPDATE ON measurement_bulletins FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_mbi ON measurement_bulletin_items;
CREATE TRIGGER set_updated_at_mbi BEFORE UPDATE ON measurement_bulletin_items FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 0038 SUPPLIER CLOSURES
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
CREATE POLICY "sc_select" ON supplier_closures FOR SELECT USING (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY "sc_insert" ON supplier_closures FOR INSERT WITH CHECK (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY "sc_update" ON supplier_closures FOR UPDATE USING (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY "sc_delete" ON supplier_closures FOR DELETE USING (organization_id=(SELECT organization_id FROM profiles WHERE id=auth.uid()));
CREATE INDEX IF NOT EXISTS idx_sc_org ON supplier_closures(organization_id);
CREATE INDEX IF NOT EXISTS idx_sc_bulletin ON supplier_closures(bulletin_id);
DROP TRIGGER IF EXISTS set_updated_at_sc ON supplier_closures;
CREATE TRIGGER set_updated_at_sc BEFORE UPDATE ON supplier_closures FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 0039 ORG + AUTO PROVISION PROFILE
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.organizations (id, name, slug, owner_id)
VALUES ('a0000000-0000-0000-0000-000000000001','Atlântico ConstruData','atlantico-construdata','0cba1433-7f6a-4a94-99fd-967ab0dc47a8')
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, organization_id, full_name, email, role, activated_at)
    VALUES (NEW.id, v_org_id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email::text,'@',1)), NEW.email, 'visualizador'::public.user_role, now())
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.auto_provision_profile()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid:=auth.uid(); v_email text; v_org_id uuid; v_profile json;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='28000'; END IF;
  SELECT to_json(p) INTO v_profile FROM profiles p WHERE p.id=v_uid AND p.deleted_at IS NULL;
  IF v_profile IS NOT NULL THEN RETURN v_profile; END IF;
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at ASC LIMIT 1;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'no organization' USING ERRCODE='P0002'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id=v_uid;
  INSERT INTO profiles (id,organization_id,full_name,email,role,activated_at)
  VALUES (v_uid,v_org_id,split_part(v_email,'@',1),v_email,'visualizador'::user_role,now())
  ON CONFLICT (id) DO NOTHING;
  SELECT to_json(p) INTO v_profile FROM profiles p WHERE p.id=v_uid;
  RETURN v_profile;
END $$;
GRANT EXECUTE ON FUNCTION public.auto_provision_profile() TO authenticated;

-- Backfill: cria profiles para auth users que não têm
DO $$
DECLARE v_org_id uuid; v_user RECORD;
BEGIN
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at ASC LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;
  FOR v_user IN SELECT u.id,u.email,u.raw_user_meta_data FROM auth.users u LEFT JOIN profiles p ON p.id=u.id WHERE p.id IS NULL
  LOOP
    INSERT INTO profiles (id,organization_id,full_name,email,role,activated_at)
    VALUES (v_user.id,v_org_id,COALESCE(v_user.raw_user_meta_data->>'full_name',split_part(v_user.email::text,'@',1)),v_user.email,'visualizador'::user_role,now())
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- Promove roles corretos
UPDATE profiles SET role='owner', full_name='João Souza Nery' WHERE email='joaodsouzanery@gmail.com';
UPDATE profiles SET role='diretor', full_name='João Nery' WHERE email='joaoneryflu@gmail.com';

-- ═══════════════════════════════════════════════════════════════════════════
-- 0035 TRIGGERS CROSS-MODULE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_rdo_to_planejamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t jsonb; v_c text; v_e numeric;
BEGIN
  IF jsonb_typeof(NEW.payload->'trechos')='array' THEN
    FOR v_t IN SELECT * FROM jsonb_array_elements(NEW.payload->'trechos') LOOP
      v_c:=v_t->>'trechoCode'; v_e:=COALESCE((v_t->>'executedMeters')::numeric,0);
      IF v_c IS NOT NULL AND v_e>0 THEN
        UPDATE plan_trechos SET payload=jsonb_set(COALESCE(payload,'{}'::jsonb),'{executedMeters}',to_jsonb(GREATEST(COALESCE((payload->>'executedMeters')::numeric,0),v_e)),true),updated_at=now()
        WHERE code=v_c AND organization_id=NEW.organization_id AND deleted_at IS NULL;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_rdo_to_planejamento ON rdo;
CREATE TRIGGER trg_rdo_to_planejamento AFTER INSERT OR UPDATE ON rdo FOR EACH ROW EXECUTE FUNCTION sync_rdo_to_planejamento();

CREATE OR REPLACE FUNCTION public.sync_po_to_evm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status='closed' AND (OLD.status IS DISTINCT FROM 'closed') AND COALESCE(NEW.total_brl,0)>0 THEN
    INSERT INTO evm_cost_accounts (id,organization_id,work_package_id,activity_id,pillar,total_cost_brl,payload,created_by,created_at,updated_at)
    SELECT gen_random_uuid(),NEW.organization_id,NULLIF(NEW.payload->>'workPackageId','')::uuid,NEW.payload->>'activityId','material',NEW.total_brl,
           jsonb_build_object('source','po_auto','po_id',NEW.id,'po_code',NEW.code),NEW.created_by,now(),now()
    WHERE NOT EXISTS (SELECT 1 FROM evm_cost_accounts WHERE organization_id=NEW.organization_id AND payload->>'po_id'=NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_po_to_evm ON purchase_orders;
CREATE TRIGGER trg_po_to_evm AFTER UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION sync_po_to_evm();

CREATE OR REPLACE FUNCTION public.sync_fvs_nc_to_lps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_i jsonb; v_nc text; v_d text;
BEGIN
  IF jsonb_typeof(NEW.payload->'items')='array' THEN
    FOR v_i IN SELECT * FROM jsonb_array_elements(NEW.payload->'items') LOOP
      IF (v_i->>'ncRequired')::boolean IS TRUE AND v_i->>'ncNumber' IS NOT NULL THEN
        v_nc:=v_i->>'ncNumber'; v_d:=COALESCE(v_i->>'description','Sem descrição');
        INSERT INTO lps_restrictions (id,organization_id,tema,categoria,status,payload,created_by,created_at,updated_at)
        SELECT gen_random_uuid(),NEW.organization_id,'NC '||v_nc||' — '||left(v_d,80),'projeto_engenharia','identificada',
               jsonb_build_object('source','fvs_auto','fvs_id',NEW.id,'nc_number',v_nc),NEW.created_by,now(),now()
        WHERE NOT EXISTS (SELECT 1 FROM lps_restrictions WHERE organization_id=NEW.organization_id AND payload->>'fvs_id'=NEW.id::text AND payload->>'nc_number'=v_nc);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_fvs_nc_to_lps ON fvs;
CREATE TRIGGER trg_fvs_nc_to_lps AFTER INSERT OR UPDATE ON fvs FOR EACH ROW EXECUTE FUNCTION sync_fvs_nc_to_lps();

CREATE OR REPLACE FUNCTION public.notify_worker_absent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status='open' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'open') THEN
    INSERT INTO audit_log (organization_id,actor_id,action,table_name,record_id,after)
    VALUES (NEW.organization_id,NEW.created_by,'worker_absent','worker_absences',NEW.id::text,jsonb_build_object('worker_id',NEW.worker_id,'date',NEW.date));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_worker_absent_notify ON worker_absences;
CREATE TRIGGER trg_worker_absent_notify AFTER INSERT OR UPDATE ON worker_absences FOR EACH ROW EXECUTE FUNCTION notify_worker_absent();

-- ═══════════════════════════════════════════════════════════════════════════
-- 0036 MATERIALIZED VIEW
-- ═══════════════════════════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS project_dashboard_view;
CREATE MATERIALIZED VIEW project_dashboard_view AS
SELECT
  p.id AS project_id, p.organization_id, p.code, p.name, p.status, p.start_date, p.end_date,
  COALESCE((SELECT SUM(total_budget_brl) FROM evm_work_packages WHERE project_id::uuid=p.id AND deleted_at IS NULL),0)::numeric(14,2) AS bac_brl,
  COALESCE((SELECT SUM(total_cost_brl) FROM evm_cost_accounts WHERE organization_id=p.organization_id AND deleted_at IS NULL),0)::numeric(14,2) AS ac_brl,
  COALESCE((SELECT AVG((payload->>'percentComplete')::numeric) FROM plan_trechos WHERE project_id::uuid=p.id AND deleted_at IS NULL),0)::numeric(5,2) AS percent_complete,
  (SELECT COUNT(*) FROM rdo WHERE project_id::uuid=p.id AND deleted_at IS NULL)::int AS rdo_count,
  (SELECT MAX(date) FROM rdo WHERE project_id::uuid=p.id AND deleted_at IS NULL) AS last_rdo_date,
  (SELECT COUNT(*) FROM fvs WHERE organization_id=p.organization_id AND deleted_at IS NULL)::int AS fvs_count,
  (SELECT COUNT(*) FROM lps_restrictions WHERE organization_id=p.organization_id AND status!='resolvida' AND deleted_at IS NULL)::int AS open_restrictions,
  (SELECT COUNT(*) FROM workers WHERE organization_id=p.organization_id AND deleted_at IS NULL)::int AS worker_count,
  (SELECT COUNT(*) FROM equipamentos WHERE project_id::uuid=p.id AND deleted_at IS NULL)::int AS equipment_count,
  (SELECT COUNT(*) FROM purchase_orders WHERE organization_id=p.organization_id AND status!='closed' AND deleted_at IS NULL)::int AS open_pos,
  CASE WHEN p.status='completed' THEN 'green'
    WHEN COALESCE((SELECT AVG((payload->>'percentComplete')::numeric) FROM plan_trechos WHERE project_id::uuid=p.id AND deleted_at IS NULL),0)<30 AND p.status='active' THEN 'red'
    WHEN (SELECT COUNT(*) FROM lps_restrictions WHERE organization_id=p.organization_id AND status!='resolvida' AND deleted_at IS NULL)>5 THEN 'yellow'
    ELSE 'green' END AS health,
  now() AS computed_at
FROM projects p WHERE p.deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pdv_pk ON project_dashboard_view(project_id);

CREATE OR REPLACE FUNCTION public.get_project_dashboard()
RETURNS SETOF project_dashboard_view LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT * FROM project_dashboard_view WHERE organization_id=user_org();
$$;
GRANT EXECUTE ON FUNCTION get_project_dashboard() TO authenticated;
GRANT SELECT ON project_dashboard_view TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_project_dashboard()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY project_dashboard_view;
EXCEPTION WHEN feature_not_supported THEN REFRESH MATERIALIZED VIEW project_dashboard_view; END $$;
GRANT EXECUTE ON FUNCTION refresh_project_dashboard() TO authenticated;

REFRESH MATERIALIZED VIEW project_dashboard_view;
