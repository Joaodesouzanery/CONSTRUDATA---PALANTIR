import type { QualityNonConformity } from '@/types'
import { useCompanySettingsStore } from '@/store/companySettingsStore'

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtDate(date: string | null | undefined): string {
  if (!date) return ''
  const [year, month, day] = date.split('-')
  return year && month && day ? `${day}/${month}/${year}` : date
}

function statusLabel(status: QualityNonConformity['status']): string {
  const labels = {
    aberta: 'Aberta',
    em_tratamento: 'Em tratamento',
    concluida: 'Concluída',
    ineficaz: 'Ineficaz',
  }
  return labels[status] ?? status
}

function buildLogoHtml(): string {
  const { logos } = useCompanySettingsStore.getState()
  const logo = logos[0]
  if (logo?.base64) {
    return `<img src="${logo.base64}" alt="Logo" class="logo" />`
  }
  return `<div class="logo-fallback">Q</div>`
}

function buildEvidenceHtml(photos: string[]): string {
  if (!photos.length) return '<div class="empty-evidence">Sem evidências fotográficas anexadas.</div>'
  return photos
    .map((src, idx) => `<figure><img src="${src}" alt="Evidência ${idx + 1}" /><figcaption>Evidência ${idx + 1}</figcaption></figure>`)
    .join('')
}

function buildHtml(nc: QualityNonConformity): string {
  const logoHtml = buildLogoHtml()

  return `<!DOCTYPE html>
<html lang="pt-BR" data-theme="light" style="color-scheme: light;">
<head>
  <meta charset="UTF-8" />
  <meta name="color-scheme" content="light only" />
  <title>Registro de Não Conformidade ${escapeHtml(nc.ncNumber || String(nc.number))}</title>
  <style>
    :root {
      color-scheme: light only;
      forced-color-adjust: none;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #fff !important; color: #111827 !important; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; line-height: 1.32; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #111; padding: 5px 6px; vertical-align: top; }
    .no-print { text-align: right; margin-bottom: 8px; }
    .no-print button { background: #f97316; color: #fff; border: 0; border-radius: 6px; padding: 7px 18px; font-weight: 700; cursor: pointer; }
    .header td { height: 58px; vertical-align: middle; }
    .logo-cell { width: 23%; text-align: center; }
    .logo { max-width: 130px; max-height: 46px; object-fit: contain; }
    .logo-fallback { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 7px; background: #f97316; color: #fff; font-weight: 900; font-size: 20pt; }
    .title { text-align: center; font-size: 13pt; font-weight: 800; letter-spacing: .02em; }
    .code { width: 20%; padding: 0; }
    .code div { min-height: 29px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #111; font-weight: 700; }
    .code div:last-child { border-bottom: 0; }
    .section { background: #d9d9d9; font-weight: 800; text-align: center; text-transform: uppercase; }
    .label { font-weight: 700; }
    .field { min-height: 25px; }
    .long { min-height: 78px; white-space: pre-wrap; }
    .evidence { min-height: 210px; }
    .evidence-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; padding: 3px 0; }
    figure { border: 1px solid #111; padding: 3px; break-inside: avoid; background: #fff; }
    figure img { width: 100%; height: 118px; object-fit: cover; display: block; }
    figcaption { font-size: 7pt; text-align: center; color: #374151; margin-top: 2px; }
    .empty-evidence { min-height: 90px; display: flex; align-items: center; justify-content: center; color: #6b7280; font-style: italic; }
    .footer { margin-top: 8px; display: flex; justify-content: space-between; color: #6b7280; font-size: 7.5pt; border-top: 1px solid #d1d5db; padding-top: 4px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">Imprimir / Salvar PDF</button>
  </div>

  <table class="header">
    <tr>
      <td class="logo-cell">${logoHtml}</td>
      <td class="title">REGISTRO DE NÃO CONFORMIDADE</td>
      <td class="code">
        <div>${escapeHtml(nc.documentCode || 'for-q-01')}</div>
        <div>Rev: ${escapeHtml(nc.revision || '00')}</div>
      </td>
    </tr>
  </table>

  <table>
    <tr>
      <td colspan="4"><span class="label">Responsável pela abertura da RNC:</span> ${escapeHtml(nc.openedBy)}</td>
    </tr>
    <tr><td colspan="4" class="section">Identificação da Frente</td></tr>
    <tr>
      <td colspan="2"><span class="label">Empresa:</span> ${escapeHtml(nc.company)}</td>
      <td colspan="2"><span class="label">Eng responsável:</span> ${escapeHtml(nc.engineerResponsible)}</td>
    </tr>
    <tr>
      <td colspan="4"><span class="label">Localização:</span> ${escapeHtml(nc.location)}</td>
    </tr>
    <tr><td colspan="4" class="section">Não Conformidade</td></tr>
    <tr>
      <td style="width:25%"><span class="label">Nº NC:</span> ${escapeHtml(nc.ncNumber)}</td>
      <td style="width:25%"><span class="label">Data:</span> ${fmtDate(nc.date)}</td>
      <td colspan="2"><span class="label">LV Nº:</span> ${escapeHtml(nc.lvNumber || 'NA')}</td>
    </tr>
    <tr>
      <td colspan="4"><span class="label">Local:</span> ${escapeHtml(nc.local)}</td>
    </tr>
    <tr>
      <td class="label" style="width:19%">Descrição:</td>
      <td colspan="3" class="long">${escapeHtml(nc.description)}</td>
    </tr>
    <tr>
      <td class="label">Evidência objetiva:</td>
      <td colspan="3" class="evidence"><div class="evidence-grid">${buildEvidenceHtml(nc.evidencePhotos ?? [])}</div></td>
    </tr>
    <tr>
      <td class="label">Requisito não atendido:</td>
      <td colspan="3">${escapeHtml(nc.unmetRequirement || '-')}</td>
    </tr>
    <tr><td colspan="4" class="section">Plano de Ação</td></tr>
    <tr>
      <td class="label">Ação imediata:</td>
      <td colspan="2">${escapeHtml(nc.immediateAction)}</td>
      <td><span class="label">Prazo:</span> ${fmtDate(nc.deadline)}</td>
    </tr>
    <tr>
      <td class="label">Responsável:</td>
      <td colspan="3">${escapeHtml(nc.actionResponsible)}</td>
    </tr>
    <tr>
      <td class="label">Ação corretiva:</td>
      <td colspan="2">${escapeHtml(nc.correctiveAction)}</td>
      <td><span class="label">Data:</span> ${fmtDate(nc.correctiveActionDate)}</td>
    </tr>
    <tr>
      <td class="label">Responsável:</td>
      <td colspan="3">${escapeHtml(nc.actionResponsible)}</td>
    </tr>
    <tr><td colspan="4" class="section">Avaliação de Eficácia</td></tr>
    <tr>
      <td><span class="label">Responsável:</span> ${escapeHtml(nc.effectivenessResponsible)}</td>
      <td><span class="label">Status:</span> ${escapeHtml(statusLabel(nc.status))}</td>
      <td colspan="2"><span class="label">Data:</span> ${fmtDate(nc.effectivenessDate)}</td>
    </tr>
  </table>

  <div class="footer">
    <span>FOR-Q-01 · Registro de Não Conformidade · NC ${escapeHtml(nc.ncNumber || String(nc.number))}</span>
    <span>Gerado em ${new Date().toLocaleString('pt-BR')}</span>
  </div>
</body>
</html>`
}

export function printQualityNonConformityPDF(nc: QualityNonConformity): void {
  const win = window.open('', '_blank')
  if (!win) {
    alert('Permita pop-ups para exportar o PDF.')
    return
  }
  win.document.write(buildHtml(nc))
  win.document.close()
}
