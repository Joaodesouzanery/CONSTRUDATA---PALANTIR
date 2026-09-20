/**
 * O id de uma fase padrão, derivado do NOME.
 *
 * ⚠️ Determinístico de propósito. As oito fases padrão são oferecidas a qualquer obra que ainda não
 * tenha catálogo próprio, e o RDO grava `faseId` na linha de produção. Com id aleatório, cada
 * abertura da tela geraria ids novos: o apontamento de ontem não casaria com o de hoje, a meta da
 * Torre veria zero para sempre e **nada na tela indicaria erro**. É o mesmo raciocínio do
 * `seededId` usado no resto do projeto.
 *
 * No dia em que a obra cadastra as fases dela, os ids passam a ser os do cadastro — e o histórico
 * anterior continua apontando para os derivados, que é o correto: ele foi apontado contra aquelas.
 */

/**
 * Marcas diacríticas combinantes (U+0300–U+036F), escapadas.
 *
 * ⚠️ Escritas por extenso e não como caracteres literais: acento combinante dentro de uma classe
 * de regex é invisível no editor, some em copiar-e-colar e o `no-irregular-whitespace` do eslint
 * nem sempre pega. Um id que muda de forma silenciosa desliga a meta sem nenhum erro na tela.
 */
const ACENTOS = /[\u0300-\u036f]/g

export function idDaFasePadrao(nome: string): string {
  const slug = nome
    .normalize('NFD')
    .replace(ACENTOS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `fase-padrao:${slug}`
}
