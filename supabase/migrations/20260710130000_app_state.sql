-- app_state: guarda-chuva genérico para dados que hoje ficam só no navegador.
-- Um blob jsonb por (organização, store_key). Sincroniza dados local-only do
-- Planejamento (contrato/núcleos/split de frentes, restrições, etc.) sem uma
-- tabela por store. Conflito: last-write-wins por updated_at (1 usuário/org).

CREATE TABLE IF NOT EXISTS public.app_state (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_key        text NOT NULL,
  payload          jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  UNIQUE (organization_id, store_key)
);

ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_state FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_state_select_own_org ON public.app_state;
CREATE POLICY app_state_select_own_org ON public.app_state
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org());

DROP POLICY IF EXISTS app_state_insert_own_org ON public.app_state;
CREATE POLICY app_state_insert_own_org ON public.app_state
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS app_state_update_own_org ON public.app_state;
CREATE POLICY app_state_update_own_org ON public.app_state
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org())
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS app_state_delete_blocked ON public.app_state;
CREATE POLICY app_state_delete_blocked ON public.app_state
  FOR DELETE TO authenticated USING (false);
