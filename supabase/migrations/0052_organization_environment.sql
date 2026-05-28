-- Explicit company environment for production, homologation and demo tenants.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_environment_check'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_environment_check
      CHECK (environment IN ('production', 'homologation', 'demo'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_environment
  ON public.organizations(environment);

UPDATE public.organizations
SET environment = 'homologation',
    settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('environment', 'homologation')
WHERE deleted_at IS NULL
  AND (
    slug ILIKE '%homologacao%'
    OR slug ILIKE '%homologation%'
    OR COALESCE(settings->>'environment', '') IN ('homologacao', 'homologation')
  );

UPDATE public.organizations
SET environment = 'demo',
    settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('environment', 'demo')
WHERE deleted_at IS NULL
  AND (
    slug ILIKE '%demo%'
    OR COALESCE(settings->>'environment', '') = 'demo'
  );

UPDATE public.organizations
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('environment', environment)
WHERE deleted_at IS NULL
  AND COALESCE(settings->>'environment', '') = '';

COMMENT ON COLUMN public.organizations.environment IS
  'Tenant environment: production for client operations, homologation for tests, demo for sales demonstrations.';
