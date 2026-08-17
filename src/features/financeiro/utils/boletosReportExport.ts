/**
 * boletosReportExport.ts — Relatório de Boletos em A4, para imprimir ou salvar em PDF.
 *
 * Padrão do repo: monta um HTML completo e chama `window.print()` numa janela nova
 * (espelha predialReportExport.ts / relatorio360PdfExport.ts). `buildBoletosReportHtml`
 * é PURA — string entra, string sai —, então dá para inspecionar o documento sem imprimir.
 *
 * O documento responde às três perguntas de quem cuida do financeiro de uma obra ou de um
 * prédio, nesta ordem: **o que vence** (agenda por mês), **como pagar** (ficha com a linha
 * digitável de cada parcela) e **com quem estou exposto** (concentração por beneficiário).
 *
 * Regra do pop-up: `openReportWindow()` tem de ser chamada SÍNCRONA no clique, antes de
 * qualquer `await` — senão o browser bloqueia. Se ainda assim vier bloqueado, o
 * `printViaIframe` imprime sem abrir aba.
 */
import { formatarCodigo, tamanhoValido, digitosDe } from './boletoCodigo'
import { brandMarkSvg } from '@/lib/brandMark'
import { pageFooterCss } from '@/lib/printPageFooter'
import { fmtDataBR } from '@/lib/utils'

// ─── Entrada ──────────────────────────────────────────────────────────────────

export interface BoletoReportParcela {
  num?: number
  de?: number
  vencimento: string                 // yyyy-MM-dd
  valor: number
  status: 'pendente' | 'pago' | 'cancelado'
  dataPagamento?: string
  /** Linha digitável só com dígitos — este módulo formata e valida. */
  codigo?: string
}

export interface BoletoReportAnexo {
  nome: string
  /** `null` = não foi possível incorporar (offline, sem permissão, modo Demo ou é PDF). */
  dataUrl: string | null
}

export interface BoletoReportItem {
  tipo: 'pagar' | 'receber'
  descricao: string
  parceiro: string
  obraLabel: string
  categoriaLabel?: string
  notas?: string
  /** `yyyy-MM-dd` no fuso LOCAL (o chamador converte; um timestamp UTC deslocaria um dia). */
  criadoEm?: string
  /** Já recortadas pelo período/situação escolhidos. */
  parcelas: BoletoReportParcela[]
  /** Total de parcelas do carnê — para dizer "3 de 6 parcelas no período". */
  parcelasTotais: number
  anexos: BoletoReportAnexo[]
}

export interface BoletosReportSections {
  agenda: boolean
  fichas: boolean
  codigos: boolean
  concentracao: boolean
  fotos: boolean
  assinaturas: boolean
}

export interface BoletosReportData {
  empresa: string
  organizacao?: string
  obraLabel: string
  contrato?: string
  cidade?: string
  emitidoPor?: string
  demo: boolean
  /** dataURL do logo do cliente; sem ele, entra a marca ConstruData vetorial. */
  logoDataUrl?: string | null
  /** Injetado pelo chamador: mantém o documento determinístico e no fuso local. */
  hoje: string
  /** O recorte por extenso ("Tipo: A pagar", "Vencimentos: 01/08 a 31/08"…). */
  recorte: string[]
  itens: BoletoReportItem[]
  secoes: BoletosReportSections
}

// ─── Formatação ───────────────────────────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

const brl = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
/** Meio-dia evita o deslocamento de um dia que `new Date('yyyy-MM-dd')` (UTC) causa no BRT. */
const diaSemana = (iso: string) => DIAS[new Date(iso + 'T12:00:00').getDay()]
const mesChave  = (iso: string) => iso.slice(0, 7)
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const mesLabel = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`

const diasAte = (venc: string, hoje: string) =>
  Math.round((new Date(venc + 'T12:00:00').getTime() - new Date(hoje + 'T12:00:00').getTime()) / 86_400_000)

type Situacao = 'pago' | 'vencido' | 'alerta' | 'aberto'
function situacaoDe(p: BoletoReportParcela, hoje: string): Situacao {
  if (p.status === 'pago') return 'pago'
  const d = diasAte(p.vencimento, hoje)
  if (d < 0) return 'vencido'
  if (d <= 7) return 'alerta'
  return 'aberto'
}
/** Glifo + peso além da cor: o documento tem de ser legível impresso em preto e branco. */
function chipSituacao(p: BoletoReportParcela, hoje: string): string {
  const s = situacaoDe(p, hoje)
  if (s === 'pago') return '<span class="st st-pago">✓ PAGO</span>'
  if (s === 'vencido') return `<span class="st st-vencido">! VENCIDO ${-diasAte(p.vencimento, hoje)}d</span>`
  if (s === 'alerta') return `<span class="st st-alerta">» ${diasAte(p.vencimento, hoje)}d</span>`
  return '<span class="st st-aberto">EM ABERTO</span>'
}

// ─── Agregados ────────────────────────────────────────────────────────────────

interface Linha extends BoletoReportParcela { item: BoletoReportItem }

function todasAsParcelas(d: BoletosReportData): Linha[] {
  return d.itens
    .flatMap((item) => item.parcelas.map((p) => ({ ...p, item })))
    // Desempate por descrição: mesmo conjunto de dados sempre gera o mesmo documento.
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.item.descricao.localeCompare(b.item.descricao))
}

function kpis(linhas: Linha[], hoje: string) {
  const pagas    = linhas.filter((l) => l.status === 'pago')
  const abertas  = linhas.filter((l) => l.status !== 'pago')
  const vencidas = abertas.filter((l) => diasAte(l.vencimento, hoje) < 0)
  const em7      = abertas.filter((l) => { const x = diasAte(l.vencimento, hoje); return x >= 0 && x <= 7 })
  const soma     = (xs: Linha[]) => xs.reduce((s, l) => s + l.valor, 0)
  const total    = soma(linhas)
  const proxima  = abertas.filter((l) => diasAte(l.vencimento, hoje) >= 0)[0]
  return {
    boletos: new Set(linhas.map((l) => l.item)).size,
    parcelas: linhas.length,
    total,
    pago: soma(pagas),
    pctPago: total > 0 ? Math.round((soma(pagas) / total) * 100) : 0,
    aberto: soma(abertas),
    vencidasN: vencidas.length, vencidasR: soma(vencidas),
    em7N: em7.length, em7R: soma(em7),
    proxima,
  }
}

// ─── Blocos ───────────────────────────────────────────────────────────────────

function kpi(label: string, valor: string, sub = '', tom = '') {
  return `<div class="kpi${tom ? ' ' + tom : ''}"><div class="t-label">${label}</div><div class="kpi-value n">${valor}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`
}

/**
 * Indicadores do recorte: QUATRO cartões e uma linha de contexto.
 *
 * Quando o recorte tem os dois tipos, sai UMA FAIXA POR TIPO: somar "a pagar" com "a receber"
 * num total único produz um número que não significa nada — e o corpo do documento, que é
 * separado por tipo, não fecharia com o topo.
 *
 * Eram oito cartões. Com "a pagar" e "a receber" no mesmo recorte viravam dezesseis, medidos em
 * 70 mm — mais de um quarto da primeira folha, antes de o documento dizer qualquer coisa. Nada
 * de informação se perdeu: o que saiu dos cartões (boletos, parcelas, já pago, próximo
 * vencimento, beneficiários) desceu para a linha de contexto logo abaixo.
 *
 * Os quatro que ficaram são os que mudam uma decisão: quanto é o recorte, quanto falta pagar, o
 * que já venceu e o que vence nesta semana. Os outros respondem "como chegamos aqui", e para
 * isso uma linha de texto basta.
 */
function blocoKpis(linhas: Linha[], hoje: string, rotulo?: string): string {
  const k = kpis(linhas, hoje)
  const benef = new Set(linhas.map((l) => l.item.parceiro || '—')).size
  const rotuloParceiro = rotulo === 'A receber' ? 'pagador' : 'beneficiário'
  const contexto = [
    `${k.boletos} boleto(s) · ${k.parcelas} parcela(s)`,
    `já pago ${brl(k.pago)} (${k.pctPago}%)`,
    k.proxima
      ? `próximo vencimento ${fmtDataBR(k.proxima.vencimento)} — ${brl(k.proxima.valor)}`
      : 'nada em aberto',
    `${benef} ${rotuloParceiro}${benef === 1 ? '' : 's'}`,
  ].join(' · ')

  return `${rotulo ? `<div class="kpi-grupo">${esc(rotulo)}</div>` : ''}<div class="kpis">
    ${kpi('Total no recorte', brl(k.total))}
    ${kpi('Em aberto', brl(k.aberto), `${100 - k.pctPago}% do total`)}
    ${kpi('Vencido', brl(k.vencidasR), `${k.vencidasN} parcela(s)`, k.vencidasN > 0 ? 'is-late' : '')}
    ${kpi('Vence em 7 dias', brl(k.em7R), `${k.em7N} parcela(s)`, k.em7N > 0 ? 'is-soon' : '')}
  </div><p class="kpi-contexto">${contexto}</p>`
}

function secao(titulo: string, contador: string, inner: string) {
  return `<section class="sec"><h2>${esc(titulo)}${contador ? `<span class="cnt">${esc(contador)}</span>` : ''}</h2>${inner}</section>`
}

/**
 * Agenda de vencimentos: UMA tabela, com os meses como faixas dentro do corpo.
 *
 * Antes era uma tabela por mês, cada uma com o seu `<thead>`. Num carnê de 12 parcelas isso
 * imprimia doze vezes a mesma linha "VENC. · DIA · SITUAÇÃO · DESCRIÇÃO · PARCELA · OBRA ·
 * VALOR" para mostrar UMA parcela embaixo de cada — o cabeçalho ocupava mais papel que o dado.
 * Numa tabela só, o `thead` continua repetindo a cada página impressa (é para isso que serve o
 * `display:table-header-group`), e não a cada mês.
 *
 * A coluna "Obra" some quando o recorte é de uma obra só: ela já está no cabeçalho do
 * documento, e repeti-la em 17 linhas é ruído que rouba largura da descrição.
 */
function blocoAgenda(linhas: Linha[], hoje: string): string {
  if (linhas.length === 0) return '<p class="vazio">Nenhuma parcela no recorte.</p>'
  const meses = new Map<string, Linha[]>()
  for (const l of linhas) {
    const k = mesChave(l.vencimento)
    const arr = meses.get(k); if (arr) arr.push(l); else meses.set(k, [l])
  }
  const comObra = new Set(linhas.map((l) => l.item.obraLabel)).size > 1
  const colunas = comObra ? 7 : 6

  const corpo = [...meses.entries()].map(([ym, ls]) => {
    // O subtotal é por TIPO quando o mês tem os dois: um valor único somando o que se paga
    // com o que se recebe não quer dizer nada (mesma regra dos indicadores do topo).
    const soma = (xs: Linha[]) => xs.reduce((s, l) => s + l.valor, 0)
    const abertasDo = (t: 'pagar' | 'receber') => ls.filter((l) => l.status !== 'pago' && l.item.tipo === t)
    const doisTipos = new Set(ls.map((l) => l.item.tipo)).size > 1
    const pago   = soma(ls.filter((l) => l.status === 'pago'))
    const aberto = soma(ls.filter((l) => l.status !== 'pago'))
    const resumoAberto = doisTipos
      ? `a pagar <strong>${brl(soma(abertasDo('pagar')))}</strong> · a receber <strong>${brl(soma(abertasDo('receber')))}</strong>`
      : `em aberto <strong>${brl(aberto)}</strong>`

    const rows = ls.map((l) => `<tr class="${situacaoDe(l, hoje) === 'vencido' ? 'row-vencido' : l.status === 'pago' ? 'row-pago' : ''}">
      <td class="n">${fmtDataBR(l.vencimento).slice(0, 5)}</td>
      <td class="c n">${diaSemana(l.vencimento)}</td>
      <td>${chipSituacao(l, hoje)}</td>
      <td>${esc(l.item.descricao)}<div class="sub">${esc(l.item.parceiro || '—')}</div></td>
      <td class="c n">${l.num && l.de ? `${l.num}/${l.de}` : '—'}</td>
      ${comObra ? `<td>${esc(l.item.obraLabel)}</td>` : ''}
      <td class="r n">${brl(l.valor)}</td>
    </tr>`).join('')

    return `<tr class="mes-row"><td colspan="${colunas}">${mesLabel(ym)}<span class="tot">${ls.length} parcela(s) · ${resumoAberto}${pago > 0 ? ` · pago ${brl(pago)}` : ''}</span></td></tr>${rows}`
  }).join('')

  return `<table class="agenda">
    <thead><tr>
      <th>Venc.</th><th class="c">Dia</th><th>Situação</th><th>Descrição</th>
      <th class="c">Parcela</th>${comObra ? '<th>Obra</th>' : ''}<th class="r">Valor</th>
    </tr></thead>
    <tbody>${corpo}</tbody>
  </table>`
}

function blocoCodigo(p: BoletoReportParcela, mostrar: boolean): string {
  if (!mostrar) return ''
  const d = digitosDe(p.codigo)
  if (!d) return '<tr class="cod-row"><td colspan="5"><span class="cod-vazio">linha digitável não cadastrada</span></td></tr>'
  // Código fora do padrão é impresso do mesmo jeito, com aviso: esconder o suspeito é pior.
  const aviso = tamanhoValido(d) ? '' : `<span class="cod-aviso">conferir · ${d.length} dígitos</span>`
  return `<tr class="cod-row"><td colspan="5"><span class="t-label">Linha digitável</span><span class="cod">${esc(formatarCodigo(d))}</span> ${aviso}</td></tr>`
}

function blocoFicha(item: BoletoReportItem, hoje: string, comCodigo: boolean): string {
  const total = item.parcelas.reduce((s, p) => s + p.valor, 0)
  const pagas = item.parcelas.filter((p) => p.status === 'pago').length
  const parcial = item.parcelas.length < item.parcelasTotais
  // Só afirma quitação quando o recorte contém o CARNÊ INTEIRO e tudo está pago. Comparar com
  // `item.parcelas.length` (o pedaço) carimbaria QUITADO num boleto com 11 parcelas em aberto
  // sempre que o recorte cortasse — e, na situação "só pagas", em todas as fichas.
  const quitado = !parcial && pagas === item.parcelas.length && pagas > 0
  const rows = item.parcelas.map((p) => `<tr class="${situacaoDe(p, hoje) === 'vencido' ? 'row-vencido' : p.status === 'pago' ? 'row-pago' : ''}">
      <td class="c n">${p.num && p.de ? `${p.num}/${p.de}` : '—'}</td>
      <td class="n">${fmtDataBR(p.vencimento)}</td>
      <td>${chipSituacao(p, hoje)}</td>
      <td class="c n">${p.dataPagamento ? fmtDataBR(p.dataPagamento) : '—'}</td>
      <td class="r n">${brl(p.valor)}</td>
    </tr>${blocoCodigo(p, comCodigo)}`).join('')
  const meta = ([
    // O nome do parceiro é o campo mais longo e o mais consultado: fica sozinho na primeira
    // linha, com a largura toda, em vez de espremido num quarto dela.
    [item.tipo === 'pagar' ? 'Beneficiário' : 'Pagador', item.parceiro || '—', true],
    ['Obra', item.obraLabel, false],
    ['Categoria', item.categoriaLabel ?? '—', false],
    ['Cadastrado em', fmtDataBR(item.criadoEm), false],   // já vem yyyy-MM-dd no fuso local
  ] as [string, string, boolean][])
    .map(([l, v, largo]) => `<div${largo ? ' class="largo"' : ''}><div class="t-label">${esc(l)}</div><div>${esc(v)}</div></div>`)
    .join('')
  return `<article class="ficha${item.parcelas.length > 8 ? ' grande' : ''}">
    <header class="ficha-h">
      <span class="chip chip-${item.tipo}">${item.tipo === 'pagar' ? 'A PAGAR' : 'A RECEBER'}</span>
      <div><strong>${esc(item.descricao)}</strong>${quitado ? ' <span class="st st-pago">QUITADO</span>' : ''}
        <div class="sub">${pagas}/${item.parcelas.length} paga(s)${parcial ? ` · ${item.parcelas.length} de ${item.parcelasTotais} parcelas no recorte` : ''}${quitado ? '' : parcial && pagas === item.parcelas.length ? ' · as demais ficaram fora do recorte' : ''}</div>
      </div>
      <strong class="n">${brl(total)}</strong>
    </header>
    <div class="ficha-meta">${meta}</div>
    <table>
      <thead><tr><th class="c">#</th><th>Vencimento</th><th>Situação</th><th class="c">Pago em</th><th class="r">Valor</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${item.notas ? `<p class="notas"><strong>Notas:</strong> ${esc(item.notas)}</p>` : ''}
  </article>`
}

function blocoConcentracao(linhas: Linha[], rotulo?: string): string {
  const abertas = linhas.filter((l) => l.status !== 'pago')
  if (abertas.length === 0) return `${rotulo ? `<div class="kpi-grupo">${esc(rotulo)}</div>` : ''}<p class="vazio">Nada em aberto no recorte.</p>`
  const porParceiro = new Map<string, { valor: number; n: number }>()
  for (const l of abertas) {
    const k = l.item.parceiro || '(sem beneficiário)'
    const cur = porParceiro.get(k) ?? { valor: 0, n: 0 }
    porParceiro.set(k, { valor: cur.valor + l.valor, n: cur.n + 1 })
  }
  const totalAberto = abertas.reduce((s, l) => s + l.valor, 0)
  const top = [...porParceiro.entries()].sort((a, b) => b[1].valor - a[1].valor).slice(0, 8)
  const rows = top.map(([nome, v], i) => {
    const pct = totalAberto > 0 ? Math.round((v.valor / totalAberto) * 100) : 0
    return `<tr>
      <td>${i + 1}. ${esc(nome)}</td>
      <td class="c n">${v.n}</td>
      <td class="r n">${brl(v.valor)}</td>
      <td class="barra"><span style="width:${pct}%"></span><em class="n">${pct}%</em></td>
    </tr>`
  }).join('')
  return `${rotulo ? `<div class="kpi-grupo">${esc(rotulo)}</div>` : ''}<table>
    <thead><tr><th>${rotulo === 'A receber' ? 'Pagador' : 'Beneficiário'}</th><th class="c">Parcelas</th><th class="r">Em aberto</th><th>Participação</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

function blocoFotos(d: BoletosReportData): string {
  const fotos = d.itens.flatMap((i) => i.anexos.filter((a) => a.dataUrl).map((a) => ({ a, i })))
  const faltando = d.itens.reduce((s, i) => s + i.anexos.filter((a) => !a.dataUrl).length, 0)
  if (fotos.length === 0 && faltando === 0) return ''
  const grid = fotos.map(({ a, i }) => `<figure class="foto">
    <img src="${a.dataUrl}" alt="${esc(a.nome)}" />
    <figcaption>${esc(i.descricao)} · ${esc(a.nome)}</figcaption>
  </figure>`).join('')
  // Anexo que não entrou é declarado, nunca sumido em silêncio.
  const nota = faltando > 0
    ? `<p class="vazio">${faltando} anexo(s) não puderam ser incorporados (arquivo em PDF, sem conexão, sem permissão ou modo demonstração).</p>`
    : ''
  // A partir de 4 a galeria já enche uma folha; abaixo disso ela flui atrás do que veio antes.
  const classe = fotos.length >= 4 ? 'fotos muitas' : 'fotos'
  return `<div class="${classe}">${secao('Comprovação — anexos', `${fotos.length} imagem(ns)`, `<div class="fotos-grid">${grid}</div>${nota}`)}</div>`
}

// ─── Documento ────────────────────────────────────────────────────────────────

const CSS = `
/* Blindagem: o relatório é sempre claro, mesmo com o SO em modo escuro.
   color-scheme light-only + fundo e cor explícitos no html/body já neutralizam a folha de
   estilo escura do navegador. Forçar background-color:inherit em todo div/td/th (como faz o
   export de FVS) NÃO serve aqui: lá o documento é um formulário sem cor; aqui os fundos
   carregam significado, e a regra apagava os cards de indicador, o cabeçalho das tabelas,
   a faixa de mês e a barra de concentração. */
:root { color-scheme: light only; forced-color-adjust: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
* { margin:0; padding:0; box-sizing:border-box; forced-color-adjust:none; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
html, body { background:#fff !important; background-color:#fff !important; color:#0f172a !important; }
@media (prefers-color-scheme: dark) {
  html, body { background:#fff !important; background-color:#fff !important; color:#0f172a !important; }
}
@media print { html, body { background:#fff !important; background-color:#fff !important; } }
@page { size: A4 portrait; margin: 12mm 12mm 16mm 12mm; }
/* Na tela a margem vem do padding (a pré-visualização fica com cara de página);
   na impressão quem manda é a @page, senão a margem dobraria. */
body { font: 9.5pt/1.42 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; padding: 10mm 12mm; max-width: 210mm; margin: 0 auto; orphans:3; widows:3; }
@media print { body { padding: 0; max-width: none; } }
/* O overflow-wrap:anywhere do <td> (necessário para descrições e nomes longos) estava partindo
   valor de dinheiro no meio: numa coluna estreita, "R$ 8.450,00" saía como "R$ 8.450" numa linha
   e ",00" na seguinte — o leitor lê oito mil e quatrocentos e cinquenta. "dom" virava "do"/"m".
   Número não quebra, nunca: se não couber, a coluna é que tem de ceder. */
.n { font-variant-numeric: tabular-nums; white-space: nowrap; overflow-wrap: normal; word-break: normal; }
.r { text-align:right } .c { text-align:center }
.sub { font-size:7.5pt; color:#94a3b8; }
.vazio { font-size:8.5pt; color:#64748b; font-style:italic; padding:6px 2px; }
.t-label { font-size:7pt; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#64748b; }

.head { display:grid; grid-template-columns:auto 1fr auto; gap:14px; align-items:center; border-bottom:3px solid #f97316; padding-bottom:10px; margin-bottom:10px; }
.head-mark { width:46px; height:46px; border-radius:10px; background:#0f172a; display:grid; place-items:center; overflow:hidden; }
.head-mark img { width:100%; height:100%; object-fit:contain; background:#fff; padding:3px; }
.head h1 { font-size:17pt; font-weight:800; letter-spacing:-.01em; }
.head-sub { font-size:9pt; color:#475569; margin-top:1px; }
.head-right { text-align:right; font-size:7.5pt; color:#64748b; line-height:1.5; }
.chip-demo { display:inline-block; background:#fef3c7; color:#92400e; border:1px solid #fcd34d; border-radius:999px; padding:1px 8px; font-size:7.5pt; font-weight:800; letter-spacing:.06em; }

.recorte { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:11px; }
.recorte span { border:1px solid #e2e8f0; background:#f8fafc; border-radius:999px; padding:2px 9px; font-size:7.5pt; color:#334155; }

.kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; margin-bottom:4px; }
.kpi { border:1px solid #e2e8f0; border-left:3px solid #cbd5e1; border-radius:8px; padding:7px 9px; background:#f8fafc; }
.kpi.is-late { border-left-color:#b91c1c; background:#fef2f2; }
.kpi.is-soon { border-left-color:#b45309; background:#fffbeb; }
.kpi.is-paid { border-left-color:#15803d; background:#f0fdf4; }
.kpi-value { font-size:12.5pt; font-weight:800; line-height:1.2; }
.kpi-sub { font-size:7pt; color:#64748b; }
.kpi-nota { font-size:7pt; color:#94a3b8; margin:4px 0 13px; }
.kpi-grupo { font-size:8pt; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:#334155; margin:6px 0 4px; break-after:avoid; }
/* O que saiu dos cartões (ver blocoKpis): mesma informação, um quarto do papel. */
.kpi-contexto { font-size:7.5pt; color:#475569; margin:4px 2px 9px; font-variant-numeric:tabular-nums; }

.sec { margin-bottom:14px; }
.sec > h2 { font-size:10pt; font-weight:700; color:#fff; background:#0f172a; padding:6px 11px; border-radius:6px 6px 0 0; break-after:avoid; display:flex; align-items:center; gap:8px; }
.sec > h2::before { content:''; width:7px; height:7px; border-radius:50%; background:#f97316; flex:none; }
.sec > h2 .cnt { margin-left:auto; font-size:8pt; font-weight:600; opacity:.75; }

table { width:100%; border-collapse:collapse; font-size:8.5pt; }
thead { display: table-header-group; }   /* cabeçalho repete a cada página */
th { background:#f1f5f9; color:#334155; padding:5px 8px; text-align:left; font-size:7.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid #cbd5e1; }
td { padding:5px 8px; border-bottom:1px solid #eef2f7; vertical-align:top; overflow-wrap:anywhere; }
tr { break-inside: avoid; }
tr.row-vencido td { background:#fef2f2; }
tr.row-vencido td:first-child { border-left:3px solid #b91c1c; }
tr.row-pago td { color:#475569; }
/* A linha digitável ocupa a largura toda (47 dígitos formatados não cabem numa coluna),
   mas recuada e rotulada — solta na margem, parecia que escapava da ficha. */
tr.cod-row td { border-bottom:1px solid #eef2f7; padding:0 8px 5px 34px; background:#fbfcfe; }
tr.cod-row .t-label { display:inline-block; margin-right:7px; }
/* A parcela e a sua linha digitável são duas <tr>: sem isto, a quebra de página cai entre as
   duas e o código aparece órfão no topo da folha seguinte, sem dizer de que parcela é. */
.ficha tbody tr:not(.cod-row) { break-after: avoid; }

.st { display:inline-block; font-size:7.5pt; font-weight:800; letter-spacing:.03em; padding:1px 6px; border-radius:4px; border:1px solid currentColor; white-space:nowrap; }
.st-pago{color:#15803d} .st-vencido{color:#b91c1c} .st-alerta{color:#b45309} .st-aberto{color:#475569}
.chip { font-size:7.5pt; font-weight:800; letter-spacing:.04em; padding:2px 7px; border-radius:4px; white-space:nowrap; }
.chip-pagar { background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; }
.chip-receber { background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }

.mes-h { display:flex; align-items:baseline; gap:8px; padding:5px 9px; margin-top:9px; background:#f8fafc; border-left:3px solid #0f172a; font-size:9pt; font-weight:800; break-after:avoid; }
.mes-h .tot { margin-left:auto; font-weight:600; font-size:8pt; color:#475569; font-variant-numeric:tabular-nums; }
/* Faixa de mês DENTRO da tabela da agenda (uma tabela só, ver blocoAgenda). O break-after:avoid
   impede que o mês fique sozinho no pé da folha, com as parcelas na página seguinte. */
tr.mes-row td { padding:6px 9px 5px; background:#f1f5f9; border-top:1px solid #cbd5e1; border-bottom:1px solid #cbd5e1; font-size:9pt; font-weight:800; }
tr.mes-row { break-after: avoid; break-inside: avoid; }
tr.mes-row .tot { float:right; font-weight:600; font-size:8pt; color:#475569; font-variant-numeric:tabular-nums; }
/* Colunas estreitas e de largura previsível; a descrição fica com o que sobra. */
table.agenda th:first-child, table.agenda td:first-child { width:12mm; }
table.agenda th:nth-child(2), table.agenda td:nth-child(2) { width:9mm; }
table.agenda th:nth-child(3), table.agenda td:nth-child(3) { width:22mm; }
table.agenda th:nth-child(5), table.agenda td:nth-child(5) { width:14mm; }
table.agenda th:last-child, table.agenda td:last-child { width:24mm; }

.ficha { border:1px solid #cbd5e1; border-radius:8px; margin-bottom:9px; break-inside:avoid; overflow:hidden; }
.ficha.grande { break-inside:auto; }
.ficha-h { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:9px; align-items:center; padding:7px 10px; background:#f8fafc; border-bottom:1px solid #e2e8f0; }
.ficha-h > div { min-width:0; overflow-wrap:anywhere; }
/* Razão social de empresa passa fácil dos 60 caracteres e não tem espaço onde quebrar; sem isto
   ela empurrava o valor total para fora do cabeçalho da ficha. Duas colunas em vez de quatro
   dão o dobro de largura para o nome, e o campo do parceiro atravessa a linha inteira. */
.ficha-meta { display:grid; grid-template-columns:repeat(2,1fr); gap:6px 12px; padding:7px 10px; border-bottom:1px solid #eef2f7; font-size:8.5pt; }
.ficha-meta > div { min-width:0; overflow-wrap:anywhere; }
.ficha-meta > div.largo { grid-column:1 / -1; }
.cod { font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace; font-size:8.5pt; letter-spacing:.02em; word-break:break-all; }
.cod-aviso { font-size:7pt; font-weight:700; color:#b45309; }
.cod-vazio { font-style:italic; font-size:7.5pt; color:#94a3b8; }
.notas { margin:8px 10px; padding:6px 9px; background:#f8fafc; border-left:3px solid #cbd5e1; font-size:8pt; color:#334155; }

td.barra { position:relative; width:26%; }
td.barra span { display:inline-block; height:7px; background:#f97316; border-radius:2px; vertical-align:middle; min-width:2px; }
td.barra em { font-style:normal; font-size:7.5pt; color:#64748b; margin-left:5px; }

/* Só vai para folha nova quando são muitas: forçar uma página inteira por causa de UM
   comprovante deixava metade de uma folha em branco em quase todo relatório. */
.fotos.muitas { break-before: page; }
.fotos-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:9px; padding-top:9px; }
.foto { border:1px solid #cbd5e1; border-radius:6px; overflow:hidden; break-inside:avoid; }
.foto img { display:block; width:100%; height:78mm; object-fit:contain; background:#fff; }
.foto figcaption { padding:4px 7px; font-size:7.5pt; color:#475569; border-top:1px solid #eef2f7; }

.assinaturas { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-top:22px; break-inside:avoid; }
.assinaturas div { border-top:1px solid #0f172a; padding-top:4px; text-align:center; font-size:7.5pt; color:#475569; }

.rodape { margin-top:16px; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:4px 12px; font-size:6.8pt; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:5px; }
.rodape .marca { display:inline-flex; align-items:center; gap:4px; flex:none; white-space:nowrap; }

.demo-wm { position:fixed; inset:0; display:grid; place-items:center; pointer-events:none; z-index:0; }
.demo-wm span { transform:rotate(-32deg); font-size:64pt; font-weight:900; color:#0f172a; opacity:.038; letter-spacing:.15em; }
body > *:not(.demo-wm) { position:relative; z-index:1; }

.barra-acoes { position:sticky; top:0; display:flex; justify-content:flex-end; gap:8px; padding:8px 0 12px; background:#fff; }
.barra-acoes button { border:1px solid #0f172a; background:#0f172a; color:#fff; border-radius:6px; padding:7px 14px; font-size:9pt; font-weight:700; cursor:pointer; }
@media print { .barra-acoes { display:none !important; } }
`

export function buildBoletosReportHtml(d: BoletosReportData): string {
  const linhas = todasAsParcelas(d)
  const k = kpis(linhas, d.hoje)
  const s = d.secoes

  const marca = d.logoDataUrl
    ? `<img src="${d.logoDataUrl}" alt="${esc(d.empresa)}" />`
    : brandMarkSvg(25, '#f97316')

  const subCabecalho = [d.obraLabel, d.contrato && `contrato ${d.contrato}`, d.cidade].filter(Boolean).join(' · ')

  // Quando o recorte tem os dois tipos, o corpo se divide: somar "a pagar" com "a receber"
  // num total único produziria um número que não significa nada.
  const tipos = [...new Set(d.itens.map((i) => i.tipo))]
  const corpoFichas = tipos.length <= 1
    ? d.itens.map((i) => blocoFicha(i, d.hoje, s.codigos)).join('')
    : (['pagar', 'receber'] as const).map((t) => {
        const doTipo = d.itens.filter((i) => i.tipo === t)
        if (doTipo.length === 0) return ''
        const soma = doTipo.flatMap((i) => i.parcelas).reduce((acc, p) => acc + p.valor, 0)
        return `<div class="mes-h">${t === 'pagar' ? 'A pagar' : 'A receber'}<span class="tot">${doTipo.length} boleto(s) · ${brl(soma)}</span></div>${doTipo.map((i) => blocoFicha(i, d.hoje, s.codigos)).join('')}`
      }).join('')

  /** Aplica um bloco ao recorte inteiro, ou uma vez por tipo quando há pagar E receber. */
  const porTipo = (fn: (ls: Linha[], rotulo?: string) => string) =>
    tipos.length <= 1
      ? fn(linhas)
      : (['pagar', 'receber'] as const)
          .filter((t) => tipos.includes(t))
          .map((t) => fn(linhas.filter((l) => l.item.tipo === t), t === 'pagar' ? 'A pagar' : 'A receber'))
          .join('')

  const secoes = [
    s.agenda && secao('Agenda de vencimentos', `${k.parcelas} parcela(s)`, blocoAgenda(linhas, d.hoje)),
    s.fichas && secao('Boletos — detalhe por parcela', `${d.itens.length} boleto(s)`,
      d.itens.length > 0 ? corpoFichas : '<p class="vazio">Nenhum boleto no recorte.</p>'),
    s.concentracao && secao('Concentração por parceiro', 'em aberto', porTipo((ls, r) => blocoConcentracao(ls, r))),
    s.fotos && blocoFotos(d),
  ].filter(Boolean).join('')

  const rodape = `<div class="rodape">
    <span>${esc(d.empresa)}${d.organizacao ? ` · ${esc(d.organizacao)}` : ''}</span>
    <span>${esc(d.obraLabel)}</span>
    <span>Emitido em ${fmtDataBR(d.hoje)}${d.emitidoPor ? ` por ${esc(d.emitidoPor)}` : ''}</span>
    <span class="marca">${brandMarkSvg(9, '#f97316')} ConstruData</span>
  </div>`

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Relatório de Boletos — ${esc(d.obraLabel)}</title>
<style>${CSS}</style>
<!-- Depois do CSS principal: a @page daqui precisa vencer a margem declarada lá. -->
<style>${pageFooterCss(`Relatório de Boletos · ${d.obraLabel} · ${d.empresa} · ${fmtDataBR(d.hoje)}${d.demo ? ' · DEMONSTRAÇÃO' : ''}`)}</style></head><body>
${d.demo ? '<div class="demo-wm"><span>DEMONSTRAÇÃO</span></div>' : ''}
<div class="barra-acoes"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>

<header class="head">
  <div class="head-mark">${marca}</div>
  <div>
    <h1>Relatório de Boletos</h1>
    <div class="head-sub">${esc(subCabecalho || 'Todas as obras')}</div>
  </div>
  <div class="head-right">
    ${d.demo ? '<div class="chip-demo">DEMONSTRAÇÃO</div>' : ''}
    <div>${esc(d.empresa)}</div>
    ${d.organizacao ? `<div>${esc(d.organizacao)}</div>` : ''}
    <div>Emitido em ${fmtDataBR(d.hoje)}</div>
    ${d.emitidoPor ? `<div>por ${esc(d.emitidoPor)}</div>` : ''}
  </div>
</header>

${d.recorte.length > 0 ? `<div class="recorte">${d.recorte.map((r) => `<span>${esc(r)}</span>`).join('')}</div>` : ''}

${porTipo((ls, r) => blocoKpis(ls, d.hoje, r))}
<p class="kpi-nota">Indicadores calculados sobre o recorte declarado acima${tipos.length > 1 ? ', separados por tipo — a pagar e a receber não se somam' : ''}.</p>

${secoes}

${s.assinaturas ? `<div class="assinaturas">
  <div>Elaborado por</div><div>Conferido por</div><div>Aprovado por</div>
</div>` : ''}

${rodape}
</body></html>`
}

// ─── Impressão ────────────────────────────────────────────────────────────────

/**
 * Abre a janela do relatório. **Chame SÍNCRONA no clique**, antes de qualquer `await` —
 * o browser bloqueia `window.open` disparado depois de uma promessa. Devolve `null` se
 * o bloqueador de pop-up barrou; nesse caso use `printViaIframe`.
 */
export function openReportWindow(): Window | null {
  const win = window.open('', '_blank')
  if (!win) return null
  win.document.open()
  win.document.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Gerando relatório…</title></head><body style="font:14px -apple-system,Segoe UI,Roboto,sans-serif;color:#334155;padding:32px">Gerando o relatório…</body></html>')
  win.document.close()
  return win
}

/** Espera as imagens decodificarem — sem isso o print pode sair com molduras vazias. */
async function aguardarImagens(doc: Document): Promise<void> {
  await Promise.all([...doc.images].map((img) => img.decode().catch(() => undefined)))
}

/** Escreve o relatório na janela já aberta e manda imprimir. */
export async function printBoletosReportInto(win: Window, d: BoletosReportData): Promise<void> {
  const html = buildBoletosReportHtml(d)
  win.document.open()
  win.document.write(html)
  win.document.close()
  await aguardarImagens(win.document)
  win.focus()
  win.print()
}

/**
 * Plano B para quando o pop-up é bloqueado: imprime de um iframe oculto, sem abrir aba.
 * (Nenhum outro export do repo tem isso — todos só avisam "permita pop-ups".)
 */
export async function printViaIframe(d: BoletosReportData): Promise<void> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) { iframe.remove(); throw new Error('Não foi possível preparar a impressão.') }
  doc.open()
  doc.write(buildBoletosReportHtml(d))
  doc.close()
  await aguardarImagens(doc)
  const limpar = () => setTimeout(() => iframe.remove(), 1000)
  win.addEventListener('afterprint', limpar, { once: true })
  win.focus()
  win.print()
  // Safari não dispara afterprint de iframe: rede de segurança para não deixar lixo no DOM.
  setTimeout(limpar, 60_000)
}
