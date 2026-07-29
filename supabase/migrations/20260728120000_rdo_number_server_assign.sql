-- 20260728120000_rdo_number_server_assign.sql
-- Corrige RDOs presos na sincronização com
--   duplicate key value violates unique constraint "rdo_unique_number_per_org".
--
-- CAUSA: o número do RDO era escolhido no cliente (Math.max(rdos locais)+1). A
-- constraint UNIQUE(organization_id, number) (0013_rdo.sql) NÃO filtra deleted_at,
-- então RDOs soft-deletados continuam ocupando o número — mas o max+1 local os
-- ignora e reusa um número já tomado (idem offline/multi-dispositivo). O insert do
-- flush usa upsert(onConflict: 'id'), que não resolve conflito no `number` → 23505 →
-- op presa em pendingSync para sempre (retry infinito), e o pull() fica bloqueado
-- enquanto houver op de 'rdo' pendente, então a colisão nunca se auto-corrige.
--
-- FIX: numeração AUTORITATIVA no servidor via trigger BEFORE INSERT OR UPDATE.
--  • INSERT: serializa por organização (advisory xact lock) e, se o número vier
--    vazio/inválido OU colidir com OUTRA linha (MAX inclui soft-deletados → nunca
--    reusa número de RDO excluído), atribui MAX(number)+1. Mantém o número do cliente
--    quando está livre (preserva a numeração otimista da UI quando possível).
--  • UPDATE: número é IMUTÁVEL (NEW.number := OLD.number) — mata a re-colisão no
--    caminho ON CONFLICT DO UPDATE do upsert em retries.
--
-- EFEITO NO INCIDENTE: no próximo retry automático, o INSERT preso recebe um número
-- livre e passa; os RDOs presos sobem sozinhos (sem cirurgia manual) e o pull()
-- destrava, reconciliando os números locais com o servidor.
--
-- Seguro reaplicar (idempotente): CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
--
-- ⚠️ SECURITY DEFINER é OBRIGATÓRIO: public.rdo tem FORCE ROW LEVEL SECURITY e a
-- policy de SELECT filtra `deleted_at IS NULL` (0016_rls_batch1.sql). Sem DEFINER, o
-- MAX/EXISTS internos rodariam como `authenticated` sob RLS e NÃO enxergariam os RDOs
-- soft-deletados → reatribuiria um número já ocupado por um excluído → recolisão. Com
-- DEFINER (dono da função bypassa RLS) o MAX vê TODAS as linhas da org. O WHERE
-- escopa por NEW.organization_id (sem leak entre tenants; a função não retorna linhas).

CREATE OR REPLACE FUNCTION public.assign_rdo_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Número é imutável após criado.
  IF TG_OP = 'UPDATE' THEN
    NEW.number := OLD.number;
    RETURN NEW;
  END IF;

  -- INSERT: serializa a numeração por organização (à prova de corrida).
  PERFORM pg_advisory_xact_lock(hashtext('rdo_number:' || NEW.organization_id::text));

  IF NEW.number IS NULL OR NEW.number <= 0 OR EXISTS (
    SELECT 1 FROM public.rdo r
     WHERE r.organization_id = NEW.organization_id
       AND r.number = NEW.number
       AND r.id <> NEW.id
  ) THEN
    SELECT COALESCE(MAX(number), 0) + 1
      INTO NEW.number
      FROM public.rdo
     WHERE organization_id = NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_rdo_number ON public.rdo;
CREATE TRIGGER trg_assign_rdo_number
  BEFORE INSERT OR UPDATE ON public.rdo
  FOR EACH ROW EXECUTE FUNCTION public.assign_rdo_number();

COMMENT ON FUNCTION public.assign_rdo_number() IS
  'Numeração autoritativa do RDO por organização: atribui MAX(number)+1 livre no INSERT '
  '(inclui soft-deletados, advisory-lock por org) e mantém o número imutável no UPDATE. '
  'Corrige colisões de rdo_unique_number_per_org vindas do max+1 client-side.';

-- ════════════════════════════════════════════════════════════════════════════
-- ROTEIRO DE TESTE (homologação antes de produção)
--  1. Dois INSERTs com o MESMO number na mesma org → ambos entram com números distintos.
--  2. Soft-delete de um RDO (deleted_at) e novo INSERT reusando aquele number → recebe
--     um número novo (MAX inclui o soft-deletado), sem colidir.
--  3. UPDATE tentando trocar number → permanece o original (imutável).
--  4. INSERT com number livre e válido → mantém o number enviado (numeração otimista).
--  5. RDO de outra org com o mesmo number → não interfere (lock/where por organization_id).
-- ════════════════════════════════════════════════════════════════════════════
