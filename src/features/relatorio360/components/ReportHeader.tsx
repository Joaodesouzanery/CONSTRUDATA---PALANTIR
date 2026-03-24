import { ChevronLeft, ChevronRight, Calendar, Building2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import { useCurrentDate, useCurrentReport } from '@/hooks/useRelatorio360'

export function ReportHeader() {
  const currentDate = useCurrentDate()
  const report = useCurrentReport()
  const { goToPrevDay, goToNextDay } = useRelatorio360Store()

  const displayDate = format(parseISO(currentDate), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  const shortDate = format(parseISO(currentDate), 'dd/MM/yyyy')

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c3658] bg-[#0e1f38]">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 text-[#a3a3a3] text-xs uppercase tracking-widest font-semibold">
          <Building2 size={12} />
          <span>Relatório Diário de Obra</span>
        </div>
        <h1 className="text-[#f5f5f5] text-xl font-bold leading-tight">
          {report?.projectName ?? 'Sem Projeto'}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1c3658] bg-[#112240] text-[#a3a3a3] text-sm">
          <Calendar size={14} className="text-[#2abfdc]" />
          <span className="capitalize font-medium text-[#f5f5f5]">{displayDate}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevDay}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#1c3658] bg-[#112240] text-[#a3a3a3] hover:text-[#2abfdc] hover:border-[#2abfdc]/40 transition-colors"
            title="Dia anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-[#6b6b6b] font-mono w-20 text-center">{shortDate}</span>
          <button
            onClick={goToNextDay}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#1c3658] bg-[#112240] text-[#a3a3a3] hover:text-[#2abfdc] hover:border-[#2abfdc]/40 transition-colors"
            title="Próximo dia"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
