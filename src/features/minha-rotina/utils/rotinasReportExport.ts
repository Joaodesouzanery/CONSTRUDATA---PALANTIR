/**
 * O relatório de rotinas em A4 — semanal ou mensal, para a reunião.
 *
 * ─── POR QUE ESTE DOCUMENTO EXISTE ────────────────────────────────────────────
 * O módulo não tinha exportação nenhuma. A adesão vivia na tela, e "como foi a semana" era
 * memória de quem estava com o notebook aberto. Um número que não sai da tela não vira conversa.
 *
 * As três seções seguem a ordem da conversa: **como cada um foi**, **o que falhou**, e **o que
 * fica para decidir** — esta última em branco, de propósito, porque é ali que a reunião escreve.
 *
 * Molde: `gestao-360/utils/reuniao360Export.ts`, que copia o gerador canônico do repositório
 * (`financeiro/utils/boletosReportExport.ts`). `buildRotinasReportHtml` é PURA.
 */
import { brandMarkSvg } from '@/lib/brandMark'
import { pageFooterCss } from '@/lib/printPageFooter'
import { fmtDataBR } from '@/lib/utils'
import type { AdesaoNoPeriodo } from './adesaoRotina'
import type { Periodo } from '@/lib/periodo'

export interface RotinasReportData {
  adesao: AdesaoNoPeriodo
  periodo: Periodo
  empresa: string
  organizacao?: string
  emitidoPor?: string
  /** `yyyy-MM-dd` LOCAL, injetado pelo chamador. */
  hoje: string
  demo: boolean
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)

const CSS = `
*{box-sizing:border-box}
@page{size:A4;margin:14mm 12mm 16mm}
html,body{margin:0;padding:0;background:#fff;color:#0f172a;
  font:11.5px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.barra-acoes{padding:10px 0;text-align:right}
.barra-acoes button{font:600 12px inherit;padding:7px 14px;border:0;border-radius:7px;background:#f97316;color:#fff;cursor:pointer}
@media print{.barra-acoes{display:none !important}}
.head{display:flex;align-items:flex-start;gap:12px;border-bottom:2px solid #0f172a;padding-bottom:9px;margin-bottom:12px}
.head h1{margin:0;font-size:19px;letter-spacing:-.3px}
.head-sub{color:#475569;font-size:11px;margin-top:2px}
.head-right{margin-left:auto;text-align:right;color:#475569;font-size:9.5px;line-height:1.5}
.chip-demo{display:inline-block;background:#f59e0b;color:#fff;font-weight:800;font-size:8.5px;
  padding:2px 7px;border-radius:99px;letter-spacing:.06em;margin-bottom:3px}
.recorte{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.recorte span{background:#f1f5f9;border-radius:99px;padding:3px 9px;font-size:9.5px;color:#475569}
h2{font-size:13px;margin:18px 0 7px;padding-bottom:5px;border-bottom:1px solid #e2e8f0;
  display:flex;justify-content:space-between;align-items:baseline}
h2 .cont{font-size:10px;font-weight:400;color:#94a3b8}
table{width:100%;border-collapse:collapse;font-size:11px}
th{text-align:left;color:#64748b;font-weight:600;font-size:9px;text-transform:uppercase;
  letter-spacing:.04em;border-bottom:1px solid #cbd5e1;padding:4px 6px}
td{padding:4px 6px;border-bottom:1px solid #f1f5f9}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
tr{break-inside:avoid}
.sec{break-inside:avoid}
.barra{height:10px;background:#f1f5f9;border-radius:3px;overflow:hidden;min-width:90px}
.barra i{display:block;height:100%;border-radius:3px}
.vazio{color:#64748b;font-style:italic;padding:8px 0}
.aviso{background:#fffbeb;border:1px solid #fcd34d;border-radius:7px;padding:8px 11px;
  font-size:10px;color:#92400e;margin-top:9px;line-height:1.5}
.decidir{margin-top:8px}
.decidir div{border-bottom:1px solid #cbd5e1;height:26px}
.assinaturas{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:34px;
  text-align:center;color:#64748b;font-size:9.5px}
.assinaturas div{border-top:1px solid #94a3b8;padding-top:5px}
.rodape{margin-top:20px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;
  justify-content:space-between;gap:10px;color:#94a3b8;font-size:9px;flex-wrap:wrap}
.rodape .marca{display:inline-flex;align-items:center;gap:3px}
.demo-wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
  pointer-events:none;z-index:0}
.demo-wm span{font-size:104px;font-weight:900;color:rgba(245,158,11,.10);transform:rotate(-26deg);
  letter-spacing:.1em}
body > *:not(.demo-wm){position:relative;z-index:1}
`

const corDaAdesao = (v: number | null) =>
  v === null ? '#cbd5e1' : v >= 80 ? '#22c55e' : v >= 50 ? '#eab308' : '#ef4444'

function blocoPessoas(a: AdesaoNoPeriodo): string {
  if (a.porPessoa.length === 0) {
    return '<p class="vazio">Nenhuma rotina com responsável foi avaliada neste período.</p>'
  }
  return `<table>
    <thead><tr>
      <th>Pessoa</th><th class="num">Rotinas</th><th class="num">Cumpridos</th>
      <th class="num">Esperados</th><th class="num">Adesão</th><th>&nbsp;</th>
    </tr></thead>
    <tbody>${a.porPessoa.map((p) => `<tr>
      <td>${esc(p.nome)}</td>
      <td class="num">${p.rotinas}</td>
      <td class="num">${p.cumpridos}</td>
      <td class="num">${p.esperados}</td>
      <td class="num"><b>${pct(p.percentual)}</b></td>
      <td style="width:110px"><div class="barra"><i style="width:${p.percentual ?? 0}%;background:${corDaAdesao(p.percentual)}"></i></div></td>
    </tr>`).join('')}</tbody>
    <tfoot><tr>
      <td><b>Total</b></td><td class="num"></td>
      <td class="num"><b>${a.total.cumpridos}</b></td>
      <td class="num"><b>${a.total.esperados}</b></td>
      <td class="num"><b>${pct(a.total.percentual)}</b></td><td></td>
    </tr></tfoot>
  </table>`
}

function blocoFalhas(a: AdesaoNoPeriodo): string {
  const comFalha = a.porRotina
    .filter((r) => r.emAberto.length > 0)
    .sort((x, y) => y.emAberto.length - x.emAberto.length)
  const naoAvaliadas = a.porRotina.filter((r) => r.esperados === 0).length
  // A regra que EXCLUIU rotinas precisa aparecer aqui também, e não só no ramo de período vazio:
  // num relatório de semana, toda mensal e quinzenal some — e "nenhuma ficou em aberto" lido sem
  // essa ressalva é um atestado de que estava tudo em dia.
  const ressalva = naoAvaliadas > 0
    ? `<div class="aviso"><strong>${naoAvaliadas} rotina(s) não foram avaliadas neste recorte.</strong>
       Só entra na conta o ciclo que começou e terminou dentro do período — num relatório de semana,
       por exemplo, uma rotina mensal não deve nada. Elas não estão em dia nem atrasadas: não foram
       medidas.</div>`
    : ''
  if (comFalha.length === 0) {
    return `<p class="vazio">Nenhuma rotina ficou em aberto entre as avaliadas no período.</p>${ressalva}`
  }
  return `<table>
    <thead><tr>
      <th>Rotina</th><th>Responsável</th><th class="num">Em aberto</th><th>Ciclos que ficaram</th>
    </tr></thead>
    <tbody>${comFalha.map((r) => `<tr>
      <td>${esc(r.titulo)}</td>
      <td>${esc(r.responsavel ?? '— sem dono —')}</td>
      <td class="num"><b>${r.emAberto.length}</b> de ${r.esperados}</td>
      <td>${esc(r.emAberto.slice(0, 4).map((c) => c.rotulo).join(' · '))}${r.emAberto.length > 4 ? ` e mais ${r.emAberto.length - 4}` : ''}</td>
    </tr>`).join('')}</tbody>
  </table>${ressalva}`
}

/** PURA: entra dado, sai o documento. Dá para conferir sem imprimir nada. */
export function buildRotinasReportHtml(d: RotinasReportData): string {
  const { adesao: a } = d
  // Sem `<` nem `>`: esta string entra num `content:` de CSS dentro de um `<style>`, e um
  // `</style>` fecharia o bloco.
  const identificacao = `Rotinas · ${d.periodo.rotulo} · ${d.empresa}${d.demo ? ' · DEMONSTRAÇÃO' : ''}`.replace(/[<>]/g, '')

  const semDono = a.porRotina.filter((r) => !r.responsavel && r.esperados > 0).length

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Rotinas — ${esc(d.periodo.rotulo)}</title>
<style>${CSS}</style>
<!-- Depois do CSS principal: a @page daqui precisa vencer a margem declarada lá em cima. -->
<style>${pageFooterCss(identificacao)}</style>
</head><body>
${d.demo ? '<div class="demo-wm"><span>DEMONSTRAÇÃO</span></div>' : ''}
<div class="barra-acoes"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>

<header class="head">
  <div>${brandMarkSvg(25, '#f97316')}</div>
  <div>
    <h1>Rotinas da empresa</h1>
    <div class="head-sub">${esc(d.periodo.rotulo)}</div>
  </div>
  <div class="head-right">
    ${d.demo ? '<div class="chip-demo">DEMONSTRAÇÃO</div>' : ''}
    <div>${esc(d.empresa)}</div>
    ${d.organizacao ? `<div>${esc(d.organizacao)}</div>` : ''}
    <div>Emitido em ${esc(fmtDataBR(d.hoje))}</div>
    ${d.emitidoPor ? `<div>por ${esc(d.emitidoPor)}</div>` : ''}
  </div>
</header>

<div class="recorte">
  <span>${esc(d.periodo.rotulo)}</span>
  <span>${esc(fmtDataBR(d.periodo.de))} a ${esc(fmtDataBR(d.periodo.ate))}</span>
  <span>${a.total.esperados} ciclo(s) esperado(s)</span>
</div>

${a.vazio ? `<div class="aviso">
  <strong>Nenhum ciclo fechado caiu inteiro neste período.</strong> Só entra na conta o ciclo que
  começou e terminou dentro do recorte — o que está correndo agora não conta, porque ainda dá tempo
  de fazer. Num recorte de semana, por exemplo, uma rotina mensal não deve nada.
</div>` : `
<div class="sec">
  <h2>Como cada um foi<span class="cont">${a.porPessoa.length} pessoa(s)</span></h2>
  ${blocoPessoas(a)}
  ${semDono > 0 ? `<div class="aviso">${semDono} rotina(s) sem responsável entram no total e ficam fora do placar — sem nome, não há de quem cobrar.</div>` : ''}
</div>

<div class="sec">
  <h2>O que falhou<span class="cont">ordenado pela pior</span></h2>
  ${blocoFalhas(a)}
</div>`}

<div class="sec">
  <h2>Para decidir<span class="cont">preencher na reunião</span></h2>
  <div class="decidir"><div></div><div></div><div></div><div></div></div>
</div>

<div class="assinaturas">
  <div>Conduzido por</div><div>Responsável</div><div>Direção</div>
</div>

<div class="rodape">
  <span>${esc(d.empresa)}${d.organizacao ? ` · ${esc(d.organizacao)}` : ''}</span>
  <span>${esc(d.periodo.rotulo)}</span>
  <span>Emitido em ${esc(fmtDataBR(d.hoje))}${d.emitidoPor ? ` por ${esc(d.emitidoPor)}` : ''}</span>
  <span class="marca">${brandMarkSvg(9, '#f97316')} ConstruData</span>
</div>
</body></html>`
}

// ─── Impressão ────────────────────────────────────────────────────────────────

export function openRotinasWindow(): Window | null {
  const win = window.open('', '_blank')
  if (!win) return null
  win.document.open()
  win.document.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Gerando o relatório…</title></head><body style="font:14px -apple-system,Segoe UI,Roboto,sans-serif;color:#334155;padding:32px">Gerando o relatório de rotinas…</body></html>')
  win.document.close()
  return win
}

async function aguardarImagens(doc: Document): Promise<void> {
  await Promise.all([...doc.images].map((img) => img.decode().catch(() => undefined)))
}

export async function printRotinasInto(win: Window, d: RotinasReportData): Promise<void> {
  win.document.open()
  win.document.write(buildRotinasReportHtml(d))
  win.document.close()
  await aguardarImagens(win.document)
  win.focus()
  win.print()
}

/** Plano B quando o pop-up é bloqueado. */
export async function printRotinasViaIframe(d: RotinasReportData): Promise<void> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) { iframe.remove(); throw new Error('Não foi possível preparar a impressão.') }
  doc.open()
  doc.write(buildRotinasReportHtml(d))
  doc.close()
  await aguardarImagens(doc)
  const limpar = () => setTimeout(() => iframe.remove(), 1000)
  win.addEventListener('afterprint', limpar, { once: true })
  win.focus()
  win.print()
  // Safari não dispara afterprint de iframe.
  setTimeout(limpar, 60_000)
}
