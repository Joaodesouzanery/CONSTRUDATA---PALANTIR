/**
 * DailyPlanPanel — Detailed day-by-day execution table.
 * Filterable by date range, trecho, and team. Printable.
 */
import { useState, useMemo } from 'react'
import { Printer, Play } from 'lucide-react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { fmtDate } from '../utils/exportEngine'

interface DailyRow {
  date: string
  trechoCode: string
  trechoDesc: string
  teamName: string
  teamIndex: number
  metersPlanned: number
  isHydroTest: boolean
  headcount: number
  equipmentUnits: number
  costBRL: number
}

function fmtR(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function DailyPlanPanel() {
  const { ganttRows, teams, runSchedule, isScheduleDirty } = usePlanejamentoStore()

  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd]     = useState('')
  const [filterTrecho, setFilterTrecho] = useState('')
  const [filterTeam, setFilterTeam]   = useState('')

  // Flatten ganttRows to daily rows
  const allRows = useMemo<DailyRow[]>(() => {
    const rows: DailyRow[] = []
    for (const ganttRow of ganttRows) {
      const team = teams[ganttRow.teamIndex]
      const teamName = team?.name ?? `Equipe ${ganttRow.teamIndex + 1}`
      const headcount = (team?.foremanCount ?? 0) + (team?.workerCount ?? 0) +
        (team?.helperCount ?? 0) + (team?.operatorCount ?? 0)
      const equipmentUnits = (team?.retroescavadeira ?? 0) + (team?.compactador ?? 0) +
        (team?.caminhaoBasculante ?? 0)

      for (const cell of ganttRow.cells) {
        rows.push({
          date:         cell.date,
          trechoCode:   ganttRow.trecho.code,
          trechoDesc:   ganttRow.trecho.description,
          teamName,
          teamIndex:    ganttRow.teamIndex,
          metersPlanned: cell.metersPlanned,
          isHydroTest:  cell.isHydroTest,
          headcount:    cell.isHydroTest ? 0 : headcount,
          equipmentUnits: cell.isHydroTest ? 0 : equipmentUnits,
          costBRL:      cell.isHydroTest ? 0 : ganttRow.dailyCostBRL,
        })
      }
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [ganttRows, teams])

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (filterStart && r.date < filterStart) return false
      if (filterEnd   && r.date > filterEnd)   return false
      if (filterTrecho && !r.trechoCode.toLowerCase().includes(filterTrecho.toLowerCase()) &&
          !r.trechoDesc.toLowerCase().includes(filterTrecho.toLowerCase())) return false
      if (filterTeam && r.teamName.toLowerCase() !== filterTeam.toLowerCase()) return false
      return true
    })
  }, [allRows, filterStart, filterEnd, filterTrecho, filterTeam])

  const uniqueTeams = [...new Set(allRows.map((r) => r.teamName))]

  if (ganttRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-gray-500">
        <p className="text-sm">Gere o planejamento para visualizar o plano diário.</p>
        <button onClick={runSchedule}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 transition-colors">
          <Play size={15} /> Gerar Planejamento
        </button>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">De:</label>
          <input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Até:</label>
          <input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500" />
        </div>
        <input
          type="text"
          placeholder="Filtrar trecho…"
          value={filterTrecho}
          onChange={(e) => setFilterTrecho(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
        />
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500"
        >
          <option value="">Todas as equipes</option>
          {uniqueTeams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <div className="ml-auto flex gap-2">
          {isScheduleDirty && (
            <button onClick={runSchedule}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-orange-600 hover:bg-orange-500 text-white transition-colors">
              <Play size={12} /> Atualizar
            </button>
          )}
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors">
            <Printer size={12} /> Imprimir
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">{filteredRows.length} registros</p>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 border-b border-gray-700">
            <tr>
              <th className="text-left text-gray-400 px-4 py-3 font-medium">Data</th>
              <th className="text-left text-gray-400 px-4 py-3 font-medium">Trecho</th>
              <th className="text-left text-gray-400 px-4 py-3 font-medium">Equipe</th>
              <th className="text-left text-gray-400 px-4 py-3 font-medium">Atividade</th>
              <th className="text-right text-gray-400 px-4 py-3 font-medium">Prod./Dia</th>
              <th className="text-right text-gray-400 px-4 py-3 font-medium">MO (pess.)</th>
              <th className="text-right text-gray-400 px-4 py-3 font-medium">Equipam.</th>
              <th className="text-right text-gray-400 px-4 py-3 font-medium">Custo/Dia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredRows.map((r, idx) => (
              <tr key={`${r.date}-${r.trechoCode}-${idx}`}
                className={`${r.isHydroTest ? 'bg-yellow-900/10' : 'bg-gray-900'} hover:bg-gray-800 transition-colors`}>
                <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="px-4 py-2.5">
                  <div className="text-gray-200 font-medium">{r.trechoCode}</div>
                  <div className="text-gray-500 text-xs truncate max-w-[200px]">{r.trechoDesc}</div>
                </td>
                <td className="px-4 py-2.5 text-gray-300">{r.teamName}</td>
                <td className="px-4 py-2.5">
                  {r.isHydroTest
                    ? <span className="px-2 py-0.5 rounded text-xs bg-yellow-900/40 text-yellow-300 border border-yellow-700/50">Teste Hidrostático</span>
                    : <span className="text-gray-400 text-xs">Escav. / Assent. / Reaterro</span>}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-200">
                  {r.isHydroTest ? '—' : `${r.metersPlanned.toFixed(1)} m`}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-300">{r.headcount > 0 ? r.headcount : '—'}</td>
                <td className="px-4 py-2.5 text-right text-gray-300">{r.equipmentUnits > 0 ? r.equipmentUnits : '—'}</td>
                <td className="px-4 py-2.5 text-right text-white font-medium">
                  {r.costBRL > 0 ? fmtR(r.costBRL) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Print layout (hidden on screen) */}
      <div className="hidden print:block mt-8">
        <h1 className="text-xl font-bold mb-2">Plano Diário de Execução</h1>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {['Data', 'Trecho', 'Equipe', 'Atividade', 'Prod./Dia', 'MO', 'Equip.', 'Custo'].map((h) => (
                <th key={h} className="border border-gray-400 px-2 py-1 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r, idx) => (
              <tr key={idx}>
                <td className="border border-gray-300 px-2 py-1">{fmtDate(r.date)}</td>
                <td className="border border-gray-300 px-2 py-1">{r.trechoCode}</td>
                <td className="border border-gray-300 px-2 py-1">{r.teamName}</td>
                <td className="border border-gray-300 px-2 py-1">{r.isHydroTest ? 'Teste Hidrostático' : 'Execução'}</td>
                <td className="border border-gray-300 px-2 py-1">{r.isHydroTest ? '—' : `${r.metersPlanned.toFixed(1)} m`}</td>
                <td className="border border-gray-300 px-2 py-1">{r.headcount > 0 ? r.headcount : '—'}</td>
                <td className="border border-gray-300 px-2 py-1">{r.equipmentUnits > 0 ? r.equipmentUnits : '—'}</td>
                <td className="border border-gray-300 px-2 py-1">{r.costBRL > 0 ? fmtR(r.costBRL) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
