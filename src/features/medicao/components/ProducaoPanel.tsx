/**
 * ProducaoPanel — pulls production data from RDOs and shows measurements by executor.
 */
import { useMemo } from 'react'
import { useRdoStore } from '@/store/rdoStore'
import { useMedicaoStore } from '@/store/medicaoStore'
import { ClipboardList, ArrowRight } from 'lucide-react'

interface ProducaoRow {
  executor: string
  servico: string
  unidade: string
  quantidade: number
  date: string
}

export function ProducaoPanel() {
  const rdos = useRdoStore((s) => s.rdos)
  const sheets = useMedicaoStore((s) => s.sheets)
  const sabespSheets = sheets.filter((s) => s.tipo === 'sabesp')

  // Extract production data from RDOs grouped by responsible (executor)
  const producaoRows = useMemo<ProducaoRow[]>(() => {
    const rows: ProducaoRow[] = []
    for (const rdo of rdos) {
      for (const svc of rdo.services) {
        rows.push({
          executor: rdo.responsible,
          servico: svc.description,
          unidade: svc.unit,
          quantidade: svc.quantity,
          date: rdo.date,
        })
      }
    }
    return rows.sort((a, b) => a.executor.localeCompare(b.executor))
  }, [rdos])

  // Group by executor
  const grouped = useMemo(() => {
    const map = new Map<string, ProducaoRow[]>()
    for (const row of producaoRows) {
      const existing = map.get(row.executor) || []
      existing.push(row)
      map.set(row.executor, existing)
    }
    return map
  }, [producaoRows])

  // Cross-reference with Sabesp items
  const sabespItems = useMemo(() => {
    return sabespSheets.flatMap((s) => s.items)
  }, [sabespSheets])

  function findSabespMatch(servico: string) {
    const norm = servico.toLowerCase().trim()
    return sabespItems.find(
      (it) =>
        it.descricao.toLowerCase().includes(norm) ||
        norm.includes(it.descricao.toLowerCase()),
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-white font-semibold text-lg">Produção</h2>
        <p className="text-[#a3a3a3] text-xs mt-0.5">
          Dados de produção extraídos dos RDOs, agrupados por executor
        </p>
      </div>

      {producaoRows.length === 0 ? (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-12 text-center">
          <ClipboardList size={40} className="mx-auto text-[#6b6b6b] mb-3" />
          <p className="text-[#a3a3a3] text-sm">
            Nenhum dado de produção disponível.
          </p>
          <p className="text-[#6b6b6b] text-xs mt-1">
            Crie RDOs com serviços executados para ver os dados aqui.
          </p>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([executor, rows]) => (
          <div
            key={executor}
            className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[#525252] bg-[#484848]/40">
              <h3 className="text-white font-medium text-sm">
                {executor}
                <span className="text-[#a3a3a3] font-normal ml-2">
                  ({rows.length} serviço{rows.length !== 1 ? 's' : ''})
                </span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#484848]/30">
                    <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">
                      Data
                    </th>
                    <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">
                      Serviço
                    </th>
                    <th className="px-3 py-2 text-center text-[#a3a3a3] font-medium w-12">
                      UN
                    </th>
                    <th className="px-3 py-2 text-right text-[#a3a3a3] font-medium w-20">
                      Qtd
                    </th>
                    <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">
                      Item Sabesp
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const match = findSabespMatch(row.servico)
                    return (
                      <tr
                        key={i}
                        className="border-t border-[#525252] hover:bg-[#484848] transition-colors"
                      >
                        <td className="px-3 py-2 text-[#a3a3a3] font-mono">
                          {row.date}
                        </td>
                        <td className="px-3 py-2 text-[#f5f5f5]">
                          {row.servico}
                        </td>
                        <td className="px-3 py-2 text-[#a3a3a3] text-center">
                          {row.unidade}
                        </td>
                        <td className="px-3 py-2 text-[#f5f5f5] font-mono text-right">
                          {row.quantidade.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-2">
                          {match ? (
                            <span className="flex items-center gap-1 text-green-400 text-xs">
                              <ArrowRight size={10} />
                              {match.item} - {match.descricao.slice(0, 40)}
                            </span>
                          ) : (
                            <span className="text-[#6b6b6b] italic">
                              Sem correspondência
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-[#525252] bg-[#484848]/20">
              <span className="text-[#a3a3a3] text-xs">
                Total Qtd:{' '}
                <span className="text-[#f5f5f5] font-mono font-semibold">
                  {rows
                    .reduce((s, r) => s + r.quantidade, 0)
                    .toLocaleString('pt-BR')}
                </span>
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
