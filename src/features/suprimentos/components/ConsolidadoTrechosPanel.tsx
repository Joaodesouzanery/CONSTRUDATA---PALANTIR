/**
 * ConsolidadoTrechosPanel — Consolidado Trechos from Planilhas Consolidadas.
 * Filterable table with status colors (verde/vermelho/cinza) and pagination.
 */
import { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, Upload } from 'lucide-react'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import type { ConsolidadoTrecho } from '@/data/mockPlanilhasConsolidadas'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 30

const STATUS_STYLE: Record<ConsolidadoTrecho['status'], { bg: string; text: string; label: string }> = {
  EXECUTADO: { bg: 'bg-[#16a34a]/20', text: 'text-[#4ade80]', label: 'Executado' },
  PENDENTE:  { bg: 'bg-[#dc2626]/20', text: 'text-[#f87171]', label: 'Pendente' },
  CADASTRO:  { bg: 'bg-[#525252]/30', text: 'text-[#a3a3a3]', label: 'Cadastro' },
}

export function ConsolidadoTrechosPanel() {
  const consolidadoTrechos = useSuprimentosStore((s) => s.planilhaTrechos)

  const [filterNucleo, setFilterNucleo] = useState('')
  const [filterTipo, setFilterTipo] = useState<'' | 'AGUA' | 'ESGOTO'>('')
  const [filterStatus, setFilterStatus] = useState<'' | 'EXECUTADO' | 'PENDENTE' | 'CADASTRO'>('')
  const [filterPct, setFilterPct] = useState<'' | '0' | '50' | '100'>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const nucleos = useMemo(() => [...new Set(consolidadoTrechos.map((t) => t.nucleo))].sort(), [consolidadoTrechos])

  if (consolidadoTrechos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16">
        <div className="w-14 h-14 rounded-2xl bg-[#3d3d3d] border border-[#525252] flex items-center justify-center">
          <Upload size={24} className="text-[#6b6b6b]" />
        </div>
        <p className="text-[#6b6b6b] text-sm font-medium">Nenhum dado de Consolidado importado</p>
        <p className="text-[#525252] text-xs">Use o botão "Importar Planilha" acima para carregar a planilha de Consolidado Trechos.</p>
      </div>
    )
  }

  const filtered = useMemo(() => {
    let data = consolidadoTrechos
    if (filterNucleo) data = data.filter((t) => t.nucleo === filterNucleo)
    if (filterTipo)   data = data.filter((t) => t.tipo === filterTipo)
    if (filterStatus) data = data.filter((t) => t.status === filterStatus)
    if (filterPct) data = data.filter((t) => (t.status === 'EXECUTADO' ? 100 : 0) >= Number(filterPct))
    if (search.trim()) {
      const q = search.toLowerCase()
      data = data.filter(
        (t) =>
          t.rua.toLowerCase().includes(q) ||
          t.ns.toLowerCase().includes(q) ||
          t.pvMont.toLowerCase().includes(q) ||
          (t.pvJus ?? '').toLowerCase().includes(q),
      )
    }
    return data
  }, [consolidadoTrechos, filterNucleo, filterTipo, filterStatus, filterPct, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageData = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  // Counters
  const countExec = filtered.filter((t) => t.status === 'EXECUTADO').length
  const countPend = filtered.filter((t) => t.status === 'PENDENTE').length
  const countCad  = filtered.filter((t) => t.status === 'CADASTRO').length

  return (
    <div className="flex flex-col gap-3 overflow-hidden flex-1">
      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <select
          value={filterNucleo}
          onChange={(e) => { setFilterNucleo(e.target.value); setPage(0) }}
          className="px-2.5 py-1.5 rounded-lg text-xs bg-[#3d3d3d] border border-[#525252] text-[#f5f5f5] outline-none"
        >
          <option value="">Todos os Núcleos</option>
          {nucleos.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>

        <select
          value={filterTipo}
          onChange={(e) => { setFilterTipo(e.target.value as typeof filterTipo); setPage(0) }}
          className="px-2.5 py-1.5 rounded-lg text-xs bg-[#3d3d3d] border border-[#525252] text-[#f5f5f5] outline-none"
        >
          <option value="">Todos os Tipos</option>
          <option value="AGUA">Água</option>
          <option value="ESGOTO">Esgoto</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as typeof filterStatus); setPage(0) }}
          className="px-2.5 py-1.5 rounded-lg text-xs bg-[#3d3d3d] border border-[#525252] text-[#f5f5f5] outline-none"
        >
          <option value="">Todos os Status</option>
          <option value="EXECUTADO">Executado</option>
          <option value="PENDENTE">Pendente</option>
          <option value="CADASTRO">Cadastro</option>
        </select>

        <select
          value={filterPct}
          onChange={(e) => { setFilterPct(e.target.value as typeof filterPct); setPage(0) }}
          className="px-2.5 py-1.5 rounded-lg text-xs bg-[#3d3d3d] border border-[#525252] text-[#f5f5f5] outline-none"
        >
          <option value="">Qualquer %</option>
          <option value="0">0%+</option>
          <option value="50">50%+</option>
          <option value="100">100%</option>
        </select>

        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Buscar rua, NS, PV..."
            className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[#3d3d3d] border border-[#525252] text-[#f5f5f5] outline-none w-56 placeholder:text-[#6b6b6b]"
          />
        </div>
      </div>

      {/* Counters */}
      <div className="flex items-center gap-3 text-[10px] font-semibold shrink-0">
        <span className="text-[#a3a3a3]">{filtered.length} trechos</span>
        <span className="text-[#4ade80]">{countExec} executados</span>
        <span className="text-[#f87171]">{countPend} pendentes</span>
        <span className="text-[#6b6b6b]">{countCad} cadastro</span>
      </div>

      {/* Table */}
      <div className="border border-[#525252] rounded-xl overflow-hidden flex-1">
        <div className="overflow-auto max-h-[calc(100vh-400px)]">
          <table className="w-full text-xs">
            <thead className="bg-[#3d3d3d] sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2 text-[#a3a3a3] font-semibold">Núcleo</th>
                <th className="text-center px-2 py-2 text-[#a3a3a3] font-semibold">Tipo</th>
                <th className="text-left px-2 py-2 text-[#a3a3a3] font-semibold">Rua</th>
                <th className="text-left px-2 py-2 text-[#a3a3a3] font-semibold">NS</th>
                <th className="text-left px-2 py-2 text-[#a3a3a3] font-semibold">PV Mont</th>
                <th className="text-left px-2 py-2 text-[#a3a3a3] font-semibold">PV Jus</th>
                <th className="text-right px-2 py-2 text-[#a3a3a3] font-semibold">DN(mm)</th>
                <th className="text-right px-2 py-2 text-[#a3a3a3] font-semibold">Ext(m)</th>
                <th className="text-right px-2 py-2 text-[#a3a3a3] font-semibold">m Exec</th>
                <th className="text-right px-2 py-2 text-[#a3a3a3] font-semibold">m Pend</th>
                <th className="text-center px-2 py-2 text-[#a3a3a3] font-semibold">Mat</th>
                <th className="text-center px-2 py-2 text-[#a3a3a3] font-semibold">Status</th>
                <th className="text-left px-2 py-2 text-[#a3a3a3] font-semibold">Data Exec</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((t, i) => {
                const st = STATUS_STYLE[t.status]
                const mExec = t.status === 'EXECUTADO' ? t.extM : 0
                const mPend = t.status === 'PENDENTE' ? t.extM : 0
                return (
                  <tr
                    key={`${t.nucleo}-${t.ns}-${i}`}
                    className={cn(
                      'border-t border-[#525252]/50 hover:bg-[#484848]/50 transition-colors',
                      i % 2 === 0 ? 'bg-transparent' : 'bg-[#3d3d3d]/30',
                    )}
                  >
                    <td className="px-3 py-1.5 text-[#f5f5f5] font-medium whitespace-nowrap">{t.nucleo}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-bold',
                        t.tipo === 'AGUA'
                          ? 'bg-[#3b82f6]/20 text-[#60a5fa]'
                          : 'bg-[#a855f7]/20 text-[#c084fc]',
                      )}>
                        {t.tipo}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-[#a3a3a3] max-w-[180px] truncate" title={t.rua}>{t.rua}</td>
                    <td className="px-2 py-1.5 text-[#a3a3a3] tabular-nums">{t.ns}</td>
                    <td className="px-2 py-1.5 text-[#6b6b6b] text-[10px] max-w-[120px] truncate" title={t.pvMont}>{t.pvMont}</td>
                    <td className="px-2 py-1.5 text-[#6b6b6b] text-[10px] max-w-[120px] truncate" title={t.pvJus ?? ''}>{t.pvJus ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right text-[#a3a3a3] tabular-nums">{t.dnMm ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right text-[#f5f5f5] tabular-nums font-medium">{t.extM.toFixed(1)}</td>
                    <td className="px-2 py-1.5 text-right text-[#4ade80] tabular-nums">{mExec.toFixed(1)}</td>
                    <td className="px-2 py-1.5 text-right text-[#f87171] tabular-nums">{mPend.toFixed(1)}</td>
                    <td className="px-2 py-1.5 text-center text-[#a3a3a3]">{t.mat}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', st.bg, st.text)}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-[#a3a3a3] tabular-nums">{t.dataExec ?? '—'}</td>
                  </tr>
                )
              })}
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-[#6b6b6b]">
                    Nenhum trecho encontrado com os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between shrink-0 text-xs text-[#a3a3a3]">
        <span>
          Mostrando {filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="p-1 rounded hover:bg-[#484848] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 tabular-nums">{safePage + 1} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="p-1 rounded hover:bg-[#484848] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
