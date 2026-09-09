/**
 * casarNome — casa um nome escrito à mão (RDO, planilha de HE) com o cadastro, SEM decidir sozinho
 * o que não dá para decidir.
 *
 * ─── POR QUE NÃO É `matchWorkerByName` ────────────────────────────────────────
 * Aquela é igualdade exata do nome normalizado e devolve o PRIMEIRO homônimo em silêncio. Para
 * "Felipe" num cadastro com "Felipe Sobrenome" ela não casa (falta virava falta falsa); para dois
 * "João Silva" ela pega o primeiro — e na conferência de folha isso puxaria o SALÁRIO da pessoa
 * errada, produzindo um "desvio" com cara de precisão.
 *
 * ─── AS TRÊS SAÍDAS ───────────────────────────────────────────────────────────
 * - `exato`: o nome inteiro bate com UM cadastro. Entra sem pergunta.
 * - `provavel`: não bate inteiro, mas todos os pedaços informados batem com UM cadastro (primeiro
 *   nome igual, o resto por prefixo/inicial). Entra marcado — "casamento provável, confirme".
 * - `ambiguo`: dois ou mais candidatos. A máquina NUNCA escolhe; a tela pergunta.
 * - `nenhum`: nada casou.
 *
 * Função pura: recebe listas, devolve o veredito. Os mesmos critérios servem à presença do RDO e
 * à conferência de HE — e é por isso que ela mora aqui, fora das duas telas.
 */
import { normalizeName } from './custoMaoObra'

export type Casamento<T> =
  | { tipo: 'exato'; worker: T }
  | { tipo: 'provavel'; worker: T }
  | { tipo: 'ambiguo'; candidatos: T[] }
  | { tipo: 'nenhum' }

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

/** Pedaços significativos do nome, sem "de/da/do". */
export function pedacosDoNome(nome: string): string[] {
  return normalizeName(nome).split(' ').filter((p) => p && !PARTICULAS.has(p))
}

/** Cada pedaço informado bate com um pedaço do cadastro: igual, prefixo, ou inicial ("J." → "joao"). */
function pedacoBate(informado: string, doCadastro: string): boolean {
  const i = informado.replace(/\.$/, '')
  if (!i) return false
  if (i === doCadastro) return true
  if (i.length === 1) return doCadastro.startsWith(i)
  return i.length >= 3 && doCadastro.startsWith(i)
}

/** O nome informado "cabe" no cadastro: primeiro pedaço igual, os demais batem em ordem. */
function cabeEm(informado: string[], cadastro: string[]): boolean {
  if (informado.length === 0 || cadastro.length === 0) return false
  if (informado[0] !== cadastro[0]) return false
  let j = 1
  for (let k = 1; k < informado.length; k++) {
    while (j < cadastro.length && !pedacoBate(informado[k], cadastro[j])) j++
    if (j >= cadastro.length) return false
    j++
  }
  return true
}

export function casarNome<T extends { name: string }>(nome: string, workers: T[]): Casamento<T> {
  const alvo = normalizeName(nome)
  if (!alvo) return { tipo: 'nenhum' }

  const exatos = workers.filter((w) => normalizeName(w.name) === alvo)
  if (exatos.length === 1) return { tipo: 'exato', worker: exatos[0] }
  if (exatos.length > 1) return { tipo: 'ambiguo', candidatos: exatos }

  const pedacos = pedacosDoNome(nome)
  const provaveis = workers.filter((w) => cabeEm(pedacos, pedacosDoNome(w.name)))
  if (provaveis.length === 1) return { tipo: 'provavel', worker: provaveis[0] }
  if (provaveis.length > 1) return { tipo: 'ambiguo', candidatos: provaveis }
  return { tipo: 'nenhum' }
}
