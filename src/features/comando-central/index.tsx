/**
 * Comando Central — Executive cockpit unificado.
 *
 * Sprint Ontologia Unificada — Camada 5.
 *
 * Lê a materialized view `project_dashboard_view` (via RPC `get_project_dashboard`)
 * que agrega KPIs cross-module em tempo real:
 *   - BAC / AC (EVM)
 *   - % progresso (Planejamento)
 *   - RDO count + último RDO (Campo)
 *   - FVS count + restrições LPS abertas (Qualidade + Lean)
 *   - Workers + absences + equipamentos (Recursos)
 *   - POs abertas (Suprimentos)
 *   - Health derivado (verde/amarelo/vermelho)
 *
 * Auto-refresh quando Realtime emite mudança em qualquer tabela cross-module.
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { eventBus } from '@/lib/eventBus'

interface ProjectDashboardRow {
  project_id:        string
  organization_id:   string
  code:              string
  name:              string
  status:            string
  start_date:        string | null
  end_date:          string | null
  bac_brl:           number
  ac_brl:            number
  percent_complete:  number
  rdo_count:         number
  last_rdo_date:     string | null
  fvs_count:         number
  open_restrictions: number
  worker_count:      number
  open_absences:     number
  equipment_count:   number
  open_pos:          number
  health:            'green' | 'yellow' | 'red'
  computed_at:       string
}

const HEALTH_COLOR: Record<string, string> = {
  green:  '#22c55e',
  yellow: '#eab308',
  red:    '#ef4444',
}

const HEALTH_LABEL: Record<string, string> = {
  green:  'Saudável',
  yellow: 'Atenção',
  red:    'Crítico',
}

function formatBrl(v: number | null | undefined): string {
  if (v == null) return 'R$ —'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

export function ComandoCentralPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [rows, setRows] = useState<ProjectDashboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    if (!profile) return
    setError(null)
    try {
      // Tenta primeiro a RPC SECURITY DEFINER (filtra por user_org)
      const { data, error: rpcErr } = await supabase.rpc('get_project_dashboard')
      if (rpcErr) {
        // Fallback: SELECT direto na view (com filtro manual)
        const { data: viewData, error: viewErr } = await supabase
          .from('project_dashboard_view')
          .select('*')
          .eq('organization_id', profile.organization_id)
        if (viewErr) throw viewErr
        setRows((viewData ?? []) as ProjectDashboardRow[])
      } else {
        setRows((data ?? []) as ProjectDashboardRow[])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      console.warn('[comando-central] fetch failed', msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [profile])

  // Initial load + refresh em mudanças do profile
  useEffect(() => {
    void fetchDashboard()
  }, [fetchDashboard])

  // Realtime: re-fetch quando qualquer tabela cross-module mudar
  useEffect(() => {
    const off = eventBus.on('realtime.row_changed', () => {
      void fetchDashboard()
    })
    return () => off()
  }, [fetchDashboard])

  // Refresh manual: chama refresh_project_dashboard RPC + re-fetch
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await supabase.rpc('refresh_project_dashboard')
    } catch (err) {
      console.warn('[comando-central] refresh rpc failed', err)
    }
    await fetchDashboard()
  }, [fetchDashboard])

  // KPIs agregados da org (header)
  const totalBac = rows.reduce((s, r) => s + (r.bac_brl ?? 0), 0)
  const totalAc  = rows.reduce((s, r) => s + (r.ac_brl ?? 0), 0)
  const greenCount  = rows.filter((r) => r.health === 'green').length
  const yellowCount = rows.filter((r) => r.health === 'yellow').length
  const redCount    = rows.filter((r) => r.health === 'red').length
  const healthPct = rows.length > 0 ? Math.round((greenCount / rows.length) * 100) : 0

  const selected = selectedProjectId ? rows.find((r) => r.project_id === selectedProjectId) : null

  return (
    <div className="flex flex-col h-full overflow-auto bg-[#2c2c2c]">
      {/* Header */}
      <div className="border-b border-[#525252] bg-[#333333] sticky top-0 z-10">
        <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-white text-xl sm:text-2xl font-bold">Comando Central</h1>
            <p className="text-[#a3a3a3] text-xs sm:text-sm">
              Visão executiva agregada de todos os projetos · auto-atualização realtime
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-50 text-black px-4 py-2 rounded-md text-sm font-semibold transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* KPIs agregados */}
        {!loading && rows.length > 0 && (
          <div className="px-4 sm:px-6 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiBox label="Soma BAC" value={formatBrl(totalBac)} accent />
            <KpiBox label="Soma AC" value={formatBrl(totalAc)} />
            <KpiBox label="Health geral" value={`${healthPct}% verde`} accent={healthPct >= 70} />
            <KpiBox label="Projetos" value={`${rows.length}`} sub={`${greenCount}🟢 ${yellowCount}🟡 ${redCount}🔴`} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-[#a3a3a3] text-sm">
            <Clock className="animate-spin mr-2" size={16} />
            Carregando dashboard...
          </div>
        ) : error ? (
          <div className="bg-red-900/30 border border-red-700/50 rounded-md p-4 text-red-300 text-sm">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <AlertTriangle size={14} />
              Erro ao carregar dashboard
            </div>
            <div className="text-xs">{error}</div>
            <div className="text-xs mt-2 opacity-75">
              Verifique se as migrations 0035/0036 foram aplicadas no Supabase.
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center text-[#a3a3a3] text-sm py-12">
            <CheckCircle2 size={32} className="mx-auto mb-3 opacity-50" />
            <p>Nenhum projeto cadastrado ainda.</p>
            <button
              onClick={() => navigate('/app/projetos')}
              className="mt-3 text-[#f97316] hover:underline text-xs"
            >
              Criar primeiro projeto →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((row) => (
              <ProjectHealthCard
                key={row.project_id}
                row={row}
                onClick={() => setSelectedProjectId(row.project_id)}
                isSelected={selectedProjectId === row.project_id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drill-down panel */}
      {selected && (
        <ProjectDrillDown row={selected} onClose={() => setSelectedProjectId(null)} navigate={navigate} />
      )}
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function KpiBox({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-md p-3">
      <div className="text-[10px] text-[#a3a3a3] uppercase tracking-wider">{label}</div>
      <div className={`text-lg sm:text-xl font-bold ${accent ? 'text-[#f97316]' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-[#6b6b6b] mt-0.5">{sub}</div>}
    </div>
  )
}

function ProjectHealthCard({
  row,
  onClick,
  isSelected,
}: {
  row: ProjectDashboardRow
  onClick: () => void
  isSelected: boolean
}) {
  const cpi = row.ac_brl > 0 ? (row.bac_brl / row.ac_brl).toFixed(2) : '—'
  const healthBg = {
    green:  'bg-green-900/20 border-green-700/40',
    yellow: 'bg-yellow-900/20 border-yellow-700/40',
    red:    'bg-red-900/20 border-red-700/40',
  }[row.health] ?? 'bg-[#3d3d3d] border-[#525252]'

  return (
    <button
      onClick={onClick}
      className={`text-left ${healthBg} ${isSelected ? 'ring-2 ring-[#f97316]' : ''} border rounded-md p-4 hover:bg-[#3d3d3d] transition-colors`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[10px] text-[#a3a3a3] font-mono">{row.code}</div>
          <div className="text-white text-sm font-semibold">{row.name}</div>
        </div>
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
          style={{ backgroundColor: HEALTH_COLOR[row.health] }}
          title={HEALTH_LABEL[row.health]}
        />
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-[#a3a3a3] mb-1">
          <span>Progresso</span>
          <span className="font-mono">{(row.percent_complete ?? 0).toFixed(1)}%</span>
        </div>
        <div className="h-1.5 bg-[#484848] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#f97316] rounded-full transition-all"
            style={{ width: `${Math.min(100, row.percent_complete ?? 0)}%` }}
          />
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <KpiMini label="BAC" value={formatBrl(row.bac_brl)} />
        <KpiMini label="AC" value={formatBrl(row.ac_brl)} />
        <KpiMini label="CPI" value={cpi} />
        <KpiMini label="RDOs" value={`${row.rdo_count}`} />
      </div>

      {/* Alertas */}
      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
        {row.open_restrictions > 0 && (
          <Badge color="yellow">{row.open_restrictions} restrições</Badge>
        )}
        {row.fvs_count > 0 && <Badge color="blue">{row.fvs_count} FVS</Badge>}
        {row.open_pos > 0 && <Badge color="purple">{row.open_pos} POs</Badge>}
        {row.equipment_count > 0 && (
          <Badge color="gray">{row.equipment_count} eq.</Badge>
        )}
        {row.open_absences > 0 && (
          <Badge color="red">{row.open_absences} faltas</Badge>
        )}
      </div>
    </button>
  )
}

function KpiMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[#6b6b6b] uppercase tracking-wider text-[9px]">{label}</div>
      <div className="text-white font-mono text-xs">{value}</div>
    </div>
  )
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const colorClass = {
    yellow: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
    blue:   'bg-blue-900/40 text-blue-300 border-blue-700/50',
    purple: 'bg-violet-900/40 text-violet-300 border-violet-700/50',
    gray:   'bg-gray-700/50 text-gray-300 border-gray-600',
    red:    'bg-red-900/40 text-red-300 border-red-700/50',
  }[color] ?? 'bg-gray-700/50 text-gray-300 border-gray-600'
  return (
    <span className={`${colorClass} border rounded px-1.5 py-0.5 font-medium`}>{children}</span>
  )
}

function ProjectDrillDown({
  row,
  onClose,
  navigate,
}: {
  row: ProjectDashboardRow
  onClose: () => void
  navigate: (path: string) => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex justify-end"
      onClick={onClose}
    >
      <div
        className="bg-[#333333] w-full max-w-md h-full overflow-y-auto border-l border-[#525252] p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[10px] text-[#a3a3a3] font-mono">{row.code}</div>
            <h2 className="text-white text-lg font-bold">{row.name}</h2>
            <div className="text-xs text-[#a3a3a3] capitalize mt-1">{row.status}</div>
          </div>
          <button
            onClick={onClose}
            className="text-[#a3a3a3] hover:text-white p-2"
          >
            ✕
          </button>
        </div>

        {/* Health */}
        <div
          className="rounded-md p-3 mb-4 border"
          style={{
            backgroundColor: `${HEALTH_COLOR[row.health]}20`,
            borderColor: `${HEALTH_COLOR[row.health]}80`,
          }}
        >
          <div className="text-xs text-[#a3a3a3]">Saúde do projeto</div>
          <div className="text-lg font-bold" style={{ color: HEALTH_COLOR[row.health] }}>
            {HEALTH_LABEL[row.health]}
          </div>
        </div>

        {/* KPIs detalhados */}
        <div className="space-y-2 mb-6">
          <DetailRow label="BAC (orçado)" value={formatBrl(row.bac_brl)} />
          <DetailRow label="AC (real)" value={formatBrl(row.ac_brl)} />
          <DetailRow
            label="Saldo"
            value={formatBrl((row.bac_brl ?? 0) - (row.ac_brl ?? 0))}
          />
          <DetailRow label="Progresso" value={`${(row.percent_complete ?? 0).toFixed(1)}%`} />
          <DetailRow label="Início" value={formatDate(row.start_date)} />
          <DetailRow label="Fim previsto" value={formatDate(row.end_date)} />
          <DetailRow label="Total de RDOs" value={`${row.rdo_count}`} />
          <DetailRow label="Último RDO" value={formatDate(row.last_rdo_date)} />
          <DetailRow label="Restrições LPS abertas" value={`${row.open_restrictions}`} />
          <DetailRow label="FVS registrados" value={`${row.fvs_count}`} />
          <DetailRow label="POs abertas" value={`${row.open_pos}`} />
          <DetailRow label="Workers ativos" value={`${row.worker_count}`} />
          <DetailRow label="Faltas hoje" value={`${row.open_absences}`} />
          <DetailRow label="Equipamentos no projeto" value={`${row.equipment_count}`} />
        </div>

        {/* Atalhos para módulos */}
        <div className="space-y-2">
          <div className="text-[10px] text-[#6b6b6b] uppercase tracking-wider mb-2">
            Drill-down por módulo
          </div>
          {[
            { label: 'Ver no Planejamento', path: '/app/planejamento' },
            { label: 'Ver no RDO', path: '/app/rdo' },
            { label: 'Ver no EVM', path: '/app/evm' },
            { label: 'Ver na Qualidade', path: '/app/qualidade' },
            { label: 'Ver no LPS', path: '/app/lps-lean' },
          ].map((m) => (
            <button
              key={m.path}
              onClick={() => navigate(m.path)}
              className="w-full text-left bg-[#3d3d3d] hover:bg-[#484848] border border-[#525252] rounded-md px-3 py-2 text-sm text-white transition-colors"
            >
              {m.label} →
            </button>
          ))}
        </div>

        <div className="mt-6 text-[10px] text-[#6b6b6b] text-center">
          Computado em: {new Date(row.computed_at).toLocaleString('pt-BR')}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-[#a3a3a3]">{label}</span>
      <span className="text-white font-mono">{value}</span>
    </div>
  )
}
