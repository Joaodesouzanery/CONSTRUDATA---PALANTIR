import type { FinanceiroEntry } from '@/types'

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}
const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function exportCSV(entries: FinanceiroEntry[], filename = 'financeiro') {
  const header = ['Tipo', 'Data', 'Descrição', 'Categoria', 'Referência', 'Valor (R$)', 'Obra']
  const rows = entries.map((e) => [
    e.tipo === 'entrada' ? 'Entrada' : 'Saída',
    fmtDate(e.data),
    e.descricao,
    e.categoria,
    e.referencia ?? '',
    e.valor.toFixed(2).replace('.', ','),
    e.obraId ?? '',
  ])
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportPDF(
  entries: FinanceiroEntry[],
  titulo: string,
  filtros: string,
  obraNames: Record<string, string> = {},
) {
  const total = entries.reduce((s, e) => s + (e.tipo === 'entrada' ? e.valor : -e.valor), 0)
  const totalEntradas = entries.filter((e) => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0)
  const totalSaidas   = entries.filter((e) => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0)

  const rows = entries.map((e) => `
    <tr>
      <td>${fmtDate(e.data)}</td>
      <td>${esc(e.descricao)}</td>
      <td>${esc(e.categoria)}</td>
      <td>${esc(e.referencia ?? '—')}</td>
      <td>${esc(obraNames[e.obraId ?? ''] ?? (e.obraId ? e.obraId.slice(0, 8) : '—'))}</td>
      <td class="${e.tipo === 'entrada' ? 'pos' : 'neg'}">${e.tipo === 'entrada' ? '+' : '-'} ${fmtBRL(e.valor)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>${esc(titulo)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #111; font-size: 11px; margin: 0; }
  h1 { font-size: 15px; margin: 0 0 4px; }
  .sub { color: #555; font-size: 10px; margin-bottom: 12px; }
  .kpis { display: flex; gap: 16px; margin-bottom: 14px; }
  .kpi { border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; flex: 1; }
  .kpi span { display: block; font-size: 9px; color: #666; }
  .kpi strong { font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 5px 4px; border-bottom: 1px solid #e5e5e5; font-size: 10px; }
  th { font-weight: 700; background: #f5f5f5; }
  .pos { color: #16a34a; font-weight: 700; }
  .neg { color: #dc2626; font-weight: 700; }
  .toolbar { position: fixed; top: 0; left: 0; right: 0; background: #f97316; color:#fff; padding:8px; text-align:center; }
  .toolbar button { background:#fff; color:#f97316; border:none; padding:6px 16px; border-radius:6px; font-weight:700; cursor:pointer; }
  @media print { .toolbar { display: none; } }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
<div style="height:40px"></div>
<h1>${esc(titulo)}</h1>
<div class="sub">Gerado em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${filtros ? ' · Filtros: ' + esc(filtros) : ''}</div>
<div class="kpis">
  <div class="kpi"><span>Total Entradas</span><strong class="pos">${fmtBRL(totalEntradas)}</strong></div>
  <div class="kpi"><span>Total Saídas</span><strong class="neg">${fmtBRL(totalSaidas)}</strong></div>
  <div class="kpi"><span>Saldo</span><strong class="${total >= 0 ? 'pos' : 'neg'}">${fmtBRL(total)}</strong></div>
  <div class="kpi"><span>Registros</span><strong>${entries.length}</strong></div>
</div>
<table>
  <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Referência</th><th>Obra</th><th>Valor</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}
