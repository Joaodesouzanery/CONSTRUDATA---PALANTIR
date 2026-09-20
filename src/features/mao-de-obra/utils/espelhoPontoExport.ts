/**
 * Espelho de ponto — o documento, em HTML A4.
 *
 * ─── ISTO NÃO É UM RELATÓRIO, É UMA OBRIGAÇÃO ─────────────────────────────────
 * O espelho de ponto é o que a empresa entrega ao trabalhador e ao fiscal (CLT art. 74 §2º,
 * Portaria MTP 671/2021). Por isso três coisas que um relatório comum não teria:
 *
 * 1. **O NSR de cada marcação vai impresso.** É o número sequencial por onde uma batida é
 *    localizada numa fiscalização; sem ele o papel não prova nada.
 * 2. **As pendências aparecem.** Jornada sem saída, intervalo não marcado, batida fora da cerca.
 *    Um espelho que só mostra as linhas limpas é pior que nenhum: dá aparência de conformidade a
 *    um mês que tem buraco.
 * 3. **As assinaturas existem.** É por elas que o trabalhador concorda — ou não — com o que está
 *    escrito, e é a concordância dele que dá valor ao documento.
 *
 * ─── A FORMA ──────────────────────────────────────────────────────────────────
 * `buildEspelhoHtml(dados): string` é **pura**: mesma entrada, mesmo HTML, sem `new Date()` por
 * dentro (o `hoje` é injetado). Dá para testar sem navegador, e é o que permite conferir o
 * documento em vez de olhar a tela e torcer. A impressão mora em `src/lib/printReport.ts`.
 *
 * A forma foi copiada do gerador dos boletos, que é o melhor do repositório — a blindagem contra
 * modo escuro do sistema, `thead` repetindo por página, `break-inside:avoid` nas linhas, números
 * tabulares e a marca d'água de demonstração vêm de lá. O conteúdo é todo outro.
 */
import { brandMarkSvg } from '@/lib/brandMark'
import { pageFooterCss } from '@/lib/printPageFooter'
import { fmtDataBR } from '@/lib/utils'
import { TEXTO_DA_PENDENCIA, type Jornada } from '@/features/ponto/jornada'
import { TEXTO_SEM_PREVISTO, type SaldoDoPeriodo } from './bancoDeHoras'

// ─── Contrato de entrada ──────────────────────────────────────────────────────

export interface EspelhoDoTrabalhador {
  workerId: string
  nome: string
  matricula?: string
  cargo?: string
  admissao?: string
  regime?: string
  jornadas: Jornada[]
  /** Ausente quando o regime não define jornada (diarista, personalizado). */
  banco?: SaldoDoPeriodo
}

export interface EspelhoSecoes {
  /** A grade dia a dia — o corpo do documento. Sem ela não é espelho. */
  grade: boolean
  /** Totais do período por pessoa. */
  resumo: boolean
  /** Saldo do banco de horas, dia a dia. */
  banco: boolean
  /** A lista de pendências, separada, para o gestor agir. */
  pendencias: boolean
  /** Linhas de assinatura. */
  assinaturas: boolean
}

export interface EspelhoReportData {
  empresa: string
  organizacao?: string
  obraLabel?: string
  cidade?: string
  emitidoPor?: string
  demo: boolean
  logoDataUrl?: string
  /** `yyyy-MM-dd` — injetado, para o documento ser determinístico. */
  hoje: string
  /** O recorte POR EXTENSO. É o que torna o documento conferível. */
  recorte: string[]
  de: string
  ate: string
  trabalhadores: EspelhoDoTrabalhador[]
  secoes: EspelhoSecoes
}

// ─── Formatação ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

/** Minutos → "8h48". Nunca decimal: ninguém confere 8,8 horas contra um relógio. */
function hm(min: number): string {
  const sinal = min < 0 ? '−' : ''
  const abs = Math.abs(Math.round(min))
  return `${sinal}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}`
}

const hora = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const diaSemana = (iso: string) => SEMANA[new Date(iso + 'T00:00:00').getDay()]
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// ─── Blocos ───────────────────────────────────────────────────────────────────

function secao(titulo: string, contador: string, inner: string): string {
  return `<section class="sec"><h2>${esc(titulo)}<span class="cnt">${esc(contador)}</span></h2>${inner}</section>`
}

function blocoGrade(t: EspelhoDoTrabalhador): string {
  if (t.jornadas.length === 0) {
    return '<p class="vazio">Nenhuma marcação registrada no período.</p>'
  }
  const linhas = t.jornadas.map((j) => {
    const alerta = j.pendencias.length > 0
    return `<tr class="${alerta ? 'row-pendente' : ''}">
      <td class="n">${diaCurto(j.data)} <span class="sub">${diaSemana(j.data)}</span></td>
      <td class="n">${hora(j.entrada?.momentoDispositivo)}</td>
      <td class="n">${hora(j.saida?.momentoDispositivo)}</td>
      <td class="n r">${j.intervaloMin > 0 ? hm(j.intervaloMin) : '—'}</td>
      <td class="n r"><b>${hm(j.minutosTrabalhados)}</b></td>
      <td class="nsr">${j.nsrs.length > 0 ? j.nsrs.join(' · ') : '—'}</td>
      <td>${j.pendencias.map((p) => `<span class="pend">${esc(TEXTO_DA_PENDENCIA[p])}</span>`).join(' ')}</td>
    </tr>`
  }).join('')

  return `<table>
    <thead><tr>
      <th>Dia</th><th>Entrada</th><th>Saída</th><th class="r">Intervalo</th>
      <th class="r">Trabalhado</th><th>NSR</th><th>Observação</th>
    </tr></thead>
    <tbody>${linhas}</tbody>
  </table>`
}

function blocoBanco(t: EspelhoDoTrabalhador): string {
  if (!t.banco) return ''
  if (t.banco.semBanco) {
    return `<p class="vazio">Sem banco de horas: ${esc(TEXTO_SEM_PREVISTO[t.banco.semBanco])}.</p>`
  }
  const b = t.banco
  const aviso = b.diasIndefinidos > 0
    ? `<p class="nota">⚠️ ${b.diasIndefinidos} dia(s) ficaram fora da conta por não ter jornada definida no regime.</p>`
    : ''
  return `<div class="totais">
      <div><span class="t-label">Previsto</span><b class="n">${hm(b.previstoMin)}</b></div>
      <div><span class="t-label">Trabalhado</span><b class="n">${hm(b.trabalhadoMin)}</b></div>
      <div class="${b.saldoMin < 0 ? 'neg' : 'pos'}">
        <span class="t-label">Saldo</span><b class="n">${hm(b.saldoMin)}</b>
      </div>
    </div>${aviso}`
}

function blocoPendencias(t: EspelhoDoTrabalhador): string {
  const comPendencia = t.jornadas.filter((j) => j.pendencias.length > 0)
  if (comPendencia.length === 0) {
    return '<p class="vazio">Nenhuma pendência — todas as jornadas têm entrada, saída e intervalo marcados.</p>'
  }
  return `<ul class="pendencias">${comPendencia.map((j) =>
    `<li><b>${diaCurto(j.data)}</b> — ${j.pendencias.map((p) => esc(TEXTO_DA_PENDENCIA[p])).join('; ')}</li>`,
  ).join('')}</ul>`
}

function blocoResumo(t: EspelhoDoTrabalhador): string {
  const total = t.jornadas.reduce((s, j) => s + j.minutosTrabalhados, 0)
  const pend = t.jornadas.filter((j) => j.pendencias.length > 0).length
  return `<div class="totais">
    <div><span class="t-label">Jornadas</span><b class="n">${t.jornadas.length}</b></div>
    <div><span class="t-label">Horas trabalhadas</span><b class="n">${hm(total)}</b></div>
    <div class="${pend > 0 ? 'neg' : ''}"><span class="t-label">A conferir</span><b class="n">${pend}</b></div>
  </div>`
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
/* Blindagem: o documento é sempre claro, mesmo com o sistema em modo escuro. Sem isto, o
   espelho impresso do celular de alguém sai com fundo preto e texto ilegível. */
:root { color-scheme: light only; forced-color-adjust: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
* { margin:0; padding:0; box-sizing:border-box; forced-color-adjust:none; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
html, body { background:#fff !important; color:#0f172a !important; }
@media (prefers-color-scheme: dark) { html, body { background:#fff !important; color:#0f172a !important; } }
@page { size: A4 portrait; margin: 12mm 12mm 16mm 12mm; }
body { font: 9.5pt/1.42 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; padding: 10mm 12mm; max-width: 210mm; margin: 0 auto; orphans:3; widows:3; }
@media print { body { padding: 0; max-width: none; } }

.n { font-variant-numeric: tabular-nums; overflow-wrap: normal; word-break: normal; }
.r { text-align:right } .c { text-align:center }
.sub { font-size:7.5pt; color:#94a3b8; }
.vazio { font-size:8.5pt; color:#64748b; font-style:italic; padding:8px 2px; }
.nota { font-size:7.5pt; color:#b45309; margin:5px 2px 0; }
.t-label { display:block; font-size:7pt; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#64748b; }

.head { display:grid; grid-template-columns:auto 1fr auto; gap:14px; align-items:center; border-bottom:3px solid #f97316; padding-bottom:10px; margin-bottom:10px; }
.head-mark { width:46px; height:46px; border-radius:10px; background:#0f172a; display:grid; place-items:center; overflow:hidden; }
.head-mark img { width:100%; height:100%; object-fit:contain; background:#fff; padding:3px; }
.head h1 { font-size:17pt; font-weight:800; letter-spacing:-.01em; }
.head-sub { font-size:9pt; color:#475569; margin-top:1px; }
.head-right { text-align:right; font-size:7.5pt; color:#64748b; line-height:1.5; }
.chip-demo { display:inline-block; background:#fef3c7; color:#92400e; border:1px solid #fcd34d; border-radius:999px; padding:1px 8px; font-size:7.5pt; font-weight:800; letter-spacing:.06em; }

.recorte { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:11px; }
.recorte span { border:1px solid #e2e8f0; background:#f8fafc; border-radius:999px; padding:2px 9px; font-size:7.5pt; color:#334155; }

/* Cada pessoa começa em página nova: o espelho é entregue individualmente, e a folha do João
   não pode ter metade do mês da Maria no rodapé. */
.pessoa { break-before: page; margin-bottom:10px; }
.pessoa:first-of-type { break-before: auto; }
.pessoa-head { border:1px solid #e2e8f0; border-left:3px solid #f97316; border-radius:8px; background:#f8fafc; padding:8px 11px; margin-bottom:9px; }
.pessoa-head h2 { font-size:12pt; font-weight:800; }
.pessoa-head .meta { font-size:7.5pt; color:#475569; margin-top:2px; }

.sec { margin-bottom:13px; }
.sec > h2 { font-size:10pt; font-weight:700; color:#fff; background:#0f172a; padding:6px 11px; border-radius:6px 6px 0 0; break-after:avoid; display:flex; align-items:center; gap:8px; }
.sec > h2::before { content:''; width:7px; height:7px; border-radius:50%; background:#f97316; flex:none; }
.sec > h2 .cnt { margin-left:auto; font-size:8pt; font-weight:600; opacity:.75; }

table { width:100%; border-collapse:collapse; font-size:8.5pt; }
thead { display: table-header-group; }   /* o cabeçalho repete a cada página */
th { background:#f1f5f9; color:#334155; padding:5px 8px; text-align:left; font-size:7.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid #cbd5e1; }
td { padding:5px 8px; border-bottom:1px solid #eef2f7; vertical-align:top; }
tr { break-inside: avoid; }
tr.row-pendente td { background:#fffbeb; }
tr.row-pendente td:first-child { border-left:3px solid #b45309; }
.nsr { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:7pt; color:#64748b; }
.pend { display:inline-block; background:#fef3c7; color:#92400e; border-radius:4px; padding:1px 5px; font-size:7pt; font-weight:700; }

.totais { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; }
.totais > div { border:1px solid #e2e8f0; border-radius:8px; padding:7px 9px; background:#f8fafc; }
.totais b { font-size:12.5pt; font-weight:800; }
.totais .pos b { color:#15803d; }
.totais .neg b { color:#b91c1c; }

.pendencias { list-style:none; font-size:8.5pt; }
.pendencias li { padding:4px 8px; border-bottom:1px solid #eef2f7; }

.assinaturas { display:grid; grid-template-columns:repeat(2,1fr); gap:22px; margin-top:26px; break-inside:avoid; }
.assinaturas div { border-top:1px solid #0f172a; padding-top:4px; text-align:center; font-size:7.5pt; color:#475569; }

.declaracao { font-size:7.5pt; color:#475569; margin-top:14px; line-height:1.5; border-left:2px solid #e2e8f0; padding-left:9px; }

.rodape { margin-top:16px; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:4px 12px; font-size:6.8pt; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:5px; }
.rodape .marca { display:inline-flex; align-items:center; gap:4px; flex:none; white-space:nowrap; }

.demo-wm { position:fixed; inset:0; display:grid; place-items:center; pointer-events:none; z-index:0; }
.demo-wm span { transform:rotate(-32deg); font-size:64pt; font-weight:900; color:#0f172a; opacity:.038; letter-spacing:.15em; }
body > *:not(.demo-wm) { position:relative; z-index:1; }

.barra-acoes { position:sticky; top:0; display:flex; justify-content:flex-end; gap:8px; padding:8px 0 12px; background:#fff; }
.barra-acoes button { border:1px solid #0f172a; background:#0f172a; color:#fff; border-radius:6px; padding:7px 14px; font-size:9pt; font-weight:700; cursor:pointer; }
@media print { .barra-acoes { display:none !important; } }
`

// ─── Montagem ─────────────────────────────────────────────────────────────────

export function buildEspelhoHtml(d: EspelhoReportData): string {
  const s = d.secoes
  const marca = d.logoDataUrl
    ? `<img src="${d.logoDataUrl}" alt="${esc(d.empresa)}" />`
    : brandMarkSvg(25, '#f97316')

  const subCabecalho = [d.obraLabel, d.cidade].filter(Boolean).join(' · ')
  const periodo = `${fmtDataBR(d.de)} a ${fmtDataBR(d.ate)}`

  const pessoas = d.trabalhadores.map((t) => {
    const meta = [
      t.matricula && `matrícula ${t.matricula}`,
      t.cargo,
      t.regime && `regime ${t.regime}`,
      t.admissao && `admissão ${fmtDataBR(t.admissao)}`,
    ].filter(Boolean).join(' · ')

    return `<div class="pessoa">
      <div class="pessoa-head">
        <h2>${esc(t.nome)}</h2>
        ${meta ? `<p class="meta">${esc(meta)}</p>` : ''}
      </div>
      ${s.resumo ? secao('Resumo do período', periodo, blocoResumo(t)) : ''}
      ${s.grade ? secao('Marcações', `${t.jornadas.length} jornada(s)`, blocoGrade(t)) : ''}
      ${s.banco && t.banco ? secao('Banco de horas', periodo, blocoBanco(t)) : ''}
      ${s.pendencias ? secao('Pendências', '', blocoPendencias(t)) : ''}
      ${s.assinaturas ? `
      <p class="declaracao">
        Declaro que conferi as marcações acima e que elas correspondem à jornada efetivamente
        cumprida no período. Divergência apontada e não corrigida deve ser registrada por escrito.
      </p>
      <div class="assinaturas">
        <div>${esc(t.nome)} — trabalhador(a)</div>
        <div>Responsável pela empresa</div>
      </div>` : ''}
    </div>`
  }).join('')

  const rodape = `<div class="rodape">
    <span class="marca">${brandMarkSvg(11, '#94a3b8')} ConstruData</span>
    <span>Espelho de ponto · CLT art. 74 §2º · emitido em ${fmtDataBR(d.hoje)}${d.emitidoPor ? ` por ${esc(d.emitidoPor)}` : ''}</span>
  </div>`

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Espelho de ponto — ${esc(d.empresa)}</title>
<style>${CSS}
${pageFooterCss(`Espelho de ponto · ${d.empresa} · ${periodo}`)}</style>
</head><body>
${d.demo ? '<div class="demo-wm"><span>DEMONSTRAÇÃO</span></div>' : ''}
<div class="barra-acoes"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>

<header class="head">
  <div class="head-mark">${marca}</div>
  <div>
    <h1>Espelho de Ponto</h1>
    <p class="head-sub">${esc(d.empresa)}${subCabecalho ? ` · ${esc(subCabecalho)}` : ''}</p>
  </div>
  <div class="head-right">
    ${d.demo ? '<span class="chip-demo">DEMONSTRAÇÃO</span><br>' : ''}
    ${esc(periodo)}<br>emitido em ${fmtDataBR(d.hoje)}
  </div>
</header>

${d.recorte.length > 0 ? `<div class="recorte">${d.recorte.map((r) => `<span>${esc(r)}</span>`).join('')}</div>` : ''}

${d.trabalhadores.length === 0
    ? '<p class="vazio">Nenhum trabalhador com marcação no recorte selecionado.</p>'
    : pessoas}

${rodape}
</body></html>`
}
