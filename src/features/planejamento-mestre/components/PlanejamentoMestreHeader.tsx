/**
 * PlanejamentoMestreHeader — KPI strip + tab navigation for Planejamento Mestre.
 * Includes baseline management (save/load/delete) and "Criar Planejamento" button.
 */
import { useState } from 'react'
import { BrainCircuit, Plus, Save, ChevronDown, Trash2 } from 'lucide-react'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { getProjectDateRange, daysBetween } from '../utils/masterEngine'
import type { PlanejamentoMestreTab } from '@/types'

const TABS: { key: PlanejamentoMestreTab; label: string }[] = [
  { key: 'macro',     label: 'Longo Prazo'     },
  { key: 'derivacao', label: 'Médio Prazo'     },
  { key: 'whatif',    label: 'Curto Prazo'     },
  { key: 'integrada', label: 'Visão Integrada' },
  { key: 'semanal',   label: 'Prog. Semanal'   },
  { key: 'restricoes', label: 'Planejamento por Restrições' },
]

interface Props {
  onNewProject: () => void
}

function SaveBaselineModal({ onClose }: { onClose: () => void }) {
  const saveBaseline = usePlanejamentoMestreStore((s) => s.saveBaseline)
  const [name, setName] = useState('')

  function handleSave() {
    if (!name.trim()) return
    saveBaseline(name.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252] flex items-center justify-between">
          <span className="text-white font-semibold text-sm">Salvar Baseline</span>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="p-5">
          <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Nome da Baseline</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            placeholder="ex.: Baseline Aprovada v1"
            className="w-full bg-[#1f1f1f] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
          />
        </div>
        <div className="px-5 py-3 border-t border-[#525252] flex justify-end gap-2 bg-[#1f1f1f]">
          <button onClick={onClose} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-5 py-2 text-xs font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#f97316' }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function BaselineDropdown({ onClose }: { onClose: () => void }) {
  const baselines     = usePlanejamentoMestreStore((s) => s.baselines)
  const activeBlId    = usePlanejamentoMestreStore((s) => s.activeBaselineId)
  const loadBaseline  = usePlanejamentoMestreStore((s) => s.loadBaseline)
  const removeBaseline = usePlanejamentoMestreStore((s) => s.removeBaseline)

  if (baselines.length === 0) return null

  return (
    <div className="absolute right-0 top-full mt-1 z-40 w-64 bg-[#2c2c2c] border border-[#525252] rounded-xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="px-3 py-2 border-b border-[#525252]">
        <p className="text-[9px] uppercase tracking-widest text-[#6b6b6b] font-semibold">Baselines salvas</p>
      </div>
      {baselines.map((b) => (
        <div
          key={b.id}
          className={`flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-[#3a3a3a] ${b.id === activeBlId ? 'bg-[#f97316]/10' : ''}`}
          onClick={() => { loadBaseline(b.id); onClose() }}
        >
          <span className={`text-xs font-medium ${b.id === activeBlId ? 'text-[#f97316]' : 'text-[#f5f5f5]'}`}>{b.name}</span>
          <button
            className="p-1 text-[#6b6b6b] hover:text-red-400 transition-colors rounded"
            onClick={(e) => { e.stopPropagation(); removeBaseline(b.id) }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function PlanejamentoMestreHeader({ onNewProject }: Props) {
  const activeTab   = usePlanejamentoMestreStore((s) => s.activeTab)
  const setTab      = usePlanejamentoMestreStore((s) => s.setActiveTab)
  const activities  = usePlanejamentoMestreStore((s) => s.activities)
  const baselines   = usePlanejamentoMestreStore((s) => s.baselines)
  const activeBlId  = usePlanejamentoMestreStore((s) => s.activeBaselineId)

  const [saveModalOpen,     setSaveModalOpen]     = useState(false)
  const [baselineDropOpen,  setBaselineDropOpen]  = useState(false)

  const totalActivities = activities.filter((a) => a.level >= 1 && !a.isMilestone).length
  const avgComplete     = activities.length > 0
    ? Math.round(activities.reduce((s, a) => s + (a.weight ?? 1) * a.percentComplete, 0) /
        Math.max(1, activities.reduce((s, a) => s + (a.weight ?? 1), 0)))
    : 0
  const activeBaseline = baselines.find((b) => b.id === activeBlId)?.name ?? '—'
  const { end } = getProjectDateRange(activities)
  const daysRemaining = activities.length > 0
    ? daysBetween(new Date().toISOString().slice(0, 10), end)
    : 0

  return (
    <>
      <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
        {/* Title + KPIs + Actions */}
        <div className="px-6 py-3 flex items-center justify-between gap-4 flex-wrap border-b border-[#525252]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
              <BrainCircuit size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-[#f5f5f5] font-semibold text-base leading-tight">Planejamento</h1>
              <p className="text-[#6b6b6b] text-xs">Longo, Médio e Curto Prazo</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* KPIs */}
            <div className="flex gap-4 mr-2">
              {[
                { label: 'Atividades', value: String(totalActivities) },
                { label: '% Concluído', value: `${avgComplete}%` },
                { label: 'Dias p/ fim', value: daysRemaining > 0 ? String(daysRemaining) : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">{label}</p>
                  <p className="text-sm font-bold text-[#f5f5f5] tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            {/* Baseline dropdown */}
            <div className="relative">
              <button
                onClick={() => setBaselineDropOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
              >
                <span className="max-w-[120px] truncate">{activeBaseline === '—' ? 'Baselines' : activeBaseline}</span>
                <ChevronDown size={12} />
              </button>
              {baselineDropOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setBaselineDropOpen(false)} />
                  <BaselineDropdown onClose={() => setBaselineDropOpen(false)} />
                </>
              )}
            </div>

            {/* Save baseline */}
            <button
              onClick={() => setSaveModalOpen(true)}
              disabled={activities.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={13} />
              Salvar Baseline
            </button>

            {/* Create planning */}
            <button
              onClick={onNewProject}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors"
              style={{ backgroundColor: '#f97316' }}
            >
              <Plus size={13} />
              Criar Planejamento
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-[#3d3d3d] text-[#f97316] border-b-2 border-[#f97316]'
                  : 'text-[#6b6b6b] hover:text-[#a3a3a3] hover:bg-[#3d3d3d]/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {saveModalOpen && <SaveBaselineModal onClose={() => setSaveModalOpen(false)} />}
    </>
  )
}
