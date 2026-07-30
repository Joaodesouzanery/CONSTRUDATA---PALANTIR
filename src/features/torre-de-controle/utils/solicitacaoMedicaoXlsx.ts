/**
 * solicitacaoMedicaoXlsx.ts — exporta a "Solicitação de Medição" de uma obra em planilha (.xlsx)
 * a partir do Controle de Medição (cabeçalho do contrato + serviços + medido/saldo/valor + totais
 * bruto/líquido). Reusa o padrão SheetJS (aoa_to_sheet → writeFile) do exportEngine dos
 * Quantitativos — sem dependência nova. Os valores vão como números (Excel/Sheets formata/soma).
 */
import * as XLSX from 'xlsx'
import type { ConstructionSite } from '@/types'
import { calcServico, totaisContrato } from '@/features/torre-de-controle/utils/obraMedicao'

type Cell = string | number
type Row = Cell[]

/** Gera e baixa a planilha "Solicitação de Medição" da obra. No-op se não houver serviços. */
export function exportSolicitacaoMedicao(site: ConstructionSite, medidoAuto: Map<string, number>) {
  const c = site.contrato
  if (!c || c.services.length === 0) return
  const services = c.services
  const tot = totaisContrato(services, medidoAuto, c.descontoNfPct)

  const rows: Row[] = []
  // ── Cabeçalho (label/valor) ────────────────────────────────────────────────
  rows.push(['SOLICITAÇÃO DE MEDIÇÃO'])
  rows.push(['Obra', site.name])
  if (c.contratanteRazao) rows.push(['Contratante', c.contratanteRazao + (c.contratanteCnpj ? ` — ${c.contratanteCnpj}` : '')])
  if (c.contratadoRazao)  rows.push(['Contratado', c.contratadoRazao + (c.contratadoCnpj ? ` — ${c.contratadoCnpj}` : '')])
  if (c.contratadoContato) rows.push(['Contato', c.contratadoContato])
  if (c.numeroContrato || c.numeroAditivo) rows.push(['Contrato', [c.numeroContrato, c.numeroAditivo && `aditivo ${c.numeroAditivo}`].filter(Boolean).join(' · ')])
  if (c.objetoAditivo)     rows.push(['Objeto', c.objetoAditivo])
  if (c.local)             rows.push(['Local', c.local])
  if (c.numeroMedicao)     rows.push(['Medição nº', c.numeroMedicao])
  if (c.periodoReferencia) rows.push(['Período', c.periodoReferencia])
  if (c.valorTotal != null) rows.push(['Valor total do contrato (R$)', c.valorTotal])
  rows.push([])

  // ── Tabela de serviços ─────────────────────────────────────────────────────
  rows.push(['Item', 'Serviço', 'Un', 'Qtd contratada', 'Preço cheio (R$)', '% aplicado', 'Preço efetivo (R$)', 'Medido anterior', 'Medido atual', 'Saldo', 'Valor bruto (R$)'])
  services.forEach((s, i) => {
    const calc = calcServico(s, medidoAuto)
    rows.push([
      i + 1,
      s.descricao || '—',
      s.unidade,
      s.qtdContrato || 0,
      s.valorUnitario || 0,
      s.pctAplicado ?? 100,
      calc.precoEfetivo,
      s.qtdAnterior ?? 0,
      calc.medido,
      calc.saldo,
      calc.valorBruto,
    ])
  })

  // ── Totais (valor na última coluna; label na penúltima) ────────────────────
  const totalRow = (label: string, valor: number): Row => ['', '', '', '', '', '', '', '', '', label, valor]
  rows.push([])
  rows.push(totalRow('Valor contrato (R$)', tot.valorContrato))
  rows.push(totalRow('Medido bruto (R$)', tot.medidoBruto))
  if (tot.descontoNfPct > 0) {
    rows.push(totalRow(`Desconto NF materiais (${tot.descontoNfPct}%)`, -tot.descontoNf))
    rows.push(totalRow('Medido líquido (R$)', tot.medidoLiquido))
  }
  rows.push(totalRow('Saldo (R$)', tot.saldo))

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 6 }, { wch: 42 }, { wch: 6 }, { wch: 15 }, { wch: 16 }, { wch: 11 },
    { wch: 17 }, { wch: 15 }, { wch: 13 }, { wch: 13 }, { wch: 16 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Medição')

  const safe = (v: string) => v.replace(/[^a-zA-Z0-9\-_À-ÿ ]/g, '_').trim()
  const med = c.numeroMedicao ? `-med${safe(c.numeroMedicao)}` : ''
  XLSX.writeFile(wb, `Solicitacao-Medicao-${safe(site.name)}${med}.xlsx`)
}
