-- 0002_enums.sql
-- Enums centrais usados em múltiplas tabelas.

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'owner',         -- dono da conta da organização (único, não removível)
    'diretor',       -- C-level, aprova decisões críticas
    'gerente',       -- gerente de obra, aprova FVS/RDO
    'engenheiro',    -- engenheiro de campo
    'qualidade',     -- responsável de qualidade
    'planejador',    -- planejamento e cronograma
    'comprador',     -- suprimentos e compras
    'visualizador'   -- read-only (auditor externo, cliente)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.action_status AS ENUM (
    'pending',   -- aguardando aprovação
    'approved',  -- aprovada e aplicada
    'rejected',  -- rejeitada com justificativa
    'expired'    -- passou de 7 dias sem aprovação
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.org_plan AS ENUM (
    'free',
    'pro',
    'team',
    'enterprise'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
