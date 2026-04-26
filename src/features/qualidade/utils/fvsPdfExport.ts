/**
 * fvsPdfExport.ts
 * Opens a styled A4 HTML print window for a given FVS (Ficha de Verificação de Serviço).
 *
 * Layout espelha o formulário FOR-FVS-02 Rev 00 do Consórcio Integra:
 * cabeçalho com código/rev/contrato, tabela principal de itens (9 linhas em
 * 2 grupos), tabela de problemas/ações, linha de NC, e fechamento com
 * 4 linhas de assinatura.
 *
 * Logo dinâmica vem de useCompanySettingsStore (mesmo store usado pelo RDO).
 * Cada FVS pode opcionalmente referenciar um logoId específico (fvs.logoId).
 */
import type { FVS, FvsConformity } from '@/types'
import { useCompanySettingsStore } from '@/store/companySettingsStore'

const CONFORMITY_MARK: Record<NonNullable<FvsConformity>, string> = {
  conforme:      '✓',
  nao_conforme:  '✗',
  reinspecao_ok: '✓',
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return '—'
  return `${day}/${m}/${y}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildLogoHtml(logoBase64: string | undefined, fallbackChar = 'Q'): string {
  if (logoBase64) {
    return `<img src="${logoBase64}" alt="Logo" style="width:44px;height:44px;object-fit:contain;border-radius:8px;background:#fff;padding:2px;" />`
  }
  return `<div class="cover-logo">${fallbackChar}</div>`
}

function buildItemRow(
  num: number,
  description: string,
  criteria: string,
  conformity: FvsConformity,
  date: string | null,
): string {
  const mark = conformity ? CONFORMITY_MARK[conformity] : ''
  const conformeCell      = conformity === 'conforme'      ? mark : ''
  const naoConformeCell   = conformity === 'nao_conforme'  ? mark : ''
  const reinspecaoCell    = conformity === 'reinspecao_ok' ? mark : ''

  return `
    <tr>
      <td class="num-cell">${num}</td>
      <td class="desc-cell"><strong>${escapeHtml(description)}</strong></td>
      <td class="crit-cell">${escapeHtml(criteria || '')}</td>
      <td class="check-cell">${conformeCell}</td>
      <td class="check-cell">${naoConformeCell}</td>
      <td class="check-cell">${reinspecaoCell}</td>
      <td class="date-cell">${date ? fmtDate(date) : ''}</td>
    </tr>`
}

function buildHtml(fvs: FVS): string {
  const { logos, companyName } = useCompanySettingsStore.getState()
  const selectedLogo = fvs.logoId
    ? logos.find((l) => l.id === fvs.logoId)
    : logos[0]
  const logoBase64 = selectedLogo?.base64
  const logoHtml = buildLogoHtml(logoBase64, 'Q')
  const projectName = 'Atlântico'

  const verificacaoSoldaItems = fvs.items
    .filter((i) => i.group === 'verificacao_solda')
    .sort((a, b) => a.number - b.number)
  const controleParametrosItems = fvs.items
    .filter((i) => i.group === 'controle_parametros')
    .sort((a, b) => a.number - b.number)

  const verificacaoRows = verificacaoSoldaItems
    .map((i) => buildItemRow(i.number, i.description, i.criteria, i.conformity, i.date))
    .join('')

  const parametrosRows = controleParametrosItems
    .map((i) => buildItemRow(i.number, i.description, i.criteria, i.conformity, i.date))
    .join('')

  const problemRows = fvs.problems.length
    ? fvs.problems
        .map(
          (p) => {
            const photos = (p.photos ?? [])
              .map((src, idx) => `<img src="${src}" alt="Foto do problema ${idx + 1}" />`)
              .join('')
            const photoRow = photos
              ? `<tr><td></td><td colspan="2"><div class="problem-photos">${photos}</div></td></tr>`
              : ''
            return `
        <tr>
          <td class="num-cell">${p.itemNumber}</td>
          <td>${escapeHtml(p.description)}</td>
          <td>${escapeHtml(p.action)}</td>
        </tr>
        ${photoRow}`
          },
        )
        .join('')
    : `
      <tr><td class="num-cell"></td><td>&nbsp;</td><td>&nbsp;</td></tr>
      <tr><td class="num-cell"></td><td>&nbsp;</td><td>&nbsp;</td></tr>
      <tr><td class="num-cell"></td><td>&nbsp;</td><td>&nbsp;</td></tr>`

  const ncSimMark = fvs.ncRequired  ? '✓' : ''
  const ncNaoMark = !fvs.ncRequired ? '✓' : ''

  return `<!DOCTYPE html>
<html lang="pt-BR" data-theme="light" style="color-scheme: light;">
<head>
  <meta charset="UTF-8"/>
  <meta name="color-scheme" content="light only" />
  <title>FVS Nº ${escapeHtml(fvs.identificationNo)} — ${fmtDate(fvs.date)}</title>
  <style>
    /* Força modo claro mesmo se o navegador/SO estiver em dark mode */
    :root {
      color-scheme: light only;
      forced-color-adjust: none;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: A4; margin: 12mm 12mm 14mm 12mm; }
    * {
      box-sizing: border-box; margin: 0; padding: 0;
      forced-color-adjust: none;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      background: #ffffff !important;
      background-color: #ffffff !important;
      color: #0e1f38 !important;
    }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 9pt;
    }
    /* Defesa em profundidade — todo elemento estrutural fica em branco/escuro */
    table, thead, tbody, tr, td, th, div, span, p, h1, h2, h3 {
      background-color: transparent;
      color: #0e1f38;
    }
    @media (prefers-color-scheme: dark) {
      html, body { background: #ffffff !important; background-color: #ffffff !important; color: #0e1f38 !important; }
      table, td, th, div, span, p { background-color: inherit !important; color: inherit !important; }
    }
    @media print {
      html, body { background: #ffffff !important; background-color: #ffffff !important; }
    }

    /* ── Header (matches formulário Integra) ──────────────────────────── */
    .header-table {
      width: 100%; border-collapse: collapse; margin-bottom: 0;
      border: 1.5px solid #111;
    }
    .header-table td {
      border: 1px solid #111; padding: 6px 8px; vertical-align: middle;
    }
    .logo-cell {
      width: 70px; text-align: center; padding: 6px;
    }
    .title-cell {
      text-align: center; font-size: 13pt; font-weight: 800;
      letter-spacing: 0.02em; color: #0e1f38;
    }
    .code-cell {
      width: 110px; text-align: center; font-size: 8.5pt;
    }
    .code-cell strong { display: block; }
    .cover-logo {
      width: 44px; height: 44px; background: #2abfdc; border-radius: 8px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 22pt; color: #fff; font-weight: 900;
    }
    .company-name {
      font-size: 7pt; color: #6b7280; margin-top: 3px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.05em;
    }

    /* ── Sub-header (Contrato / Data / Nº FVS) ────────────────────────── */
    .sub-header-table {
      width: 100%; border-collapse: collapse;
      border-left: 1.5px solid #111; border-right: 1.5px solid #111;
      border-bottom: 1.5px solid #111;
    }
    .sub-header-table td {
      border: 1px solid #111; padding: 5px 8px; font-size: 9pt; font-weight: 600;
    }

    /* ── Main items table ─────────────────────────────────────────────── */
    .main-table {
      width: 100%; border-collapse: collapse;
      border-left: 1.5px solid #111; border-right: 1.5px solid #111;
      border-bottom: 1.5px solid #111;
    }
    .main-table th, .main-table td {
      border: 1px solid #111; padding: 5px 6px; font-size: 8.5pt;
      vertical-align: middle;
    }
    .main-table thead th {
      background: #e5e7eb; font-weight: 700; text-align: center;
      font-size: 8.5pt; color: #111;
    }
    .group-header td {
      background: #d1d5db; text-align: center; font-weight: 800;
      font-size: 9pt; padding: 5px; letter-spacing: 0.03em;
    }
    .num-cell   { width: 36px; text-align: center; font-weight: 700; }
    .desc-cell  { width: 22%; }
    .crit-cell  { width: 30%; font-size: 8pt; color: #374151; }
    .check-cell { width: 9%; text-align: center; font-size: 14pt; font-weight: 900; color: #15803d; }
    .check-cell:nth-of-type(5) { color: #dc2626; }     /* Não conforme em vermelho */
    .date-cell  { width: 12%; text-align: center; font-size: 8pt; }

    /* ── Problems / Actions table ─────────────────────────────────────── */
    .problems-section {
      margin-top: 0;
    }
    .section-title {
      background: #d1d5db; border: 1.5px solid #111; border-bottom: none;
      text-align: center; font-weight: 800; font-size: 9pt; padding: 5px;
      text-transform: uppercase; letter-spacing: 0.03em;
    }
    .problems-table {
      width: 100%; border-collapse: collapse;
      border: 1.5px solid #111;
    }
    .problems-table th, .problems-table td {
      border: 1px solid #111; padding: 5px 8px; font-size: 8.5pt;
      vertical-align: top;
    }
    .problems-table thead th {
      background: #e5e7eb; font-weight: 700; text-align: center;
      font-size: 8.5pt;
    }
    .problems-table tbody td { min-height: 22px; }
    .problem-photos {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
      padding: 3px 0;
    }
    .problem-photos img {
      width: 100%; height: 95px; object-fit: cover;
      border: 1px solid #111; background: #fff;
    }

    /* ── NC line ──────────────────────────────────────────────────────── */
    .nc-line {
      border-left: 1.5px solid #111; border-right: 1.5px solid #111;
      border-bottom: 1.5px solid #111;
      padding: 6px 10px; display: flex; gap: 12px; align-items: center;
      font-size: 9pt; font-weight: 600;
    }
    .nc-checkbox {
      display: inline-block; width: 14px; height: 14px;
      border: 1.5px solid #111; text-align: center; line-height: 12px;
      font-size: 11pt; font-weight: 900; vertical-align: middle;
      margin: 0 2px;
    }

    /* ── Closure / Signatures ─────────────────────────────────────────── */
    .closure-title {
      background: #d1d5db; border: 1.5px solid #111; border-bottom: none;
      text-align: center; font-weight: 800; font-size: 9pt; padding: 5px;
      text-transform: uppercase; letter-spacing: 0.03em; margin-top: 0;
    }
    .closure-table {
      width: 100%; border-collapse: collapse;
      border: 1.5px solid #111;
    }
    .closure-table td {
      border: 1px solid #111; padding: 8px 10px; font-size: 9pt;
    }
    .closure-label {
      font-weight: 700; color: #111;
    }

    /* ── Footer ──────────────────────────────────────────────────────── */
    .footer {
      margin-top: 8px; display: flex; justify-content: space-between;
      font-size: 7.5pt; color: #6b7280;
      border-top: 1px solid #e5e7eb; padding-top: 4px;
    }

    @media print {
      .no-print { display: none; }
    }
  </style>
</head>
<body>

  <!-- Print button (hidden on print) -->
  <div class="no-print" style="text-align:right;padding:8px 0;margin-bottom:6px;">
    <button onclick="window.print()" style="background:#2abfdc;color:#fff;border:none;padding:6px 18px;border-radius:6px;font-size:10pt;font-weight:700;cursor:pointer;">
      🖨️ Imprimir / Salvar PDF
    </button>
  </div>

  <!-- ─── Header ─────────────────────────────────────────────── -->
  <table class="header-table">
    <tr>
      <td class="logo-cell" rowspan="2">
        ${logoHtml}
        <div class="company-name">${escapeHtml(companyName)}</div>
      </td>
      <td class="title-cell" rowspan="2">FICHA DE VERIFICAÇÃO DE SERVIÇO SOLDA</td>
      <td class="code-cell"><strong>Código</strong>${escapeHtml(fvs.documentCode || 'FOR-FVS-02')}</td>
    </tr>
    <tr>
      <td class="code-cell"><strong>Rev</strong> ${escapeHtml(fvs.revision || '00')}</td>
    </tr>
  </table>

  <!-- ─── Sub-header (Contrato / Data / Nº FVS) ──────────────── -->
  <table class="sub-header-table">
    <tr>
      <td style="width:33%;">Contrato n°: ${escapeHtml(fvs.contractNo)}</td>
      <td style="width:33%;">Data: ${fmtDate(fvs.date)}</td>
      <td style="width:34%;">Nº Identificação FVS: ${escapeHtml(fvs.identificationNo)}</td>
    </tr>
  </table>

  <!-- ─── Main items table ───────────────────────────────────── -->
  <table class="main-table">
    <thead>
      <tr>
        <th>Item</th>
        <th>Verificação</th>
        <th>Critérios de aceitação</th>
        <th>Conforme</th>
        <th>Não conforme</th>
        <th>Conforme após reinspeção</th>
        <th>Data</th>
      </tr>
    </thead>
    <tbody>
      <tr class="group-header">
        <td colspan="7">Verificação de Solda PEAD</td>
      </tr>
      ${verificacaoRows}
      <tr class="group-header">
        <td colspan="7">Controle de Parâmetros de Solda</td>
      </tr>
      ${parametrosRows}
    </tbody>
  </table>

  <!-- ─── Problems / Actions ────────────────────────────────── -->
  <div class="section-title">Descrição do Problema e Ações de Adequação</div>
  <table class="problems-table">
    <thead>
      <tr>
        <th style="width:36px;">ITEM</th>
        <th style="width:48%;">DESCRIÇÃO DO PROBLEMA</th>
        <th>AÇÃO</th>
      </tr>
    </thead>
    <tbody>
      ${problemRows}
    </tbody>
  </table>

  <!-- ─── NC line ───────────────────────────────────────────── -->
  <div class="nc-line">
    <span>Necessário abertura de NC:</span>
    <span>(<span class="nc-checkbox">${ncSimMark}</span>) SIM</span>
    <span>(<span class="nc-checkbox">${ncNaoMark}</span>) NÃO</span>
    <span style="margin-left:auto;">Nº Não Conformidade: ${escapeHtml(fvs.ncNumber || '________________')}</span>
  </div>

  <!-- ─── Closure ───────────────────────────────────────────── -->
  <div class="closure-title">Fechamento da FVS</div>
  <table class="closure-table">
    <tr>
      <td><span class="closure-label">Líder Responsável:</span> ${escapeHtml(fvs.responsibleLeader || '________________________________________')}</td>
    </tr>
    <tr>
      <td><span class="closure-label">N° de rastreio da solda:</span> ${escapeHtml(fvs.weldTrackingNo || '________________________________________')}</td>
    </tr>
    <tr>
      <td><span class="closure-label">Assinatura soldador:</span> ${escapeHtml(fvs.welderSignature || '________________________________________')}</td>
    </tr>
    <tr>
      <td><span class="closure-label">Assinatura Resp. Qualidade:</span> ${escapeHtml(fvs.qualitySignature || '________________________________________')}</td>
    </tr>
  </table>

  <!-- ─── Footer ────────────────────────────────────────────── -->
  <div class="footer">
    <span>FVS Nº ${escapeHtml(fvs.identificationNo)} · Contrato ${escapeHtml(fvs.contractNo)} · Data ${fmtDate(fvs.date)}</span>
    <span>Gerado em ${new Date().toLocaleString('pt-BR')} · ${escapeHtml(companyName)} ${escapeHtml(projectName)}</span>
  </div>

</body>
</html>`
}

export function printFvsPDF(fvs: FVS): void {
  const win = window.open('', '_blank')
  if (!win) {
    alert('Permita pop-ups para exportar o PDF.')
    return
  }
  win.document.write(buildHtml(fvs))
  win.document.close()
}
