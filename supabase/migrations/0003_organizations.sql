-- 0003_organizations.sql
-- Tabela raiz do multi-tenant. Toda outra tabela tem organization_id apontando aqui.

CREATE TABLE IF NOT EXISTS public.organizations (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text          NOT NULL,
  slug            text          NOT NULL UNIQUE,
  plan            public.org_plan NOT NULL DEFAULT 'free',
  max_users       integer       NOT NULL DEFAULT 5,
  max_projects    integer       NOT NULL DEFAULT 3,
  owner_id        uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  -- settings.approval_matrix: jsonb { action_type: required_role, ... }
  -- ex.: { "delete_fvs": "diretor", "update_fvs_closed": "gerente", "approve_budget": "diretor" }
  settings        jsonb         NOT NULL DEFAULT jsonb_build_object(
    'approval_matrix', jsonb_build_object(
      'delete_fvs',           'diretor',
      'update_fvs_closed',    'gerente',
      'delete_rdo',           'gerente',
      'update_rdo_closed',    'gerente',
      'approve_budget',       'diretor',
      'delete_project',       'owner',
      'delete_organization',  'owner'
    ),
    'mfa_required_roles', jsonb_build_array('owner', 'diretor'),
    'soft_delete_days',   30
  ),
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug
  ON public.organizations(slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_owner
  ON public.organizations(owner_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.organizations IS
  'Tenants do sistema. Cada empresa cliente é uma organization. Toda tabela de domínio tem FK organization_id.';

COMMENT ON COLUMN public.organizations.settings IS
  'jsonb com configurações por organização. Inclui approval_matrix (matriz dinâmica de quem aprova o quê).';
