-- 0006_audit_log.sql
-- Log imutável de todas as ações sensíveis. Append-only por design — sem
-- policies de UPDATE ou DELETE (nem mesmo o owner consegue editar histórico).

CREATE TABLE IF NOT EXISTS public.audit_log (
  id                bigserial    PRIMARY KEY,
  organization_id   uuid         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id          uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  action            text         NOT NULL,             -- 'insert' | 'update' | 'delete' | 'login' | 'export' | ...
  table_name        text         NOT NULL,
  record_id         text,                              -- string para suportar IDs não-uuid
  before            jsonb,
  after             jsonb,
  ip                inet,
  user_agent        text,
  created_at        timestamptz  NOT NULL DEFAULT now()
);

-- Particionável por organization_id no futuro (quando audit_log > 1M rows).
CREATE INDEX IF NOT EXISTS idx_audit_org_created
  ON public.audit_log(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_actor
  ON public.audit_log(actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_table_record
  ON public.audit_log(table_name, record_id);

COMMENT ON TABLE public.audit_log IS
  'Log imutável append-only. RLS bloqueia UPDATE e DELETE para todos os roles.';
