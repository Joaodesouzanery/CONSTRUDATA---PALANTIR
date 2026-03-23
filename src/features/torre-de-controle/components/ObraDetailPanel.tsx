import { useState } from 'react'
import { Pencil, Plus, Trash2, AlertTriangle, MapPin, Building2, Users, Calendar, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTorreStore } from '@/store/torreDeControleStore'
import type { ConstructionRisk, ConstructionSite, ObraStatus, RiskLevel, RiskStatus } from '@/types'

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ObraStatus, string> = {
  active:    'Ativa',
  planning:  'Planejamento',
  paused:    'Pausada',
  completed: 'Concluída',
}

const STATUS_COLOR: Record<ObraStatus, string> = {
  active:    'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/20',
  planning:  'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20',
  paused:    'text-[#eab308] bg-[#eab308]/10 border-[#eab308]/20',
  completed: 'text-[#a3a3a3] bg-[#a3a3a3]/10 border-[#a3a3a3]/20',
}

const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  critical: 'Crítico',
  high:     'Alto',
  medium:   'Médio',
  low:      'Baixo',
}

const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
}

const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  identified: 'Identificado',
  active:     'Ativo',
  mitigated:  'Mitigado',
  resolved:   'Resolvido',
}

// ─── Risk Card ────────────────────────────────────────────────────────────────

function RiskCard({ site, risk }: { site: ConstructionSite; risk: ConstructionRisk }) {
  const setEditingRisk  = useTorreStore((s) => s.setEditingRisk)
  const deleteRisk      = useTorreStore((s) => s.deleteRisk)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [expanded, setExpanded]           = useState(false)

  const color = RISK_LEVEL_COLOR[risk.level]

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    deleteRisk(site.id, risk.id)
    setConfirmDelete(false)
  }

  return (
    <div
      className="rounded-lg border bg-[#1a1a1a] p-3 flex flex-col gap-2"
      style={{ borderColor: color + '30' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={{ color, background: color + '15' }}
            >
              {RISK_LEVEL_LABEL[risk.level]}
            </span>
            <span className="text-[9px] text-[#6b6b6b] uppercase tracking-wide">
              {RISK_STATUS_LABEL[risk.status]}
            </span>
          </div>
          <span className="text-xs font-semibold text-[#f5f5f5] leading-snug">{risk.title}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {confirmDelete ? (
            <>
              <button
                onClick={handleDelete}
                className="text-[9px] px-1.5 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444] font-semibold hover:bg-[#ef4444]/30"
              >
                Sim
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[9px] px-1.5 py-0.5 rounded bg-[#252525] text-[#a3a3a3]"
              >
                Não
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditingRisk({ siteId: site.id, riskId: risk.id })}
                className="w-6 h-6 flex items-center justify-center rounded text-[#6b6b6b] hover:text-[#f97316] hover:bg-[#f97316]/10 transition-colors"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={handleDelete}
                className="w-6 h-6 flex items-center justify-center rounded text-[#6b6b6b] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </>
          )}
        </div>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-[10px] text-[#6b6b6b] text-left hover:text-[#a3a3a3] transition-colors"
      >
        {expanded ? risk.description : risk.description.slice(0, 90) + (risk.description.length > 90 ? '...' : '')}
        {risk.description.length > 90 && (
          <span className="ml-1 text-[#f97316]">{expanded ? '▲ menos' : '▼ mais'}</span>
        )}
      </button>

      {expanded && risk.notes && (
        <div className="text-[10px] text-[#6b6b6b] bg-[#252525] rounded p-2 border border-[#2a2a2a]">
          <span className="text-[9px] uppercase tracking-widest text-[#3f3f3f]">Notas: </span>
          {risk.notes}
        </div>
      )}

      <div className="text-[9px] text-[#3f3f3f]">
        Identificado: {new Date(risk.identifiedAt).toLocaleDateString('pt-BR')}
      </div>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function ObraDetailPanel() {
  const sites          = useTorreStore((s) => s.sites)
  const selectedId     = useTorreStore((s) => s.selectedId)
  const setEditing     = useTorreStore((s) => s.setEditing)
  const setEditingRisk = useTorreStore((s) => s.setEditingRisk)

  const site = selectedId ? sites.find((s) => s.id === selectedId) ?? null : null

  if (!site) return null

  const activeRisks   = site.risks.filter((r) => r.status === 'active').length
  const criticalRisks = site.risks.filter((r) => r.level === 'critical').length

  return (
    <div
      className="flex flex-col border-l border-[#2a2a2a] bg-[#1a1a1a] shrink-0 overflow-hidden"
      style={{ width: 380 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0 gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] text-[#6b6b6b] bg-[#252525] px-1.5 py-0.5 rounded">{site.code}</span>
            <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide', STATUS_COLOR[site.status])}>
              {STATUS_LABEL[site.status]}
            </span>
          </div>
          <h3 className="text-sm font-bold text-[#f5f5f5] leading-snug">{site.name}</h3>
        </div>
        <button
          onClick={() => setEditing(site.id)}
          className="shrink-0 flex items-center gap-1 text-[10px] text-[#6b6b6b] hover:text-[#f97316] transition-colors border border-[#2a2a2a] hover:border-[#f97316]/30 rounded-lg px-2.5 py-1.5 whitespace-nowrap"
        >
          <Pencil size={11} />
          Editar
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0">

          {/* Localização */}
          <Section icon={<MapPin size={12} />} title="Localização">
            <InfoRow label="Endereço" value={`${site.street}, ${site.number}`} />
            <InfoRow label="Bairro"   value={site.district} />
            <InfoRow label="Cidade"   value={`${site.city} / ${site.state}`} />
            <InfoRow label="CEP"      value={site.cep} />
            {site.lat != null && site.lng != null && (
              <InfoRow label="Coordenadas" value={`${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}`} mono />
            )}
          </Section>

          {/* Responsáveis */}
          <Section icon={<Users size={12} />} title="Responsáveis">
            <InfoRow label="Empresa" value={site.company} />
            <InfoRow label="Dono"    value={site.owner} />
            <InfoRow label="Gerente" value={site.manager} />
          </Section>

          {/* Edificação */}
          <Section icon={<Building2 size={12} />} title="Edificação">
            <InfoRow label="Tipo"       value={site.buildingType} />
            <InfoRow label="Área Total" value={`${site.totalArea.toLocaleString('pt-BR')} m²`} />
            <InfoRow label="Pavimentos" value={`${site.floors}`} />
          </Section>

          {/* Cronograma */}
          <Section icon={<Calendar size={12} />} title="Cronograma">
            <InfoRow label="Início"    value={site.startDate} />
            <InfoRow label="Previsão"  value={site.expectedEnd} />
          </Section>

          {/* Descrição */}
          {site.description && (
            <Section icon={<FileText size={12} />} title="Descrição">
              <p className="text-xs text-[#a3a3a3] leading-relaxed">{site.description}</p>
            </Section>
          )}

          {/* Riscos */}
          <div className="px-4 py-3 border-b border-[#2a2a2a]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={12} className="text-[#6b6b6b]" />
                <span className="text-[10px] uppercase tracking-widest font-semibold text-[#6b6b6b]">
                  Riscos
                </span>
                {(activeRisks > 0 || criticalRisks > 0) && (
                  <span className={cn(
                    'text-[9px] font-semibold px-1.5 py-0.5 rounded',
                    criticalRisks > 0 ? 'text-[#ef4444] bg-[#ef4444]/10' : 'text-[#f97316] bg-[#f97316]/10'
                  )}>
                    {criticalRisks > 0 ? `${criticalRisks} crítico${criticalRisks > 1 ? 's' : ''}` : `${activeRisks} ativo${activeRisks > 1 ? 's' : ''}`}
                  </span>
                )}
              </div>
              <button
                onClick={() => setEditingRisk({ siteId: site.id, riskId: 'new' })}
                className="flex items-center gap-1 text-[10px] text-[#6b6b6b] hover:text-[#f97316] transition-colors"
              >
                <Plus size={11} />
                Adicionar
              </button>
            </div>

            {site.risks.length === 0 ? (
              <p className="text-[10px] text-[#3f3f3f] text-center py-4">Nenhum risco cadastrado</p>
            ) : (
              <div className="flex flex-col gap-2">
                {/* Sort: critical first, then by status (active before resolved) */}
                {[...site.risks]
                  .sort((a, b) => {
                    const levelOrder = { critical: 0, high: 1, medium: 2, low: 3 }
                    return levelOrder[a.level] - levelOrder[b.level]
                  })
                  .map((risk) => (
                    <RiskCard key={risk.id} site={site} risk={risk} />
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-[#2a2a2a] flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[#6b6b6b]">
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-semibold">{title}</span>
      </div>
      <div className="flex flex-col gap-1.5 pl-4">
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] text-[#6b6b6b] shrink-0 w-20">{label}</span>
      <span className={cn('text-xs text-[#f5f5f5] flex-1', mono && 'font-mono text-[11px]')}>{value}</span>
    </div>
  )
}
