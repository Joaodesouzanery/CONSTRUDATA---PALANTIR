-- 0005_invitations.sql
-- Convites para novos membros entrarem em uma organização.
-- O owner/diretor cria o convite; usuário aceita via link com token (expira em 7 dias).

CREATE TABLE IF NOT EXISTS public.invitations (
  id                uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid             NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email             citext           NOT NULL,
  role              public.user_role NOT NULL,
  invited_by        uuid             NOT NULL REFERENCES public.profiles(id),
  token             text             NOT NULL UNIQUE,
  accepted_at       timestamptz,
  expires_at        timestamptz      NOT NULL DEFAULT (now() + interval '7 days'),
  created_at        timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT invitations_unique_pending UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_invitations_org   ON public.invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
