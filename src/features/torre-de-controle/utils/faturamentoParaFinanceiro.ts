/**
 * A ponte entre o extrato de faturamento da obra e o Financeiro.
 *
 * A nota é lançada UMA vez, em "Contrato & Medição" — a tela onde o engenheiro já trabalha o
 * contrato. Cada linha marcada "a receber" vira um título a receber, com a obra e a data
 * previstas. Assim o saldo da obra e o fluxo de caixa da empresa saem do mesmo lançamento, em vez
 * de serem digitados duas vezes e discordarem.
 *
 * O id do título é **determinístico** (`seededUuidLegado` sobre obra + nota): reprocessar o mesmo
 * extrato — ao editar o contrato, ao sincronizar de outro aparelho, ao reabrir a tela — atualiza o
 * título que já existe em vez de criar um segundo. Cobrança duplicada é o pior erro possível aqui.
 */
import { seededUuidLegado } from '@/lib/seededId'
import type { ConstructionSite, FinanceiroTitulo, ObraFaturamento } from '@/types'

/** Id estável do título gerado por uma nota do extrato. */
export function idTituloDaNota(siteId: string, nota: ObraFaturamento): string {
  return seededUuidLegado(`obra-faturamento:${siteId}:${nota.id}`)
}

/**
 * Converte as notas "a receber" de uma obra em títulos.
 *
 * Só as pendentes viram título: uma nota já recebida é histórico do contrato, não uma cobrança em
 * aberto — criá-la como título "pago" encheria o Financeiro de lançamentos que ninguém precisa
 * conciliar. Nota sem data prevista usa a data de emissão, para não gerar título sem vencimento.
 */
export function titulosDoFaturamento(site: ConstructionSite): FinanceiroTitulo[] {
  const notas = site.contrato?.faturamentos ?? []
  const cliente = site.contrato?.contratanteRazao || site.owner || site.company || '—'

  return notas
    .filter((n) => n.situacao === 'a_receber' && (Number(n.valor) || 0) > 0)
    .map((n) => ({
      id:         idTituloDaNota(site.id, n),
      tipo:       'receber' as const,
      descricao:  n.descricao?.trim() || `Faturamento ${site.name}`,
      parceiro:   cliente,
      valor:      Number(n.valor) || 0,
      vencimento: n.previsaoRecebimento || n.data,
      emissao:    n.data,
      obraId:     site.id,
      numeroDoc:  n.nf,
      // 'medicao' é a categoria de recebimento de obra no plano de contas; a entrada é
      // 'adiantamento', que é o recebimento antecipado do cliente e mapeia para receita bruta
      // no DRE (ver `financeiroCalc.ts`).
      categoria:  n.entrada ? ('adiantamento' as const) : ('medicao' as const),
      status:     'pendente' as const,
      notas:      n.observacoes,
      createdAt:  new Date().toISOString(),
    }))
}

/**
 * Ids dos títulos que a obra deixou de gerar — nota apagada, ou que passou a "recebido".
 *
 * Sem isto, dar baixa numa nota no contrato deixaria a cobrança viva no Financeiro para sempre.
 */
export function titulosObsoletos(site: ConstructionSite, titulosAtuais: FinanceiroTitulo[]): string[] {
  const validos = new Set(titulosDoFaturamento(site).map((t) => t.id))
  const daObra = (site.contrato?.faturamentos ?? []).map((n) => idTituloDaNota(site.id, n))
  const conhecidos = new Set(daObra)
  return titulosAtuais
    .filter((t) => t.obraId === site.id && conhecidos.has(t.id) && !validos.has(t.id))
    .map((t) => t.id)
}
