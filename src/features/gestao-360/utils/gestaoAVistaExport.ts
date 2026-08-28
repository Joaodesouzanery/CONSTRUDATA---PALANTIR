/**
 * O quadro de Gestão à Vista em A4, para imprimir e pregar na parede.
 *
 * ─── POR QUE ESTE ARQUIVO É O PONTO DA FUNCIONALIDADE ─────────────────────────
 * O quadro original é impresso. Ele fica na parede do canteiro, onde o encarregado, o mestre e
 * quem passa no corredor olham sem abrir computador nenhum. Uma versão que só existe na tela
 * resolve a metade menos importante do problema.
 *
 * Molde: `reuniao360Export.ts` — que por sua vez copia `financeiro/utils/boletosReportExport.ts`,
 * o gerador canônico do repositório. `buildGestaoAVistaHtml` é PURA: entra dado, sai string, e dá
 * para conferir o documento sem imprimir.
 */
import { brandMarkSvg } from '@/lib/brandMark'
import { pageFooterCss } from '@/lib/printPageFooter'
import { fmtDataBR } from '@/lib/utils'
import { ROTULO_SITUACAO } from '@/features/mao-de-obra/utils/frequencia'
import type { DadosGestaoAVista } from './gestaoAVista'

export interface GestaoAVistaPrintData {
  dados: DadosGestaoAVista
  empresa: string
  organizacao?: string
  emitidoPor?: string
  /** `yyyy-MM-dd` LOCAL, injetado pelo chamador — nunca `new Date()` aqui dentro. */
  hoje: string
  demo: boolean
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const pct = (v: number | null) => (v === null ? '—' : `${num(v)}%`)

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const rotuloMes = (m: string) => `${MES_CURTO[Number(m.split('-')[1]) - 1]}/${m.split('-')[0].slice(2)}`

const CSS = `
*{box-sizing:border-box}
@page{size:A4 landscape;margin:12mm 10mm 16mm}
html,body{margin:0;padding:0;background:#fff;color:#0f172a;
  font:11px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.barra-acoes{padding:10px 0;text-align:right}
.barra-acoes button{font:600 12px inherit;padding:7px 14px;border:0;border-radius:7px;background:#f97316;color:#fff;cursor:pointer}
@media print{.barra-acoes{display:none !important}}
.head{display:flex;align-items:flex-start;gap:12px;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:10px}
.head h1{margin:0;font-size:18px;letter-spacing:-.3px}
.head-sub{color:#475569;font-size:11px;margin-top:2px}
.head-right{margin-left:auto;text-align:right;color:#475569;font-size:9.5px;line-height:1.5}
.chip-demo{display:inline-block;background:#f59e0b;color:#fff;font-weight:800;font-size:8.5px;
  padding:2px 7px;border-radius:99px;letter-spacing:.06em;margin-bottom:3px}
h2{font-size:12px;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;
  display:flex;justify-content:space-between;align-items:baseline}
h2 .cont{font-size:9.5px;font-weight:400;color:#94a3b8}
table{width:100%;border-collapse:collapse;font-size:10px}
th{text-align:left;color:#64748b;font-weight:600;font-size:8.5px;text-transform:uppercase;
  letter-spacing:.04em;border-bottom:1px solid #cbd5e1;padding:3px 5px}
td{padding:3px 5px;border-bottom:1px solid #f1f5f9}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
tr{break-inside:avoid}
.sec{break-inside:avoid}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.barra{height:9px;background:#f1f5f9;border-radius:3px;overflow:hidden}
.barra i{display:block;height:100%;border-radius:3px}
.kpi{display:flex;gap:18px;margin-top:8px}
.kpi div{flex:1;border:1px solid #e2e8f0;border-radius:7px;padding:7px 10px}
.kpi .rot{color:#64748b;font-size:8.5px;text-transform:uppercase;letter-spacing:.04em}
.kpi .val{font-size:17px;font-weight:800;line-height:1.15}
.mes-ok{background:#dcfce7;color:#15803d;font-weight:600}
.mes-zero{color:#cbd5e1}
.nota{color:#64748b;font-size:8.5px;margin-top:5px;line-height:1.45}
.vazio{color:#94a3b8;font-style:italic;padding:6px 0}
.rodape{margin-top:16px;padding-top:7px;border-top:1px solid #e2e8f0;display:flex;
  justify-content:space-between;gap:10px;color:#94a3b8;font-size:8.5px;flex-wrap:wrap}
.rodape .marca{display:inline-flex;align-items:center;gap:3px}
.demo-wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
  pointer-events:none;z-index:0}
.demo-wm span{font-size:96px;font-weight:900;color:rgba(245,158,11,.10);transform:rotate(-24deg);
  letter-spacing:.1em}
body > *:not(.demo-wm){position:relative;z-index:1}
`

/** Cor da barra por situação, no papel. Verde só para presente. */
const COR: Record<string, string> = {
  presente: '#22c55e', folga: '#0ea5e9', falta: '#ef4444',
  atestado: '#eab308', ferias: '#a855f7', outros: '#94a3b8',
}

function blocoEfetivo(d: DadosGestaoAVista): string {
  const { linhas, total } = d.efetivo
  if (linhas.length === 0) return '<p class="vazio">Nenhum funcionário na folha neste escopo.</p>'
  return `<table>
    <thead><tr><th>Cargo</th><th class="num">Adm.</th><th class="num">Produção</th><th class="num">Total</th></tr></thead>
    <tbody>${linhas.map((l) => `<tr>
      <td>${esc(l.cargo)}</td>
      <td class="num">${l.administrativo || '—'}</td>
      <td class="num">${l.producao || '—'}</td>
      <td class="num"><b>${l.total}</b></td>
    </tr>`).join('')}</tbody>
    <tfoot><tr>
      <td><b>Total</b></td>
      <td class="num"><b>${total.administrativo}</b></td>
      <td class="num"><b>${total.producao}</b></td>
      <td class="num"><b>${total.total}</b></td>
    </tr></tfoot>
  </table>`
}

function blocoSituacao(d: DadosGestaoAVista): string {
  const { total, contagem } = d.situacaoHoje
  const f = d.frequenciaDoMes
  const barras = contagem.filter((c) => c.pessoas > 0).map((c) => `<tr>
    <td style="width:78px">${esc(ROTULO_SITUACAO[c.situacao])}</td>
    <td><div class="barra"><i style="width:${c.pct}%;background:${COR[c.situacao]}"></i></div></td>
    <td class="num" style="width:54px">${num(c.pct)}%</td>
  </tr>`).join('')

  return `${total === 0 ? '<p class="vazio">Ninguém na folha neste escopo.</p>' : `<table>${barras}</table>`}
  <div class="kpi">
    <div><div class="rot">Frequência do mês</div><div class="val" style="color:#15803d">${pct(f.frequenciaPct)}</div></div>
    <div><div class="rot">Absenteísmo</div><div class="val" style="color:#b45309">${pct(f.absenteismoPct)}</div></div>
  </div>
  <p class="nota">Presenças ÷ (pessoas na folha × ${f.diasUteis} dia(s) útil(eis) do mês). Domingo,
  sábado fora da jornada e feriado não entram. Dia sem falta e sem turno lançado conta como
  <b>Outros</b>, não como presença.</p>`
}

function blocoSerie(d: DadosGestaoAVista): string {
  const maxFaltas = Math.max(1, ...d.serie.map((p) => p.faltas))
  return `<table>
    <thead><tr>
      <th>Mês</th><th class="num">Frequência</th><th class="num">Absenteísmo</th>
      <th class="num">Ativos</th><th class="num">Faltas</th><th class="num">Faltas/func.</th><th>&nbsp;</th>
    </tr></thead>
    <tbody>${d.serie.map((p) => `<tr>
      <td>${esc(rotuloMes(p.mes))}</td>
      <td class="num">${pct(p.frequenciaPct)}</td>
      <td class="num">${pct(p.absenteismoPct)}</td>
      <td class="num">${p.ativos}</td>
      <td class="num">${p.faltas}</td>
      <td class="num">${p.faltasPorFuncionario === null ? '—' : num(p.faltasPorFuncionario)}</td>
      <td style="width:150px"><div class="barra"><i style="width:${(p.faltas / maxFaltas) * 100}%;background:#ef4444"></i></div></td>
    </tr>`).join('')}</tbody>
  </table>`
}

function blocoAvanco(d: DadosGestaoAVista): string {
  if (d.semComposicao) {
    return `<p class="vazio">Esta obra ainda não tem a composição do contrato cadastrada — sem ela
      não há serviço contra o qual medir.</p>`
  }
  return `<table>
    <thead><tr>
      <th>Serviço</th><th class="num">Contratado</th><th class="num">Medido</th><th class="num">%</th>
      ${d.meses.map((m) => `<th class="num">${esc(rotuloMes(m))}</th>`).join('')}
    </tr></thead>
    <tbody>${d.avanco.map((l) => `<tr>
      <td>${esc(l.descricao)}</td>
      <td class="num">${l.contratado ? `${num(l.contratado)} ${esc(l.unidade)}` : '—'}</td>
      <td class="num">${num(l.medido)}</td>
      <td class="num"><b>${l.pct === null ? '—' : `${Math.round(l.pct)}%`}</b></td>
      ${l.porMes.map((q) => `<td class="num ${q > 0 ? 'mes-ok' : 'mes-zero'}">${q > 0 ? num(q) : '·'}</td>`).join('')}
    </tr>`).join('')}</tbody>
  </table>
  <p class="nota">Sai dos RDOs <b>finalizados</b> desta obra — rascunho não conta. Este é o
  <b>executado</b>; as colunas de previsto dependem de um cronograma por serviço que este sistema
  ainda não guarda.</p>`
}

/** PURA: entra dado, sai o documento. Dá para conferir sem imprimir. */
export function buildGestaoAVistaHtml(p: GestaoAVistaPrintData): string {
  const { dados: d } = p
  // Sem `<` nem `>`: esta string entra num `content:` de CSS dentro de um `<style>`, e um
  // `</style>` no nome da obra fecharia o bloco e o resto viraria HTML. O `cssString` do
  // `pageFooterCss` escapa aspas e barras, que é o contexto CSS — não o contexto HTML de fuga.
  const semTag = (t: string) => t.replace(/[<>]/g, '')
  const identificacao = semTag(
    `Gestão à Vista · ${d.obraNome} · ${fmtDataBR(p.hoje)} · ${p.empresa}${p.demo ? ' · DEMONSTRAÇÃO' : ''}`,
  )

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Gestão à Vista — ${esc(d.obraNome)} — ${esc(fmtDataBR(p.hoje))}</title>
<style>${CSS}</style>
<!-- Depois do CSS principal: a @page daqui precisa vencer a margem declarada lá em cima. -->
<style>${pageFooterCss(identificacao)}</style>
</head><body>
${p.demo ? '<div class="demo-wm"><span>DEMONSTRAÇÃO</span></div>' : ''}
<div class="barra-acoes"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>

<header class="head">
  <div>${brandMarkSvg(24, '#f97316')}</div>
  <div>
    <h1>Gestão à Vista</h1>
    <div class="head-sub">${esc(d.obraNome)} · ${esc(fmtDataBR(p.hoje))}</div>
  </div>
  <div class="head-right">
    ${p.demo ? '<div class="chip-demo">DEMONSTRAÇÃO</div>' : ''}
    <div>${esc(p.empresa)}</div>
    ${p.organizacao ? `<div>${esc(p.organizacao)}</div>` : ''}
    <div>Emitido em ${esc(fmtDataBR(p.hoje))}</div>
    ${p.emitidoPor ? `<div>por ${esc(p.emitidoPor)}</div>` : ''}
  </div>
</header>

<div class="grid2 sec">
  <div>
    <h2>Efetivo<span class="cont">${d.efetivo.total.total} pessoa(s)</span></h2>
    ${blocoEfetivo(d)}
  </div>
  <div>
    <h2>Situação de hoje<span class="cont">${d.situacaoHoje.total} na folha</span></h2>
    ${blocoSituacao(d)}
  </div>
</div>

<div class="sec">
  <h2>Mês a mês<span class="cont">${d.serie.length} meses</span></h2>
  ${blocoSerie(d)}
</div>

<div class="sec">
  <h2>Avanço por serviço<span class="cont">${d.semComposicao ? 'sem composição' : `${d.avanco.length} serviço(s)`}</span></h2>
  ${blocoAvanco(d)}
</div>

<div class="rodape">
  <span>${esc(p.empresa)}${p.organizacao ? ` · ${esc(p.organizacao)}` : ''}</span>
  <span>${esc(d.obraNome)}</span>
  <span>Emitido em ${esc(fmtDataBR(p.hoje))}${p.emitidoPor ? ` por ${esc(p.emitidoPor)}` : ''}</span>
  <span class="marca">${brandMarkSvg(9, '#f97316')} ConstruData</span>
</div>
</body></html>`
}

// ─── Impressão ────────────────────────────────────────────────────────────────
// Mesmo par do resto do repositório: janela aberta SÍNCRONA no clique (o navegador bloqueia
// `window.open` disparado depois de um `await`), com o iframe oculto como plano B.

export function openGestaoAVistaWindow(): Window | null {
  const win = window.open('', '_blank')
  if (!win) return null
  win.document.open()
  win.document.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Gerando o quadro…</title></head><body style="font:14px -apple-system,Segoe UI,Roboto,sans-serif;color:#334155;padding:32px">Gerando o quadro de Gestão à Vista…</body></html>')
  win.document.close()
  return win
}

async function aguardarImagens(doc: Document): Promise<void> {
  await Promise.all([...doc.images].map((img) => img.decode().catch(() => undefined)))
}

export async function printGestaoAVistaInto(win: Window, p: GestaoAVistaPrintData): Promise<void> {
  win.document.open()
  win.document.write(buildGestaoAVistaHtml(p))
  win.document.close()
  await aguardarImagens(win.document)
  win.focus()
  win.print()
}

/** Plano B quando o pop-up é bloqueado: imprime de um iframe oculto, sem abrir aba. */
export async function printGestaoAVistaViaIframe(p: GestaoAVistaPrintData): Promise<void> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) { iframe.remove(); throw new Error('Não foi possível preparar a impressão.') }
  doc.open()
  doc.write(buildGestaoAVistaHtml(p))
  doc.close()
  await aguardarImagens(doc)
  const limpar = () => setTimeout(() => iframe.remove(), 1000)
  win.addEventListener('afterprint', limpar, { once: true })
  win.focus()
  win.print()
  // Safari não dispara afterprint de iframe: rede de segurança para não deixar lixo no DOM.
  setTimeout(limpar, 60_000)
}
