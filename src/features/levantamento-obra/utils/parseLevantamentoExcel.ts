import * as XLSX from 'xlsx'
import { parseLocaleNumber } from '@/lib/numberFormat'
import type { LevantamentoObra, MaoObraFuncao, MedidaLinha, OrcamentoLinha, RegistroFotoLinha } from '@/store/levantamentoObraStore'

const text = (value: unknown) => String(value ?? '').trim()
const num = (value: unknown) => parseLocaleNumber(value as string | number | null | undefined)

function normalizeLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function rowsOf(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const wanted = normalizeLabel(sheetName)
  const realName = workbook.SheetNames.find((name) => normalizeLabel(name) === wanted)
  const sheet = workbook.Sheets[realName ?? sheetName]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' })
}

function normalizeService(value: unknown): MedidaLinha['tipoServico'] {
  const normalized = normalizeLabel(text(value))
  if (normalized.includes('demarcacao') && normalized.includes('especial')) return 'DEMARCAÇÕES ESPECIAIS'
  if (normalized.includes('demarcacao')) return 'DEMARCAÇÃO DE VAGAS'
  if (normalized.includes('parede')) return 'PAREDE'
  if (normalized.includes('teto')) return 'TETO'
  if (normalized.includes('piso')) return 'PISO'
  return ''
}

function parseDateLabel(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const raw = text(value)
  if (!raw) return ''
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return raw
}

export async function parseLevantamentoExcel(file: File): Promise<Partial<LevantamentoObra>> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const medidasRows = rowsOf(workbook, 'Cálculo de Medidas')
  const levantamentoRows = rowsOf(workbook, 'Levantamento de Obra')
  const pessoalRows = rowsOf(workbook, 'Custos com Pessoal')
  const orcamentoRows = rowsOf(workbook, 'Orçamento da Obra')
  const fotosRows = rowsOf(workbook, 'Registro Fotográfico')
  const resumoRows = rowsOf(workbook, 'Resumo do Levantamento')

  const medidas: MedidaLinha[] = medidasRows.slice(5, 55)
    .filter((row) => text(row[1]) || text(row[2]) || num(row[5]) > 0 || num(row[6]) > 0)
    .map((row, index) => ({
      id: crypto.randomUUID(),
      item: num(row[0]) || index + 1,
      tipoServico: normalizeService(row[1]),
      pavimentoLocal: text(row[2]),
      comprimento: num(row[3]),
      larguraAltura: num(row[4]),
      m2Calculado: num(row[5]),
      metroLinear: num(row[6]),
      quantidade: num(row[7]),
      observacoes: text(row[8]),
    }))

  const maoObra: MaoObraFuncao[] = pessoalRows.slice(6, 11)
    .filter((row) => text(row[0]))
    .map((row) => ({
      id: crypto.randomUUID(),
      funcao: text(row[0]),
      salarioBruto: num(row[2]),
      vt: num(row[4]),
      va: num(row[5]),
      horasExtrasQtd: num(row[6]),
      horasExtrasValor: num(row[7]),
      custoMensal: num(row[11]),
      dias: num(row[12]),
      obrasSimultaneas: num(row[13]),
      custoDiario: (num(row[11]) > 0 && num(row[12]) > 0 && num(row[13]) > 0) ? num(row[11]) / (num(row[12]) * num(row[13])) : 0,
      quantidadeObra: 0,
      diasObra: 60,
    }))

  pessoalRows.slice(16, 21).forEach((row) => {
    const target = maoObra.find((item) => item.funcao.toLowerCase() === text(row[0]).toLowerCase())
    if (!target) return
    target.quantidadeObra = num(row[2])
    target.custoDiario = num(row[3]) || target.custoDiario
    target.diasObra = num(row[4])
  })

  const faturamento: OrcamentoLinha[] = orcamentoRows.slice(14, 18)
    .filter((row) => text(row[0]))
    .map((row) => ({
      id: crypto.randomUUID(),
      codigo: text(row[0]),
      descricao: text(row[1]),
      valor: num(row[5]),
      aliquota: num(row[7]) / 100,
      impostos: num(row[8]),
      observacoes: text(row[9]),
      tipo: 'faturamento',
    }))

  const despesas: OrcamentoLinha[] = orcamentoRows.slice(22, 28)
    .filter((row) => text(row[0]))
    .map((row) => ({
      id: crypto.randomUUID(),
      codigo: text(row[0]),
      descricao: text(row[1]),
      valor: num(row[5]),
      aliquota: 0,
      impostos: 0,
      observacoes: text(row[8]),
      tipo: 'despesa',
    }))

  const fotos: RegistroFotoLinha[] = fotosRows.slice(7, 17)
    .filter((row) => text(row[0]))
    .map((row) => ({
      id: crypto.randomUUID(),
      pavimentoSuperficie: text(row[0]),
      fotos: ['Visao Geral', 'Piso / Vagas', 'Parede', 'Teto', 'Patologias'].map((label) => ({ label })),
      estadoGeral: text(row[6]),
      data: parseDateLabel(row[7]),
      responsavelTecnico: text(row[8]),
      observacoes: text(row[9]),
    }))

  const resumoFinanceiro = {
    faturamentoTotal: num(orcamentoRows[31]?.[5]) || num(resumoRows[19]?.[5]),
    totalImpostos: num(orcamentoRows[32]?.[5]) || num(resumoRows[20]?.[5]),
    totalDespesas: num(orcamentoRows[33]?.[5]) || num(resumoRows[21]?.[5]),
    saldoLiquido: num(orcamentoRows[34]?.[5]) || num(resumoRows[22]?.[5]),
    margemLiquida: num(orcamentoRows[35]?.[5]) / 100,
    custoMoPorM2Piso: num(orcamentoRows[36]?.[5]),
  }

  return {
    obra: text(levantamentoRows[5]?.[1]) || text(orcamentoRows[5]?.[1]),
    contratante: text(levantamentoRows[5]?.[5]) || text(orcamentoRows[6]?.[1]),
    responsavel: text(levantamentoRows[5]?.[8]),
    dataLevantamento: parseDateLabel(levantamentoRows[5]?.[11]),
    endereco: text(levantamentoRows[6]?.[1]),
    cidadeUf: text(levantamentoRows[6]?.[5]),
    tecnicoResponsavel: text(levantamentoRows[6]?.[8]),
    numeroOrcamento: text(levantamentoRows[6]?.[11]) || text(orcamentoRows[7]?.[1]),
    tipoServico: text(levantamentoRows[7]?.[1]),
    sistemaAplicado: text(levantamentoRows[7]?.[5]),
    produtoPrincipal: text(levantamentoRows[7]?.[8]),
    prazoEstimadoDias: num(levantamentoRows[7]?.[11]),
    medidas,
    maoObra,
    orcamento: [...faturamento, ...despesas],
    fotos,
    resumoFinanceiro,
    status: 'levantamento_concluido',
  }
}
