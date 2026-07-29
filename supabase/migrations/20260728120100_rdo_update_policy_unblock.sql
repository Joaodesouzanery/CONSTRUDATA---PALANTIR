-- 20260728120100_rdo_update_policy_unblock.sql
-- Destrava UPDATEs de RDO presos no RLS (segunda causa do "reenviar" na sincronização).
--
-- BUG (pré-existente, independente da numeração): o cliente grava `closed = true` em
-- TODO RDO (rdoStore.ts rdoToRow — a própria migração 20260625120000 comenta "a coluna
-- `closed` é hardcoded true e não serve"), mas a policy de UPDATE do rdo exige
-- `closed = false` (0016_rls_batch1.sql):
--     USING (... AND deleted_at IS NULL AND closed = false AND (autor OU papel))
-- Como todo RDO nasce closed=true, NENHUM update direto passa no RLS → casa 0 linhas →
-- assertAffectedRows lança → a op fica presa em pendingSync. Isso atinge o fluxo normal:
-- **finalizar um rascunho** (HistoricoPanel handleFinalize → updateRdo{status:'finalizado'}),
-- **editar** um RDO e o **reenvio de foto tardia** — todos são UPDATE.
--
-- FIX: remover apenas a cláusula `AND closed = false` da policy de UPDATE. O controle de
-- acesso real permanece = autoria (created_by = auth.uid()) OU papel (gerente/diretor/
-- owner), e WITH CHECK continua travando a organização. Não altera o VALOR de `closed`
-- (segue true), então a Medição — que exige closed=true para reconstruir measurement_sources
-- (0048_rdo_quality_measurement_sync.sql:276) — permanece INTACTA.
--
-- Observação: a intenção original de "RDO fechado só edita via fluxo de aprovação" está
-- hoje mal-aplicada (bloqueia TODO edit, pois closed é sempre true). Se no futuro quiser
-- esse trava-após-finalizar de verdade, o caminho é `closed = (status <> 'rascunho')` +
-- rotear a edição de finalizados pelo RPC de aprovação — mudança deliberada à parte.
--
-- Idempotente: DROP POLICY IF EXISTS + CREATE.

DROP POLICY IF EXISTS rdo_update_author_or_manager ON public.rdo;
CREATE POLICY rdo_update_author_or_manager ON public.rdo
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.user_org()
    AND deleted_at IS NULL
    AND (created_by = auth.uid() OR public.has_role(ARRAY['gerente','diretor','owner']::public.user_role[]))
  )
  WITH CHECK (organization_id = public.user_org());
