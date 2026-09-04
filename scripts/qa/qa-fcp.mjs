/**
 * Roda o leitor e o motor do FCP contra a PLANILHA REAL do cliente, e mostra onde os dois
 * discordam. É a prova de que o motor aguenta o arquivo de verdade — e é a demonstração da
 * funcionalidade de conferência.
 *
 *   node --import ./scripts/testes/resolver-ts.mjs scripts/qa/qa-fcp.mjs
 */
import xlsx from 'xlsx'
import { lerPlanilhaFcp } from '../../src/features/financeiro/utils/fcp/importarFcp.ts'
import {
  capitalNecessario, custoMensalDaCidade, custoMensalGlobal, fluxoMensal, fluxoEconomico,
  sensibilidade, ticketDaCidade, viabilidadeDaCidade,
} from '../../src/features/financeiro/utils/fcp/motor.ts'

const XLSX = xlsx.default ?? xlsx
const CAMINHO = 'docs/FLUXO_CAIXA_PROJETADO_BERTIOGA_SANTOS_v2.xlsx'
const wb = XLSX.readFile(CAMINHO, { cellDates: true })

const abas = {}
for (const nome of wb.SheetNames) {
  abas[nome] = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null })
}

const n = (x) => (x ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
let falhas = 0
const conferir = (ok, rotulo, detalhe = '') => {
  console.log(`  ${ok ? 'OK   ' : 'FALHA'}  ${rotulo}${detalhe ? `  ${detalhe}` : ''}`)
  if (!ok) falhas++
}

console.log(`\n=== ${CAMINHO} ===`)
const r = lerPlanilhaFcp(abas)
if (!r.premissas) { console.log('não consegui ler:', r.problemas); process.exit(1) }
const P = r.premissas

console.log('\n=== o que o leitor entendeu das PREMISSAS ===')
console.log(`  início ${P.inicioObra} · fim ${P.fimOperacao} · ${P.diasPorMes} dias/mês · defasagem ${P.defasagemDias}d · imposto ${(P.imposto * 100).toFixed(0)}%`)
console.log(`  cenário ${P.cenario} · margens ${JSON.stringify(P.margens)} · contingência ${(P.contingencia * 100).toFixed(0)}% · fator 1º mês ${P.fatorPrimeiroMes}`)
console.log(`  regime ${JSON.stringify(P.regime)} · desconta ${P.consorcioDescontaDaMedicao} · imposto ${P.baseDoImposto}`)
console.log(`  cidades: ${P.cidades.map((c) => `${c.nome} (${c.custos.quadro.length} no quadro, ${c.custos.gerais.length} gerais)`).join(' · ')}`)

console.log('\n=== o leitor reproduz os números da planilha? ===')
conferir(P.inicioObra === '2026-08-24', 'data de início', P.inicioObra)
conferir(P.defasagemDias === 20, 'defasagem', String(P.defasagemDias))
conferir(Math.abs(P.imposto - 0.22) < 1e-9, 'imposto', String(P.imposto))
conferir(P.cenario === 'OTIMA', 'cenário adotado', P.cenario)
conferir(P.cidades.length === 2, 'duas cidades', String(P.cidades.length))
const b = P.cidades.find((c) => /bertioga/i.test(c.nome))
const s = P.cidades.find((c) => /santos/i.test(c.nome))
conferir(b?.custos.quadro.length === 15, 'quadro de Bertioga com 15 pessoas', String(b?.custos.quadro.length))
conferir(Math.abs(custoMensalDaCidade(b) - 237292.84) < 0.5, 'custo mensal Bertioga', n(custoMensalDaCidade(b)))
conferir(Math.abs(custoMensalDaCidade(s) - 269561.48) < 0.5, 'custo mensal Santos', n(custoMensalDaCidade(s)))
conferir(Math.abs(custoMensalGlobal(P) - 506854.32) < 0.5, 'custo mensal GLOBAL', n(custoMensalGlobal(P)))
conferir(Math.abs(ticketDaCidade(s) - 1338.825) < 0.01, 'ticket ponderado Santos', n(ticketDaCidade(s)))
conferir(P.regime.indiretos === 'EMPRESA' && P.regime.folha === 'CONSORCIO', 'regime lido certo')

console.log('\n=== preços do contrato ===')
for (const [cidade, lista] of Object.entries(r.precos)) {
  const conf = lista.filter((x) => x.precisaConferir).length
  console.log(`  ${cidade.padEnd(12)} ${String(lista.length).padStart(4)} itens${conf ? `  ⚠️ ${conf} marcados "conferir" (transcritos de foto)` : ''}`)
}
conferir(Object.keys(r.precos).length === 2, 'as duas tabelas de preço foram lidas')

console.log('\n=== o que o motor calcula ===')
const meses = fluxoMensal(P)
const cap = capitalNecessario(P, meses)
const eco = fluxoEconomico(P)
console.log(`  necessidade máxima ${n(cap.necessidadeMaxima)} · contingência ${n(cap.contingencia)} · CAPITAL ${n(cap.capitalRecomendado)}  (pior em ${cap.mesDoPiorPonto})`)
console.log(`  resultado econômico no horizonte: ${n(eco[eco.length - 1].resultadoAcumulado)}`)
console.log('\n  sensibilidade:')
for (const x of sensibilidade(P)) {
  console.log(`    ${x.cenario.padEnd(7)} necessidade ${n(x.capital.necessidadeMaxima).padStart(12)} · capital ${n(x.capital.capitalRecomendado).padStart(12)} · resultado ${n(x.resultadoFinal).padStart(14)} ${x.adotado ? '◀ adotado' : ''}`)
}

console.log('\n=== ⚠️ DIVERGÊNCIAS ENTRE O MOTOR E A PLANILHA ===')
if (r.divergencias.length === 0) console.log('  nenhuma.')
for (const d of r.divergencias) {
  console.log(`  ${d.aba.padEnd(12)} ${d.oQue.padEnd(44)} motor ${n(d.calculado).padStart(14)} | planilha ${n(d.naPlanilha).padStart(14)} | Δ ${n(d.diferenca)} (${(d.proporcao * 100).toFixed(1)}%)`)
}
for (const d of r.divergencias) {
  // ⚠️ Divergência sem causa manda a pessoa para a reunião com uma pergunta em aberto. Quando a
  // causa é demonstrável a partir da própria planilha, ela tem de vir escrita.
  conferir(!!d.causaProvavel, `divergência "${d.oQue}" traz a causa`, d.causaProvavel ? '' : 'sem causa')
}

console.log('\n=== o que o leitor extrai (e a tela precisa mostrar) ===')
const pessoas = P.cidades.reduce((n2, c) => n2 + c.custos.quadro.length, 0)
const gerais = P.cidades.reduce((n2, c) => n2 + c.custos.gerais.length, 0)
const todosPrecos = Object.values(r.precos).flat()
const aConferir = todosPrecos.filter((x) => x.precisaConferir).length
// ⚠️ Só CONTAGEM. O arquivo tem nome e salário individual de gente real — ver SECURITY.md.
console.log(`  quadro nominal: ${pessoas} pessoas · custos gerais: ${gerais} itens`)
console.log(`  preços: ${todosPrecos.length} itens, dos quais ${aConferir} marcados "conferir"`)
conferir(pessoas >= 30, 'o quadro das duas cidades foi lido', `${pessoas} pessoas`)
conferir(gerais >= 18, 'os custos gerais foram lidos', `${gerais} itens`)
conferir(todosPrecos.length >= 500, 'as tabelas de preço foram lidas', `${todosPrecos.length} itens`)
conferir(aConferir > 0, 'os itens transcritos de foto continuam marcados', `${aConferir} a conferir`)

if (r.problemas.length) {
  console.log('\n=== problemas de leitura ===')
  for (const p of r.problemas) console.log(`  ${p.aba}: ${p.motivo}`)
}

console.log(falhas === 0 ? '\nO LEITOR CONFERE.\n' : `\n${falhas} FALHA(S).\n`)
process.exit(falhas === 0 ? 0 : 1)
