-- 0035_cross_module_triggers.sql
-- Sprint Ontologia Unificada — Camada 2: triggers SQL que propagam mudanças
-- entre módulos no servidor (verdade única, não duplicada no cliente).
--
-- Cobre as 4 dores prioritárias:
--   1. RDO → Planejamento (executed meters → trecho %)
--   2. PO closed → EVM AC (custo real)
--   3. FVS NC → LPS restriction
--   4. Worker absent → audit_log (alerta de produtividade)
--
-- Triggers são idempotentes — re-executar não duplica dados.

-- ════════════════════════════════════════════════════════════════════════
-- TRIGGER 1 — RDO → Planejamento (executed meters)
-- ════════════════════════════════════════════════════════════════════════
-- Quando um RDO é inserido/atualizado, varre os trechos do payload e
-- atualiza plan_trechos.payload->>'executedMeters' com o valor mais alto
-- (não regride). Atualiza também updated_at para acionar Realtime.

CREATE OR REPLACE FUNCTION public.sync_rdo_to_planejamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trecho jsonb;
  v_code text;
  v_executed numeric;
BEGIN
  -- Itera sobre os trechos do payload do RDO
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
              to_jsonb(GREATEST(
                COALESCE((pt.payload->>'executedMeters')::numeric, 0),
                v_executed
              )),
              true
            ),
            updated_at = now()
        WHERE pt.code = v_code
          AND pt.organization_id = NEW.organization_id
          AND pt.deleted_at IS NULL;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rdo_to_planejamento ON public.rdo;
CREATE TRIGGER trg_rdo_to_planejamento
  AFTER INSERT OR UPDATE ON public.rdo
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_rdo_to_planejamento();

-- ════════════════════════════════════════════════════════════════════════
-- TRIGGER 2 — PO closed → EVM cost account (AC real)
-- ════════════════════════════════════════════════════════════════════════
-- Quando uma purchase order vai para status='closed', insere automaticamente
-- um evm_cost_account com source='po_auto'. Idempotente: NÃO duplica se já
-- existe um cost_account com mesmo po_id.

CREATE OR REPLACE FUNCTION public.sync_po_to_evm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'closed'
     AND (OLD.status IS DISTINCT FROM 'closed')
     AND COALESCE(NEW.total_brl, 0) > 0
  THEN
    INSERT INTO public.evm_cost_accounts (
      id, organization_id, work_package_id, activity_id, pillar,
      total_cost_brl, payload, created_by, created_at, updated_at
    )
    SELECT
      gen_random_uuid(),
      NEW.organization_id,
      NULLIF(NEW.payload->>'workPackageId', '')::uuid,
      NEW.payload->>'activityId',
      'material',
      NEW.total_brl,
      jsonb_build_object(
        'source',  'po_auto',
        'po_id',   NEW.id,
        'po_code', NEW.code,
        'created_at', now()
      ),
      NEW.created_by,
      now(),
      now()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.evm_cost_accounts
      WHERE organization_id = NEW.organization_id
        AND payload->>'po_id' = NEW.id::text
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_po_to_evm ON public.purchase_orders;
CREATE TRIGGER trg_po_to_evm
  AFTER UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_po_to_evm();

-- ════════════════════════════════════════════════════════════════════════
-- TRIGGER 3 — FVS NC → LPS restriction (idempotente)
-- ════════════════════════════════════════════════════════════════════════
-- Quando um FVS é inserido/atualizado, varre os items do payload procurando
-- ncRequired=true com ncNumber definido. Para cada NC nova, insere uma
-- lps_restriction. Idempotente via NOT EXISTS por (fvs_id, nc_number).

CREATE OR REPLACE FUNCTION public.sync_fvs_nc_to_lps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item jsonb;
  v_nc_number text;
  v_description text;
BEGIN
  IF jsonb_typeof(NEW.payload->'items') = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.payload->'items')
    LOOP
      -- Só processa items com NC declarada
      IF (v_item->>'ncRequired')::boolean IS TRUE
         AND v_item->>'ncNumber' IS NOT NULL
      THEN
        v_nc_number := v_item->>'ncNumber';
        v_description := COALESCE(v_item->>'description', v_item->>'observation', 'Sem descrição');

        INSERT INTO public.lps_restrictions (
          id, organization_id, tema, categoria, status, payload, created_by, created_at, updated_at
        )
        SELECT
          gen_random_uuid(),
          NEW.organization_id,
          'NC ' || v_nc_number || ' — ' || left(v_description, 80),
          'projeto_engenharia',
          'identificada',
          jsonb_build_object(
            'source',      'fvs_auto',
            'fvs_id',      NEW.id,
            'fvs_number',  NEW.number,
            'nc_number',   v_nc_number,
            'description', v_description,
            'created_at',  now()
          ),
          NEW.created_by,
          now(),
          now()
        WHERE NOT EXISTS (
          SELECT 1 FROM public.lps_restrictions
          WHERE organization_id = NEW.organization_id
            AND payload->>'fvs_id' = NEW.id::text
            AND payload->>'nc_number' = v_nc_number
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fvs_nc_to_lps ON public.fvs;
CREATE TRIGGER trg_fvs_nc_to_lps
  AFTER INSERT OR UPDATE ON public.fvs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_fvs_nc_to_lps();

-- ════════════════════════════════════════════════════════════════════════
-- TRIGGER 4 — Worker absent → audit_log (alerta produtividade)
-- ════════════════════════════════════════════════════════════════════════
-- Quando uma absence é inserida/atualizada para status='open', registra
-- no audit_log para que dashboards e alerts possam reagir.

CREATE OR REPLACE FUNCTION public.notify_worker_absent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'open' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'open') THEN
    INSERT INTO public.audit_log (
      organization_id, actor_id, action, table_name, record_id, after
    )
    VALUES (
      NEW.organization_id,
      NEW.created_by,
      'worker_absent',
      'worker_absences',
      NEW.id::text,
      jsonb_build_object('worker_id', NEW.worker_id, 'date', NEW.date, 'type', NEW.type)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_worker_absent_notify ON public.worker_absences;
CREATE TRIGGER trg_worker_absent_notify
  AFTER INSERT OR UPDATE ON public.worker_absences
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_worker_absent();

-- ════════════════════════════════════════════════════════════════════════
-- BÔNUS — RPC recompute_project_kpis
-- ════════════════════════════════════════════════════════════════════════
-- Função callable para recalcular KPIs de um projeto a partir das
-- tabelas-fonte. Pode ser chamada manualmente do UI ou agendada via pg_cron.
-- Por enquanto retorna um snapshot — pode ser estendida para escrever em
-- uma tabela de KPIs persistidos no futuro.

CREATE OR REPLACE FUNCTION public.recompute_project_kpis(p_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id uuid := public.user_org();
  v_bac numeric := 0;
  v_ac numeric := 0;
  v_percent numeric := 0;
  v_open_restrictions int := 0;
  v_open_ncs int := 0;
  v_rdo_count int := 0;
  v_health text;
BEGIN
  -- Validação de tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND organization_id = v_org_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'project not found or not in user org' USING ERRCODE = '42501';
  END IF;

  -- BAC: soma dos work packages do projeto
  SELECT COALESCE(SUM(total_budget_brl), 0) INTO v_bac
    FROM public.evm_work_packages
    WHERE project_id = p_project_id AND deleted_at IS NULL;

  -- AC: soma dos cost accounts (aproximação — não tem project_id direto)
  SELECT COALESCE(SUM(eca.total_cost_brl), 0) INTO v_ac
    FROM public.evm_cost_accounts eca
    WHERE eca.organization_id = v_org_id AND eca.deleted_at IS NULL;

  -- % progresso: média dos plan_trechos do projeto
  SELECT COALESCE(AVG((payload->>'percentComplete')::numeric), 0) INTO v_percent
    FROM public.plan_trechos
    WHERE project_id = p_project_id AND deleted_at IS NULL;

  -- Restrições abertas
  SELECT COUNT(*) INTO v_open_restrictions
    FROM public.lps_restrictions
    WHERE organization_id = v_org_id
      AND status != 'resolvida'
      AND deleted_at IS NULL;

  -- NCs abertas (FVS payload)
  SELECT COUNT(*) INTO v_open_ncs
    FROM public.fvs
    WHERE organization_id = v_org_id
      AND deleted_at IS NULL
      AND jsonb_array_length(COALESCE(payload->'items', '[]'::jsonb)) > 0;

  -- RDOs do projeto
  SELECT COUNT(*) INTO v_rdo_count
    FROM public.rdo
    WHERE project_id = p_project_id AND deleted_at IS NULL;

  -- Health derivado
  v_health := CASE
    WHEN v_percent < 30 THEN 'red'
    WHEN v_open_restrictions > 5 OR v_open_ncs > 10 THEN 'yellow'
    ELSE 'green'
  END;

  RETURN jsonb_build_object(
    'project_id', p_project_id,
    'bac_brl', v_bac,
    'ac_brl', v_ac,
    'percent_complete', v_percent,
    'open_restrictions', v_open_restrictions,
    'open_ncs', v_open_ncs,
    'rdo_count', v_rdo_count,
    'health', v_health,
    'computed_at', now()
  );
END $$;

GRANT EXECUTE ON FUNCTION public.recompute_project_kpis(uuid) TO authenticated;
