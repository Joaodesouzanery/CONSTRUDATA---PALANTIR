-- 0001_extensions.sql
-- Extensões necessárias para o schema multi-tenant.
-- Idempotente: pode rodar múltiplas vezes sem efeito colateral.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- uuid_generate_v4() (legado/compat)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- busca por similaridade (LIKE %x%)
CREATE EXTENSION IF NOT EXISTS "citext";     -- emails case-insensitive
