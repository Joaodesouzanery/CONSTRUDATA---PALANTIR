/**
 * Roda o leitor de Controle de Caixa contra o ARQUIVO REAL do cliente e confere o resultado
 * contra os números que a própria planilha declara na linha de fechamento.
 *
 * Não é teste unitário: é a prova de que o leitor aguenta o arquivo de verdade, com as
 * irregularidades que só existem nele. Rode com:
 *   node --import ./scripts/testes/resolver-ts.mjs scripts/qa/qa-controle-caixa.mjs
 */
import xlsx from 'xlsx'
import {
  lerLancamentos, lerHorasExtras, conferirTotaisDeHorasExtras, mesDoNomeDaAba,
  mesEAnoDoNomeDaAba, separarProblemas,
} from '../../src/features/financeiro/utils/controleDeCaixaPlanilha.ts'
import { lerCategoria } from '../../src/features/financeiro/utils/controleDeCaixaImport.ts'
import {
  lerPontoSaida, candidatosAoVinculo, lerListaDeClassificacoes,
} from '../../src/features/financeiro/utils/controleDeCaixaPontoSaida.ts'

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

console.log('\n=== a coluna DESCRIÇÃO é compartilhada — e não pode vazar ===')
// ⚠️ Esta asserção FALHAVA antes do conserto: as 9 receitas do arquivo recebiam a descrição da
// despesa que dividia a linha com elas. O QA não pegava porque só conferia SOMAS — e as somas
// sempre estiveram certas. O valor nunca esteve errado; a descrição esteve.
const herdadas = rec.filter((rr) => des.some((dd) => dd.linha === rr.linha && dd.descricao === rr.descricao))
conferir(
  herdadas.length === 0,
  'nenhuma receita herdou a descrição da despesa da mesma linha',
  herdadas.length ? `${herdadas.length} herdaram` : `${rec.length} receitas conferidas`,
)

// E a contraprova: se as receitas sumissem, a asserção acima passaria vazia.
conferir(rec.length > 0, 'as receitas continuam sendo lidas', `${rec.length} receitas`)

// Linha com os dois blocos tem de avisar que a receita ficou sem descrição própria.
const avisosDeReceita = r.problemas.filter((p) => p.coluna === 'DESCRIÇÃO' && /Receita/.test(p.motivo))
conferir(
  avisosDeReceita.length === rec.length,
  'toda receita sem descrição própria gera aviso na tela',
  `${avisosDeReceita.length} avisos para ${rec.length} receitas`,
)

// E o id externo não pode ser dado aos dois: addEntry é upsert, um apagaria o outro.
const idsExternos = r.lancamentos.map((l) => l.idExterno).filter(Boolean)
conferir(
  new Set(idsExternos).size === idsExternos.length,
  'nenhum ID externo foi dado a dois lançamentos',
  `${idsExternos.length} ids`,
)

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

// ═══════════════════════════════════════════════════════════════════════════════
// O ARQUIVO REAL DO CLIENTE
//
// ⚠️ O bloco acima roda contra o MODELO — o arquivo que o próprio sistema gera, e por isso
// perfeitamente comportado. Ele nunca teria pego nada do que esta investigação achou: nem a
// aba "AGOSTO" sem dígito, nem o cabeçalho "DIA 01", nem as 13 classificações, nem a linha de
// total sem rótulo. Os números abaixo foram MEDIDOS e ficam travados aqui.
// ═══════════════════════════════════════════════════════════════════════════════

const REAL = 'docs/CONTROLE DE CAIXA ATUAL (2).xlsx'
console.log(`\n=== ${REAL} ===`)

const wbR = XLSX.readFile(REAL, { cellDates: true })
conferir(
  JSON.stringify(wbR.SheetNames) === JSON.stringify(['DESPESAS', 'AUSÊNCIA PONTO SAÍDA', 'HORAS EXTRAS AGOSTO', 'Planilha1']),
  'as 4 abas do arquivo', JSON.stringify(wbR.SheetNames),
)

// ── DESPESAS ──
const mR = XLSX.utils.sheet_to_json(wbR.Sheets['DESPESAS'], { header: 1, raw: true, defval: null })
const rR = lerLancamentos(mR)
const recR = rR.lancamentos.filter((l) => l.tipo === 'receita')
const desR = rR.lancamentos.filter((l) => l.tipo === 'despesa')
const soma = (xs) => xs.reduce((a, l) => a + l.valor, 0)

conferir(rR.lancamentos.length === 237, '237 lançamentos', String(rR.lancamentos.length))
conferir(recR.length === 18, '18 receitas — as que o cliente achou que tinham sido descartadas', String(recR.length))
conferir(desR.length === 219, '219 despesas', String(desR.length))
conferir(Math.abs(soma(recR) - 112050) < 0.01, 'receitas somam R$ 112.050,00 — igual ao rodapé', soma(recR).toFixed(2))
conferir(Math.abs(soma(desR) - 112296.06) < 0.01, 'despesas somam R$ 112.296,06 — igual ao rodapé', soma(desR).toFixed(2))
conferir(Math.abs(rR.totaisDeclarados.receitas - soma(recR)) < 0.01, 'a planilha e o sistema chegam sozinhos ao mesmo total de receita')
conferir(Math.abs(rR.totaisDeclarados.despesas - soma(desR)) < 0.01, 'idem despesa')

// 🔴 O defeito que quase abortou a importação: ressalva apresentada como rejeição.
const { avisos, recusas } = separarProblemas(rR.problemas)
conferir(recusas.length === 0, 'NENHUMA linha ficou de fora', `recusas=${recusas.length}`)
conferir(avisos.length === 18, '18 ressalvas — e elas ENTRARAM', String(avisos.length))

// 🔴 A classificação: 194 de 219 caíam em `outro`.
const emOutro = desR.filter((l) => lerCategoria(l.categoria, 'saida') === 'outro')
conferir(emOutro.length <= 32, 'no máximo 32 despesas sem categoria da DRE (eram 194)', String(emOutro.length))
conferir(desR.every((l) => !l.categoria || String(l.categoria).trim().length > 0), 'a palavra do cliente nunca vem vazia quando existe')

// ── HORAS EXTRAS AGOSTO ──
const nomeHE = 'HORAS EXTRAS AGOSTO'
const mesAno = mesEAnoDoNomeDaAba(nomeHE)
conferir(mesAno?.mes === 8, 'o mês sai de "AGOSTO" — antes a aba inteira não era lida', JSON.stringify(mesAno))
const heR = lerHorasExtras(
  XLSX.utils.sheet_to_json(wbR.Sheets[nomeHE], { header: 1, raw: true, defval: null }),
  { mes: 8, ano: 2026, nomeDaAba: nomeHE },
)
conferir(heR.registros.length === 72, '72 células com hora extra', String(heR.registros.length))
conferir(new Set(heR.registros.map((x) => x.nome)).size === 30, '30 pessoas com lançamento', String(new Set(heR.registros.map((x) => x.nome)).size))
conferir(Math.abs(heR.registros.reduce((a, x) => a + x.valor, 0) - 20300) < 0.01, 'R$ 20.300,00 na grade', String(heR.registros.reduce((a, x) => a + x.valor, 0)))
conferir(conferirTotaisDeHorasExtras(heR).length === 0, 'a soma por dia bate com a linha TOTAIS da grade')
conferir(heR.problemas.length === 0, 'nenhuma célula recusada na grade')
conferir(JSON.stringify(heR.dias) === JSON.stringify([1, 2, 8, 15, 16, 22, 29, 30]), 'os 8 dias do cabeçalho "DIA nn"', JSON.stringify(heR.dias))

// ── AUSÊNCIA PONTO SAÍDA ──
const psR = lerPontoSaida(
  XLSX.utils.sheet_to_json(wbR.Sheets['AUSÊNCIA PONTO SAÍDA'], { header: 1, raw: true, defval: null }),
  { ano: 2026 },
)
conferir(psR.linhas.length === 10, '10 colaboradores', String(psR.linhas.length))
conferir(!psR.linhas.some((l) => /^\d/.test(l.colaborador)), 'a linha de total sem rótulo NÃO virou colaborador')
conferir(Math.abs(psR.somaDeclarada - 2065.15) < 0.01, 'declarado R$ 2.065,15', psR.somaDeclarada.toFixed(2))
conferir(psR.batem === 6, '6 linhas batem ao centavo com o motor do sistema', String(psR.batem))
conferir(Math.abs((psR.somaRecalculada - psR.somaDeclarada) - 13.95) < 0.02, 'a divergência é R$ 13,95', (psR.somaRecalculada - psR.somaDeclarada).toFixed(2))
conferir(psR.linhas.some((l) => l.diasTexto === '13 e 20/08'), '"13 e 20/08" virou UM registro com o texto preservado')
conferir(psR.linhas.every((l) => l.pagoEm === '2026-09-10'), 'a coluna sem cabeçalho "Pago em 10/09" foi lida')

// 🔴 O vínculo: o dinheiro JÁ está no caixa, e é preciso achá-lo, não criá-lo.
const comoEntry = desR.map((l, i) => ({ id: `e${i}`, tipo: 'saida', valor: l.valor, data: l.data, descricao: l.descricao }))
const cands = candidatosAoVinculo(comoEntry, psR.totalDeclaradoDaAba, '2026-09-10')
conferir(cands[0]?.exato === true, 'o lançamento de R$ 2.065,15 já existe na aba DESPESAS', cands[0]?.descricao?.slice(0, 50))

// ── Planilha1 ──
const lista = lerListaDeClassificacoes(XLSX.utils.sheet_to_json(wbR.Sheets['Planilha1'], { header: 1, raw: true, defval: null }))
conferir(lista.length === 13, 'as 13 classificações do cliente', String(lista.length))

// 🔴 Reimportar não pode mudar nada.
conferir(
  JSON.stringify(lerLancamentos(mR).lancamentos) === JSON.stringify(rR.lancamentos),
  'ler duas vezes dá exatamente o mesmo resultado',
)

console.log(falhas === 0 ? '\nTUDO CONFERE.\n' : `\n${falhas} FALHA(S).\n`)
process.exit(falhas === 0 ? 0 : 1)
