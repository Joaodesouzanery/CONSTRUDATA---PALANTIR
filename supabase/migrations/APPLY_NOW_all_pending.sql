-- ============================================================================
-- APPLY_NOW_all_pending.sql
-- Arquivo ÚNICO para colar no SQL Editor do Supabase.
-- Contém:
--   1) Triggers cross-module (0035) — idempotente via CREATE OR REPLACE
--   2) Materialized view project_dashboard (0036) — DROP IF EXISTS + recreate
--   3) Fix do 0037 (Medição) — DROP POLICY antes de CREATE
--   4) Profiles para os 2 users existentes
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 1 — TRIGGERS CROSS-MODULE (0035)
-- ═══════════════════════════════════════════════════════════════════════════════

-- TRIGGER 1: RDO → Planejamento
CREATE OR REPLACE FUNCTION public.sync_rdo_to_planejamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trecho jsonb;
  v_code text;
  v_executed numeric;
BEGIN
  IF jsonb_typeof(NEW.payload->'trechos') = 'array' THEN
    FOR v_trecho IN SELECT * FROM jsonb_array_elements(NEW.payload->'trechos')
    LOOP
      v_code := v_trecho->>'trechoCode';
      v_executed := COALESCE((v_trecho->>'executedMeters')::numeric, 0);
      IF v_code IS NOT NULL AND v_executed > 0 THEN
        UPDATE public.plan_trechos pt
        SET payload = jsonb_set(
              COALESCE(pt.payload, '{}'::jsonb),
              '{executedMeters}',
              to_jsonb(GREATEST(COALESCE((pt.payload->>'executedMeters')::numeric, 0), v_executed)),
              true),
            updated_at = now()
        WHERE pt.code = v_code AND pt.organization_id = NEW.organization_id AND pt.deleted_at IS NULL;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rdo_to_planejamento ON public.rdo;
CREATE TRIGGER trg_rdo_to_planejamento
  AFTER INSERT OR UPDATE ON public.rdo
  FOR EACH ROW EXECUTE FUNCTION public.sync_rdo_to_planejamento();

-- TRIGGER 2: PO closed → EVM AC
CREATE OR REPLACE FUNCTION public.sync_po_to_evm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed') AND COALESCE(NEW.total_brl, 0) > 0 THEN
    INSERT INTO public.evm_cost_accounts (id, organization_id, work_package_id, activity_id, pillar, total_cost_brl, payload, created_by, created_at, updated_at)
    SELECT gen_random_uuid(), NEW.organization_id, NULLIF(NEW.payload->>'workPackageId','')::uuid, NEW.payload->>'activityId', 'material', NEW.total_brl,
           jsonb_build_object('source','po_auto','po_id',NEW.id,'po_code',NEW.code,'created_at',now()), NEW.created_by, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM public.evm_cost_accounts WHERE organization_id = NEW.organization_id AND payload->>'po_id' = NEW.id::text);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_po_to_evm ON public.purchase_orders;
CREATE TRIGGER trg_po_to_evm AFTER UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.sync_po_to_evm();

-- TRIGGER 3: FVS NC → LPS restriction
CREATE OR REPLACE FUNCTION public.sync_fvs_nc_to_lps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item jsonb; v_nc_number text; v_description text;
BEGIN
  IF jsonb_typeof(NEW.payload->'items') = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.payload->'items')
    LOOP
      IF (v_item->>'ncRequired')::boolean IS TRUE AND v_item->>'ncNumber' IS NOT NULL THEN
        v_nc_number := v_item->>'ncNumber';
        v_description := COALESCE(v_item->>'description', v_item->>'observation', 'Sem descrição');
        INSERT INTO public.lps_restrictions (id, organization_id, tema, categoria, status, payload, created_by, created_at, updated_at)
        SELECT gen_random_uuid(), NEW.organization_id, 'NC '||v_nc_number||' — '||left(v_description,80), 'projeto_engenharia', 'identificada',
               jsonb_build_object('source','fvs_auto','fvs_id',NEW.id,'fvs_number',NEW.number,'nc_number',v_nc_number,'description',v_description,'created_at',now()),
               NEW.created_by, now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM public.lps_restrictions WHERE organization_id = NEW.organization_id AND payload->>'fvs_id' = NEW.id::text AND payload->>'nc_number' = v_nc_number);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fvs_nc_to_lps ON public.fvs;
CREATE TRIGGER trg_fvs_nc_to_lps AFTER INSERT OR UPDATE ON public.fvs FOR EACH ROW EXECUTE FUNCTION public.sync_fvs_nc_to_lps();

-- TRIGGER 4: Worker absent → audit_log
CREATE OR REPLACE FUNCTION public.notify_worker_absent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'open' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'open') THEN
    INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
    VALUES (NEW.organization_id, NEW.created_by, 'worker_absent', 'worker_absences', NEW.id::text,
            jsonb_build_object('worker_id', NEW.worker_id, 'date', NEW.date, 'type', NEW.type));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_worker_absent_notify ON public.worker_absences;
CREATE TRIGGER trg_worker_absent_notify AFTER INSERT OR UPDATE ON public.worker_absences FOR EACH ROW EXECUTE FUNCTION public.notify_worker_absent();

-- RPC: recompute_project_kpis
CREATE OR REPLACE FUNCTION public.recompute_project_kpis(p_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id uuid := public.user_org();
  v_bac numeric; v_ac numeric; v_percent numeric;
  v_open_restrictions int; v_open_ncs int; v_rdo_count int; v_health text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND organization_id = v_org_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'project not found or not in user org' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(SUM(total_budget_brl),0) INTO v_bac FROM public.evm_work_packages WHERE project_id = p_project_id AND deleted_at IS NULL;
  SELECT COALESCE(SUM(total_cost_brl),0) INTO v_ac FROM public.evm_cost_accounts WHERE organization_id = v_org_id AND deleted_at IS NULL;
  SELECT COALESCE(AVG((payload->>'percentComplete')::numeric),0) INTO v_percent FROM public.plan_trechos WHERE project_id = p_project_id AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_open_restrictions FROM public.lps_restrictions WHERE organization_id = v_org_id AND status != 'resolvida' AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_open_ncs FROM public.fvs WHERE organization_id = v_org_id AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_rdo_count FROM public.rdo WHERE project_id = p_project_id AND deleted_at IS NULL;
  v_health := CASE WHEN v_percent < 30 THEN 'red' WHEN v_open_restrictions > 5 THEN 'yellow' ELSE 'green' END;
  RETURN jsonb_build_object('project_id',p_project_id,'bac_brl',v_bac,'ac_brl',v_ac,'percent_complete',v_percent,
    'open_restrictions',v_open_restrictions,'open_ncs',v_open_ncs,'rdo_count',v_rdo_count,'health',v_health,'computed_at',now());
END $$;

GRANT EXECUTE ON FUNCTION public.recompute_project_kpis(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 2 — MATERIALIZED VIEW (0036)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS public.project_dashboard_view;

CREATE MATERIALIZED VIEW public.project_dashboard_view AS
SELECT
  p.id AS project_id, p.organization_id, p.code, p.name, p.status, p.start_date, p.end_date,
  COALESCE((SELECT SUM(ewp.total_budget_brl) FROM public.evm_work_packages ewp WHERE ewp.project_id::uuid = p.id AND ewp.deleted_at IS NULL),0)::numeric(14,2) AS bac_brl,
  COALESCE((SELECT SUM(eca.total_cost_brl) FROM public.evm_cost_accounts eca WHERE eca.organization_id = p.organization_id AND eca.deleted_at IS NULL),0)::numeric(14,2) AS ac_brl,
  COALESCE((SELECT AVG((pt.payload->>'percentComplete')::numeric) FROM public.plan_trechos pt WHERE pt.project_id::uuid = p.id AND pt.deleted_at IS NULL),0)::numeric(5,2) AS percent_complete,
  (SELECT COUNT(*) FROM public.rdo r WHERE r.project_id::uuid = p.id AND r.deleted_at IS NULL)::int AS rdo_count,
  (SELECT MAX(r.date) FROM public.rdo r WHERE r.project_id::uuid = p.id AND r.deleted_at IS NULL) AS last_rdo_date,
  (SELECT COUNT(*) FROM public.fvs f WHERE f.organization_id = p.organization_id AND f.deleted_at IS NULL)::int AS fvs_count,
  (SELECT COUNT(*) FROM public.lps_restrictions lr WHERE lr.organization_id = p.organization_id AND lr.status != 'resolvida' AND lr.deleted_at IS NULL)::int AS open_restrictions,
  (SELECT COUNT(*) FROM public.workers w WHERE w.organization_id = p.organization_id AND w.deleted_at IS NULL)::int AS worker_count,
  (SELECT COUNT(*) FROM public.worker_absences wa WHERE wa.organization_id = p.organization_id AND wa.status = 'open' AND wa.deleted_at IS NULL)::int AS open_absences,
  (SELECT COUNT(*) FROM public.equipamentos e WHERE e.project_id::uuid = p.id AND e.deleted_at IS NULL)::int AS equipment_count,
  (SELECT COUNT(*) FROM public.purchase_orders po WHERE po.organization_id = p.organization_id AND po.status != 'closed' AND po.deleted_at IS NULL)::int AS open_pos,
  CASE
    WHEN p.status = 'completed' THEN 'green'
    WHEN COALESCE((SELECT AVG((pt.payload->>'percentComplete')::numeric) FROM public.plan_trechos pt WHERE pt.project_id::uuid = p.id AND pt.deleted_at IS NULL),0) < 30 AND p.status = 'active' THEN 'red'
    WHEN (SELECT COUNT(*) FROM public.lps_restrictions lr WHERE lr.organization_id = p.organization_id AND lr.status != 'resolvida' AND lr.deleted_at IS NULL) > 5 THEN 'yellow'
    ELSE 'green'
  END AS health,
  now() AS computed_at
FROM public.projects p WHERE p.deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_dashboard_view_pk ON public.project_dashboard_view(project_id);
CREATE INDEX IF NOT EXISTS idx_project_dashboard_view_org ON public.project_dashboard_view(organization_id);

CREATE OR REPLACE FUNCTION public.get_project_dashboard()
RETURNS SETOF public.project_dashboard_view
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.project_dashboard_view WHERE organization_id = public.user_org() ORDER BY computed_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_project_dashboard() TO authenticated;
GRANT SELECT ON public.project_dashboard_view TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_project_dashboard()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.project_dashboard_view;
EXCEPTION WHEN feature_not_supported THEN
  REFRESH MATERIALIZED VIEW public.project_dashboard_view;
END $$;
GRANT EXECUTE ON FUNCTION public.refresh_project_dashboard() TO authenticated;

REFRESH MATERIALIZED VIEW public.project_dashboard_view;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 3 — FIX 0037 MEDIÇÃO (DROP POLICY antes de CREATE)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop all existing policies to make idempotent
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

CREATE POLICY "cpi_select" ON contract_price_items FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "cpi_insert" ON contract_price_items FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "cpi_update" ON contract_price_items FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "cpi_delete" ON contract_price_items FOR DELETE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "mb_select" ON measurement_bulletins FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "mb_insert" ON measurement_bulletins FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "mb_update" ON measurement_bulletins FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "mb_delete" ON measurement_bulletins FOR DELETE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "mbi_select" ON measurement_bulletin_items FOR SELECT USING (bulletin_id IN (SELECT id FROM measurement_bulletins WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "mbi_insert" ON measurement_bulletin_items FOR INSERT WITH CHECK (bulletin_id IN (SELECT id FROM measurement_bulletins WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "mbi_update" ON measurement_bulletin_items FOR UPDATE USING (bulletin_id IN (SELECT id FROM measurement_bulletins WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "mbi_delete" ON measurement_bulletin_items FOR DELETE USING (bulletin_id IN (SELECT id FROM measurement_bulletins WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())));

-- Updated_at triggers (idempotent via OR REPLACE + IF NOT EXISTS)
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$ BEGIN new.updated_at = now(); RETURN new; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS set_updated_at_cpi ON contract_price_items;
CREATE TRIGGER set_updated_at_cpi BEFORE UPDATE ON contract_price_items FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_mb ON measurement_bulletins;
CREATE TRIGGER set_updated_at_mb BEFORE UPDATE ON measurement_bulletins FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_mbi ON measurement_bulletin_items;
CREATE TRIGGER set_updated_at_mbi BEFORE UPDATE ON measurement_bulletin_items FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 4 — PROFILES PARA OS 2 USERS (login)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Primeiro, garante que existe uma org (cria se não existir)
INSERT INTO public.organizations (id, name, slug, owner_id)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Atlântico ConstruData',
  'atlantico-construdata',
  '0cba1433-7f6a-4a94-99fd-967ab0dc47a8'
)
ON CONFLICT (slug) DO NOTHING;

-- Profile para João Souza Nery (owner)
INSERT INTO public.profiles (id, organization_id, full_name, email, role, activated_at)
VALUES (
  '0cba1433-7f6a-4a94-99fd-967ab0dc47a8',
  (SELECT id FROM public.organizations WHERE slug = 'atlantico-construdata' LIMIT 1),
  'João Souza Nery',
  'joaodsouzanery@gmail.com',
  'owner',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  activated_at = COALESCE(profiles.activated_at, now());

-- Profile para joaoneryflu (segundo user)
INSERT INTO public.profiles (id, organization_id, full_name, email, role, activated_at)
VALUES (
  '94691f7c-9566-4166-9319-c7c7ca185f4f',
  (SELECT id FROM public.organizations WHERE slug = 'atlantico-construdata' LIMIT 1),
  'João Nery',
  'joaoneryflu@gmail.com',
  'diretor',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  activated_at = COALESCE(profiles.activated_at, now());

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — rode manualmente depois para confirmar
-- ═══════════════════════════════════════════════════════════════════════════════
-- SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_%';
-- SELECT * FROM public.profiles;
-- SELECT * FROM public.organizations;
-- SELECT * FROM public.project_dashboard_view;
