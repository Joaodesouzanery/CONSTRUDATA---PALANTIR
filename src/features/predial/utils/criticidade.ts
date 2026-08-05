/**
 * criticidade.ts — "Criticidade de Ativos" por REGRA EXPLÍCITA (não é predição; não há sensor).
 * Score 0–100 = soma ponderada de 4 fatores, cada um com sua contribuição e explicação
 * (memória de cálculo, no espírito glass box). Usa só dados já cadastrados (manutencoesStore),
 * sem "engine", sem custo chumbado. Substitui o antigo "Saúde & Preditiva" (que era da frota).
 */
import type { MaintenanceAsset, MaintenancePlan, MaintenanceWorkOrder, MaintenancePriority } from '@/store/manutencoesStore'

export type CriticidadeNivel = 'critico' | 'alto' | 'medio' | 'baixo'
export interface CriticidadeFator { label: string; valor: number; max: number; detalhe: string }
export interface CriticidadeResult { assetId: string; score: number; nivel: CriticidadeNivel; fatores: CriticidadeFator[] }

/** Pesos por criticidade cadastrada (base do score). */
const PESO_CRIT: Record<MaintenancePriority, number> = { critica: 40, alta: 25, media: 12, baixa: 4 }

function idadeAnos(dataInstalacao?: string): number | null {
  if (!dataInstalacao) return null
  const t = new Date(dataInstalacao + 'T12:00:00').getTime()
  return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / (365.25 * 86_400_000)) : null
}

export function nivelLabel(n: CriticidadeNivel): string {
  return { critico: 'Crítico', alto: 'Alto', medio: 'Médio', baixo: 'Baixo' }[n]
}

/** Regra determinística. Cada fator devolve valor (contribuição), máximo e a explicação. */
export function calcCriticidade(asset: MaintenanceAsset, plans: MaintenancePlan[], workOrders: MaintenanceWorkOrder[]): CriticidadeResult {
  const hoje = new Date().toISOString().slice(0, 10)
  const limite12m = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)
  const fatores: CriticidadeFator[] = []

  // (1) Criticidade cadastrada (base).
  fatores.push({ label: 'Criticidade cadastrada', valor: PESO_CRIT[asset.criticality], max: 40, detalhe: `Classificado como "${asset.criticality}".` })

  // (2) Idade vs vida útil NBR.
  const idade = idadeAnos(asset.dataInstalacao)
  const vida = asset.vidaUtilAnosNBR && asset.vidaUtilAnosNBR > 0 ? asset.vidaUtilAnosNBR : null
  let idadeVal = 0
  let idadeDet = 'Sem data de instalação / vida útil cadastrada (contribui 0).'
  if (idade != null && vida != null) {
    const pct = Math.min(1.2, idade / vida)
    idadeVal = Math.round(Math.min(25, pct * 25))
    idadeDet = `${Math.floor(idade)} de ${vida} anos de vida útil (${Math.round(pct * 100)}%).`
  }
  fatores.push({ label: 'Idade / vida útil (NBR)', valor: idadeVal, max: 25, detalhe: idadeDet })

  // (3) Preventiva vencida (algum plano ativo do ativo com vencimento <= hoje).
  const vencida = plans.some((p) => p.active && p.frequency !== 'unica' && p.assetIds.includes(asset.id) && !!p.nextDueDate && p.nextDueDate <= hoje)
  fatores.push({ label: 'Preventiva vencida', valor: vencida ? 20 : 0, max: 20, detalhe: vencida ? 'Há plano preventivo vencido para este ativo.' : 'Preventivas em dia (ou sem plano).' })

  // (4) Reincidência de chamados nos últimos 12 meses (5 pontos cada, até 20).
  const reinc = workOrders.filter((w) => w.status !== 'cancelada' && w.assetIds.includes(asset.id) && (w.completedAt || w.scheduledDate || w.createdAt || '').slice(0, 10) >= limite12m).length
  fatores.push({ label: 'Reincidência de chamados (12m)', valor: Math.min(20, reinc * 5), max: 20, detalhe: `${reinc} chamado(s) nos últimos 12 meses.` })

  const score = Math.max(0, Math.min(100, fatores.reduce((s, f) => s + f.valor, 0)))
  const nivel: CriticidadeNivel = score >= 70 ? 'critico' : score >= 50 ? 'alto' : score >= 30 ? 'medio' : 'baixo'
  return { assetId: asset.id, score, nivel, fatores }
}
