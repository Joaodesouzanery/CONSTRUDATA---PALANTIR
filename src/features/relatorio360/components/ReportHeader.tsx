import { useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Building2, FileDown, CalendarRange } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import { useCurrentDate, useCurrentReport } from '@/hooks/useRelatorio360'
import { printRelatorio360PDF } from '../utils/relatorio360PdfExport'

export function ReportHeader() {
  const currentDate   = useCurrentDate()
  const report        = useCurrentReport()
  const { goToPrevDay, goToNextDay, goToDate, reports } = useRelatorio360Store()

  const [showPeriod, setShowPeriod]   = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd]     = useState('')

  // Module area selection for PDF export
  const [pdfSections, setPdfSections] = useState({
    atividades:   true,
    equipes:      true,
    equipamentos: true,
    materiais:    true,
    fotos:        true,
    lps:          true,
    planejamento: true,
    suprimentos:  true,
    qualidade:    true,
    financeiro:   true,
    maoDeObra:    true,
  })

  function toggleSection(key: keyof typeof pdfSections) {
    setPdfSections((s) => ({ ...s, [key]: !s[key] }))
  }

  const safeCurrentDate = /^\d{4}-\d{2}-\d{2}$/.test(currentDate)
    ? currentDate
    : new Date().toISOString().slice(0, 10)
  const displayDate = format(parseISO(safeCurrentDate), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  const shortDate   = format(parseISO(safeCurrentDate), 'dd/MM/yyyy')

  const canPeriodPDF = !!periodStart && !!periodEnd && periodEnd >= periodStart

  function handleSinglePDF() {
    if (!report) return
    printRelatorio360PDF({ mode: 'single', report, sections: pdfSections })
  }

  function handlePeriodPDF() {
    if (!canPeriodPDF) return
    const filtered = Object.values(reports).filter(
      (r) => r.date >= periodStart && r.date <= periodEnd
    )
    if (filtered.length === 0) {
      alert('Nenhum relatório encontrado no período selecionado.')
      return
    }
    printRelatorio360PDF({ mode: 'period', reports: filtered, periodStart, periodEnd, sections: pdfSections })
  }

  return (
    <div className="flex flex-col border-b border-[#525252] bg-[#333333]">
      {/* Main row */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-4 flex-wrap gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 text-[#a3a3a3] text-xs uppercase tracking-widest font-semibold">
            <Building2 size={12} />
            <span>Relatório Diário de Obra</span>
          </div>
          <h1 className="text-[#f5f5f5] text-xl font-bold leading-tight">
            {report?.projectName ?? 'Sem Projeto'}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Date display */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#525252] bg-[#3d3d3d] text-[#a3a3a3] text-sm">
            <Calendar size={14} className="text-[#f97316]" />
            <span className="capitalize font-medium text-[#f5f5f5]">{displayDate}</span>
          </div>

          {/* Date picker + prev/next */}
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrevDay}
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#525252] bg-[#3d3d3d] text-[#a3a3a3] hover:text-[#f97316] hover:border-[#f97316]/40 transition-colors"
              title="Dia anterior"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Native date input */}
            <input
              type="date"
              value={safeCurrentDate}
              onChange={(e) => e.target.value && goToDate(e.target.value)}
              className="h-8 px-2 rounded-lg border border-[#525252] bg-[#3d3d3d] text-[#f5f5f5] text-xs font-mono focus:outline-none focus:border-[#f97316]/60 transition-colors"
              title="Ir para data"
            />

            <span className="text-xs text-[#6b6b6b] font-mono w-20 text-center">{shortDate}</span>
            <button
              onClick={goToNextDay}
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#525252] bg-[#3d3d3d] text-[#a3a3a3] hover:text-[#f97316] hover:border-[#f97316]/40 transition-colors"
              title="Próximo dia"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Period toggle */}
          <button
            onClick={() => setShowPeriod((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              showPeriod
                ? 'bg-[#f97316]/15 border-[#f97316]/50 text-[#f97316]'
                : 'border-[#525252] bg-[#3d3d3d] text-[#a3a3a3] hover:text-[#f97316] hover:border-[#f97316]/40'
            }`}
            title="Selecionar período"
          >
            <CalendarRange size={13} />
            Período
          </button>

          {/* Single PDF */}
          <button
            onClick={handleSinglePDF}
            disabled={!report}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#525252] bg-[#3d3d3d] text-[#a3a3a3] text-xs font-medium hover:text-[#f97316] hover:border-[#f97316]/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Gerar PDF do dia atual"
          >
            <FileDown size={13} />
            PDF
          </button>
        </div>
      </div>

      {/* Period selector + section checkboxes panel */}
      {showPeriod && (
        <div className="px-6 pb-4 space-y-3">
          {/* Date range */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-[#a3a3a3] text-[10px] font-semibold uppercase tracking-wider">Data inicial</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="h-8 px-2 rounded-lg border border-[#525252] bg-[#3d3d3d] text-[#f5f5f5] text-xs font-mono focus:outline-none focus:border-[#f97316]/60 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[#a3a3a3] text-[10px] font-semibold uppercase tracking-wider">Data final</label>
              <input
                type="date"
                value={periodEnd}
                min={periodStart}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="h-8 px-2 rounded-lg border border-[#525252] bg-[#3d3d3d] text-[#f5f5f5] text-xs font-mono focus:outline-none focus:border-[#f97316]/60 transition-colors"
              />
            </div>
            <button
              onClick={handlePeriodPDF}
              disabled={!canPeriodPDF}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#f97316]/20 border border-[#f97316]/50 text-[#f97316] text-xs font-semibold hover:bg-[#f97316]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <FileDown size={13} />
              Gerar PDF do Período
            </button>
            {canPeriodPDF && (
              <span className="text-[#6b6b6b] text-xs self-end pb-1.5">
                {Object.values(reports).filter((r) => r.date >= periodStart && r.date <= periodEnd).length} relatório(s) no período
              </span>
            )}
          </div>

          {/* Section selection */}
          <div>
            <p className="text-[#a3a3a3] text-[10px] font-semibold uppercase tracking-wider mb-2">Áreas do relatório</p>
            <div className="flex flex-wrap gap-2">
              {([
                ['atividades',   'Atividades'],
                ['equipes',      'Equipes / M.O.'],
                ['equipamentos', 'Equipamentos'],
                ['materiais',    'Materiais'],
                ['fotos',        'Fotos'],
                ['lps',          'LPS / PPC'],
                ['planejamento', 'Planejamento'],
                ['suprimentos',  'Suprimentos'],
                ['qualidade',    'Qualidade'],
                ['financeiro',   'Financeiro / EVM'],
                ['maoDeObra',    'Mão de Obra'],
              ] as const).map(([key, label]) => (
                <label
                  key={key}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium cursor-pointer transition-colors border ${
                    pdfSections[key]
                      ? 'bg-[#f97316]/15 border-[#f97316]/50 text-[#f97316]'
                      : 'bg-[#3d3d3d] border-[#525252] text-[#6b6b6b] hover:text-[#a3a3a3]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={pdfSections[key]}
                    onChange={() => toggleSection(key)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
