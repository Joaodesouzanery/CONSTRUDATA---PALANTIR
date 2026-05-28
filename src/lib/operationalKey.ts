import type { OperationalKey } from './eventBus'

export type OperationalLinkSourceKind =
  | 'rdo'
  | 'rdo_sabesp'
  | 'spreadsheet'
  | 'manual'
  | 'suprimentos'
  | 'quality_return'
  | 'planning'
  | 'lps'

export interface OperationalLink {
  sourceKind: OperationalLinkSourceKind
  sourceId: string
  operationalKey: OperationalKey
  blockingIssues: string[]
  warnings: string[]
}

function normalizePart(value?: string | number | null) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

export function buildOperationalKey(input: OperationalKey): OperationalKey {
  return {
    contractNo: input.contractNo?.trim() || null,
    projectId: input.projectId?.trim() || null,
    nucleo: input.nucleo?.trim() || null,
    local: input.local?.trim() || null,
    serviceCode: input.serviceCode?.trim() || null,
    nPreco: input.nPreco?.trim() || null,
    period: input.period?.trim() || null,
  }
}

export function serializeOperationalKey(input: OperationalKey) {
  const key = buildOperationalKey(input)
  return [
    key.contractNo,
    key.projectId,
    key.nucleo,
    key.local,
    key.nPreco || key.serviceCode,
    key.period,
  ].map(normalizePart).join('|')
}

export function validateOperationalKey(input: OperationalKey) {
  const key = buildOperationalKey(input)
  const blockingIssues: string[] = []
  if (!key.contractNo && !key.projectId) blockingIssues.push('Sem contrato ou projeto vinculado')
  if (!key.nucleo) blockingIssues.push('Sem núcleo')
  if (!key.local) blockingIssues.push('Sem rua/local')
  if (!key.nPreco && !key.serviceCode) blockingIssues.push('Sem serviço ou N. Preço')
  return blockingIssues
}
