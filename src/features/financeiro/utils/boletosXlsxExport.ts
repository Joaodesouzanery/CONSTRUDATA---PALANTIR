/**
 * boletosXlsxExport.ts — o mesmo recorte do relatório, em planilha.
 *
 * Uma linha por PARCELA (não por boleto): é o formato que serve para conciliar no extrato e
 * para colar num lote de pagamento do internet banking.
 *
 * O cuidado que importa: a linha digitável tem 47/48 dígitos. Se sair como número, o Excel
 * a transforma em notação científica e perde os dígitos finais — por isso a célula é forçada
 * a texto (`t: 's'`), e não apenas preenchida com uma string.
 */
import * as XLSX from 'xlsx'
import { formatarCodigo, digitosDe } from './boletoCodigo'
import { fmtDataBR } from '@/lib/utils'
import type { BoletoReportItem } from './boletosReportExport'

const CABECALHO = [
  'Tipo', 'Descrição', 'Beneficiário / Pagador', 'Obra', 'Categoria',
  'Parcela', 'Vencimento', 'Situação', 'Pago em', 'Valor (R$)', 'Linha digitável', 'Notas',
] as const

const LARGURAS = [10, 38, 30, 26, 18, 9, 12, 12, 12, 14, 56, 34]

function situacao(status: string, vencimento: string, hoje: string): string {
  if (status === 'pago') return 'Pago'
  if (status === 'cancelado') return 'Cancelado'
  return vencimento < hoje ? 'Vencido' : 'Em aberto'
}

export function exportBoletosXlsx(itens: BoletoReportItem[], hoje: string, nomeArquivo?: string): void {
  const linhas = itens
    .flatMap((item) => item.parcelas.map((p) => ({ item, p })))
    .sort((a, b) => a.p.vencimento.localeCompare(b.p.vencimento) || a.item.descricao.localeCompare(b.item.descricao))

  const corpo = linhas.map(({ item, p }) => [
    item.tipo === 'pagar' ? 'A pagar' : 'A receber',
    item.descricao,
    item.parceiro || '',
    item.obraLabel,
    item.categoriaLabel ?? '',
    p.num && p.de ? `${p.num}/${p.de}` : '',
    fmtDataBR(p.vencimento),
    situacao(p.status, p.vencimento, hoje),
    p.dataPagamento ? fmtDataBR(p.dataPagamento) : '',
    p.valor,
    formatarCodigo(digitosDe(p.codigo)),
    item.notas ?? '',
  ])

  const total = linhas.reduce((s, { p }) => s + p.valor, 0)
  corpo.push(['', `TOTAL — ${linhas.length} parcela(s)`, '', '', '', '', '', '', '', total, '', ''])

  const ws = XLSX.utils.aoa_to_sheet([[...CABECALHO], ...corpo])
  ws['!cols'] = LARGURAS.map((wch) => ({ wch }))
  // (sem congelar o cabeçalho: `!freeze` não existe nesta edição do SheetJS — seria só
  //  uma propriedade ignorada no arquivo gerado.)

  // Coluna K (índice 10) = linha digitável. Forçada a texto célula a célula: sem isso o
  // Excel lê "10499819863500010004602003903701315560000036700" como número e arredonda.
  for (let r = 1; r <= corpo.length; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: 10 })
    const cell = ws[ref]
    if (cell && cell.v !== '') { cell.t = 's'; cell.z = '@' }
    const valorRef = XLSX.utils.encode_cell({ r, c: 9 })
    if (ws[valorRef]) ws[valorRef].z = '#,##0.00'
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Boletos')
  XLSX.writeFile(wb, nomeArquivo ?? `Boletos_${hoje}.xlsx`)
}
