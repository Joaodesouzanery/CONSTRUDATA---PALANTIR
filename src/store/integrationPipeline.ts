/**
 * integrationPipeline.ts — Cadeia de Construção (Construction Chain)
 *
 * Implements the data flow between modules following the natural workflow:
 *
 *   Pré-Construção → Planejamento → LPS → RDO → Torre de Controle
 *                                        ↓
 *                                   Rede 360 / Relatório 360 / Quantitativos
 *
 * Each pipe is a pure function that reads from one store and writes to another
 * via lazy dynamic imports (prevents circular dependencies).
 *
 * Subscriptions are activated by useIntegrationPipeline() in AppShell.
 */
import type { RDO } from '@/types'
import { useRdoStore } from './rdoStore'
import { useLpsStore } from './lpsStore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoToday() {
  return new Date().toISOString().split('T')[0]
}

function currentIsoWeek() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  now.setDate(now.getDate() + 4 - (now.getDay() || 7))
  const y = now.getFullYear()
  const yearStart = new Date(y, 0, 1)
  const week = Math.ceil(((now.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${y}-W${String(week).padStart(2, '0')}`
}

// ─── Pipe 1: RDO → Torre de Controle ─────────────────────────────────────────
//
// When a new RDO has an ocorrência (incident) or observations, automatically
// register a risk in the Torre de Controle for the corresponding obra.
// Links via RDO.local / RDO.numeroOS matching a ConstructionSite name or code.

export async function pipe_rdo_to_torre(rdos: RDO[]) {
  if (rdos.length === 0) return

  const { useTorreStore } = await import('./torreDeControleStore')
  const torreState = useTorreStore.getState()
  const sites = torreState.sites

  if (sites.length === 0) return

  // Look at the most recently updated RDO
  const latest = [...rdos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]

  // Only process RDOs with actual incidents/occurrences
  const hasIncident =
    (latest.incidents && latest.incidents.trim() !== '' && latest.incidents !== 'Não informado') ||
    (latest.ocorrencias && latest.ocorrencias.trim() !== '' && latest.ocorrencias !== 'Não informado')

  if (!hasIncident) return

  const incidentText = (latest.ocorrencias || latest.incidents || '').trim()

  // Try to find matching site by local name or OS number
  const matchedSite =
    sites.find((s) =>
      s.name.toLowerCase().includes((latest.local ?? '').toLowerCase()) ||
      s.code === latest.numeroOS
    ) ?? sites[0]

  if (!matchedSite) return

  // Check if a similar risk already exists (avoid duplicates)
  const existingRisk = matchedSite.risks?.find(
    (r) => r.description.includes(latest.id) || r.title.includes(`RDO #${latest.number}`)
  )
  if (existingRisk) return

  torreState.addRisk(matchedSite.id, {
    title: `Ocorrência — RDO #${latest.number}`,
    description: `${incidentText.slice(0, 200)}${incidentText.length > 200 ? '…' : ''}\n[Fonte: RDO #${latest.number} | ${latest.date} | ID: ${latest.id}]`,
    level: 'medium',
    status: 'identified',
    identifiedAt: latest.date || isoToday(),
    notes: `Auto-registrado pelo módulo AIP Pipeline a partir do RDO #${latest.number}`,
  })
}

// ─── Pipe 2: LPS PPC → Torre de Controle ─────────────────────────────────────
//
// When LPS weekly PPC drops below 60%, register a production-delay risk in Torre.
// Updates automatically when LPS activities change.

export async function pipe_lps_to_torre() {
  const activities = useLpsStore.getState().activities
  if (activities.length === 0) return

  const currentWeek = currentIsoWeek()

  // Get past weeks (excluding current and future)
  const pastActivities = activities.filter((a) => a.week < currentWeek && a.planned)
  if (pastActivities.length < 3) return  // Not enough history yet

  // Compute rolling 4-week PPC
  const weeks = [...new Set(pastActivities.map((a) => a.week))].sort().reverse().slice(0, 4)
  const recentActs = pastActivities.filter((a) => weeks.includes(a.week))
  const done = recentActs.filter((a) => a.completed).length
  const ppc = recentActs.length > 0 ? Math.round((done / recentActs.length) * 100) : 100

  if (ppc >= 60) return  // PPC is acceptable — no risk needed

  const { useTorreStore } = await import('./torreDeControleStore')
  const torreState = useTorreStore.getState()
  const sites = torreState.sites
  if (sites.length === 0) return

  // Pick the first active site (or any site)
  const activeSite = sites.find((s) => s.status === 'active') ?? sites[0]
  if (!activeSite) return

  // Deduplicate: only create one LPS PPC risk per site
  const existingRisk = activeSite.risks?.find((r) => r.title.startsWith('PPC Abaixo do Limite'))
  if (existingRisk) {
    // Update the description with latest PPC
    torreState.updateRisk(activeSite.id, existingRisk.id, {
      description: `PPC das últimas ${weeks.length} semanas: ${ppc}%. Meta: 60%. Atividades avaliadas: ${recentActs.length} | Concluídas: ${done}.\n[Auto-atualizado pelo AIP Pipeline — ${isoToday()}]`,
      level: ppc < 40 ? 'critical' : 'high',
      status: 'active',
    })
    return
  }

  torreState.addRisk(activeSite.id, {
    title: `PPC Abaixo do Limite — LPS/Lean`,
    description: `PPC das últimas ${weeks.length} semanas: ${ppc}%. Meta mínima: 60%. Atividades avaliadas: ${recentActs.length} | Concluídas: ${done}.\n[Auto-gerado pelo AIP Pipeline — ${isoToday()}]`,
    level: ppc < 40 ? 'critical' : 'high',
    status: 'active',
    identifiedAt: isoToday(),
    notes: 'Monitorado automaticamente pelo módulo AIP Pipeline (LPS → Torre de Controle)',
  })
}

// ─── Pipe 3: RDO → Rede 360 ──────────────────────────────────────────────────
//
// When RDO trechos have executed meters > 0, mark matching network assets
// as 'active' (construction complete / in operation).
// Links via trechoCode matching NetworkAsset.code.

export async function pipe_rdo_to_rede360(rdos: RDO[]) {
  if (rdos.length === 0) return

  // Collect all executed trechos from all RDOs
  const executedCodes = new Map<string, number>()
  rdos.forEach((r) => {
    r.trechos.forEach((t) => {
      if (t.executedMeters > 0) {
        const prev = executedCodes.get(t.trechoCode) ?? 0
        executedCodes.set(t.trechoCode, prev + t.executedMeters)
      }
    })
  })

  if (executedCodes.size === 0) return

  const { useRede360Store } = await import('./rede360Store')
  const rede360State = useRede360Store.getState()
  const assets = rede360State.assets

  executedCodes.forEach((_meters, code) => {
    const matchingAsset = assets.find(
      (a) => a.code === code || a.name.toLowerCase().includes(code.toLowerCase())
    )
    if (!matchingAsset) return
    if (matchingAsset.status === 'operational') return  // already operational — skip

    rede360State.updateAsset(matchingAsset.id, {
      status: 'operational',
      lastInspection: isoToday(),
    })
  })
}

// ─── Subscribe function ───────────────────────────────────────────────────────
//
// Called once by useIntegrationPipeline() in AppShell.
// Returns an unsubscribe function for cleanup.

let lastRdoLength = 0
let lastLpsLength = 0

export function subscribeIntegrationPipeline(): () => void {
  const unsubRdo = useRdoStore.subscribe((state) => {
    if (state.rdos.length !== lastRdoLength) {
      lastRdoLength = state.rdos.length
      void pipe_rdo_to_torre(state.rdos)
      void pipe_rdo_to_rede360(state.rdos)
    }
  })

  const unsubLps = useLpsStore.subscribe((state) => {
    if (state.activities.length !== lastLpsLength) {
      lastLpsLength = state.activities.length
      void pipe_lps_to_torre()
    }
  })

  // Run initial sync on startup
  void pipe_rdo_to_torre(useRdoStore.getState().rdos)
  void pipe_rdo_to_rede360(useRdoStore.getState().rdos)
  void pipe_lps_to_torre()

  return () => {
    unsubRdo()
    unsubLps()
  }
}
