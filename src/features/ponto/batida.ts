/**
 * A batida, sem React e sem zustand.
 *
 * Existe separado por um motivo prático: o que este arquivo decide é o que vale em juízo — de quem
 * é a batida, qual é a próxima, e o que exatamente vai para o banco. Preso dentro do store, nada
 * disso seria testável sem levantar persist, auth e fila de sincronização; e a sequência das
 * batidas estaria escrita duas vezes (aqui e na tela), que é como as duas divergem.
 */
import type { MotivoSemCercaNaBatida, RegistroDePonto, TipoDeBatida } from '@/types'

/** Os quatro momentos, na ordem em que acontecem. É dela que sai a próxima batida do dia. */
export const SEQUENCIA_DA_JORNADA: ReadonlyArray<{ tipo: TipoDeBatida; rotulo: string }> = [
  { tipo: 'entrada',          rotulo: 'Entrada' },
  { tipo: 'inicio_intervalo', rotulo: 'Saída para o intervalo' },
  { tipo: 'fim_intervalo',    rotulo: 'Volta do intervalo' },
  { tipo: 'saida',            rotulo: 'Saída' },
]

export const ROTULO_DA_BATIDA: Record<TipoDeBatida, string> =
  Object.fromEntries(SEQUENCIA_DA_JORNADA.map((s) => [s.tipo, s.rotulo])) as Record<TipoDeBatida, string>

/**
 * Horas de folga que separam uma jornada da seguinte.
 *
 * ⚠️ É o número que faz o turno da noite funcionar. Seis horas passa folgado do maior intervalo
 * que uma jornada tem por dentro (almoço, mesmo os longos) e fica bem abaixo das 11 horas de
 * interjornada que o art. 66 da CLT exige entre dois dias de trabalho — então nunca corta uma
 * jornada no meio, e nunca cola duas.
 */
export const HORAS_ENTRE_JORNADAS = 6

/**
 * Teto para a jornada de quem entrou e nunca saiu. Passado isso, a pessoa esqueceu de bater a
 * saída: a jornada é dada por encerrada e a próxima batida abre outra, em vez de continuar
 * empilhando dias num turno que não termina nunca.
 */
export const HORAS_MAX_JORNADA = 24

/**
 * As batidas da jornada que está aberta agora — e NÃO as batidas do dia civil.
 *
 * ⚠️ Esta é a diferença entre funcionar e não funcionar no turno da noite. Filtrando por
 * `data === hoje`, quem entra às 22h vê a lista zerar à meia-noite: o próximo toque volta a ser
 * "Entrada", e a saída das 6h da manhã é gravada como entrada de um dia novo. Numa empresa que
 * atende rede de saneamento 24 horas, isso não é caso de canto — é o plantão.
 *
 * ─── AS DUAS RÉGUAS, E POR QUE NÃO PODE SER UMA SÓ ────────────────────────────
 * ⚠️ A folga ENTRE BATIDAS e o tempo DESDE A ÚLTIMA não podem usar o mesmo número:
 *
 *  · entre duas batidas, folga longa significa outro turno (saiu 17h, entrou 7h);
 *  · desde a última batida, folga longa pode significar simplesmente que a pessoa **está
 *    trabalhando**. Quem entrou às 22h e não bateu mais nada até as 6h passou oito horas em
 *    silêncio — e fechar a jornada por isso é justamente perder o turno da noite.
 *
 * O que separa os dois casos é a PARIDADE: número ímpar de batidas = a pessoa entrou e não saiu,
 * a jornada está aberta por mais que demore (até o teto de `HORAS_MAX_JORNADA`). Número par = ela
 * está fora, e só continua na mesma jornada se voltar dentro de `HORAS_ENTRE_JORNADAS` — que é o
 * caso do almoço e o da hora extra chamada logo depois do expediente.
 */
export function jornadaAberta(
  doTrabalhador: readonly RegistroDePonto[],
  agoraISO: string,
): RegistroDePonto[] {
  const ordenadas = [...doTrabalhador]
    .filter((r) => Number.isFinite(Date.parse(r.momentoDispositivo)))
    .sort((a, b) => a.momentoDispositivo.localeCompare(b.momentoDispositivo))
  if (ordenadas.length === 0) return []

  const corteMs = HORAS_ENTRE_JORNADAS * 3_600_000
  const agora = Date.parse(agoraISO)

  // 1) O encadeamento: de trás para frente, enquanto uma batida e a seguinte estiverem perto.
  const cadeia: RegistroDePonto[] = [ordenadas[ordenadas.length - 1]]
  for (let i = ordenadas.length - 2; i >= 0; i--) {
    const t = Date.parse(ordenadas[i].momentoDispositivo)
    const seguinte = Date.parse(cadeia[0].momentoDispositivo)
    if (seguinte - t >= corteMs) break
    cadeia.unshift(ordenadas[i])
  }

  // 2) Essa cadeia ainda está aberta AGORA?
  const desdeAUltima = agora - Date.parse(cadeia[cadeia.length - 1].momentoDispositivo)
  const dentroDaJornada = cadeia.length % 2 === 1
    ? desdeAUltima < HORAS_MAX_JORNADA * 3_600_000   // entrou e não saiu: continua trabalhando
    : desdeAUltima < corteMs                          // está fora: só volta se for logo
  return dentroDaJornada ? cadeia : []
}

/**
 * O dia a que a jornada pertence: o da PRIMEIRA batida dela.
 *
 * ⚠️ Turno que começa às 22h de segunda e termina às 6h de terça é jornada de SEGUNDA — é assim
 * que se conta hora extra, adicional noturno e interjornada. Carimbar cada batida com o dia civil
 * em que ela caiu partiria o mesmo turno em dois dias, cada metade parecendo incompleta.
 */
export function dataDaJornada(aberta: readonly RegistroDePonto[], hoje: string): string {
  return aberta[0]?.data ?? hoje
}

/**
 * A próxima batida da jornada aberta.
 *
 * ⚠️ Conta o que JÁ foi batido, em vez de olhar o relógio ou o último tipo. Quem esqueceu a volta
 * do intervalo não fica travado: a contagem anda, e a lacuna vira pendência no espelho do mês —
 * que é onde o gestor resolve. Travar a pessoa no canteiro produziria o pior dos dois mundos: um
 * dia sem saída registrada E um funcionário sem como registrar.
 *
 * Só conta batida de origem `app`: um ajuste lançado pelo gestor no meio do dia não pode mudar
 * qual botão aparece no celular de quem ainda está trabalhando.
 */
export function proximaBatida(doDia: readonly RegistroDePonto[]): TipoDeBatida {
  const feitas = doDia.filter((r) => r.origem === 'app').length
  const naSequencia = SEQUENCIA_DA_JORNADA[feitas]
  if (naSequencia) return naSequencia.tipo
  // ⚠️ Depois da quarta o dia NÃO fecha. Hora extra chamada à noite, retorno de emergência na rede
  // da SABESP, plantão: acontece, e travar o botão produziria trabalho sem registro nenhum — o que
  // o art. 74 existe para impedir. Daí em diante alterna: par volta a ser entrada, ímpar é saída.
  return feitas % 2 === 0 ? 'entrada' : 'saida'
}

/** O que a tela precisa enviar; o resto (`id`, autoria, hora) é carimbado por `montarBatida`. */
export interface DadosDaBatida {
  workerId: string
  siteId: string | null
  tipo: TipoDeBatida
  lat?: number
  lng?: number
  precisaoM?: number
  distanciaM?: number
  dentroDaCerca?: boolean
  motivoSemCerca?: MotivoSemCercaNaBatida
  justificativa?: string
}

export interface CarimboDaBatida {
  /** `auth.users.id` de quem está logado AGORA. É a prova de autoria. */
  authUserId: string
  id: string
  /** ISO do relógio do aparelho. */
  agora: string
  /**
   * `yyyy-MM-dd` da JORNADA (ver `dataDaJornada`), não necessariamente o dia civil de agora.
   */
  data: string
}

/**
 * Monta o registro. Puro: mesma entrada, mesma saída.
 *
 * ⚠️ `authUserId` vem do carimbo, NUNCA do que a tela mandou. É a diferença entre "o sistema
 * registrou quem estava logado" e "a tela disse quem era" — a segunda é falsificável por qualquer
 * um que abra o console do navegador.
 */
export function montarBatida(dados: DadosDaBatida, carimbo: CarimboDaBatida): RegistroDePonto {
  return {
    ...dados,
    id: carimbo.id,
    authUserId: carimbo.authUserId,
    data: carimbo.data,
    momentoDispositivo: carimbo.agora,
    origem: 'app',
    createdAt: carimbo.agora,
  }
}

/**
 * O ajuste do gestor: batida NOVA, marcada, nunca a edição da original.
 *
 * ⚠️ Apagar ou reescrever o que a pessoa bateu é o oposto do que o registro de jornada serve
 * (CLT art. 74 §2º, Portaria 671 — inalterabilidade). Por isso `origem: 'ajuste'`, com autor,
 * instante e motivo, e a marcação original intacta ao lado no espelho.
 */
export function montarAjuste(
  dados: DadosDaBatida & {
    authUserId: string
    data: string
    momentoDispositivo: string
    motivoAjuste: string
    /** A batida corrigida, quando há uma. Ausente = inclusão de marcação que nunca houve. */
    corrigeId?: string
  },
  carimbo: { id: string; agora: string; ajustadoPor: string },
): RegistroDePonto {
  return {
    ...dados,
    id: carimbo.id,
    origem: 'ajuste',
    ajustadoPor: carimbo.ajustadoPor,
    ajustadoEm: carimbo.agora,
    createdAt: carimbo.agora,
  }
}

/**
 * A linha que vai para o Postgres.
 *
 * ⚠️ `worker_id` e `auth_user_id` são COLUNAS promovidas, não só payload: é por elas que a policy
 * `ponto_insert` exige `auth_user_id = auth.uid()` e que a de SELECT recorta o que o colaborador
 * enxerga. Um filtro dentro de jsonb não serviria para RLS com índice.
 *
 * ⚠️ `created_by` vai porque o `fixOrg` do `storeSync` o INJETA quando falta — tabela sem a coluna
 * devolve PGRST204, que é classe "aguardando servidor": a fila tentaria para sempre, em silêncio,
 * sem nada na tela. Mas ele é registro de quem SINCRONIZOU, não de quem bateu; o `fixOrg`
 * reescreve-o de propósito. Quem bateu é `auth_user_id`, e só ele.
 *
 * ⚠️ `momento_servidor` e `nsr` NÃO saem daqui. São do servidor — a hora, pelo `default now()`; o
 * NSR, pelo gatilho. Mandá-los do cliente seria deixar o aparelho numerar a prova dele mesmo.
 */
export function batidaParaRow(r: RegistroDePonto, orgId: string, userIdQueSincroniza: string) {
  return {
    id: r.id,
    organization_id: orgId,
    worker_id: r.workerId,
    auth_user_id: r.authUserId,
    site_id: r.siteId,
    tipo: r.tipo,
    data: r.data,
    momento_dispositivo: r.momentoDispositivo,
    origem: r.origem,
    payload: r as unknown as Record<string, unknown>,
    created_by: userIdQueSincroniza,
    deleted_at: null,
  }
}
