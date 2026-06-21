import type { EconomyBaseline, EconomyEvent, EconomyEventCategory, EconomyReport } from '@/types'
import { brl, ECONOMY_CATEGORY_LABELS, ECONOMY_SOURCE_LABELS, methodologyFor, monthlySeries } from './economiaEngine'

function esc(value: string | number | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pct(value: number): string {
  return `${Math.round(value)}%`
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function monthLabel(period: string): string {
  const [year, month] = period.split('-')
  return `${MONTHS[Number(month) - 1] ?? month}/${year ?? ''}`
}

function confidenceLabel(confidence: EconomyEvent['confidence']): string {
  return confidence === 'high' ? 'Alta' : confidence === 'medium' ? 'Média' : 'Baixa'
}

/**
 * Dossiê de comprovação de economia/eficiência (cliente · diretoria · comercial).
 * Documento branded com resumo executivo, metodologia transparente, antes/depois,
 * evidências rastreáveis e tendência. Impressão via janela do navegador (sem dependência).
 */
export function printEconomyDossier(
  report: EconomyReport,
  events: EconomyEvent[],
  baseline?: EconomyBaseline | null,
  ctx?: { orgName?: string },
) {
  const win = window.open('', '_blank')
  if (!win) {
    alert('Permita pop-ups para exportar o PDF.')
    return
  }

  const scoped = events.filter((event) => report.eventIds.includes(event.id) && event.status !== 'dismissed')
  const valued = scoped.filter((event) => event.impactBRL > 0)
  const validatedCount = scoped.filter((event) => event.status === 'validated' || event.status === 'reported').length
  const paybackRatio = report.platformFeeBRL > 0 ? report.avoidedLossBRL / report.platformFeeBRL : 0

  const topEvents = [...valued]
    .sort((a, b) => {
      const av = a.status === 'validated' || a.status === 'reported' ? 1 : 0
      const bv = b.status === 'validated' || b.status === 'reported' ? 1 : 0
      return bv - av || b.impactBRL - a.impactBRL
    })
    .slice(0, 10)

  // breakdown por módulo
  const bySource = new Map<string, number>()
  for (const event of valued) {
    const label = ECONOMY_SOURCE_LABELS[event.sourceModule]
    bySource.set(label, (bySource.get(label) ?? 0) + event.impactBRL)
  }
  const sourceRows = Array.from(bySource.entries()).sort((a, b) => b[1] - a[1])
  const maxSource = Math.max(1, ...sourceRows.map(([, value]) => value))

  // metodologia: categorias distintas presentes com R$
  const categories = Array.from(new Set(valued.map((event) => event.category))) as EconomyEventCategory[]

  // tendência (últimos 6 meses)
  const series = monthlySeries(events, 6)
  const maxTrend = Math.max(1, ...series.map((row) => row.validatedBRL))

  const eventRows = topEvents.map((event) => {
    const ref = event.evidence?.[0] ? `${esc(event.evidence[0].label)}: ${esc(event.evidence[0].value ?? '-')}` : esc(event.projectName)
    return `
      <tr>
        <td>
          <strong>${esc(event.title)}</strong>
          <small>${ref}</small>
        </td>
        <td>${esc(ECONOMY_SOURCE_LABELS[event.sourceModule])}</td>
        <td class="center">${confidenceLabel(event.confidence)}</td>
        <td class="right">${brl(event.impactBRL)}</td>
      </tr>
    `
  }).join('')

  const orgName = ctx?.orgName?.trim() || 'ConstruData'
  const periodLabel = monthLabel(report.period)

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Comprovação de economia - ${esc(report.projectName)} - ${esc(report.period)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #fff; font-size: 9pt; line-height: 1.4; }
    .cover { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid #f97316; padding-bottom: 12px; margin-bottom: 14px; }
    .logo { width: 42px; height: 42px; border-radius: 9px; background: #f97316; color: #fff; display: grid; place-items: center; font-weight: 900; font-size: 18pt; }
    .eyebrow { color: #ea580c; text-transform: uppercase; letter-spacing: .08em; font-size: 7.5pt; font-weight: 800; }
    h1 { margin: 2px 0 0; font-size: 17pt; line-height: 1.1; }
    .sub { color: #6b7280; margin-top: 3px; font-size: 8.5pt; }
    .badge { margin-left: auto; text-align: right; }
    .badge .roi { display: inline-block; border: 1px solid #bbf7d0; color: #15803d; background: #f0fdf4; border-radius: 999px; padding: 5px 12px; font-weight: 800; font-size: 11pt; }
    .hero { border: 1px solid #e5e7eb; border-left: 4px solid #22c55e; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; background: #fafffb; display: flex; align-items: flex-end; gap: 22px; flex-wrap: wrap; }
    .hero .big { font-size: 26pt; font-weight: 900; color: #15803d; line-height: 1; }
    .hero .biglabel { color: #6b7280; text-transform: uppercase; letter-spacing: .05em; font-size: 7pt; font-weight: 700; margin-bottom: 3px; }
    .hero .stat { font-size: 13pt; font-weight: 800; }
    .hero .statlabel { color: #6b7280; font-size: 7pt; text-transform: uppercase; letter-spacing: .04em; font-weight: 700; }
    .impact { margin: 2px 0 12px; color: #374151; font-size: 8.5pt; }
    .section { border: 1px solid #e5e7eb; border-radius: 9px; overflow: hidden; margin-bottom: 11px; break-inside: avoid; }
    .section h2 { margin: 0; background: #111827; color: #fff; padding: 7px 11px; font-size: 9pt; }
    .body { padding: 11px; }
    .grid { display: grid; grid-template-columns: 1.05fr .95fr; gap: 10px; }
    .label { color: #6b7280; text-transform: uppercase; letter-spacing: .05em; font-size: 7pt; font-weight: 700; }
    .value { margin-top: 3px; font-size: 14pt; font-weight: 800; }
    .green { color: #15803d; }
    .bar { height: 8px; border-radius: 999px; background: #eef2f7; overflow: hidden; margin-top: 5px; }
    .fill { height: 100%; background: #22c55e; }
    .chart-row { display: grid; grid-template-columns: 1fr 92px; gap: 8px; align-items: center; margin: 7px 0; }
    .compare { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .mini { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; }
    ul.method { margin: 0; padding-left: 16px; }
    ul.method li { margin-bottom: 5px; color: #374151; }
    ul.method li b { color: #111827; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f9fafb; color: #4b5563; text-align: left; font-size: 7pt; text-transform: uppercase; padding: 6px; border-bottom: 1px solid #e5e7eb; }
    td { padding: 7px 6px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    td small { display: block; color: #6b7280; margin-top: 2px; line-height: 1.25; }
    td.right { text-align: right; font-weight: 800; color: #15803d; white-space: nowrap; }
    td.center { text-align: center; }
    .trend { display: flex; align-items: flex-end; gap: 8px; height: 110px; }
    .trend .col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
    .trend .tbar { width: 100%; background: #22c55e; border-radius: 4px 4px 0 0; }
    .trend .tval { font-size: 6.5pt; color: #15803d; font-weight: 700; margin-bottom: 3px; }
    .trend .tlbl { font-size: 6.5pt; color: #6b7280; margin-top: 4px; }
    .note { color: #6b7280; font-size: 7.5pt; line-height: 1.45; margin-top: 4px; }
    .footer { margin-top: 10px; padding-top: 8px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 7.5pt; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="logo">R$</div>
    <div>
      <div class="eyebrow">Documento de comprovação de economia e eficiência</div>
      <h1>${esc(report.projectName)}</h1>
      <div class="sub">${esc(orgName)} · período ${esc(periodLabel)} · gerado em ${esc(new Date(report.generatedAt).toLocaleDateString('pt-BR'))}</div>
    </div>
    <div class="badge"><div class="roi">ROI ${pct(report.roiPercent)}</div></div>
  </div>

  <div class="hero">
    <div>
      <div class="biglabel">Economia comprovada no período</div>
      <div class="big">${brl(report.avoidedLossBRL)}</div>
    </div>
    <div>
      <div class="statlabel">Retorno por R$ investido</div>
      <div class="stat green">${paybackRatio.toFixed(1)}x</div>
    </div>
    <div>
      <div class="statlabel">Eventos validados</div>
      <div class="stat">${validatedCount} de ${report.detectedEvents}</div>
    </div>
    <div>
      <div class="statlabel">Investimento na plataforma</div>
      <div class="stat">${brl(report.platformFeeBRL)}/mês</div>
    </div>
  </div>
  <p class="impact">Para cada R$ 1,00 investido na plataforma, foram comprovados <b>${brl(paybackRatio)}</b> em economia e perdas evitadas no período, a partir de dados operacionais reais.</p>

  <div class="grid">
    <div class="section">
      <h2>De onde vem a economia</h2>
      <div class="body">
        ${sourceRows.map(([label, value]) => `
          <div class="chart-row">
            <div>
              <div class="label">${esc(label)}</div>
              <div class="bar"><div class="fill" style="width:${Math.max(4, (value / maxSource) * 100)}%"></div></div>
            </div>
            <div class="right" style="text-align:right;font-weight:800;color:#15803d;">${brl(value)}</div>
          </div>
        `).join('') || '<p class="note">Sem valor financeiro consolidado no período.</p>'}
      </div>
    </div>
    <div class="section">
      <h2>Antes e depois (baseline → atual)</h2>
      <div class="body">
        <div class="compare">
          <div class="mini"><div class="label">PPC antes</div><div class="value">${pct(report.ppcBefore)}</div><div class="bar"><div class="fill" style="width:${Math.min(100, report.ppcBefore)}%"></div></div></div>
          <div class="mini"><div class="label">PPC atual</div><div class="value green">${pct(report.ppcAfter)}</div><div class="bar"><div class="fill" style="width:${Math.min(100, report.ppcAfter)}%"></div></div></div>
          <div class="mini"><div class="label">Desvio material antes</div><div class="value">${report.materialDeviationBefore.toFixed(1)}%</div></div>
          <div class="mini"><div class="label">Desvio material meta</div><div class="value green">${report.materialDeviationAfter.toFixed(1)}%</div></div>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Evidências rastreáveis</h2>
    <table>
      <thead><tr><th>Evento</th><th>Origem</th><th class="center">Confiança</th><th class="right">Valor</th></tr></thead>
      <tbody>${eventRows || '<tr><td colspan="4">Sem eventos com valor financeiro no período.</td></tr>'}</tbody>
    </table>
  </div>

  <div class="section">
    <h2>Economia validada por mês</h2>
    <div class="body">
      <div class="trend">
        ${series.map((row) => `
          <div class="col">
            <div class="tval">${row.validatedBRL > 0 ? brl(row.validatedBRL) : ''}</div>
            <div class="tbar" style="height:${Math.max(2, (row.validatedBRL / maxTrend) * 100)}%"></div>
            <div class="tlbl">${monthLabel(row.period)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Metodologia e transparência</h2>
    <div class="body">
      <ul class="method">
        ${categories.map((category) => `<li><b>${esc(ECONOMY_CATEGORY_LABELS[category])}:</b> ${esc(methodologyFor(category))}</li>`).join('') || '<li>Cálculo conservador a partir de dados operacionais auditáveis.</li>'}
        <li>O ROI considera <b>apenas eventos validados</b>; indicadores sem valor financeiro direto (ex.: alertas de cronograma) não entram na conta, para evitar dupla contagem.</li>
      </ul>
    </div>
  </div>

  <div class="footer">
    <span>Baseline: PPC ${baseline ? pct(baseline.ppcPercent) : '-'} · desvio material ${baseline ? `${baseline.materialDeviationPercent}%` : '-'} · mensalidade ${baseline ? brl(baseline.platformMonthlyFeeBRL) : '-'}</span>
    <span>Documento gerado pela plataforma ${esc(orgName)} em ${esc(new Date(report.generatedAt).toLocaleDateString('pt-BR'))}</span>
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 250)</script>
</body>
</html>`

  win.document.open()
  win.document.write(html)
  win.document.close()
}

/** Compatibilidade: o relatório mensal agora gera o dossiê de comprovação. */
export function printEconomyReport(report: EconomyReport, events: EconomyEvent[], baseline?: EconomyBaseline | null) {
  printEconomyDossier(report, events, baseline)
}
