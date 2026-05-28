-- Tenant-safe hardening for Suprimentos / Almoxarifado.
-- Fixes two urgent classes of bugs:
-- 1) soft-deleted rows reappearing because SELECT policies were loosened;
-- 2) records from another organization leaking through stale client cache or
--    inconsistent deposito/item links.

ALTER TABLE public.suprimentos_depositos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suprimentos_estoque_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suprimentos_estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.suprimentos_depositos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.suprimentos_estoque_itens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.suprimentos_estoque_movimentacoes FORCE ROW LEVEL SECURITY;

-- SELECT must never expose deleted rows. The delete RPCs below return their own
-- ids, so PostgREST no longer needs broad SELECT visibility to confirm deletion.
DROP POLICY IF EXISTS sup_dep_select_own_org ON public.suprimentos_depositos;
CREATE POLICY sup_dep_select_own_org ON public.suprimentos_depositos
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS sup_est_itens_select_own_org ON public.suprimentos_estoque_itens;
CREATE POLICY sup_est_itens_select_own_org ON public.suprimentos_estoque_itens
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS sup_est_mov_select_own_org ON public.suprimentos_estoque_movimentacoes;
CREATE POLICY sup_est_mov_select_own_org ON public.suprimentos_estoque_movimentacoes
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS sup_dep_insert_with_role ON public.suprimentos_depositos;
CREATE POLICY sup_dep_insert_with_role ON public.suprimentos_depositos
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['comprador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS sup_dep_update_own_org ON public.suprimentos_depositos;
CREATE POLICY sup_dep_update_own_org ON public.suprimentos_depositos
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS sup_dep_delete_blocked ON public.suprimentos_depositos;
CREATE POLICY sup_dep_delete_blocked ON public.suprimentos_depositos
  FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS sup_est_itens_insert_with_role ON public.suprimentos_estoque_itens;
CREATE POLICY sup_est_itens_insert_with_role ON public.suprimentos_estoque_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['comprador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS sup_est_itens_update_own_org ON public.suprimentos_estoque_itens;
CREATE POLICY sup_est_itens_update_own_org ON public.suprimentos_estoque_itens
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS sup_est_itens_delete_blocked ON public.suprimentos_estoque_itens;
CREATE POLICY sup_est_itens_delete_blocked ON public.suprimentos_estoque_itens
  FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS sup_est_mov_insert_with_role ON public.suprimentos_estoque_movimentacoes;
CREATE POLICY sup_est_mov_insert_with_role ON public.suprimentos_estoque_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['comprador','engenheiro','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS sup_est_mov_update_own_org ON public.suprimentos_estoque_movimentacoes;
CREATE POLICY sup_est_mov_update_own_org ON public.suprimentos_estoque_movimentacoes
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS sup_est_mov_delete_blocked ON public.suprimentos_estoque_movimentacoes;
CREATE POLICY sup_est_mov_delete_blocked ON public.suprimentos_estoque_movimentacoes
  FOR DELETE TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.enforce_suprimentos_almoxarifado_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_org uuid;
  v_item_deposito uuid;
  v_deposito_org uuid;
BEGIN
  IF TG_TABLE_NAME = 'suprimentos_estoque_itens' THEN
    IF NEW.deposito_id IS NOT NULL THEN
      SELECT d.organization_id
        INTO v_deposito_org
      FROM public.suprimentos_depositos d
      WHERE d.id = NEW.deposito_id;

      IF v_deposito_org IS NULL OR v_deposito_org <> NEW.organization_id THEN
        RAISE EXCEPTION 'Deposito % nao pertence a organizacao %.', NEW.deposito_id, NEW.organization_id
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'suprimentos_estoque_movimentacoes' THEN
    SELECT i.organization_id, i.deposito_id
      INTO v_item_org, v_item_deposito
    FROM public.suprimentos_estoque_itens i
    WHERE i.id = NEW.item_id;

    IF v_item_org IS NULL OR v_item_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'Item % nao pertence a organizacao %.', NEW.item_id, NEW.organization_id
        USING ERRCODE = '23514';
    END IF;

    IF NEW.deposito_id IS NOT NULL THEN
      SELECT d.organization_id
        INTO v_deposito_org
      FROM public.suprimentos_depositos d
      WHERE d.id = NEW.deposito_id;

      IF v_deposito_org IS NULL OR v_deposito_org <> NEW.organization_id THEN
        RAISE EXCEPTION 'Deposito % nao pertence a organizacao %.', NEW.deposito_id, NEW.organization_id
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF NEW.deposito_id IS NULL AND v_item_deposito IS NOT NULL THEN
      NEW.deposito_id := v_item_deposito;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_suprimentos_almoxarifado_tenant() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_sup_est_itens_tenant_guard ON public.suprimentos_estoque_itens;
CREATE TRIGGER trg_sup_est_itens_tenant_guard
  BEFORE INSERT OR UPDATE OF organization_id, deposito_id
  ON public.suprimentos_estoque_itens
  FOR EACH ROW EXECUTE FUNCTION public.enforce_suprimentos_almoxarifado_tenant();

DROP TRIGGER IF EXISTS trg_sup_est_mov_tenant_guard ON public.suprimentos_estoque_movimentacoes;
CREATE TRIGGER trg_sup_est_mov_tenant_guard
  BEFORE INSERT OR UPDATE OF organization_id, item_id, deposito_id
  ON public.suprimentos_estoque_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_suprimentos_almoxarifado_tenant();

CREATE OR REPLACE FUNCTION public.soft_delete_suprimentos_deposito(p_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_deleted_at timestamptz := now();
  v_id uuid;
BEGIN
  v_org := public.user_org();

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Organizacao ativa nao encontrada para o usuario atual.';
  END IF;

  UPDATE public.suprimentos_depositos d
     SET deleted_at = v_deleted_at,
         ativo = false,
         updated_at = v_deleted_at
   WHERE d.id = p_id
     AND d.organization_id = v_org
     AND d.deleted_at IS NULL
  RETURNING d.id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Deposito % nao encontrado, ja excluido ou fora da organizacao ativa.', p_id;
  END IF;

  UPDATE public.suprimentos_estoque_itens i
     SET deleted_at = v_deleted_at,
         updated_at = v_deleted_at
   WHERE i.deposito_id = p_id
     AND i.organization_id = v_org
     AND i.deleted_at IS NULL;

  UPDATE public.suprimentos_estoque_movimentacoes m
     SET deleted_at = v_deleted_at,
         updated_at = v_deleted_at
   WHERE m.deposito_id = p_id
     AND m.organization_id = v_org
     AND m.deleted_at IS NULL;

  id := v_id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_suprimentos_estoque_item(p_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_deleted_at timestamptz := now();
  v_id uuid;
BEGIN
  v_org := public.user_org();

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Organizacao ativa nao encontrada para o usuario atual.';
  END IF;

  UPDATE public.suprimentos_estoque_itens i
     SET deleted_at = v_deleted_at,
         updated_at = v_deleted_at
   WHERE i.id = p_id
     AND i.organization_id = v_org
     AND i.deleted_at IS NULL
  RETURNING i.id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Item de estoque % nao encontrado, ja excluido ou fora da organizacao ativa.', p_id;
  END IF;

  UPDATE public.suprimentos_estoque_movimentacoes m
     SET deleted_at = v_deleted_at,
         updated_at = v_deleted_at
   WHERE m.item_id = p_id
     AND m.organization_id = v_org
     AND m.deleted_at IS NULL;

  id := v_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_suprimentos_deposito(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_suprimentos_estoque_item(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.soft_delete_suprimentos_deposito(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_suprimentos_estoque_item(uuid) TO authenticated;
