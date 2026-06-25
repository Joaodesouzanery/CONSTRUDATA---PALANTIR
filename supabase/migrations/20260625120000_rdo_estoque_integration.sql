-- 20260625120000_rdo_estoque_integration.sql
-- Fase 1 — Integração RDO → Estoque: baixa de material IDEMPOTENTE e server-side.
--
-- Hoje a baixa é feita no cliente ([NovoRdoPanel] consumirMaterial no submit) e
-- NÃO é idempotente: salvar/editar o RDO duplica a baixa, e a movimentação fica
-- órfã (sem vínculo com o RDO). Este trigger move a baixa para o servidor com
-- reconciliação por `rdo_id` (estorna o que havia + regrava do payload atual).
--
-- ⚠️⚠️ APLICAR PRIMEIRO EM HOMOLOGAÇÃO E TESTAR (roteiro no fim do arquivo) ANTES
--     de produção. É um trigger que MUTA SALDO DE ESTOQUE. No MESMO deploy,
--     remover a baixa client-side em NovoRdoPanel (senão a baixa acontece 2×).

-- ── 1. Colunas de rastreabilidade/idempotência ──────────────────────────────
ALTER TABLE public.suprimentos_estoque_movimentacoes ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE public.suprimentos_estoque_movimentacoes ADD COLUMN IF NOT EXISTS rdo_id uuid;
ALTER TABLE public.suprimentos_estoque_movimentacoes ADD COLUMN IF NOT EXISTS origem_ref text;
CREATE INDEX IF NOT EXISTS idx_sup_mov_rdo
  ON public.suprimentos_estoque_movimentacoes(rdo_id)
  WHERE origem = 'rdo' AND deleted_at IS NULL;

-- ── 2. Policy de INSERT para baixas de origem 'rdo' ─────────────────────────
-- A tabela tem FORCE RLS; a policy de INSERT existente exige has_role(comprador..).
-- A baixa do RDO é autorizada pelo ato de finalizar o RDO (engenheiro/encarregado
-- de campo), não pelo papel de comprador. Esta policy permite o INSERT do trigger
-- (origem='rdo', própria org, próprio usuário) sem exigir papel de compras.
DROP POLICY IF EXISTS sup_est_mov_insert_rdo ON public.suprimentos_estoque_movimentacoes;
CREATE POLICY sup_est_mov_insert_rdo ON public.suprimentos_estoque_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND origem = 'rdo'
    AND created_by = auth.uid()
  );

-- ── 3. Função de reconciliação RDO → estoque ────────────────────────────────
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
  -- (a) ESTORNO: devolve ao estoque e soft-deleta TODAS as movimentações ativas
  --     origem='rdo' deste RDO. Cobre re-save (regrava igual), edição (estorna+
  --     aplica novo), remoção de material (estorna) e soft-delete do RDO.
  FOR v_mov IN
    SELECT id, item_id, quantidade
      FROM public.suprimentos_estoque_movimentacoes
     WHERE rdo_id = NEW.id AND origem = 'rdo' AND deleted_at IS NULL
  LOOP
    UPDATE public.suprimentos_estoque_itens
       SET qtd_disponivel = qtd_disponivel + v_mov.quantidade
     WHERE id = v_mov.item_id AND organization_id = NEW.organization_id;
    UPDATE public.suprimentos_estoque_movimentacoes
       SET deleted_at = now()
     WHERE id = v_mov.id;
  END LOOP;

  -- (b) Só REGRAVA se o RDO está ativo e finalizado (status no payload; a coluna
  --     `closed` é hardcoded true e não serve). Rascunho/excluído não baixa.
  IF NEW.deleted_at IS NOT NULL OR COALESCE(NEW.payload->>'status', '') <> 'finalizado' THEN
    RETURN NEW;
  END IF;

  -- (c) REGRAVA baixas a partir de payload.materials (source='almoxarifado' + stockItemId).
  FOR v_mat IN
    SELECT value FROM jsonb_array_elements(COALESCE(NEW.payload->'materials', '[]'::jsonb))
  LOOP
    CONTINUE WHEN COALESCE(v_mat->>'source', '') <> 'almoxarifado';
    CONTINUE WHEN COALESCE(v_mat->>'stockItemId', '') = '';
    v_qty := COALESCE(NULLIF(v_mat->>'quantity', '')::numeric, 0);
    CONTINUE WHEN v_qty <= 0;

    BEGIN
      v_item_id := (v_mat->>'stockItemId')::uuid;
    EXCEPTION WHEN others THEN
      CONTINUE; -- stockItemId malformado
    END;

    IF EXISTS (
      SELECT 1 FROM public.suprimentos_estoque_itens
       WHERE id = v_item_id AND organization_id = NEW.organization_id AND deleted_at IS NULL
    ) THEN
      -- decremento atômico (saldo pode ir negativo de propósito: sinaliza déficit)
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
      -- material 'almoxarifado' sem item de catálogo válido: registra e segue
      INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
      VALUES (NEW.organization_id, v_uid, 'rdo_material_unmatched', 'rdo', NEW.id::text,
              jsonb_build_object('material', v_mat->>'material', 'stockItemId', v_mat->>'stockItemId', 'quantity', v_qty));
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rdo_to_estoque ON public.rdo;
CREATE TRIGGER trg_rdo_to_estoque
  AFTER INSERT OR UPDATE ON public.rdo
  FOR EACH ROW EXECUTE FUNCTION public.sync_rdo_to_estoque();

COMMENT ON FUNCTION public.sync_rdo_to_estoque() IS
  'Baixa idempotente de estoque a partir do RDO finalizado (reconcilia por rdo_id).';

-- ════════════════════════════════════════════════════════════════════════════
-- ROTEIRO DE TESTE (rodar em HOMOLOGAÇÃO antes de produção)
--  1. Item com qtd_disponivel=100. RDO status='finalizado', material
--     source='almoxarifado', stockItemId=<item>, quantity=10 → saldo 90, 1 mov saida origem='rdo'.
--  2. UPDATE no RDO sem mudar materiais → saldo continua 90 (estorna+regrava = idempotente).
--  3. Editar quantity p/ 25 → saldo 75; mov antiga soft-deleted; nova com 25.
--  4. Remover o material do payload → estorna; saldo volta a 100.
--  5. Soft-delete do RDO (deleted_at) → estorna; saldo volta a 100.
--  6. source='compra_direta' → nenhuma baixa.
--  7. almoxarifado sem stockItemId → nenhuma baixa + linha em audit_log 'rdo_material_unmatched'.
--  8. RDO de outra org não toca itens desta (organization_id no WHERE).
-- ════════════════════════════════════════════════════════════════════════════
