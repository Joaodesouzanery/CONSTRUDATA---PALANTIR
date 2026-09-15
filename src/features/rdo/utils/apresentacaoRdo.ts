import type { RDO, RdoWcrData } from '@/types'
import { quantidadeGuardada } from './apontamentoWcrDia'

const normalizar = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

/** Total canônico: no WCR/Compizzo a lista nominal e as categorias descrevem as mesmas pessoas. */
export function totalTrabalhadores(rdo: Pick<RDO, 'template' | 'manpower'>): number {
  const nomes = new Set((rdo.manpower.employeeNames ?? []).map(normalizar).filter(Boolean))
  if ((rdo.template === 'wcr' || rdo.template === 'compizzo') && nomes.size > 0) return nomes.size
  return rdo.manpower.foremanCount + rdo.manpower.officialCount
    + rdo.manpower.helperCount + rdo.manpower.operatorCount
}

const SIGLAS_METROS = new Set(['LA', 'LE', 'PRA', 'PRE'])
const SIGLAS_UNIDADES = new Set(['CAIXA UMA', 'HM', 'PV', 'PI', 'CI', 'INTERLIGAÇÃO', 'VALVULA', 'VÁLVULA'])

export function resumoProducaoWcr(wcr?: Pick<RdoWcrData, 'producao'> | null) {
  let metros = 0, unidades = 0, itens = 0
  for (const linha of wcr?.producao ?? []) {
    const quantidade = quantidadeGuardada(linha.quantidade)
    if (quantidade === undefined || quantidade <= 0) continue
    itens++
    const sigla = linha.sigla.trim().toUpperCase()
    if (SIGLAS_METROS.has(sigla)) metros += quantidade
    else if (SIGLAS_UNIDADES.has(sigla)) unidades += quantidade
    else if (linha.unidade === 'M') metros += quantidade
    else unidades += quantidade
  }
  return { itens, metros, unidades }
}

/** Compõe e também saneia títulos históricos sem alterar o payload armazenado. */
export function tituloWcr(partes: Array<string | null | undefined>): string {
  const tokens = partes.flatMap((p) => String(p ?? '').split(/\s*(?:—|·)\s*/)).map((p) => p.trim()).filter(Boolean)
  const saida: string[] = []
  for (const token of tokens) {
    const limpo = token.replace(/^RDO\s+/i, '').trim()
    if (!limpo || normalizar(limpo) === 'wcr') continue
    if (!saida.some((p) => normalizar(p) === normalizar(limpo))) saida.push(limpo)
  }
  return `RDO WCR${saida.length ? ` — ${saida.join(' · ')}` : ''}`
}

export function tituloExibicaoRdo(rdo: Pick<RDO, 'number' | 'title' | 'template'>): string {
  if (rdo.template === 'wcr') return tituloWcr([rdo.title])
  return rdo.title?.trim() || `RDO #${rdo.number}`
}
