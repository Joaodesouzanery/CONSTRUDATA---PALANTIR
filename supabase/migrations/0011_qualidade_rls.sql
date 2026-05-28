-- 0011_qualidade_rls.sql
-- RLS para o módulo Qualidade (FVS).

ALTER TABLE public.fvs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fvs FORCE  ROW LEVEL SECURITY;

-- SELECT: própria org, não soft-deleted
DROP POLICY IF EXISTS fvs_select_own_org ON public.fvs;
CREATE POLICY fvs_select_own_org ON public.fvs
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

-- INSERT: roles operacionais ou superiores podem criar FVS
DROP POLICY IF EXISTS fvs_insert_with_role ON public.fvs;
CREATE POLICY fvs_insert_with_role ON public.fvs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  );

-- UPDATE: o autor pode editar livremente enquanto não fechada;
-- gerente+ pode editar não-fechada;
-- FVS fechada (closed=true) só pode ser editada via fluxo de aprovação (RPC).
DROP POLICY IF EXISTS fvs_update_author_or_manager ON public.fvs;
CREATE POLICY fvs_update_author_or_manager ON public.fvs
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND closed = false
    AND (
      created_by = auth.uid()
      OR public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[])
    )
  )
  WITH CHECK (organization_id = public.user_org());

-- DELETE direto bloqueado: deve passar pelo fluxo de aprovação.
-- Usar RPC request_action('delete_fvs', 'fvs', id, {}).
DROP POLICY IF EXISTS fvs_delete_blocked ON public.fvs;
CREATE POLICY fvs_delete_blocked ON public.fvs
  FOR DELETE TO authenticated
  USING (false);
