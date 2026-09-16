/**
 * horaExtraCalculo.ts — a conta da aba "Ausência ponto saída", e o id determinístico da hora extra.
 *
 * ─── A CONTA, CONFERIDA CONTRA O ARQUIVO REAL ─────────────────────────────────
 *   valor hora            = salário ÷ 220
 *   valor hora + adicional= valor hora × 1,6            (60% — parâmetro, não constante)
 *   valor das extras      = horas extras × (valor hora + adicional)
 *   valor das descontadas = horas descontadas × valor hora   ← SEM o adicional
 *   TOTAL                 = extras + descontadas             ← SOMA, não subtração
 *
 * ⚠️ O TOTAL soma porque esta aba **devolve** dinheiro: quem não bateu o ponto na saída teve horas
 * descontadas pelo relógio, a empresa conferiu que a pessoa estava lá, e paga essas horas de volta
 * junto com a hora extra do mesmo dia. Ler "descontadas" como abatimento inverteria o sinal da
 * folha inteira. Conferido nas 10 linhas de agosto: Renan 130,91 + 72,73 = 203,64; Kauê 276,36 +
 * 145,45 = 421,82; total da aba R$ 2.065,15.
 *
 * ⚠️ Não confundir com `fatorDoDia` (`conferenciaHorasExtras.ts`), que devolve 1,5 em dia útil e
 * 2,0 em domingo/feriado — aquela é a régua legal da CLT, usada para CONFERIR o que foi pago.
 * Esta é a convenção que este cliente aplica na devolução. As duas coexistem de propósito.
 */
import { seededUuidLegado } from '@/lib/seededId'
import type { HoraExtra, HoraExtraTipo } from '@/types'

/** Divisor da jornada mensal CLT. O mesmo de `conferenciaHorasExtras.ts`. */
export const HORAS_MES_CLT = 220

/** O adicional do cliente é 60%; a CLT mínima é 50%. Vem de `CLTSettings.overtimeRate`. */
export const FATOR_ADICIONAL_PADRAO = 1.6

export interface EntradaPontoSaida {
  salario: number
  horasDescontadas: number
  horasExtras: number
  /** 1,6 = 60%. Default do cliente; passe outro para simular. */
  fatorAdicional?: number
}

export interface CalculoPontoSaida {
  valorHora: number
  valorHoraComAdicional: number
  valorHorasExtras: number
  valorHorasDescontadas: number
  /** Extras + descontadas. É o que a empresa deve à pessoa. */
  total: number
}

export function calcularPontoSaida(e: EntradaPontoSaida): CalculoPontoSaida {
  const fator = e.fatorAdicional ?? FATOR_ADICIONAL_PADRAO
  const valorHora = (Number(e.salario) || 0) / HORAS_MES_CLT
  const valorHoraComAdicional = valorHora * fator
  const valorHorasExtras = (Number(e.horasExtras) || 0) * valorHoraComAdicional
  const valorHorasDescontadas = (Number(e.horasDescontadas) || 0) * valorHora
  return {
    valorHora,
    valorHoraComAdicional,
    valorHorasExtras,
    valorHorasDescontadas,
    total: valorHorasExtras + valorHorasDescontadas,
  }
}

/** Converte `overtimeRate` (%, ex. 60) no multiplicador (1,6). Ausente = o padrão do cliente. */
export function fatorDoAdicional(overtimeRate?: number): number {
  return typeof overtimeRate === 'number' && Number.isFinite(overtimeRate)
    ? 1 + overtimeRate / 100
    : FATOR_ADICIONAL_PADRAO
}

/**
 * Id determinístico da hora extra: pessoa + dia + tipo.
 *
 * ⚠️ Derivado, nunca sorteado — mesmo motivo de `diasSemProducaoStore`: dois aparelhos offline
 * lançando o mesmo sábado da mesma pessoa gerariam duas linhas e, no servidor, um 23505 que deixa
 * a op presa na fila para sempre (a fila não tem teto de tentativas, por decisão).
 *
 * A chave usa `workerId` quando existe e cai para o nome normalizado quando não — hora extra de
 * planilha nem sempre casa com o cadastro, e ainda assim não pode duplicar a cada reimportação.
 */
export function idDaHoraExtra(chaveDaPessoa: string, data: string, tipo: HoraExtraTipo): string {
  return seededUuidLegado(`hora-extra:${chaveDaPessoa}:${data}:${tipo}`)
}

/** A chave da pessoa para o id acima: o vínculo quando existe, o nome quando não. */
export function chaveDaPessoa(he: Pick<HoraExtra, 'workerId' | 'workerNome'>): string {
  return he.workerId || he.workerNome.trim().toLowerCase().replace(/\s+/g, ' ')
}
