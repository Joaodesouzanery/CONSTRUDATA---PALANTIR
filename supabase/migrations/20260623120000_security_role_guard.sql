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
