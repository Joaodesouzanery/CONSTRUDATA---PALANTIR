-- 20260622120000_worker_assessments.sql
-- Mão de Obra — Ficha de Avaliação de Funcionário (tenant-safe, payload jsonb,
-- soft delete, RLS padrão 0020). Espelha worker_absences (0019) + RLS de 0020 +
-- soft delete do 20260612120000_financeiro_manejo.sql.
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (não há etapa de migration no CI).

CREATE TABLE IF NOT EXISTS public.worker_assessments (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id       uuid,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_worker_assessments_org        ON public.worker_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_worker_assessments_org_active ON public.worker_assessments(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_worker_assessments_worker     ON public.worker_assessments(worker_id);

-- ── RLS (padrão 0020/0033: select por org, insert/update com role, delete bloqueado
--    — exclusão é soft delete via update de deleted_at) ──────────────────────────
ALTER TABLE public.worker_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_assessments FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS worker_assessments_select_own_org ON public.worker_assessments;
CREATE POLICY worker_assessments_select_own_org ON public.worker_assessments FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS worker_assessments_insert_with_role ON public.worker_assessments;
CREATE POLICY worker_assessments_insert_with_role ON public.worker_assessments FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS worker_assessments_update_role ON public.worker_assessments;
CREATE POLICY worker_assessments_update_role ON public.worker_assessments FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND public.has_role(ARRAY['engenheiro','planejador','gerente','diretor','owner']::public.user_role[])
  )
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS worker_assessments_delete_blocked ON public.worker_assessments;
CREATE POLICY worker_assessments_delete_blocked ON public.worker_assessments FOR DELETE TO authenticated USING (false);
