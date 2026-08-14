import { useMedicaoUnificadaStore, type UnifiedFinancialType } from '@/store/medicaoUnificadaStore'
import type { Fornecedor } from '@/store/medicaoBillingStore'
import { useAuth } from '@/lib/auth'
import { seededId } from '@/lib/seededId'
import type { SubempreiteiroParseResult } from './xlsxParsers'

/**
 * Id derivado da linha da planilha, em vez de sorteado.
 *
 * Importar a MESMA planilha duas vezes — por engano, ou em dois dispositivos — criava duas
 * cópias de tudo: medições, memórias e lançamentos financeiros. Como a planilha é o próprio
 * documento de origem, ela já traz a chave natural da linha (arquivo + aba + posição), e
 * derivar o id dela faz a segunda importação **regravar** as mesmas linhas em vez de somar
 * outras. Reimportar passa a ser corrigir, não duplicar.
 *
 * A posição na planilha entra como desempate porque a mesma linha pode repetir descrição e
 * valor legitimamente (duas diárias iguais, dois trechos idênticos). Se o arquivo for editado
 * e as linhas mudarem de lugar, a importação gera ids novos — é o comportamento certo: passou
 * a ser outro documento.
 */
function idLinha(tipo: string, arquivo: string, ...partes: Array<string | number | null | undefined>): string {
  const orgId = useAuth.getState().profile?.organization_id
  return seededId(orgId, `import-medicao:${tipo}`, arquivo, ...partes.map((v) => String(v ?? '')))
}

type ImportSummary = {
  sources: number
  memoryLines: number
  financialEntries: number
}

const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
const text = (value: unknown) => String(value ?? '').trim()

function monthPeriod(value?: string | null) {
  const raw = text(value)
  if (!raw) return null
  const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const monthMap: Record<string, string> = {
    jan: '01', fev: '02', feb: '02', mar: '03', abr: '04', apr: '04',
    mai: '05', may: '05', jun: '06', jul: '07', ago: '08', aug: '08',
    set: '09', sep: '09', out: '10', oct: '10', nov: '11', dez: '12', dec: '12',
  }
  const monthName = normalized.match(/\b(jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)\b/)
  const year = normalized.match(/\b(\d{2,4})\b/)
  if (monthName && year) return `20${year[1].slice(-2)}-${monthMap[monthName[1]]}`
  const br = normalized.match(/\b(0?[1-9]|1[0-2])\/(\d{2,4})\b/)
  if (br) return `20${br[2].slice(-2)}-${br[1].padStart(2, '0')}`
  return null
}

function sourceDate(value?: string | null) {
  const period = monthPeriod(value)
  return period ? `${period}-01` : undefined
}

function sourceIssues(input: {
  contractor?: string | null
  nucleo?: string | null
  local?: string | null
  nPreco?: string | null
  quantity?: number | null
  unitPrice?: number | null
  evidence?: string | null
  sourceWarnings?: string[]
}) {
  return Array.from(new Set([
    !text(input.contractor) ? 'Sem empreiteiro ou fornecedor vinculado' : '',
    !text(input.nucleo) ? 'Sem núcleo' : '',
    !text(input.local) ? 'Sem rua/local' : '',
    !text(input.nPreco) ? 'Sem serviço ou N. Preço' : '',
    input.quantity != null && input.quantity <= 0 ? 'Sem quantidade medida' : '',
    input.unitPrice != null && input.unitPrice <= 0 ? 'Sem preço unitário' : '',
    !text(input.evidence) ? 'Sem evidência documental/fotográfica' : '',
    ...(input.sourceWarnings ?? []),
  ].filter(Boolean)))
}

function financialTypeFromBucket(bucket: string): UnifiedFinancialType {
  const key = bucket.toLowerCase()
  if (key.includes('retencao')) return 'retention'
  if (key.includes('rh')) return 'rh'
  if (key.includes('maquina')) return 'machine'
  if (key.includes('veiculo')) return 'vehicle'
  if (key.includes('combustivel')) return 'fuel'
  if (key.includes('material') || key.includes('agregado')) return 'material'
  if (key.includes('epi')) return 'epi'
  if (key.includes('servico')) return 'third_party_service'
  if (key.includes('adiantamento')) return 'advance'
  return 'discount'
}

type ImportedCostRow = Record<string, unknown>

function costAmount(row: unknown) {
  const maybe = row as ImportedCostRow
  return num(maybe.total ?? maybe.valorTotal ?? maybe.valor ?? maybe.valorFinal)
}

async function promoteCostRows(input: {
  rows?: unknown[]
  bucket: string
  contractorName: string
  nucleo?: string
  period?: string
  fileName?: string
}) {
  const store = useMedicaoUnificadaStore.getState()
  let count = 0
  const arquivo = input.fileName ?? input.contractorName
  let indice = -1
  for (const row of input.rows ?? []) {
    indice += 1
    const maybe = row as ImportedCostRow
    const amount = costAmount(row)
    if (amount <= 0) continue
    await store.addFinancialEntry({
      id: idLinha('custo', arquivo, input.contractorName, input.bucket, indice),
      entry_type: financialTypeFromBucket(input.bucket),
      description: text(maybe.descricao ?? maybe.material ?? maybe.item ?? input.bucket) || input.bucket,
      amount,
      nucleo: text(maybe.nucleo) || input.nucleo || null,
      competence: text(maybe.mes) || input.period || null,
      status: 'pending_review',
      manual_reason: `Importado da planilha ${input.fileName ?? 'XLSX'} (${input.bucket}).`,
      payload: {
        source_kind: 'spreadsheet',
        source_workbook_name: input.fileName,
        source_sheet: maybe.sourceSheet ?? input.bucket,
        source_row: maybe.sourceRow,
        contractor_name: input.contractorName,
        raw: row,
      },
    })
    count += 1
  }
  return count
}

export async function promoteFornecedorImportToUnified(
  fornecedores: Array<Omit<Fornecedor, 'id'> | Fornecedor>,
  fileName?: string,
): Promise<ImportSummary> {
  const store = useMedicaoUnificadaStore.getState()
  const summary: ImportSummary = { sources: 0, memoryLines: 0, financialEntries: 0 }

  for (const fornecedor of fornecedores) {
    const contractorName = fornecedor.nome || fornecedor.empresa || 'Fornecedor'
    const supplierId = fornecedor.supplierId ?? null
    const workbookName = fileName ?? fornecedor.sourceWorkbookName ?? `${contractorName}.xlsx`
    const defaultNucleo = fornecedor.obraNucleo ?? null
    const warnings = fornecedor.importWarnings ?? []

    let indiceMedicao = -1
    for (const item of fornecedor.medicaoItens ?? []) {
      indiceMedicao += 1
      const quantity = num(item.quantidadeMes ?? item.noMes ?? item.total)
      const unitPrice = num(item.precoUnitario)
      const issues = sourceIssues({
        contractor: contractorName,
        nucleo: item.nucleo ?? defaultNucleo,
        local: item.sourceSheet ?? item.origem ?? workbookName,
        nPreco: item.item,
        quantity,
        unitPrice,
        evidence: item.sourceSheet,
        sourceWarnings: item.pendencias ?? item.blockingIssues ?? warnings,
      })
      await store.addManualSource({
        id: idLinha('medicao', workbookName, contractorName, item.sourceSheet, item.sourceRow, indiceMedicao),
        source_kind: 'spreadsheet',
        source_date: sourceDate(fornecedor.mesReferencia ?? fornecedor.periodo),
        supplier_id: supplierId,
        contract_no: fornecedor.contrato ?? 'SLNR',
        nucleo: item.nucleo ?? defaultNucleo,
        local: item.sourceSheet ?? fornecedor.sourceSheet ?? 'Planilha de fornecedor',
        n_preco: item.item || null,
        source_workbook_name: workbookName,
        source_sheet: item.sourceSheet ?? fornecedor.sourceSheet ?? 'MEDICAO',
        source_row: item.sourceRow ?? null,
        parse_confidence: fornecedor.parseConfidence ?? Math.max(0, 100 - issues.length * 15),
        import_warnings: warnings,
        blocking_issues: issues,
        service_description: item.descricao || fornecedor.descricao || 'Medição de fornecedor',
        service_code: item.item || null,
        unit: item.unidade || null,
        quantity,
        unit_price: unitPrice,
        amount: num(item.valorMes ?? item.valorAcumulado ?? item.total) || quantity * unitPrice,
        origin_label: `Importação XLSX - ${contractorName}`,
        status: issues.length ? 'blocked' : 'pending_review',
        source_payload: { fornecedor, item, sourceWorkbookName: workbookName },
      })
      summary.sources += 1
    }

    let indiceMemoria = -1
    for (const line of fornecedor.memoriaItens ?? []) {
      indiceMemoria += 1
      const quantity = num(line.quantidade)
      const unitPrice = num(line.valorUnitario)
      await store.addMemoryLine({
        id: idLinha('memoria', workbookName, contractorName, line.sourceSheet, indiceMemoria),
        supplier_id: supplierId,
        service_description: line.descricao || fornecedor.descricao || 'Memória de fornecedor',
        n_preco: line.item || null,
        unit: line.unidade ?? null,
        quantity,
        unit_price: unitPrice,
        nucleo: line.nucleo ?? defaultNucleo,
        location_text: line.numero || line.placaModelo || line.sourceSheet || null,
        review_status: 'pending_review',
        notes: `Importado de ${workbookName}${line.sourceSheet ? ` / ${line.sourceSheet}` : ''}.`,
        source_payload: { fornecedor: contractorName, line, sourceWorkbookName: workbookName },
      })
      summary.memoryLines += 1
    }

    const financialRows = [
      ['discount', fornecedor.totalDescontos],
      ['advance', fornecedor.adiantamento],
      ['previous_closing', fornecedor.fechamentoAnterior],
      ['other', fornecedor.relatorio],
      ['invoice', fornecedor.valorTotalMedicaoNf],
    ] as const
    for (const [entryType, value] of financialRows) {
      const amount = num(value)
      if (amount <= 0) continue
      await store.addFinancialEntry({
        id: idLinha('financeiro-fornecedor', workbookName, contractorName, entryType),
        entry_type: entryType,
        supplier_id: supplierId,
        description: `${entryType === 'invoice' ? 'Nota fiscal' : 'Ajuste financeiro'} - ${contractorName}`,
        amount,
        nucleo: defaultNucleo,
        competence: fornecedor.mesReferencia ?? fornecedor.periodo ?? null,
        status: 'pending_review',
        manual_reason: `Importado da planilha ${workbookName}.`,
        payload: { source_kind: 'spreadsheet', sourceWorkbookName: workbookName, fornecedor },
      })
      summary.financialEntries += 1
    }
  }

  return summary
}

export async function promoteSubempreiteiroImportToUnified(
  preview: SubempreiteiroParseResult & { fileName?: string },
): Promise<ImportSummary> {
  const store = useMedicaoUnificadaStore.getState()
  const summary: ImportSummary = { sources: 0, memoryLines: 0, financialEntries: 0 }
  const fileName = preview.fileName ?? `${preview.nome}.xlsx`
  const previewWarnings = preview.warnings ?? []

  let indiceItem = -1
  for (const item of preview.itens) {
    indiceItem += 1
    const quantity = num(item.qtd)
    const unitPrice = num(item.valorUnitario)
    const issues = sourceIssues({
      contractor: preview.nome,
      nucleo: item.nucleo ?? preview.nucleo,
      local: item.sourceKey ?? fileName,
      nPreco: item.nPrecoSabesp || item.nPreco,
      quantity,
      unitPrice,
      evidence: item.sourceKey,
      sourceWarnings: previewWarnings,
    })
    const sourceId = await store.addManualSource({
      id: idLinha('sub-medicao', fileName, preview.nome, item.sourceKey, indiceItem),
      source_kind: 'spreadsheet',
      source_date: sourceDate(item.mes ?? preview.periodo),
      contract_no: 'SLNR',
      nucleo: item.nucleo ?? preview.nucleo,
      local: item.sourceKey ?? 'Planilha de subempreiteiro',
      n_preco: item.nPrecoSabesp || item.nPreco || null,
      source_workbook_name: fileName,
      source_sheet: 'MEDICAO',
      source_row: null,
      parse_confidence: Math.max(0, 100 - issues.length * 15),
      import_warnings: [
        ...previewWarnings,
        ...(issues.length ? [`Rascunho conferível: ${issues.join('; ')}`] : []),
      ],
      blocking_issues: issues,
      service_description: item.descricao || 'Medição de subempreiteiro',
      service_code: item.nPrecoSabesp || item.nPreco || null,
      unit: item.unidade || null,
      quantity,
      unit_price: unitPrice,
      amount: quantity * unitPrice,
      origin_label: `Importação XLSX - ${preview.nome}`,
      status: issues.length ? 'blocked' : 'pending_review',
      source_payload: { subempreiteiro: preview.nome, item, sourceWorkbookName: fileName },
    })
    summary.sources += 1
    await store.addMemoryLine({
      id: idLinha('sub-memoria', fileName, preview.nome, item.sourceKey, indiceItem),
      source_id: sourceId,
      service_description: item.descricao || 'Memória de subempreiteiro',
      n_preco: item.nPrecoSabesp || item.nPreco || null,
      unit: item.unidade || null,
      quantity,
      unit_price: unitPrice,
      nucleo: item.nucleo ?? preview.nucleo,
      location_text: item.sourceKey ?? 'Planilha de subempreiteiro',
      review_status: 'pending_review',
      notes: `Gerada a partir da importação ${fileName}.`,
      source_payload: { subempreiteiro: preview.nome, item, sourceWorkbookName: fileName },
    })
    summary.memoryLines += 1
  }

  let indiceNf = -1
  for (const nf of preview.nfs ?? []) {
    indiceNf += 1
    const amount = num(nf.valorNf || nf.valorPago)
    if (amount <= 0) continue
    await store.addFinancialEntry({
      id: idLinha('sub-nf', fileName, preview.nome, nf.numero, indiceNf),
      entry_type: 'invoice',
      description: `NF ${nf.numero || ''} - ${nf.fornecedor || preview.nome}`.trim(),
      amount,
      nucleo: preview.nucleo,
      competence: nf.competencia || preview.periodo,
      invoice_number: nf.numero || null,
      status: 'pending_review',
      manual_reason: `Importado da planilha ${fileName} / NFS.`,
      payload: { source_kind: 'spreadsheet', nf, sourceWorkbookName: fileName },
    })
    summary.financialEntries += 1
  }

  let indiceDesconto = -1
  for (const desconto of preview.descontos ?? []) {
    indiceDesconto += 1
    if (num(desconto.total) <= 0) continue
    await store.addFinancialEntry({
      id: idLinha('sub-desconto', fileName, preview.nome, desconto.mes, indiceDesconto),
      entry_type: 'discount',
      description: `Descontos gerais - ${preview.nome}`,
      amount: num(desconto.total),
      nucleo: preview.nucleo,
      competence: desconto.mes || preview.periodo,
      status: 'pending_review',
      manual_reason: `Importado da planilha ${fileName} / DESCONTOS.`,
      payload: { source_kind: 'spreadsheet', desconto, sourceWorkbookName: fileName },
    })
    summary.financialEntries += 1
  }

  for (const [bucket, rows] of [
    ['RH', preview.rh],
    ['AGREGADOS', preview.agregados],
    ['MATERIAIS', preview.materiaisFerramentas],
    ['MATERIAIS_EPI', preview.materiaisEpi],
    ['MAQUINAS', preview.maquinas],
    ['SERVICOS', preview.servicos],
    ['VEICULOS', preview.veiculos],
    ['COMBUSTIVEL', preview.combustivel],
    ['ABASTECIMENTO_COMBOIO', preview.abastecimentoComboio],
    ['LOC_EQUIPAMENTOS', preview.locEquipamentos],
    ['EPI', preview.epis],
  ] as const) {
    summary.financialEntries += await promoteCostRows({
      rows,
      bucket,
      contractorName: preview.nome,
      nucleo: preview.nucleo,
      period: preview.periodo,
      fileName,
    })
  }

  return summary
}
