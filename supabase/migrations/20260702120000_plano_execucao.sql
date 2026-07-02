-- 20260702120000_plano_execucao.sql
-- "Planejamento de Execução" (modo Compizzo) — Fase 1.
-- 1 tabela com o cabeçalho em colunas + payload jsonb (cronograma/equipe/bonificação/condições).
-- Multi-tenant por organization_id + site_id (obra). Soft-delete (deleted_at) via UPDATE.
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (testar em homologação antes de produção).

CREATE TABLE IF NOT EXISTS public.plano_execucao (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id              uuid          REFERENCES public.construction_sites(id) ON DELETE SET NULL,
  periodo_inicio       date,
  periodo_fim          date,
  area_m2              numeric(14,2) NOT NULL DEFAULT 0,
  servico              text,
  preco_m2             numeric(14,4) NOT NULL DEFAULT 0,
  faturamento_previsto numeric(16,2) NOT NULL DEFAULT 0,
  status               text          NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','ativo','concluido')),
  payload              jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_by           uuid          NOT NULL REFERENCES auth.users(id),
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE INDEX IF NOT EXISTS idx_plano_execucao_org
  ON public.plano_execucao(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_plano_execucao_org_site
  ON public.plano_execucao(organization_id, site_id) WHERE deleted_at IS NULL;

-- updated_at automático (função já existente no schema)
DROP TRIGGER IF EXISTS trg_plano_execucao_updated_at ON public.plano_execucao;
CREATE TRIGGER trg_plano_execucao_updated_at
  BEFORE UPDATE ON public.plano_execucao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──
ALTER TABLE public.plano_execucao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_execucao FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plano_execucao_select_own_org ON public.plano_execucao;
CREATE POLICY plano_execucao_select_own_org ON public.plano_execucao
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.user_org()) AND deleted_at IS NULL);

-- INSERT: apenas na própria org e como o próprio usuário (isolamento = organização).
-- O papel de quem pode editar é controlado na UI; a fronteira de segurança é a org.
DROP POLICY IF EXISTS plano_execucao_insert_own_org ON public.plano_execucao;
CREATE POLICY plano_execucao_insert_own_org ON public.plano_execucao
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.user_org()) AND created_by = auth.uid());

-- UPDATE: própria org (inclui o soft-delete que seta deleted_at).
DROP POLICY IF EXISTS plano_execucao_update_own_org ON public.plano_execucao;
CREATE POLICY plano_execucao_update_own_org ON public.plano_execucao
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT public.user_org()))
  WITH CHECK (organization_id = (SELECT public.user_org()));

-- DELETE bloqueado (usa soft-delete via UPDATE deleted_at).
DROP POLICY IF EXISTS plano_execucao_delete_blocked ON public.plano_execucao;
CREATE POLICY plano_execucao_delete_blocked ON public.plano_execucao
  FOR DELETE TO authenticated USING (false);
