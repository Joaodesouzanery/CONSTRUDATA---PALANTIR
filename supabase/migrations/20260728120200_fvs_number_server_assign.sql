-- 20260728120200_fvs_number_server_assign.sql
-- Mesma classe de bug do RDO (ver 20260728120000), agora para a FVS (Qualidade):
-- o número da FVS é escolhido no cliente por max(fvss locais)+1 (qualidadeStore.ts),
-- mas fvs_unique_number_per_org UNIQUE(organization_id, number) (0010_qualidade.sql:38)
-- não filtra deleted_at → FVS soft-deletadas ainda ocupam o número; o max+1 local as
-- ignora e reusa (idem offline/multi-dispositivo) → 23505 preso em pendingSync.
--
-- FIX: numeração autoritativa no servidor, idêntica ao RDO.
--  • SECURITY DEFINER é OBRIGATÓRIO: public.fvs tem FORCE ROW LEVEL SECURITY e a policy
--    de SELECT filtra deleted_at (0016_rls_batch1.sql) → sem DEFINER o MAX não veria os
--    soft-deletados e recolidiria.
--  • INSERT: advisory-lock por org + MAX(number)+1 (inclui soft-deletados) quando o número
--    vier vazio/inválido ou colidir; mantém o número otimista quando livre.
--  • UPDATE: número imutável (neutraliza o ON CONFLICT DO UPDATE do upsert em retries).
-- Idempotente (CREATE OR REPLACE + DROP TRIGGER IF EXISTS). Não altera linhas existentes.

CREATE OR REPLACE FUNCTION public.assign_fvs_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.number := OLD.number;
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('fvs_number:' || NEW.organization_id::text));

  IF NEW.number IS NULL OR NEW.number <= 0 OR EXISTS (
    SELECT 1 FROM public.fvs f
     WHERE f.organization_id = NEW.organization_id
       AND f.number = NEW.number
       AND f.id <> NEW.id
  ) THEN
    SELECT COALESCE(MAX(number), 0) + 1
      INTO NEW.number
      FROM public.fvs
     WHERE organization_id = NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_fvs_number ON public.fvs;
CREATE TRIGGER trg_assign_fvs_number
  BEFORE INSERT OR UPDATE ON public.fvs
  FOR EACH ROW EXECUTE FUNCTION public.assign_fvs_number();

COMMENT ON FUNCTION public.assign_fvs_number() IS
  'Numeração autoritativa da FVS por organização (MAX+1 incl. soft-deletados, advisory-lock, '
  'imutável no UPDATE). Corrige colisões de fvs_unique_number_per_org vindas do max+1 client-side.';
