/**
 * obraDetailExport.ts — o dossiê de "Detalhe da Obra" (Torre de Controle), em PDF ou em dado cru.
 *
 * Padrão do repo: monta um HTML completo e chama `window.print()` numa janela nova (mesmo caminho
 * de `boletosReportExport.ts`, `relatorio360PdfExport.ts` etc.) — `buildObraDetailHtml` é PURA,
 * então dá para inspecionar o documento sem imprimir. `openReportWindow`/`printViaIframe` cobrem
 * o pop-up bloqueado, do mesmo jeito que o Financeiro já faz.
 *
 * ⚠️ Fotos e anexos da aba Documentos entram como LISTA (nome, tipo, data) — nunca embutidos como
 * imagem. Medido em sessão anterior: um mês de RDOs com fotos passa de 25 MB de HTML e o Chrome
 * para de disparar `print()` sozinho. Um dossiê de obra que incluísse anexo por anexo reabriria o
 * mesmo teto.
 *
 * `montarObraDetailData` é a segunda saída (JSON) — o mesmo recorte de campos, sem formatação de
 * tela, para quem quer o dado cru em vez do dossiê.
 */
import {
  valoresDoContrato, resumoFaturamento, subtotaisComposicao, itensOrdenados, calcServico,
  medidoAutoPorServico, categoriaDoItem,
} from './obraMedicao'
import { obraBacFromSite } from './obraBudget'
import { brandMarkSvg } from '@/lib/brandMark'
import { pageFooterCss } from '@/lib/printPageFooter'
import { fmtDataBR } from '@/lib/utils'
import type { ConstructionSite, ObraDocumento, RDO } from '@/types'

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

const brl = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })

const num3 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const DOC_TIPO_LABEL: Record<ObraDocumento['tipo'], string> = {
  contrato: 'Contrato', aditivo: 'Aditivo', proposta: 'Proposta', art: 'ART', nf: 'Nota fiscal', outro: 'Outro',
}

export interface ObraDetailExportContext {
  hoje: string
  emitidoPor?: string
  empresa?: string
}

function secao(titulo: string, inner: string): string {
  return `<section class="sec"><h2>${esc(titulo)}</h2>${inner}</section>`
}

function blocoResumo(site: ConstructionSite, ctx: ObraDetailExportContext): string {
  const valores = valoresDoContrato(site.contrato)
  const fat = resumoFaturamento(site.contrato, ctx.hoje)
  const bac = obraBacFromSite(site)
  const linhas: [string, string][] = [
    ['Orçamento (BAC)', bac > 0 ? brl(bac) : '— sem orçamento definido'],
    ['Contrato — Serviço', brl(valores.servico)],
    ['Contrato — Material', valores.material > 0 ? brl(valores.material) : '—'],
    ['Faturado', brl(fat.faturado)],
    ['Recebido', brl(fat.recebido)],
    ['A receber', `${brl(fat.aReceber)} (${fat.aReceberNotas} nota(s))`],
    ['Saldo do serviço', brl(fat.saldo)],
    ['Retenção a liberar', fat.retencao > 0 ? brl(fat.retencao) : '—'],
  ]
  const grid = linhas.map(([l, v]) => `<div><div class="t-label">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join('')
  return secao('Resumo', `<div class="grid-resumo">${grid}</div>`)
}

function blocoIdentificacao(site: ConstructionSite): string {
  const linhas: [string, string][] = [
    ['Endereço', `${site.street}, ${site.number} — ${site.district}`],
    ['Cidade', `${site.city} / ${site.state}`],
    ['Empresa', site.company || '—'],
    ['Dono', site.owner || '—'],
    ['Gerente', site.manager || '—'],
    ['Início', site.startDate || '—'],
    ['Previsão de término', site.expectedEnd || '—'],
  ]
  const grid = linhas.map(([l, v]) => `<div><div class="t-label">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join('')
  return secao('Identificação', `<div class="grid-resumo">${grid}</div>`)
}

function blocoComposicao(site: ConstructionSite): string {
  const services = itensOrdenados(site.contrato?.services ?? [])
  if (services.length === 0) return secao('Composição', '<p class="vazio">Nenhum serviço cadastrado no contrato.</p>')
  const sub = subtotaisComposicao(site.contrato?.services ?? [])
  const rows = services.map((s) => `<tr>
    <td>${esc(s.descricao)}</td>
    <td class="c">${esc(categoriaDoItem(s))}</td>
    <td class="c">${esc(s.unidade)}</td>
    <td class="r n">${num3(s.qtdContrato || 0)}</td>
    <td class="r n">${brl(s.valorUnitario || 0)}</td>
  </tr>`).join('')
  return secao('Composição', `<table>
    <thead><tr><th>Descrição</th><th class="c">Categoria</th><th class="c">Un.</th><th class="r">Qtd.</th><th class="r">Preço unit.</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="4">Subtotal serviço ${brl(sub.servico)} · material ${brl(sub.material)}</td><td class="r n">${brl(sub.total)}</td></tr></tfoot>
  </table>`)
}

function blocoMedicoes(site: ConstructionSite, rdos: RDO[]): string {
  const services = itensOrdenados(site.contrato?.services ?? [])
  if (services.length === 0) return secao('Medições', '<p class="vazio">Sem serviço cadastrado — nada para medir.</p>')
  const medidoAuto = medidoAutoPorServico(rdos, site.id)
  const rows = services.map((s) => {
    const c = calcServico(s, medidoAuto)
    return `<tr>
      <td>${esc(s.descricao)}</td>
      <td class="r n">${num3(c.medido)}</td>
      <td class="r n">${brl(c.valorBruto)}</td>
      <td class="r n">${num3(c.saldo)}</td>
      <td class="r n ${c.valorSaldo < 0 ? 'neg' : ''}">${brl(c.valorSaldo)}</td>
    </tr>`
  }).join('')
  return secao('Medições', `<table>
    <thead><tr><th>Descrição</th><th class="r">Medido</th><th class="r">Valor medido</th><th class="r">Saldo</th><th class="r">Valor do saldo</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`)
}

function blocoDocumentos(site: ConstructionSite): string {
  const docs = site.contrato?.documentos ?? []
  if (docs.length === 0) return secao('Documentos', '<p class="vazio">Nenhum documento anexado.</p>')
  // Lista de referência — nunca embutido. Ver o comentário de topo do arquivo.
  const rows = [...docs]
    .sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm))
    .map((d) => `<tr>
      <td>${esc(d.nome)}</td>
      <td class="c">${esc(DOC_TIPO_LABEL[d.tipo])}</td>
      <td class="c n">${fmtDataBR(d.enviadoEm.slice(0, 10))}</td>
      <td>${esc(d.enviadoPor || '—')}</td>
    </tr>`).join('')
  return secao('Documentos', `<table>
    <thead><tr><th>Nome</th><th class="c">Tipo</th><th class="c">Enviado em</th><th>Enviado por</th></tr></thead>
    <tbody>${rows}</tbody>
  </table><p class="vazio">Lista de referência — os arquivos ficam no Storage e não entram neste PDF.</p>`)
}

const CSS = `
:root { color-scheme: light only; forced-color-adjust: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
* { margin:0; padding:0; box-sizing:border-box; forced-color-adjust:none; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
html, body { background:#fff !important; color:#0f172a !important; }
@page { size: A4 portrait; margin: 12mm 12mm 16mm 12mm; }
body { font: 9.5pt/1.42 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; padding: 10mm 12mm; max-width: 210mm; margin: 0 auto; orphans:3; widows:3; }
@media print { body { padding: 0; max-width: none; } }
.n { font-variant-numeric: tabular-nums; }
.r { text-align:right } .c { text-align:center }
.neg { color:#b91c1c; }
.vazio { font-size:8.5pt; color:#64748b; font-style:italic; padding:6px 2px; }
.t-label { font-size:7pt; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#64748b; }
.v { font-size:9.5pt; font-weight:600; }
.head { display:grid; grid-template-columns:auto 1fr auto; gap:14px; align-items:center; border-bottom:3px solid #f97316; padding-bottom:10px; margin-bottom:10px; }
.head-mark { width:40px; height:40px; border-radius:10px; background:#0f172a; display:grid; place-items:center; }
.head h1 { font-size:15pt; font-weight:800; letter-spacing:-.01em; }
.head-sub { font-size:9pt; color:#475569; margin-top:1px; }
.head-right { text-align:right; font-size:7.5pt; color:#64748b; line-height:1.5; }
.grid-resumo { display:grid; grid-template-columns:repeat(3,1fr); gap:9px 14px; margin-bottom:4px; }
.sec { margin-bottom:14px; }
.sec > h2 { font-size:10pt; font-weight:700; color:#fff; background:#0f172a; padding:6px 11px; border-radius:6px 6px 0 0; break-after:avoid; }
table { width:100%; border-collapse:collapse; font-size:8.5pt; margin-top:0; }
thead { display: table-header-group; }
th { background:#f1f5f9; color:#334155; padding:5px 8px; text-align:left; font-size:7.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid #cbd5e1; }
td { padding:5px 8px; border-bottom:1px solid #eef2f7; vertical-align:top; overflow-wrap:anywhere; }
tfoot td { font-weight:700; background:#f8fafc; border-top:1px solid #cbd5e1; }
tr { break-inside: avoid; }
.rodape { margin-top:16px; display:flex; flex-wrap:wrap; justify-content:space-between; gap:4px 12px; font-size:6.8pt; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:5px; }
.barra-acoes { position:sticky; top:0; display:flex; justify-content:flex-end; gap:8px; padding:8px 0 12px; background:#fff; }
.barra-acoes button { border:1px solid #0f172a; background:#0f172a; color:#fff; border-radius:6px; padding:7px 14px; font-size:9pt; font-weight:700; cursor:pointer; }
@media print { .barra-acoes { display:none !important; } }
`

export function buildObraDetailHtml(site: ConstructionSite, rdos: RDO[], ctx: ObraDetailExportContext): string {
  const empresa = ctx.empresa || site.company || 'ConstruData'
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Detalhe da obra — ${esc(site.name)}</title>
<style>${CSS}</style>
<style>${pageFooterCss(`Detalhe da obra · ${site.name} · ${fmtDataBR(ctx.hoje)}`)}</style></head><body>
<div class="barra-acoes"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
<header class="head">
  <div class="head-mark">${brandMarkSvg(24, '#f97316')}</div>
  <div><h1>${esc(site.name)}</h1><div class="head-sub">${esc(site.code || '')}</div></div>
  <div class="head-right">
    <div>${esc(empresa)}</div>
    <div>Emitido em ${fmtDataBR(ctx.hoje)}</div>
    ${ctx.emitidoPor ? `<div>por ${esc(ctx.emitidoPor)}</div>` : ''}
  </div>
</header>
${blocoIdentificacao(site)}
${blocoResumo(site, ctx)}
${blocoComposicao(site)}
${blocoMedicoes(site, rdos)}
${blocoDocumentos(site)}
<div class="rodape">
  <span>${esc(empresa)}</span>
  <span>${esc(site.name)}</span>
  <span>Gerado por ConstruData</span>
</div>
</body></html>`
}

// ─── JSON — o dado cru, ao lado do dossiê formatado ────────────────────────────

/** O mesmo recorte do PDF, sem formatação de tela — para quem quer o dado em vez do dossiê. */
export function montarObraDetailJson(site: ConstructionSite, ctx: ObraDetailExportContext) {
  const bac = obraBacFromSite(site)
  return {
    obra: {
      id: site.id, nome: site.name, codigo: site.code, status: site.status,
      endereco: { rua: site.street, numero: site.number, bairro: site.district, cidade: site.city, estado: site.state, cep: site.cep },
      inicio: site.startDate, previsaoTermino: site.expectedEnd,
    },
    // `null`, não 0: obra sem orçamento definido não "vale zero" — ver obraBudget.ts.
    orcamentoBac: bac > 0 ? bac : null,
    contrato: valoresDoContrato(site.contrato),
    faturamento: resumoFaturamento(site.contrato, ctx.hoje),
    composicao: itensOrdenados(site.contrato?.services ?? []),
    documentos: site.contrato?.documentos ?? [],
    geradoEm: ctx.hoje,
  }
}

export function baixarObraDetailJson(site: ConstructionSite, ctx: ObraDetailExportContext): void {
  const data = montarObraDetailJson(site, ctx)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `obra-${(site.code || site.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${ctx.hoje}.json`
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

// ─── Impressão ────────────────────────────────────────────────────────────────

/**
 * Abre a janela do relatório. **Chame SÍNCRONA no clique**, antes de qualquer `await` — o browser
 * bloqueia `window.open` disparado depois de uma promessa. `null` = bloqueado; use `printObraDetailViaIframe`.
 */
export function openObraDetailWindow(): Window | null {
  const win = window.open('', '_blank')
  if (!win) return null
  win.document.open()
  win.document.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Gerando relatório…</title></head><body style="font:14px -apple-system,Segoe UI,Roboto,sans-serif;color:#334155;padding:32px">Gerando o relatório…</body></html>')
  win.document.close()
  return win
}

export function printObraDetailInto(win: Window, site: ConstructionSite, rdos: RDO[], ctx: ObraDetailExportContext): void {
  const html = buildObraDetailHtml(site, rdos, ctx)
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

/** Plano B para pop-up bloqueado: imprime de um iframe oculto, sem abrir aba. */
export function printObraDetailViaIframe(site: ConstructionSite, rdos: RDO[], ctx: ObraDetailExportContext): void {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) { iframe.remove(); throw new Error('Não foi possível preparar a impressão.') }
  doc.open()
  doc.write(buildObraDetailHtml(site, rdos, ctx))
  doc.close()
  const limpar = () => setTimeout(() => iframe.remove(), 1000)
  win.addEventListener('afterprint', limpar, { once: true })
  win.focus()
  win.print()
  setTimeout(limpar, 60_000)
}
