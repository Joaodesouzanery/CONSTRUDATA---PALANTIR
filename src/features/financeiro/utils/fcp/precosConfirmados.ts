/**
 * A confirmação dos preços "a conferir" — que sobrevive à reimportação.
 *
 * ─── POR QUE NÃO É UM CAMPO NO PREÇO ──────────────────────────────────────────
 * `planoParaGravar` sobrescreve `precos` inteiro a cada reimportação, de propósito: a planilha
 * manda nos preços. Um `confirmadoEm` dentro do preço morreria todo mês, sem aviso. A confirmação
 * mora num mapa À PARTE no plano, e é preservada na reimportação.
 *
 * ─── POR QUE A CHAVE É COMPOSTA, E TEM "OCORRÊNCIA" ───────────────────────────
 * Medido no arquivo do cliente: `numeroPreco` NÃO é único — colide 25 vezes (5 em Bertioga, 20
 * em Santos). Em Bertioga as 5 são linhas 100% idênticas, indistinguíveis por qualquer conteúdo;
 * só a ordem de aparição as separa. Em Santos, 2 têm VALOR DIFERENTE para o mesmo número — é o
 * caso que a OBS descreve ("item repetido no impresso com preço diferente — conferir").
 *
 * ─── POR QUE A CONFIRMAÇÃO GUARDA O VALOR ─────────────────────────────────────
 * Se a reimportação trouxer outro valor para a mesma chave, a confirmação CADUCA sozinha e o item
 * volta a "conferir". Confirmar R$ 247,93 não confirma R$ 274,93.
 */
import { normalizarTexto } from '../controleDeCaixaPlanilha'
import type { PrecoDoContrato } from './importarFcp'

export interface ConfirmacaoDePreco {
  confirmadoEm: string
  confirmadoPor: string
  /** O valor que a pessoa viu quando confirmou. Valor diferente = confirmação caduca. */
  valorConfirmado: number
}

export type PrecosConfirmados = Record<string, ConfirmacaoDePreco>

/** `cidade|numeroPreco|item|descricao|unidade|ocorrência`. Determinística para a mesma lista. */
export function chavesDosPrecos(cidade: string, lista: PrecoDoContrato[]): string[] {
  const vistos = new Map<string, number>()
  return lista.map((p) => {
    const base = [cidade, p.numeroPreco ?? '', p.item ?? '', p.descricao, p.unidade ?? '']
      .map((x) => normalizarTexto(String(x))).join('|')
    const n = vistos.get(base) ?? 0
    vistos.set(base, n + 1)
    return `${base}#${n}`
  })
}

export function chaveDoPreco(cidade: string, lista: PrecoDoContrato[], indice: number): string {
  return chavesDosPrecos(cidade, lista)[indice]
}

/** Confirmada, e ainda válida para ESTE valor. */
export function estaConfirmado(mapa: PrecosConfirmados | undefined, chave: string, valorAtual: number): ConfirmacaoDePreco | null {
  const c = mapa?.[chave]
  if (!c) return null
  return Math.abs(c.valorConfirmado - valorAtual) < 0.005 ? c : null
}

/**
 * Na reimportação: mantém só as confirmações cuja chave ainda existe E cujo valor não mudou.
 * O que caducou é descartado — e devolvido em `caducadas`, para a tela dizer quantas.
 */
export function reconciliarConfirmacoes(
  anteriores: PrecosConfirmados | undefined,
  precos: Record<string, PrecoDoContrato[]>,
): { mantidas: PrecosConfirmados; caducadas: number } {
  if (!anteriores) return { mantidas: {}, caducadas: 0 }
  const valorPorChave = new Map<string, number>()
  for (const [cidade, lista] of Object.entries(precos)) {
    chavesDosPrecos(cidade, lista).forEach((k, i) => valorPorChave.set(k, lista[i].valorUnitario))
  }
  const mantidas: PrecosConfirmados = {}
  let caducadas = 0
  for (const [k, c] of Object.entries(anteriores)) {
    const v = valorPorChave.get(k)
    if (v !== undefined && Math.abs(v - c.valorConfirmado) < 0.005) mantidas[k] = c
    else caducadas++
  }
  return { mantidas, caducadas }
}
