-- 20260627120000_obra_scoping_fase1.sql
-- Separação por obra — Fase 1 (RDO + Suprimentos + Mão de Obra).
-- Adiciona `site_id uuid` (= construction_sites.id) + índice por (org, site).
-- Dado legado fica NULL = "Todas as obras"; dado novo é carimbado pelo app.
-- RLS NÃO muda (obra é filtro de aplicação, não fronteira de segurança).
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.

DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'rdo',
    'suprimentos_depositos',
    'suprimentos_estoque_itens',
    'suprimentos_estoque_movimentacoes',
    'suprimentos_ordens',
    'purchase_orders',
    'goods_receipts',
    'invoices',
    'shifts',
    'worker_absences'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    -- só age se a tabela existir
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.construction_sites(id) ON DELETE SET NULL',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id, site_id) WHERE deleted_at IS NULL',
        'idx_' || t || '_org_site', t
      );
    END IF;
  END LOOP;
END $$;
