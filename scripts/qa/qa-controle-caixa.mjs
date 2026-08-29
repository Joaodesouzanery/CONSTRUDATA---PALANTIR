/**
 * Roda o leitor de Controle de Caixa contra o ARQUIVO REAL do cliente e confere o resultado
 * contra os números que a própria planilha declara na linha de fechamento.
 *
 * Não é teste unitário: é a prova de que o leitor aguenta o arquivo de verdade, com as
 * irregularidades que só existem nele. Rode com:
 *   node --import ./scripts/testes/resolver-ts.mjs scripts/qa/qa-controle-caixa.mjs
 */
import xlsx from 'xlsx'
import { lerLancamentos, lerHorasExtras, conferirTotaisDeHorasExtras, mesDoNomeDaAba } from '../../src/features/financeiro/utils/controleDeCaixaPlanilha.ts'

const XLSX = xlsx.default ?? xlsx

const CAMINHO = 'docs/CONTROLE DE CAIXA-MODELO.xlsx'
const wb = XLSX.readFile(CAMINHO, { cellDates: true })
const matriz = XLSX.utils.sheet_to_json(wb.Sheets['DESPESAS'], { header: 1, raw: true, defval: null })

const r = lerLancamentos(matriz)
const rec = r.lancamentos.filter((l) => l.tipo === 'receita')
const des = r.lancamentos.filter((l) => l.tipo === 'despesa')
const somaR = rec.reduce((a, l) => a + l.valor, 0)
const somaD = des.reduce((a, l) => a + l.valor, 0)

let falhas = 0
const conferir = (ok, rotulo, detalhe = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FALHA'}  ${rotulo}${detalhe ? `  ${detalhe}` : ''}`)
  if (!ok) falhas++
}

console.log(`\n=== ${CAMINHO} ===`)
console.log(`receitas: ${rec.length} somando ${somaR}`)
console.log(`despesas: ${des.length} somando ${somaD}`)
console.log(`problemas: ${r.problemas.length}`)
for (const p of r.problemas) {
  console.log(`   linha ${p.linha} ${p.coluna ?? ''} -> ${p.motivo}${p.conteudo ? ` (${p.conteudo})` : ''}`)
}

console.log('\n=== confere contra o fechamento da própria planilha ===')
const t = r.totaisDeclarados ?? {}
conferir(somaR === t.receitas, 'total de receitas', `${somaR} x ${t.receitas}`)
conferir(somaD === t.despesas, 'total de despesas', `${somaD} x ${t.despesas}`)
conferir(somaR - somaD === t.saldo, 'saldo', `${somaR - somaD} x ${t.saldo}`)

console.log('\n=== identidade, que é o que decide a reimportação ===')
const chaves = r.lancamentos.map((l) => l.chave)
conferir(new Set(chaves).size === chaves.length, 'nenhuma chave colide', `${new Set(chaves).size} de ${chaves.length}`)
const r2 = lerLancamentos(matriz)
conferir(r2.lancamentos.every((l, i) => l.chave === chaves[i]), 'reimportar o mesmo arquivo dá as mesmas chaves')

console.log('\n=== as irregularidades do arquivo real ===')
for (const l of des.filter((l) => l.dataFim)) console.log(`  período: ${l.data} -> ${l.dataFim} | ${l.descricao.slice(0, 42)}`)
for (const l of des.filter((l) => l.solicitantes.length > 1)) console.log(`  vários solicitantes: ${l.solicitantes.join(' + ')}`)
console.log(`  despesas sem solicitante: ${des.filter((l) => l.solicitantes.length === 0).length}`)
console.log(`  despesas não conferidas: ${des.filter((l) => !l.conferido).length}`)

// ─── A aba de horas extras ────────────────────────────────────────────────────
const ABA_HE = 'HORAS EXTRAS 08'
const mHE = XLSX.utils.sheet_to_json(wb.Sheets[ABA_HE], { header: 1, raw: true, defval: null })
const mes = mesDoNomeDaAba(ABA_HE)
const he = lerHorasExtras(mHE, { mes, ano: 2026, nomeDaAba: ABA_HE })

console.log(`\n=== ${ABA_HE} ===`)
console.log(`mês lido do nome da aba: ${mes}`)
console.log(`dias com coluna: ${he.dias.join(', ')}`)
console.log(`registros: ${he.registros.length} somando ${he.registros.reduce((a, r) => a + r.valor, 0)}`)
console.log(`problemas: ${he.problemas.length}`)
for (const p of he.problemas) console.log(`   linha ${p.linha} ${p.coluna ?? ''} -> ${p.motivo}`)

console.log('\n=== confere contra a linha TOTAIS da própria planilha ===')
const div = conferirTotaisDeHorasExtras(he)
conferir(div.length === 0, 'a soma por dia bate com o TOTAIS', div.length ? JSON.stringify(div) : '')
for (const [dia, dec] of Object.entries(he.totaisDeclarados ?? {})) {
  const calc = he.registros.filter((r) => r.dia === Number(dia)).reduce((a, r) => a + r.valor, 0)
  console.log(`  dia ${String(dia).padStart(2, '0')}: calculado ${calc} | declarado ${dec}`)
}

console.log('\n=== o que a planilha prova sobre o valor da diária ===')
const porCargo = new Map()
for (const r of he.registros) {
  const k = r.cargo ?? '(sem cargo)'
  if (!porCargo.has(k)) porCargo.set(k, new Set())
  porCargo.get(k).add(r.valor)
}
for (const [cargo, valores] of [...porCargo].sort()) {
  const v = [...valores].sort((a, b) => a - b)
  console.log(`  ${cargo.padEnd(26)} ${JSON.stringify(v)}${v.length > 1 ? '   <- MESMO CARGO, VALORES DIFERENTES' : ''}`)
}
conferir([...porCargo.values()].some((s) => s.size > 1), 'a planilha CONFIRMA que o valor não sai do cargo')
conferir(he.registros.some((r) => !r.cargo), 'existe registro com valor e SEM cargo (ÉVERTON)')
conferir(new Set(he.registros.map((r) => r.chave)).size === he.registros.length, 'nenhuma chave de HE colide')
conferir(he.registros.every((r) => r.pago), 'todos os lançamentos estão marcados PG, como no arquivo')

console.log(falhas === 0 ? '\nTUDO CONFERE.\n' : `\n${falhas} FALHA(S).\n`)
process.exit(falhas === 0 ? 0 : 1)
