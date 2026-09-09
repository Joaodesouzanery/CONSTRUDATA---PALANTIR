/**
 * Saldo Contratual — o contrato item a item: quanto foi contratado, quanto já foi medido, quanto
 * falta.
 *
 * ⚠️ **A coluna "Contratado" nasce vazia, e isso é a informação mais importante desta tela.**
 * A quantidade contratada por item vem da *planilha de balanceamento*, que a planilha de medição
 * cita na nota 2 mas não contém. Sem ela dá para dizer o que JÁ foi medido — e não dá para dizer
 * o que FALTA. A tela mostra "—" e escreve por quê, em vez de exibir um saldo que ninguém apurou.
 *
 * É a mesma regra do `oQueFalta` que o `OQueE` impõe no resto do produto: card cinza mudo ensina
 * a pessoa a ignorá-lo; card cinza que diz o que preencher vira pedido.
 */
import { useMemo, useState } from 'react'
import { Search, AlertTriangle } from 'lucide-react'
import type { CatalogoDoContrato, MedicaoImportada, ServicoDoCatalogo } from '@/types'
import { precoDoServico } from '../utils/medicao/catalogoContrato'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

type Filtro = 'todos' | 'medidos' | 'a-conferir' | 'sem-contratado'

interface Linha {
  servico: ServicoDoCatalogo
  codigo?: string
  precoComFator: number
  medido: number
  valorMedido: number
  contratado: number | null
  saldo: number | null
  pctConsumido: number | null
}

export function SaldoContratualPanel({ catalogo, medicao }: {
  catalogo: CatalogoDoContrato | null
  medicao: MedicaoImportada | null
}) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('medidos')
  const [obra, setObra] = useState<string>('')

  const linhas = useMemo<Linha[]>(() => {
    if (!catalogo) return []
    // A região sai da obra escolhida; sem obra, usa a primeira do contrato só para exibir preço.
    const regiao = (obra && medicao?.regiaoPorObra[obra]) || catalogo.regioes[0]?.codigo || ''
    const medidoPorServico = new Map<string, number>()
    for (const q of medicao?.quantidades ?? []) {
      if (obra && q.obra !== obra) continue
      medidoPorServico.set(q.servicoCatalogoId, (medidoPorServico.get(q.servicoCatalogoId) ?? 0) + q.quantidade)
    }
    return catalogo.servicos.map((servico) => {
      const p = precoDoServico(catalogo, servico, regiao)
      const medido = medidoPorServico.get(servico.id) ?? 0
      const contratado = servico.qtdContratada
      return {
        servico,
        codigo: p.codigo,
        precoComFator: p.precoComFator,
        medido,
        valorMedido: Math.round(medido * p.precoComFator * 100) / 100,
        contratado,
        saldo: contratado == null ? null : contratado - medido,
        pctConsumido: contratado == null || contratado === 0 ? null : (medido / contratado) * 100,
      }
    })
  }, [catalogo, medicao, obra])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return linhas.filter((l) => {
      if (q && !`${l.servico.descricao} ${l.codigo ?? ''}`.toLowerCase().includes(q)) return false
      if (filtro === 'medidos') return l.medido > 0
      if (filtro === 'a-conferir') return l.servico.flag !== 'ok'
      if (filtro === 'sem-contratado') return l.contratado == null
      return true
    })
  }, [linhas, busca, filtro])

  if (!catalogo) {
    return (
      <div className="p-6">
        <p className="rounded-xl border border-dashed border-[#525252] p-6 text-center text-xs text-[#6b6b6b]">
          Nenhum catálogo importado. Vá na sub-aba <strong className="text-[#a3a3a3]">Medição</strong> e traga a planilha do contrato.
        </p>
      </div>
    )
  }

  const semContratado = linhas.filter((l) => l.contratado == null).length
  const totalMedido = filtradas.reduce((s, l) => s + l.valorMedido, 0)
  const th = 'px-2 py-2 text-left font-medium text-[#adadad] whitespace-nowrap'
  const td = 'px-2 py-1.5 whitespace-nowrap'
  const botao = (f: Filtro, rotulo: string, n: number) => (
    <button key={f} onClick={() => setFiltro(f)}
      className={`rounded-full border px-2.5 py-1 text-[11px] ${filtro === f
        ? 'border-[#f97316] bg-[#f97316]/15 text-[#ffa055]' : 'border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5]'}`}>
      {rotulo} ({n})
    </button>
  )

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-6">
      {semContratado === linhas.length && (
        <p className="rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2 text-[11px] leading-5 text-[#fbbf24]">
          <AlertTriangle size={12} className="mr-1 inline" />
          <strong>A coluna "Contratado" está vazia em todos os {linhas.length} itens</strong>, e por
          isso não há Saldo nem % consumido. Essa quantidade vem da <em>planilha de balanceamento</em>,
          citada na nota 2 da planilha de medição mas não incluída nela. Assim que ela chegar, entra
          no catálogo num lugar só e desce para todas as obras do contrato.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md border border-[#525252] bg-[#1f1f1f] px-2 py-1">
          <Search size={12} className="text-[#6b6b6b]" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item ou código"
            className="w-52 bg-transparent text-[11px] text-[#f5f5f5] placeholder:text-[#525252] focus:outline-none" />
        </div>
        {botao('medidos', 'Com medição', linhas.filter((l) => l.medido > 0).length)}
        {botao('a-conferir', 'A conferir', linhas.filter((l) => l.servico.flag !== 'ok').length)}
        {botao('sem-contratado', 'Sem qtd contratada', semContratado)}
        {botao('todos', 'Todos', linhas.length)}
        {medicao && medicao.obras.length > 0 && (
          <select value={obra} onChange={(e) => setObra(e.target.value)}
            className="ml-auto rounded-lg border border-[#525252] bg-[#1f1f1f] px-2 py-1 text-[11px] text-[#f5f5f5]">
            <option value="">Todas as obras</option>
            {medicao.obras.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#525252]">
        <table className="w-full text-[11px]">
          <thead className="bg-[#2c2c2c]">
            <tr className="border-b border-[#525252]">
              <th className={th}>Código</th>
              <th className={th}>Descrição</th>
              <th className={th}>UN</th>
              <th className={`${th} text-right`}>Preço c/ repasse</th>
              <th className={`${th} text-right`}>Contratado</th>
              <th className={`${th} text-right`}>Medido</th>
              <th className={`${th} text-right`}>Saldo</th>
              <th className={`${th} text-right`}>Valor medido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3d3d3d]">
            {filtradas.slice(0, 400).map((l) => (
              <tr key={l.servico.id}
                  className={l.servico.bloqueadoParaMedicao ? 'border-l-2 border-l-[#ef4444] bg-[#ef4444]/5' : ''}
                  title={l.servico.motivoFlag}>
                <td className={`${td} font-mono text-[#6b6b6b]`}>{l.codigo ?? '—'}</td>
                <td className={`${td} max-w-[280px] truncate text-[#f5f5f5]`} title={l.servico.descricao}>
                  {l.servico.descricao}
                  {l.servico.flag !== 'ok' && (
                    <span className={`ml-1.5 rounded px-1 text-[9px] ${l.servico.bloqueadoParaMedicao
                      ? 'bg-[#ef4444]/20 text-[#fca5a5]' : 'bg-[#eab308]/20 text-[#fbbf24]'}`}>
                      {l.servico.bloqueadoParaMedicao ? 'não medir' : 'conferir'}
                    </span>
                  )}
                </td>
                <td className={`${td} text-[#a3a3a3]`}>{l.servico.unidade}</td>
                <td className={`${td} text-right font-mono text-[#c9c9c9]`}>{brl(l.precoComFator)}</td>
                {/* ⚠️ "—" em cinza, nunca 0: zero seria uma afirmação que ninguém fez. */}
                <td className={`${td} text-right font-mono text-[#6b6b6b]`}>{l.contratado == null ? '—' : num(l.contratado)}</td>
                <td className={`${td} text-right font-mono ${l.medido > 0 ? 'text-[#f5f5f5]' : 'text-[#525252]'}`}>{l.medido > 0 ? num(l.medido) : '—'}</td>
                <td className={`${td} text-right font-mono text-[#6b6b6b]`}>{l.saldo == null ? '—' : num(l.saldo)}</td>
                <td className={`${td} text-right font-mono ${l.servico.bloqueadoParaMedicao ? 'text-[#fca5a5]' : 'text-[#f5f5f5]'}`}>
                  {l.valorMedido > 0 ? brl(l.valorMedido) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-[#525252] bg-[#2c2c2c]">
            <tr>
              <td className={`${td} text-[#a3a3a3]`} colSpan={7}>
                {filtradas.length} item(ns){filtradas.length > 400 && ' · mostrando os 400 primeiros'}
              </td>
              <td className={`${td} text-right font-mono font-bold text-[#f5f5f5]`}>{brl(totalMedido)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[10px] leading-4 text-[#6b6b6b]">
        O preço é o da região da obra escolhida — o mesmo item custa diferente em Mairiporã. Linha
        com borda vermelha tem preço a conferir e <strong>não entra em medição</strong> até alguém
        confirmar; o valor dela aparece aqui só para você saber o tamanho do que está parado.
      </p>
    </div>
  )
}
