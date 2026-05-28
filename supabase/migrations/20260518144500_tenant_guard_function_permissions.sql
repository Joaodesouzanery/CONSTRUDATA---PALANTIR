-- Keep the tenant guard available only as a trigger implementation.
-- Direct RPC execution is unnecessary and should not be exposed.

CREATE OR REPLACE FUNCTION public.enforce_suprimentos_almoxarifado_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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
REVOKE ALL ON FUNCTION public.enforce_suprimentos_almoxarifado_tenant() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_suprimentos_almoxarifado_tenant() FROM authenticated;
