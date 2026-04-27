-- 0043_rdo_sabesp_durable_assets.sql
-- Durable asset paths for RDO Sabesp photos/signatures.

ALTER TABLE public.rdo_sabesp
  ADD COLUMN IF NOT EXISTS planilha_foto_path text,
  ADD COLUMN IF NOT EXISTS assinatura_empreiteira_path text,
  ADD COLUMN IF NOT EXISTS assinatura_consorcio_path text,
  ADD COLUMN IF NOT EXISTS include_planilha_foto_no_pdf boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.rdo_sabesp.planilha_foto_path IS
  'Storage path for the original RDO sheet photo. Signed URLs are generated at render/export time.';
COMMENT ON COLUMN public.rdo_sabesp.assinatura_empreiteira_path IS
  'Storage path for the extracted contractor signature crop.';
COMMENT ON COLUMN public.rdo_sabesp.assinatura_consorcio_path IS
  'Storage path for the extracted consortium signature crop.';
COMMENT ON COLUMN public.rdo_sabesp.include_planilha_foto_no_pdf IS
  'When true, appends the original scanned RDO sheet photo to the generated PDF.';
