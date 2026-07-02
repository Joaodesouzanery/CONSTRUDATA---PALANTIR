/**
 * planoExecucaoPdf — imprime o "Planejamento de Execução" no layout da Compizzo,
 * replicando os PDFs originais (wordmark, barras de seção navy, cronograma, equipe,
 * bonificação, condições, rodapé). Usa window.print(). Espelha rdoCompizzoPdf.ts.
 */
import type { PlanoExecucao } from '@/types'
import {
  bonificacaoTotal, bonificacaoValor, bonusDiario, diasCorridos, dayOfWeekLabel,
  faturamento, fmtBRL, fmtDataCurta, fmtDataLonga, isWeekend,
} from './planoExecucao'

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
function mesAno(iso: string): string {
  const m = String(iso).match(/^(\d{4})-(\d{2})-\d{2}$/)
  return m ? `${MESES[Number(m[2]) - 1] ?? ''}/${m[1]}` : ''
}

export function printPlanoExecucaoPdf(p: PlanoExecucao) {
  const fat = faturamento(p)
  const total = bonificacaoTotal(p)
  const dias = diasCorridos(p)
  const bDiario = bonusDiario(p)
  const obra = p.obraNome || '—'

  const cronoRows = p.cronograma.map((d) => {
    const wknd = isWeekend(d.data)
    return `<tr class="${wknd ? 'wknd' : ''}"><td>${esc(fmtDataCurta(d.data))}</td><td>${esc(dayOfWeekLabel(d.data))}</td><td>${esc(d.atividade || (wknd ? (dayOfWeekLabel(d.data) === 'DOM' ? 'DOMINGO' : 'SÁBADO') : ''))}</td></tr>`
  }).join('')

  const equipeRows = p.equipe.length
    ? p.equipe.map((m) => `<tr><td>${esc(m.nome)}</td><td>${esc(m.funcao || 'Execução')}</td></tr>`).join('')
    : '<tr><td>—</td><td>—</td></tr>'

  const bonifRows = p.bonificacao.map((b) =>
    `<tr><td>${esc(b.nome)}</td><td class="r">${esc(fmtBRL(b.rPorM2))}</td><td class="r">${esc(fmtBRL(bonificacaoValor(b.rPorM2, p.areaM2)))}</td></tr>`,
  ).join('')

  const condicoesHtml = (p.condicoes || '').split('\n').filter((l) => l.trim())
    .map((l) => `<p>${esc(l)}</p>`).join('')

  const faltante = p.bonificacao[0]?.nome || 'um colaborador'
  const bonusFaltanteDia = p.bonificacao[0] ? bonificacaoValor(p.bonificacao[0].rPorM2, p.areaM2) : 0

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Planejamento de Execução — ${esc(obra)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a2e; font-size: 12px; line-height: 1.45; margin: 0; }
  .top { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #2b2c6b; padding-bottom: 8px; }
  .wordmark { font-weight: 800; font-size: 26px; color: #2b2c6b; letter-spacing: -1px; }
  .top .meta { text-align: right; font-size: 10px; color: #444; }
  h1 { text-align: center; color: #2b2c6b; font-size: 22px; margin: 18px 0 2px; }
  .obra { text-align: center; color: #3b6fb5; font-size: 14px; margin: 0 0 14px; }
  .metabox { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .metabox td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 12px; }
  .metabox .k { background: #eef1f8; font-weight: 700; width: 16%; color: #2b2c6b; }
  .prev { font-size: 11px; margin: 2px 0 4px; }
  .warn { color: #b45309; font-style: italic; font-size: 10px; }
  .bar { background: #2b2c6b; color: #fff; font-weight: 700; padding: 6px 10px; margin: 16px 0 0; font-size: 12px; letter-spacing: .3px; }
  table.data { width: 100%; border-collapse: collapse; }
  table.data th { background: #3a3b7a; color: #fff; text-align: left; padding: 5px 8px; font-size: 11px; }
  table.data td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11.5px; }
  table.data tr:nth-child(even) td { background: #f6f7fb; }
  table.data tr.wknd td { background: #eef1f8; color: #6b7280; font-style: italic; font-weight: 600; }
  table.data td.r { text-align: right; }
  .totrow td { font-weight: 800; background: #eef1f8 !important; color: #2b2c6b; border-top: 2px solid #2b2c6b; }
  .subline { font-size: 11px; margin: 6px 0 2px; }
  .cond p { margin: 6px 0; font-size: 11px; }
  .footer { border-top: 1px solid #cbd5e1; margin-top: 26px; padding-top: 6px; text-align: center; color: #6b7280; font-size: 10px; }
  .toolbar { position: fixed; top: 0; left: 0; right: 0; background: #2b2c6b; color: #fff; padding: 8px; text-align: center; z-index: 9; }
  .toolbar button { background: #fff; color: #2b2c6b; border: none; padding: 6px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; }
  @media print { .toolbar { display: none; } }
</style></head>
<body>
  <div class="toolbar"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
  <div style="height: 40px"></div>

  <div class="top">
    <div class="wordmark">compizzo</div>
    <div class="meta">PLANEJAMENTO DE EXECUÇÃO<br/>${esc(obra)} | ${esc(mesAno(p.periodoInicio))}</div>
  </div>

  <h1>PLANEJAMENTO DE EXECUÇÃO</h1>
  <div class="obra">OBRA: ${esc(obra.toUpperCase())}</div>

  <table class="metabox">
    <tr>
      <td class="k">META:</td><td>${esc(fmtDataLonga(p.periodoInicio))} a ${esc(fmtDataLonga(p.periodoFim))}</td>
      <td class="k">ÁREA:</td><td>${esc(p.areaM2.toLocaleString('pt-BR'))} m²</td>
    </tr>
    <tr>
      <td class="k">SERVIÇO:</td><td>${esc(p.servico)}</td>
      <td class="k">FATURAMENTO:</td><td>${esc(fmtBRL(fat))}${p.precoConfirmado ? '' : '*'}</td>
    </tr>
  </table>
  <div class="prev"><b>Previsão de faturamento:</b> ${esc(p.areaM2.toLocaleString('pt-BR'))} m² × ${esc(fmtBRL(p.precoM2))} = <b>${esc(fmtBRL(fat))}</b></div>
  ${p.precoConfirmado ? '' : '<div class="warn">*Confirmar preço fechado m² e metro linear — faturamento pode ser maior.</div>'}

  <div class="bar">CRONOGRAMA DE EXECUÇÃO</div>
  <table class="data"><thead><tr><th style="width:14%">DATA</th><th style="width:12%">DIA</th><th>ATIVIDADE</th></tr></thead>
  <tbody>${cronoRows || '<tr><td colspan="3">Sem dias no cronograma.</td></tr>'}</tbody></table>

  <div class="bar">EQUIPE EXECUTORA</div>
  <table class="data"><thead><tr><th>FUNCIONÁRIO</th><th style="width:40%">FUNÇÃO</th></tr></thead>
  <tbody>${equipeRows}</tbody></table>

  <div class="bar">DISTRIBUIÇÃO DE TAREFA (BONIFICAÇÃO)</div>
  <div class="subline">Área base: <b>${esc(p.areaM2.toLocaleString('pt-BR'))} m²</b> | Custo total bonificação: <b>${esc(fmtBRL(total))}</b></div>
  <table class="data"><thead><tr><th>COLABORADOR</th><th style="width:20%">R$/m²</th><th style="width:24%">VALOR TOTAL</th></tr></thead>
  <tbody>${bonifRows || '<tr><td colspan="3">Sem colaboradores.</td></tr>'}
    <tr class="totrow"><td>TOTAL</td><td class="r"></td><td class="r">${esc(fmtBRL(total))}</td></tr>
  </tbody></table>
  <div class="subline">Bônus diário = ${esc(fmtBRL(total))} ÷ ${dias} dias corridos = <b>${esc(fmtBRL(bDiario))}</b> / dia</div>

  <div class="bar">CONDIÇÕES DA TAREFA</div>
  <div class="cond">
    ${condicoesHtml || '<p>—</p>'}
    <p><b>Exemplo:</b> Se ${esc(faltante)} faltar um dia, será descontado o valor da falta do salário e o valor do bônus diário (${esc(fmtBRL(bonusFaltanteDia))} / ${dias} dias corridos = ${esc(fmtBRL(dias > 0 ? bonusFaltanteDia / dias : 0))}) será igualmente distribuído para a equipe que estiver presente.</p>
  </div>

  <div class="footer">Compizzo Group | Financeiro@grupocompizzo.com.br | (61) 9 8179-7412</div>
</body></html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}
