/**
 * Os nomes que a tela oferece na hora de marcar uma rotina.
 *
 * Existe porque digitar o nome inteiro a cada clique transformaria o gesto mais banal do produto
 * numa digitação — e um gesto que custa caro deixa de ser feito. Com os nomes em botões, marcar
 * volta a ser dois cliques.
 */
import type { Rotina, RotinaExecucao } from '@/store/rotinasStore'

/**
 * Nomes conhecidos, do mais recentemente usado para o mais antigo.
 *
 * Une duas fontes: os responsáveis das rotinas ativas (que já existem no cadastro) e quem de fato
 * marcou alguma coisa. Deduplica ignorando caixa e espaço, mas exibe a grafia mais recente — quem
 * digitou "valim" hoje vê "valim", não uma correção silenciosa para "Valim".
 */
export function nomesConhecidos(
  rotinas: Rotina[],
  execucoes: RotinaExecucao[],
  limite = 8,
): string[] {
  const vistos = new Map<string, { nome: string; quando: string }>()

  const registrar = (bruto: string | undefined, quando: string) => {
    const nome = bruto?.trim()
    if (!nome) return
    const chave = nome.toLowerCase()
    const atual = vistos.get(chave)
    // O mais recente vence, e é ele que define a grafia exibida.
    if (!atual || quando > atual.quando) vistos.set(chave, { nome, quando })
  }

  // Execuções primeiro, com a data: são o uso real, e é por ela que a ordem se define.
  for (const e of execucoes) registrar(e.quemFez, e.marcadaEm ?? '')
  // Responsáveis entram sem data: aparecem depois de quem já marcou, mas aparecem.
  for (const r of rotinas) if (r.ativa) registrar(r.responsavel, '')

  return [...vistos.values()]
    .sort((a, b) => (b.quando.localeCompare(a.quando) || a.nome.localeCompare(b.nome, 'pt-BR')))
    .slice(0, limite)
    .map((v) => v.nome)
}
