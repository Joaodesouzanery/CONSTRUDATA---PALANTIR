/**
 * CarteiraObrasPanel — a planilha "Obras em Andamento" dentro do sistema.
 *
 * Até aqui a Torre mostrava obras só como cards: código, nome, endereço, gerente. **Nenhum R$ em
 * lugar nenhum** — nem valor de contrato, nem faturado, nem saldo. Quem precisava dessa visão
 * mantinha uma planilha à parte e a atualizava à mão.
 *
 * Esta tela é aquela planilha: por obra, o contrato separado em SERVIÇO e MATERIAL, o que já foi
 * faturado e o saldo — com o rodapé que o cliente fecha à mão hoje (Valor Serviço Restante e
 * Retenção Técnica).
 *
 * Duas regras vindas da planilha, e elas não são detalhe:
 *  - **o saldo é contra o SERVIÇO**; o material é faturado à parte e não entra na conta;
 *  - **a entrada é a primeira nota do extrato**, não um campo separado da obra.
 */
import { useMemo, useState } from 'react'
import { Wallet, Download, AlertTriangle } from 'lucide-react'
import { useTorreStore } from '@/store/torreDeControleStore'
import { separarPorAtividade } from '@/lib/obraAtiva'
import { hojeLocalISO, fmtDataBR } from '@/lib/utils'
import {
  valoresDoContrato, resumoFaturamento, totaisCarteira, type LinhaCarteira,
} from '@/features/torre-de-controle/utils/obraMedicao'

const brl = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * `onAbrirObra`: a Carteira é a lista; o detalhe é a outra sub-aba. Antes clicar numa linha só
 * chamava `selectSite` e nada visível acontecia — o clique era morto.
 */
export function CarteiraObrasPanel({ onAbrirObra }: { onAbrirObra?: (siteId: string) => void } = {}) {
  const sites = useTorreStore((s) => s.sites)
  const selectSite = useTorreStore((s) => s.selectSite)
  const selectedId = useTorreStore((s) => s.selectedId)
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false)

  const hoje = hojeLocalISO()
  const { inativas } = separarPorAtividade(sites)

  const { linhas, totais, vencidas } = useMemo(() => {
    const { ativas, inativas } = separarPorAtividade(sites)
    const visiveis = mostrarArquivadas ? [...ativas, ...inativas] : ativas
    const vencidas: Array<{ obra: string; valor: number; previsao?: string }> = []
    const linhas: Array<LinhaCarteira & { temContrato: boolean; entrada: number | null }> = visiveis.map((site) => {
      const v = valoresDoContrato(site.contrato)
      const f = resumoFaturamento(site.contrato, hoje)
      for (const n of f.vencidas) vencidas.push({ obra: site.name, valor: n.valor, previsao: n.previsaoRecebimento })
      return {
        siteId: site.id,
        nome: site.name,
        servico: v.servico,
        material: v.material,
        faturado: f.faturado,
        saldo: f.saldo,
        retencao: f.retencao,
        aReceber: f.aReceber,
        temContrato: v.total > 0,
        entrada: f.entrada,
      }
    })
    // Obra sem valor de contrato não entra no rodapé: ela somaria zero e daria a impressão de que
    // a carteira está completa quando na verdade falta cadastrar o contrato.
    const comValor = linhas.filter((l) => l.temContrato)
    return { linhas, totais: totaisCarteira(comValor), vencidas }
  }, [sites, mostrarArquivadas, hoje])

  const semContrato = linhas.filter((l) => !l.temContrato)
  const comContrato = linhas.filter((l) => l.temContrato)

  /**
   * A obra selecionada na Torre entra destacada, com o total dela sozinha; as demais ficam
   * abaixo de uma linha divisória, para comparação — não é mais "a carteira inteira misturada".
   * Sem seleção válida (nada selecionado, ou a selecionada não tem contrato — e por isso não
   * aparece aqui), cai de volta no comportamento antigo: uma lista só, com "TOTAL" geral.
   */
  const linhaSelecionada = comContrato.find((l) => l.siteId === selectedId)
  const outrasLinhas = linhaSelecionada ? comContrato.filter((l) => l.siteId !== selectedId) : comContrato
  const totaisSelecionada = linhaSelecionada ? totaisCarteira([linhaSelecionada]) : null
  const totaisOutras = totaisCarteira(outrasLinhas)

  function exportarCsv() {
    const cab = ['Obra', 'Servico', 'Material', 'Entrada', 'Faturado', 'Saldo do servico', 'Retencao tecnica', 'A receber']
    const linhasCsv = linhas.filter((l) => l.temContrato).map((l) => [
      l.nome, l.servico, l.material, l.entrada ?? '', l.faturado, l.saldo, l.retencao, l.aReceber,
    ])
    const rodape = ['TOTAL', totais.servico, totais.material, '', totais.faturado, totais.saldo, totais.retencao, totais.aReceber]
    // `;` e vírgula decimal: é o que o Excel em pt-BR abre sem pedir nada.
    const csv = [cab, ...linhasCsv, rodape]
      .map((linha) => linha.map((c) => (typeof c === 'number' ? c.toFixed(2).replace('.', ',') : `"${String(c)}"`)).join(';'))
      .join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `carteira-de-obras-${hoje}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#2c2c2c]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#525252] px-5 py-3">
        <div className="flex items-center gap-2">
          <Wallet size={15} className="text-[#f97316]" />
          <div>
            <h2 className="text-sm font-bold text-[#f5f5f5]">Carteira de obras</h2>
            <p className="text-[11px] text-[#9a9a9a]">Contrato, faturado e saldo por obra. O saldo é contra o serviço — o material é faturado à parte.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {inativas.length > 0 && (
            <button onClick={() => setMostrarArquivadas((v) => !v)}
              className="rounded-lg border border-[#525252] px-2.5 py-1 text-[11px] text-[#a3a3a3] hover:text-[#f5f5f5]">
              {mostrarArquivadas ? 'Ocultar arquivadas' : `Ver ${inativas.length} arquivada(s)`}
            </button>
          )}
          <button onClick={exportarCsv} disabled={linhas.length === 0}
            className="flex items-center gap-1 rounded-lg border border-[#525252] px-2.5 py-1 text-[11px] text-[#a3a3a3] hover:border-[#22c55e]/30 hover:text-[#22c55e] disabled:opacity-40">
            <Download size={12} /> Exportar
          </button>
        </div>
      </div>

      {vencidas.length > 0 && (
        <div className="mx-5 mt-3 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#f87171]">
            <AlertTriangle size={13} /> {vencidas.length} nota(s) a receber já venceram
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {vencidas.map((v, i) => (
              <li key={i} className="text-[11px] text-[#e5e5e5]">
                {v.obra} — {brl(v.valor)}{v.previsao ? ` · previsto para ${fmtDataBR(v.previsao)}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 overflow-auto px-5 py-3">
        {linhas.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#9a9a9a]">Nenhuma obra cadastrada.</p>
        ) : (
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[#a3a3a3]">
                <th className="pb-2 text-left font-semibold">Obra</th>
                <th className="pb-2 text-right font-semibold">Serviço</th>
                <th className="pb-2 text-right font-semibold">Material</th>
                <th className="pb-2 text-right font-semibold">Entrada</th>
                <th className="pb-2 text-right font-semibold">Faturado</th>
                <th className="pb-2 text-right font-semibold">Saldo do serviço</th>
                <th className="pb-2 text-right font-semibold" title="Garantia retida pelo cliente, liberada depois da entrega">Retenção a liberar</th>
              </tr>
            </thead>
            <tbody>
              {/* A obra selecionada na Torre entra destacada, com o total dela sozinha — não
                  misturada com as demais. */}
              {linhaSelecionada && totaisSelecionada && (
                <>
                  <tr>
                    <td colSpan={7} className="pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-[#f97316]">
                      Obra selecionada
                    </td>
                  </tr>
                  <tr onClick={() => { selectSite(linhaSelecionada.siteId); onAbrirObra?.(linhaSelecionada.siteId) }}
                    className="cursor-pointer border-t border-[#f97316]/40 bg-[#f97316]/5 hover:bg-[#f97316]/10">
                    <td className="py-1.5 pr-2 font-semibold text-[#f5f5f5]">{linhaSelecionada.nome}</td>
                    <td className="py-1.5 text-right font-mono text-[#a3a3a3]">{brl(linhaSelecionada.servico)}</td>
                    <td className="py-1.5 text-right font-mono text-[#a3a3a3]">{linhaSelecionada.material > 0 ? brl(linhaSelecionada.material) : '—'}</td>
                    <td className="py-1.5 text-right font-mono text-[#a3a3a3]">{linhaSelecionada.entrada != null ? brl(linhaSelecionada.entrada) : '—'}</td>
                    <td className="py-1.5 text-right font-mono text-[#f59e0b]">{brl(linhaSelecionada.faturado)}</td>
                    <td className={`py-1.5 text-right font-mono font-bold ${linhaSelecionada.saldo < 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>{brl(linhaSelecionada.saldo)}</td>
                    <td className="py-1.5 text-right font-mono text-[#a3a3a3]">{linhaSelecionada.retencao > 0 ? brl(linhaSelecionada.retencao) : '—'}</td>
                  </tr>
                  <tr className="border-t border-[#f97316]/30 text-[11px] font-semibold">
                    <td className="py-1.5 text-[#f97316]">Total (obra selecionada)</td>
                    <td className="py-1.5 text-right font-mono text-[#f5f5f5]">{brl(totaisSelecionada.servico)}</td>
                    <td className="py-1.5 text-right font-mono text-[#f5f5f5]">{brl(totaisSelecionada.material)}</td>
                    <td className="py-1.5" />
                    <td className="py-1.5 text-right font-mono text-[#f59e0b]">{brl(totaisSelecionada.faturado)}</td>
                    <td className="py-1.5 text-right font-mono text-[#22c55e]">{brl(totaisSelecionada.saldo)}</td>
                    <td className="py-1.5 text-right font-mono text-[#a3a3a3]">{brl(totaisSelecionada.retencao)}</td>
                  </tr>
                </>
              )}

              {/* As demais — só para comparação/visão geral. Sem seleção válida, esta é a lista
                  inteira, e o rótulo do total volta a ser "TOTAL" (comportamento antigo). */}
              {linhaSelecionada && outrasLinhas.length > 0 && (
                <tr>
                  <td colSpan={7} className="pb-1 pt-4 text-[10px] uppercase tracking-wide text-[#6b6b6b]">
                    Outras obras — somente para comparação/visão geral
                  </td>
                </tr>
              )}
              {outrasLinhas.map((l) => (
                <tr key={l.siteId} onClick={() => { selectSite(l.siteId); onAbrirObra?.(l.siteId) }}
                  className="cursor-pointer border-t border-[#3d3d3d] hover:bg-[#333333]">
                  <td className="py-1.5 pr-2 font-semibold text-[#f5f5f5]">{l.nome}</td>
                  <td className="py-1.5 text-right font-mono text-[#a3a3a3]">{brl(l.servico)}</td>
                  <td className="py-1.5 text-right font-mono text-[#a3a3a3]">{l.material > 0 ? brl(l.material) : '—'}</td>
                  <td className="py-1.5 text-right font-mono text-[#a3a3a3]">{l.entrada != null ? brl(l.entrada) : '—'}</td>
                  <td className="py-1.5 text-right font-mono text-[#f59e0b]">{brl(l.faturado)}</td>
                  <td className={`py-1.5 text-right font-mono font-bold ${l.saldo < 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>{brl(l.saldo)}</td>
                  <td className="py-1.5 text-right font-mono text-[#a3a3a3]">{l.retencao > 0 ? brl(l.retencao) : '—'}</td>
                </tr>
              ))}
              {(!linhaSelecionada || outrasLinhas.length > 0) && (
                <>
                  <tr className="border-t-2 border-[#525252] font-bold">
                    <td className="py-2 text-[#f5f5f5]">{linhaSelecionada ? 'TOTAL (outras obras)' : 'TOTAL'}</td>
                    <td className="py-2 text-right font-mono text-[#f5f5f5]">{brl(totaisOutras.servico)}</td>
                    <td className="py-2 text-right font-mono text-[#f5f5f5]">{brl(totaisOutras.material)}</td>
                    <td className="py-2" />
                    <td className="py-2 text-right font-mono text-[#f59e0b]">{brl(totaisOutras.faturado)}</td>
                    <td className="py-2 text-right font-mono text-[#22c55e]">{brl(totaisOutras.saldo)}</td>
                    <td className="py-2 text-right font-mono text-[#a3a3a3]">{brl(totaisOutras.retencao)}</td>
                  </tr>
                  <tr className="text-[11px] text-[#a3a3a3]">
                    <td className="pt-1" colSpan={5}>Valor Serviço Restante</td>
                    <td className="pt-1 text-right font-mono">{brl(totaisOutras.saldo)}</td>
                    <td className="pt-1 text-right font-mono" title="Garantia retida pelo cliente — dinheiro seu, liberado depois da entrega">{brl(totaisOutras.retencao)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        )}

        {totais.retencao > 0 && (
          <p className="mt-3 text-[11px] text-[#d4d4d4]">
            <b>{brl(totais.retencao)} de retenção a liberar.</b> É a parte de cada nota que o cliente
            segura como garantia e devolve depois da entrega — dinheiro seu, que não está no saldo nem
            no caixa. Fica aqui para não sumir da sua previsão.
          </p>
        )}

        {semContrato.length > 0 && (
          <p className="mt-4 text-[11px] text-[#a3a3a3]">
            {semContrato.length} obra(s) sem valor de contrato cadastrado, fora do total:{' '}
            {semContrato.map((l) => l.nome).join(', ')}. Cadastre em Detalhes da Obra → Contrato &amp; Medição.
          </p>
        )}
      </div>
    </div>
  )
}
