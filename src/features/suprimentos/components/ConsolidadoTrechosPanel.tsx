import { useMemo, useState } from 'react'
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
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const nucleos = useMemo(() => [...new Set(consolidadoTrechos.map((t) => t.nucleo))].sort(), [consolidadoTrechos])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return consolidadoTrechos.filter((t) => {
      if (filterNucleo && t.nucleo !== filterNucleo) return false
      if (filterTipo && t.tipo !== filterTipo) return false
      if (filterStatus && t.status !== filterStatus) return false
      if (!q) return true
      return [t.rua, t.ns, t.pvMont, t.pvJus ?? ''].some((value) => value.toLowerCase().includes(q))
    })
  }, [consolidadoTrechos, filterNucleo, filterTipo, filterStatus, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageData = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)
  const countExec = filtered.filter((t) => t.status === 'EXECUTADO').length
  const countPend = filtered.filter((t) => t.status === 'PENDENTE').length
  const countCad = filtered.filter((t) => t.status === 'CADASTRO').length

  if (consolidadoTrechos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16">
        <div className="w-14 h-14 rounded-2xl bg-[#3d3d3d] border border-[#525252] flex items-center justify-center">
          <Upload size={24} className="text-[#6b6b6b]" />
        </div>
        <p className="text-[#6b6b6b] text-sm font-medium">Nenhum dado de Consolidado importado</p>
        <p className="text-[#525252] text-xs">Use o botao "Importar Planilha" acima para carregar a planilha de Consolidado Trechos.</p>
      </div>
    )
  }

  function resetPage(fn: () => void) {
    fn()
    setPage(0)
  }

  return (
    <div className="flex flex-col gap-3 overflow-hidden flex-1">
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <select value={filterNucleo} onChange={(e) => resetPage(() => setFilterNucleo(e.target.value))} className="px-2.5 py-1.5 rounded-lg text-xs bg-[#3d3d3d] border border-[#525252] text-[#f5f5f5] outline-none">
          <option value="">Todos os Nucleos</option>
          {nucleos.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={filterTipo} onChange={(e) => resetPage(() => setFilterTipo(e.target.value as typeof filterTipo))} className="px-2.5 py-1.5 rounded-lg text-xs bg-[#3d3d3d] border border-[#525252] text-[#f5f5f5] outline-none">
          <option value="">Todos os Tipos</option>
          <option value="AGUA">Agua</option>
          <option value="ESGOTO">Esgoto</option>
        </select>
        <select value={filterStatus} onChange={(e) => resetPage(() => setFilterStatus(e.target.value as typeof filterStatus))} className="px-2.5 py-1.5 rounded-lg text-xs bg-[#3d3d3d] border border-[#525252] text-[#f5f5f5] outline-none">
          <option value="">Todos os Status</option>
          <option value="EXECUTADO">Executado</option>
          <option value="PENDENTE">Pendente</option>
          <option value="CADASTRO">Cadastro</option>
        </select>
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
          <input value={search} onChange={(e) => resetPage(() => setSearch(e.target.value))} placeholder="Buscar rua, NS, PV..." className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[#3d3d3d] border border-[#525252] text-[#f5f5f5] outline-none w-56 placeholder:text-[#6b6b6b]" />
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] font-semibold shrink-0">
        <span className="text-[#a3a3a3]">{filtered.length} trechos</span>
        <span className="text-[#4ade80]">{countExec} executados</span>
        <span className="text-[#f87171]">{countPend} pendentes</span>
        <span className="text-[#6b6b6b]">{countCad} cadastro</span>
      </div>

      <div className="border border-[#525252] rounded-xl overflow-hidden flex-1">
        <div className="overflow-auto max-h-[calc(100vh-400px)]">
          <table className="w-full text-xs">
            <thead className="bg-[#3d3d3d] sticky top-0 z-10">
              <tr>
                {['Nucleo', 'Tipo', 'Rua', 'NS', 'PV Mont', 'PV Jus', 'DN', 'Ext', 'm Exec', 'm Pend', 'Mat', 'Status', 'Data Exec'].map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-[#a3a3a3] font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map((t, i) => {
                const st = STATUS_STYLE[t.status]
                const mExec = t.status === 'EXECUTADO' ? t.extM : 0
                const mPend = t.status === 'PENDENTE' ? t.extM : 0
                return (
                  <tr key={`${t.nucleo}-${t.ns}-${i}`} className={cn('border-t border-[#525252]/50 hover:bg-[#484848]/50', i % 2 === 0 ? 'bg-transparent' : 'bg-[#3d3d3d]/30')}>
                    <td className="px-2 py-1.5 text-[#f5f5f5] font-medium whitespace-nowrap">{t.nucleo}</td>
                    <td className="px-2 py-1.5 text-[#a3a3a3]">{t.tipo}</td>
                    <td className="px-2 py-1.5 text-[#a3a3a3] max-w-[220px] truncate" title={t.rua}>{t.rua}</td>
                    <td className="px-2 py-1.5 text-[#a3a3a3]">{t.ns}</td>
                    <td className="px-2 py-1.5 text-[#a3a3a3]">{t.pvMont}</td>
                    <td className="px-2 py-1.5 text-[#a3a3a3]">{t.pvJus}</td>
                    <td className="px-2 py-1.5 text-right text-[#a3a3a3]">{t.dnMm}</td>
                    <td className="px-2 py-1.5 text-right text-[#f5f5f5]">{t.extM.toLocaleString('pt-BR')}</td>
                    <td className="px-2 py-1.5 text-right text-[#4ade80]">{mExec.toLocaleString('pt-BR')}</td>
                    <td className="px-2 py-1.5 text-right text-[#f87171]">{mPend.toLocaleString('pt-BR')}</td>
                    <td className="px-2 py-1.5 text-center text-[#a3a3a3]">{t.mat}</td>
                    <td className="px-2 py-1.5"><span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', st.bg, st.text)}>{st.label}</span></td>
                    <td className="px-2 py-1.5 text-[#a3a3a3]">{t.dataExec ?? '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[#6b6b6b]">
        <span>Pagina {safePage + 1} de {totalPages}</span>
        <div className="flex gap-1">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} className="p-1 rounded border border-[#525252] disabled:opacity-40"><ChevronLeft size={14} /></button>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1} className="p-1 rounded border border-[#525252] disabled:opacity-40"><ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  )
}
