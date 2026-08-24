/**
 * A ponte entre o extrato de faturamento da obra e o Financeiro.
 *
 * A nota é lançada UMA vez, em Contrato → Medições — a tela onde o engenheiro já trabalha o
 * contrato. Dali sai o título a receber, e o recebimento vira receita. Assim o saldo da obra e o
 * fluxo de caixa da empresa saem do mesmo lançamento, em vez de serem digitados duas vezes e
 * discordarem.
 *
 * ─── AS TRÊS REGRAS ───────────────────────────────────────────────────────────
 *   cadastrar o contrato  →  NADA no Financeiro (senão a receita entra duas vezes)
 *   nota "a receber"      →  título a receber, vencimento na data prevista
 *   nota "recebido"       →  título baixado: vira receita, na data do recebimento
 *
 * Material faturado direto pelo fornecedor **não gera título nenhum**: se o dinheiro não passa
 * pela conta da empresa, ele não é receita dela. Aparece só na carteira da obra.
 *
 * O id do título é **determinístico** (`seededUuidLegado` sobre obra + nota): reprocessar o mesmo
 * extrato — ao editar o contrato, ao sincronizar de outro aparelho, ao reabrir a tela — atualiza
 * o título que já existe em vez de criar um segundo. Cobrança duplicada é o pior erro possível.
 */
import { seededUuidLegado } from '@/lib/seededId'
import type { ConstructionSite, FinanceiroEntry, FinanceiroTitulo, ObraFaturamento } from '@/types'

/** Id estável do título gerado por uma nota do extrato. */
export function idTituloDaNota(siteId: string, nota: ObraFaturamento): string {
  return seededUuidLegado(`obra-faturamento:${siteId}:${nota.id}`)
}

/** A nota gera título? Só as de serviço — material de terceiro fica fora do Financeiro. */
export function notaGeraTitulo(n: ObraFaturamento): boolean {
  return (n.categoria ?? 'servico') !== 'material' && (Number(n.valor) || 0) > 0
}

/**
 * Converte as notas do extrato em títulos.
 *
 * Diferente da primeira versão, a nota **recebida também vira título** — só que já baixado. Antes
 * ela simplesmente sumia, e por isso o extrato da obra nunca produzia receita no Fluxo de Caixa
 * nem no DRE. Uma nota que nasce recebida cria e baixa no mesmo passo: um lançamento, nunca dois.
 */
export function titulosDoFaturamento(site: ConstructionSite): FinanceiroTitulo[] {
  const notas = site.contrato?.faturamentos ?? []
  const cliente = site.contrato?.contratanteRazao || site.owner || site.company || '—'

  return notas.filter(notaGeraTitulo).map((n) => {
    const recebido = n.situacao === 'recebido'
    const dataPagamento = recebido ? (n.dataRecebimento || n.data) : undefined
    return {
      id:         idTituloDaNota(site.id, n),
      tipo:       'receber' as const,
      descricao:  n.descricao?.trim() || `Faturamento ${site.name}`,
      parceiro:   cliente,
      valor:      Number(n.valor) || 0,
      // Nota sem previsão usa a emissão: título sem vencimento não aparece em relatório de fluxo
      // de caixa nenhum, e uma data imprecisa é melhor do que sumir.
      vencimento: n.previsaoRecebimento || dataPagamento || n.data,
      emissao:    n.data,
      obraId:     site.id,
      numeroDoc:  n.nf,
      // 'medicao' é a categoria de recebimento de obra no plano de contas; a entrada é
      // 'adiantamento', o recebimento antecipado do cliente. As duas mapeiam para receita bruta
      // no DRE (ver `financeiroCalc.ts`).
      categoria:  n.entrada ? ('adiantamento' as const) : ('medicao' as const),
      status:     recebido ? ('pago' as const) : ('pendente' as const),
      ...(dataPagamento ? { dataPagamento } : {}),
      notas:      n.observacoes,
      createdAt:  new Date().toISOString(),
    }
  })
}

/**
 * Ids dos títulos que a obra deixou de gerar — nota que passou a material, ou zerada.
 *
 * Nota **apagada** do extrato NÃO entra aqui, de propósito: apagar a linha do contrato pode ser
 * correção de digitação, mas o título já pode ter sido conciliado no Financeiro. Some da carteira,
 * não do caixa — quem apaga uma cobrança é o módulo financeiro, com a conferência dele.
 */
export function titulosObsoletos(site: ConstructionSite, titulosAtuais: FinanceiroTitulo[]): string[] {
  const validos = new Set(titulosDoFaturamento(site).map((t) => t.id))
  const conhecidos = new Set((site.contrato?.faturamentos ?? []).map((n) => idTituloDaNota(site.id, n)))
  return titulosAtuais
    .filter((t) => t.obraId === site.id && conhecidos.has(t.id) && !validos.has(t.id))
    .map((t) => t.id)
}

// ─── A trava contra receita dobrada ───────────────────────────────────────────

export interface LancamentoSuspeito {
  /** A nota do extrato que está prestes a virar receita. */
  nota:  ObraFaturamento
  /** O lançamento manual que parece ser o mesmo dinheiro. */
  entry: FinanceiroEntry
  /** Diferença de dias entre as duas datas. */
  dias:  number
}

/** Folga entre a data da nota e a do lançamento que ainda conta como "o mesmo dinheiro". */
const JANELA_DIAS = 5
/** Diferença de valor tolerada — centavos de arredondamento, não valores parecidos. */
const TOLERANCIA_CENTAVOS = 0.02

function diasEntreISO(a: string, b: string): number {
  const ms = Math.abs(new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime())
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : Number.POSITIVE_INFINITY
}

/**
 * Procura lançamento manual que pareça ser o mesmo dinheiro de uma nota recebida.
 *
 * ⚠️ POR QUE ISTO EXISTE: até 24/08/2026 a nota marcada como recebida fazia o título **sumir**, e
 * o extrato da obra nunca virava receita. Agora ele vira — e tudo que o usuário já tiver lançado
 * à mão em Entradas/Saídas passaria a estar contado duas vezes. Esta função acha esses casos para
 * a tela mostrar os dois lado a lado antes de gravar.
 *
 * O critério é conservador de propósito: **mesma obra, mesmo valor** (até dois centavos) e poucos
 * dias de diferença. Lançamento gerado pelo próprio sistema (que já tem `sourceTituloId`) é
 * ignorado — ele não é digitação manual, é o nosso.
 */
export function lancamentosDuplicados(
  site: ConstructionSite,
  entries: FinanceiroEntry[],
): LancamentoSuspeito[] {
  const notas = (site.contrato?.faturamentos ?? [])
    .filter((n) => notaGeraTitulo(n) && n.situacao === 'recebido')
  if (notas.length === 0) return []

  const candidatos = entries.filter((e) =>
    e.tipo === 'entrada' && !e.sourceTituloId && (e.obraId ?? null) === site.id)
  if (candidatos.length === 0) return []

  const out: LancamentoSuspeito[] = []
  for (const nota of notas) {
    const quando = nota.dataRecebimento || nota.data
    for (const entry of candidatos) {
      if (Math.abs((Number(entry.valor) || 0) - (Number(nota.valor) || 0)) > TOLERANCIA_CENTAVOS) continue
      const dias = diasEntreISO(quando, entry.data)
      if (dias <= JANELA_DIAS) out.push({ nota, entry, dias })
    }
  }
  return out
}
