/**
 * Um posto está coberto? — a resposta, em um lugar só.
 *
 * ─── POR QUE ISTO EXISTE ──────────────────────────────────────────────────────
 * A mesma pergunta estava respondida em QUATRO lugares, com regras diferentes:
 *
 *   PostosPanel       frente igual OU turno sem frente  +  cargo bate   · ignora folga/feriado
 *   cltEngine         frente igual (sem tolerância)     +  cargo bate   · ignora folga  (morta)
 *   DashboardPanel    frente igual                      +  **sem cargo** · ignora cancelado/falta
 *   MaoDeObraHeader   idêntica à do Dashboard
 *
 * As duas últimas não checam o cargo. Ou seja: o KPI "Postos Descobertos" da tela de abertura
 * podia dizer "coberto" com qualquer pessoa da frente, enquanto a matriz da aba Postos, olhando os
 * mesmos dados, dizia "descoberto". Duas telas do mesmo módulo discordando.
 *
 * ─── A REGRA, AGORA ÚNICA ─────────────────────────────────────────────────────
 * Um turno cobre um posto quando:
 *   1. está ativo no dia (não é folga, feriado, falta nem cancelado);
 *   2. **aponta para o posto** (`workPostId`) — ou, para turno antigo sem o id, a frente casa;
 *   3. a pessoa tem o cargo que o posto pede.
 */
import type { Shift, WorkPost, Worker } from '@/types'

/** Turno que não conta como presença: folga, feriado, falta, cancelado. */
export function turnoAtivo(s: Shift): boolean {
  return s.type !== 'day_off' && s.type !== 'holiday'
    && s.status !== 'absent' && s.status !== 'cancelled'
}

/** Compara frente ignorando caixa, acento e hífen — a tolerância mínima do texto livre. */
function mesmaFrente(a?: string, b?: string): boolean {
  const n = (x?: string) => (x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[\s\-_]+/g, '')
  return n(a) === n(b)
}

/**
 * Este turno cobre este posto?
 *
 * A quarta condição é temporal: **quem já foi desligado não cobre posto a partir do dia em que
 * saiu.** Um turno agendado para semana que vem em nome de alguém que saiu ontem é um posto
 * descoberto que a tela mostrava como coberto — e ninguém seria escalado no lugar.
 *
 * O que ele cobriu ANTES de sair continua valendo. O passado não se reescreve: a matriz da semana
 * retrasada tem de continuar mostrando o que de fato aconteceu. É a mesma regra das obras
 * arquivadas — some do que vem pela frente, permanece no histórico.
 *
 * Desligado sem data registrada (cadastro antigo) não muda nada: sem saber quando saiu, mexer na
 * cobertura seria adivinhar.
 */
export function turnoCobrePosto(s: Shift, post: WorkPost, worker: Worker | undefined): boolean {
  if (!turnoAtivo(s)) return false
  // O id manda. Só quando ele não existe (turno antigo) é que caímos no texto.
  const vinculado = s.workPostId ? s.workPostId === post.id : mesmaFrente(s.workFront, post.workFront)
  if (!vinculado) return false
  if (worker?.role !== post.role) return false
  // `yyyy-MM-dd` compara como texto na ordem certa, e sem fuso para errar.
  if (worker.status === 'inactive' && worker.desligamentoData && s.date >= worker.desligamentoData) return false
  return true
}

export interface CoberturaDoDia {
  postId: string
  data: string
  /** Quantas pessoas com o cargo certo estão escaladas. */
  escalados: number
  /** Quantas o posto exige. */
  exigidos: number
  coberto: boolean
  nomes: string[]
}

/** Cobertura de um posto num dia. */
export function coberturaDoPosto(
  post: WorkPost, data: string, shifts: Shift[], workers: Worker[],
): CoberturaDoDia {
  const porId = new Map(workers.map((w) => [w.id, w]))
  const cobrindo = shifts.filter((s) => s.date === data && turnoCobrePosto(s, post, porId.get(s.workerId)))
  return {
    postId: post.id,
    data,
    escalados: cobrindo.length,
    exigidos: post.minWorkers,
    coberto: cobrindo.length >= post.minWorkers,
    nomes: cobrindo.map((s) => porId.get(s.workerId)?.name ?? s.workerId),
  }
}

/**
 * Quantos postos estão descobertos num dia.
 *
 * É o número do KPI "Postos Descobertos", que o Dashboard e o cabeçalho calculavam por conta
 * própria — e sem checar o cargo.
 */
export function postosDescobertos(
  posts: WorkPost[], data: string, shifts: Shift[], workers: Worker[],
): number {
  return posts.filter((p) => !coberturaDoPosto(p, data, shifts, workers).coberto).length
}

/** Matriz posto × dia, para a grade semanal. */
export function matrizDeCobertura(
  posts: WorkPost[], datas: string[], shifts: Shift[], workers: Worker[],
): Record<string, Record<string, CoberturaDoDia>> {
  const out: Record<string, Record<string, CoberturaDoDia>> = {}
  for (const p of posts) {
    out[p.id] = {}
    for (const d of datas) out[p.id][d] = coberturaDoPosto(p, d, shifts, workers)
  }
  return out
}

/** Horário padrão de cada turno do posto — `WorkPost.shift`, que até agora era ignorado. */
export const HORARIO_DO_TURNO: Record<WorkPost['shift'], { inicio: string; fim: string }> = {
  morning:   { inicio: '07:00', fim: '16:00' },
  afternoon: { inicio: '13:00', fim: '22:00' },
  night:     { inicio: '22:00', fim: '06:00' },
  all:       { inicio: '07:00', fim: '16:00' },
}
