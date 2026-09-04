/**
 * PorObraPanel — Financeiro por Obra. Lista as obras cadastradas no Torre de
 * Controle e mostra, para cada uma: orçamento, entradas, saídas e saldo.
 * Lançamentos sem obra aparecem em "Não atribuído".
 *
 * ⚠️ Duas correções de 04/09/2026, e as duas eram números errados na tela:
 *
 *  1. o orçamento vinha da SOMA CRUA das `budgetLines`, que conta em dobro quando existe a linha
 *     'Total' junto das categorias — e ignorava o contrato. Passa por `obraBacFromSite`, a mesma
 *     fonte do Plano de Contas;
 *  2. não havia filtro de data NENHUM: o saldo era o acumulado desde sempre. Agora tem janela, e
 *     ela nasce no mês corrente.
 */
import { useMemo, useState } from 'react'
import { Building2, ArrowDownCircle, ArrowUpCircle, Wallet, PiggyBank } from 'lucide-react'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { obraBacFromSite } from '@/features/torre-de-controle/utils/obraBudget'
import { FinanceiroFilterBar } from '@/features/financeiro/components/FinanceiroFilterBar'
import { filterEntries, presetDePeriodo } from '@/features/financeiro/lib/financeiroCalc'
import type { FinanceiroFilter } from '@/features/financeiro/lib/financeiroCalc'
import { formatCurrency } from '@/lib/utils'

interface ObraFin {
  id: string
  label: string
  status?: string
  orcamento: number
  projetado: number
  entradas: number
  saidas: number
}

export function PorObraPanel() {
  const sites = useTorreStore((s) => s.sites)
  const entries = useFinanceiroStore((s) => s.entries)
  const [selectedId, setSelectedId] = useState<string>('') // '' = todas
  /**
   * ⚠️ Esta tela não tinha filtro de data NENHUM.
   *
   * O "Saldo (Ent. − Saí.)" era o acumulado histórico integral: uma medição de janeiro confrontada
   * com despesas de agosto. Agora nasce no mês corrente, como as outras.
   */
  const [filter, setFilter] = useState<FinanceiroFilter>(() => presetDePeriodo('mes'))

  const noPeriodo = useMemo(
    () => filterEntries(entries, { from: filter.from, to: filter.to }),
    [entries, filter.from, filter.to],
  )

  const obras: ObraFin[] = useMemo(() => {
    const byObra: ObraFin[] = sites.map((o) => {
      /**
       * ⚠️ `obraBacFromSite` em vez de somar as `budgetLines` cruas.
       *
       * Somar todas as linhas conta DUAS VEZES: `withTotalBudgetLine` grava a linha 'Total' JUNTO
       * com as categorias, então uma obra com as duas coisas aparecia com aproximadamente o dobro.
       * E o contrato — que é quem manda no valor da obra — era ignorado. Era a mesma divergência
       * que o Plano de Contas já tinha corrigido, e o cabeçalho do módulo ainda usa uma terceira
       * fonte (a soma de `bacAlocado` dos núcleos do EVM).
       */
      const orcamento = obraBacFromSite(o)
      const projetado = (o.budgetLines ?? []).reduce((sum, b) => sum + (b.projected || 0), 0)
      const ent = noPeriodo.filter((e) => e.obraId === o.id)
      const entradas = ent.filter((e) => e.tipo === 'entrada').reduce((s, e) => s + (e.valor || 0), 0)
      const saidas = ent.filter((e) => e.tipo === 'saida').reduce((s, e) => s + (e.valor || 0), 0)
      return { id: o.id, label: o.code ? `${o.code} — ${o.name}` : o.name, status: o.status, orcamento, projetado, entradas, saidas }
    })
    // "Não atribuído" — lançamentos sem obra
    const semObra = noPeriodo.filter((e) => !e.obraId)
    if (semObra.length > 0) {
      byObra.push({
        id: '__none__',
        label: 'Não atribuído',
        orcamento: 0,
        projetado: 0,
        entradas: semObra.filter((e) => e.tipo === 'entrada').reduce((s, e) => s + (e.valor || 0), 0),
        saidas: semObra.filter((e) => e.tipo === 'saida').reduce((s, e) => s + (e.valor || 0), 0),
      })
    }
    return byObra
  }, [sites, noPeriodo])

  const scoped = selectedId ? obras.filter((o) => o.id === selectedId) : obras

  const totals = useMemo(() => {
    return scoped.reduce(
      (acc, o) => ({
        orcamento: acc.orcamento + o.orcamento,
        entradas: acc.entradas + o.entradas,
        saidas: acc.saidas + o.saidas,
      }),
      { orcamento: 0, entradas: 0, saidas: 0 },
    )
  }, [scoped])

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <FinanceiroFilterBar value={filter} onChange={setFilter} showTipo={false} showCategoria={false} showObra={false} />
      {/* Header + filtro */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]/15">
            <Building2 size={18} className="text-[#f97316]" />
          </div>
          <div>
            <h2 className="text-[#f5f5f5] font-semibold text-base">Financeiro por Obra</h2>
            <p className="text-[#6b6b6b] text-xs">Orçamento, entradas, saídas e saldo de cada obra do Torre de Controle</p>
          </div>
        </div>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
        >
          <option value="">Todas as obras</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={<PiggyBank size={16} />} label="Orçamento (Torre)" value={totals.orcamento} color="#a78bfa" />
        <SummaryCard icon={<ArrowDownCircle size={16} />} label="Entradas" value={totals.entradas} color="#22c55e" />
        <SummaryCard icon={<ArrowUpCircle size={16} />} label="Saídas" value={totals.saidas} color="#ef4444" />
        <SummaryCard icon={<Wallet size={16} />} label="Saldo (Ent. − Saí.)" value={totals.entradas - totals.saidas} color="#f97316" />
      </div>

      {/* Tabela por obra */}
      {obras.length === 0 ? (
        <div className="rounded-xl border border-[#525252] bg-[#333333] p-8 text-center text-[#6b6b6b] text-sm">
          Nenhuma obra cadastrada no Torre de Controle. Cadastre obras lá ou crie lançamentos no Financeiro.
        </div>
      ) : (
        <div className="rounded-xl border border-[#525252] overflow-hidden bg-[#333333]">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#2c2c2c] border-b border-[#525252]">
                  <th className="px-4 py-2.5 text-left text-[#6b6b6b] font-medium">Obra</th>
                  <th className="px-4 py-2.5 text-right text-[#6b6b6b] font-medium">Orçamento</th>
                  <th className="px-4 py-2.5 text-right text-[#6b6b6b] font-medium">Entradas</th>
                  <th className="px-4 py-2.5 text-right text-[#6b6b6b] font-medium">Saídas</th>
                  <th className="px-4 py-2.5 text-right text-[#6b6b6b] font-medium">Saldo</th>
                  <th className="px-4 py-2.5 text-right text-[#6b6b6b] font-medium">Disp. vs orç.</th>
                </tr>
              </thead>
              <tbody>
                {scoped.map((o) => {
                  const saldo = o.entradas - o.saidas
                  const disponivel = o.orcamento - o.saidas
                  return (
                    <tr key={o.id} className="border-b border-[#525252]/50 hover:bg-[#3d3d3d]/60">
                      <td className="px-4 py-2.5 text-[#f5f5f5] font-medium">
                        {o.label}
                        {o.id === '__none__' && <span className="ml-2 text-[10px] text-[#eab308]">sem obra</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#a3a3a3]">{o.orcamento > 0 ? formatCurrency(o.orcamento) : '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#22c55e]">{o.entradas > 0 ? formatCurrency(o.entradas) : '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#ef4444]">{o.saidas > 0 ? formatCurrency(o.saidas) : '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${saldo >= 0 ? 'text-[#f5f5f5]' : 'text-[#ef4444]'}`}>{formatCurrency(saldo)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${o.orcamento === 0 ? 'text-[#525252]' : disponivel >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        {o.orcamento > 0 ? formatCurrency(disponivel) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-[10px] text-[#6b6b6b]">
        Marque cada lançamento com a obra nas abas <b>Entradas</b> / <b>Saídas</b>. O orçamento é o do <b>contrato</b> quando existe; sem contrato, cai para o orçamento cadastrado na Torre de Controle. Entradas e saídas são as do período selecionado acima.
      </p>
    </div>
  )
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#333333] p-4">
      <div className="flex items-center gap-2 text-[#a3a3a3] text-xs mb-2" style={{ color }}>
        {icon}<span className="text-[#a3a3a3]">{label}</span>
      </div>
      <p className="font-mono text-lg font-semibold" style={{ color }}>{formatCurrency(value)}</p>
    </div>
  )
}
