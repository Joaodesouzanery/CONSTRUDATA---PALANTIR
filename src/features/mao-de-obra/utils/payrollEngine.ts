/**
 * Payroll Engine — pure functions, no side effects, no Zustand imports.
 *
 * Brazilian labor law + 2025 tax tables:
 *  - INSS (employee): progressive table 2025
 *  - INSS (employer): 20% of gross (simplified regime)
 *  - FGTS (employer): 8% of gross
 *  - IRRF: 2025 simplified table
 *  - VT (Vale-Transporte): worker pays 6% of base; capped at actual cost
 *  - VA/VR: R$ 35/working day worker deduction (company absorbs the rest)
 *  - Overtime: derived from CLT settings (rate %, already calculated in CMO engine)
 *  - Night differential: already calculated in CMO engine
 *
 * Security notes:
 *  - All numeric inputs are sanitized via Math.max/min before use
 *  - No eval(), no template-string HTML
 *  - Amounts always rounded to 2 decimal places
 */

import type {
  Worker,
  Shift,
  CLTSettings,
  FaixaTributaria,
  RedutorIrrf,
  WorkerPayslip,
  PayrollMonth,
  PayslipAllowance,
  PayslipDeduction,
} from '@/types'
import { calcShiftMinutes, calcNightMinutes } from './cltEngine'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// ─── Tabelas fiscais ──────────────────────────────────────────────────────────
//
// ATENÇÃO ANTES DE MEXER. Estes valores mudam por portaria. Eles ficam aqui apenas como
// PADRÃO para quem nunca configurou nada; a fonte da verdade é `CLTSettings.tabelaInss` /
// `tabelaIrrf`, editável por organização na tela de configurações, com a competência à vista.
//
// Os valores abaixo são os de fevereiro/2024 — os mesmos que estavam no código rotulados como
// "2025". Mantive-os como padrão em vez de inventar os de 2026 porque chutar tabela tributária é
// pior do que exibir uma desatualizada com a data ao lado. Quem configurar, manda.

export const TABELA_INSS_PADRAO: FaixaTributaria[] = [
  { ate: 1_412.00, aliquota: 0.075 },
  { ate: 2_666.68, aliquota: 0.090 },
  { ate: 4_000.03, aliquota: 0.120 },
  { ate: 7_786.02, aliquota: 0.140 },
]

export const TABELA_IRRF_PADRAO: FaixaTributaria[] = [
  { ate: 2_259.20, aliquota: 0.000, deduzir: 0.00 },
  { ate: 2_826.65, aliquota: 0.075, deduzir: 169.44 },
  { ate: 3_751.05, aliquota: 0.150, deduzir: 381.44 },
  { ate: 4_664.68, aliquota: 0.225, deduzir: 662.77 },
  { ate: Infinity, aliquota: 0.275, deduzir: 896.00 },
]

export const COMPETENCIA_TABELAS_PADRAO = '2024-02'
export const IRRF_DEDUCAO_DEPENDENTE_PADRAO = 189.59

// ─── Tabelas de 2026 ──────────────────────────────────────────────────────────
//
// ⚠️ Estas alíquotas entraram como o cliente as passou (08/09/2026), DATADAS e editáveis. Ninguém
// aqui é a fonte da verdade tributária: a tela avisa "confira com o contador antes de fechar a
// folha" enquanto a vigência for esta. Se o contador discordar de um número, muda-se na tela.
//
// INSS progressivo, competência 2026: 7,5% até 1.621,00 · 9% até 2.902,84 · 12% até 4.354,27 ·
// 14% até 8.475,55 (teto). Desconto máximo = R$ 988,09 — `tetoINSS(TABELA_INSS_2026)` confere.
export const TABELA_INSS_2026: FaixaTributaria[] = [
  { ate: 1_621.00, aliquota: 0.075 },
  { ate: 2_902.84, aliquota: 0.090 },
  { ate: 4_354.27, aliquota: 0.120 },
  { ate: 8_475.55, aliquota: 0.140 },
]

// IRRF: a tabela progressiva vigente (maio/2025), sobre a qual a Lei 15.270/2025 aplica o REDUTOR
// abaixo — a lei não trocou as faixas, criou um desconto sobre o imposto calculado.
export const TABELA_IRRF_2026: FaixaTributaria[] = [
  { ate: 2_428.80, aliquota: 0.000, deduzir: 0.00 },
  { ate: 2_826.65, aliquota: 0.075, deduzir: 182.16 },
  { ate: 3_751.05, aliquota: 0.150, deduzir: 394.16 },
  { ate: 4_664.68, aliquota: 0.225, deduzir: 675.49 },
  { ate: Infinity, aliquota: 0.275, deduzir: 908.73 },
]

/**
 * Redutor da Lei 15.270/2025: rendimento mensal até R$ 5.000 fica ISENTO; entre 5.000,01 e
 * 7.350 a redução é `978,62 − 13,3145% × rendimento` (limitada ao próprio imposto); acima de
 * 7.350, tabela cheia. ⚠️ Fórmula do trecho parcial como publicada — confirme com o contador.
 */
export const REDUTOR_IRRF_2026: RedutorIrrf = {
  isentoAte: 5_000,
  parcialAte: 7_350,
  constante: 978.62,
  coeficiente: 0.133145,
}

export const COMPETENCIA_TABELAS_2026 = '2026-01'

/** Encargos do empregador sobre a folha, em %. RAT padrão 1 até o contador informar o FAP. */
export const ENCARGOS_PADRAO = { inssPatronalPct: 20, ratPct: 1, sistemaSPct: 5.8 } as const

/** Tudo que a tela precisa gravar para "usar as tabelas de 2026". */
export const TABELAS_2026: Pick<CLTSettings, 'tabelaInss' | 'tabelaIrrf' | 'tabelasVigenciaEm' | 'irrfRedutor' | 'irrfDeducaoPorDependente'> = {
  tabelaInss: TABELA_INSS_2026,
  tabelaIrrf: TABELA_IRRF_2026,
  tabelasVigenciaEm: COMPETENCIA_TABELAS_2026,
  irrfRedutor: REDUTOR_IRRF_2026,
  irrfDeducaoPorDependente: IRRF_DEDUCAO_DEPENDENTE_PADRAO,
}

/**
 * INSS progressivo do trabalhador — COM TETO.
 *
 * O que estava errado: depois de percorrer as faixas, o código somava 14% sobre tudo que
 * passasse do último degrau. Isso inverte a regra. O INSS do empregado tem **teto**: acima da
 * última faixa não se contribui mais. Um salário de R$ 20.000 descontava R$ 2.618,82 quando o
 * máximo da tabela em uso é R$ 908,86 — R$ 1.709,96 a mais, todo mês, no bolso de quem recebe.
 *
 * O laço abaixo já produz o teto sozinho: `Math.min(bruto, faixa.ate)` para de crescer quando o
 * bruto ultrapassa a última faixa. Não existe nada a somar depois dele.
 */
export function calcINSS(grossSalary: number, tabela: FaixaTributaria[] = TABELA_INSS_PADRAO): number {
  const gross = clamp(grossSalary, 0, 1_000_000)
  let inss = 0
  let prev = 0

  for (const faixa of tabela) {
    if (gross <= prev) break
    inss += (Math.min(gross, faixa.ate) - prev) * faixa.aliquota
    prev = faixa.ate
  }

  return r2(inss)
}

/** O maior desconto possível de INSS na tabela — o "teto". Útil para conferência e para a tela. */
export function tetoINSS(tabela: FaixaTributaria[] = TABELA_INSS_PADRAO): number {
  return calcINSS(Number.MAX_SAFE_INTEGER, tabela)
}

/**
 * IRRF sobre o bruto já descontado o INSS, com dedução por dependente.
 *
 * A dedução por dependente existia só no comentário ("not applied here — simplified"). Como o
 * valor calculado aqui é exibido como "Salário Líquido" e a folha é usada para pagar gente,
 * ignorar dependente é cobrar imposto a mais de quem tem filho.
 */
export function calcIRRF(
  grossAfterINSS: number,
  tabela: FaixaTributaria[] = TABELA_IRRF_PADRAO,
  dependentes = 0,
  deducaoPorDependente = IRRF_DEDUCAO_DEPENDENTE_PADRAO,
): number {
  const base = clamp(grossAfterINSS - Math.max(0, dependentes) * deducaoPorDependente, 0, 1_000_000)

  for (const faixa of tabela) {
    if (base <= faixa.ate) return r2(Math.max(0, base * faixa.aliquota - (faixa.deduzir ?? 0)))
  }
  return 0
}

/**
 * O desconto do redutor (Lei 15.270/2025) sobre um imposto já calculado.
 *
 * ⚠️ O redutor olha o RENDIMENTO BRUTO mensal, não a base após INSS: é assim que a lei define
 * quem é isento. Devolve quanto ABATER do imposto — nunca mais que o próprio imposto.
 */
export function reducaoDoIRRF(imposto: number, rendimentoBruto: number, redutor?: RedutorIrrf): number {
  if (!redutor || imposto <= 0) return 0
  const r = clamp(rendimentoBruto, 0, 1_000_000)
  if (r <= redutor.isentoAte) return r2(imposto)
  if (r > redutor.parcialAte) return 0
  const reducao = redutor.constante - redutor.coeficiente * r
  return r2(clamp(reducao, 0, imposto))
}

/** FGTS employer contribution: 8% of gross */
export function calcFGTS(gross: number): number {
  return r2(clamp(gross, 0, 1_000_000) * 0.08)
}

/** Employer INSS (simplified / MEI regime): 20% of gross */
export function calcEmployerINSS(gross: number): number {
  return r2(clamp(gross, 0, 1_000_000) * 0.20)
}

/**
 * Encargos do empregador sobre o bruto — o que a empresa paga ALÉM do salário e do FGTS.
 *
 * Patronal 20% + RAT×FAP + Sistema S. Na CPRB (desoneração) os 20% patronais saem — a empresa
 * recolhe sobre a receita, fora desta conta — mas RAT e terceiros continuam. ⚠️ Ligar a CPRB é
 * decisão contábil; aqui só se obedece ao campo.
 */
export function calcEncargosPatronais(gross: number, settings?: Pick<CLTSettings, 'ratPct' | 'sistemaSPct' | 'regimeCprb'>): number {
  const g = clamp(gross, 0, 1_000_000)
  const patronal = settings?.regimeCprb ? 0 : ENCARGOS_PADRAO.inssPatronalPct
  const rat = clamp(settings?.ratPct ?? ENCARGOS_PADRAO.ratPct, 0, 10)
  const terceiros = clamp(settings?.sistemaSPct ?? ENCARGOS_PADRAO.sistemaSPct, 0, 20)
  return r2(g * (patronal + rat + terceiros) / 100)
}

// ─── Payslip generator ────────────────────────────────────────────────────────

function getMonthShifts(shifts: Shift[], workerId: string, month: string): Shift[] {
  return shifts.filter(
    (s) => s.workerId === workerId && s.date.startsWith(month),
  )
}

/**
 * Turno que NÃO é pago: folga, feriado, cancelado — e **falta**.
 *
 * `status === 'absent'` era ignorado pelos dois motores, embora a Escala ofereça "Ausente" e o
 * calendário pinte "Falta". Quatro faltas num mês de 22 turnos pagavam R$ 800 de dia não
 * trabalhado, e ainda cobravam quatro dias a mais de vale-alimentação.
 */
function turnoNaoPago(s: Shift): boolean {
  return s.type === 'day_off' || s.type === 'holiday' || s.status === 'absent' || s.status === 'cancelled'
}

function countWorkingDays(shifts: Shift[]): number {
  return shifts.filter((s) => !turnoNaoPago(s)).length
}

/** Domingos do mês `yyyy-MM` — a base de repouso do DSR. */
function domingosNoMes(month: string): number {
  const [ano, mes] = month.split('-').map(Number)
  if (!ano || !mes) return 4
  const ultimoDia = new Date(ano, mes, 0).getDate()
  let n = 0
  for (let d = 1; d <= ultimoDia; d++) if (new Date(ano, mes - 1, d).getDay() === 0) n++
  return n
}

/** Dias úteis do mês (segunda a sábado), denominador legal do DSR. */
function diasUteisNoMes(month: string): number {
  const [ano, mes] = month.split('-').map(Number)
  if (!ano || !mes) return 26
  const ultimoDia = new Date(ano, mes, 0).getDate()
  let n = 0
  for (let d = 1; d <= ultimoDia; d++) if (new Date(ano, mes - 1, d).getDay() !== 0) n++
  return n
}

export function generatePayslip(
  worker: Worker,
  allShifts: Shift[],
  settings: CLTSettings,
  month: string,
): WorkerPayslip {
  if (worker.status !== 'active') {
    // Return a zeroed payslip for inactive workers
    return {
      id: crypto.randomUUID(),
      workerId: worker.id,
      month,
      baseSalary: 0,
      allowances: [],
      deductions: [],
      grossTotal: 0,
      netTotal: 0,
      employerCost: 0,
      hoursWorked: 0,
      overtimeHours: 0,
      nightHours: 0,
      workingDays: 0,
      absentDays: 0,
      descontosExcedemBruto: false,
      generatedAt: new Date().toISOString(),
    }
  }

  const monthShifts = getMonthShifts(allShifts, worker.id, month)
  const rate = clamp(worker.hourlyRate ?? 0, 0, 10_000)

  let regularMinutes  = 0
  let overtimeMinutes = 0
  let nightMinutes    = 0

  for (const shift of monthShifts) {
    // Falta e turno cancelado não geram pagamento — ver `turnoNaoPago`.
    if (turnoNaoPago(shift)) continue

    const worked = calcShiftMinutes(shift)
    const normalMaxMin = settings.maxDailyHours * 60

    // HORA EXTRA POR DURAÇÃO, não pelo rótulo do turno.
    //
    // Antes, só desmembrava HE quando alguém marcasse o turno como `type: 'overtime'`. Um turno
    // "regular" de 10 horas era pago inteiro como hora normal. Nos mesmos dados, esta tela dizia
    // R$ 4.400 e o CMO dizia R$ 5.320 — e o validador de CLT ainda acusava excesso de jornada
    // nesses turnos, ou seja, o sistema apontava a hora extra e não a pagava. Agora as duas
    // telas usam o mesmo critério, que é o de `projectMonthlyCost` no cltEngine.
    const extraMin = Math.max(0, worked - normalMaxMin)
    regularMinutes  += worked - extraMin
    overtimeMinutes += extraMin

    nightMinutes += calcNightMinutes(shift, settings)
  }

  const regularHours  = r2(regularMinutes  / 60)
  const overtimeHours = r2(overtimeMinutes / 60)
  // Hora noturna reduzida: 52min30s valem uma hora (art. 73 §1º). Dividir por 60 pagava a menos.
  //
  // PONTO DE INTERPRETAÇÃO, e é deliberado: a redução é aplicada ao ADICIONAL noturno, não à
  // jornada. `regularMinutes` continua contando minutos de relógio, então a hora base não é
  // recontada. É a leitura mais conservadora — a alternativa (reduzir também a jornada) aumenta
  // o bruto e muda a base de INSS/FGTS. Se o acordo coletivo da empresa disser o contrário, é
  // aqui que se mexe.
  const nightHours    = r2(nightMinutes / 52.5)
  const workingDays   = countWorkingDays(monthShifts)

  // ── Base salary ──────────────────────────────────────────────────────────────
  const baseSalary = r2(regularHours * rate)

  // ── Allowances ───────────────────────────────────────────────────────────────
  const allowances: PayslipAllowance[] = []

  // Overtime
  if (overtimeHours > 0) {
    const otRate   = 1 + (settings.overtimeRate / 100)
    const otAmount = r2(overtimeHours * rate * otRate)
    allowances.push({ type: 'overtime', description: `HE (${settings.overtimeRate}%)`, amount: otAmount })
  }

  // Night differential
  if (nightHours > 0) {
    const ndAmount = r2(nightHours * rate * (settings.nightDifferential / 100))
    allowances.push({ type: 'night_diff', description: `Adicional Noturno (${settings.nightDifferential}%)`, amount: ndAmount })
  }

  // DSR sobre horas extras.
  //
  // A fórmula anterior era `(horasExtras / 6) × valorHora × 1`. O comentário falava em "horas
  // extras da semana", a variável era do mês inteiro, e o multiplicador era a constante 1 — não
  // fechava dimensionalmente. Pagava R$ 40 onde o correto eram R$ 69,23.
  //
  // A regra: (valor total das horas extras no mês ÷ dias úteis) × dias de repouso. O "valor" é o
  // valor JÁ COM O ADICIONAL, que a fórmula antiga também perdia.
  //
  // Nota de escopo: feriados não entram nos dias de repouso porque o sistema não tem calendário
  // de feriados. Isso subestima o DSR em meses com feriado — está anotado na tela.
  const valorHorasExtras = overtimeHours * rate * (1 + settings.overtimeRate / 100)
  const diasUteis = diasUteisNoMes(month)
  const diasRepouso = domingosNoMes(month)
  const dsrAmount = r2(diasUteis > 0 ? (valorHorasExtras / diasUteis) * diasRepouso : 0)
  if (dsrAmount > 0) {
    allowances.push({ type: 'dsr', description: `DSR s/ HE (${diasRepouso} domingos ÷ ${diasUteis} dias úteis)`, amount: dsrAmount })
  }

  const grossTotal = r2(
    baseSalary + allowances.reduce((s, a) => s + a.amount, 0),
  )

  // ── Deductions ────────────────────────────────────────────────────────────────
  const deductions: PayslipDeduction[] = []

  // INSS — tabela da organização (ou o padrão), agora COM TETO.
  const inssAmount = calcINSS(grossTotal, settings.tabelaInss ?? TABELA_INSS_PADRAO)
  if (inssAmount > 0) {
    deductions.push({ type: 'inss', description: 'INSS (trabalhador)', amount: inssAmount, workerPays: true })
  }

  // IRRF sobre o bruto menos INSS, com dedução por dependente.
  const irrfBase   = Math.max(0, grossTotal - inssAmount)
  const irrfCheio = calcIRRF(
    irrfBase,
    settings.tabelaIrrf ?? TABELA_IRRF_PADRAO,
    worker.dependentesIRRF ?? 0,
    settings.irrfDeducaoPorDependente ?? IRRF_DEDUCAO_DEPENDENTE_PADRAO,
  )
  // Lei 15.270/2025: quem ganha até 5.000 fica isento; até 7.350, desconto parcial. Só existe
  // quando a organização configurou o redutor (tabelas de 2026 em diante).
  const reducao = reducaoDoIRRF(irrfCheio, grossTotal, settings.irrfRedutor)
  const irrfAmount = r2(irrfCheio - reducao)
  if (irrfAmount > 0) {
    const comDep = (worker.dependentesIRRF ?? 0) > 0 ? ` · ${worker.dependentesIRRF} dep.` : ''
    const comRed = reducao > 0 ? ` · redutor −${reducao.toFixed(2)}` : ''
    deductions.push({ type: 'irrf', description: `IRRF${comDep}${comRed}`, amount: irrfAmount, workerPays: true })
  }

  // VALE-TRANSPORTE — só para quem optou, com o teto legal de 6%.
  // Antes descontava de todo mundo, sem cadastro. O VT é opção do trabalhador: quem não pede,
  // não recebe e não paga.
  const vtPct = Math.min(settings.vtDescontoPct ?? 6, 6) / 100
  const vtWorker = worker.recebeVT ? r2(Math.min(baseSalary * vtPct, baseSalary)) : 0
  if (vtWorker > 0) {
    deductions.push({ type: 'vt', description: `Vale-Transporte (${(vtPct * 100).toFixed(0)}%)`, amount: vtWorker, workerPays: true })
  }

  // VALE-ALIMENTAÇÃO — coparticipação sobre o valor de face, não o valor cheio.
  // Antes: `workingDays × 35` descontado inteiro de todos, com o comentário dizendo que a
  // empresa absorvia o resto. O benefício virava zero, e num salário baixo o líquido ficava
  // abaixo do mínimo. A lei limita a coparticipação a 20% do valor do benefício.
  const vaDia = Math.max(0, settings.vaValorDia ?? 0)
  const vaCoparticipacao = Math.min(Math.max(settings.vaCoparticipacaoPct ?? 20, 0), 20) / 100
  const vaWorker = worker.recebeVA && vaDia > 0 && workingDays > 0
    ? r2(workingDays * vaDia * vaCoparticipacao)
    : 0
  if (vaWorker > 0) {
    deductions.push({ type: 'va', description: `Vale-Alimentação (${(vaCoparticipacao * 100).toFixed(0)}% de ${workingDays}×${vaDia.toFixed(2)})`, amount: vaWorker, workerPays: true })
  }

  // FGTS (employer only — shown on payslip for transparency but worker doesn't pay)
  const fgtsAmount = calcFGTS(grossTotal)
  deductions.push({ type: 'fgts', description: 'FGTS (empregador 8%)', amount: fgtsAmount, workerPays: false })

  const workerDeductions = deductions
    .filter((d) => d.workerPays)
    .reduce((s, d) => s + d.amount, 0)

  // Sem piso, o holerite exibia líquido NEGATIVO quando os descontos passavam do bruto (era o
  // caso com o VA de R$ 35/dia num salário baixo). Manter o número negativo escondia o problema
  // num campo chamado "Salário Líquido"; zerar sem dizer nada também. O valor é limitado a zero
  // e a flag `descontosExcedemBruto` deixa a tela avisar.
  const netBruto = r2(grossTotal - workerDeductions)
  const netTotal = Math.max(0, netBruto)
  const employerCost = r2(grossTotal + fgtsAmount + calcEncargosPatronais(grossTotal, settings))

  return {
    id:           crypto.randomUUID(),
    workerId:     worker.id,
    month,
    baseSalary,
    allowances,
    deductions,
    grossTotal,
    netTotal,
    employerCost,
    hoursWorked:  regularHours + overtimeHours,
    overtimeHours,
    nightHours,
    workingDays,
    absentDays:   monthShifts.filter((sh) => sh.status === 'absent').length,
    descontosExcedemBruto: netBruto < 0,
    generatedAt:  new Date().toISOString(),
  }
}

export function generateMonthPayroll(
  workers: Worker[],
  shifts: Shift[],
  settings: CLTSettings,
  month: string,
): PayrollMonth {
  const active   = workers.filter((w) => w.status === 'active')
  const payslips = active.map((w) => generatePayslip(w, shifts, settings, month))

  return {
    month,
    payslips,
    totalGross:       r2(payslips.reduce((s, p) => s + p.grossTotal,      0)),
    totalNet:         r2(payslips.reduce((s, p) => s + p.netTotal,        0)),
    totalEmployerCost:r2(payslips.reduce((s, p) => s + p.employerCost,    0)),
    headcount:        payslips.length,
  }
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

/** Sanitizes a cell value for CSV — prevents formula injection, escapes quotes */
function csvCell(value: string | number): string {
  const str = String(value)
  // Prevent formula injection: prefix with apostrophe if starts with =, +, -, @
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str
  // Escape double quotes
  const escaped = safe.replace(/"/g, '""')
  return `"${escaped}"`
}

export function payrollToCSV(payroll: PayrollMonth, workerNames: Record<string, string>): string {
  const headers = [
    'Matrícula/ID', 'Colaborador', 'H. Trabalhadas', 'H. Extras', 'H. Noturnas',
    'Dias Úteis', 'Base Bruto', 'Total Adicionais', 'Total Descontos (trabalhador)',
    'Salário Líquido', 'FGTS (empregador)', 'Custo Total Empresa',
  ]

  const rows = payroll.payslips.map((p) => {
    const name       = workerNames[p.workerId] ?? p.workerId
    const allowSum   = r2(p.allowances.reduce((s, a) => s + a.amount, 0))
    const workerDed  = r2(p.deductions.filter((d) => d.workerPays).reduce((s, d) => s + d.amount, 0))
    const fgts       = p.deductions.find((d) => d.type === 'fgts')?.amount ?? 0
    return [
      p.workerId, name, p.hoursWorked, p.overtimeHours, p.nightHours,
      p.workingDays, p.baseSalary, allowSum, workerDed,
      p.netTotal, fgts, p.employerCost,
    ].map(csvCell).join(',')
  })

  return [headers.map(csvCell).join(','), ...rows].join('\n')
}
