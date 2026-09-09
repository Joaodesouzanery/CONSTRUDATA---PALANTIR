import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Printer } from 'lucide-react'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import type { WorkerPayslip } from '@/types'
import { payrollToCSV, COMPETENCIA_TABELAS_PADRAO, COMPETENCIA_TABELAS_2026, TABELAS_2026, ENCARGOS_PADRAO, tetoINSS } from '@/features/mao-de-obra/utils/payrollEngine'
import { reconciliarFolhas, reconciliacaoParaCSV } from '@/features/mao-de-obra/utils/reconciliacaoFolha'
import { conferirDiasDeRdo, turnosQueFaltam } from '@/features/mao-de-obra/utils/diasDeRdoNaFolha'
import { hojeLocalISO } from '@/lib/utils'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { conferirHorasExtras } from '@/features/mao-de-obra/utils/conferenciaHorasExtras'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function downloadCSV(content: string, filename: string) {
  const bom  = '\uFEFF'
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Payslip expanded view ────────────────────────────────────────────────────

function PayslipExpanded({ payslip }: { payslip: WorkerPayslip }) {
  return (
    <tr className="bg-[var(--color-surface)]">
      <td colSpan={9} className="px-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Allowances */}
          <div>
            <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase mb-2">Proventos</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Salário Base ({payslip.hoursWorked - payslip.overtimeHours}h)</span>
                <span className="text-[var(--color-text-primary)] font-medium">{fmt(payslip.baseSalary)}</span>
              </div>
              {payslip.allowances.map((a, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">{a.description}</span>
                  <span className="text-[#4ade80] font-medium">+ {fmt(a.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-[var(--color-border)] pt-1.5 mt-1.5">
                <span className="text-[var(--color-text-primary)]">Total Bruto</span>
                <span className="text-[var(--color-text-primary)]">{fmt(payslip.grossTotal)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase mb-2">Deduções</p>
            <div className="space-y-1.5">
              {payslip.deductions.map((d, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className={`${d.workerPays ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)] italic'}`}>
                    {d.description}{!d.workerPays ? ' (empregador)' : ''}
                  </span>
                  <span className={`font-medium ${d.workerPays ? 'text-[#fca5a5]' : 'text-[var(--color-text-muted)]'}`}>
                    {d.workerPays ? '- ' : ''}{fmt(d.amount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-[var(--color-border)] pt-1.5 mt-1.5">
                <span className="text-[var(--color-text-primary)]">Salário Líquido</span>
                <span className="text-[#4ade80]">{fmt(payslip.netTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-[var(--color-border)]">
          {[
            { label: 'Dias Úteis',    value: payslip.workingDays },
            { label: 'H. Regulares', value: `${(payslip.hoursWorked - payslip.overtimeHours).toFixed(1)}h` },
            { label: 'H. Extras',    value: `${payslip.overtimeHours.toFixed(1)}h` },
            { label: 'H. Noturnas',  value: `${payslip.nightHours.toFixed(1)}h` },
            { label: 'Custo Empresa', value: fmt(payslip.employerCost) },
          ].map(item => (
            <div key={item.label} className="flex flex-col">
              <span className="text-xs text-[var(--color-text-muted)]">{item.label}</span>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{item.value}</span>
            </div>
          ))}
        </div>
      </td>
    </tr>
  )
}

// ─── HE paga (Caixa) × CLT teórico ────────────────────────────────────────────
//
// ALERTA, nunca correção. O Caixa traz valor por pessoa e dia, sem horas; a CLT dá a hora extra
// (salário ÷ 220 × 1,5 ou 2,0). O que dá para mostrar é quantas horas o valor pago compraria e
// quanto isso desvia de 2h/dia — o limite legal. Ver `conferenciaHorasExtras.ts`.

function HorasExtrasContraClt({ workers, maxOvertimeHours }: { workers: import('@/types').Worker[]; maxOvertimeHours: number }) {
  const entries = useFinanceiroStore((s) => s.entries)
  const holidays = usePlanejamentoStore((s) => s.holidays)
  const [aberto, setAberto] = useState(false)
  const conf = useMemo(
    () => conferirHorasExtras(entries, workers, holidays.map((h) => h.date), { maxOvertimeHours }),
    [entries, workers, holidays, maxOvertimeHours],
  )
  if (conf.linhas.length === 0 && conf.pendencias.length === 0) return null

  const tom = (d: number) => Math.abs(d) > 0.3 ? 'text-[#fbbf24]' : 'text-[var(--color-text-primary)]'
  const pct = (d: number) => `${d > 0 ? '+' : ''}${(d * 100).toFixed(0)}%`
  const fmtComp = (c: string) => `${c.slice(5, 7)}/${c.slice(0, 4)}`

  return (
    <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-[var(--color-text-primary)]">Horas extras pagas pelo Caixa × CLT teórico</p>
          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
            {fmt(conf.totalConferido)} conferidos de {fmt(conf.totalPago)} pagos
            {conf.pendencias.length > 0 && <> · <span className="text-[#fbbf24]">{conf.pendencias.length} nome(s) sem conferência</span></>}
          </p>
        </div>
        <button type="button" onClick={() => setAberto((v) => !v)}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[#ffa055]">
          {aberto ? 'Ocultar' : 'Ver detalhe'}
        </button>
      </div>

      {aberto && (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
                  <th className="px-2 py-1.5">Competência</th><th className="px-2 py-1.5">Funcionário</th>
                  <th className="px-2 py-1.5 text-right">Lançtos</th><th className="px-2 py-1.5 text-right">Pago</th>
                  <th className="px-2 py-1.5 text-right">HE CLT/h</th><th className="px-2 py-1.5 text-right">Horas implícitas</th>
                  <th className="px-2 py-1.5 text-right">Ref. {maxOvertimeHours}h/dia</th><th className="px-2 py-1.5 text-right">Desvio</th>
                </tr>
              </thead>
              <tbody>
                {conf.linhas.map((l) => (
                  <tr key={`${l.workerId}|${l.competencia}`} className="border-b border-[var(--color-border)]/60">
                    <td className="px-2 py-1.5 font-mono">{fmtComp(l.competencia)}</td>
                    <td className="px-2 py-1.5 text-[var(--color-text-primary)]">
                      {l.workerName}
                      {l.casamento === 'provavel' && <span className="ml-1 rounded bg-[#fbbf24]/15 px-1 text-[10px] text-[#fbbf24]">casamento provável — confirme</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right">{l.lancamentos}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{fmt(l.pago)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{fmt(l.horaClt)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{l.horasImplicitas.toFixed(1)} h</td>
                    <td className="px-2 py-1.5 text-right font-mono">{fmt(l.referencia)}</td>
                    <td className={`px-2 py-1.5 text-right font-mono font-semibold ${l.casamento === 'provavel' ? 'text-[var(--color-text-muted)]' : tom(l.desvio)}`}>{pct(l.desvio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {conf.pendencias.length > 0 && (
            <ul className="mt-3 space-y-1 text-[11px] text-[#fbbf24]">
              {conf.pendencias.map((p) => (
                <li key={p.nome}>
                  {p.motivo === 'ambiguo' && <>{p.candidatos?.length} candidatos para "{p.nome}" ({p.candidatos?.join(', ')}) — resolva no cadastro</>}
                  {p.motivo === 'sem-cadastro' && <>"{p.nome}" não está entre os funcionários ativos</>}
                  {p.motivo === 'sem-salario' && <>"{p.nome}" está sem salário bruto no cadastro</>}
                  {' · '}{p.lancamentos} lançamento(s), {fmt(p.pago)}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[11px] leading-5 text-[var(--color-text-muted)]">
            Isto é alerta, não correção. A hora CLT é salário ÷ 220 × 1,5 (2,0 em domingo e feriado do
            Planejamento); o Caixa não traz horas, então o desvio compara o pago com o que {maxOvertimeHours}h/dia
            valeriam nos dias lançados — acima de ±30% fica amarelo. Homônimo não entra na conta.
            <strong className="text-[var(--color-text-secondary)]"> Pergunta para o contador:</strong> a diária paga pelo
            Caixa é complemento sobre HE que já está na folha, ou é o pagamento inteiro da hora extra?
          </p>
        </>
      )}
    </div>
  )
}

// ─── Tabelas fiscais e encargos ───────────────────────────────────────────────
//
// As tabelas eram "editáveis por organização" só no comentário do tipo: nenhuma tela gravava
// `tabelaInss`. Este bloco é a porta. Um botão aplica as de 2026 (datadas), e os três encargos
// que variam por empresa ficam à mão — com o aviso de que quem decide é o contador.

function TabelasEEncargos({ cltSettings, onSalvar }: {
  cltSettings: import('@/types').CLTSettings
  onSalvar: (patch: Partial<import('@/types').CLTSettings>) => void
}) {
  const vigencia = cltSettings.tabelasVigenciaEm ?? COMPETENCIA_TABELAS_PADRAO
  const em2026 = vigencia >= COMPETENCIA_TABELAS_2026
  const campo = 'w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-right text-xs text-[var(--color-text-primary)] outline-none focus:border-[#f97316]'
  // ⚠️ Campo VAZIO é "não informado", não zero. `Number('')` é 0 — finito e >= 0 — então a
  // versão anterior gravava RAT 0% quando alguém apagava o "1" para digitar "1,5" e era
  // interrompido: o rótulo virava "informado", o campo continuava vazio e o custo-empregador
  // caía 1% em silêncio.
  const num = (chave: 'ratPct' | 'sistemaSPct', padrao: number) => (e: React.FocusEvent<HTMLInputElement>) => {
    const bruto = String(e.target.value).trim()
    if (!bruto) { onSalvar({ [chave]: undefined }); e.target.value = String(padrao); return }
    const v = Number(bruto.replace(',', '.'))
    onSalvar({ [chave]: Number.isFinite(v) && v >= 0 ? v : padrao })
  }
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-[var(--color-text-primary)]">Tabelas fiscais e encargos</p>
        {!em2026 && (
          <button type="button" onClick={() => onSalvar(TABELAS_2026)}
                  className="rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#ea580c]">
            Usar tabelas de 2026
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-5 text-[var(--color-text-muted)]">
        Vigência <strong className="text-[var(--color-text-primary)]">{vigencia}</strong>
        {' · '}INSS até {fmt(tetoINSS(cltSettings.tabelaInss))} de desconto
        {cltSettings.irrfRedutor
          ? <> · IRRF com redutor (isento até {fmt(cltSettings.irrfRedutor.isentoAte)}, parcial até {fmt(cltSettings.irrfRedutor.parcialAte)})</>
          : <> · IRRF sem o redutor de 2026</>}
      </p>
      {em2026 && (
        <p className="mt-1 text-[11px] text-[#fbbf24]">
          ⚠️ Tabelas de 2026 — entraram como foram informadas. Confira com o contador antes de fechar a folha.
        </p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-text-secondary)]">
          <span>RAT × FAP (%)<br /><span className="text-[10px] text-[var(--color-text-muted)]">{cltSettings.ratPct == null ? 'padrão — confirme com o contador' : 'informado'}</span></span>
          <input type="number" step="0.01" min={0} className={campo} defaultValue={cltSettings.ratPct ?? ENCARGOS_PADRAO.ratPct} onBlur={num('ratPct', ENCARGOS_PADRAO.ratPct)} />
        </label>
        <label className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-text-secondary)]">
          <span>Sistema S / terceiros (%)<br /><span className="text-[10px] text-[var(--color-text-muted)]">SESI, SENAI, SEBRAE, INCRA, sal.-educação</span></span>
          <input type="number" step="0.01" min={0} className={campo} defaultValue={cltSettings.sistemaSPct ?? ENCARGOS_PADRAO.sistemaSPct} onBlur={num('sistemaSPct', ENCARGOS_PADRAO.sistemaSPct)} />
        </label>
        <label className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-text-secondary)]">
          <span>CPRB (desoneração)<br /><span className="text-[10px] text-[var(--color-text-muted)]">tira os 20% patronais; recolhe sobre a receita</span></span>
          <input type="checkbox" className="h-4 w-4 accent-[#f97316]" checked={cltSettings.regimeCprb ?? false} onChange={(e) => onSalvar({ regimeCprb: e.target.checked })} />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
        Custo-empregador = bruto + FGTS 8% + {cltSettings.regimeCprb ? '0' : ENCARGOS_PADRAO.inssPatronalPct}% patronal + RAT + terceiros. Ligar a CPRB é decisão contábil, não do sistema.
      </p>
    </div>
  )
}

// ─── FolhaPagamentoPanel ──────────────────────────────────────────────────────

export function FolhaPagamentoPanel() {
  const { workers, payrollHistory, generatePayroll, cltSettings, updateCLTSettings, shifts, timecards, addShift } = useMaoDeObraStore(
    useShallow(s => ({
      workers:         s.workers,
      payrollHistory:  s.payrollHistory,
      generatePayroll: s.generatePayroll,
      cltSettings:     s.cltSettings,
      updateCLTSettings: s.updateCLTSettings,
      shifts:          s.shifts,
      timecards:       s.timecards,
      addShift:        s.addShift,
    }))
  )
  const [verReconciliacao, setVerReconciliacao] = useState(false)

  // Compara cada holerite já emitido com o recálculo do motor corrigido. Roda sobre o histórico
  // inteiro, mas ele é pequeno (uma entrada por mês fechado) e só recalcula quando algo muda.
  const reconciliacao = useMemo(
    () => reconciliarFolhas(payrollHistory, workers, shifts, cltSettings),
    [payrollHistory, workers, shifts, cltSettings],
  )

  // Tabela fiscal com mais de 12 meses é tabela provavelmente vencida. Como o valor é editável
  // por organização, o aviso é o que impede que ela envelheça sem ninguém notar de novo.
  const tabelasDesatualizadas = useMemo(() => {
    const comp = cltSettings.tabelasVigenciaEm ?? COMPETENCIA_TABELAS_PADRAO
    const [ano, mes] = comp.split('-').map(Number)
    if (!ano || !mes) return true
    const meses = (new Date().getFullYear() - ano) * 12 + (new Date().getMonth() + 1 - mes)
    return meses > 12
  }, [cltSettings.tabelasVigenciaEm])

  const now = new Date()
  const [yearMonth, setYearMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  /**
   * Dias comprovados por RDO que a Escala não registrou.
   *
   * A folha lê `shifts` e ignora os apontamentos vindos do RDO — um dia com RDO finalizado, o
   * funcionário na lista de efetivo e as horas rateadas não pagava nada. Isto MOSTRA a diferença;
   * nada muda de valor até a pessoa clicar. Mexer em folha sem avisar seria inaceitável.
   */
  const conferenciaRdo = useMemo(
    () => conferirDiasDeRdo(workers, shifts, timecards, yearMonth, cltSettings),
    [workers, shifts, timecards, yearMonth, cltSettings],
  )

  function aplicarDiasDeRdo() {
    const turnos = turnosQueFaltam(conferenciaRdo)
    if (turnos.length === 0) return
    if (!window.confirm(
      `Lançar ${turnos.length} turno(s) na Escala, para ${conferenciaRdo.pessoas} funcionário(s)?\n\n`
      + `Isso muda a folha de ${monthLabel} em aproximadamente ${fmt(conferenciaRdo.diferencaBRL)}.\n\n`
      + 'Os turnos passam a existir na aba Escala e você pode conferir ou apagar por lá. '
      + 'Depois, gere a folha de novo.',
    )) return
    // `addShift` recebe o turno sem id — o store gera o dele.
    for (const t of turnos) {
      addShift({
        workerId: t.workerId, date: t.date, startTime: t.startTime, endTime: t.endTime,
        breakMinutes: t.breakMinutes, type: t.type, status: t.status,
      })
    }
  }

  const currentPayroll = payrollHistory.find(p => p.month === yearMonth)

  const monthLabel = new Date(yearMonth + '-15').toLocaleDateString('pt-BR', {
    month: 'long', year: 'numeric',
  })

  function prevMonth() {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  function nextMonth() {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleExportReconciliacao() {
    downloadCSV(reconciliacaoParaCSV(reconciliacao), `reconciliacao-folha-${hojeLocalISO()}.csv`)
  }

  function handleExportCSV() {
    if (!currentPayroll) return
    const nameMap: Record<string, string> = {}
    workers.forEach(w => { nameMap[w.id] = w.name })
    const csv = payrollToCSV(currentPayroll, nameMap)
    downloadCSV(csv, `folha-${yearMonth}.csv`)
  }

  // Worker name map for payslip lookup
  const workerNames = useMemo(() => {
    const m: Record<string, string> = {}
    workers.forEach(w => { m[w.id] = w.name })
    return m
  }, [workers])

  const workerRoles = useMemo(() => {
    const m: Record<string, string> = {}
    workers.forEach(w => { m[w.id] = w.role })
    return m
  }, [workers])

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors text-lg">
            ‹
          </button>
          <span className="min-w-[160px] text-center text-sm font-semibold text-[var(--color-text-primary)] capitalize">
            {monthLabel}
          </span>
          <button onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors text-lg">
            ›
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => generatePayroll(yearMonth)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
            Gerar Folha
          </button>
          {currentPayroll && (
            <>
              <button onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors">
                Exportar CSV
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors">
                <Printer size={14} /> PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* A conferência aparece ANTES da folha: é ela que decide se os números abaixo estão
          completos. Some sozinha quando não há divergência. */}
      {conferenciaRdo.dias.length > 0 && (
        <div className="mb-4 rounded-xl border border-[#eab308]/40 bg-[#eab308]/10 p-4">
          <p className="text-sm font-bold text-[#fbbf24]">
            {conferenciaRdo.dias.length} dia(s) com RDO não estão na Escala
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#e5e5e5]">
            O RDO foi finalizado, {conferenciaRdo.pessoas === 1 ? 'a pessoa estava' : 'as pessoas estavam'} na
            lista de efetivo e as horas foram rateadas — mas a folha lê a <b>Escala</b>, e esses dias
            não têm turno lançado. Do jeito que está, <b>eles não são pagos</b>.
            Diferença estimada: <b>{fmt(conferenciaRdo.diferencaBRL)}</b>.
          </p>
          <ul className="mt-2 flex flex-col gap-0.5">
            {conferenciaRdo.porFuncionario.slice(0, 6).map((f) => (
              <li key={f.workerId} className="text-[13px] text-[#c9c9c9]">
                {f.workerName} — {f.dias} dia(s) · {fmt(f.valorBRL)}
              </li>
            ))}
            {conferenciaRdo.porFuncionario.length > 6 && (
              <li className="text-[13px] text-[#adadad]">e mais {conferenciaRdo.porFuncionario.length - 6}…</li>
            )}
          </ul>
          <button onClick={aplicarDiasDeRdo}
            className="mt-3 rounded-lg bg-[#eab308]/25 px-3 py-1.5 text-[13px] font-semibold text-[#fde047] hover:bg-[#eab308]/40">
            Lançar esses turnos na Escala
          </button>
        </div>
      )}

      {!currentPayroll ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-[var(--color-border)]">
          <p className="text-[var(--color-text-muted)] text-sm mb-4">
            Nenhuma folha gerada para {monthLabel}
          </p>
          <button onClick={() => generatePayroll(yearMonth)}
            className="px-5 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            Gerar Folha Agora
          </button>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Custo Total Empresa', value: fmt(currentPayroll.totalEmployerCost), color: 'text-[#fca5a5]' },
              { label: 'Total Líquido',        value: fmt(currentPayroll.totalNet),          color: 'text-[#4ade80]' },
              { label: 'Total Bruto',          value: fmt(currentPayroll.totalGross),        color: 'text-[var(--color-accent)]' },
              { label: 'Colaboradores',        value: currentPayroll.headcount,              color: 'text-[var(--color-text-primary)]' },
            ].map(card => (
              <div key={card.label}
                className="flex flex-col items-center py-3 px-2 rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
                <span className={`text-base font-bold ${card.color}`}>{card.value}</span>
                <span className="text-xs text-[var(--color-text-muted)] text-center mt-0.5">{card.label}</span>
              </div>
            ))}
          </div>

          {/* Payslip table */}
          <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                    {['', 'Colaborador', 'Cargo', 'H. Trab.', 'Base Bruto', 'Descontos', 'Líquido', 'Custo Empresa', ''].map((h, i) => (
                      <th key={i} className="text-left px-3 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentPayroll.payslips.map(payslip => {
                    const name     = workerNames[payslip.workerId] ?? payslip.workerId
                    const role     = workerRoles[payslip.workerId] ?? '—'
                    const expanded = expandedIds.has(payslip.id)
                    const workerDed = payslip.deductions
                      .filter(d => d.workerPays)
                      .reduce((s, d) => s + d.amount, 0)

                    return (
                      <>
                        <tr key={payslip.id}
                          className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
                          onClick={() => toggleExpand(payslip.id)}>
                          <td className="px-3 py-3 text-[var(--color-text-muted)] text-xs">
                            <span className="select-none">{expanded ? '▼' : '▶'}</span>
                          </td>
                          <td className="px-3 py-3 font-medium text-[var(--color-text-primary)] whitespace-nowrap">{name}</td>
                          <td className="px-3 py-3 text-[var(--color-text-secondary)] text-xs max-w-[120px] truncate">{role}</td>
                          <td className="px-3 py-3 text-[var(--color-text-secondary)]">{payslip.hoursWorked.toFixed(1)}h</td>
                          <td className="px-3 py-3 text-[var(--color-text-primary)]">{fmt(payslip.baseSalary)}</td>
                          <td className="px-3 py-3 text-[#fca5a5]">- {fmt(workerDed)}</td>
                          <td className="px-3 py-3 font-semibold text-[#4ade80]">{fmt(payslip.netTotal)}</td>
                          <td className="px-3 py-3 font-semibold text-[var(--color-text-primary)]">{fmt(payslip.employerCost)}</td>
                          <td className="px-3 py-3" />
                        </tr>
                        {expanded && <PayslipExpanded payslip={payslip} />}
                      </>
                    )
                  })}
                </tbody>
                <tfoot className="border-t-2 border-[var(--color-border)]">
                  <tr className="bg-[var(--color-surface)]">
                    <td colSpan={4} className="px-3 py-3 font-bold text-[var(--color-text-primary)]">Total</td>
                    <td className="px-3 py-3 font-bold text-[var(--color-text-primary)]">
                      {fmt(currentPayroll.payslips.reduce((s, p) => s + p.baseSalary, 0))}
                    </td>
                    <td className="px-3 py-3 font-bold text-[#fca5a5]">
                      - {fmt(currentPayroll.payslips.reduce((s, p) => s + p.deductions.filter(d => d.workerPays).reduce((a, d) => a + d.amount, 0), 0))}
                    </td>
                    <td className="px-3 py-3 font-bold text-[#4ade80]">{fmt(currentPayroll.totalNet)}</td>
                    <td className="px-3 py-3 font-bold text-[var(--color-text-primary)]">{fmt(currentPayroll.totalEmployerCost)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── Reconciliação das folhas já emitidas ──────────────────────────────────
              Os cálculos foram corrigidos numa folha que já pagou gente. Corrigir daqui para a
              frente é metade do trabalho — sem saber quem foi afetado e em quanto, não há como
              acertar. Este bloco só aparece quando existe diferença. ── */}
          {reconciliacao.itens.length > 0 && (
            <div className="rounded-lg border border-[#3b82f6]/40 bg-[#3b82f6]/[0.07] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#93c5fd]">
                    {reconciliacao.quantidadeAfetada} holerite(s) já emitido(s) mudam de valor com os cálculos corrigidos
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                    A receber pelos trabalhadores: <strong className="text-[#4ade80]">{fmt(reconciliacao.totalAReceber)}</strong>
                    {' · '}pago a mais: <strong className="text-[#fca5a5]">{fmt(reconciliacao.totalPagoAMais)}</strong>
                    {reconciliacao.quantidadeSemTurnos > 0 && (
                      <> · <span className="text-[#fbbf24]">{reconciliacao.quantidadeSemTurnos} sem turnos guardados, conferir à mão</span></>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVerReconciliacao((v) => !v)}
                    className="rounded-lg bg-[#484848] px-3 py-2 text-xs font-semibold text-[#f5f5f5] transition-colors hover:bg-[#525252]"
                  >
                    {verReconciliacao ? 'Ocultar' : 'Ver detalhe'}
                  </button>
                  <button
                    onClick={handleExportReconciliacao}
                    className="rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#ea580c]"
                  >
                    Exportar para o RH
                  </button>
                </div>
              </div>

              {verReconciliacao && (
                <div className="mt-3 max-h-96 overflow-auto rounded border border-[var(--color-border)]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[var(--color-surface)]">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Competência</th>
                        <th className="px-3 py-2 font-semibold">Funcionário</th>
                        <th className="px-3 py-2 font-semibold">O que mudou</th>
                        <th className="px-3 py-2 text-right font-semibold">Antes</th>
                        <th className="px-3 py-2 text-right font-semibold">Corrigido</th>
                        <th className="px-3 py-2 text-right font-semibold">Diferença</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliacao.itens.map((item) => (
                        <tr key={`${item.competencia}-${item.workerId}`} className="border-t border-[var(--color-border)]">
                          <td className="px-3 py-2 align-top">{item.competencia}</td>
                          <td className="px-3 py-2 align-top">
                            {item.workerName}
                            {item.semTurnos && <div className="text-[11px] text-[#fbbf24]">sem turnos guardados</div>}
                          </td>
                          <td className="px-3 py-2 align-top text-[var(--color-text-muted)]">
                            {item.linhas.map((l) => l.rubrica).join(' · ') || 'apenas o líquido'}
                          </td>
                          <td className="px-3 py-2 text-right align-top tabular-nums">{fmt(item.liquidoAntes)}</td>
                          <td className="px-3 py-2 text-right align-top tabular-nums">{fmt(item.liquidoAgora)}</td>
                          <td className={`px-3 py-2 text-right align-top font-semibold tabular-nums ${item.diferencaLiquido > 0 ? 'text-[#4ade80]' : 'text-[#fca5a5]'}`}>
                            {item.diferencaLiquido > 0 ? '+' : ''}{fmt(item.diferencaLiquido)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-3 text-[11px] leading-5 text-[var(--color-text-muted)]">
                O recálculo usa os turnos guardados de cada mês; funcionário sem turnos aparece marcado e fica
                fora dos totais. O histórico de folha vive só neste navegador — rode em cada máquina que fechou
                folha. Isto é a diferença bruta entre o que o sistema calculava e o que calcula agora: reflexo em
                férias, 13º e FGTS recolhido é conta do RH.
              </p>
            </div>
          )}

          {/* A competência das tabelas fiscais é DADO, não texto fixo. Antes dizia "2025" com os
              valores de fevereiro/2024 escritos no código — quem lesse acreditaria. */}
          <p className="text-xs text-[var(--color-text-muted)]">
            Gerado em {new Date(currentPayroll.payslips[0]?.generatedAt ?? '').toLocaleString('pt-BR')}.
            Clique em uma linha para expandir o detalhamento. Tabelas INSS/IRRF da competência{' '}
            <strong>{cltSettings.tabelasVigenciaEm ?? COMPETENCIA_TABELAS_PADRAO}</strong>
            {tabelasDesatualizadas && (
              <span className="ml-1 text-[#fbbf24]">
                — desatualizadas há mais de 12 meses. Revise em Configurações antes de fechar a folha.
              </span>
            )}
          </p>

          <TabelasEEncargos cltSettings={cltSettings} onSalvar={updateCLTSettings} />

          {/* Com a folha em uso para pagamento, o que ela é e o que ela não é precisa estar
              escrito onde a pessoa lê, não só no código. */}
          <div className="rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/[0.07] p-3 text-xs leading-5 text-[#fbbf24]">
            <strong>Apoio ao cálculo, não documento fiscal.</strong> Os valores consideram horas
            apontadas, faltas registradas na escala, adicional noturno com hora reduzida e as
            tabelas configuradas. Três pontos dependem do acordo da sua empresa e devem ser
            conferidos pelo RH antes do pagamento: tratamento de hora extra sem acordo de
            compensação, base do DSR, e a política de VA/VT. Feriados não entram no DSR — não há
            calendário de feriados no sistema.
          </div>
        </>
      )}

      <HorasExtrasContraClt workers={workers} maxOvertimeHours={cltSettings.maxOvertimeHours} />

      {/* Print-only layout */}
      {currentPayroll && (
        <div className="hidden print:block mt-4">
          <h1 className="text-lg font-bold mb-1">Folha de Pagamento — {monthLabel}</h1>
          <p className="text-xs text-[#adadad] mb-3">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {['Funcionário', 'Cargo', 'Depto', 'H. Trab.', 'H. Extra', 'Ad. Not.', 'Bruto', 'INSS', 'IRRF', 'FGTS', 'Líquido'].map((h) => (
                  <th key={h} className="border border-gray-400 px-1.5 py-1 text-left bg-gray-100">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentPayroll.payslips.map((p) => {
                const worker = workers.find((w) => w.id === p.workerId)
                const inss = p.deductions.find((d) => d.description?.includes('INSS'))?.amount ?? 0
                const irrf = p.deductions.find((d) => d.description?.includes('IRRF'))?.amount ?? 0
                const fgts = p.deductions.find((d) => !d.workerPays && d.description?.includes('FGTS'))?.amount ?? 0
                return (
                  <tr key={p.workerId}>
                    <td className="border border-gray-300 px-1.5 py-1">{worker?.name ?? p.workerId}</td>
                    <td className="border border-gray-300 px-1.5 py-1">{worker?.role ?? '—'}</td>
                    <td className="border border-gray-300 px-1.5 py-1">{worker?.department ?? '—'}</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{p.hoursWorked.toFixed(0)}h</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{p.overtimeHours.toFixed(0)}h</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{p.nightHours.toFixed(0)}h</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{fmt(p.grossTotal)}</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{fmt(inss)}</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{fmt(irrf)}</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{fmt(fgts)}</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right font-semibold">{fmt(p.netTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold bg-gray-100">
                <td colSpan={6} className="border border-gray-400 px-1.5 py-1">Total</td>
                <td className="border border-gray-400 px-1.5 py-1 text-right">{fmt(currentPayroll.totalGross)}</td>
                <td colSpan={3} className="border border-gray-400 px-1.5 py-1" />
                <td className="border border-gray-400 px-1.5 py-1 text-right">{fmt(currentPayroll.totalNet)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
