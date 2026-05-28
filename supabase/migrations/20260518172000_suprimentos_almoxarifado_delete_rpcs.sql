-- Exclusao confiavel do Almoxarifado.
-- Evita "sucesso" visual quando RLS/PostgREST nao confirma a linha alterada.

CREATE OR REPLACE FUNCTION public.soft_delete_suprimentos_deposito(p_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_deleted_at timestamptz := now();
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
  RETURNING d.id INTO id;

  IF id IS NULL THEN
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
  RETURNING i.id INTO id;

  IF id IS NULL THEN
    RAISE EXCEPTION 'Item de estoque % nao encontrado, ja excluido ou fora da organizacao ativa.', p_id;
  END IF;

  UPDATE public.suprimentos_estoque_movimentacoes m
     SET deleted_at = v_deleted_at,
         updated_at = v_deleted_at
   WHERE m.item_id = p_id
     AND m.organization_id = v_org
     AND m.deleted_at IS NULL;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_suprimentos_deposito(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_suprimentos_estoque_item(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.soft_delete_suprimentos_deposito(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_suprimentos_estoque_item(uuid) TO authenticated;
