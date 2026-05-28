-- 0009_rls_core.sql
-- Habilita Row-Level Security em TODAS as tabelas core e cria as policies.
-- Princípio: tenant isolation por organization_id; nada vazá entre orgs.

-- ════════════════════════════════════════════════════════════════════════
-- ORGANIZATIONS
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select_own ON public.organizations;
CREATE POLICY organizations_select_own ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.user_org() AND deleted_at IS NULL);

-- INSERT bloqueado via policy normal: novas orgs são criadas via RPC signup_with_org()
-- (SECURITY DEFINER), porque o usuário ainda não tem profile no momento do signup.
DROP POLICY IF EXISTS organizations_insert_blocked ON public.organizations;
CREATE POLICY organizations_insert_blocked ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS organizations_update_owner ON public.organizations;
CREATE POLICY organizations_update_owner ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = public.user_org() AND public.has_role(ARRAY['owner']::public.user_role[]))
  WITH CHECK (id = public.user_org());

DROP POLICY IF EXISTS organizations_delete_owner ON public.organizations;
CREATE POLICY organizations_delete_owner ON public.organizations
  FOR DELETE TO authenticated
  USING (id = public.user_org() AND public.has_role(ARRAY['owner']::public.user_role[]));

-- ════════════════════════════════════════════════════════════════════════
-- PROFILES
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE  ROW LEVEL SECURITY;

-- SELECT: qualquer membro vê todos os profiles da própria org
DROP POLICY IF EXISTS profiles_select_own_org ON public.profiles;
CREATE POLICY profiles_select_own_org ON public.profiles
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

-- INSERT: bloqueado por policy. Novos profiles vêm de signup_with_org() ou trigger.
DROP POLICY IF EXISTS profiles_insert_blocked ON public.profiles;
CREATE POLICY profiles_insert_blocked ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- UPDATE: o próprio usuário pode editar dados pessoais; gerente+ pode editar role/job_title
DROP POLICY IF EXISTS profiles_update_self_or_manager ON public.profiles;
CREATE POLICY profiles_update_self_or_manager ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND (
      id = auth.uid()
      OR public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[])
    )
  )
  WITH CHECK (organization_id = public.user_org());

-- DELETE: só owner (e ainda assim soft-delete via RPC)
DROP POLICY IF EXISTS profiles_delete_owner ON public.profiles;
CREATE POLICY profiles_delete_owner ON public.profiles
  FOR DELETE TO authenticated
  USING (
    organization_id = public.user_org()
    AND public.has_role(ARRAY['owner']::public.user_role[])
    AND id != auth.uid()  -- nunca deletar a si mesmo
  );

-- ════════════════════════════════════════════════════════════════════════
-- INVITATIONS
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invitations_select_own_org ON public.invitations;
CREATE POLICY invitations_select_own_org ON public.invitations
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org());

DROP POLICY IF EXISTS invitations_insert_manager ON public.invitations;
CREATE POLICY invitations_insert_manager ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[])
    AND invited_by = auth.uid()
  );

DROP POLICY IF EXISTS invitations_delete_manager ON public.invitations;
CREATE POLICY invitations_delete_manager ON public.invitations
  FOR DELETE TO authenticated
  USING (
    organization_id = public.user_org()
    AND public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[])
  );

-- ════════════════════════════════════════════════════════════════════════
-- AUDIT_LOG (append-only — nenhum UPDATE/DELETE permitido)
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_select_own_org ON public.audit_log;
CREATE POLICY audit_select_own_org ON public.audit_log
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org());

DROP POLICY IF EXISTS audit_insert_self ON public.audit_log;
CREATE POLICY audit_insert_self ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND (actor_id IS NULL OR actor_id = auth.uid())
  );

-- DELIBERADAMENTE: nenhuma policy de UPDATE/DELETE. audit_log é imutável.

-- ════════════════════════════════════════════════════════════════════════
-- PENDING_ACTIONS
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_actions FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pending_select_own_org ON public.pending_actions;
CREATE POLICY pending_select_own_org ON public.pending_actions
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org());

-- INSERT só via RPC request_action() (SECURITY DEFINER); bloqueado direto.
DROP POLICY IF EXISTS pending_insert_blocked ON public.pending_actions;
CREATE POLICY pending_insert_blocked ON public.pending_actions
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- UPDATE só via RPCs approve_pending_action / reject_pending_action.
DROP POLICY IF EXISTS pending_update_blocked ON public.pending_actions;
CREATE POLICY pending_update_blocked ON public.pending_actions
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS pending_delete_blocked ON public.pending_actions;
CREATE POLICY pending_delete_blocked ON public.pending_actions
  FOR DELETE TO authenticated
  USING (false);
