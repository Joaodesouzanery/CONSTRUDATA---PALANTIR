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
