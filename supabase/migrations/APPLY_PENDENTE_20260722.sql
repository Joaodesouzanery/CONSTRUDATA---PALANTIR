-- =====================================================================
-- APPLY_PENDENTE_20260722.sql — bundle de recuperação de schema
-- =====================================================================
-- Junta, em ordem, TODAS as migrações que podem não ter sido aplicadas
-- em produção (não há etapa de migração no CI). É a correção da classe de
-- erros "Could not find the table/column ... in the schema cache"
-- (ex.: Economia / public.economy_baselines).
--
-- COMO USAR: cole este arquivo INTEIRO no Supabase SQL Editor (produção) e
-- rode UMA vez. Tudo é idempotente (CREATE TABLE/ADD COLUMN IF NOT EXISTS,
-- CREATE OR REPLACE, DROP POLICY IF EXISTS) — seguro mesmo no que já existe.
-- Depois disso, recarregue o app: os "não salvo · erro" de schema somem.
-- =====================================================================



-- =====================================================================
-- >>> 0054_economia_roi.sql
-- =====================================================================

-- 0054_economia_roi.sql
-- Modulo Economia: baseline, eventos de valor, regras de calculo e relatorios mensais.

CREATE TABLE IF NOT EXISTS public.economy_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid,
  project_name text NOT NULL,
  period text NOT NULL,
  captured_at date NOT NULL,
  ppc_percent numeric NOT NULL DEFAULT 0,
  material_deviation_percent numeric NOT NULL DEFAULT 0,
  platform_monthly_fee_brl numeric NOT NULL DEFAULT 5000,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.economy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid,
  project_name text NOT NULL,
  period text NOT NULL,
  source_module text NOT NULL,
  source_id text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'detected',
  impact_brl numeric NOT NULL DEFAULT 0,
  stable_key text NOT NULL,
  event_date date NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT economy_events_status_check CHECK (status IN ('detected','validated','dismissed','reported')),
  CONSTRAINT economy_events_category_check CHECK (category IN (
    'material_waste',
    'production_stoppage',
    'restriction_removed',
    'equipment_idle',
    'management_hours',
    'measurement_discrepancy',
    'schedule_alert',
    'cost_deviation'
  )),
  CONSTRAINT economy_events_source_check CHECK (source_module IN (
    'suprimentos',
    'lps',
    'planejamento',
    'rdo',
    'relatorio360',
    'equipamentos',
    'medicao',
    'evm',
    'manual'
  )),
  CONSTRAINT economy_events_stable_key_unique UNIQUE (organization_id, stable_key)
);

CREATE TABLE IF NOT EXISTS public.economy_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid,
  project_name text NOT NULL,
  period text NOT NULL,
  baseline_id uuid REFERENCES public.economy_baselines(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  avoided_loss_brl numeric NOT NULL DEFAULT 0,
  roi_percent numeric NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT economy_reports_status_check CHECK (status IN ('draft','sent','archived'))
);

CREATE TABLE IF NOT EXISTS public.economy_valuation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category text NOT NULL,
  label text NOT NULL,
  formula text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT economy_valuation_rules_unique UNIQUE (organization_id, category, label)
);

CREATE INDEX IF NOT EXISTS idx_economy_baselines_org_period
  ON public.economy_baselines(organization_id, period, project_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_economy_events_org_period
  ON public.economy_events(organization_id, period, project_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_economy_events_org_source
  ON public.economy_events(organization_id, source_module, category, event_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_economy_reports_org_period
  ON public.economy_reports(organization_id, period, project_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_economy_rules_org_category
  ON public.economy_valuation_rules(organization_id, category)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_economy_baselines_updated_at ON public.economy_baselines;
CREATE TRIGGER trg_economy_baselines_updated_at
  BEFORE UPDATE ON public.economy_baselines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_economy_events_updated_at ON public.economy_events;
CREATE TRIGGER trg_economy_events_updated_at
  BEFORE UPDATE ON public.economy_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_economy_reports_updated_at ON public.economy_reports;
CREATE TRIGGER trg_economy_reports_updated_at
  BEFORE UPDATE ON public.economy_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_economy_rules_updated_at ON public.economy_valuation_rules;
CREATE TRIGGER trg_economy_rules_updated_at
  BEFORE UPDATE ON public.economy_valuation_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.economy_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economy_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economy_valuation_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.economy_baselines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.economy_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.economy_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.economy_valuation_rules FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'economy_baselines',
    'economy_events',
    'economy_reports',
    'economy_valuation_rules'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_own_org ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select_own_org ON public.%I FOR SELECT TO authenticated USING (organization_id = public.user_org() AND deleted_at IS NULL)',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_insert_with_role ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_insert_with_role ON public.%I FOR INSERT TO authenticated WITH CHECK (organization_id = public.user_org() AND created_by = auth.uid() AND public.has_role(ARRAY[''engenheiro'',''planejador'',''comprador'',''gerente'',''diretor'',''owner'']::public.user_role[]))',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_update_own_org ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_update_own_org ON public.%I FOR UPDATE TO authenticated USING (organization_id = public.user_org() AND deleted_at IS NULL) WITH CHECK (organization_id = public.user_org())',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_delete_blocked ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_delete_blocked ON public.%I FOR DELETE TO authenticated USING (false)',
      t, t
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.economy_baselines IS 'Baseline semana 0 para provar ROI por obra ou carteira.';
COMMENT ON TABLE public.economy_events IS 'Eventos de economia detectados ou validados a partir dos modulos operacionais.';
COMMENT ON TABLE public.economy_reports IS 'Relatorios mensais de valor entregue e ROI.';
COMMENT ON TABLE public.economy_valuation_rules IS 'Premissas e formulas editaveis para monetizar eventos de economia.';



-- =====================================================================
-- >>> 20260622120000_worker_assessments.sql
-- =====================================================================

-- 20260622120000_worker_assessments.sql
-- Mão de Obra — Ficha de Avaliação de Funcionário (tenant-safe, payload jsonb,
-- soft delete, RLS padrão 0020). Espelha worker_absences (0019) + RLS de 0020 +
-- soft delete do 20260612120000_financeiro_manejo.sql.
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (não há etapa de migration no CI).

CREATE TABLE IF NOT EXISTS public.worker_assessments (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id       uuid,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_worker_assessments_org        ON public.worker_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_worker_assessments_org_active ON public.worker_assessments(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_worker_assessments_worker     ON public.worker_assessments(worker_id);

-- ── RLS (padrão 0020/0033: select por org, insert/update com role, delete bloqueado
--    — exclusão é soft delete via update de deleted_at) ──────────────────────────
ALTER TABLE public.worker_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_assessments FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS worker_assessments_select_own_org ON public.worker_assessments;
CREATE POLICY worker_assessments_select_own_org ON public.worker_assessments FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS worker_assessments_insert_with_role ON public.worker_assessments;
CREATE POLICY worker_assessments_insert_with_role ON public.worker_assessments FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS worker_assessments_update_role ON public.worker_assessments;
CREATE POLICY worker_assessments_update_role ON public.worker_assessments FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS worker_assessments_delete_blocked ON public.worker_assessments;
CREATE POLICY worker_assessments_delete_blocked ON public.worker_assessments FOR DELETE TO authenticated USING (false);



-- =====================================================================
-- >>> 20260623120000_security_role_guard.sql
-- =====================================================================

-- 20260623120000_security_role_guard.sql
-- #1 CRÍTICO — Impede escalonamento de privilégio via auto-edição de `profiles`.
--
-- A policy `profiles_update_self_or_manager` (0009_rls_core.sql) só valida
-- `organization_id` no WITH CHECK. Como RLS é por linha (não por coluna), o ramo
-- "self" (id = auth.uid()) permite ao próprio usuário alterar a coluna `role`
-- (ex.: virar 'owner'). Este trigger bloqueia a mudança de `role`/`organization_id`
-- da PRÓPRIA linha em chamadas diretas do cliente (role `authenticated`).
--
-- O trigger é SECURITY INVOKER de propósito: assim `current_user` reflete o papel
-- real do chamador. Funções SECURITY DEFINER (onboarding/provisionamento — ex.:
-- handle_new_user, signup_with_org) rodam como o dono do banco, então
-- `current_user <> 'authenticated'` e ficam ISENTAS. Gerente/diretor/owner
-- continuam podendo alterar o papel de OUTROS membros (NEW.id <> auth.uid()).
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.guard_profile_self_privilege()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
BEGIN
  IF current_user = 'authenticated'
     AND NEW.id = auth.uid()
     AND (
       NEW.role IS DISTINCT FROM OLD.role
       OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     ) THEN
    RAISE EXCEPTION 'Alteração do próprio papel ou organização não é permitida.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_self_privilege ON public.profiles;
CREATE TRIGGER trg_guard_profile_self_privilege
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_self_privilege();

COMMENT ON FUNCTION public.guard_profile_self_privilege() IS
  'Bloqueia auto-escalonamento de role/organization_id em profiles por usuários authenticated; SECURITY DEFINER (onboarding) fica isento.';



-- =====================================================================
-- >>> 20260626120000_rdo_estoque_hardening.sql
-- =====================================================================

-- 20260626120000_rdo_estoque_hardening.sql
-- Hardening do trigger sync_rdo_to_estoque (QA): (1) filtro extra de
-- organization_id no estorno (defesa em profundidade), (2) a falha de uma baixa
-- NÃO bloqueia mais o salvamento do RDO — registra em audit_log e segue.
--
-- Idempotente (CREATE OR REPLACE). O trigger trg_rdo_to_estoque já aponta para
-- esta função — não precisa recriar o trigger.
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (após a migration anterior).

CREATE OR REPLACE FUNCTION public.sync_rdo_to_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_mat     jsonb;
  v_item_id uuid;
  v_qty     numeric;
  v_mov     record;
BEGIN
  -- (a) ESTORNO (agora com filtro de organization_id — defesa extra)
  FOR v_mov IN
    SELECT id, item_id, quantidade
      FROM public.suprimentos_estoque_movimentacoes
     WHERE rdo_id = NEW.id AND origem = 'rdo' AND deleted_at IS NULL
       AND organization_id = NEW.organization_id
  LOOP
    UPDATE public.suprimentos_estoque_itens
       SET qtd_disponivel = qtd_disponivel + v_mov.quantidade
     WHERE id = v_mov.item_id AND organization_id = NEW.organization_id;
    UPDATE public.suprimentos_estoque_movimentacoes
       SET deleted_at = now()
     WHERE id = v_mov.id AND organization_id = NEW.organization_id;
  END LOOP;

  -- (b) Só regrava se o RDO está ativo e finalizado.
  IF NEW.deleted_at IS NOT NULL OR COALESCE(NEW.payload->>'status', '') <> 'finalizado' THEN
    RETURN NEW;
  END IF;

  -- (c) Regrava baixas (source='almoxarifado' + stockItemId). Uma falha numa
  --     baixa é registrada em audit_log e NÃO aborta o salvamento do RDO.
  FOR v_mat IN
    SELECT value FROM jsonb_array_elements(COALESCE(NEW.payload->'materials', '[]'::jsonb))
  LOOP
    CONTINUE WHEN COALESCE(v_mat->>'source', '') <> 'almoxarifado';
    CONTINUE WHEN COALESCE(v_mat->>'stockItemId', '') = '';
    v_qty := COALESCE(NULLIF(v_mat->>'quantity', '')::numeric, 0);
    CONTINUE WHEN v_qty <= 0;

    BEGIN
      v_item_id := (v_mat->>'stockItemId')::uuid;

      IF EXISTS (
        SELECT 1 FROM public.suprimentos_estoque_itens
         WHERE id = v_item_id AND organization_id = NEW.organization_id AND deleted_at IS NULL
      ) THEN
        UPDATE public.suprimentos_estoque_itens
           SET qtd_disponivel = qtd_disponivel - v_qty
         WHERE id = v_item_id AND organization_id = NEW.organization_id;

        INSERT INTO public.suprimentos_estoque_movimentacoes
          (organization_id, item_id, deposito_id, tipo, quantidade, data_movimento,
           origem, rdo_id, origem_ref, observacoes, created_by)
        VALUES
          (NEW.organization_id, v_item_id, NULLIF(v_mat->>'depositoId', '')::uuid,
           'saida', v_qty, NEW.date, 'rdo', NEW.id, v_mat->>'id',
           'Baixa via RDO #' || COALESCE(NEW.number::text, ''), v_uid);
      ELSE
        INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
        VALUES (NEW.organization_id, v_uid, 'rdo_material_unmatched', 'rdo', NEW.id::text,
                jsonb_build_object('material', v_mat->>'material', 'stockItemId', v_mat->>'stockItemId', 'quantity', v_qty));
      END IF;
    EXCEPTION WHEN others THEN
      -- Não bloqueia o RDO: registra a falha da baixa e continua.
      INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
      VALUES (NEW.organization_id, v_uid, 'rdo_estoque_baixa_failed', 'rdo', NEW.id::text,
              jsonb_build_object('stockItemId', v_mat->>'stockItemId', 'quantity', v_qty, 'error', SQLERRM));
    END;
  END LOOP;

  RETURN NEW;
END;
$$;



-- =====================================================================
-- >>> 20260627120000_obra_scoping_fase1.sql
-- =====================================================================

-- 20260627120000_obra_scoping_fase1.sql
-- Separação por obra — Fase 1 (RDO + Suprimentos + Mão de Obra).
-- Adiciona `site_id uuid` (= construction_sites.id) + índice por (org, site).
-- Dado legado fica NULL = "Todas as obras"; dado novo é carimbado pelo app.
-- RLS NÃO muda (obra é filtro de aplicação, não fronteira de segurança).
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.

DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'rdo',
    'suprimentos_depositos',
    'suprimentos_estoque_itens',
    'suprimentos_estoque_movimentacoes',
    'suprimentos_ordens',
    'purchase_orders',
    'goods_receipts',
    'invoices',
    'shifts',
    'worker_absences'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    -- só age se a tabela existir
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.construction_sites(id) ON DELETE SET NULL',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id, site_id) WHERE deleted_at IS NULL',
        'idx_' || t || '_org_site', t
      );
    END IF;
  END LOOP;
END $$;



-- =====================================================================
-- >>> 20260627130000_obra_scoping_fase2.sql
-- =====================================================================

-- 20260627130000_obra_scoping_fase2.sql
-- Separação por obra — Fase 2 (Qualidade). Financeiro já usa obra_id (sem migration).
-- Adiciona site_id em fvs + quality_non_conformities. Legado = NULL = "Todas as obras".
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.

DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY['fvs', 'quality_non_conformities'];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.construction_sites(id) ON DELETE SET NULL',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id, site_id) WHERE deleted_at IS NULL',
        'idx_' || t || '_org_site', t
      );
    END IF;
  END LOOP;
END $$;



-- =====================================================================
-- >>> 20260627140000_obra_scoping_fase3.sql
-- =====================================================================

-- 20260627140000_obra_scoping_fase3.sql
-- Separação por obra — Fase 3 (Equipamentos/Manutenções + Planejamento).
-- Idempotente. Legado = NULL = "Todas as obras". ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.
--
-- equipamentos.construction_site_id: já usado pelo manutencoesStore; garantido aqui (no-op se existir).
-- plan_trechos/plan_teams/plan_scenarios + maintenance_orders.site_id: consumidos na Fase 3b (Planejamento).
-- Pode aplicar de uma vez — colunas não usadas ainda ficam só disponíveis.

-- ── construction_site_id (mesmo nome já usado em equipamentos/manutenções) ──
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY['equipamentos', 'maintenance_orders'];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS construction_site_id uuid REFERENCES public.construction_sites(id) ON DELETE SET NULL',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id, construction_site_id)',
        'idx_' || t || '_org_site', t
      );
    END IF;
  END LOOP;
END $$;

-- ── site_id (padrão do resto dos módulos) para Planejamento ──
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY['plan_trechos', 'plan_teams', 'plan_scenarios'];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.construction_sites(id) ON DELETE SET NULL',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id, site_id)',
        'idx_' || t || '_org_site', t
      );
    END IF;
  END LOOP;
END $$;



-- =====================================================================
-- >>> 20260627150000_suprimentos_requisicoes_b2.sql
-- =====================================================================

-- 20260627150000_suprimentos_requisicoes_b2.sql
-- B2: Requisições do planejado (Quantitativos → Suprimentos).
-- RPC idempotente que transforma quantitativos_budgets.payload.items[] em
-- suprimentos_itens status='pend'. Re-rodar ATUALIZA (não duplica) via origem_ref.
-- Idempotente / seguro de reaplicar. ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.

-- 1) Colunas de origem para idempotência limpa por item de orçamento
ALTER TABLE public.suprimentos_itens ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE public.suprimentos_itens ADD COLUMN IF NOT EXISTS origem_ref text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sup_itens_origem
  ON public.suprimentos_itens(organization_id, origem, origem_ref)
  WHERE origem IS NOT NULL AND deleted_at IS NULL;

-- 2) RPC: gera/atualiza requisições a partir de um orçamento
CREATE OR REPLACE FUNCTION public.gerar_requisicoes_suprimentos(p_budget_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org      uuid;
  v_uid      uuid := auth.uid();
  v_budget   jsonb;
  v_item     jsonb;
  v_nucleo   uuid;
  v_rua      uuid;
  v_ref      text;
  v_existing uuid;
  v_qtd      numeric;
  v_created  int := 0;
  v_updated  int := 0;
  v_skipped  int := 0;
BEGIN
  -- Orçamento + checagem multi-tenant
  SELECT organization_id, payload INTO v_org, v_budget
  FROM public.quantitativos_budgets
  WHERE id = p_budget_id AND deleted_at IS NULL;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado';
  END IF;
  IF v_org IS DISTINCT FROM public.user_org() THEN
    RAISE EXCEPTION 'Acesso negado ao orçamento';
  END IF;

  -- Núcleo default "Planejamento" (cria se não existir)
  SELECT id INTO v_nucleo FROM public.suprimentos_nucleos
   WHERE organization_id = v_org AND nome = 'Planejamento' AND tipo = 'AG' AND deleted_at IS NULL
   LIMIT 1;
  IF v_nucleo IS NULL THEN
    INSERT INTO public.suprimentos_nucleos (organization_id, nome, tipo, created_by)
    VALUES (v_org, 'Planejamento', 'AG', v_uid)
    RETURNING id INTO v_nucleo;
  END IF;

  -- Rua default "Planejamento" sob o núcleo (cria se não existir)
  SELECT id INTO v_rua FROM public.suprimentos_ruas
   WHERE organization_id = v_org AND nucleo_id = v_nucleo AND nome = 'Planejamento' AND deleted_at IS NULL
   LIMIT 1;
  IF v_rua IS NULL THEN
    INSERT INTO public.suprimentos_ruas (organization_id, nucleo_id, nome, created_by)
    VALUES (v_org, v_nucleo, 'Planejamento', v_uid)
    RETURNING id INTO v_rua;
  END IF;

  -- Para cada item do orçamento: upsert idempotente por origem_ref
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_budget->'items', '[]'::jsonb)) LOOP
    IF COALESCE(v_item->>'description', '') = '' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_qtd := COALESCE(NULLIF(v_item->>'quantity', '')::numeric, 0);
    v_ref := p_budget_id::text || ':' || COALESCE(NULLIF(v_item->>'id', ''), md5(v_item->>'description'));

    SELECT id INTO v_existing FROM public.suprimentos_itens
     WHERE organization_id = v_org AND origem = 'quantitativos' AND origem_ref = v_ref AND deleted_at IS NULL
     LIMIT 1;

    IF v_existing IS NULL THEN
      INSERT INTO public.suprimentos_itens
        (organization_id, rua_id, material, unidade, quantidade, status, origem, origem_ref, payload, created_by)
      VALUES
        (v_org, v_rua, v_item->>'description', NULLIF(v_item->>'unit', ''), v_qtd, 'pend',
         'quantitativos', v_ref,
         jsonb_build_object('budget_id', p_budget_id, 'budget_item_id', v_item->>'id', 'code', v_item->>'code'),
         v_uid);
      v_created := v_created + 1;
    ELSE
      UPDATE public.suprimentos_itens
         SET quantidade = v_qtd,
             unidade    = NULLIF(v_item->>'unit', ''),
             material   = v_item->>'description',
             updated_at = now()
       WHERE id = v_existing;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('created', v_created, 'updated', v_updated, 'skipped', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_requisicoes_suprimentos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gerar_requisicoes_suprimentos(uuid) TO authenticated;



-- =====================================================================
-- >>> 20260628120000_db_indices_otimizacao.sql
-- =====================================================================

-- 20260628120000_db_indices_otimizacao.sql
-- Tier 2c: índices para o padrão de acesso quente "WHERE organization_id = … AND deleted_at IS NULL [AND site_id = …]".
-- Puramente aditivo + recria os índices construction_site_id da Fase 3 com o filtro parcial WHERE deleted_at IS NULL.
-- Idempotente / seguro de reaplicar. ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.

-- ── 1) Corrige os índices construction_site_id da Fase 3 (faltava WHERE deleted_at IS NULL) ──
-- O índice antigo indexava também linhas soft-deletadas. Recria como índice parcial.
-- DO-block com IF EXISTS: equipamentos sempre existe; maintenance_orders é no-op se ausente.
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY['equipamentos', 'maintenance_orders'];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='deleted_at') THEN
      EXECUTE format('DROP INDEX IF EXISTS public.%I', 'idx_' || t || '_org_site');
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id, construction_site_id) WHERE deleted_at IS NULL',
        'idx_' || t || '_org_site', t
      );
    END IF;
  END LOOP;
END $$;

-- ── 2) Índices parciais faltantes nas tabelas quentes (org + deleted_at) ──
-- suprimentos_itens/ruas/ordens têm índice (organization_id) cheio, mas não o parcial.
CREATE INDEX IF NOT EXISTS idx_suprimentos_itens_org_active
  ON public.suprimentos_itens(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suprimentos_ruas_org_active
  ON public.suprimentos_ruas(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suprimentos_ordens_org_active
  ON public.suprimentos_ordens(organization_id) WHERE deleted_at IS NULL;

-- Movimentações de estoque: consulta típica é por org + data desc.
CREATE INDEX IF NOT EXISTS idx_sup_est_mov_org_data
  ON public.suprimentos_estoque_movimentacoes(organization_id, data_movimento DESC) WHERE deleted_at IS NULL;

-- Mão de obra: shifts e faltas são consultados por org + data.
CREATE INDEX IF NOT EXISTS idx_shifts_org_date
  ON public.shifts(organization_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_worker_absences_org_date
  ON public.worker_absences(organization_id, date DESC) WHERE deleted_at IS NULL;



-- =====================================================================
-- >>> 20260628130000_baixa_estoque_atomica.sql
-- =====================================================================

-- 20260628130000_baixa_estoque_atomica.sql
-- Tier 1b: baixa de estoque MANUAL atômica no servidor (evita last-write-wins).
-- Antes: o cliente lia qtd_disponivel, calculava o novo saldo e mandava o valor absoluto —
-- dois usuários baixando o mesmo item ao mesmo tempo perdiam uma baixa.
-- Agora: subtração atômica no servidor (qtd_disponivel = qtd_disponivel - p_qtd) + movimentação.
-- (O caminho do RDO já era atômico via trigger sync_rdo_to_estoque.)
-- Idempotente. ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.baixar_estoque_item(
  p_item_id         uuid,
  p_qtd             numeric,
  p_lps_activity_id text DEFAULT NULL,
  p_observacoes     text DEFAULT NULL,
  p_site_id         uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org      uuid := public.user_org();
  v_uid      uuid := auth.uid();
  v_deposito uuid;
  v_new      numeric;
BEGIN
  IF p_qtd IS NULL OR p_qtd <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida (deve ser > 0)';
  END IF;

  -- Subtração atômica. Sem clamp em 0: saldo negativo é alerta de inventário
  -- (o material já saiu fisicamente), tratado na UI — não bloqueia a baixa.
  UPDATE public.suprimentos_estoque_itens
     SET qtd_disponivel = qtd_disponivel - p_qtd,
         updated_at = now()
   WHERE id = p_item_id
     AND organization_id = v_org
     AND deleted_at IS NULL
   RETURNING qtd_disponivel, deposito_id INTO v_new, v_deposito;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de estoque não encontrado na sua organização';
  END IF;

  INSERT INTO public.suprimentos_estoque_movimentacoes
    (organization_id, item_id, deposito_id, tipo, quantidade, data_movimento,
     lps_activity_id, observacoes, origem, site_id, created_by)
  VALUES
    (v_org, p_item_id, v_deposito, 'saida', p_qtd, current_date,
     p_lps_activity_id, p_observacoes, 'manual', p_site_id, v_uid);

  RETURN jsonb_build_object('qtd_disponivel', v_new, 'deposito_id', v_deposito);
END;
$$;

-- FORCE RLS está ligado em suprimentos_estoque_movimentacoes; a função SECURITY DEFINER
-- ainda passa pelas policies com o contexto do chamador. Política de INSERT para origem='manual'
-- (espelha sup_est_mov_insert_rdo) — permite a baixa sem depender de papel de compras.
DROP POLICY IF EXISTS sup_est_mov_insert_manual ON public.suprimentos_estoque_movimentacoes;
CREATE POLICY sup_est_mov_insert_manual ON public.suprimentos_estoque_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND origem = 'manual'
    AND created_by = auth.uid()
  );

REVOKE ALL  ON FUNCTION public.baixar_estoque_item(uuid, numeric, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.baixar_estoque_item(uuid, numeric, text, text, uuid) TO authenticated;



-- =====================================================================
-- >>> 20260702120000_plano_execucao.sql
-- =====================================================================

-- 20260702120000_plano_execucao.sql
-- "Planejamento de Execução" (modo Compizzo) — Fase 1.
-- 1 tabela com o cabeçalho em colunas + payload jsonb (cronograma/equipe/bonificação/condições).
-- Multi-tenant por organization_id + site_id (obra). Soft-delete (deleted_at) via UPDATE.
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (testar em homologação antes de produção).

CREATE TABLE IF NOT EXISTS public.plano_execucao (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id              uuid          REFERENCES public.construction_sites(id) ON DELETE SET NULL,
  periodo_inicio       date,
  periodo_fim          date,
  area_m2              numeric(14,2) NOT NULL DEFAULT 0,
  servico              text,
  preco_m2             numeric(14,4) NOT NULL DEFAULT 0,
  faturamento_previsto numeric(16,2) NOT NULL DEFAULT 0,
  status               text          NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','ativo','concluido')),
  payload              jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_by           uuid          NOT NULL REFERENCES auth.users(id),
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE INDEX IF NOT EXISTS idx_plano_execucao_org
  ON public.plano_execucao(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_plano_execucao_org_site
  ON public.plano_execucao(organization_id, site_id) WHERE deleted_at IS NULL;

-- updated_at automático (função já existente no schema)
DROP TRIGGER IF EXISTS trg_plano_execucao_updated_at ON public.plano_execucao;
CREATE TRIGGER trg_plano_execucao_updated_at
  BEFORE UPDATE ON public.plano_execucao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──
ALTER TABLE public.plano_execucao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_execucao FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plano_execucao_select_own_org ON public.plano_execucao;
CREATE POLICY plano_execucao_select_own_org ON public.plano_execucao
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.user_org()) AND deleted_at IS NULL);

-- INSERT: apenas na própria org e como o próprio usuário (isolamento = organização).
-- O papel de quem pode editar é controlado na UI; a fronteira de segurança é a org.
DROP POLICY IF EXISTS plano_execucao_insert_own_org ON public.plano_execucao;
CREATE POLICY plano_execucao_insert_own_org ON public.plano_execucao
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.user_org()) AND created_by = auth.uid());

-- UPDATE: própria org (inclui o soft-delete que seta deleted_at).
DROP POLICY IF EXISTS plano_execucao_update_own_org ON public.plano_execucao;
CREATE POLICY plano_execucao_update_own_org ON public.plano_execucao
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT public.user_org()))
  WITH CHECK (organization_id = (SELECT public.user_org()));

-- DELETE bloqueado (usa soft-delete via UPDATE deleted_at).
DROP POLICY IF EXISTS plano_execucao_delete_blocked ON public.plano_execucao;
CREATE POLICY plano_execucao_delete_blocked ON public.plano_execucao
  FOR DELETE TO authenticated USING (false);



-- =====================================================================
-- >>> 20260704120000_clt_settings.sql
-- =====================================================================

-- 20260704120000_clt_settings.sql
-- Configurações CLT / produtividade por organização (inclui a meta TCPO de RUP).
-- 1 linha por organização (id = organization_id), payload jsonb com o objeto CLTSettings.
-- Multi-tenant por organization_id. Upsert idempotente (onConflict id) pelo engine de sync.
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (testar em homologação antes de produção).

CREATE TABLE IF NOT EXISTS public.clt_settings (
  id               uuid        PRIMARY KEY,   -- = organization_id (1 linha por org)
  organization_id  uuid        NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  payload          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_by       uuid        NOT NULL REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_clt_settings_org
  ON public.clt_settings(organization_id) WHERE deleted_at IS NULL;

-- updated_at automático (função já existente no schema)
DROP TRIGGER IF EXISTS trg_clt_settings_updated_at ON public.clt_settings;
CREATE TRIGGER trg_clt_settings_updated_at
  BEFORE UPDATE ON public.clt_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──
ALTER TABLE public.clt_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clt_settings FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clt_settings_select_own_org ON public.clt_settings;
CREATE POLICY clt_settings_select_own_org ON public.clt_settings
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.user_org()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS clt_settings_insert_own_org ON public.clt_settings;
CREATE POLICY clt_settings_insert_own_org ON public.clt_settings
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.user_org()) AND created_by = auth.uid());

DROP POLICY IF EXISTS clt_settings_update_own_org ON public.clt_settings;
CREATE POLICY clt_settings_update_own_org ON public.clt_settings
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT public.user_org()))
  WITH CHECK (organization_id = (SELECT public.user_org()));

DROP POLICY IF EXISTS clt_settings_delete_blocked ON public.clt_settings;
CREATE POLICY clt_settings_delete_blocked ON public.clt_settings
  FOR DELETE TO authenticated USING (false);



-- =====================================================================
-- >>> 20260706120000_servicos.sql
-- =====================================================================

-- 20260706120000_servicos.sql
-- Catálogo de Serviços por organização (Planejamento de Execução / construção civil).
-- Colunas de cabeçalho (nome, unidade) + payload jsonb com o objeto Servico completo
-- (rendimento, rendimentoBase, custoDiaPessoa). Multi-tenant por organization_id.
-- Soft-delete (deleted_at) via UPDATE. Espelha plano_execucao.
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (testar em homologação antes de produção).

CREATE TABLE IF NOT EXISTS public.servicos (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome             text,
  unidade          text,
  payload          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_by       uuid        NOT NULL REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_servicos_org
  ON public.servicos(organization_id) WHERE deleted_at IS NULL;

-- updated_at automático (função já existente no schema)
DROP TRIGGER IF EXISTS trg_servicos_updated_at ON public.servicos;
CREATE TRIGGER trg_servicos_updated_at
  BEFORE UPDATE ON public.servicos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicos_select_own_org ON public.servicos;
CREATE POLICY servicos_select_own_org ON public.servicos
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.user_org()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS servicos_insert_own_org ON public.servicos;
CREATE POLICY servicos_insert_own_org ON public.servicos
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.user_org()) AND created_by = auth.uid());

DROP POLICY IF EXISTS servicos_update_own_org ON public.servicos;
CREATE POLICY servicos_update_own_org ON public.servicos
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT public.user_org()))
  WITH CHECK (organization_id = (SELECT public.user_org()));

DROP POLICY IF EXISTS servicos_delete_blocked ON public.servicos;
CREATE POLICY servicos_delete_blocked ON public.servicos
  FOR DELETE TO authenticated USING (false);



-- =====================================================================
-- >>> 20260716120000_estoque_metadata.sql
-- =====================================================================

-- Estoque: coluna flexível `metadata` (jsonb) para campos opcionais do item
-- (ex.: codigoReferencia, dataUltimoPedido). Assim campo novo de estoque não pede mais migração.
-- Nullable com default '{}'; itens antigos ficam '{}'.
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção) ANTES de subir o código.

ALTER TABLE public.suprimentos_estoque_itens
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;



-- =====================================================================
-- >>> 20260722120000_rdo_site_id_insurance.sql
-- =====================================================================

-- RDO: garante a coluna `site_id` na tabela `public.rdo`.
-- Ela foi introduzida em 20260627120000_obra_scoping_fase1.sql (marcada "APLICAR
-- MANUALMENTE"). Se aquela migração não tiver sido aplicada em produção, TODO
-- INSERT de RDO falha (PGRST204 "column site_id not found") → o save fica preso
-- em "não sincronizado". Esta reexecução é idempotente (no-op se já existir).
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção) ANTES de subir o código.

ALTER TABLE public.rdo
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.construction_sites(id) ON DELETE SET NULL;



-- =====================================================================
-- >>> 20260722130000_rdo_photos_bucket.sql
-- =====================================================================

-- RDO (Compizzo/normal): bucket privado `rdo-photos` para as fotos do relatório.
-- Antes as fotos iam em base64 dentro do payload jsonb (estourava localStorage e
-- inflava o banco). Agora sobem como arquivo e o RDO guarda só o caminho.
-- RLS por organização: a pasta raiz do objeto é o organization_id (user_org()).
-- Espelha o padrão de `obra-levantamentos` / `rdo-sabesp-photos`.
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção) ANTES de subir o código.

insert into storage.buckets (id, name, public)
values ('rdo-photos', 'rdo-photos', false)
on conflict (id) do nothing;

drop policy if exists "rdo_photos_storage_select" on storage.objects;
drop policy if exists "rdo_photos_storage_insert" on storage.objects;
drop policy if exists "rdo_photos_storage_update" on storage.objects;
drop policy if exists "rdo_photos_storage_delete" on storage.objects;

create policy "rdo_photos_storage_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'rdo-photos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "rdo_photos_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'rdo-photos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "rdo_photos_storage_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'rdo-photos'
    and (storage.foldername(name))[1] = public.user_org()::text
  )
  with check (
    bucket_id = 'rdo-photos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "rdo_photos_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'rdo-photos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );
