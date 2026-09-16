/**
 * cargosPadrao.ts — a tabela de partida do cadastro de Cargos, e a régua que impede duplicata.
 *
 * ─── DE ONDE SAEM ESTES NÚMEROS ───────────────────────────────────────────────
 * Do arquivo real do cliente (aba "HORAS EXTRAS AGOSTO"), tomando o valor mais frequente de cada
 * cargo em sábado e em domingo.
 *
 * ⚠️ **São sugestão, e o próprio arquivo prova que não podem ser regra.** Cruzando linha a linha:
 * "AJUDANTE GERAL I" recebeu R$ 300 no sábado 01/08 e R$ 200 no sábado 08/08; "ENCANADOR DE ESGOTO
 * III" recebeu 350, 250, 300 e 400 em sábados diferentes. E o padrão não é por pessoa — é por DIA:
 * nos dias 01 e 02/08 quase todo mundo recebeu 350/300, e do dia 08 em diante os mesmos cargos
 * caem para 250/200. O valor pago é o da célula daquele dia. Isto aqui só poupa digitação.
 *
 * A mesma regra já está escrita em `controleDeCaixaPlanilha.ts` e avisada na tela do Controle de
 * Caixa — este arquivo não pode contradizê-la.
 *
 * ─── O QUE NÃO É CARGO ────────────────────────────────────────────────────────
 * Três linhas da planilha ocupam a coluna "Cargo" sem serem função:
 *  - `-` → é o MORADOR (Ronaldo), que não é funcionário;
 *  - vazio → a apontadora Raquel, contratada por fora;
 *  - `SEM CONTRATO CLT` → situação contratual do Éverton, não o que ele faz.
 * As duas primeiras são descartadas por `ehCargoDeVerdade`. A terceira fica, porque é como a
 * empresa de fato agrupa o pagamento dele hoje — mas está na lista para ser renomeada, não é
 * atestado de que seja um bom nome de cargo.
 */
import type { Cargo, Worker } from '@/types'

export interface CargoPadrao {
  nome: string
  valorSabado?: number
  valorDomingo?: number
}

/** Valor mais frequente por cargo no arquivo de agosto. Ausente = não apareceu naquele dia. */
export const CARGOS_PADRAO: CargoPadrao[] = [
  { nome: 'AJUDANTE GERAL I',        valorSabado: 300, valorDomingo: 300 },
  { nome: 'AUXILIAR DE CADASTRO II', valorSabado: 150 },
  { nome: 'ENCANADOR',               valorSabado: 350, valorDomingo: 350 },
  { nome: 'ENCANADOR DE ÁGUA I',     valorSabado: 250 },
  { nome: 'ENCANADOR DE ÁGUA III',   valorSabado: 250, valorDomingo: 350 },
  { nome: 'ENCANADOR DE ESGOTO I',   valorSabado: 350, valorDomingo: 350 },
  { nome: 'ENCANADOR DE ESGOTO III', valorSabado: 250, valorDomingo: 350 },
  { nome: 'ENCANADOR IV',            valorSabado: 250, valorDomingo: 350 },
  { nome: 'ENCARREGADO PJ',          valorSabado: 250 },
  { nome: 'OPERADOR DE RETRO',                         valorDomingo: 350 },
  { nome: 'PEDREIRO I',              valorSabado: 250, valorDomingo: 300 },
  { nome: 'SOLDADOR PEAD',           valorSabado: 250, valorDomingo: 350 },
  { nome: 'SEM CONTRATO CLT',        valorSabado: 200, valorDomingo: 300 },
]

/**
 * Chave de comparação de nome de cargo: sem acento, sem caixa, sem espaço dobrado.
 *
 * Existe porque o arquivo real traz o MESMO cargo escrito de dois jeitos — "ENCANADOR DE ÁGUA I" e
 * "ENCANADOR DE AGUA I", "ÁGUA III" e "AGUA III". Sem isto o cadastro nasce com duplicata, e a
 * sugestão de valor passa a depender de quem digitou o acento.
 */
export function chaveDoCargo(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** `-`, vazio e variações de "morador" não são função — não entram no cadastro. */
export function ehCargoDeVerdade(nome: string): boolean {
  const k = chaveDoCargo(nome)
  return k !== '' && k !== '-' && !k.startsWith('morador')
}

/**
 * O que oferecer para cadastrar: os cargos que os funcionários já usam, mais os da tabela de
 * partida, sem os que já existem no cadastro e sem duplicar grafia.
 *
 * O valor vem da tabela quando o nome bate; cargo que só existe no quadro de pessoal entra **sem
 * valor** — e sem valor é diferente de zero: a tela pede o número em vez de preencher R$ 0,00.
 */
export function cargosSugeridos(workers: Pick<Worker, 'role'>[], jaCadastrados: Cargo[]): CargoPadrao[] {
  const existentes = new Set(jaCadastrados.map((c) => chaveDoCargo(c.nome)))
  const daTabela = new Map(CARGOS_PADRAO.map((c) => [chaveDoCargo(c.nome), c]))
  const saida = new Map<string, CargoPadrao>()

  for (const c of CARGOS_PADRAO) {
    const k = chaveDoCargo(c.nome)
    if (!existentes.has(k)) saida.set(k, c)
  }
  for (const w of workers) {
    const nome = (w.role ?? '').trim()
    if (!ehCargoDeVerdade(nome)) continue
    const k = chaveDoCargo(nome)
    if (existentes.has(k) || saida.has(k)) continue
    // Grafia do quadro de pessoal vence a da tabela; o valor, quando houver, vem da tabela.
    saida.set(k, { ...daTabela.get(k), nome })
  }
  return [...saida.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/**
 * A diária sugerida para uma pessoa num dia — a precedência inteira em um lugar só.
 *
 * override do funcionário → valor do cargo → `null`.
 *
 * ⚠️ `null` é "não configurado", e a tela mostra isso em vez de R$ 0,00. Zero é um valor legítimo
 * (alguém pode de fato não receber) e não pode significar "ninguém preencheu".
 */
export function diariaSugerida(
  worker: Pick<Worker, 'role' | 'heSabadoOverride' | 'heDomingoOverride'> | undefined,
  cargos: Cargo[],
  domingoOuFeriado: boolean,
): number | null {
  const override = domingoOuFeriado ? worker?.heDomingoOverride : worker?.heSabadoOverride
  if (typeof override === 'number') return override
  const cargo = cargos.find((c) => chaveDoCargo(c.nome) === chaveDoCargo(worker?.role ?? ''))
  const doCargo = domingoOuFeriado ? cargo?.valorDomingo : cargo?.valorSabado
  return typeof doCargo === 'number' ? doCargo : null
}
