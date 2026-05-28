-- 0004_profiles.sql
-- Estende auth.users com dados de perfil + role + organização.
-- 1:1 com auth.users (id é a mesma chave).

CREATE TABLE IF NOT EXISTS public.profiles (
  id                uuid             PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id   uuid             NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  full_name         text             NOT NULL,
  email             citext           NOT NULL,
  role              public.user_role NOT NULL DEFAULT 'visualizador',
  job_title         text,
  phone             text,
  avatar_url        text,
  mfa_enrolled      boolean          NOT NULL DEFAULT false,
  invited_by        uuid             REFERENCES public.profiles(id) ON DELETE SET NULL,
  activated_at      timestamptz,
  created_at        timestamptz      NOT NULL DEFAULT now(),
  updated_at        timestamptz      NOT NULL DEFAULT now(),
  deleted_at        timestamptz,

  CONSTRAINT profiles_email_unique_per_org UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_profiles_org      ON public.profiles(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role     ON public.profiles(organization_id, role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_email    ON public.profiles(email);

COMMENT ON TABLE public.profiles IS
  'Perfil estendido de auth.users. Toda query com auth.uid() resolve aqui para obter organization_id e role.';

-- ─── Trigger: atualiza updated_at automaticamente ──────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
