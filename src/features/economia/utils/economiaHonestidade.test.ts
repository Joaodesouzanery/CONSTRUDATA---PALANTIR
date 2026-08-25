/**
 * O Economia dizendo a verdade sobre o próprio número.
 *
 * ─── O QUE A AUDITORIA DE 25/08/2026 ENCONTROU ────────────────────────────────
 * O encanamento é real: o módulo lê mesmo RDO, Suprimentos, LPS, EVM, Equipamentos e Medição. Mas
 * o valor em reais de quase todo evento é `dado real × constante fixa no código × campo da linha
 * de base`, a linha de base nasce preenchida sozinha com números de exemplo, e o campo do valor é
 * editável — dá para digitar qualquer número e validar.
 *
 * A tela dizia "economia comprovada... calculada a partir de dados reais, nunca de números
 * fictícios", e esse texto ia inteiro para o PDF entregue a uma diretoria. **Nenhuma fórmula de
 * dinheiro tinha um único teste.**
 *
 * Estes testes travam o passo 1: parar de prometer o que o cálculo não entrega.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ehAjusteManual, baselineFoiConfirmada, premissasDoEvento, totaisPorOrigem,
  defaultEconomyBaseline,
} from './economiaEngine'
import type { EconomyEvent } from '@/types'

const ev = (p: Partial<EconomyEvent>): EconomyEvent => ({
  id: 'e1', stableKey: 'k1', sourceModule: 'rdo', sourceId: 's1', category: 'production_stoppage',
  projectId: null, projectName: 'SUPERA', date: '2026-08-01', period: '2026-08',
  title: 'Paralisação evitada', description: '', impactBRL: 1000, formula: 'a*b',
  assumptions: {}, confidence: 'medium', status: 'validated', evidence: [],
  createdAt: '', updatedAt: '', ...p,
})

// ── Estimado × digitado à mão ─────────────────────────────────────────────────

test('valor igual ao estimado NÃO é ajuste manual', () => {
  assert.equal(ehAjusteManual(ev({ impactBRL: 1000, impactEstimadoBRL: 1000 })), false)
})

test('valor diferente do estimado É ajuste manual', () => {
  assert.equal(ehAjusteManual(ev({ impactBRL: 9000, impactEstimadoBRL: 1000 })), true)
  assert.equal(ehAjusteManual(ev({ impactBRL: 100, impactEstimadoBRL: 1000 })), true)
})

test('evento antigo, sem estimado gravado, não é acusado de ajuste', () => {
  // Os eventos que já existem no banco não têm o campo. Marcá-los como "digitado à mão" seria
  // acusar o usuário de algo que ele não fez.
  assert.equal(ehAjusteManual(ev({ impactBRL: 1000, impactEstimadoBRL: undefined })), false)
})

test('centavo de arredondamento não vira ajuste manual', () => {
  assert.equal(ehAjusteManual(ev({ impactBRL: 1000, impactEstimadoBRL: 1000.004 })), false)
  assert.equal(ehAjusteManual(ev({ impactBRL: 1000, impactEstimadoBRL: 1000.01 })), true)
})

// ── Os dois totais que nunca podem virar um só ────────────────────────────────

test('o total separa o que foi calculado do que foi digitado', () => {
  const t = totaisPorOrigem([
    ev({ id: 'a', impactBRL: 1000, impactEstimadoBRL: 1000 }),
    ev({ id: 'b', impactBRL: 5000, impactEstimadoBRL: 800 }),
    ev({ id: 'c', impactBRL: 200,  impactEstimadoBRL: 200 }),
  ])
  assert.equal(t.estimadoBRL, 1200)
  assert.equal(t.ajustadoAMaoBRL, 5000)
  assert.equal(t.eventosAjustados, 1)
})

test('só evento validado ou reportado entra na conta', () => {
  const t = totaisPorOrigem([
    ev({ id: 'a', status: 'detected',  impactBRL: 900, impactEstimadoBRL: 900 }),
    ev({ id: 'b', status: 'dismissed', impactBRL: 900, impactEstimadoBRL: 900 }),
    ev({ id: 'c', status: 'reported',  impactBRL: 100, impactEstimadoBRL: 100 }),
  ])
  assert.equal(t.estimadoBRL, 100)
  assert.equal(t.ajustadoAMaoBRL, 0)
})

test('valor negativo não vira crédito — o total é de perda EVITADA', () => {
  const t = totaisPorOrigem([ev({ impactBRL: -5000, impactEstimadoBRL: -5000 })])
  assert.equal(t.estimadoBRL, 0)
})

test('sem eventos, os dois totais são zero', () => {
  assert.deepEqual(totaisPorOrigem([]), { estimadoBRL: 0, ajustadoAMaoBRL: 0, eventosAjustados: 0 })
})

// ── A linha de base ───────────────────────────────────────────────────────────

test('a linha de base criada sozinha NÃO conta como confirmada', () => {
  // Ela nasce com 80 trabalhadores, R$ 160/pessoa-dia e R$ 300 mil/mês — números de exemplo.
  const b = defaultEconomyBaseline()
  assert.equal(baselineFoiConfirmada(b), false)
  assert.equal(b.workersCount, 80)
  assert.equal(b.costPerPersonDayBRL, 160)
  assert.equal(b.materialMonthlyBudgetBRL, 300000)
})

test('só o "sim" explícito confirma', () => {
  assert.equal(baselineFoiConfirmada({ ...defaultEconomyBaseline(), confirmadaPeloUsuario: true }), true)
  assert.equal(baselineFoiConfirmada({ ...defaultEconomyBaseline(), confirmadaPeloUsuario: false }), false)
  assert.equal(baselineFoiConfirmada(undefined), false)
  assert.equal(baselineFoiConfirmada(null), false)
})

// ── As premissas, que não apareciam em lugar nenhum ───────────────────────────

test('as constantes do cálculo saem por extenso, em português', () => {
  const p = premissasDoEvento(ev({
    assumptions: { probabilidadeImpacto: 0.35, custoDiaParada: 12800, diasEvitados: 1 },
  }))
  const texto = p.map((x) => `${x.rotulo} ${x.valor}`).join(' · ')
  assert.match(texto, /probabilidade de virar atraso 35%/)
  assert.match(texto, /dias evitados 1/)
  assert.ok(texto.includes('12.800'), `custo do dia parado ausente em "${texto}"`)
})

test('fração vira percentual; número grande vira reais; o resto fica como está', () => {
  const p = premissasDoEvento(ev({
    assumptions: { emergencyMarkupPct: 0.12, orcamentoMensalMaterial: 300000, diasImpacto: 2 },
  }))
  const por = Object.fromEntries(p.map((x) => [x.rotulo, x.valor]))
  assert.equal(por['sobrepreço de compra emergencial'], '12%')
  assert.ok(por['orçamento mensal de material'].includes('300.000'))
  assert.equal(por['dias de impacto'], '2')
})

test('premissa com nome desconhecido aparece mesmo assim, com a chave crua', () => {
  // Melhor uma chave feia visível do que um número invisível na conta.
  const p = premissasDoEvento(ev({ assumptions: { fatorNovoQualquer: 7 } }))
  assert.deepEqual(p, [{ rotulo: 'fatorNovoQualquer', valor: '7' }])
})

test('evento sem premissas devolve lista vazia, não quebra', () => {
  assert.deepEqual(premissasDoEvento(ev({ assumptions: {} })), [])
})

// ── A trava contra a promessa voltar ──────────────────────────────────────────

test('nenhum texto da tela nem do PDF promete o que o cálculo não entrega', async () => {
  // Não é teste de estilo: as frases abaixo estavam na tela E no PDF entregue a uma diretoria,
  // sobre números que são estimativa multiplicada por constante. Se alguém as reescrever, este
  // teste cai antes de o relatório sair de novo.
  const { readFile } = await import('node:fs/promises')
  const proibidas: Array<[RegExp, string]> = [
    [/nunca de n[úu]meros fict[íi]cios/i, 'afirma que o número nunca é fictício'],
    [/economia comprovada/i,              'chama de "comprovada" o que é estimado'],
    [/evid[êe]ncias rastre[áa]veis/i,     'promete rastreabilidade que a constante do cálculo não tem'],
    [/calculad[oa]s? a partir de dados reais/i, 'sugere que o valor em R$ vem medido do dado real'],
  ]
  const arquivos = [
    'src/features/economia/index.tsx',
    'src/features/economia/utils/economiaReportExport.ts',
  ]
  for (const arquivo of arquivos) {
    const texto = await readFile(new URL(`../../../../${arquivo}`, import.meta.url), 'utf8')
    for (const [padrao, porque] of proibidas) {
      assert.ok(!padrao.test(texto), `${arquivo}: ${porque} (${padrao})`)
    }
  }
})

test('o PPC de 78% que ninguém mediu não pode voltar ao relatório', async () => {
  // Havia `Math.max(baseline?.ppcPercent ?? 0, 78)`: sem dados de planejamento, o PDF AFIRMAVA um
  // indicador de 78%. Era o pior caso do módulo — um número inventado dentro de um documento.
  const { readFile } = await import('node:fs/promises')
  const store = await readFile(new URL('../../../../src/store/economiaStore.ts', import.meta.url), 'utf8')
  const geracao = store.slice(store.indexOf('generateMonthlyReport'), store.indexOf('markReportSent'))
  assert.ok(!/Math\.max\([^)]*,\s*78\s*\)/.test(geracao), 'o piso de 78% voltou ao relatório mensal')
})
