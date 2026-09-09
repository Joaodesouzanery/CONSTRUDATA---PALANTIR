/**
 * Roda o leitor do catálogo contra a PLANILHA REAL do contrato ZN e confere contra os números
 * que a própria planilha declara. É a prova de que o parser aguenta o arquivo de verdade.
 *
 *   npm run qa:medicao-zn
 *
 * ⚠️ Diferente do `qa:medicao-xlsx`, que aponta para um drive `F:\` que não existe e por isso
 * passa há meses com 17 fixtures "não encontradas": aqui, arquivo ausente é FALHA.
 */
import { existsSync } from 'node:fs'
import xlsx from 'xlsx'
import { lerCatalogoZn } from '../../src/features/financeiro/utils/medicao/importarCatalogoZn.ts'
import { precoDoServico, projetarParaObra } from '../../src/features/financeiro/utils/medicao/catalogoContrato.ts'

const XLSX = xlsx.default ?? xlsx
const CAMINHO = 'docs/Base_Medicao_60pct_ZN.xlsx'
const CONTRATO = '13.546/25-00'

if (!existsSync(CAMINHO)) {
  console.error(`FALHA: ${CAMINHO} não existe. Sem o arquivo real, este QA não prova nada.`)
  process.exit(1)
}

const wb = XLSX.readFile(CAMINHO, { cellDates: true })
const abas = {}
for (const nome of wb.SheetNames) {
  abas[nome] = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null })
}

const brl = (x) => (x ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
let falhas = 0
const conferir = (ok, rotulo, detalhe = '') => {
  console.log(`  ${ok ? 'OK   ' : 'FALHA'}  ${rotulo}${detalhe ? `  ${detalhe}` : ''}`)
  if (!ok) falhas++
}

console.log(`\nCatálogo do contrato ${CONTRATO} — ${CAMINHO}\n`)
const r = lerCatalogoZn(abas, { numeroContrato: CONTRATO, orgId: 'qa-org', consorcio: 'Consórcio Saneamento ZN' })

console.log('LEITURA')
conferir(r.problemas.length === 0, 'nenhum problema de leitura', r.problemas.join(' · '))
conferir(r.resumo.servicos === 284, 'serviços lidos', `${r.resumo.servicos} (esperado 284)`)
conferir(r.resumo.regioes === 9, 'regiões', `${r.resumo.regioes} (esperado 9)`)
conferir(r.catalogo.fatorPadrao === 0.6, 'fator de repasse lido da planilha', `${r.catalogo.fatorPadrao}`)
conferir(new Set(r.catalogo.servicos.map((s) => s.id)).size === r.resumo.servicos, 'todo serviço tem id único')
conferir(r.catalogo.servicos.every((s) => s.qtdContratada === null), 'quantidade contratada nasce "não sei", não zero')

console.log('\nPARTES DO CONTRATO')
conferir(r.resumo.porParte.contrato === 176, 'itens da PARTE 1 (contrato)', `${r.resumo.porParte.contrato} (esperado 176)`)
conferir(r.resumo.porParte.apostilamento === 108, 'itens da PARTE 2 (apostilamento)', `${r.resumo.porParte.apostilamento} (esperado 108)`)

console.log('\nO QUE A PLANILHA DECLARA NO RODAPÉ')
conferir(Math.abs((r.resumo.subtotaisDeclarados.contrato ?? 0) - 2925496.31) < 0.02, 'subtotal contrato', brl(r.resumo.subtotaisDeclarados.contrato))
conferir(Math.abs((r.resumo.subtotaisDeclarados.apostilamento ?? 0) - 339210.56) < 0.02, 'subtotal apostilamento', brl(r.resumo.subtotaisDeclarados.apostilamento))
conferir(Math.abs((r.resumo.totalDeclarado ?? 0) - 3264706.87) < 0.02, 'total da medição', brl(r.resumo.totalDeclarado))

console.log('\nEXCEÇÕES MARCADAS')
const bloqueados = r.catalogo.servicos.filter((s) => s.bloqueadoParaMedicao)
conferir(r.resumo.porFlag.bloco_deslocado_pdf === 7, 'Caieiras: itens com bloco deslocado no PDF', `${r.resumo.porFlag.bloco_deslocado_pdf ?? 0} (esperado 7)`)
conferir(bloqueados.length === 7, 'só o bloco deslocado BARRA a medição', `${bloqueados.length} bloqueado(s)`)
// ⚠️ A nota da planilha diz 96 itens em Mairiporã, e o parser marca 94 com essa flag. Não é item
// perdido: 2 dos 96 estão TAMBÉM no bloco deslocado de Caieiras, e essa flag tem precedência
// porque ali o preço pode estar simplesmente errado. A identidade 94 + 2 = 96 é o que se confere.
const comOverride09 = r.catalogo.servicos.filter((s) => s.porRegiao['09']?.precoOverride != null)
const dosQuaisDeslocados = comOverride09.filter((s) => s.flag === 'bloco_deslocado_pdf').length
conferir(comOverride09.length === 96, 'Mairiporã: itens com preço próprio', `${comOverride09.length} (esperado 96)`)
conferir(r.resumo.porFlag.preco_regional_divergente === 94, 'destes, marcados como preço regional', `${r.resumo.porFlag.preco_regional_divergente ?? 0} (esperado 94)`)
conferir(dosQuaisDeslocados === 2 && 94 + dosQuaisDeslocados === comOverride09.length,
  'os outros 2 estão no bloco deslocado, que tem precedência — nenhum item se perdeu', '94 + 2 = 96')
conferir(r.catalogo.servicos.filter((s) => s.flag !== 'ok').every((s) => !!s.motivoFlag), 'toda exceção tem motivo escrito, não só um código')

console.log('\nO PREÇO, CONTRA A COLUNA "PREÇO 60%" DA PLANILHA')
// A planilha calcula ROUND(preço contrato × fator, 2) em todas as 284 linhas — conferido.
const base = abas[Object.keys(abas).find((n) => n.trim().toUpperCase().startsWith('BASE'))]
const declarados = new Map()
for (const linha of base) {
  if (!linha) continue
  const desc = linha[2] == null ? '' : String(linha[2]).replace(/\s+/g, ' ').trim()
  if (!desc || typeof linha[4] !== 'number' || typeof linha[5] !== 'number') continue
  if (!declarados.has(desc)) declarados.set(desc, [])
  declarados.get(desc).push({ cheio: linha[4], com60: linha[5] })
}
let conferidos = 0
let divergentes = 0
for (const s of r.catalogo.servicos) {
  const cands = declarados.get(s.descricao.replace(/\s+/g, ' ').trim())
  const alvo = cands?.find((c) => Math.abs(c.cheio - s.precoZn) < 0.005)
  if (!alvo) continue
  const nosso = Math.round(s.precoZn * r.catalogo.fatorPadrao * 100) / 100
  if (Math.abs(nosso - alvo.com60) < 0.005) conferidos++
  else divergentes++
}
conferir(divergentes === 0, 'preço com repasse bate com a planilha', `${conferidos} conferidos, ${divergentes} divergentes`)

console.log('\nPROJEÇÃO PARA UMA OBRA (região 02 — Freguesia, onde fica Boi Malhado)')
const projetado = projetarParaObra(r.catalogo, '02', 'qa-org')
conferir(projetado.length > 0 && projetado.length <= r.resumo.servicos, 'serviços disponíveis na região', `${projetado.length} de ${r.resumo.servicos}`)
conferir(projetado.every((s) => s.valorUnitario > 0), 'nenhuma linha projetada com preço zero')
conferir(projetado.every((s) => !!s.servicoCatalogoId && !!s.codigoRegional), 'toda linha projetada aponta para o catálogo e traz o código da região')
const denovo = projetarParaObra(r.catalogo, '02', 'qa-org')
conferir(projetado.every((s, i) => s.id === denovo[i].id), 'reimportar gera os MESMOS ids (o de-para de siglas sobrevive)')

const mairipora = r.catalogo.servicos.find((s) => s.porRegiao['09']?.precoOverride != null)
if (mairipora) {
  const em09 = precoDoServico(r.catalogo, mairipora, '09')
  const em01 = precoDoServico(r.catalogo, mairipora, '01')
  conferir(em09.precoCheio !== em01.precoCheio, 'Mairiporã cobra preço diferente das demais regiões',
    `09: ${brl(em09.precoCheio)} · 01: ${brl(em01.precoCheio)}`)
}

console.log(`\n${falhas === 0 ? 'Tudo conferido.' : `${falhas} falha(s).`}\n`)
process.exit(falhas === 0 ? 0 : 1)
