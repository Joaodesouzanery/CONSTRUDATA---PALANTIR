/**
 * exportPdf.ts — Light-mode PDF export utilities for the Módulo de Medição.
 *
 * Opens a new browser window with a white-background print layout and
 * triggers window.print(). Consistent with the codebase's existing PDF approach.
 */
import type { ItemContrato, Subempreiteiro, Fornecedor, ConferenciaItem, MedicaoBoletim } from '@/store/medicaoBillingStore'
import { getAllCriterios } from '../data/criterios'

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
  thead { display: table-header-group; }
  @media print { body { padding: 0; } thead { display: table-header-group; } tr { page-break-inside: avoid; } }
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
    const grupoSaldo = items.reduce((s, i) => s + (i.qtdContrato - i.qtdAnterior - i.qtdMedida) * i.valorUnitario, 0)

    body += `<table><thead><tr>
      <th>Item</th><th>Descrição / N. Preço</th><th class="center">Un</th>
      <th class="right">Qtd Contrato</th><th class="right">Qtd Anterior</th><th class="right">Qtd Período</th><th class="right">Qtd Acumulada</th>
      <th class="right">Vl. Unitário</th><th class="right">Total Período (R$)</th><th class="right">Saldo Qtd</th><th class="right">Saldo (R$)</th>
    </tr></thead><tbody>`
    for (const i of items) {
      const qtdAcum = i.qtdAnterior + i.qtdMedida
      const saldoQtd = i.qtdContrato - qtdAcum
      const totalPer = i.qtdMedida * i.valorUnitario
      const saldoR = saldoQtd * i.valorUnitario
      body += `<tr>
        <td>${i.itemEAP || '—'}</td>
        <td>${i.descricao}<br/><span style="color:#f97316;font-size:7pt;">${i.nPreco}</span></td>
        <td class="center">${i.unidade}</td>
        <td class="right">${fmtNum(i.qtdContrato)}</td><td class="right">${fmtNum(i.qtdAnterior)}</td>
        <td class="right">${fmtNum(i.qtdMedida)}</td><td class="right">${fmtNum(qtdAcum)}</td>
        <td class="right">${fmtBRL(i.valorUnitario)}</td><td class="right">${fmtBRL(totalPer)}</td>
        <td class="right">${fmtNum(saldoQtd)}</td>
        <td class="right" style="color:${saldoR >= 0 ? '#16a34a' : '#dc2626'}">${fmtBRL(saldoR)}</td>
      </tr>`
      const crit = getAllCriterios().find(cr => cr.nPreco === i.nPreco)
      if (crit) {
        body += `<tr><td colspan="11" style="background:#fafaf8;padding:2px 20px 2px 24px;border-left:3px solid #f97316;font-size:7pt;font-style:italic;color:#666;">
          <strong style="color:#f97316;font-style:normal;">CRITÉRIO ${i.nPreco}</strong> — ${crit.medicao}
        </td></tr>`
      }
    }
    body += `</tbody><tfoot><tr style="background:#f0f0f0;font-weight:700;">
      <td colspan="8" class="right">Total do Grupo — ${GRUPOS[gId]}</td>
      <td class="right">${fmtBRL(subtotal)}</td><td></td>
      <td class="right">${fmtBRL(grupoSaldo)}</td>
    </tr></tfoot></table>`
  }

  const grandAcumulado = itens.reduce((s, i) => s + (i.qtdAnterior + i.qtdMedida) * i.valorUnitario, 0)
  const grandSaldo = itens.reduce((s, i) => s + (i.qtdContrato - i.qtdAnterior - i.qtdMedida) * i.valorUnitario, 0)

  body += `<table style="margin-top:12px;"><tbody>
    <tr><td><strong>Total do Período</strong></td><td class="right" style="font-size:11pt;font-weight:700;color:#f97316;">${fmtBRL(grandTotal)}</td></tr>
    <tr><td>Total Acumulado</td><td class="right">${fmtBRL(grandAcumulado)}</td></tr>
    <tr><td>Saldo Total</td><td class="right" style="color:${grandSaldo >= 0 ? '#16a34a' : '#dc2626'}">${fmtBRL(grandSaldo)}</td></tr>
  </tbody></table>`
  openPrint(`Medição Sabesp ${periodo}`, body)
}

// ─── Step 3: Subempreiteiros ──────────────────────────────────────────────────

export function exportSubempreiteirosPdf(subempreiteiros: Subempreiteiro[], periodo: string, contrato: string) {
  let body = `<h1>Subempreiteiros — ${periodo}</h1><p class="sub">Contrato ${contrato}</p>`

  for (const sub of subempreiteiros) {
    body += `<h2>${sub.nome} — Núcleo: ${sub.nucleo}</h2>`
    body += `<table><thead><tr>
      <th>Nº Preço</th><th>Vínc. Sabesp</th><th>Descrição</th><th class="center">Un</th>
      <th class="right">Qtd</th><th class="right">Vl. Unitário</th><th class="right">Vl. Total</th>
    </tr></thead><tbody>`
    for (const i of sub.itens) {
      body += `<tr>
        <td>${i.nPreco}</td><td>${i.nPrecoSabesp || '—'}</td><td>${i.descricao}</td><td class="center">${i.unidade}</td>
        <td class="right">${fmtNum(i.qtd)}</td><td class="right">${fmtBRL(i.valorUnitario)}</td>
        <td class="right">${fmtBRL(i.qtd * i.valorUnitario)}</td>
      </tr>`
    }
    body += `</tbody><tfoot><tr><td colspan="6" class="right">Total Medido</td><td class="right">${fmtBRL(sub.totalMedido)}</td></tr></tfoot></table>`
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

// ─── Step 5: Conferência (enhanced with financial summary + criteria) ─────────

export function exportConferenciaPdf(conferencia: ConferenciaItem[], periodo: string, contrato: string, boletim?: MedicaoBoletim) {
  let body = `<h1>Conferência de Medição — ${periodo}</h1><p class="sub">Contrato ${contrato} · Gerado em ${new Date().toLocaleString('pt-BR')}</p>`

  // Financial summary if boletim available
  if (boletim) {
    const totalMedido = boletim.itensContrato.reduce((s, it) => s + it.qtdMedida * it.valorUnitario, 0)
    const totalSub = boletim.subempreiteiros.reduce((s, sub) => s + sub.totalAprovado, 0)
    const totalForn = boletim.fornecedores.reduce((s, f) => s + f.valorAprovado, 0)
    const totalTerceiros = totalSub + totalForn
    const margem = totalMedido - totalTerceiros

    body += `<h2>Resumo Financeiro</h2>
    <table><tbody>
      <tr><td>Total Medido Sabesp (período)</td><td class="right">${fmtBRL(totalMedido)}</td></tr>
      <tr><td>Total Subempreiteiros</td><td class="right">${fmtBRL(totalSub)}</td></tr>
      <tr><td>Total Fornecedores</td><td class="right">${fmtBRL(totalForn)}</td></tr>
      <tr><td><strong>Total Terceiros</strong></td><td class="right"><strong>${fmtBRL(totalTerceiros)}</strong></td></tr>
    </tbody><tfoot>
      <tr><td><strong>Margem Bruta</strong></td><td class="right ${margem >= 0 ? 'ok' : 'div'}">${fmtBRL(margem)}</td></tr>
    </tfoot></table>`

    // Checklist
    const nCrit = conferencia.filter(c => getAllCriterios().some(cr => cr.nPreco === c.nPreco)).length
    const nDiv = conferencia.filter(c => c.status === 'divergencia').length
    const terceirosOk = totalTerceiros <= totalMedido || totalMedido === 0

    body += `<h2>Checklist de Conferência</h2>
    <table><tbody>
      <tr><td>${terceirosOk ? '✅' : '❌'} Terceiros ${terceirosOk ? '≤' : '>'} Valor Medido Sabesp</td><td class="${terceirosOk ? 'ok' : 'div'}">${terceirosOk ? 'CONFORME' : 'NÃO CONFORME'}</td></tr>
      <tr><td>${nDiv === 0 ? '✅' : '⚠️'} Divergências de quantidade</td><td class="${nDiv === 0 ? 'ok' : 'pend'}">${nDiv === 0 ? 'Nenhuma' : `${nDiv} divergência(s)`}</td></tr>
      <tr><td>${nCrit === conferencia.length ? '✅' : '⚠️'} Critérios vinculados</td><td class="${nCrit === conferencia.length ? 'ok' : 'pend'}">${nCrit}/${conferencia.length}</td></tr>
    </tbody></table>`
  }

  // Conferência table
  body += `<h2>Detalhamento por Item</h2>
  <table><thead><tr>
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

    // Add criteria block below the item
    const crit = getAllCriterios().find(cr => cr.nPreco === c.nPreco)
    if (crit) {
      body += `<tr><td colspan="8" style="background:#fff8f0;padding:6px 12px;border-left:3px solid #f97316;">
        <div style="font-size:7.5pt;color:#666;"><strong style="color:#f97316;">CRITÉRIO ${c.nPreco}</strong> — <strong>Medição:</strong> ${crit.medicao}</div>
      </td></tr>`
    }
  }
  body += `</tbody></table>`
  openPrint(`Conferência ${periodo}`, body)
}

// ─── Step 6: Medição Final (complete document with criteria + checklist) ──────

export function exportMedicaoFinalPdf(boletim: MedicaoBoletim) {
  const mf = boletim.medicaoFinal
  const totalMedido = mf?.totalMedidoPeriodo ?? 0
  const totalSub = mf?.totalSubempreiteiros ?? 0
  const totalForn = mf?.totalFornecedores ?? 0
  const saldo = mf?.saldoContratante ?? 0

  // ── 1. CABEÇALHO DO CONTRATO ───────────────────────────────
  let body = `
    <div style="text-align:center;margin-bottom:16px;">
      <h1 style="font-size:15pt;margin:0;">BOLETIM DE MEDIÇÃO</h1>
      <p style="font-size:10pt;color:#f97316;margin:2px 0 0;font-weight:700;">Contrato ${boletim.contrato} — ${boletim.consorcio}</p>
      <p style="font-size:8.5pt;color:#555;margin:4px 0;">Período: ${boletim.periodo} · Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    </div>
  `

  // ── 2. RESUMO FINANCEIRO ───────────────────────────────────
  body += `<h2>1. Resumo Financeiro</h2>
  <table><thead><tr><th>Descrição</th><th class="right">Valor (R$)</th></tr></thead><tbody>
    <tr><td>Valor Total do Contrato</td><td class="right">${fmtBRL(mf?.totalContratoValor ?? 0)}</td></tr>
    <tr><td>Total Medido no Período</td><td class="right">${fmtBRL(totalMedido)}</td></tr>
    <tr><td>Total Acumulado</td><td class="right">${fmtBRL(mf?.totalAcumulado ?? 0)}</td></tr>
    <tr><td>Total Subempreiteiros</td><td class="right">${fmtBRL(totalSub)}</td></tr>
    <tr><td>Total Fornecedores</td><td class="right">${fmtBRL(totalForn)}</td></tr>
  </tbody><tfoot>
    <tr><td><strong>Saldo para o Contratante</strong></td><td class="right ${saldo >= 0 ? 'ok' : 'div'}">${fmtBRL(saldo)}</td></tr>
  </tfoot></table>`

  // ── 3. CORPO DA MEDIÇÃO (itens + critérios vinculados) ─────
  body += `<h2>2. Itens Medidos no Período</h2>`
  const itensComMedicao = boletim.itensContrato.filter(i => i.qtdMedida > 0)

  if (itensComMedicao.length > 0) {
    const grupos = ['01', '02', '03']
    for (const gId of grupos) {
      const items = itensComMedicao.filter(i => i.grupo === gId)
      if (items.length === 0) continue
      const subtotal = items.reduce((s, i) => s + i.qtdMedida * i.valorUnitario, 0)

      body += `<h2 style="font-size:9.5pt;border-color:#f97316;">Grupo ${gId} — ${GRUPOS[gId]}</h2>`
      const grupoSaldo = items.reduce((s, i) => s + (i.qtdContrato - i.qtdAnterior - i.qtdMedida) * i.valorUnitario, 0)
      body += `<table><thead><tr>
        <th>Item</th><th>Descrição / N. Preço</th><th class="center">Un</th>
        <th class="right">Qtd Contrato</th><th class="right">Qtd Anterior</th><th class="right">Qtd Período</th><th class="right">Qtd Acum.</th>
        <th class="right">Vl. Unitário</th><th class="right">Total Per. (R$)</th><th class="right">Saldo Qtd</th><th class="right">Saldo (R$)</th>
      </tr></thead><tbody>`
      for (const item of items) {
        const qtdAcum = item.qtdAnterior + item.qtdMedida
        const saldoQtd = item.qtdContrato - qtdAcum
        const valor = item.qtdMedida * item.valorUnitario
        const saldoR = saldoQtd * item.valorUnitario
        body += `<tr>
          <td>${item.itemEAP || '—'}</td>
          <td>${item.descricao}<br/><span style="color:#f97316;font-size:7pt;">${item.nPreco}</span></td>
          <td class="center">${item.unidade}</td>
          <td class="right">${fmtNum(item.qtdContrato)}</td><td class="right">${fmtNum(item.qtdAnterior)}</td>
          <td class="right">${fmtNum(item.qtdMedida)}</td><td class="right">${fmtNum(qtdAcum)}</td>
          <td class="right">${fmtBRL(item.valorUnitario)}</td><td class="right">${fmtBRL(valor)}</td>
          <td class="right">${fmtNum(saldoQtd)}</td>
          <td class="right" style="color:${saldoR >= 0 ? '#16a34a' : '#dc2626'}">${fmtBRL(saldoR)}</td>
        </tr>`
        const crit = getAllCriterios().find(cr => cr.nPreco === item.nPreco)
        if (crit) {
          body += `<tr><td colspan="11" style="background:#fafaf8;padding:2px 20px 2px 24px;border-left:3px solid #f97316;font-size:7pt;font-style:italic;color:#666;">
            <strong style="color:#f97316;font-style:normal;">CRITÉRIO:</strong> ${crit.medicao}
            ${crit.notas ? `<br/><span style="color:#999;">Notas: ${crit.notas}</span>` : ''}
          </td></tr>`
        } else {
          body += `<tr><td colspan="11" style="background:#fff0f0;padding:2px 20px;border-left:3px solid #dc2626;font-size:7pt;color:#dc2626;">
            Critério não localizado para nPreço ${item.nPreco}
          </td></tr>`
        }
      }
      body += `</tbody><tfoot><tr style="background:#f0f0f0;font-weight:700;">
        <td colspan="8" class="right">Total do Grupo — ${GRUPOS[gId]}</td>
        <td class="right">${fmtBRL(subtotal)}</td><td></td>
        <td class="right">${fmtBRL(grupoSaldo)}</td>
      </tr></tfoot></table>`
    }
  } else {
    body += `<p style="color:#888;font-style:italic;">Nenhum item com quantidade medida no período.</p>`
  }

  // ── 4. ANEXO DE TERCEIROS ──────────────────────────────────
  if (boletim.subempreiteiros.length > 0) {
    body += `<h2>3. Anexo — Subempreiteiros</h2><table><thead><tr>
      <th>Empresa</th><th>Núcleo</th><th class="right">Total Medido</th><th class="right">Total Aprovado</th><th class="right">Retenção</th>
    </tr></thead><tbody>`
    for (const s of boletim.subempreiteiros) {
      body += `<tr><td>${s.nome}</td><td>${s.nucleo}</td><td class="right">${fmtBRL(s.totalMedido)}</td><td class="right">${fmtBRL(s.totalAprovado)}</td><td class="right">${fmtBRL(s.retencao)}</td></tr>`
    }
    body += `</tbody></table>`
  }

  if (boletim.fornecedores.length > 0) {
    body += `<h2>4. Anexo — Fornecedores</h2><table><thead><tr>
      <th>Fornecedor</th><th>Período</th><th>Descrição</th><th class="right">Valor Aprovado</th>
    </tr></thead><tbody>`
    for (const f of boletim.fornecedores) {
      body += `<tr><td>${f.nome}</td><td>${f.periodo}</td><td>${f.descricao}</td><td class="right">${fmtBRL(f.valorAprovado)}</td></tr>`
    }
    body += `</tbody></table>`
  }

  // ── 5. CHECKLIST DE CONFERÊNCIA ────────────────────────────
  const nCrit = itensComMedicao.filter(i => getAllCriterios().some(cr => cr.nPreco === i.nPreco)).length
  const totalTerceiros = totalSub + totalForn
  const terceirosOk = totalTerceiros <= totalMedido || totalMedido === 0
  const nDiv = boletim.conferencia.filter(c => c.status === 'divergencia').length
  const negSaldoCount = boletim.itensContrato.filter(i => (i.qtdContrato - i.qtdAnterior - i.qtdMedida) < 0).length

  body += `<h2>5. Checklist de Conferência</h2>
  <table><thead><tr><th>Verificação</th><th class="center" style="width:120px;">Resultado</th></tr></thead><tbody>
    <tr><td>Soma de terceiros (Sub+Forn) ≤ Valor Medido Sabesp</td><td class="center ${terceirosOk ? 'ok' : 'div'}">${terceirosOk ? '✅ CONFORME' : '❌ NÃO CONFORME'}</td></tr>
    <tr><td>Divergências de quantidade (Sabesp vs Subempreiteiros)</td><td class="center ${nDiv === 0 ? 'ok' : 'pend'}">${nDiv === 0 ? '✅ Nenhuma' : `⚠️ ${nDiv}`}</td></tr>
    <tr><td>Todos os nPreço possuem critério de medição vinculado</td><td class="center ${nCrit === itensComMedicao.length ? 'ok' : 'pend'}">${nCrit === itensComMedicao.length ? '✅ Sim' : `⚠️ ${nCrit}/${itensComMedicao.length}`}</td></tr>
    <tr><td>Saldo para o contratante (margem positiva)</td><td class="center ${saldo >= 0 ? 'ok' : 'div'}">${saldo >= 0 ? '✅ Positivo' : '❌ Negativo'}</td></tr>
    <tr><td>Itens com saldo negativo (qtd excede contrato)</td><td class="center ${negSaldoCount === 0 ? 'ok' : 'div'}">${negSaldoCount === 0 ? '✅ Nenhum' : `❌ ${negSaldoCount} item(ns)`}</td></tr>
  </tbody></table>`

  body += `<p style="text-align:center;font-size:7.5pt;color:#999;margin-top:20px;">Atlântico ConstruData — Documento gerado automaticamente</p>`

  openPrint(`Boletim Medição ${boletim.periodo}`, body)
}
