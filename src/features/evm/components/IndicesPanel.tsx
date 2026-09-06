/**
 * IndicesPanel — Pillar deviation table, performance indices table with CPI/SPI
 * color coding, health semaphore per activity, interpretation text, sparkline
 * trends, and summary row.
 */
import { useEvmStore } from '@/store/evmStore'
import { formatCurrency } from '@/lib/utils'
import { Layers } from 'lucide-react'
import { OQueE } from '@/components/shared/OQueE'
import type { Explicacao } from '@/components/shared/explicacao'

/** Em português de obra: não traduz a sigla, diz que pergunta ela responde. */
const EXPLICACAO_INDICES: Explicacao = {
  oQueE:
    'Dois números que comparam o planejado com o que aconteceu. O IDC (CPI) responde "cada real '
    + 'gasto virou quanto de serviço?" — abaixo de 1,00 a obra gasta mais do que entrega. O IDP '
    + '(SPI) responde "a obra andou o quanto devia até hoje?" — abaixo de 1,00 está atrasada.',
  deOndeVem:
    'Do orçamento por pacote de trabalho (Plano de Contas), do avanço físico apontado e do custo '
    + 'real dos lançamentos e das ordens de compra. Precisa dos três.',
  oQueFalta:
    'Falta o orçamento por pacote e o avanço físico. Sem eles não há como saber quanto de serviço '
    + 'o dinheiro virou — e um índice chutado é pior que índice nenhum.',
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

const PILLAR_COLORS: Record<string, string> = {
  material: '#38bdf8',
  equipamento: '#f97316',
  mao_de_obra: '#22c55e',
  impostos_indiretos: '#a78bfa',
}

export function IndicesPanel() {
  const { evmMetrics } = useEvmStore()
  const { pillarDeviations } = evmMetrics

  /* Total deviation for percentage column */
  const totalDeviation = pillarDeviations?.reduce((sum, p) => sum + Math.abs(p.deviation), 0) ?? 0

  /* Grand totals for pillar table */
  const grandBudgeted = pillarDeviations?.reduce((sum, p) => sum + p.budgeted, 0) ?? 0
  const grandActual = pillarDeviations?.reduce((sum, p) => sum + p.actual, 0) ?? 0
  const grandDeviation = pillarDeviations?.reduce((sum, p) => sum + p.deviation, 0) ?? 0


  return (
    <div className="p-6 space-y-6 bg-[#2c2c2c] min-h-full">

      {/* ── Pillar Deviation Table ───────────────────────────────── */}
      {pillarDeviations && pillarDeviations.length > 0 && (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={16} className="text-[#a3a3a3]" />
            <h2 className="text-[#f5f5f5] text-sm font-semibold">
              Desagregação de Custo por Pillar
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#525252]">
                  <th className="text-left text-[#a3a3a3] text-xs font-medium px-4 py-2">Pillar</th>
                  <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">Orçado</th>
                  <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">Real</th>
                  <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">Desvio</th>
                  <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">% do Desvio Total</th>
                </tr>
              </thead>
              <tbody>
                {pillarDeviations.map((p) => {
                  const absDev = Math.abs(p.deviation)
                  const pctOfTotal = totalDeviation > 0 ? (absDev / totalDeviation) * 100 : 0
                  const isOver = p.deviation > 0
                  return (
                    <tr
                      key={p.pillar}
                      className="border-b border-[#525252]/50 hover:bg-[#484848]/30 transition-colors"
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-sm inline-block shrink-0"
                            style={{ backgroundColor: PILLAR_COLORS[p.pillar] ?? '#6b7280' }}
                          />
                          <span className="text-[#f5f5f5] text-sm">{p.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-[#a3a3a3] text-sm text-right font-mono">
                        {formatCurrency(p.budgeted)}
                      </td>
                      <td className="px-4 py-2 text-[#a3a3a3] text-sm text-right font-mono">
                        {formatCurrency(p.actual)}
                      </td>
                      <td
                        className="px-4 py-2 text-sm text-right font-mono font-semibold"
                        style={{ color: isOver ? '#ef4444' : '#22c55e' }}
                      >
                        {isOver ? '+' : ''}{formatCurrency(p.deviation)}
                      </td>
                      <td className="px-4 py-2 text-[#a3a3a3] text-sm text-right font-mono">
                        {pctOfTotal.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#2c2c2c]/70 border-t-2 border-[#525252]">
                  <td className="px-4 py-2 text-[#f5f5f5] text-sm font-semibold">Total</td>
                  <td className="px-4 py-2 text-[#f5f5f5] text-sm text-right font-mono font-bold">
                    {formatCurrency(grandBudgeted)}
                  </td>
                  <td className="px-4 py-2 text-[#f5f5f5] text-sm text-right font-mono font-bold">
                    {formatCurrency(grandActual)}
                  </td>
                  <td
                    className="px-4 py-2 text-sm text-right font-mono font-bold"
                    style={{ color: grandDeviation > 0 ? '#ef4444' : '#22c55e' }}
                  >
                    {grandDeviation > 0 ? '+' : ''}{formatCurrency(grandDeviation)}
                  </td>
                  <td className="px-4 py-2 text-[#f5f5f5] text-sm text-right font-mono font-bold">
                    100.0%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Índices por atividade ─────────────────────────────────────────
          ⚠️ Aqui havia uma tabela de CPI/SPI por atividade com gráfico de tendência ao lado. Os
          números eram INVENTADOS: `cpi = 0.7 + score * 1.1`, `spi = 0.65 + score * 1.2`, e as
          sparklines saíam de `Math.random()`. Não era dado ausente exibido como ausente — era
          número fabricado exibido como medição, com semáforo verde e vermelho do lado.

          Um indicador que a pessoa não tem como conferir é pior que indicador nenhum: ele é levado
          para a reunião. Enquanto não houver valor agregado real por pacote de trabalho, esta
          seção diz o que falta em vez de preencher o espaço. ───────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-[#f5f5f5] text-sm font-semibold">
            Índices de Desempenho por atividade — IDC (CPI) / IDP (SPI)
          </h2>
          <OQueE titulo="Índices de desempenho (CPI e SPI)" explicacao={EXPLICACAO_INDICES} />
        </div>

        <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
          <p className="text-sm font-semibold text-[#a3a3a3]">Sem base para calcular</p>
          <p className="mt-1.5 text-xs leading-5 text-[#d4d4d4]">
            Para existir CPI e SPI por atividade, cada atividade precisa de três números medidos:
            quanto estava <b>previsto</b> gastar até hoje, quanto de serviço foi <b>entregue</b>, e
            quanto de fato <b>custou</b>. O sistema hoje tem o custo — dos lançamentos e das ordens
            de compra — e não tem os outros dois por atividade.
          </p>
          <p className="mt-2 text-xs leading-5 text-[#a3a3a3]">
            <b className="text-[#d4d4d4]">O que preencher: </b>
            o orçamento por pacote de trabalho no Plano de Contas, e o avanço físico de cada pacote.
            Enquanto isso, quem responde &quot;a obra está gastando o que a gente planejou?&quot; é o
            Fluxo de Caixa Projetado, que trabalha com a medição da obra inteira em vez de por
            atividade.
          </p>
        </div>
      </div>
    </div>
  )
}
