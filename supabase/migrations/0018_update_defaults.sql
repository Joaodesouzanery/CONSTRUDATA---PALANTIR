-- 0018_update_defaults.sql
-- Atualiza o default da approval_matrix nas organizations e faz UPDATE
-- idempotente nas orgs existentes adicionando as chaves novas que faltarem.

-- 1. Atualiza o DEFAULT da coluna settings em organizations
ALTER TABLE public.organizations
  ALTER COLUMN settings SET DEFAULT jsonb_build_object(
    'approval_matrix', jsonb_build_object(
      'delete_fvs',           'diretor',
      'update_fvs_closed',    'gerente',
      'delete_rdo',           'gerente',
      'update_rdo_closed',    'gerente',
      'delete_po',            'diretor',
      'update_po_approved',   'diretor',
      'delete_invoice',       'diretor',
      'approve_budget',       'diretor',
      'delete_plan_scenario', 'gerente',
      'delete_plan_trecho',   'gerente',
      'delete_project',       'owner',
      'delete_organization',  'owner'
    ),
    'mfa_required_roles', jsonb_build_array('owner', 'diretor'),
    'soft_delete_days',   30
  );

-- 2. Patch idempotente: adiciona chaves novas em orgs existentes sem
-- sobrescrever as que o owner já customizou.
UPDATE public.organizations
SET settings = jsonb_set(
  settings,
  '{approval_matrix}',
  COALESCE(settings->'approval_matrix', '{}'::jsonb) || jsonb_build_object(
    'delete_rdo',           COALESCE(settings->'approval_matrix'->>'delete_rdo',           'gerente'),
    'update_rdo_closed',    COALESCE(settings->'approval_matrix'->>'update_rdo_closed',    'gerente'),
    'delete_po',            COALESCE(settings->'approval_matrix'->>'delete_po',            'diretor'),
    'update_po_approved',   COALESCE(settings->'approval_matrix'->>'update_po_approved',   'diretor'),
    'delete_invoice',       COALESCE(settings->'approval_matrix'->>'delete_invoice',       'diretor'),
    'delete_plan_scenario', COALESCE(settings->'approval_matrix'->>'delete_plan_scenario', 'gerente'),
    'delete_plan_trecho',   COALESCE(settings->'approval_matrix'->>'delete_plan_trecho',   'gerente')
  ),
  true
)
WHERE deleted_at IS NULL;
