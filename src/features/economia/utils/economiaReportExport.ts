import type { EconomyBaseline, EconomyEvent, EconomyReport } from '@/types'
import { brl, ECONOMY_SOURCE_LABELS } from './economiaEngine'

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

export function printEconomyReport(report: EconomyReport, events: EconomyEvent[], baseline?: EconomyBaseline | null) {
  const win = window.open('', '_blank')
  if (!win) {
    alert('Permita pop-ups para exportar o PDF.')
    return
  }

  const topEvents = events
    .filter((event) => report.eventIds.includes(event.id) && event.status !== 'dismissed')
    .sort((a, b) => b.impactBRL - a.impactBRL)
    .slice(0, 4)

  const maxImpact = Math.max(1, ...topEvents.map((event) => event.impactBRL))
  const eventRows = topEvents.map((event) => `
    <tr>
      <td>
        <strong>${esc(event.title)}</strong>
        <small>${esc(event.description)}</small>
      </td>
      <td>${esc(ECONOMY_SOURCE_LABELS[event.sourceModule])}</td>
      <td class="right">${brl(event.impactBRL)}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatorio mensal de valor - ${esc(report.period)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #fff; font-size: 9pt; }
    .cover { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid #f97316; padding-bottom: 10px; margin-bottom: 12px; }
    .logo { width: 40px; height: 40px; border-radius: 8px; background: #f97316; color: #fff; display: grid; place-items: center; font-weight: 900; font-size: 18pt; }
    h1 { margin: 0; font-size: 18pt; line-height: 1.1; }
    .sub { color: #6b7280; margin-top: 2px; }
    .badge { margin-left: auto; border: 1px solid #fed7aa; color: #c2410c; background: #fff7ed; border-radius: 999px; padding: 4px 10px; font-weight: 700; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
    .metric { border: 1px solid #e5e7eb; border-radius: 8px; padding: 9px; min-height: 64px; }
    .label { color: #6b7280; text-transform: uppercase; letter-spacing: .05em; font-size: 7pt; font-weight: 700; }
    .value { margin-top: 4px; font-size: 15pt; font-weight: 800; }
    .green { color: #15803d; }
    .orange { color: #ea580c; }
    .grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 10px; }
    .section { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 10px; break-inside: avoid; }
    .section h2 { margin: 0; background: #111827; color: #fff; padding: 7px 10px; font-size: 9pt; }
    .body { padding: 10px; }
    .bar { height: 8px; border-radius: 999px; background: #e5e7eb; overflow: hidden; margin-top: 5px; }
    .fill { height: 100%; background: #22c55e; }
    .compare { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .mini { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f9fafb; color: #4b5563; text-align: left; font-size: 7pt; text-transform: uppercase; padding: 6px; border-bottom: 1px solid #e5e7eb; }
    td { padding: 7px 6px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    td small { display: block; color: #6b7280; margin-top: 2px; line-height: 1.25; }
    .right { text-align: right; font-weight: 800; color: #15803d; white-space: nowrap; }
    .chart-row { display: grid; grid-template-columns: 1fr 80px; gap: 8px; align-items: center; margin: 7px 0; }
    .footer { margin-top: 8px; color: #6b7280; font-size: 7.5pt; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="logo">R$</div>
    <div>
      <h1>Relatorio mensal de valor</h1>
      <div class="sub">${esc(report.projectName)} · periodo ${esc(report.period)} · envio alvo todo dia 5</div>
    </div>
    <div class="badge">ROI ${pct(report.roiPercent)}</div>
  </div>

  <div class="metrics">
    <div class="metric"><div class="label">Eventos detectados</div><div class="value">${report.detectedEvents}</div></div>
    <div class="metric"><div class="label">Perda evitada</div><div class="value green">${brl(report.avoidedLossBRL)}</div></div>
    <div class="metric"><div class="label">Custo plataforma</div><div class="value">${brl(report.platformFeeBRL)}</div></div>
    <div class="metric"><div class="label">Material economizado</div><div class="value orange">${brl(report.materialSavingsBRL)}</div></div>
  </div>

  <div class="grid">
    <div>
      <div class="section">
        <h2>Top eventos de economia</h2>
        <table>
          <thead><tr><th>Evento</th><th>Modulo</th><th class="right">Valor</th></tr></thead>
          <tbody>${eventRows || '<tr><td colspan="3">Sem eventos no periodo.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    <div>
      <div class="section">
        <h2>Baseline vs resultado</h2>
        <div class="body">
          <div class="compare">
            <div class="mini">
              <div class="label">PPC antes</div>
              <div class="value">${pct(report.ppcBefore)}</div>
              <div class="bar"><div class="fill" style="width:${Math.min(100, report.ppcBefore)}%"></div></div>
            </div>
            <div class="mini">
              <div class="label">PPC atual</div>
              <div class="value green">${pct(report.ppcAfter)}</div>
              <div class="bar"><div class="fill" style="width:${Math.min(100, report.ppcAfter)}%"></div></div>
            </div>
            <div class="mini">
              <div class="label">Desvio material antes</div>
              <div class="value">${report.materialDeviationBefore.toFixed(1)}%</div>
            </div>
            <div class="mini">
              <div class="label">Desvio material atual</div>
              <div class="value green">${report.materialDeviationAfter.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
      <div class="section">
        <h2>Distribuicao de valor</h2>
        <div class="body">
          ${topEvents.map((event) => `
            <div class="chart-row">
              <div>
                <div class="label">${esc(event.title)}</div>
                <div class="bar"><div class="fill" style="width:${Math.max(4, (event.impactBRL / maxImpact) * 100)}%"></div></div>
              </div>
              <div class="right">${brl(event.impactBRL)}</div>
            </div>
          `).join('') || '<p>Sem dados para grafico.</p>'}
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <span>Baseline: PPC ${baseline ? pct(baseline.ppcPercent) : '-'} · desvio material ${baseline ? `${baseline.materialDeviationPercent}%` : '-'}</span>
    <span>Gerado em ${esc(new Date(report.generatedAt).toLocaleDateString('pt-BR'))}</span>
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 250)</script>
</body>
</html>`

  win.document.open()
  win.document.write(html)
  win.document.close()
}
