/**
 * exportPdf.ts — Light-mode PDF export utilities for the Módulo de Medição.
 *
 * Opens a new browser window with a white-background print layout and
 * triggers window.print(). Consistent with the codebase's existing PDF approach.
 */
import type { ItemContrato, Subempreiteiro, Fornecedor, ConferenciaItem, MedicaoBoletim } from '@/store/medicaoBillingStore'

function fmtBRL(n: number) {
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtNum(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

const BASE_CSS = `
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; background: #fff; margin: 0; padding: 16px; }
  h1 { font-size: 13pt; margin: 0 0 2px; color: #111; }
  h2 { font-size: 11pt; margin: 14px 0 4px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  p.sub { font-size: 8.5pt; color: #555; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 14px; }
  th { background: #f97316; color: #fff; padding: 5px 7px; text-align: left; font-weight: 700; }
  th.right, td.right { text-align: right; }
  th.center, td.center { text-align: center; }
  td { padding: 4px 7px; border-bottom: 1px solid #e5e5e5; }
  tr:nth-child(even) td { background: #f9f9f9; }
  tfoot td { background: #f0f0f0 !important; font-weight: 700; border-top: 2px solid #ccc; }
  .total { font-size: 11pt; font-weight: 700; color: #f97316; margin: 8px 0 0; }
  .ok { color: #16a34a; font-weight: 700; }
  .div { color: #dc2626; font-weight: 700; }
  .pend { color: #d97706; font-weight: 700; }
  @media print { body { padding: 0; } }
`

function openPrint(title: string, body: string) {
  const w = window.open('', '_blank', 'width=1100,height=800')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${BASE_CSS}</style></head><body>${body}</body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 400)
}

// ─── Step 1: Planilha Sabesp ──────────────────────────────────────────────────

const GRUPOS: Record<string, string> = { '01': 'Canteiros e Planos', '02': 'Esgoto', '03': 'Água' }

export function exportSabespPdf(itens: ItemContrato[], periodo: string, contrato: string, consorcio: string) {
  let body = `<h1>Planilha de Medição Sabesp — ${periodo}</h1><p class="sub">Contrato ${contrato} · ${consorcio}</p>`

  const grupos = ['01', '02', '03']
  let grandTotal = 0

  for (const gId of grupos) {
    const items = itens.filter((i) => i.grupo === gId)
    if (items.length === 0) continue
    const subtotal = items.reduce((s, i) => s + i.qtdMedida * i.valorUnitario, 0)
    grandTotal += subtotal

    body += `<h2>Grupo ${gId} — ${GRUPOS[gId]}</h2>`
    body += `<table><thead><tr>
      <th>Nº Preço</th><th>Descrição</th><th class="center">Un</th>
      <th class="right">Qtd Contrato</th><th class="right">Qtd Medida</th>
      <th class="right">Vl. Unitário</th><th class="right">Vl. Período</th>
    </tr></thead><tbody>`
    for (const i of items) {
      body += `<tr>
        <td>${i.nPreco}</td><td>${i.descricao}</td><td class="center">${i.unidade}</td>
        <td class="right">${fmtNum(i.qtdContrato)}</td><td class="right">${fmtNum(i.qtdMedida)}</td>
        <td class="right">${fmtBRL(i.valorUnitario)}</td><td class="right">${fmtBRL(i.qtdMedida * i.valorUnitario)}</td>
      </tr>`
    }
    body += `</tbody><tfoot><tr><td colspan="6" class="right">Subtotal ${GRUPOS[gId]}</td><td class="right">${fmtBRL(subtotal)}</td></tr></tfoot></table>`
  }

  body += `<p class="total">Total do Período: ${fmtBRL(grandTotal)}</p>`
  openPrint(`Medição Sabesp ${periodo}`, body)
}

// ─── Step 3: Subempreiteiros ──────────────────────────────────────────────────

export function exportSubempreiteirosPdf(subempreiteiros: Subempreiteiro[], periodo: string, contrato: string) {
  let body = `<h1>Subempreiteiros — ${periodo}</h1><p class="sub">Contrato ${contrato}</p>`

  for (const sub of subempreiteiros) {
    body += `<h2>${sub.nome} — Núcleo: ${sub.nucleo}</h2>`
    body += `<table><thead><tr>
      <th>Nº Preço</th><th>Descrição</th><th class="center">Un</th>
      <th class="right">Qtd</th><th class="right">Vl. Unitário</th><th class="right">Vl. Total</th>
    </tr></thead><tbody>`
    for (const i of sub.itens) {
      body += `<tr>
        <td>${i.nPreco}</td><td>${i.descricao}</td><td class="center">${i.unidade}</td>
        <td class="right">${fmtNum(i.qtd)}</td><td class="right">${fmtBRL(i.valorUnitario)}</td>
        <td class="right">${fmtBRL(i.qtd * i.valorUnitario)}</td>
      </tr>`
    }
    body += `</tbody><tfoot><tr><td colspan="5" class="right">Total Medido</td><td class="right">${fmtBRL(sub.totalMedido)}</td></tr></tfoot></table>`
    body += `<p style="font-size:8.5pt;color:#555;margin:-8px 0 14px;">Aprovado: ${fmtBRL(sub.totalAprovado)} &nbsp;|&nbsp; Retenção: ${fmtBRL(sub.retencao)}</p>`
  }

  openPrint(`Subempreiteiros ${periodo}`, body)
}

// ─── Step 4: Fornecedores ─────────────────────────────────────────────────────

export function exportFornecedoresPdf(fornecedores: Fornecedor[], periodo: string, contrato: string) {
  const total = fornecedores.reduce((s, f) => s + f.valorAprovado, 0)
  let body = `<h1>Fornecedores — ${periodo}</h1><p class="sub">Contrato ${contrato}</p>`
  body += `<table><thead><tr>
    <th>Fornecedor</th><th>Período</th><th>Descrição</th><th class="right">Valor Aprovado</th>
  </tr></thead><tbody>`
  for (const f of fornecedores) {
    body += `<tr><td>${f.nome}</td><td>${f.periodo}</td><td>${f.descricao}</td><td class="right">${fmtBRL(f.valorAprovado)}</td></tr>`
  }
  body += `</tbody><tfoot><tr><td colspan="3" class="right">Total</td><td class="right">${fmtBRL(total)}</td></tr></tfoot></table>`
  openPrint(`Fornecedores ${periodo}`, body)
}

// ─── Step 5: Conferência ──────────────────────────────────────────────────────

export function exportConferenciaPdf(conferencia: ConferenciaItem[], periodo: string, contrato: string) {
  let body = `<h1>Conferência de Medição — ${periodo}</h1><p class="sub">Contrato ${contrato}</p>`
  body += `<table><thead><tr>
    <th>Nº Preço</th><th>Descrição</th><th class="center">Un</th>
    <th class="right">Qtd Sabesp</th><th class="right">Qtd Subempreit.</th>
    <th class="right">Diferença</th><th class="center">Status</th><th>Observação</th>
  </tr></thead><tbody>`
  for (const c of conferencia) {
    const statusCls = c.status === 'ok' ? 'ok' : c.status === 'divergencia' ? 'div' : 'pend'
    const statusLabel = c.status === 'ok' ? 'OK' : c.status === 'divergencia' ? 'Divergência' : 'Pendente'
    body += `<tr>
      <td>${c.nPreco}</td><td>${c.descricao}</td><td class="center">${c.unidade}</td>
      <td class="right">${fmtNum(c.qtdSabesp)}</td><td class="right">${fmtNum(c.qtdSubempreiteiros)}</td>
      <td class="right">${fmtNum(c.diferenca)}</td>
      <td class="center ${statusCls}">${statusLabel}</td>
      <td>${c.observacao || ''}</td>
    </tr>`
  }
  body += `</tbody></table>`
  openPrint(`Conferência ${periodo}`, body)
}

// ─── Step 6: Medição Final ────────────────────────────────────────────────────

export function exportMedicaoFinalPdf(boletim: MedicaoBoletim) {
  const mf = boletim.medicaoFinal
  let body = `
    <h1>Boletim de Medição Final — ${boletim.periodo}</h1>
    <p class="sub">Contrato ${boletim.contrato} · ${boletim.consorcio}</p>
    <table><thead><tr><th>Descrição</th><th class="right">Valor (R$)</th></tr></thead><tbody>
      <tr><td>Valor Total do Contrato</td><td class="right">${fmtBRL(mf?.totalContratoValor ?? 0)}</td></tr>
      <tr><td>Total Medido no Período</td><td class="right">${fmtBRL(mf?.totalMedidoPeriodo ?? 0)}</td></tr>
      <tr><td>Total Acumulado</td><td class="right">${fmtBRL(mf?.totalAcumulado ?? 0)}</td></tr>
      <tr><td>Total Subempreiteiros</td><td class="right">${fmtBRL(mf?.totalSubempreiteiros ?? 0)}</td></tr>
      <tr><td>Total Fornecedores</td><td class="right">${fmtBRL(mf?.totalFornecedores ?? 0)}</td></tr>
    </tbody><tfoot>
      <tr><td><strong>Saldo para o Contratante</strong></td><td class="right">${fmtBRL(mf?.saldoContratante ?? 0)}</td></tr>
    </tfoot></table>
  `

  if (boletim.subempreiteiros.length > 0) {
    body += `<h2>Subempreiteiros</h2><table><thead><tr>
      <th>Nome</th><th>Núcleo</th><th class="right">Total Medido</th><th class="right">Total Aprovado</th><th class="right">Retenção</th>
    </tr></thead><tbody>`
    for (const s of boletim.subempreiteiros) {
      body += `<tr><td>${s.nome}</td><td>${s.nucleo}</td><td class="right">${fmtBRL(s.totalMedido)}</td><td class="right">${fmtBRL(s.totalAprovado)}</td><td class="right">${fmtBRL(s.retencao)}</td></tr>`
    }
    body += `</tbody></table>`
  }

  if (boletim.fornecedores.length > 0) {
    body += `<h2>Fornecedores</h2><table><thead><tr>
      <th>Nome</th><th>Período</th><th>Descrição</th><th class="right">Valor Aprovado</th>
    </tr></thead><tbody>`
    for (const f of boletim.fornecedores) {
      body += `<tr><td>${f.nome}</td><td>${f.periodo}</td><td>${f.descricao}</td><td class="right">${fmtBRL(f.valorAprovado)}</td></tr>`
    }
    body += `</tbody></table>`
  }

  openPrint(`Boletim Final ${boletim.periodo}`, body)
}
