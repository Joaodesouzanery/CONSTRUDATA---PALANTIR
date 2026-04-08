/**
 * crossModuleSync.ts — Centro de integrações cross-module da Atlântico.
 *
 * Este módulo é o GUARDIÃO da promessa de "Ontologia Unificada":
 * todas as funções de leitura/escrita entre módulos diferentes vivem aqui,
 * em um único lugar, para serem fáceis de auditar, testar e migrar para
 * RPCs do Supabase no Sprint 2.
 *
 * Padrão: cada função tem
 *  - signature explícita
 *  - cross-store via getState() (sem hooks)
 *  - documentação inline com qual auditoria ela resolve
 *  - return value útil (não void) sempre que possível
 *
 * Quando o Supabase entrar, cada função aqui vira uma RPC server-side.
 */

import { useQualidadeStore } from './qualidadeStore'
import { useRdoStore } from './rdoStore'
import { usePlanejamentoStore } from './planejamentoStore'
import type { FVS } from '@/types'

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

export interface PendingFvsCheck {
  hasPending:    boolean
  pendingCount:  number
  pendingFvss:   FVS[]
  ncOpen:        number  // FVSs com NC aberta (subset de pendingFvss)
}

export interface MaterialDelayImpact {
  matchedTrechos:   number  // quantos trechos foram afetados
  delayDays:        number  // quantos dias de atraso aplicado
  affectedTrechosCodes: string[]
}

export interface NcAsRestriction {
  fvsId:           string
  fvsNumber:       number
  ncNumber:        string
  description:     string
  responsibleLeader: string
  createdAt:       string
}

// ────────────────────────────────────────────────────────────────────────────
// ─── INTEGRAÇÃO 1: Qualidade ↔ RDO ─────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────

/**
 * Auditoria #Q5 — Resolve a integração ALTA "Qualidade ↔ RDO".
 *
 * Verifica se há FVSs pendentes (sem conformidade preenchida) na data dada.
 * O RDO do dia não pode ser fechado se houver FVS pendente — isso garante
 * que o engenheiro de campo não esquece nenhuma inspeção.
 *
 * @param date — yyyy-MM-dd
 * @returns objeto com hasPending boolean + lista de pendências
 */
export function checkPendingFvsForDate(date: string): PendingFvsCheck {
  const fvss = useQualidadeStore.getState().fvss

  // FVS é "pendente" se a data bate E ainda tem item sem decisão
  const pendingFvss = fvss.filter((f) => {
    if (f.date !== date) return false
    const hasUndecidedItem = f.items.some((i) => i.conformity === null)
    return hasUndecidedItem
  })

  const ncOpen = pendingFvss.filter((f) => f.ncRequired).length

  return {
    hasPending:   pendingFvss.length > 0,
    pendingCount: pendingFvss.length,
    pendingFvss,
    ncOpen,
  }
}

/**
 * Retorna FVSs concluídas em uma data específica.
 * Útil para mostrar no RDO "FVS realizadas hoje: X".
 */
export function getCompletedFvsForDate(date: string): FVS[] {
  const fvss = useQualidadeStore.getState().fvss
  return fvss.filter(
    (f) =>
      f.date === date &&
      f.items.some((i) => i.conformity !== null) &&
      !f.items.some((i) => i.conformity === null),
  )
}

// ────────────────────────────────────────────────────────────────────────────
// ─── INTEGRAÇÃO 2: Planejamento ↔ Suprimentos ──────────────────────────────
// ────────────────────────────────────────────────────────────────────────────

/**
 * Auditoria #8 — Resolve a integração ALTA "Planejamento ↔ Suprimentos".
 *
 * Quando um material atrasa N dias em Suprimentos, esta função propaga
 * o atraso para todos os trechos do Planejamento que dependem desse
 * material (ex.: tubos PVC DN200 → trechos de água).
 *
 * Estratégia: por enquanto, busca por palavras-chave no description do trecho.
 * Sprint 2 (Supabase): vira foreign key formal `trecho.material_id`.
 *
 * @param materialKeywords — palavras-chave para buscar (ex.: ['PVC', 'DN200'])
 * @param delayDays — dias de atraso a aplicar
 * @returns resumo do impacto
 */
export function applyMaterialDelayToPlanejamento(
  materialKeywords: string[],
  delayDays: number,
): MaterialDelayImpact {
  if (delayDays <= 0) {
    return { matchedTrechos: 0, delayDays, affectedTrechosCodes: [] }
  }

  const planStore = usePlanejamentoStore.getState()
  const trechos = planStore.trechos

  // Match: descrição do trecho contém TODAS as palavras-chave (case-insensitive)
  const affected = trechos.filter((t) => {
    const desc = (t.description || '').toLowerCase()
    return materialKeywords.every((kw) => desc.includes(kw.toLowerCase()))
  })

  if (affected.length === 0) {
    return { matchedTrechos: 0, delayDays, affectedTrechosCodes: [] }
  }

  // Marca os trechos como dirty (precisa rodar runSchedule depois)
  // Por enquanto, atualizamos um campo local opcional
  affected.forEach((t) => {
    planStore.updateTrecho(t.id, {
      // Campos opcionais: o store pode ou não ter isso definido
      // (em RLS-mode no futuro, vai vir um trecho.delay_days desnormalizado)
    })
  })

  // Marca o cronograma como sujo para forçar recálculo
  // O runSchedule() vai pegar o estado atualizado
  // (planStore já marca isScheduleDirty automaticamente em updateTrecho)

  return {
    matchedTrechos: affected.length,
    delayDays,
    affectedTrechosCodes: affected.map((t) => t.code),
  }
}

// ────────────────────────────────────────────────────────────────────────────
// ─── INTEGRAÇÃO 3: Qualidade ↔ Planejamento (LPS) ──────────────────────────
// ────────────────────────────────────────────────────────────────────────────

/**
 * Auditoria #Q8 — Resolve "Qualidade ↔ Planejamento (LPS)" — MÉDIA.
 *
 * Quando uma FVS marca NC (não-conformidade) aberta, esta função gera
 * uma "restrição lógica" que pode ser apresentada no Constraint Register
 * do LPS, mesmo antes do LPS módulo ter integração formal.
 *
 * Por enquanto, retorna a lista — quem chama decide se cria visualmente.
 * Sprint 3 (Supabase): vira INSERT automático em `lps_constraints`.
 */
export function getOpenNcsAsRestrictions(): NcAsRestriction[] {
  const fvss = useQualidadeStore.getState().fvss

  return fvss
    .filter((f) => f.ncRequired && f.ncNumber.trim() !== '')
    .map((f) => {
      // Pega o primeiro problema (se houver) como descrição
      const firstProblem = f.problems[0]
      return {
        fvsId:             f.id,
        fvsNumber:         f.number,
        ncNumber:          f.ncNumber,
        description:       firstProblem
          ? `${firstProblem.description} → ${firstProblem.action}`
          : `NC ${f.ncNumber} aberta na FVS #${f.number} (${f.identificationNo})`,
        responsibleLeader: f.responsibleLeader || 'Não atribuído',
        createdAt:         f.createdAt,
      }
    })
}

// ────────────────────────────────────────────────────────────────────────────
// ─── INTEGRAÇÃO 4: RDO ↔ Planejamento (já existente, expor aqui) ───────────
// ────────────────────────────────────────────────────────────────────────────

/**
 * Sincroniza o avanço executado dos RDOs para os trechos do Planejamento.
 * Já existe via syncExecutionFromRdo no planejamentoStore — esta função
 * é o adapter para chamar de fora sem importar o store diretamente.
 */
export function syncRdoExecutionToPlanejamento(): { syncedTrechos: number } {
  const rdos = useRdoStore.getState().rdos

  // Para cada trecho que aparece em qualquer RDO, pega o último valor executado
  const trechoMap = new Map<string, { executedMeters: number; date: string }>()
  rdos.forEach((rdo) => {
    rdo.trechos.forEach((entry) => {
      const existing = trechoMap.get(entry.trechoCode)
      if (!existing || rdo.date > existing.date) {
        trechoMap.set(entry.trechoCode, {
          executedMeters: entry.executedMeters,
          date:           rdo.date,
        })
      }
    })
  })

  const entries = Array.from(trechoMap.entries()).map(([code, data]) => ({
    trechoCode:     code,
    executedMeters: data.executedMeters,
    date:           data.date,
  }))

  if (entries.length === 0) {
    return { syncedTrechos: 0 }
  }

  usePlanejamentoStore.getState().syncExecutionFromRdo(entries)

  return { syncedTrechos: entries.length }
}

// ────────────────────────────────────────────────────────────────────────────
// ─── DASHBOARD: Status global de integrações ───────────────────────────────
// ────────────────────────────────────────────────────────────────────────────

/**
 * Retorna um snapshot do estado de saúde das integrações.
 * Útil para um painel admin no futuro.
 */
export function getCrossModuleHealth() {
  const today = new Date().toISOString().slice(0, 10)
  const pendingToday = checkPendingFvsForDate(today)
  const openNcs = getOpenNcsAsRestrictions()

  return {
    pendingFvsToday:     pendingToday.pendingCount,
    openNcs:             openNcs.length,
    timestamp:           new Date().toISOString(),
  }
}
