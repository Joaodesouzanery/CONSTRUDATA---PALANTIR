import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Printer } from 'lucide-react'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import type { WorkerPayslip } from '@/types'
import { payrollToCSV, COMPETENCIA_TABELAS_PADRAO } from '@/features/mao-de-obra/utils/payrollEngine'
import { reconciliarFolhas, reconciliacaoParaCSV } from '@/features/mao-de-obra/utils/reconciliacaoFolha'

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
                  <span className="text-[#22c55e] font-medium">+ {fmt(a.amount)}</span>
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
                  <span className={`font-medium ${d.workerPays ? 'text-[#ef4444]' : 'text-[var(--color-text-muted)]'}`}>
                    {d.workerPays ? '- ' : ''}{fmt(d.amount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-[var(--color-border)] pt-1.5 mt-1.5">
                <span className="text-[var(--color-text-primary)]">Salário Líquido</span>
                <span className="text-[#22c55e]">{fmt(payslip.netTotal)}</span>
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

// ─── FolhaPagamentoPanel ──────────────────────────────────────────────────────

export function FolhaPagamentoPanel() {
  const { workers, payrollHistory, generatePayroll, cltSettings, shifts } = useMaoDeObraStore(
    useShallow(s => ({
      workers:         s.workers,
      payrollHistory:  s.payrollHistory,
      generatePayroll: s.generatePayroll,
      cltSettings:     s.cltSettings,
      shifts:          s.shifts,
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
    downloadCSV(reconciliacaoParaCSV(reconciliacao), `reconciliacao-folha-${new Date().toISOString().slice(0, 10)}.csv`)
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
              { label: 'Custo Total Empresa', value: fmt(currentPayroll.totalEmployerCost), color: 'text-[#ef4444]' },
              { label: 'Total Líquido',        value: fmt(currentPayroll.totalNet),          color: 'text-[#22c55e]' },
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
                          <td className="px-3 py-3 text-[#ef4444]">- {fmt(workerDed)}</td>
                          <td className="px-3 py-3 font-semibold text-[#22c55e]">{fmt(payslip.netTotal)}</td>
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
                    <td className="px-3 py-3 font-bold text-[#ef4444]">
                      - {fmt(currentPayroll.payslips.reduce((s, p) => s + p.deductions.filter(d => d.workerPays).reduce((a, d) => a + d.amount, 0), 0))}
                    </td>
                    <td className="px-3 py-3 font-bold text-[#22c55e]">{fmt(currentPayroll.totalNet)}</td>
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
                    A receber pelos trabalhadores: <strong className="text-[#22c55e]">{fmt(reconciliacao.totalAReceber)}</strong>
                    {' · '}pago a mais: <strong className="text-[#ef4444]">{fmt(reconciliacao.totalPagoAMais)}</strong>
                    {reconciliacao.quantidadeSemTurnos > 0 && (
                      <> · <span className="text-[#f59e0b]">{reconciliacao.quantidadeSemTurnos} sem turnos guardados, conferir à mão</span></>
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
                            {item.semTurnos && <div className="text-[10px] text-[#f59e0b]">sem turnos guardados</div>}
                          </td>
                          <td className="px-3 py-2 align-top text-[var(--color-text-muted)]">
                            {item.linhas.map((l) => l.rubrica).join(' · ') || 'apenas o líquido'}
                          </td>
                          <td className="px-3 py-2 text-right align-top tabular-nums">{fmt(item.liquidoAntes)}</td>
                          <td className="px-3 py-2 text-right align-top tabular-nums">{fmt(item.liquidoAgora)}</td>
                          <td className={`px-3 py-2 text-right align-top font-semibold tabular-nums ${item.diferencaLiquido > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
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
              <span className="ml-1 text-[#f59e0b]">
                — desatualizadas há mais de 12 meses. Revise em Configurações antes de fechar a folha.
              </span>
            )}
          </p>

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

      {/* Print-only layout */}
      {currentPayroll && (
        <div className="hidden print:block mt-4">
          <h1 className="text-lg font-bold mb-1">Folha de Pagamento — {monthLabel}</h1>
          <p className="text-xs text-[#6b6b6b] mb-3">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
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
