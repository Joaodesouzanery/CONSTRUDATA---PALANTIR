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
import { useProjetosStore } from './projetosStore'
import { usePlanejamentoMestreStore } from './planejamentoMestreStore'

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

// ─── Pipe 4: RDO → Mão de Obra ───────────────────────────────────────────────
//
// When a new RDO is saved with direct/indirect employee counts, register a
// daily timecard in the Mão de Obra module — eliminating double-entry.

export async function pipe_rdo_to_maoDeObra(rdos: RDO[]) {
  if (rdos.length === 0) return
  const latest = [...rdos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  if (!latest.funcionariosDiretos && !latest.funcionariosIndiretos) return

  const { useMaoDeObraStore } = await import('./maoDeObraStore')
  const moState = useMaoDeObraStore.getState()

  // Deduplicate: skip if a timecard for this RDO date already exists
  const existing = moState.timecards.find(
    (t) => t.date === latest.date && t.notes?.includes(`RDO #${latest.number}`)
  )
  if (existing) return

  const total = (latest.funcionariosDiretos ?? 0) + (latest.funcionariosIndiretos ?? 0)
  if (total === 0) return

  moState.addTimecard({
    workerId:            'auto-rdo',
    date:                latest.date || isoToday(),
    hoursWorked:         8,
    projectRef:          latest.numeroOS ?? '',
    phaseRef:            '',
    activityDescription: `RDO #${latest.number} — Diretos: ${latest.funcionariosDiretos ?? 0} / Indiretos: ${latest.funcionariosIndiretos ?? 0}`,
    reportedQty:         total,
    unit:                'un',
    notes:               `Auto-importado do RDO #${latest.number}`,
  })
}

// ─── Pipe 5: RDO → Relatório 360 (manpower) ──────────────────────────────────
//
// When a new RDO has crew counts and a matching date exists in Relatório 360,
// add a crew timecard entry to that day's report.

export async function pipe_rdo_to_relatorio360(rdos: RDO[]) {
  if (rdos.length === 0) return
  const latest = [...rdos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  if (!latest.funcionariosDiretos || latest.funcionariosDiretos === 0) return

  const { useRelatorio360Store } = await import('./relatorio360Store')
  const r360State = useRelatorio360Store.getState()
  const report = r360State.reports[latest.date]
  if (!report) return

  // Check for existing timecard to avoid duplicates
  const crew = report.crews?.[0]
  if (!crew) return
  const alreadyAdded = crew.timecards?.some(
    (tc) => tc.workerName?.includes(`RDO #${latest.number}`)
  )
  if (alreadyAdded) return

  r360State.addTimecard(crew.id, {
    workerName:   `RDO #${latest.number} — ${latest.responsible || 'Equipe de Campo'}`,
    role:         'Operário',
    hoursWorked:  8 * (latest.funcionariosDiretos ?? 1),
    hourlyRate:   0,
  })
}

// ─── Pipe 6: RDO → Quantitativos (execução de campo) ─────────────────────────
//
// When a new RDO has services, mark matching quantitativos items as having
// field execution recorded — linking planned cost to actual progress.

export async function pipe_rdo_to_quantitativos(rdos: RDO[]) {
  if (rdos.length === 0) return
  const latest = [...rdos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  if (!latest.services || latest.services.length === 0) return

  const { useQuantitativosStore } = await import('./quantitativosStore')
  const quantState = useQuantitativosStore.getState()
  const items = quantState.currentItems

  latest.services.forEach((svc) => {
    const desc = svc.description?.toLowerCase() ?? ''
    if (!desc) return
    const match = items.find(
      (item) =>
        (item.description?.toLowerCase().includes(desc) || desc.includes((item.description ?? '').toLowerCase())) &&
        (item.description ?? '').length > 4
    )
    if (!match) return
    // Add execution note to the item
    const currentNote = match.notes ?? ''
    if (currentNote.includes(`RDO #${latest.number}`)) return
    quantState.updateItem(match.id, {
      notes: `${currentNote}${currentNote ? '\n' : ''}Execução campo: RDO #${latest.number} (${latest.date})`,
    })
  })
}

// ─── Pipe 7: Projetos → Torre de Controle ────────────────────────────────────
//
// When a project moves to 'on_hold' status, automatically register a
// suspension risk in Torre de Controle.

export async function pipe_projetos_to_torre() {
  const projects = useProjetosStore.getState().projects
  if (projects.length === 0) return

  const onHold = projects.filter((p) => p.status === 'on_hold')
  if (onHold.length === 0) return

  const { useTorreStore } = await import('./torreDeControleStore')
  const torreState = useTorreStore.getState()
  const sites = torreState.sites
  if (sites.length === 0) return

  onHold.forEach((proj) => {
    // Match site by project code or name
    const site = sites.find(
      (s) => s.code === proj.code || s.name.toLowerCase().includes(proj.name.toLowerCase())
    ) ?? sites[0]
    if (!site) return

    const existing = site.risks?.find((r) => r.title.includes(`Projeto Suspenso: ${proj.code}`))
    if (existing) return

    torreState.addRisk(site.id, {
      title: `Projeto Suspenso: ${proj.code}`,
      description: `Projeto "${proj.name}" (${proj.code}) está com status "on_hold".\nGerente: ${proj.manager}\n[Auto-gerado pelo AIP Pipeline — ${isoToday()}]`,
      level: 'high',
      status: 'identified',
      identifiedAt: isoToday(),
      notes: 'Monitorado automaticamente pelo AIP Pipeline (Projetos → Torre de Controle)',
    })
  })
}

// ─── Pipe 8: Planejamento Mestre → LPS ───────────────────────────────────────
//
// When a new macro activity is added, create a corresponding LPS activity
// for the upcoming 6-week look-ahead window.

export async function pipe_planejamentoMestre_to_lps() {
  const activities = usePlanejamentoMestreStore.getState().activities
  if (activities.length === 0) return

  const { addActivity, activities: lpsActs } = useLpsStore.getState()

  // Focus on 'in_progress' or 'not_started' activities with near-term starts
  const today = isoToday()
  const sixWeeksOut = new Date(today)
  sixWeeksOut.setDate(sixWeeksOut.getDate() + 42)
  const sixWeeksIso = sixWeeksOut.toISOString().split('T')[0]

  const candidates = activities.filter(
    (a) =>
      !a.isMilestone &&
      a.plannedStart >= today &&
      a.plannedStart <= sixWeeksIso &&
      (a.status === 'not_started' || a.status === 'in_progress')
  )

  candidates.forEach((a) => {
    // Only add if no matching LPS activity already exists
    const already = lpsActs.find(
      (l) => l.cncDescription?.includes(`masterActivity:${a.id}`)
    )
    if (already) return

    // Determine ISO week from plannedStart
    const d = new Date(a.plannedStart)
    const dayOfWeek = d.getDay() || 7
    d.setDate(d.getDate() + 4 - dayOfWeek)
    const yr = d.getFullYear()
    const yearStart = new Date(yr, 0, 1)
    const w = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    const week = `${yr}-W${String(w).padStart(2, '0')}`

    addActivity({
      week,
      trechoCode:      a.wbsCode || a.id.slice(0, 8),
      description:     a.name,
      planned:         true,
      completed:       false,
      readyStatus:     'green',
      responsibleTeam: a.responsibleTeam ?? '',
      cncDescription:  `masterActivity:${a.id}`,
    })
  })
}

// ─── Pipe 9: Planejamento Mestre → Torre (delayed) ───────────────────────────
//
// When a master activity is 'delayed', register a schedule risk in Torre.

export async function pipe_planejamentoMestre_to_torre() {
  const activities = usePlanejamentoMestreStore.getState().activities
  const delayed = activities.filter((a) => a.status === 'delayed')
  if (delayed.length === 0) return

  const { useTorreStore } = await import('./torreDeControleStore')
  const torreState = useTorreStore.getState()
  const sites = torreState.sites
  if (sites.length === 0) return

  const activeSite = sites.find((s) => s.status === 'active') ?? sites[0]
  if (!activeSite) return

  delayed.forEach((a) => {
    const existing = activeSite.risks?.find((r) => r.title.includes(`Atraso: ${a.name.slice(0, 30)}`))
    if (existing) return

    torreState.addRisk(activeSite.id, {
      title: `Atraso: ${a.name.slice(0, 50)}`,
      description: `Atividade "${a.name}" (WBS: ${a.wbsCode}) está atrasada.\nAvanço: ${a.percentComplete}% | Início previsto: ${a.plannedStart}\n[Auto-gerado pelo AIP Pipeline — ${isoToday()}]`,
      level: a.isCritical ? 'critical' : 'high',
      status: 'identified',
      identifiedAt: isoToday(),
      notes: 'Monitorado automaticamente pelo AIP Pipeline (Planejamento Mestre → Torre)',
    })
  })
}

// ─── Subscribe function ───────────────────────────────────────────────────────
//
// Called once by useIntegrationPipeline() in AppShell.
// Returns an unsubscribe function for cleanup.

let lastRdoLength = 0
let lastLpsLength = 0

let lastProjetosLength = 0
let lastMasterLength = 0

export function subscribeIntegrationPipeline(): () => void {
  const unsubRdo = useRdoStore.subscribe((state) => {
    if (state.rdos.length !== lastRdoLength) {
      lastRdoLength = state.rdos.length
      void pipe_rdo_to_torre(state.rdos)
      void pipe_rdo_to_rede360(state.rdos)
      void pipe_rdo_to_maoDeObra(state.rdos)
      void pipe_rdo_to_relatorio360(state.rdos)
      void pipe_rdo_to_quantitativos(state.rdos)
    }
  })

  const unsubLps = useLpsStore.subscribe((state) => {
    if (state.activities.length !== lastLpsLength) {
      lastLpsLength = state.activities.length
      void pipe_lps_to_torre()
    }
  })

  const unsubProjetos = useProjetosStore.subscribe((state) => {
    if (state.projects.length !== lastProjetosLength) {
      lastProjetosLength = state.projects.length
      void pipe_projetos_to_torre()
    }
  })

  const unsubMaster = usePlanejamentoMestreStore.subscribe((state) => {
    if (state.activities.length !== lastMasterLength) {
      lastMasterLength = state.activities.length
      void pipe_planejamentoMestre_to_lps()
      void pipe_planejamentoMestre_to_torre()
    }
  })

  // Run initial sync on startup
  void pipe_rdo_to_torre(useRdoStore.getState().rdos)
  void pipe_rdo_to_rede360(useRdoStore.getState().rdos)
  void pipe_rdo_to_maoDeObra(useRdoStore.getState().rdos)
  void pipe_rdo_to_relatorio360(useRdoStore.getState().rdos)
  void pipe_rdo_to_quantitativos(useRdoStore.getState().rdos)
  void pipe_lps_to_torre()
  void pipe_projetos_to_torre()
  void pipe_planejamentoMestre_to_lps()
  void pipe_planejamentoMestre_to_torre()

  return () => {
    unsubRdo()
    unsubLps()
    unsubProjetos()
    unsubMaster()
  }
}
