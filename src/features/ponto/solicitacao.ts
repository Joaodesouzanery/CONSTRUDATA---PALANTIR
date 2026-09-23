/**
 * O pedido de correção de ponto — feito pelo funcionário, decidido pelo gestor.
 *
 * ─── POR QUE ISTO NÃO É UMA BATIDA ────────────────────────────────────────────
 * ⚠️ Um pedido pendente **não pode** morar em `ponto_registros`. Nem `jornadasDoPeriodo` nem
 * `jornadaAberta` filtram por `origem`: as duas montam a jornada **por paridade** sobre todos os
 * registros do trabalhador. Um pedido ali viraria mais uma marcação na cadeia, mudando o intervalo,
 * os minutos trabalhados e **o banco de horas — antes de qualquer gestor aprovar**, e sem nenhum
 * erro na tela. Por isso existe tabela própria, e por isso o motor de jornada não muda uma linha.
 *
 * A aprovação é que vira batida: o gestor cria o `ajuste` de sempre, pelo caminho que já existe e
 * já está coberto pelas policies.
 */
import type { TipoDeBatida } from '@/types'

export type SituacaoDaSolicitacao = 'pendente' | 'aprovada' | 'recusada'
export type AcaoDaSolicitacao = 'incluir' | 'corrigir'

export const TEXTO_DA_ACAO: Record<AcaoDaSolicitacao, string> = {
  incluir:  'Incluir marcação que faltou',
  corrigir: 'Corrigir o horário de uma marcação',
}

export const TEXTO_DA_SITUACAO: Record<SituacaoDaSolicitacao, string> = {
  pendente: 'Aguardando o responsável',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
}

export interface SolicitacaoDePonto {
  id: string
  workerId: string
  authUserId: string
  /** `yyyy-MM-dd` — o dia da JORNADA, não o dia civil da batida. */
  data: string
  acao: AcaoDaSolicitacao
  tipo: TipoDeBatida
  /** `HH:mm` local. */
  horaPedida: string
  /** A batida que o pedido corrige. Ausente quando é inclusão. */
  corrigeId?: string
  motivo: string
  situacao: SituacaoDaSolicitacao
  respondidaPor?: string
  respondidaEm?: string
  resposta?: string
  ajusteId?: string
  criadaEm: string
}

/** Mínimo do motivo. Mesma régua do ajuste do gestor — abaixo disso não é explicação, é carimbo. */
export const MOTIVO_MINIMO = 8

export interface DadosDaSolicitacao {
  workerId: string
  authUserId: string
  data: string
  acao: AcaoDaSolicitacao
  tipo: TipoDeBatida
  horaPedida: string
  corrigeId?: string
  motivo: string
}

export function montarSolicitacao(
  dados: DadosDaSolicitacao,
  carimbo: { id: string; agora: string },
): SolicitacaoDePonto {
  return {
    id: carimbo.id,
    workerId: dados.workerId,
    authUserId: dados.authUserId,
    data: dados.data,
    acao: dados.acao,
    tipo: dados.tipo,
    horaPedida: dados.horaPedida,
    corrigeId: dados.corrigeId,
    motivo: dados.motivo.trim(),
    situacao: 'pendente',
    criadaEm: carimbo.agora,
  }
}

export function solicitacaoParaRow(s: SolicitacaoDePonto, orgId: string, userId: string) {
  return {
    id: s.id,
    organization_id: orgId,
    worker_id: s.workerId,
    auth_user_id: s.authUserId,
    data: s.data,
    acao: s.acao,
    tipo: s.tipo,
    hora_pedida: `${s.horaPedida}:00`,
    corrige_id: s.corrigeId ?? null,
    motivo: s.motivo,
    situacao: s.situacao,
    respondida_por: s.respondidaPor ?? null,
    respondida_em: s.respondidaEm ?? null,
    resposta: s.resposta ?? null,
    ajuste_id: s.ajusteId ?? null,
    // ⚠️ Contrato implícito do `fixOrg`: sem `created_by`, PGRST204 e retry infinito silencioso.
    created_by: userId,
    deleted_at: null,
  }
}

/** Por que este pedido não pode ser feito. `null` = pode. */
export type MotivoSemPedir =
  /** Já existe pedido pendente para o mesmo dia e a mesma marcação. */
  | 'duplicado'
  /** Fora da janela: o mês corrente e o anterior. */
  | 'fora-da-janela'
  /** Motivo curto demais. */
  | 'motivo-curto'

export const TEXTO_SEM_PEDIR: Record<MotivoSemPedir, string> = {
  'duplicado':      'Você já tem um pedido aguardando resposta para este dia e esta marcação',
  'fora-da-janela': 'Só dá para pedir correção do mês atual e do mês anterior — depois disso a folha já fechou',
  'motivo-curto':   `Escreva o motivo com pelo menos ${MOTIVO_MINIMO} letras`,
}

/**
 * O pedido é aceitável?
 *
 * ⚠️ A janela de dois meses não é burocracia: passado o fechamento da folha, corrigir uma marcação
 * não muda mais o pagamento — muda só o documento, e aí é decisão do RH, não pedido de app.
 *
 * ⚠️ E o bloqueio de duplicado existe porque o botão fica num celular: sem ele, três toques no
 * mesmo lugar viram três pedidos idênticos na fila do gestor.
 */
export function podeSolicitar(
  dados: Pick<DadosDaSolicitacao, 'data' | 'tipo' | 'motivo'>,
  jaFeitas: readonly SolicitacaoDePonto[],
  hoje: string,
): MotivoSemPedir | null {
  if (dados.motivo.trim().length < MOTIVO_MINIMO) return 'motivo-curto'

  const mesAtual = hoje.slice(0, 7)
  const d = new Date(`${mesAtual}-01T00:00:00`)
  d.setMonth(d.getMonth() - 1)
  const mesAnterior = d.toISOString().slice(0, 7)
  const mesDoPedido = dados.data.slice(0, 7)
  if (mesDoPedido !== mesAtual && mesDoPedido !== mesAnterior) return 'fora-da-janela'
  // Data no futuro também não: ninguém pede correção de uma jornada que ainda não houve.
  if (dados.data > hoje) return 'fora-da-janela'

  const repetido = jaFeitas.some(
    (s) => s.situacao === 'pendente' && s.data === dados.data && s.tipo === dados.tipo,
  )
  return repetido ? 'duplicado' : null
}
