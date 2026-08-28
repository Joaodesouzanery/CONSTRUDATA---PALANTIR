/**
 * O quadro de Gestão à Vista — os dados e o papel.
 *
 * A função de build do documento é pura de propósito: dá para conferir o A4 sem abrir janela
 * nenhuma, e é o que permite travar aqui as duas coisas que mais importam no papel — que ele diga
 * o que NÃO sabe, e que a marca d'água de Demonstração apareça.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { montarGestaoAVista } from './gestaoAVista'
import { buildGestaoAVistaHtml } from './gestaoAVistaExport'
import type { ConstructionSite, Worker, Shift, RDO, WorkWeekMode } from '@/types'

const HOJE = '2026-08-20'
const JORNADA: WorkWeekMode = 'mon_fri'
const SEM_FERIADO = new Set<string>()

const w = (p: Partial<Worker> = {}): Worker => ({
  id: 'w1', name: 'João', role: 'Pintor', cpfMasked: '***', crewId: 'c1', status: 'active',
  certifications: [], hourlyRate: 20, ...p,
} as Worker)

const turno = (p: Partial<Shift> = {}): Shift => ({
  id: Math.random().toString(36).slice(2), workerId: 'w1', date: HOJE,
  startTime: '07:00', endTime: '16:00', breakMinutes: 60, type: 'regular', status: 'completed', ...p,
} as unknown as Shift)

const rdoCompizzo = (p: { date: string; producao: Array<{ contractServiceId: string; quantidade: string }> }): RDO => ({
  id: Math.random().toString(36).slice(2), number: '1', date: p.date, siteId: 'o1',
  status: 'finalizado', template: 'compizzo', compizzo: { producao: p.producao },
} as unknown as RDO)

const obra = (p: Partial<ConstructionSite> = {}): ConstructionSite => ({
  id: 'o1', name: 'SUPERA', owner: 'Cliente', company: '', status: 'active', risks: [], ...p,
} as unknown as ConstructionSite)

const montar = (p: Partial<Parameters<typeof montarGestaoAVista>[0]> = {}) => montarGestaoAVista({
  site: null, workers: [], absences: [], shifts: [], rdos: [],
  feriados: SEM_FERIADO, jornada: JORNADA, hoje: HOJE, ...p,
})

// ── Os dados ──────────────────────────────────────────────────────────────────

test('sem funcionário e sem contrato, o quadro se declara vazio em vez de fingir', () => {
  assert.equal(montar().vazio, true)
})

test('um funcionário já basta para haver quadro', () => {
  const d = montar({ workers: [w()] })
  assert.equal(d.vazio, false)
  assert.equal(d.efetivo.total.total, 1)
})

test('a janela padrão é de 12 meses e termina no mês de hoje', () => {
  const d = montar({ workers: [w()] })
  assert.equal(d.meses.length, 12)
  assert.equal(d.meses[11], '2026-08')
  assert.equal(d.meses[0], '2025-09')
  assert.equal(d.serie.length, 12)
})

test('obra sem composição diz isso — não mostra tabela vazia', () => {
  const d = montar({ workers: [w()], site: obra() })
  assert.equal(d.semComposicao, true)
  assert.deepEqual(d.avanco, [])
})

test('o avanço soma por mês e calcula o % contra a quantidade contratada', () => {
  const d = montar({
    site: obra({ contrato: { services: [
      { id: 's1', descricao: 'Pintura epóxi', unidade: 'm²', qtdContrato: 1000, valorUnitario: 10 },
    ] } } as Partial<ConstructionSite>),
    rdos: [
      rdoCompizzo({ date: '2026-07-10', producao: [{ contractServiceId: 's1', quantidade: '200' }] }),
      rdoCompizzo({ date: '2026-08-05', producao: [{ contractServiceId: 's1', quantidade: '50' }] }),
    ],
  })
  const linha = d.avanco[0]
  assert.equal(linha.medido, 250)
  assert.equal(linha.pct, 25)
  assert.equal(linha.porMes[d.meses.indexOf('2026-07')], 200)
  assert.equal(linha.porMes[d.meses.indexOf('2026-08')], 50)
})

test('serviço de verba (sem quantidade contratada) tem % null, não 0%', () => {
  const d = montar({
    site: obra({ contrato: { services: [
      { id: 's1', descricao: 'Mobilização', unidade: 'vb', qtdContrato: 0, valorUnitario: 5000 },
    ] } } as Partial<ConstructionSite>),
  })
  assert.equal(d.avanco[0].pct, null)
})

test('o total medido conta TODO o histórico, mesmo fora da janela de 12 meses', () => {
  // Cortar o histórico faria uma obra antiga parecer no começo — o % é contra o contrato inteiro.
  const d = montar({
    site: obra({ contrato: { services: [
      { id: 's1', descricao: 'Pintura', unidade: 'm²', qtdContrato: 1000, valorUnitario: 10 },
    ] } } as Partial<ConstructionSite>),
    rdos: [rdoCompizzo({ date: '2024-01-15', producao: [{ contractServiceId: 's1', quantidade: '400' }] })],
  })
  assert.equal(d.avanco[0].medido, 400, 'o RDO de 2024 conta no total')
  assert.ok(d.avanco[0].porMes.every((q) => q === 0), 'mas não aparece em nenhuma coluna da janela')
})

// ── O papel ───────────────────────────────────────────────────────────────────

const imprimir = (d = montar({ workers: [w()], shifts: [turno()] }), demo = false) =>
  buildGestaoAVistaHtml({ dados: d, empresa: 'Compizzo', hoje: HOJE, demo })

test('o documento sai em A4 deitado, com paginação e a marca', () => {
  const html = imprimir()
  assert.match(html, /@page\{size:A4 landscape/)
  assert.match(html, /counter\(page\)/, 'sem numeração de página')
  assert.match(html, /Gestão à Vista/)
})

test('o botão de imprimir some na impressão — senão sai um retângulo laranja no papel', () => {
  assert.match(imprimir(), /@media print\{\.barra-acoes\{display:none !important\}\}/)
})

test('⚠️ em Demonstração o papel carrega a marca d\'água, e sem ela não', () => {
  // Um quadro de demonstração pregado na parede vira dado real na cabeça de quem passa.
  assert.match(imprimir(undefined, true), /DEMONSTRAÇÃO/)
  assert.ok(!/DEMONSTRAÇÃO/.test(imprimir(undefined, false)))
})

test('o papel diz o que NÃO sabe: sem composição, e que o previsto não existe', () => {
  const html = imprimir(montar({ workers: [w()], site: obra() }))
  assert.match(html, /não tem a composição do contrato cadastrada/)
})

test('o papel explica o denominador da frequência, em vez de só mostrar o número', () => {
  assert.match(imprimir(), /dia\(s\) útil\(eis\) do mês/)
  assert.match(imprimir(), /não entram/)
})

test('nome de obra com HTML é escapado — o documento não pode ser injetável', () => {
  const html = imprimir(montar({ workers: [w()], site: obra({ name: '<script>alert(1)</script>' }) }))
  assert.ok(!html.includes('<script>alert(1)</script>'))
  assert.match(html, /&lt;script&gt;/)
})
