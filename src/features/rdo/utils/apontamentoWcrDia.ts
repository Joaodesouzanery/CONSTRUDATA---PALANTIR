/**
 * O DIA do RDO WCR: vários apontamentos, uma lista de presença por equipe, e a soma.
 *
 * ─── COMO AS MENSAGENS CHEGAM ─────────────────────────────────────────────────
 * Numa mesma noite chegam encaminhadas: "APONTAMENTO DIÁRIO" da equipe Juan, outro da equipe
 * Gilvan (mesmo dia, núcleos e imóveis diferentes), e quatro "LISTA DE PRESENÇA 31/08", uma por
 * equipe. O RDO é do DIA; cada apontamento é de uma equipe. Guardar só a soma perderia quem fez o
 * quê; guardar só as partes obrigaria todo leitor a somar de novo. Aqui se guarda os dois.
 *
 * ─── A REGRA DA SOMA ──────────────────────────────────────────────────────────
 * ⚠️ "Não informado" continua não informado. Se nenhum apontamento pôs número numa sigla, a soma
 * fica vazia — não vira zero. Se um pôs 100 e o outro deixou em branco, a soma é 100.
 */
import type { RdoManpower, RdoWcrApontamento, RdoWcrPresenca, RdoWcrProducaoRow, RdoWeatherCondition, Worker } from '@/types'
import { SIGLAS_WCR, completarAno, type ApontamentoWcr } from './apontamentoWcr'
import { casarNome, type Casamento } from '@/features/mao-de-obra/utils/casarNome'
import { entraNaFolha } from '@/lib/funcionarioAtivo'

// ─── Somar apontamentos ───────────────────────────────────────────────────────

export function apontamentoParaRdo(a: ApontamentoWcr, textoOriginal?: string): RdoWcrApontamento {
  return {
    equipe: a.equipe,
    nucleo: a.nucleo,
    imoveis: a.imoveis,
    producao: a.linhas.map((l) => ({
      sigla: l.sigla,
      // ⚠️ String vazia, NÃO '0'. Ver o docblock de RdoWcrProducaoRow.
      quantidade: l.quantidade === undefined ? '' : String(l.quantidade),
      unidade: l.unidade,
    })),
    observacoes: a.observacoes,
    anoInferido: a.anoInferido,
    textoOriginal,
    naoEntendidas: a.naoEntendidas.length ? a.naoEntendidas : undefined,
    clima: a.clima,
    horas: a.horas,
  }
}

/** chuva > tempestade > nublado > sol: o dia é tão ruim quanto o pior apontamento. */
const PESO_CLIMA: Record<RdoWeatherCondition, number> = { good: 0, cloudy: 1, rain: 2, storm: 3 }
export function piorClima(climas: Array<RdoWeatherCondition | undefined>): RdoWeatherCondition | undefined {
  let pior: RdoWeatherCondition | undefined
  for (const c of climas) if (c && (pior === undefined || PESO_CLIMA[c] > PESO_CLIMA[pior])) pior = c
  return pior
}

/**
 * A quantidade guardada no RDO é `String(número)` — ponto decimal, sem milhar. Ler com regra
 * pt-BR ("tira o ponto, troca a vírgula") transformava 12,5 m em 125 m. `Number()` primeiro; a
 * regra pt-BR fica só para texto que não é número JS (RDO antigo, digitado à mão).
 */
export function quantidadeGuardada(bruto: string): number | undefined {
  const t = String(bruto ?? '').trim()
  if (t === '') return undefined
  const direto = Number(t)
  if (Number.isFinite(direto)) return direto
  const ptBr = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(ptBr) ? ptBr : undefined
}
const numero = quantidadeGuardada

/** A produção somada, sigla a sigla. Vazio só vira número quando ALGUÉM informou. */
export function somarProducao(apontamentos: RdoWcrApontamento[]): RdoWcrProducaoRow[] {
  return SIGLAS_WCR.map((s) => {
    let soma: number | undefined
    for (const a of apontamentos) {
      const linha = a.producao.find((l) => l.sigla === s.sigla)
      const n = linha ? numero(linha.quantidade) : undefined
      if (n !== undefined) soma = (soma ?? 0) + n
    }
    return { sigla: s.sigla, quantidade: soma === undefined ? '' : String(soma), unidade: s.unidade }
  })
}

const unicos = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x && x.trim() !== ''))]

/** O que vai nos campos de cima do `RdoWcrData` quando há vários apontamentos. */
export function resumoDoDia(apontamentos: RdoWcrApontamento[]): Pick<RdoWcrData_, 'equipe' | 'nucleo' | 'imoveis' | 'producao' | 'observacoes' | 'anoInferido' | 'naoEntendidas' | 'clima' | 'horas'> {
  const equipes = unicos(apontamentos.map((a) => a.equipe))
  const nucleos = unicos(apontamentos.map((a) => a.nucleo))
  const obs = unicos(apontamentos.map((a) => a.observacoes))
  const naoEntendidas = apontamentos.flatMap((a) => a.naoEntendidas ?? [])
  return {
    equipe: equipes.length ? equipes.join(' · ') : undefined,
    nucleo: nucleos.length ? nucleos.join(' · ') : undefined,
    imoveis: unicos(apontamentos.flatMap((a) => a.imoveis)),
    producao: somarProducao(apontamentos),
    observacoes: obs.length ? obs.join('\n') : undefined,
    anoInferido: apontamentos.some((a) => a.anoInferido),
    naoEntendidas: naoEntendidas.length ? naoEntendidas : undefined,
    clima: piorClima(apontamentos.map((a) => a.clima)),
    // ⚠️ Só soma o que foi informado. Nenhum apontamento com horas → ausente, não zero.
    horas: apontamentos.some((a) => a.horas !== undefined)
      ? apontamentos.reduce((s, a) => s + (a.horas ?? 0), 0)
      : undefined,
  }
}
type RdoWcrData_ = import('@/types').RdoWcrData

// ─── Lista de presença ────────────────────────────────────────────────────────

export interface PresencaLida {
  data?: string
  dataBruta?: string
  anoInferido: boolean
  equipe?: string
  pessoas: Array<{ nome: string; funcao?: string }>
  naoEntendidas: string[]
}

/** É uma lista de presença, e não um apontamento? Decide para onde o texto colado vai. */
export function ehListaDePresenca(texto: string): boolean {
  return /LISTA\s+DE\s+PRESEN[ÇC]A/i.test(texto)
}

/**
 * "LISTA DE PRESENÇA 31/08" · "Equipe Mazinho" / "EQUIPE- GILVAN" / "EQUIPE - Juan" · "Nome - função".
 *
 * Tolerante ao que o WhatsApp faz com o texto: "Mazinho -líder", "Renan- líder", "Cristiano -
 * ajudantan" (digitação), "Michael -lider" (sem acento). O que não parece "nome - função" vai para
 * `naoEntendidas` — nunca é descartado em silêncio.
 */
export function parseListaDePresenca(texto: string, opcoes: { hoje?: string } = {}): PresencaLida {
  const hoje = opcoes.hoje ?? new Date().toISOString().slice(0, 10)
  const saida: PresencaLida = { anoInferido: false, pessoas: [], naoEntendidas: [] }
  for (const bruta of texto.split(/\r?\n/)) {
    // Zero-width space / word-joiner: o WhatsApp injeta, e um "nome" que começa com eles não casa.
    const linha = bruta.replace(/[\u200b\u2060]/g, '').trim()
    if (!linha) continue
    const cab = /LISTA\s+DE\s+PRESEN[ÇC]A\s*[-–—:]?\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)?/i.exec(linha)
    if (cab) {
      if (cab[1]) {
        saida.dataBruta = cab[1]
        const { data, inferido } = completarAno(cab[1], hoje)
        saida.data = data
        saida.anoInferido = inferido
      }
      continue
    }
    const eq = /^EQUIPE\s*[-–—:]?\s*(.+)$/i.exec(linha)
    if (eq) { saida.equipe = eq[1].trim(); continue }
    // "Nome - função" — com o hífen colado de qualquer lado
    const pessoa = /^(.+?)\s*[-–—]\s*(.+)$/.exec(linha)
    if (pessoa && pessoa[1].trim() && pessoa[2].trim()) {
      saida.pessoas.push({ nome: pessoa[1].trim(), funcao: pessoa[2].trim() })
      continue
    }
    saida.naoEntendidas.push(linha)
  }
  return saida
}

export function presencaParaRdo(p: PresencaLida, textoOriginal?: string): RdoWcrPresenca {
  return { equipe: p.equipe, pessoas: p.pessoas, textoOriginal }
}

// ─── Presença → manpower ──────────────────────────────────────────────────────

export type FuncaoCanonica = 'encarregado' | 'oficial' | 'ajudante' | 'operador'

/**
 * A função escrita à mão vira uma das quatro que o RDO conta.
 *
 * Líder e encarregado contam como encarregado; ajudante (e "ajudantan") como ajudante; operador
 * como operador; o resto — encanador, pedreiro, soldador, eletricista — é oficial. Sem função
 * escrita: oficial, porque é a contagem que menos mente para folha.
 */
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()

export function funcaoCanonica(funcao?: string): FuncaoCanonica {
  const f = semAcento(funcao ?? '')
  if (/LIDER|ENCARREG/.test(f)) return 'encarregado'
  if (/AJUDANT|AUXILIAR|SERVENT/.test(f)) return 'ajudante'
  if (/OPERADOR|MOTORISTA/.test(f)) return 'operador'
  return 'oficial'
}

export function manpowerDaPresenca(presencas: RdoWcrPresenca[]): RdoManpower {
  const m: RdoManpower = { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0, employeeNames: [] }
  const nomes = new Set<string>()
  for (const p of presencas) {
    for (const pessoa of p.pessoas) {
      const chave = semAcento(pessoa.nome).replace(/\s+/g, ' ').trim()
      if (nomes.has(chave)) continue   // a mesma pessoa em duas listas conta uma vez
      nomes.add(chave)
      m.employeeNames!.push(pessoa.nome)
      const f = funcaoCanonica(pessoa.funcao)
      if (f === 'encarregado') m.foremanCount++
      else if (f === 'ajudante') m.helperCount++
      else if (f === 'operador') m.operatorCount++
      else m.officialCount++
    }
  }
  return m
}

// ─── Presença colada × cadastro ───────────────────────────────────────────────

export interface PresencaCasada<T extends { id: string; name: string } = Worker> {
  nome: string
  funcao?: string
  veredito: Casamento<T>
}

/**
 * Cada nome colado, contra os funcionários ATIVOS da obra.
 *
 * ⚠️ Quem decide é `casarNome` (exato / provável / ambíguo). A tela pré-marca exato e provável
 * (o provável com a pergunta "Felipe → Felipe Sobrenome?"); ambíguo NUNCA é marcado pela máquina —
 * dois candidatos aparecem lado a lado para a pessoa escolher. É esta função que impede a "falta
 * automática cega" que uma igualdade exata produziria.
 */
export function casarPresenca<T extends { id: string; name: string; status: Worker['status'] }>(
  pessoas: Array<{ nome: string; funcao?: string }>,
  workers: T[],
): PresencaCasada<T>[] {
  const ativos = workers.filter(entraNaFolha)
  return pessoas.map((p) => ({ nome: p.nome, funcao: p.funcao, veredito: casarNome(p.nome, ativos) }))
}

/** Os ids que a máquina tem confiança para pré-marcar: exato e provável. Ambíguo fica de fora. */
export function idsPreMarcados<T extends { id: string; name: string }>(casadas: PresencaCasada<T>[]): Set<string> {
  const ids = new Set<string>()
  for (const c of casadas) if (c.veredito.tipo === 'exato' || c.veredito.tipo === 'provavel') ids.add(c.veredito.worker.id)
  return ids
}
