-- 20260627130000_obra_scoping_fase2.sql
-- Separação por obra — Fase 2 (Qualidade). Financeiro já usa obra_id (sem migration).
-- Adiciona site_id em fvs + quality_non_conformities. Legado = NULL = "Todas as obras".
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.

DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY['fvs', 'quality_non_conformities'];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
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
