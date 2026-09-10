/**
 * Estoque Parado — o dinheiro que já saiu do caixa e ainda não virou serviço.
 *
 * ⚠️ A distinção que dá sentido à tela: **"nunca saiu" não é "parado há 0 dias"**. Um item que
 * chegou hoje e um que está encalhado desde a compra são situações opostas, e a coluna "parado há"
 * mostra "—" no segundo caso em vez de zero. É a mesma regra do resto do produto: não sei ≠ zero.
 *
 * E item sem custo cadastrado **entra na fila mesmo assim**, marcado — ele é um problema conhecido
 * de tamanho desconhecido. Escondê-lo por não ter preço seria trocar um buraco por outro.
 */
import { useMemo, useState } from 'react'
import { PackageX, AlertTriangle, Search } from 'lucide-react'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useStoreSync } from '@/lib/useStoreSync'
import { obraEstaAtiva } from '@/lib/obraAtiva'
import { hojeLocalISO } from '@/lib/utils'
import { estoqueParado } from '../utils/estoqueParado'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

const LIMITES = [15, 30, 60, 90]

export function EstoqueParadoPanel() {
  useStoreSync(useSuprimentosStore)
  const estoqueItens = useSuprimentosStore((s) => s.estoqueItens)
  const movimentacoes = useSuprimentosStore((s) => s.movimentacoes)
  const sites = useTorreStore((s) => s.sites)

  const [dias, setDias] = useState(30)
  const [siteId, setSiteId] = useState('')
  const [busca, setBusca] = useState('')

  const hoje = hojeLocalISO()
  const r = useMemo(
    () => estoqueParado(estoqueItens, movimentacoes, { hoje, diasParaParar: dias, siteId: siteId || undefined }),
    [estoqueItens, movimentacoes, hoje, dias, siteId],
  )

  const fila = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return r.fila
    return r.fila.filter((x) => `${x.item.descricao} ${x.item.codigoReferencia ?? ''}`.toLowerCase().includes(q))
  }, [r.fila, busca])

  const th = 'px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-[#adadad] whitespace-nowrap'
  const td = 'px-2 py-1.5 whitespace-nowrap'

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <PackageX size={18} className="text-[#f97316]" />
        <h2 className="text-sm font-bold text-[#f5f5f5]">Estoque parado</h2>
        <span className="text-[11px] text-[#a3a3a3]">
          material comprado que não sai — ou é compra a mais, ou é obra que não andou
        </span>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#f97316]/40 bg-[#f97316]/5 p-3">
          <p className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">Dinheiro parado</p>
          <p className="text-lg font-bold text-[#ffa055]">{brl(r.valorParado)}</p>
          <p className="text-[10px] text-[#6b6b6b]">
            {r.fila.length} item(ns) de {r.total} no estoque
            {r.semCusto > 0 && <> · <span className="text-[#fbbf24]">{r.semCusto} sem custo cadastrado</span></>}
          </p>
        </div>
        <div className="rounded-xl border border-[#525252] p-3">
          <p className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">Parados há mais de {dias} dias</p>
          <p className="text-lg font-bold text-[#f5f5f5]">{r.parados}</p>
          <p className="text-[10px] text-[#6b6b6b]">tiveram saída, mas faz tempo</p>
        </div>
        <div className="rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/5 p-3">
          <p className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">Nunca saíram</p>
          <p className="text-lg font-bold text-[#fca5a5]">{r.nuncaSairam}</p>
          <p className="text-[10px] text-[#6b6b6b]">⚠️ encalhados desde a compra — o pior caso</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md border border-[#525252] bg-[#1f1f1f] px-2 py-1">
          <Search size={12} className="text-[#6b6b6b]" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar material"
            className="w-48 bg-transparent text-[11px] text-[#f5f5f5] placeholder:text-[#525252] focus:outline-none" />
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-[#a3a3a3]">
          Parado a partir de
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))}
            className="rounded border border-[#525252] bg-[#1f1f1f] px-1.5 py-1 text-[11px] text-[#f5f5f5]">
            {LIMITES.map((d) => <option key={d} value={d}>{d} dias</option>)}
          </select>
        </label>
        <select value={siteId} onChange={(e) => setSiteId(e.target.value)}
          className="rounded border border-[#525252] bg-[#1f1f1f] px-1.5 py-1 text-[11px] text-[#f5f5f5]">
          <option value="">Todas as obras</option>
          {sites.filter(obraEstaAtiva).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {fila.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#525252] p-6 text-center text-xs text-[#6b6b6b]">
          {r.total === 0
            ? 'Nenhum item com saldo no estoque para este recorte.'
            : `Nada parado há mais de ${dias} dias. Todos os ${r.total} itens tiveram saída recente.`}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#525252]">
          <table className="w-full text-[11px]">
            <thead className="bg-[#2c2c2c]">
              <tr className="border-b border-[#525252]">
                <th className={th}>Material</th>
                <th className={`${th} text-right`}>Saldo</th>
                <th className={`${th} text-right`}>Custo un.</th>
                <th className={`${th} text-right`}>Parado</th>
                <th className={th}>Última saída</th>
                <th className={th}>Desde</th>
                <th className={`${th} text-right`}>Dinheiro parado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d3d3d]">
              {fila.slice(0, 300).map((x) => (
                <tr key={x.item.id}
                    className={x.situacao === 'nunca-saiu' ? 'border-l-2 border-l-[#ef4444] bg-[#ef4444]/5' : ''}>
                  <td className={`${td} max-w-[280px] truncate text-[#f5f5f5]`} title={x.item.descricao}>
                    {x.item.descricao}
                    {x.situacao === 'nunca-saiu' && (
                      <span className="ml-1.5 rounded bg-[#ef4444]/20 px-1 text-[9px] text-[#fca5a5]">nunca saiu</span>
                    )}
                  </td>
                  <td className={`${td} text-right font-mono text-[#c9c9c9]`}>{num(x.item.qtdDisponivel)} {x.item.unidade}</td>
                  <td className={`${td} text-right font-mono ${x.semCusto ? 'text-[#fbbf24]' : 'text-[#c9c9c9]'}`}>
                    {x.semCusto ? 'sem custo' : brl(x.item.custoUnitario!)}
                  </td>
                  {/* ⚠️ "—" e não "0": nunca saiu é não sei desde quando, não zero dias. */}
                  <td className={`${td} text-right font-mono text-[#f5f5f5]`}>
                    {x.diasParado == null ? '—' : `${x.diasParado} d`}
                  </td>
                  <td className={`${td} text-[#a3a3a3]`}>
                    {x.ultimaSaida ? x.ultimaSaida.split('-').reverse().join('/') : '—'}
                  </td>
                  <td className={`${td} text-[#6b6b6b]`}>
                    {x.primeiraEntrada ? x.primeiraEntrada.split('-').reverse().join('/') : '—'}
                  </td>
                  <td className={`${td} text-right font-mono font-semibold ${x.semCusto ? 'text-[#6b6b6b]' : 'text-[#ffa055]'}`}>
                    {x.semCusto ? '?' : brl(x.valorParado)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-[#525252] bg-[#2c2c2c]">
              <tr>
                <td className={`${td} text-[#a3a3a3]`} colSpan={6}>
                  {fila.length} item(ns){fila.length > 300 && ' · mostrando os 300 primeiros'}
                </td>
                <td className={`${td} text-right font-mono font-bold text-[#f5f5f5]`}>{brl(r.valorParado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {r.semCusto > 0 && (
        <p className="rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2 text-[11px] leading-5 text-[#fbbf24]">
          <AlertTriangle size={12} className="mr-1 inline" />
          <strong>{r.semCusto} item(ns) sem custo unitário cadastrado.</strong> Eles aparecem na lista porque
          estão parados do mesmo jeito — mas o valor deles não entra no total, e por isso o número acima é o
          <em> mínimo</em>, não o total.
        </p>
      )}

      <p className="text-[10px] leading-4 text-[#6b6b6b]">
        Só entrada e saída contam: transferir de depósito não é o material sendo usado. Item com saldo zero
        fica de fora — não há dinheiro parado no que não está lá.
      </p>
    </div>
  )
}
