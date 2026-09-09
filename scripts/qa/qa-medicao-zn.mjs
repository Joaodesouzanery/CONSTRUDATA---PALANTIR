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
import { lerQuantidadesZn } from '../../src/features/financeiro/utils/medicao/importarCatalogoZn.ts'
import { calcularMedicao, cadeiaDeRepasse, porCategoria } from '../../src/features/financeiro/utils/medicao/motorDaMedicao.ts'

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

console.log('\nMEDIÇÃO — o motor contra o que a planilha declara')
const q = lerQuantidadesZn(abas, r.catalogo)
conferir(q.problemas.length === 0, 'quantidades lidas sem problema', q.problemas.join(' · '))
conferir(q.obras.length === 2, 'obras achadas pelo cabeçalho', q.obras.join(' · '))

const boi = calcularMedicao(r.catalogo, 'BOI MALHADO', '02', q.quantidades)
const sakura = calcularMedicao(r.catalogo, 'SAKURA', '02', q.quantidades)

// ⚠️ ESTE É O RESULTADO QUE JUSTIFICA O MOTOR.
// A planilha declara R$ 3.264.706,87. O motor chega ao mesmo número — mas SEPARADO em duas
// partes, e é a separação que interessa: tudo que está no apostilamento e tem quantidade é
// exatamente o que a própria planilha marca como "bloco deslocado no PDF, conferir com a
// fiscalização". Ou seja: R$ 339.210,56 (10,4% da medição) estão sendo faturados sobre preços
// que o documento de origem diz não serem confiáveis.
conferir(Math.abs(boi.total - 2925496.31) < 0.02,
  'o que pode ser medido com preço confirmado', brl(boi.total))
conferir(Math.abs(boi.totalPendente - 339210.56) < 0.02,
  '⚠️ o que está barrado, esperando a fiscalização', brl(boi.totalPendente))
conferir(Math.abs((boi.total + boi.totalPendente) - q.valorDeclarado) < 0.02,
  'e os dois somados reproduzem o total da planilha', `${brl(boi.total + boi.totalPendente)} = ${brl(q.valorDeclarado)}`)
conferir(Math.abs(q.valorDeclarado - 3264706.87) < 0.02, 'que é o total do rodapé', brl(q.valorDeclarado))
conferir(boi.pendentes.length === 3 && boi.pendentes.every((l) => l.pendencia === 'preco_a_conferir'),
  'as 3 pendências são de preço a conferir, não de região errada', `${boi.pendentes.length} pendente(s)`)
conferir(!boi.podeFechar, 'com pendência, a medição NÃO pode fechar')

// ⚠️ O ACHADO: Sakura tem quantidade lançada e a planilha nunca a multiplica.
conferir(Math.abs(sakura.total - 245850) < 0.02,
  '⚠️ Sakura tem valor medido que a planilha NÃO soma', `${brl(sakura.total)} em ${sakura.linhas.length} linha(s)`)

console.log('\nA REGRA QUE NÃO PODE CAIR: item barrado não vira dinheiro')
// Barra à força um item que HOJE conta, e confere que ele sai do total pelo valor exato.
const alvo = r.catalogo.servicos.find((s) => boi.linhas.some((l) => l.servicoCatalogoId === s.id))
const linhaBarrada = boi.linhas.find((l) => l.servicoCatalogoId === alvo.id)
const adulterado = {
  ...r.catalogo,
  servicos: r.catalogo.servicos.map((s) => (s.id === alvo.id
    ? { ...s, bloqueadoParaMedicao: true, flag: 'bloco_deslocado_pdf', motivoFlag: 'teste' } : s)),
}
const comBarrado = calcularMedicao(adulterado, 'BOI MALHADO', '02', q.quantidades)
conferir(comBarrado.pendentes.length === boi.pendentes.length + 1, 'o item barrado foi para as pendências')
conferir(Math.abs(comBarrado.total - (boi.total - linhaBarrada.valor)) < 0.02,
  'e saiu do total, exatamente no valor dele', `−${brl(linhaBarrada.valor)}`)
conferir(Math.abs(comBarrado.totalPendente - (boi.totalPendente + linhaBarrada.valor)) < 0.02,
  'o valor que ele TERIA aparece à parte, somado às pendências que já havia')

console.log('\nCADEIA SABESP → CONSÓRCIO → EXECUTORA')
const cadeia = cadeiaDeRepasse(boi.total, r.catalogo.fatorPadrao)
conferir(cadeia !== null && Math.abs(cadeia.brutoConsorcio * r.catalogo.fatorPadrao - boi.total) < 0.02,
  'o bruto do consórcio é o medido ÷ fator', `${brl(cadeia.brutoConsorcio)} × 0,6 = ${brl(boi.total)}`)
conferir(cadeiaDeRepasse(100, 0) === null, 'fator zero não vira divisão por zero na tela')

const cats = porCategoria(boi)
conferir(Math.abs(cats.reduce((a, c) => a + c.valor, 0) - boi.total) < 0.02,
  'a quebra por categoria fecha com o total', `${cats.length} categorias`)
console.log('   maiores:', cats.slice(0, 3).map((c) => `${c.categoria} ${brl(c.valor)}`).join(' · '))

console.log(`\n${falhas === 0 ? 'Tudo conferido.' : `${falhas} falha(s).`}\n`)
process.exit(falhas === 0 ? 0 : 1)
