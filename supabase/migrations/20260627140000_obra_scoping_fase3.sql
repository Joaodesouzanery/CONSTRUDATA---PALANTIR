-- 20260627140000_obra_scoping_fase3.sql
-- Separação por obra — Fase 3 (Equipamentos/Manutenções + Planejamento).
-- Idempotente. Legado = NULL = "Todas as obras". ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.
--
-- equipamentos.construction_site_id: já usado pelo manutencoesStore; garantido aqui (no-op se existir).
-- plan_trechos/plan_teams/plan_scenarios + maintenance_orders.site_id: consumidos na Fase 3b (Planejamento).
-- Pode aplicar de uma vez — colunas não usadas ainda ficam só disponíveis.

-- ── construction_site_id (mesmo nome já usado em equipamentos/manutenções) ──
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY['equipamentos', 'maintenance_orders'];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS construction_site_id uuid REFERENCES public.construction_sites(id) ON DELETE SET NULL',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id, construction_site_id)',
        'idx_' || t || '_org_site', t
      );
    END IF;
  END LOOP;
END $$;

-- ── site_id (padrão do resto dos módulos) para Planejamento ──
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY['plan_trechos', 'plan_teams', 'plan_scenarios'];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.construction_sites(id) ON DELETE SET NULL',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id, site_id)',
        'idx_' || t || '_org_site', t
      );
    END IF;
  END LOOP;
END $$;
