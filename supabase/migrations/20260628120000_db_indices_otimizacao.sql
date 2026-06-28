-- 20260628120000_db_indices_otimizacao.sql
-- Tier 2c: índices para o padrão de acesso quente "WHERE organization_id = … AND deleted_at IS NULL [AND site_id = …]".
-- Puramente aditivo + recria os índices construction_site_id da Fase 3 com o filtro parcial WHERE deleted_at IS NULL.
-- Idempotente / seguro de reaplicar. ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.

-- ── 1) Corrige os índices construction_site_id da Fase 3 (faltava WHERE deleted_at IS NULL) ──
-- O índice antigo indexava também linhas soft-deletadas. Recria como índice parcial.
-- DO-block com IF EXISTS: equipamentos sempre existe; maintenance_orders é no-op se ausente.
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY['equipamentos', 'maintenance_orders'];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='deleted_at') THEN
      EXECUTE format('DROP INDEX IF EXISTS public.%I', 'idx_' || t || '_org_site');
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id, construction_site_id) WHERE deleted_at IS NULL',
        'idx_' || t || '_org_site', t
      );
    END IF;
  END LOOP;
END $$;

-- ── 2) Índices parciais faltantes nas tabelas quentes (org + deleted_at) ──
-- suprimentos_itens/ruas/ordens têm índice (organization_id) cheio, mas não o parcial.
CREATE INDEX IF NOT EXISTS idx_suprimentos_itens_org_active
  ON public.suprimentos_itens(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suprimentos_ruas_org_active
  ON public.suprimentos_ruas(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suprimentos_ordens_org_active
  ON public.suprimentos_ordens(organization_id) WHERE deleted_at IS NULL;

-- Movimentações de estoque: consulta típica é por org + data desc.
CREATE INDEX IF NOT EXISTS idx_sup_est_mov_org_data
  ON public.suprimentos_estoque_movimentacoes(organization_id, data_movimento DESC) WHERE deleted_at IS NULL;

-- Mão de obra: shifts e faltas são consultados por org + data.
CREATE INDEX IF NOT EXISTS idx_shifts_org_date
  ON public.shifts(organization_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_worker_absences_org_date
  ON public.worker_absences(organization_id, date DESC) WHERE deleted_at IS NULL;
