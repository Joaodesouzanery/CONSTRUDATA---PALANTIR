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

export function CarteiraObrasPanel() {
  const sites = useTorreStore((s) => s.sites)
  const selectSite = useTorreStore((s) => s.selectSite)
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
              <tr className="text-[10px] uppercase tracking-wider text-[#6b6b6b]">
                <th className="pb-2 text-left font-semibold">Obra</th>
                <th className="pb-2 text-right font-semibold">Serviço</th>
                <th className="pb-2 text-right font-semibold">Material</th>
                <th className="pb-2 text-right font-semibold">Entrada</th>
                <th className="pb-2 text-right font-semibold">Faturado</th>
                <th className="pb-2 text-right font-semibold">Saldo do serviço</th>
                <th className="pb-2 text-right font-semibold">Retenção</th>
              </tr>
            </thead>
            <tbody>
              {linhas.filter((l) => l.temContrato).map((l) => (
                <tr key={l.siteId} onClick={() => selectSite(l.siteId)}
                  className="cursor-pointer border-t border-[#3d3d3d] hover:bg-[#333333]">
                  <td className="py-1.5 pr-2 font-semibold text-[#f5f5f5]">{l.nome}</td>
                  <td className="py-1.5 text-right font-mono text-[#a3a3a3]">{brl(l.servico)}</td>
                  <td className="py-1.5 text-right font-mono text-[#a3a3a3]">{l.material > 0 ? brl(l.material) : '—'}</td>
                  <td className="py-1.5 text-right font-mono text-[#a3a3a3]">{l.entrada != null ? brl(l.entrada) : '—'}</td>
                  <td className="py-1.5 text-right font-mono text-[#f59e0b]">{brl(l.faturado)}</td>
                  <td className={`py-1.5 text-right font-mono font-bold ${l.saldo < 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>{brl(l.saldo)}</td>
                  <td className="py-1.5 text-right font-mono text-[#6b6b6b]">{l.retencao > 0 ? brl(l.retencao) : '—'}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#525252] font-bold">
                <td className="py-2 text-[#f5f5f5]">TOTAL</td>
                <td className="py-2 text-right font-mono text-[#f5f5f5]">{brl(totais.servico)}</td>
                <td className="py-2 text-right font-mono text-[#f5f5f5]">{brl(totais.material)}</td>
                <td className="py-2" />
                <td className="py-2 text-right font-mono text-[#f59e0b]">{brl(totais.faturado)}</td>
                <td className="py-2 text-right font-mono text-[#22c55e]">{brl(totais.saldo)}</td>
                <td className="py-2 text-right font-mono text-[#a3a3a3]">{brl(totais.retencao)}</td>
              </tr>
              <tr className="text-[10px] text-[#6b6b6b]">
                <td className="pt-1" colSpan={5}>Valor Serviço Restante</td>
                <td className="pt-1 text-right font-mono">{brl(totais.saldo)}</td>
                <td className="pt-1 text-right font-mono" title="Retenção Técnica / Contratual">{brl(totais.retencao)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {semContrato.length > 0 && (
          <p className="mt-4 text-[11px] text-[#6b6b6b]">
            {semContrato.length} obra(s) sem valor de contrato cadastrado, fora do total:{' '}
            {semContrato.map((l) => l.nome).join(', ')}. Cadastre em Detalhes da Obra → Contrato &amp; Medição.
          </p>
        )}
      </div>
    </div>
  )
}
