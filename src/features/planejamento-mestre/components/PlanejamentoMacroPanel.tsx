/**
 * PlanejamentoMacroPanel — Longo Prazo: Matriz mensal "Gestão à Vista" (atividade × mês,
 * % físico) como visão principal, com Tabela 360 (orçamento) alternativa e o Plano de
 * Execução (layout do documento) embutido por obra. Baseline + CRUD + export (PDF/Excel).
 */
import { useState, useMemo } from 'react'
import { Plus, Save, Download, X, Check, FileDown, FileSpreadsheet, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import * as XLSX from 'xlsx'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { byActiveObra } from '@/hooks/useActiveObra'
import { obraBacFromSite } from '@/features/torre-de-controle/utils/obraBudget'
import { daysBetween } from '../utils/masterEngine'
import { NETWORK_TYPE_OPTIONS } from '../networkCategories'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Tabela360Panel } from './Tabela360Panel'
import { MatrizMensalPanel } from './MatrizMensalPanel'
import { ExecucaoPanel } from '@/features/planejamento/components/ExecucaoPanel'
import type { MasterActivity, MasterActivityStatus } from '@/types'

function fmtMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function PlanningKpi({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-[140px] rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[#8a8a8a]">{label}</p>
      <p className={accent ? 'text-sm font-semibold text-[#f97316]' : 'text-sm font-semibold text-[#f5f5f5]'}>
        {value}
      </p>
    </div>
  )
}

// ─── New Activity Form ───────────────────────────────────────────────────────

function NewActivityForm({ onClose }: { onClose: () => void }) {
  const addActivity = usePlanejamentoMestreStore((s) => s.addActivity)
  const activities  = usePlanejamentoMestreStore((s) => s.activities)

  const [form, setForm] = useState(() => {
    const start = new Date()
    const end = new Date(start)
    end.setDate(start.getDate() + 14)
    return {
    wbsCode: '', name: '',
    parentId: '' as string,
    plannedStart: start.toISOString().slice(0, 10),
    plannedEnd: end.toISOString().slice(0, 10),
    responsibleTeam: '', isMilestone: false, weight: 5,
    networkType: 'geral' as string,
    local: '',
    unidade: '',
    plannedQuantity: '',
    plannedProgressPct: 0,
    operationalKey: '',
    }
  })

  const parentActivity = activities.find((a) => a.id === form.parentId) ?? null
  const derivedLevel   = parentActivity ? parentActivity.level + 1 : 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.wbsCode.trim() || !form.name.trim()) return
    const dur = daysBetween(form.plannedStart, form.plannedEnd)
    addActivity({
      wbsCode: form.wbsCode, name: form.name,
      parentId: form.parentId || null, level: derivedLevel,
      plannedStart: form.plannedStart, plannedEnd: form.plannedEnd,
      trendStart: form.plannedStart, trendEnd: form.plannedEnd,
      durationDays: Math.max(0, dur), percentComplete: 0, status: 'not_started',
      isMilestone: form.isMilestone, responsibleTeam: form.responsibleTeam || undefined,
      weight: form.weight,
      networkType: (form.networkType || undefined) as MasterActivity['networkType'],
      plannedProgressPct: Math.min(100, Math.max(0, Number(form.plannedProgressPct) || 0)),
      local: form.local || undefined,
      unidade: form.unidade || undefined,
      plannedQuantity: Number(form.plannedQuantity) || undefined,
      executedQuantity: 0,
      operationalKey: form.operationalKey || `${form.wbsCode}|${form.name}`.toLowerCase(),
    })
    onClose()
  }

  const inputCls = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60'

  return (
    <form onSubmit={handleSubmit} className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[#f5f5f5] text-sm font-semibold">Nova Atividade</p>
        <button type="button" onClick={onClose} className="text-[#6b6b6b] hover:text-[#a3a3a3]"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Atividade Pai</label>
          <select className={inputCls} value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}>
            <option value="">— Raiz (sem parent) — Nível 0</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>{'  '.repeat(a.level)}{a.wbsCode} — {a.name}  (N{a.level})</option>
            ))}
          </select>
          {parentActivity && <p className="text-[10px] text-[#f97316] mt-0.5">Nível calculado: {derivedLevel}</p>}
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Código WBS *</label>
          <input className={inputCls} value={form.wbsCode} onChange={(e) => setForm((f) => ({ ...f, wbsCode: e.target.value }))} placeholder="1.1.6" required />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Tipo de Rede</label>
          <select className={inputCls} value={form.networkType} onChange={(e) => setForm((f) => ({ ...f, networkType: e.target.value }))}>
            {NETWORK_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Nome *</label>
          <input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Frente / local</label>
          <input className={inputCls} value={form.local} onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))} placeholder="Ex: garagem, subsolo 1" />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Chave para RDO</label>
          <input className={inputCls} value={form.operationalKey} onChange={(e) => setForm((f) => ({ ...f, operationalKey: e.target.value }))} placeholder="Opcional; usada para vincular apontamentos" />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Início</label>
          <input type="date" className={inputCls} value={form.plannedStart} onChange={(e) => setForm((f) => ({ ...f, plannedStart: e.target.value }))} />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Fim</label>
          <input type="date" className={inputCls} value={form.plannedEnd} onChange={(e) => setForm((f) => ({ ...f, plannedEnd: e.target.value }))} />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Equipe</label>
          <input className={inputCls} value={form.responsibleTeam} onChange={(e) => setForm((f) => ({ ...f, responsibleTeam: e.target.value }))} />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Unidade</label>
          <input className={inputCls} value={form.unidade} onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))} placeholder="m2, ml, un..." />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Quantidade planejada</label>
          <input type="number" min={0} step="0.01" className={inputCls} value={form.plannedQuantity} onChange={(e) => setForm((f) => ({ ...f, plannedQuantity: e.target.value }))} />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Peso</label>
          <input type="number" min={0} max={100} className={inputCls} value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">% previsto do serviço</label>
          <input type="number" min={0} max={100} step="0.01" className={inputCls} value={form.plannedProgressPct} onChange={(e) => setForm((f) => ({ ...f, plannedProgressPct: Number(e.target.value) }))} placeholder="Ex: Lixamento 15" />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" checked={form.isMilestone} onChange={(e) => setForm((f) => ({ ...f, isMilestone: e.target.checked }))} className="accent-[#f97316]" />
          <span className="text-[#6b6b6b] text-xs">Marco (Milestone)</span>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-[#525252] text-[#6b6b6b] text-xs hover:text-[#a3a3a3]">Cancelar</button>
        <button type="submit" className="px-4 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c]">
          <Check size={12} className="inline mr-1" />Criar
        </button>
      </div>
    </form>
  )
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportExcel(activities: MasterActivity[]) {
  const rows = activities.map((a) => ({
    'WBS':         a.wbsCode,
    'Atividade':   a.name,
    'Nível':       a.level,
    'Tipo Rede':   a.networkType ?? '',
    'Início Plan': a.plannedStart,
    'Fim Plan':    a.plannedEnd,
    'Início Tend': a.trendStart,
    'Fim Tend':    a.trendEnd,
    '% Previsto':  a.plannedProgressPct ?? '',
    '% Conc.':     a.percentComplete,
    'Status':      a.status,
    'Equipe':      a.responsibleTeam ?? '',
    'Peso':        a.weight ?? '',
    'Marco':       a.isMilestone ? 'Sim' : 'Não',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'WBS')
  XLSX.writeFile(wb, 'planejamento-mestre-longo-prazo.xlsx')
}

function exportPdf() {
  window.print()
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

interface PlanejamentoMacroPanelProps {
  /** Callback opcional para abrir o wizard "Criar Planejamento do Zero" */
  onCreateProject?: () => void
}

export function PlanejamentoMacroPanel({ onCreateProject }: PlanejamentoMacroPanelProps = {}) {
  const activities    = usePlanejamentoMestreStore((s) => s.activities)
  const baselines     = usePlanejamentoMestreStore((s) => s.baselines)
  const activeBlId    = usePlanejamentoMestreStore((s) => s.activeBaselineId)
  const contract      = usePlanejamentoMestreStore((s) => s.contract)
  const nuclei        = usePlanejamentoMestreStore((s) => s.nuclei)
  const saveBaseline  = usePlanejamentoMestreStore((s) => s.saveBaseline)
  const loadBaseline  = usePlanejamentoMestreStore((s) => s.loadBaseline)
  const removeActivity = usePlanejamentoMestreStore((s) => s.removeActivity)
  const backfillObraId = usePlanejamentoMestreStore((s) => s.backfillObraId)

  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const sites = useTorreStore((s) => s.sites)

  const [deleteTarget, setDeleteTarget] = useState<MasterActivity | null>(null)
  const [showNewForm, setShowNewForm]   = useState(false)
  const [blName, setBlName]             = useState('')
  const [showBlSave, setShowBlSave]     = useState(false)
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState<MasterActivityStatus | ''>('')
  const [filterNetwork, setFilterNetwork] = useState<string>('')
  const [filterService, setFilterService] = useState<string>('')
  const [filterNucleo, setFilterNucleo] = useState<string>('')
  const [showFilters, setShowFilters]   = useState(false)
  const [view, setView] = useState<'matriz' | 'tabela360'>('matriz')

  // Núcleos presentes nas atividades (para o filtro), casando nucleusId → nome do cadastro.
  const nucleoOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of activities) {
      const key = a.nucleusId || a.nucleo
      if (!key) continue
      const nome = (a.nucleusId ? nuclei.find((n) => n.id === a.nucleusId)?.name : undefined) || a.nucleo || key
      if (!map.has(key)) map.set(key, nome)
    }
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((x, y) => x.label.localeCompare(y.label))
  }, [activities, nuclei])

  const filtered = useMemo(() =>
    byActiveObra(activities, activeObraId).filter((a) =>
      (!search || a.name.toLowerCase().includes(search.toLowerCase()) || a.wbsCode.toLowerCase().includes(search.toLowerCase())) &&
      (!filterStatus  || a.status          === filterStatus) &&
      (!filterNetwork || a.networkType     === filterNetwork) &&
      (!filterService || a.serviceCategory === filterService) &&
      (!filterNucleo  || a.nucleusId === filterNucleo || a.nucleo === filterNucleo)
    ),
    [activities, activeObraId, search, filterStatus, filterNetwork, filterService, filterNucleo],
  )

  // Atividades sem obra (legadas) — oferecemos backfill para a obra selecionada.
  const semObraCount = useMemo(() => activities.filter((a) => !a.obraId).length, [activities])
  const activeSiteName = activeObraId ? sites.find((s) => s.id === activeObraId)?.name : undefined

  const activeFilterCount = [search, filterStatus, filterNetwork, filterService, filterNucleo].filter(Boolean).length
  // Médias escopadas pela obra selecionada (usa a lista filtrada, não todas as atividades).
  const scopedActs = byActiveObra(activities, activeObraId)
  const averagePhysical = scopedActs.length > 0
    ? scopedActs.reduce((sum, a) => sum + (a.physicalProgressPct ?? a.percentComplete ?? 0), 0) / scopedActs.length
    : 0
  const averageFinancial = scopedActs.length > 0
    ? scopedActs.reduce((sum, a) => sum + (a.financialProgressPct ?? a.physicalProgressPct ?? a.percentComplete ?? 0), 0) / scopedActs.length
    : 0
  // BAC por obra vindo da Torre: obra selecionada → seu orçamento; "Todas" → soma das obras (fallback: contrato).
  const bacScoped = useMemo(() => {
    if (activeObraId) return obraBacFromSite(sites.find((s) => s.id === activeObraId)) || (contract?.bacTotal ?? 0)
    const obraIds = new Set(activities.map((a) => a.obraId).filter(Boolean) as string[])
    let sum = 0
    for (const id of obraIds) sum += obraBacFromSite(sites.find((s) => s.id === id))
    return sum > 0 ? sum : (contract?.bacTotal ?? 0)
  }, [activeObraId, sites, activities, contract])
  const ppcBasedIdc = Math.max(0.35, averagePhysical / 100)
  const eacByPpc = bacScoped > 0 ? bacScoped / ppcBasedIdc : 0

  function clearFilters() {
    setSearch('')
    setFilterStatus('')
    setFilterNetwork('')
    setFilterService('')
    setFilterNucleo('')
  }

  function handleBackfill() {
    if (!activeObraId) return
    const n = backfillObraId(activeObraId)
    window.alert(n > 0
      ? `${n} atividade(s) sem obra foram vinculadas a "${activeSiteName ?? 'obra selecionada'}".`
      : 'Nenhuma atividade sem obra para vincular.')
  }

  function handleSaveBaseline() {
    if (!blName.trim()) return
    saveBaseline(blName.trim())
    setBlName('')
    setShowBlSave(false)
  }

  const btnCls = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#525252] text-[#6b6b6b] text-xs hover:text-[#f97316] hover:border-[#f97316]/40 transition-colors'

  return (
    <div className="flex flex-col gap-4 print:gap-2">
      {contract && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#525252] bg-[#343434] p-3 print:hidden">
          <PlanningKpi label="Contrato" value={contract.contractName} accent />
          <PlanningKpi label="Contratante" value={contract.contractor} />
          <PlanningKpi label={activeObraId ? 'Orçamento da obra (Torre)' : 'Orçamento (Torre, todas)'} value={fmtMoney(bacScoped)} />
          <PlanningKpi label="Nucleos" value={String(nuclei.length || contract.nucleusCount)} />
          <PlanningKpi label="Takt teorico" value={`${contract.theoreticalTaktDays} dias/nucleo`} />
          <PlanningKpi label="Fisico medio" value={`${averagePhysical.toFixed(1)}%`} />
          <PlanningKpi label="Financeiro medio" value={`${averageFinancial.toFixed(1)}%`} />
          <PlanningKpi label="EAC por PPC" value={fmtMoney(eacByPpc)} accent />
        </div>
      )}
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap print:hidden">
        {/* Baseline */}
        <div className="flex items-center gap-2">
          <span className="text-[#6b6b6b] text-xs">Baseline:</span>
          <select
            value={activeBlId ?? ''}
            onChange={(e) => e.target.value && loadBaseline(e.target.value)}
            className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60"
          >
            <option value="">— Selecionar —</option>
            {baselines.map((bl) => (
              <option key={bl.id} value={bl.id}>{bl.name}</option>
            ))}
          </select>
        </div>

        {showBlSave ? (
          <div className="flex items-center gap-2">
            <input
              className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60 w-40"
              placeholder="Nome da baseline"
              value={blName}
              onChange={(e) => setBlName(e.target.value)}
              autoFocus
            />
            <button onClick={handleSaveBaseline} className="px-2.5 py-1.5 rounded-lg bg-[#22c55e]/20 text-[#22c55e] text-xs font-semibold hover:bg-[#22c55e]/30">
              <Save size={12} className="inline mr-1" />Salvar
            </button>
            <button onClick={() => setShowBlSave(false)} className="text-[#6b6b6b] hover:text-[#a3a3a3] text-xs">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setShowBlSave(true)} className={btnCls}>
            <Download size={12} />Salvar Baseline
          </button>
        )}

        {/* Export buttons */}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={exportPdf} className={btnCls} title="Exportar PDF">
            <FileDown size={12} />PDF
          </button>
          <button onClick={() => exportExcel(filtered)} className={btnCls} title="Exportar Excel">
            <FileSpreadsheet size={12} />Excel
          </button>
        </div>

        {onCreateProject && (
          <button
            onClick={onCreateProject}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#f97316]/50 text-[#f97316] text-xs font-semibold hover:bg-[#f97316]/10 transition-colors"
            title="Criar planejamento do zero (substitui o atual)"
          >
            <Sparkles size={13} />Criar Planejamento
          </button>
        )}
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c]"
        >
          <Plus size={13} />Nova Atividade
        </button>
      </div>

      {/* New activity form */}
      {showNewForm && <NewActivityForm onClose={() => setShowNewForm(false)} />}

      {/* ── Filter Bar ── */}
      <div className="print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b] pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou WBS..."
              className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-[#3d3d3d] border border-[#525252] text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50 transition-colors"
            />
          </div>

          {/* Toggle advanced filters */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-[#f97316]/50 bg-[#f97316]/10 text-[#f97316]'
                : 'border-[#525252] text-[#6b6b6b] hover:text-[#f5f5f5]'
            }`}
          >
            <SlidersHorizontal size={12} />
            Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[#ef4444] hover:bg-[#ef4444]/10 border border-[#ef4444]/30 transition-colors"
            >
              <X size={11} />Limpar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {/* Status filter */}
            <div className="flex items-center gap-2">
              <span className="text-[#6b6b6b] text-xs shrink-0">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as MasterActivityStatus | '')}
                className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
              >
                <option value="">Todos</option>
                <option value="not_started">Não iniciada</option>
                <option value="in_progress">Em andamento</option>
                <option value="completed">Concluída</option>
                <option value="delayed">Atrasada</option>
              </select>
            </div>

            {/* Network type filter */}
            <div className="flex items-center gap-2">
              <span className="text-[#6b6b6b] text-xs shrink-0">Rede:</span>
              <select
                value={filterNetwork}
                onChange={(e) => setFilterNetwork(e.target.value)}
                className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
              >
                <option value="">Todas</option>
                {NETWORK_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Service category filter */}
            <div className="flex items-center gap-2">
              <span className="text-[#6b6b6b] text-xs shrink-0">Serviço:</span>
              <select
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
              >
                <option value="">Todos</option>
                <option value="LA">LA — Ligação de Água</option>
                <option value="LE">LE — Ligação de Esgoto</option>
                <option value="intra">Intra</option>
                <option value="interligacao">Interligação</option>
                <option value="reposicao">Reposição</option>
                <option value="na_rede">Na Rede</option>
                <option value="OS">OS — Ordem de Serviço</option>
                <option value="pavimentacao">Pavimentação</option>
                <option value="recomposicao">Recomposição</option>
              </select>
            </div>

            {/* Núcleo filter */}
            {nucleoOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[#6b6b6b] text-xs shrink-0">Núcleo:</span>
                <select
                  value={filterNucleo}
                  onChange={(e) => setFilterNucleo(e.target.value)}
                  className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
                >
                  <option value="">Todos</option>
                  {nucleoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            <span className="text-[#6b6b6b] text-xs ml-auto">
              {filtered.length} de {activities.length} atividade{activities.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Backfill: atividades legadas sem obra → vincular à obra selecionada */}
      {semObraCount > 0 && activeObraId && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#f97316]/40 bg-[#f97316]/10 px-3 py-2 text-xs print:hidden">
          <span className="text-[#fed7aa]">
            {semObraCount} atividade(s) ainda sem obra vinculada — elas só aparecem em "Todas as obras".
          </span>
          <button onClick={handleBackfill} className="rounded-lg bg-[#f97316] px-3 py-1.5 font-semibold text-white hover:bg-[#ea580c]">
            Vincular a "{activeSiteName ?? 'obra selecionada'}"
          </button>
        </div>
      )}

      {/* View toggle: Matriz mensal (Gestão à Vista) × Tabela 360 (orçamento) */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div className="inline-flex self-start rounded-lg border border-[#525252] bg-[#1f1f1f] p-1">
        {([['matriz', 'Matriz mensal'], ['tabela360', 'Tabela 360']] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setView(k)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${view === k ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:bg-[#3a3a3a] hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>
        <span className="rounded-full border border-[#525252] bg-[#2c2c2c] px-3 py-1 text-xs text-[#a3a3a3]">
          {activeObraId ? <>Obra: <strong className="text-[#f5f5f5]">{activeSiteName ?? 'selecionada'}</strong></> : <>Vendo <strong className="text-[#f5f5f5]">todas as obras</strong></>}
        </span>
      </div>

      {view === 'matriz' && <MatrizMensalPanel activities={filtered} nuclei={nuclei} contract={contract} allObras={!activeObraId} sites={sites} />}
      {view === 'tabela360' && <Tabela360Panel activities={filtered} nuclei={nuclei} contract={contract} allObras={!activeObraId} sites={sites} />}

      {/* Plano de Execução (layout do documento) — só com uma obra selecionada (evita o "selecione uma obra" contraditório) */}
      <div className="mt-2 rounded-xl border border-[#525252] bg-[#2f2f2f] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#525252] bg-[#2c2c2c]">
          <h3 className="text-sm font-bold text-[#f5f5f5]">Planejamento de Execução (por obra)</h3>
          <p className="text-[11px] text-[#a3a3a3]">Cronograma, equipe, distribuição e condições no layout do documento — a mesma fonte da aba Execução.</p>
        </div>
        {activeObraId
          ? <ExecucaoPanel />
          : <p className="px-4 py-4 text-xs text-[#a3a3a3]">Selecione uma obra no seletor do topo para ver e editar o Plano de Execução dela aqui.</p>}
      </div>


      <ConfirmDialog
        open={deleteTarget !== null}
        title="Excluir atividade"
        message={deleteTarget ? `Tem certeza que deseja excluir "${deleteTarget.name}"? Ela será removida também do Médio Prazo, Curto Prazo e Programação Semanal. Esta ação não pode ser desfeita.` : ''}
        confirmLabel="Excluir"
        onConfirm={() => {
          if (deleteTarget) removeActivity(deleteTarget.id)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #root { display: block !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
