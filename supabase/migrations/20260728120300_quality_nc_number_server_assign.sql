-- 20260728120300_quality_nc_number_server_assign.sql
-- Mesma classe de bug do RDO (ver 20260728120000), agora para as Não Conformidades de
-- Qualidade: o `number` é escolhido no cliente por max(nonConformities locais)+1
-- (qualidadeStore.ts), mas quality_nc_unique_number_per_org UNIQUE(organization_id, number)
-- (0042_quality_non_conformities.sql:18) não filtra deleted_at → NCs soft-deletadas ainda
-- ocupam o número; o max+1 local as ignora e reusa → 23505 preso em pendingSync.
-- (Obs.: a coluna `number` é o inteiro sequencial constrangido; `nc_number` é texto livre e
-- não é tocada aqui.)
--
-- FIX: numeração autoritativa no servidor, idêntica ao RDO/FVS.
--  • SECURITY DEFINER é OBRIGATÓRIO: public.quality_non_conformities tem FORCE ROW LEVEL
--    SECURITY e a policy de SELECT filtra deleted_at (quality_nc_select_own_org,
--    0042_quality_non_conformities.sql) → sem DEFINER o MAX não veria os soft-deletados.
--  • INSERT: advisory-lock por org + MAX(number)+1 (inclui soft-deletados) quando vazio/
--    inválido/colide; mantém o número otimista quando livre.
--  • UPDATE: number imutável (neutraliza o ON CONFLICT DO UPDATE do upsert em retries).
-- Idempotente. Não altera linhas existentes.

CREATE OR REPLACE FUNCTION public.assign_quality_nc_number()
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

  PERFORM pg_advisory_xact_lock(hashtext('quality_nc_number:' || NEW.organization_id::text));

  IF NEW.number IS NULL OR NEW.number <= 0 OR EXISTS (
    SELECT 1 FROM public.quality_non_conformities q
     WHERE q.organization_id = NEW.organization_id
       AND q.number = NEW.number
       AND q.id <> NEW.id
  ) THEN
    SELECT COALESCE(MAX(number), 0) + 1
      INTO NEW.number
      FROM public.quality_non_conformities
     WHERE organization_id = NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_quality_nc_number ON public.quality_non_conformities;
CREATE TRIGGER trg_assign_quality_nc_number
  BEFORE INSERT OR UPDATE ON public.quality_non_conformities
  FOR EACH ROW EXECUTE FUNCTION public.assign_quality_nc_number();

COMMENT ON FUNCTION public.assign_quality_nc_number() IS
  'Numeração autoritativa das NCs de qualidade por organização (MAX+1 incl. soft-deletados, '
  'advisory-lock, imutável no UPDATE). Corrige colisões de quality_nc_unique_number_per_org.';
