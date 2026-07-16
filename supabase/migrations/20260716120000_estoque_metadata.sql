-- Estoque: coluna flexível `metadata` (jsonb) para campos opcionais do item
-- (ex.: codigoReferencia, dataUltimoPedido). Assim campo novo de estoque não pede mais migração.
-- Nullable com default '{}'; itens antigos ficam '{}'.
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção) ANTES de subir o código.

ALTER TABLE public.suprimentos_estoque_itens
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
