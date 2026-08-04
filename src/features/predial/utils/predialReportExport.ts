/**
 * predialReportExport.ts — Relatório Predial do período (universal): abre uma janela A4
 * estilizada e chama window.print() (sem lib de PDF). Serve para assembleia, prestação de
 * contas ou qualquer fim. Espelha o padrão de relatorio360PdfExport.ts.
 */

export interface PredialReportChamado { code: string; title: string; status: string; dueDate?: string; completedAt?: string; actualCost: number; noPrazo: boolean | null }
export interface PredialReportLaudo { tipo: string; titulo?: string; validade?: string; situacao: string; cor: 'verde' | 'amarelo' | 'vermelho' | 'cinza' }
export interface PredialReportPreventiva { title: string; code?: string; nextDueDate?: string; status: 'Em dia' | 'Vencido' | 'Sem data' }
export interface PredialReportAtivoCusto { nome: string; sistema?: string; custo: number }
export interface PredialReportCapex { nome: string; vidaUtilAnos: number; idadeAnos: number | null; repair12m: number; replacement: number; economiaAno: number }

export interface PredialReportData {
  obraNome: string
  periodoInicio: string
  periodoFim: string
  kpis: { abertos: number; fechados: number; pctPrazo: number | null; custo: number; custoM2: number | null; pctPrev: number | null; laudos90: number }
  chamados: PredialReportChamado[]
  laudos: PredialReportLaudo[]
  preventivas: PredialReportPreventiva[]
  topAtivos: PredialReportAtivoCusto[]
  capex: PredialReportCapex[]
}

const brl = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const brl2 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dt = (d?: string) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—')
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const COR_HEX: Record<string, string> = { verde: '#16a34a', amarelo: '#ca8a04', vermelho: '#dc2626', cinza: '#6b7280' }

function metric(label: string, value: string) {
  return `<div class="metric-card"><div class="metric-label">${label}</div><div class="metric-value">${value}</div></div>`
}
function section(title: string, inner: string) {
  return `<div class="section"><div class="section-header"><span class="section-dot"></span> ${title}</div>${inner}</div>`
}
function emptyRow(cols: number, txt = 'Sem registros') {
  return `<tr><td colspan="${cols}" style="color:#6b7280;font-style:italic">${txt}</td></tr>`
}

function buildHtml(d: PredialReportData): string {
  const periodo = `${dt(d.periodoInicio)} – ${dt(d.periodoFim)}`
  const chamadosRows = d.chamados.length
    ? d.chamados.map((c) => `<tr>
        <td>${esc(c.title || c.code)}<div style="font-size:7pt;color:#9ca3af">${esc(c.code)}</div></td>
        <td>${esc(c.status)}</td>
        <td style="text-align:center">${dt(c.completedAt?.slice(0, 10))}</td>
        <td style="text-align:center;font-weight:600;color:${c.noPrazo == null ? '#6b7280' : c.noPrazo ? '#16a34a' : '#dc2626'}">${c.noPrazo == null ? '—' : c.noPrazo ? 'No prazo' : 'Atrasada'}</td>
        <td style="text-align:right;font-weight:600">${brl2(c.actualCost)}</td>
      </tr>`).join('')
    : emptyRow(5, 'Sem chamados concluídos no período')
  const custoTotal = d.chamados.reduce((s, c) => s + (c.actualCost || 0), 0)

  const laudosRows = d.laudos.length
    ? d.laudos.map((l) => `<tr>
        <td>${esc(l.tipo)}${l.titulo ? `<div style="font-size:7pt;color:#9ca3af">${esc(l.titulo)}</div>` : ''}</td>
        <td style="text-align:center">${dt(l.validade)}</td>
        <td style="text-align:center;font-weight:700;color:${COR_HEX[l.cor]}">${esc(l.situacao)}</td>
      </tr>`).join('')
    : emptyRow(3, 'Nenhum laudo cadastrado')

  const prevRows = d.preventivas.length
    ? d.preventivas.map((p) => `<tr>
        <td>${esc(p.title)}${p.code ? `<div style="font-size:7pt;color:#9ca3af">${esc(p.code)}</div>` : ''}</td>
        <td style="text-align:center">${dt(p.nextDueDate)}</td>
        <td style="text-align:center;font-weight:600;color:${p.status === 'Em dia' ? '#16a34a' : p.status === 'Vencido' ? '#dc2626' : '#6b7280'}">${p.status}</td>
      </tr>`).join('')
    : emptyRow(3, 'Nenhum plano preventivo ativo')

  const ativosRows = d.topAtivos.length
    ? d.topAtivos.map((a, i) => `<tr><td>${i + 1}. ${esc(a.nome)}</td><td>${esc(a.sistema ?? '—')}</td><td style="text-align:right;font-weight:600">${brl2(a.custo)}</td></tr>`).join('')
    : emptyRow(3, 'Sem custo por ativo no período')

  const capexRows = d.capex.length
    ? d.capex.map((c) => `<tr>
        <td>${esc(c.nome)}</td>
        <td style="text-align:center">${c.idadeAnos != null ? `${c.idadeAnos}/${c.vidaUtilAnos}` : `–/${c.vidaUtilAnos}`}</td>
        <td style="text-align:right">${brl(c.repair12m)}</td>
        <td style="text-align:right">${brl(c.replacement)}</td>
        <td style="text-align:right;font-weight:700;color:${c.economiaAno > 0 ? '#16a34a' : '#6b7280'}">${brl(c.economiaAno)}${c.economiaAno > 0 ? ' · trocar' : ''}</td>
      </tr>`).join('')
    : emptyRow(5, 'Sem dados suficientes (precisa de OS com custo nos últimos 12 meses)')
  const provisao = d.capex.find((c) => c.economiaAno > 0)
  const provisaoNota = provisao
    ? `<p style="margin-top:6px;font-size:8.5pt;color:#334155"><strong>Sugestão de provisionamento:</strong> ${esc(provisao.nome)}${provisao.idadeAnos != null ? ` com ${provisao.idadeAnos} de ${provisao.vidaUtilAnos} anos de vida útil` : ''} — reposição estimada ${brl(provisao.replacement)}; a troca economiza ~${brl(provisao.economiaAno)}/ano ante os reparos. Sugerimos provisionar.</p>`
    : ''

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
  <title>Relatório Predial — ${esc(d.obraNome)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1e293b; padding: 14mm; }
    @page { size: A4; margin: 12mm; }
    .cover { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #f97316; padding-bottom: 10px; margin-bottom: 14px; }
    .cover-logo { width: 46px; height: 46px; border-radius: 10px; background: #f97316; color: #fff; font-weight: 800; font-size: 13pt; display: flex; align-items: center; justify-content: center; }
    .cover-title { font-size: 16pt; font-weight: 800; }
    .cover-sub { font-size: 9.5pt; color: #64748b; margin-top: 2px; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    .metric-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; background: #f8fafc; }
    .metric-label { font-size: 7.5pt; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
    .metric-value { font-size: 13pt; font-weight: 800; color: #111; }
    .section { margin-bottom: 14px; break-inside: avoid; }
    .section-header { font-size: 10pt; font-weight: 700; color: #fff; background: #1e293b; padding: 6px 12px; border-radius: 6px 6px 0 0; display: flex; align-items: center; gap: 8px; }
    .section-dot { width: 8px; height: 8px; border-radius: 50%; background: #f97316; }
    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    th { background: #f8fafc; padding: 5px 8px; text-align: left; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
    td { padding: 4.5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tfoot td { font-weight: 700; border-top: 2px solid #e2e8f0; }
    .footer { margin-top: 16px; display: flex; justify-content: space-between; font-size: 7pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 6px; }
  </style></head><body>
    <div class="cover">
      <div class="cover-logo">P</div>
      <div><div class="cover-title">Relatório Predial</div><div class="cover-sub">${esc(d.obraNome)} · período ${periodo}</div></div>
    </div>

    <div class="metrics">
      ${metric('Chamados abertos', String(d.kpis.abertos))}
      ${metric('Fechados no período', String(d.kpis.fechados))}
      ${metric('No prazo', d.kpis.pctPrazo != null ? `${d.kpis.pctPrazo}%` : '—')}
      ${metric('Custo do período', brl(d.kpis.custo))}
      ${metric('Custo por m²', d.kpis.custoM2 != null ? brl2(d.kpis.custoM2) : '—')}
      ${metric('Preventivas em dia', d.kpis.pctPrev != null ? `${d.kpis.pctPrev}%` : '—')}
      ${metric('Laudos vencendo 90d', String(d.kpis.laudos90))}
      ${metric('Ativos no top custo', String(d.topAtivos.length))}
    </div>

    ${section('Chamados concluídos no período', `<table>
      <thead><tr><th>Chamado</th><th>Status</th><th style="text-align:center">Concluído</th><th style="text-align:center">Prazo</th><th style="text-align:right">Custo</th></tr></thead>
      <tbody>${chamadosRows}</tbody>
      <tfoot><tr><td colspan="4">Total</td><td style="text-align:right">${brl2(custoTotal)}</td></tr></tfoot>
    </table>`)}

    ${section('Compliance de laudos', `<table>
      <thead><tr><th>Obrigação</th><th style="text-align:center">Validade</th><th style="text-align:center">Situação</th></tr></thead>
      <tbody>${laudosRows}</tbody>
    </table>`)}

    ${section('Preventivas', `<table>
      <thead><tr><th>Plano</th><th style="text-align:center">Próxima</th><th style="text-align:center">Situação</th></tr></thead>
      <tbody>${prevRows}</tbody>
    </table>`)}

    ${section('Ativos que mais custaram', `<table>
      <thead><tr><th>Ativo</th><th>Sistema</th><th style="text-align:right">Custo</th></tr></thead>
      <tbody>${ativosRows}</tbody>
    </table>`)}

    ${section('Projeção de CapEx (substituir × reparar)', `<table>
      <thead><tr><th>Ativo</th><th style="text-align:center">Idade/Vida (anos)</th><th style="text-align:right">Reparo 12m</th><th style="text-align:right">Reposição</th><th style="text-align:right">Economia/ano</th></tr></thead>
      <tbody>${capexRows}</tbody>
    </table>${provisaoNota}`)}

    <div class="footer"><span>${esc(d.obraNome)}</span><span>Relatório Predial · ${periodo}</span><span>Gerado em ${new Date().toLocaleString('pt-BR')}</span></div>
  </body></html>`
}

export function printPredialReport(data: PredialReportData): void {
  const win = window.open('', '_blank')
  if (!win) { window.alert('Permita pop-ups para gerar o relatório.'); return }
  win.document.open()
  win.document.write(buildHtml(data))
  win.document.close()
  win.addEventListener('load', () => { setTimeout(() => win.print(), 400) })
}
