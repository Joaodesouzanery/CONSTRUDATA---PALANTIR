/**
 * rdoCompizzoPdf — gera/imprime o "Diário de Obra" no layout da Compizzo,
 * replicando o documento original (logo, seções 1–7, rodapé). Usa window.print().
 */
import type { RDO, RdoCompizzoServicos, RdoCompizzoOcorrencias } from '@/types'
import { resolvePhotosForPdf } from './rdoPhotoStorage'

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const fmtDate = (iso: string) => {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : esc(iso)
}

const box = (on: boolean) => (on ? '☑' : '☐')

const SERVICO_ITEMS: Array<[keyof RdoCompizzoServicos, string]> = [
  ['limpezaArea', 'Limpeza da área'],
  ['isolamentoArea', 'Isolamento da área'],
  ['preparacaoPiso', 'Preparação do piso'],
  ['tintaVermelha', 'Aplicação de tinta vermelha'],
  ['tintaAmarela', 'Aplicação de tinta amarela'],
  ['faixaBranca', 'Demarcação faixa branca'],
  ['faixaAmarela', 'Demarcação faixa amarela'],
  ['faixaVermelha', 'Demarcação faixa vermelha'],
  ['vagasPCD', 'Pintura de vagas PCD'],
  ['retoques', 'Retoques'],
  ['limpezaFinal', 'Limpeza final'],
]

const OCORRENCIA_ITEMS: Array<[keyof RdoCompizzoOcorrencias, string]> = [
  ['semOcorrencias', 'Sem ocorrências'],
  ['chuva', 'Chuva'],
  ['areaNaoLiberada', 'Área não liberada'],
  ['interferenciaTerceiros', 'Interferência de terceiros'],
  ['faltaEnergia', 'Falta de energia'],
  ['equipamentoDefeito', 'Equipamento com defeito'],
  ['outros', 'Outros'],
]

export async function printCompizzoPdf(rdo: RDO) {
  const c = rdo.compizzo
  if (!c) return

  // Abre a janela ANTES de qualquer await (senão o navegador bloqueia o pop-up).
  const win = window.open('', '_blank')
  if (!win) return
  // Resolve as fotos para base64 (as que estão no Storage viram signed URL → base64).
  const photos = await resolvePhotosForPdf(rdo.photos)

  const clima = (k: string) => (c.condicaoClimatica === k ? '(x)' : '( )')
  const names = rdo.manpower.employeeNames ?? []

  const servicosHtml = SERVICO_ITEMS.map(([k, lbl]) => `<div class="chk">${box(c.servicos[k])} ${esc(lbl)}</div>`).join('')
  const servicosExtraHtml = (c.servicosExtra ?? [])
    .filter((s) => s.nome.trim())
    .map((s) => {
      const qty = [s.quantidade, s.unidade].filter(Boolean).join(' ').trim()
      return `<div class="chk">${box(true)} ${esc(s.nome)}${qty ? ` — <b>${esc(qty)}</b>` : ''}</div>`
    })
    .join('')
  const ocorrenciasHtml = OCORRENCIA_ITEMS.map(([k, lbl]) => `<div class="chk">${box(c.ocorrencias[k])} ${esc(lbl)}</div>`).join('')
  const producaoRows = c.producao.map((r) => `<tr><td>${esc(r.servico)}</td><td class="qty">${esc(r.quantidade)}</td></tr>`).join('')
  const materiaisRows = c.materiais.map((r) => `<tr><td>${esc(r.material)}</td><td class="qty">${esc(r.quantidade)}</td></tr>`).join('')
  const namesHtml = names.map((n) => `<div class="mao">${esc(n)}</div>`).join('')
  // Fotos não baixadas (offline) não somem em silêncio: mostra aviso.
  const missingPhotos = rdo.photos.length - photos.length
  const photosHtml = rdo.photos.length
    ? `<div class="photos">${photos.map((p) => `<img src="${p.base64}" />`).join('')}${missingPhotos > 0 ? `<div style="color:#b45309;font-size:11px">${missingPhotos} foto(s) indisponível(is) offline</div>` : ''}</div>`
    : ''

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Diário de Obra — Compizzo</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; line-height: 1.5; margin: 0; }
  .wordmark { text-align: center; font-weight: 800; font-size: 34px; color: #1f6fd1; letter-spacing: -1px; margin-bottom: 10px; }
  h1 { font-size: 14px; margin: 0 0 10px; }
  .kv { margin: 2px 0; }
  .kv b { font-weight: 700; }
  hr { border: none; border-top: 1px solid #ccc; margin: 14px 0; }
  h2 { font-size: 13px; margin: 16px 0 8px; }
  .chk { padding: 3px 0; }
  .mao { padding: 3px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { text-align: left; padding: 5px 4px; border-bottom: 1px solid #e5e5e5; font-size: 12px; }
  th { color: #111; font-weight: 700; }
  td.qty { width: 35%; }
  .desc { white-space: pre-wrap; margin-top: 6px; }
  .photos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
  .photos img { width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; }
  .sign { margin-top: 40px; }
  .sign-line { width: 280px; border-top: 1px solid #333; margin: 28px auto 4px; }
  .sign-cap { text-align: center; font-weight: 700; }
  .footer { text-align: center; margin-top: 34px; color: #1f6fd1; font-weight: 700; }
  .footer small { display: block; color: #6b8fb5; font-weight: 400; }
  .toolbar { position: fixed; top: 0; left: 0; right: 0; background: #1f6fd1; color: #fff; padding: 8px; text-align: center; }
  .toolbar button { background: #fff; color: #1f6fd1; border: none; padding: 6px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; }
  @media print { .toolbar { display: none; } }
</style></head>
<body>
  <div class="toolbar"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
  <div style="height: 40px"></div>

  <div class="wordmark">compizzo</div>
  <h1>DIÁRIO DE OBRA${c.obra ? ' – ' + esc(c.obra) : ''}</h1>
  <div class="kv"><b>Obra:</b> ${esc(c.obra)}</div>
  <div class="kv"><b>Data:</b> ${fmtDate(rdo.date)}</div>
  <div class="kv"><b>Dia da Obra:</b> ${esc(c.diaObra)}</div>
  <div class="kv"><b>Responsável:</b> ${esc(rdo.responsible)}</div>
  <div class="kv"><b>Condições Climáticas:</b></div>
  <div class="chk">${clima('sol')} Sol</div>
  <div class="chk">${clima('nublado')} Nublado</div>
  <div class="chk">${clima('chuva')} Chuva</div>
  <div class="chk">${clima('outros')} Outros: ${esc(c.condicaoClimaticaOutros ?? '')}</div>
  <hr />

  <h2>1. MÃO DE OBRA</h2>
  ${namesHtml || '<div class="mao">—</div>'}
  <div class="mao"><b>Total de colaboradores:</b> ${names.length}</div>
  <hr />

  <h2>2. SERVIÇOS EXECUTADOS NO DIA</h2>
  ${servicosHtml}
  ${servicosExtraHtml}
  <div class="kv" style="margin-top:8px"><b>Descrição dos serviços executados:</b></div>
  <div class="desc">${esc(c.descricaoServicos)}</div>
  <hr />

  <h2>3. PRODUÇÃO DO DIA</h2>
  <table><thead><tr><th>Serviço</th><th>Quantidade</th></tr></thead><tbody>${producaoRows}</tbody></table>
  <hr />

  <h2>4. MATERIAIS UTILIZADOS</h2>
  <table><thead><tr><th>Material</th><th>Quantidade</th></tr></thead><tbody>${materiaisRows}</tbody></table>
  <hr />

  <h2>5. OCORRÊNCIAS</h2>
  ${ocorrenciasHtml}
  <div class="kv" style="margin-top:8px"><b>Observações:</b></div>
  <div class="desc">${esc(c.observacoes)}</div>
  <hr />

  <h2>6. REGISTRO FOTOGRÁFICO</h2>
  ${photosHtml || '<div class="desc">—</div>'}
  <hr />

  <h2>7. PLANEJAMENTO PARA O PRÓXIMO DIA</h2>
  <div class="desc">${esc(c.planejamentoProximoDia)}</div>

  <div class="sign">
    <div class="kv"><b>Responsável pela Obra</b></div>
    <div class="kv">Nome: ${esc(c.responsavelNome || rdo.responsible)}</div>
    <div class="kv">Data: ${fmtDate(c.responsavelData || rdo.date)}</div>
    <div class="sign-line"></div>
    <div class="sign-cap">Assinatura</div>
  </div>

  <div class="footer">grupocompizzo.com.br<small>Somos referência em pisos monolíticos.</small></div>
</body></html>`

  win.document.write(html)
  win.document.close()
}
