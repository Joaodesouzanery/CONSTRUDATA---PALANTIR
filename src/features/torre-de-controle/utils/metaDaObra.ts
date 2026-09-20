/**
 * A meta de produção da obra — previsto × realizado por fase, e o dinheiro que sai disso.
 *
 * ─── A METADE QUE FALTAVA ─────────────────────────────────────────────────────
 * `obraMedicao.ts` já dizia, por escrito: *"o contrato guarda quantidade e preço, **não
 * distribuição no tempo**. Preencher aquela metade exigiria um cadastro de cronograma por serviço
 * que ninguém pediu ainda."* Este arquivo é aquela metade. O par dele — o REALIZADO mensal — já
 * existia em `medidoPorServicoPorMes`; aqui o recorte é por FASE e por período livre.
 *
 * Puro: sem store, sem React, sem `new Date()` implícito.
 *
 * ⚠️ **O total nunca é um número só.** `somarMetragem` devolve parcelas por tipo de unidade, e é
 * isso que atravessa este arquivo inteiro. Piso é m², demarcação é metro linear, sinalização é
 * unidade: `1.000 + 340 + 12` daria 1.352, que não é área, nem comprimento, nem contagem.
 */
import { classificarUnidade, somarMetragem, type Metragem } from '@/lib/unidadesMedida'
import { parseLocaleNumber } from '@/lib/numberFormat'
import type { ConstructionSite, FaseDaObra, MetaDoPeriodo, RDO } from '@/types'

// ─── Realizado ────────────────────────────────────────────────────────────────

/**
 * Quanto cada fase andou no período, a partir dos RDO.
 *
 * ⚠️ **Rascunho não conta** — mesma regra de `medidoPorServicoPorMes` e de `rdosDoPlano`. Um RDO
 * em rascunho é um documento que ainda pode mudar; deixá-lo somar faria a meta oscilar enquanto
 * alguém digita.
 */
export function realizadoPorFaseNoPeriodo(
  rdos: readonly RDO[],
  siteId: string,
  de: string,
  ate: string,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const rdo of rdos) {
    if (rdo.siteId !== siteId) continue
    if (rdo.status === 'rascunho') continue
    if (rdo.date < de || rdo.date > ate) continue
    for (const linha of rdo.compizzo?.producao ?? []) {
      if (!linha.faseId) continue
      const qtd = parseLocaleNumber(linha.quantidade)
      if (!Number.isFinite(qtd) || qtd === 0) continue
      out[linha.faseId] = (out[linha.faseId] ?? 0) + qtd
    }
  }
  return out
}

// ─── Previsto × realizado, por fase ───────────────────────────────────────────

export interface LinhaDaMeta {
  fase: FaseDaObra
  previsto: number
  realizado: number
  /** `realizado ÷ previsto`, em %. `null` quando não há meta — dividir por zero não é 0%. */
  pct: number | null
  /** Falta para bater a meta. Negativo = passou. */
  falta: number
  /** Receita da fase no período, ou `null` quando o modo de preço não sabe precificá-la. */
  receita: number | null
  motivoSemReceita?: MotivoSemReceita
}

export type MotivoSemReceita =
  /** Modo `peso` numa fase que não é de área — R$/m² não multiplica metro linear. */
  | 'peso-em-unidade-nao-area'
  /** Modo `peso` e a obra não tem `precoM2`. */
  | 'obra-sem-preco-m2'
  /** Modo `peso` e a fase não tem peso. */
  | 'fase-sem-peso'
  /** Modo `preco-proprio` e a fase não tem preço. */
  | 'fase-sem-preco'

export const TEXTO_SEM_RECEITA: Record<MotivoSemReceita, string> = {
  'peso-em-unidade-nao-area': 'Fase medida em metro linear ou unidade — o R$/m² da obra não se aplica; dê um preço próprio a ela',
  'obra-sem-preco-m2':        'A obra não tem preço por m² cadastrado',
  'fase-sem-peso':            'A fase não tem peso definido',
  'fase-sem-preco':           'A fase não tem preço próprio definido',
}

/**
 * A receita de uma fase, pelo modo de preço escolhido na obra.
 *
 * ⚠️ Devolve `null` — com o motivo — em vez de zero quando não dá para calcular. Zero pareceria
 * "esta fase não vale nada"; `null` diz "o sistema não sabe precificar esta fase ainda", que é
 * a verdade e é acionável.
 */
export function receitaDaFase(
  fase: FaseDaObra,
  quantidade: number,
  modo: ConstructionSite['modoPrecoFases'],
  precoM2DaObra: number | undefined,
): { valor: number | null; motivo?: MotivoSemReceita } {
  if (modo === 'preco-proprio') {
    if (fase.precoUnitario == null) return { valor: null, motivo: 'fase-sem-preco' }
    return { valor: quantidade * fase.precoUnitario }
  }

  // Modo `peso` (o padrão).
  // ⚠️ R$/m² só multiplica metragem de ÁREA. Demarcação custa por metro linear (R$ 8,75/m no
  // contrato real do cliente); aplicar o preço do piso ali produziria um número sem relação
  // nenhuma com o que se cobra.
  if (classificarUnidade(fase.unidade) !== 'area') {
    return { valor: null, motivo: 'peso-em-unidade-nao-area' }
  }
  if (precoM2DaObra == null) return { valor: null, motivo: 'obra-sem-preco-m2' }
  if (fase.pesoPct == null) return { valor: null, motivo: 'fase-sem-peso' }
  return { valor: quantidade * precoM2DaObra * (fase.pesoPct / 100) }
}

export interface ResumoDaMeta {
  linhas: LinhaDaMeta[]
  /** Previsto e realizado em PARCELAS por unidade — nunca um total somado. */
  previsto: Metragem
  realizado: Metragem
  /** Soma das receitas que foi possível calcular. */
  receita: number
  /** Quantas fases ficaram sem receita — o número que impede o total de parecer completo. */
  fasesSemReceita: number
  /** Dias corridos do período, para o ritmo diário. */
  dias: number
}

/** Dias corridos, inclusivos. */
export function diasDoPeriodo(de: string, ate: string): number {
  const a = new Date(de + 'T00:00:00').getTime()
  const b = new Date(ate + 'T00:00:00').getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  return Math.round((b - a) / 86_400_000) + 1
}

/**
 * O retrato da meta no período.
 *
 * ⚠️ Só as fases ATIVAS entram. Fase desativada que ainda tem meta antiga fica de fora do resumo,
 * mas o dado não é apagado — desativar é parar de oferecer, não reescrever o histórico.
 */
export function resumoDaMeta(
  fases: readonly FaseDaObra[],
  meta: MetaDoPeriodo,
  realizado: Record<string, number>,
  modo: ConstructionSite['modoPrecoFases'],
  precoM2DaObra: number | undefined,
): ResumoDaMeta {
  const ativas = [...fases].filter((f) => f.ativa).sort((a, b) => a.ordem - b.ordem)

  const linhas: LinhaDaMeta[] = ativas.map((fase) => {
    const previsto = meta.porFase[fase.id] ?? 0
    const feito = realizado[fase.id] ?? 0
    const r = receitaDaFase(fase, feito, modo, precoM2DaObra)
    return {
      fase,
      previsto,
      realizado: feito,
      // ⚠️ Sem meta cadastrada o percentual é `null`, não 0%. "0% de nada" leria como atraso.
      pct: previsto > 0 ? (feito / previsto) * 100 : null,
      falta: previsto - feito,
      receita: r.valor,
      motivoSemReceita: r.motivo,
    }
  })

  return {
    linhas,
    previsto: somarMetragem(linhas.map((l) => ({ unidade: l.fase.unidade, quantidade: l.previsto }))),
    realizado: somarMetragem(linhas.map((l) => ({ unidade: l.fase.unidade, quantidade: l.realizado }))),
    receita: linhas.reduce((s, l) => s + (l.receita ?? 0), 0),
    fasesSemReceita: linhas.filter((l) => l.receita == null).length,
    dias: diasDoPeriodo(meta.de, meta.ate),
  }
}

// ─── Conferência do catálogo ──────────────────────────────────────────────────

export interface ProblemaDoCatalogo {
  tipo: 'pesos-nao-fecham' | 'fase-sem-preco' | 'peso-em-unidade-nao-area' | 'sem-fase-ativa'
  texto: string
}

/**
 * O que está errado no catálogo de fases, para a tela dizer antes de o número sair errado.
 *
 * ⚠️ Pesos que somam 97% não são um detalhe estético: no modo `peso`, eles fazem a obra inteira
 * valer 97% do que foi contratado, e ninguém percebe olhando uma fase por vez.
 */
export function conferirCatalogo(
  fases: readonly FaseDaObra[],
  modo: ConstructionSite['modoPrecoFases'],
): ProblemaDoCatalogo[] {
  const ativas = fases.filter((f) => f.ativa)
  if (ativas.length === 0) {
    return [{ tipo: 'sem-fase-ativa', texto: 'Nenhuma fase ativa — o RDO não terá o que oferecer.' }]
  }

  const problemas: ProblemaDoCatalogo[] = []

  if (modo === 'preco-proprio') {
    const sem = ativas.filter((f) => f.precoUnitario == null)
    if (sem.length > 0) {
      problemas.push({
        tipo: 'fase-sem-preco',
        texto: `${sem.length} fase(s) sem preço próprio: ${sem.map((f) => f.nome).join(', ')}. `
          + 'Elas entram na metragem, mas não geram receita.',
      })
    }
    return problemas
  }

  // Modo `peso`.
  const deArea = ativas.filter((f) => classificarUnidade(f.unidade) === 'area')
  const foraDeArea = ativas.filter((f) => classificarUnidade(f.unidade) !== 'area')

  const soma = deArea.reduce((s, f) => s + (f.pesoPct ?? 0), 0)
  // Tolerância de um centésimo: peso é digitado com uma casa, e exigir igualdade exata de ponto
  // flutuante acusaria 99.99999999999999 como erro.
  if (Math.abs(soma - 100) > 0.01) {
    problemas.push({
      tipo: 'pesos-nao-fecham',
      texto: `Os pesos das fases de área somam ${soma.toFixed(1)}%, não 100%. `
        + (soma < 100
          ? `Faltam ${(100 - soma).toFixed(1)} pontos — a obra inteira valeria menos que o contratado.`
          : `Sobram ${(soma - 100).toFixed(1)} pontos — a obra valeria mais que o contratado.`),
    })
  }

  if (foraDeArea.length > 0) {
    problemas.push({
      tipo: 'peso-em-unidade-nao-area',
      texto: `${foraDeArea.map((f) => `${f.nome} (${f.unidade})`).join(', ')} não é medida em m². `
        + 'No modo "peso" o R$/m² da obra não se aplica a ela — troque para "preço próprio por fase" '
        + 'ou aceite que essas fases entrem só como metragem, sem receita.',
    })
  }

  return problemas
}

/** Ritmo diário necessário para bater a meta de uma fase. */
export function ritmoDiarioDaFase(previsto: number, dias: number): number {
  return dias > 0 ? previsto / dias : 0
}
