-- 20260706120000_servicos.sql
-- Catálogo de Serviços por organização (Planejamento de Execução / construção civil).
-- Colunas de cabeçalho (nome, unidade) + payload jsonb com o objeto Servico completo
-- (rendimento, rendimentoBase, custoDiaPessoa). Multi-tenant por organization_id.
-- Soft-delete (deleted_at) via UPDATE. Espelha plano_execucao.
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (testar em homologação antes de produção).

CREATE TABLE IF NOT EXISTS public.servicos (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome             text,
  unidade          text,
  payload          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_by       uuid        NOT NULL REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_servicos_org
  ON public.servicos(organization_id) WHERE deleted_at IS NULL;

-- updated_at automático (função já existente no schema)
DROP TRIGGER IF EXISTS trg_servicos_updated_at ON public.servicos;
CREATE TRIGGER trg_servicos_updated_at
  BEFORE UPDATE ON public.servicos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicos_select_own_org ON public.servicos;
CREATE POLICY servicos_select_own_org ON public.servicos
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.user_org()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS servicos_insert_own_org ON public.servicos;
CREATE POLICY servicos_insert_own_org ON public.servicos
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.user_org()) AND created_by = auth.uid());

DROP POLICY IF EXISTS servicos_update_own_org ON public.servicos;
CREATE POLICY servicos_update_own_org ON public.servicos
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT public.user_org()))
  WITH CHECK (organization_id = (SELECT public.user_org()));

DROP POLICY IF EXISTS servicos_delete_blocked ON public.servicos;
CREATE POLICY servicos_delete_blocked ON public.servicos
  FOR DELETE TO authenticated USING (false);
