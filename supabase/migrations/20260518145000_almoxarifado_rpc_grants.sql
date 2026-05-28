-- Soft-delete RPCs are app actions and must require an authenticated user.

REVOKE ALL ON FUNCTION public.soft_delete_suprimentos_deposito(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_suprimentos_deposito(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_suprimentos_deposito(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.soft_delete_suprimentos_estoque_item(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_suprimentos_estoque_item(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_suprimentos_estoque_item(uuid) TO authenticated;
