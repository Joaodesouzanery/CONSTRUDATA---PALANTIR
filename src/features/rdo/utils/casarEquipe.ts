import { normalizeName } from '@/features/mao-de-obra/utils/custoMaoObra'

export type CasamentoEquipe<T> =
  | { tipo: 'exato'; equipe: T }
  | { tipo: 'provavel'; equipe: T }
  | { tipo: 'ambiguo'; candidatas: T[] }
  | { tipo: 'nenhum' }

function distancia(a: string, b: string): number {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) m[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return m[a.length][b.length]
}

export function casarEquipe<T extends { name: string }>(nome: string, equipes: T[]): CasamentoEquipe<T> {
  const alvo = normalizeName(nome).replace(/^equipe\s+/, '')
  if (!alvo) return { tipo: 'nenhum' }
  const normalizadas = equipes.map((e) => ({ e, n: normalizeName(e.name).replace(/^equipe\s+/, '') }))
  const exatas = normalizadas.filter((x) => x.n === alvo).map((x) => x.e)
  if (exatas.length === 1) return { tipo: 'exato', equipe: exatas[0] }
  if (exatas.length > 1) return { tipo: 'ambiguo', candidatas: exatas }
  const proximas = normalizadas.filter((x) => distancia(alvo, x.n) <= Math.max(1, Math.floor(Math.max(alvo.length, x.n.length) * .25))).map((x) => x.e)
  if (proximas.length === 1) return { tipo: 'provavel', equipe: proximas[0] }
  return proximas.length > 1 ? { tipo: 'ambiguo', candidatas: proximas } : { tipo: 'nenhum' }
}
