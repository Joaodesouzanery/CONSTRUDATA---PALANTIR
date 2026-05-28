-- 0008_helpers.sql
-- Funções auxiliares usadas nas policies de RLS e nas RPCs.
-- Todas SECURITY DEFINER para conseguirem ler profiles sem caírem na própria policy.

-- Retorna o organization_id do usuário autenticado.
CREATE OR REPLACE FUNCTION public.user_org()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$;

-- Retorna o role do usuário autenticado.
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$;

-- Verifica se o usuário tem um dos roles passados.
CREATE OR REPLACE FUNCTION public.has_role(roles public.user_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND deleted_at IS NULL AND role = ANY(roles)
  );
$$;

-- Lê a matriz de aprovação da org do usuário e retorna o role mínimo necessário
-- para aprovar uma ação. Default 'diretor' se a action não estiver mapeada.
CREATE OR REPLACE FUNCTION public.required_approver_for(action text)
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (
      SELECT (settings->'approval_matrix'->>action)::public.user_role
      FROM public.organizations
      WHERE id = public.user_org()
    ),
    'diretor'::public.user_role
  );
$$;

-- ─── Grants ───────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.user_org()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role()                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(public.user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.required_approver_for(text) TO authenticated;
