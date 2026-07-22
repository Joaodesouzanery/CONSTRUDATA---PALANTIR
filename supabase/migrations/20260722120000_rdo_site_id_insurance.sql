-- RDO: garante a coluna `site_id` na tabela `public.rdo`.
-- Ela foi introduzida em 20260627120000_obra_scoping_fase1.sql (marcada "APLICAR
-- MANUALMENTE"). Se aquela migração não tiver sido aplicada em produção, TODO
-- INSERT de RDO falha (PGRST204 "column site_id not found") → o save fica preso
-- em "não sincronizado". Esta reexecução é idempotente (no-op se já existir).
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção) ANTES de subir o código.

ALTER TABLE public.rdo
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.construction_sites(id) ON DELETE SET NULL;
