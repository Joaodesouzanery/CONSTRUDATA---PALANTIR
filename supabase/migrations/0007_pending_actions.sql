-- 0007_pending_actions.sql
-- Fluxo de aprovação: ações críticas (DELETE/UPDATE de FVS fechada/etc) ficam
-- pendentes até alguém com o role apropriado aprovar. Matriz de aprovação é
-- configurável por organização em organizations.settings.approval_matrix.

CREATE TABLE IF NOT EXISTS public.pending_actions (
  id                uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid                  NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by      uuid                  NOT NULL REFERENCES auth.users(id),
  action_type       text                  NOT NULL,    -- 'delete_fvs' | 'update_fvs_closed' | 'approve_budget' | ...
  target_table      text                  NOT NULL,    -- 'fvs' | 'rdo' | 'orcamentos' | ...
  target_id         text,                              -- ID do registro alvo (null para criar)
  payload           jsonb                 NOT NULL DEFAULT '{}'::jsonb,
  required_role     public.user_role      NOT NULL,
  status            public.action_status  NOT NULL DEFAULT 'pending',
  approved_by       uuid                  REFERENCES auth.users(id),
  approved_at       timestamptz,
  rejected_reason   text,
  expires_at        timestamptz           NOT NULL DEFAULT (now() + interval '7 days'),
  created_at        timestamptz           NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_org_status
  ON public.pending_actions(organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pending_requested_by
  ON public.pending_actions(requested_by);

CREATE INDEX IF NOT EXISTS idx_pending_expires
  ON public.pending_actions(expires_at)
  WHERE status = 'pending';

COMMENT ON TABLE public.pending_actions IS
  'Fila de ações críticas aguardando aprovação. Apenas roles configurados na approval_matrix da org podem aprovar.';
