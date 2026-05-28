-- 0026_bim.sql
-- Sprint 4 — BIM 3D/4D/5D.
-- bim_projects: 1 row por modelo BIM importado (shapefile/DXF/levantamento).
-- bim_segments: 1 row por elemento geométrico (vertices em payload jsonb).
-- Arquivos-fonte (.shp/.dxf/.ifc) NÃO ficam no banco — vão para Supabase
-- Storage bucket `bim-uploads/` referenciados por `source_file_path`.

CREATE TABLE IF NOT EXISTS public.bim_projects (
  id                 uuid PRIMARY KEY,
  organization_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id         uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  name               text NOT NULL,
  type               text,             -- 'sanitation' | 'building' | 'generic'
  source_file_path   text,             -- caminho no bucket bim-uploads/, opcional
  payload            jsonb NOT NULL DEFAULT '{}'::jsonb,  -- layers[], shapefileSourceName, uploadedAt
  created_by         uuid NOT NULL REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_bim_projects_org          ON public.bim_projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_bim_projects_org_created  ON public.bim_projects(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bim_projects_org_active   ON public.bim_projects(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bim_projects_project      ON public.bim_projects(project_id);

CREATE TABLE IF NOT EXISTS public.bim_segments (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bim_project_id  uuid NOT NULL REFERENCES public.bim_projects(id) ON DELETE CASCADE,
  trecho_code     text,
  diameter        numeric(8,2),
  material        text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- vertices[][3], attributes, lengthM, custos, datas
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_bim_segments_org          ON public.bim_segments(organization_id);
CREATE INDEX IF NOT EXISTS idx_bim_segments_org_created  ON public.bim_segments(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bim_segments_org_active   ON public.bim_segments(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bim_segments_project      ON public.bim_segments(bim_project_id);
CREATE INDEX IF NOT EXISTS idx_bim_segments_trecho       ON public.bim_segments(trecho_code);
