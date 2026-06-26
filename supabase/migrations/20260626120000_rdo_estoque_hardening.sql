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
