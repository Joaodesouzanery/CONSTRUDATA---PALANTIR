/**
 * reuniao360Export.ts — a pauta da reunião em A4, para imprimir ou salvar em PDF.
 *
 * ─── POR QUE EXISTE ───────────────────────────────────────────────────────────────────────────
 * Gestão 360 não tinha exportação nenhuma. A reunião acontecia na tela e o que ficou decidido
 * virava anotação de quem estava com o notebook aberto — quem faltou não tinha como saber o que
 * foi olhado, e não sobrava registro do estado da obra naquela data.
 *
 * O documento segue a ordem da conversa: o que aconteceu no período (os sinais por módulo), onde
 * o dinheiro foi (o razão de custos), e o que ficou para decidir (os pontos de atenção).
 *
 * Molde: `boletosReportExport.ts`, o melhor gerador do repositório. `buildReuniao360Html` é PURA
 * — entra dado, sai string —, então o documento pode ser conferido sem imprimir nada.
 *
 * ─── HONESTIDADE DOS NÚMEROS ──────────────────────────────────────────────────────────────────
 * Cada sinal carrega o próprio escopo (`periodo` / `acumulado` / `sem-obra`), e o que não respeita
 * o período sai MARCADO no papel. Um relatório que mistura "esta semana" com "desde sempre" sem
 * dizer qual é qual é pior do que não ter relatório: alguém vai comparar duas emissões e concluir
 * que a obra não andou.
 */
import { brandMarkSvg } from '@/lib/brandMark'
import { pageFooterCss } from '@/lib/printPageFooter'
import { fmtDataBR } from '@/lib/utils'

export interface SinalDoRelatorio {
  modulo: string
  valor: string
  detalhe: string
  tom: 'ok' | 'warn' | 'danger' | 'info' | 'neutral'
  escopo: 'periodo' | 'acumulado' | 'sem-obra'
}

export interface LinhaDeCusto {
  data: string
  modulo: string
  categoria: string
  descricao: string
  valorBRL: number
  tipo: 'actual' | 'committed' | 'earned' | 'baseline'
  /** ⚠️ Veio de tarifa de referência, não de medição. O papel PRECISA dizer isso. */
  estimado?: boolean
}

export interface Reuniao360Data {
  empresa: string
  organizacao?: string
  obraLabel: string
  periodoRotulo: string
  periodoDe: string
  periodoAte: string
  /** `yyyy-MM-dd` LOCAL — quem chama converte; um timestamp UTC deslocaria um dia. */
  hoje: string
  emitidoPor?: string
  demo: boolean
  sinais: SinalDoRelatorio[]
  custos: LinhaDeCusto[]
  /** Texto livre da pauta: o que a equipe quer discutir. */
  pauta?: string[]
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const TOM: Record<SinalDoRelatorio['tom'], string> = {
  ok: '#16a34a', warn: '#ca8a04', danger: '#dc2626', info: '#0284c7', neutral: '#64748b',
}

const ROTULO_ESCOPO: Record<SinalDoRelatorio['escopo'], string> = {
  periodo: '',
  acumulado: 'acumulado — não é do período',
  'sem-obra': 'todas as obras',
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;font:12px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a;background:#fff}
@page{size:A4;margin:14mm 12mm 16mm}
.barra-acoes{position:sticky;top:0;background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:10px 12px;text-align:right}
.barra-acoes button{background:#f97316;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer}
@media print{.barra-acoes{display:none}}

.head{display:flex;align-items:flex-start;gap:14px;border-bottom:2px solid #f97316;padding:16px 0 12px;margin-bottom:14px}
.head-mark img{height:34px}
.head h1{margin:0;font-size:19px;letter-spacing:-.3px}
.head-sub{color:#475569;font-size:12px;margin-top:2px}
.head-right{margin-left:auto;text-align:right;color:#475569;font-size:11px;line-height:1.6}
.chip-demo{display:inline-block;background:#dc2626;color:#fff;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;letter-spacing:.4px;margin-bottom:3px}

.recorte{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.recorte span{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:3px 10px;font-size:10.5px;color:#475569}

h2{font-size:13.5px;margin:20px 0 8px;padding-bottom:5px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:baseline}
h2 .cont{font-size:10.5px;font-weight:400;color:#94a3b8}

.sinais{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.sinal{border:1px solid #e2e8f0;border-radius:8px;padding:9px;break-inside:avoid}
.sinal .mod{font-size:10px;color:#64748b;margin-bottom:3px}
.sinal .val{font-size:17px;font-weight:700;line-height:1.1}
.sinal .det{font-size:9.5px;color:#64748b;margin-top:3px;line-height:1.35}
.sinal .esc{display:inline-block;margin-top:5px;background:#f1f5f9;border-radius:3px;padding:1px 5px;font-size:8.5px;color:#64748b}

table{width:100%;border-collapse:collapse;font-size:10.5px}
th{text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;padding:5px 6px;font-size:9.5px;text-transform:uppercase;letter-spacing:.3px}
td{padding:5px 6px;border-bottom:1px solid #f1f5f9;vertical-align:top}
td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr{break-inside:avoid}
tfoot td{font-weight:700;border-top:2px solid #cbd5e1;border-bottom:0;padding-top:7px}

.aviso{border:1px solid #fde68a;background:#fffbeb;border-radius:8px;padding:9px 11px;font-size:10.5px;color:#92400e;margin-top:10px;line-height:1.5}
.vazio{color:#94a3b8;font-size:11px;padding:10px 0}
.pauta li{margin-bottom:5px}

.assinaturas{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:34px;break-inside:avoid}
.assinaturas div{border-top:1px solid #94a3b8;padding-top:5px;text-align:center;font-size:10px;color:#64748b}

.rodape{display:flex;justify-content:space-between;gap:10px;margin-top:22px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:9.5px;color:#94a3b8}
.rodape .marca{display:flex;align-items:center;gap:4px}

.demo-wm{position:fixed;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center;z-index:0}
.demo-wm span{font-size:88px;font-weight:800;color:rgba(220,38,38,.07);transform:rotate(-28deg);letter-spacing:6px}
`

function blocoSinais(sinais: SinalDoRelatorio[]): string {
  if (sinais.length === 0) return '<p class="vazio">Nenhum sinal para este recorte.</p>'
  return `<div class="sinais">${sinais.map((s) => `
    <div class="sinal">
      <div class="mod">${esc(s.modulo)}</div>
      <div class="val" style="color:${TOM[s.tom]}">${esc(s.valor)}</div>
      <div class="det">${esc(s.detalhe)}</div>
      ${s.escopo !== 'periodo' ? `<span class="esc">${ROTULO_ESCOPO[s.escopo]}</span>` : ''}
    </div>`).join('')}</div>`
}

function blocoCustos(custos: LinhaDeCusto[]): string {
  // Só o que saiu ou está comprometido. Orçamento base e valor agregado são outra conversa e,
  // somados aqui, dariam um total que não é gasto nenhum.
  const reais = custos.filter((c) => c.tipo === 'actual' || c.tipo === 'committed')
  if (reais.length === 0) return '<p class="vazio">Nenhum custo lançado no período.</p>'

  const porCategoria = new Map<string, number>()
  for (const c of reais) porCategoria.set(c.categoria, (porCategoria.get(c.categoria) ?? 0) + c.valorBRL)
  const total = reais.reduce((s, c) => s + c.valorBRL, 0)

  const maiores = [...reais].sort((a, b) => b.valorBRL - a.valorBRL).slice(0, 25)

  // ⚠️ Quanto do total NÃO é medição. Este papel vai para a reunião de diretoria, e até agora ele
  // somava nota fiscal com tarifa inventada sem uma palavra distinguindo as duas.
  const estimadas = reais.filter((c) => c.estimado)
  const totalEstimado = estimadas.reduce((s, c) => s + c.valorBRL, 0)
  const avisoEstimativa = estimadas.length === 0 ? '' : `
  <p class="aviso"><strong>${brl(totalEstimado)}</strong> deste total
  (${total ? ((totalEstimado / total) * 100).toFixed(0) : '0'}%, em ${estimadas.length} lançamento(s))
  é <strong>estimativa</strong>, não medição: equipe e equipamento de RDO sem valor/hora cadastrado,
  valorados por tarifa de referência. As linhas marcadas com <strong>*</strong> abaixo são essas.</p>`

  return `
  <table>
    <thead><tr><th>Categoria</th><th class="num">Valor</th><th class="num">% do total</th></tr></thead>
    <tbody>
      ${[...porCategoria.entries()].sort((a, b) => b[1] - a[1]).map(([cat, v]) => `
        <tr><td>${esc(cat)}</td><td class="num">${brl(v)}</td><td class="num">${total ? ((v / total) * 100).toFixed(1) : '0,0'}%</td></tr>`).join('')}
    </tbody>
    <tfoot><tr><td>Total</td><td class="num">${brl(total)}</td><td class="num">100%</td></tr></tfoot>
  </table>
  ${avisoEstimativa}

  <h2>Maiores lançamentos<span class="cont">${maiores.length} de ${reais.length}</span></h2>
  <table>
    <thead><tr><th>Data</th><th>Módulo</th><th>Descrição</th><th class="num">Valor</th></tr></thead>
    <tbody>
      ${maiores.map((c) => `<tr>
        <td>${esc(fmtDataBR(c.data))}</td>
        <td>${esc(c.modulo)}</td>
        <td>${esc(c.descricao)}${c.estimado ? ' <strong>*</strong>' : ''}</td>
        <td class="num">${brl(c.valorBRL)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  ${reais.length > maiores.length ? `<p class="vazio">Os outros ${reais.length - maiores.length} lançamentos, menores, estão somados na tabela por categoria acima.</p>` : ''}`
}

export function buildReuniao360Html(d: Reuniao360Data): string {
  const marca = brandMarkSvg(25, '#f97316')
  const atencao = d.sinais.filter((s) => s.tom === 'danger' || s.tom === 'warn')
  const naoRecortados = d.sinais.filter((s) => s.escopo === 'acumulado')

  const recorte = [
    d.periodoRotulo,
    `${fmtDataBR(d.periodoDe)} a ${fmtDataBR(d.periodoAte)}`,
    d.obraLabel,
  ].filter(Boolean)

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Pauta da Reunião 360 — ${esc(d.obraLabel)}</title>
<style>${CSS}</style>
<!-- Depois do CSS principal: a @page daqui precisa vencer a margem declarada lá. -->
<style>${pageFooterCss(`Reunião 360 · ${d.obraLabel} · ${d.periodoRotulo} · ${d.empresa}${d.demo ? ' · DEMONSTRAÇÃO' : ''}`)}</style></head><body>
${d.demo ? '<div class="demo-wm"><span>DEMONSTRAÇÃO</span></div>' : ''}
<div class="barra-acoes"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>

<header class="head">
  <div class="head-mark">${marca}</div>
  <div>
    <h1>Pauta da Reunião 360</h1>
    <div class="head-sub">${esc(d.obraLabel)} · ${esc(d.periodoRotulo)}</div>
  </div>
  <div class="head-right">
    ${d.demo ? '<div class="chip-demo">DEMONSTRAÇÃO</div>' : ''}
    <div>${esc(d.empresa)}</div>
    ${d.organizacao ? `<div>${esc(d.organizacao)}</div>` : ''}
    <div>Emitido em ${fmtDataBR(d.hoje)}</div>
    ${d.emitidoPor ? `<div>por ${esc(d.emitidoPor)}</div>` : ''}
  </div>
</header>

<div class="recorte">${recorte.map((r) => `<span>${esc(r)}</span>`).join('')}</div>

<h2>Como está cada módulo<span class="cont">${atencao.length} ponto(s) de atenção</span></h2>
${blocoSinais(d.sinais)}
${naoRecortados.length > 0 ? `<div class="aviso">
  <strong>${naoRecortados.length} indicador(es) não respeitam o período</strong> e estão marcados como
  "acumulado": ${esc(naoRecortados.map((s) => s.modulo).join(', '))}. O dado de origem não tem data para
  recortar (EVM e Rede 360) ou não sincroniza com o servidor (Medição, que vive só no navegador de quem
  emitiu este relatório). Não use esses números para comparar uma reunião com a outra.
</div>` : ''}

<h2>Para onde foi o dinheiro<span class="cont">${d.periodoRotulo}</span></h2>
${blocoCustos(d.custos)}

${d.pauta && d.pauta.length > 0 ? `
<h2>Pontos da pauta<span class="cont">${d.pauta.length}</span></h2>
<ul class="pauta">${d.pauta.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}

<div class="assinaturas">
  <div>Conduzido por</div><div>Engenharia</div><div>Direção</div>
</div>

<div class="rodape">
  <span>${esc(d.empresa)}${d.organizacao ? ` · ${esc(d.organizacao)}` : ''}</span>
  <span>${esc(d.obraLabel)} · ${esc(d.periodoRotulo)}</span>
  <span>Emitido em ${fmtDataBR(d.hoje)}${d.emitidoPor ? ` por ${esc(d.emitidoPor)}` : ''}</span>
  <span class="marca">${brandMarkSvg(9, '#f97316')} ConstruData</span>
</div>
</body></html>`
}

// ─── Impressão ────────────────────────────────────────────────────────────────
// Mesmo par do relatório de boletos: janela aberta SÍNCRONA no clique (o browser bloqueia
// `window.open` disparado depois de um `await`), com o iframe oculto como plano B.

export function openReuniaoWindow(): Window | null {
  const win = window.open('', '_blank')
  if (!win) return null
  win.document.open()
  win.document.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Gerando a pauta…</title></head><body style="font:14px -apple-system,Segoe UI,Roboto,sans-serif;color:#334155;padding:32px">Gerando a pauta da reunião…</body></html>')
  win.document.close()
  return win
}

async function aguardarImagens(doc: Document): Promise<void> {
  await Promise.all([...doc.images].map((img) => img.decode().catch(() => undefined)))
}

export async function printReuniaoInto(win: Window, d: Reuniao360Data): Promise<void> {
  win.document.open()
  win.document.write(buildReuniao360Html(d))
  win.document.close()
  await aguardarImagens(win.document)
  win.focus()
  win.print()
}

/** Plano B quando o pop-up é bloqueado: imprime de um iframe oculto, sem abrir aba. */
export async function printReuniaoViaIframe(d: Reuniao360Data): Promise<void> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) { iframe.remove(); throw new Error('Não foi possível preparar a impressão.') }
  doc.open()
  doc.write(buildReuniao360Html(d))
  doc.close()
  await aguardarImagens(doc)
  const limpar = () => setTimeout(() => iframe.remove(), 1000)
  win.addEventListener('afterprint', limpar, { once: true })
  win.focus()
  win.print()
  // Safari não dispara afterprint de iframe: rede de segurança para não deixar lixo no DOM.
  setTimeout(limpar, 60_000)
}
