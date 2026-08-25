/**
 * funcionarioAtivo.ts — desligar sem apagar, e saber o que se perde ao apagar.
 *
 * O cliente pediu textualmente: *"prefiro manter os dados dos funcionários e colocar uma forma de
 * colocar que ele foi desligado"*. O estado `inactive` já existia em `Worker.status`, já grava e já
 * sincroniza — o que faltava era ele ser uma **ação**, e não uma opção escondida num select do
 * formulário de cadastro.
 *
 * ─── A REGRA, IGUAL À DAS OBRAS ARQUIVADAS ────────────────────────────────────
 * **O filtro é sempre visual, nunca no dado** (mesma regra de `obraAtiva.ts`). O desligado
 * continua saindo da store para todo mundo; quem esconde é a tela. Se o filtro descesse para a
 * store, o desligado sumiria do holerite antigo, do custo histórico das obras e dos relatórios
 * junto — que é exatamente o que ele pediu para NÃO acontecer.
 *
 * ─── POR QUE CONTAR O HISTÓRICO ANTES DE EXCLUIR ──────────────────────────────
 * Não há chave estrangeira nem cascata: turnos, apontamentos, faltas e avaliações continuam
 * apontando para alguém que deixou de existir. O estrago é silencioso e retroativo —
 * o holerite antigo passa a mostrar o código interno no lugar do nome, o custo por departamento
 * de março muda de forma hoje, e o posto que estava coberto vira descoberto. Por isso a exclusão
 * conta antes: quem não tem histórico (cadastro duplicado, erro de digitação) passa direto; quem
 * tem, vê o número e a recomendação de só desligar.
 *
 * Arquivo folha: só depende de tipos, para poder ser usado por qualquer feature sem risco de ciclo.
 */
import type { Worker, Shift, TimecardEntry, WorkerAbsence, WorkerAssessment } from '@/types'

/** Só `inactive` é desligamento. `suspended` é afastamento temporário — a pessoa volta. */
export function funcionarioEstaAtivo(w: Pick<Worker, 'status'>): boolean {
  return w.status !== 'inactive'
}

/** Separa em ativos e desligados preservando a ordem original de cada grupo. */
export function separarPorAtividade<T extends Pick<Worker, 'status'>>(workers: T[]): {
  ativos: T[]
  desligados: T[]
} {
  const ativos: T[] = []
  const desligados: T[] = []
  for (const w of workers) (funcionarioEstaAtivo(w) ? ativos : desligados).push(w)
  return { ativos, desligados }
}

/** O que existe no sistema apontando para esta pessoa. */
export interface HistoricoDoFuncionario {
  turnos: number
  apontamentos: number
  /** Dos apontamentos, quantos nasceram de um RDO — não foram digitados por ninguém. */
  apontamentosDeRdo: number
  faltas: number
  avaliacoes: number
  /** A soma de tudo. Zero = excluir não perde nada. */
  total: number
  /** Primeira e última data com registro, `null` quando não há nenhum. */
  primeiraData: string | null
  ultimaData: string | null
}

/**
 * Conta o rastro de um funcionário.
 *
 * Percorre as quatro coleções que apontam para `workerId`. As datas saem em `yyyy-MM-dd` e são
 * comparadas como texto de propósito — nesse formato a ordem alfabética é a ordem cronológica, e
 * não há fuso para errar.
 */
export function contarHistoricoDoFuncionario(
  workerId: string,
  dados: {
    shifts?: Shift[]
    timecards?: TimecardEntry[]
    absences?: WorkerAbsence[]
    assessments?: WorkerAssessment[]
  },
): HistoricoDoFuncionario {
  const turnos       = (dados.shifts      ?? []).filter((s) => s.workerId === workerId)
  const apontamentos = (dados.timecards   ?? []).filter((t) => t.workerId === workerId)
  const faltas       = (dados.absences    ?? []).filter((a) => a.workerId === workerId)
  const avaliacoes   = (dados.assessments ?? []).filter((a) => a.workerId === workerId)

  const datas = [
    ...turnos.map((s) => s.date),
    ...apontamentos.map((t) => t.date),
    ...faltas.map((a) => a.date),
  ].filter((d): d is string => typeof d === 'string' && d.length >= 10).sort()

  return {
    turnos: turnos.length,
    apontamentos: apontamentos.length,
    apontamentosDeRdo: apontamentos.filter((t) => t.sourceRdoId).length,
    faltas: faltas.length,
    avaliacoes: avaliacoes.length,
    total: turnos.length + apontamentos.length + faltas.length + avaliacoes.length,
    primeiraData: datas[0] ?? null,
    ultimaData: datas[datas.length - 1] ?? null,
  }
}

/**
 * A partir de quanto histórico excluir deixa de ser oferecido.
 *
 * Escolha do cliente entre avisar sempre e bloquear: **contar o que se perde e bloquear quando for
 * muito**. Abaixo do limite o aviso mostra a conta e ainda permite excluir; a partir dele, só
 * desligar — o estrago retroativo (holerite ilegível, custo do mês passado mudando de forma) é
 * grande demais para caber num "tem certeza?".
 */
export const HISTORICO_QUE_BLOQUEIA_EXCLUSAO = 30

export type DecisaoDeExclusao = 'livre' | 'avisar' | 'bloquear'

export function decidirExclusao(h: HistoricoDoFuncionario): DecisaoDeExclusao {
  if (h.total === 0) return 'livre'
  return h.total >= HISTORICO_QUE_BLOQUEIA_EXCLUSAO ? 'bloquear' : 'avisar'
}
