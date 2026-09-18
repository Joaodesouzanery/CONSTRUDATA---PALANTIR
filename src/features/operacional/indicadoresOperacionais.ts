/**
 * indicadoresOperacionais.ts — os números do contrato, saídos da planilha importada.
 *
 * ─── DUAS REGRAS QUE ESTE ARQUIVO SEGUE ───────────────────────────────────────
 *
 * 1. **Separado por contrato, sempre.** A planilha do cliente atende Bertioga/Guarujá e Santos no
 *    mesmo arquivo, e quase todo número só faz sentido por contrato: R$ 230.982,81/mês de custo em
 *    Bertioga e R$ 273.163,84 em Santos somam um total que não é a realidade de nenhuma das duas
 *    operações. O consolidado existe, mas nunca sozinho.
 *
 * 2. **Coluna ausente devolve `null`, nunca 0.** Os indicadores casam o título da coluna por nome.
 *    Se a próxima revisão da planilha renomear "VALOR MEDIDO", um indicador que devolvesse 0
 *    diria "não faturamos nada" — uma afirmação forte, e falsa. `null` faz a tela escrever
 *    "coluna não encontrada", que é o que de fato aconteceu.
 */
import { parseLocaleNumber } from '@/lib/numberFormat'
import type { LinhaOperacional, SabespSheetId } from './sabespStore'

// ─── Leitura tolerante ────────────────────────────────────────────────────────

const norm = (s: string) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

/** O valor da coluna, casando o título sem depender de acento, caixa ou espaço duplicado. */
export function campo(valores: Record<string, string>, ...titulos: string[]): string | undefined {
  const alvos = titulos.map(norm)
  for (const [k, v] of Object.entries(valores)) if (alvos.includes(norm(k))) return (v ?? '').trim()
  return undefined
}

/** Alguma linha deste conjunto tem esta coluna? É o que separa "vazio" de "não existe". */
export function colunaExiste(linhas: readonly LinhaOperacional[], ...titulos: string[]): boolean {
  const alvos = titulos.map(norm)
  return linhas.some((l) => Object.keys(l.valores).some((k) => alvos.includes(norm(k))))
}

/**
 * O número de uma célula — `null` quando não há número ali.
 *
 * ⚠️ NÃO reimplementa a conversão: delega a `parseLocaleNumber`, que o projeto inteiro usa. Isso
 * importa porque o formato **não é o brasileiro**. Medido no arquivo do cliente, lido como o
 * importador lê (`raw:false`): o custo mensal de Bertioga chega como `"R$ 230,982.81"` — vírgula
 * de milhar, ponto decimal. Um parser pt-BR leria R$ 230,98: **mil vezes menor**, e sem erro
 * nenhum na tela. `parseLocaleNumber` decide pelo separador que aparece por ÚLTIMO, e acerta os
 * dois formatos.
 *
 * O que esta função acrescenta é só a diferença entre **0 e "não sei"**: `parseLocaleNumber`
 * devolve 0 para texto inválido, e somar isso esconderia uma célula suja dentro de um total.
 */
export function numeroBR(v: string | undefined): number | null {
  if (v == null) return null
  const limpo = String(v).replace(/[R$\s%]/g, '').trim()
  if (!limpo || limpo === '-' || limpo === '—') return null
  // Sobrou algo que não é número? Então não é número — e 0 seria mentira.
  if (!/[0-9]/.test(limpo)) return null
  return parseLocaleNumber(v)
}

function somar(linhas: readonly LinhaOperacional[], ...titulos: string[]): number | null {
  if (!colunaExiste(linhas, ...titulos)) return null
  let total = 0
  for (const l of linhas) {
    const n = numeroBR(campo(l.valores, ...titulos))
    if (n !== null) total += n
  }
  return total
}

function contar(linhas: readonly LinhaOperacional[], titulos: string[], casa: RegExp): number | null {
  if (!colunaExiste(linhas, ...titulos)) return null
  return linhas.filter((l) => casa.test(campo(l.valores, ...titulos) ?? '')).length
}

// ─── O recorte ────────────────────────────────────────────────────────────────

/** Os contratos que EXISTEM no dado — nunca uma lista fixa no código. */
export function contratosDoDado(linhas: readonly LinhaOperacional[]): string[] {
  const set = new Set<string>()
  for (const l of linhas) {
    const c = campo(l.valores, 'CONTRATO')
    if (c) set.add(c.trim())
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/**
 * O filtro por contrato casa por PREFIXO normalizado.
 *
 * ⚠️ Igualdade exata não serve: o cliente escreve "BERTIOGA" numa aba e "BERTIOGA/GUARUJÁ" em
 * outra, e o nome do arquivo cita as três cidades. Comparar `===` deixava metade do dado de fora
 * de um filtro que o usuário achava que estava pegando tudo.
 */
export function ehDoContrato(valor: string | undefined, contrato: string): boolean {
  if (!contrato) return true
  const a = norm(valor ?? '')
  const b = norm(contrato)
  return a === b || a.startsWith(b) || b.startsWith(a)
}

export interface Recorte {
  contrato?: string
  equipe?: string
  status?: string
}

export function aplicarRecorte(linhas: readonly LinhaOperacional[], r: Recorte): LinhaOperacional[] {
  return linhas.filter((l) => {
    if (!l.ativa) return false
    if (r.contrato && !ehDoContrato(campo(l.valores, 'CONTRATO'), r.contrato)) return false
    if (r.equipe && norm(campo(l.valores, 'EQUIPE', 'EQUIPE DESIGNADA') ?? '') !== norm(r.equipe)) return false
    if (r.status && norm(campo(l.valores, 'STATUS', 'STATUS DA OS', 'STATUS DA MEDIÇÃO') ?? '') !== norm(r.status)) return false
    return true
  })
}

// ─── Os indicadores ───────────────────────────────────────────────────────────

/** `null` = a coluna que alimenta este número não veio na planilha. */
export interface Indicadores {
  contrato: string
  servicos: number | null
  emAberto: number | null
  concluidos: number | null
  atrasados: number | null
  /** Concluídos ÷ total, em %. */
  aderencia: number | null
  ocorrenciasAbertas: number | null
  ocorrenciasGraves: number | null
  valorMedido: number | null
  valorGlosado: number | null
  valorAprovado: number | null
  valorRecebido: number | null
  custoDoMes: number | null
  resultado: number | null
  /** Resultado ÷ medição aprovada, em %. Calculada aqui, não lida da planilha. */
  margem: number | null
}

const ABERTO = /ABERT|PENDENT|EM ANDAMENTO|PROGRAMAD|AGUARDAND/i
const CONCLUIDO = /CONCLU|EXECUTAD|FINALIZAD/i
const ATRASADO = /ATRASAD|VENCID|FORA DO PRAZO/i
const GRAVE = /GRAVE|ALTA|CRITIC|CRÍTIC/i

export function calcularIndicadores(
  porAba: Partial<Record<SabespSheetId, LinhaOperacional[]>>,
  contrato = '',
): Indicadores {
  const r: Recorte = { contrato }
  const servicos = aplicarRecorte(porAba.cadastro_servicos ?? [], r)
  const ocorrencias = aplicarRecorte(porAba.ocorrencias ?? [], r)
  const medicao = aplicarRecorte(porAba.medicao ?? [], r)
  const faturamento = aplicarRecorte(porAba.faturamento ?? [], r)

  const total = servicos.length || null
  const concluidos = contar(servicos, ['STATUS'], CONCLUIDO)
  const aprovado = somar(medicao, 'VALOR APROVADO')
  const custo = somar(faturamento, 'CUSTO DO MÊS', 'CUSTO DO MES')
  const resultado = somar(faturamento, 'RESULTADO')

  return {
    contrato: contrato || 'Todos os contratos',
    servicos: total,
    emAberto: contar(servicos, ['STATUS'], ABERTO),
    concluidos,
    // ⚠️ "Atrasado" sai de SITUAÇÃO DO PRAZO, a coluna que a planilha calcula — não de comparar
    // datas aqui. Duas contas de atraso divergiriam na primeira mudança de regra da planilha.
    atrasados: contar(servicos, ['SITUAÇÃO DO PRAZO', 'SITUACAO DO PRAZO'], ATRASADO),
    aderencia: total && concluidos !== null ? (concluidos / total) * 100 : null,
    ocorrenciasAbertas: contar(ocorrencias, ['STATUS'], ABERTO),
    ocorrenciasGraves: contar(ocorrencias, ['GRAVIDADE'], GRAVE),
    valorMedido: somar(medicao, 'VALOR'),
    valorGlosado: somar(medicao, 'VALOR GLOSADO'),
    valorAprovado: aprovado,
    valorRecebido: somar(faturamento, 'VALOR RECEBIDO'),
    custoDoMes: custo,
    resultado,
    // Calculada, não lida: a planilha tem uma coluna MARGEM por mês, e somá-la daria a soma de
    // percentuais, que não significa nada. Margem do período é resultado ÷ medição aprovada.
    margem: resultado !== null && aprovado ? (resultado / aprovado) * 100 : null,
  }
}

/** Um indicador por contrato existente, mais o consolidado no fim. */
export function indicadoresPorContrato(
  porAba: Partial<Record<SabespSheetId, LinhaOperacional[]>>,
): Indicadores[] {
  const todas = Object.values(porAba).flat().filter(Boolean) as LinhaOperacional[]
  const contratos = contratosDoDado(todas.filter((l) => l.ativa))
  return [...contratos.map((c) => calcularIndicadores(porAba, c)), calcularIndicadores(porAba)]
}

/** Quantos serviços cada equipe entregou — a base do gráfico de produção. */
export function producaoPorEquipe(
  servicos: readonly LinhaOperacional[],
  recorte: Recorte = {},
): Array<{ equipe: string; concluidos: number; total: number }> {
  const m = new Map<string, { equipe: string; concluidos: number; total: number }>()
  for (const l of aplicarRecorte(servicos, recorte)) {
    const equipe = campo(l.valores, 'EQUIPE DESIGNADA', 'EQUIPE') || '(sem equipe)'
    const chave = norm(equipe)
    const atual = m.get(chave) ?? { equipe, concluidos: 0, total: 0 }
    atual.total++
    if (CONCLUIDO.test(campo(l.valores, 'STATUS') ?? '')) atual.concluidos++
    m.set(chave, atual)
  }
  return [...m.values()].sort((a, b) => b.total - a.total)
}

/** Quantos serviços em cada status — a base do gráfico de situação. */
export function servicosPorStatus(
  servicos: readonly LinhaOperacional[],
  recorte: Recorte = {},
): Array<{ status: string; n: number }> {
  const m = new Map<string, { status: string; n: number }>()
  for (const l of aplicarRecorte(servicos, recorte)) {
    const status = campo(l.valores, 'STATUS') || '(sem status)'
    const chave = norm(status)
    const atual = m.get(chave) ?? { status, n: 0 }
    atual.n++
    m.set(chave, atual)
  }
  return [...m.values()].sort((a, b) => b.n - a.n)
}
