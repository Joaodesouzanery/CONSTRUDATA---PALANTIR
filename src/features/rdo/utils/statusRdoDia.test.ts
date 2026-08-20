/**
 * A lacuna de RDO — "há X dias sem o RDO do dia Y".
 *
 * As bordas que fazem um alerta virar paisagem se estiverem erradas: fim de semana, feriado, obra
 * que começou semana passada, obra parada, e a diferença entre rascunho e finalizado.
 *
 * Datas escolhidas com o dia da semana anotado, porque a regra depende dele:
 *   2026-08-17 seg · 18 ter · 19 qua · 20 qui · 21 sex · 22 sáb · 23 dom · 24 seg
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lacunaDeRdo, ehDiaCobravel } from './statusRdoDia'
import { ehDiaUtil, contarDiasUteis, diasEntre } from '@/lib/diasUteis'
import type { ConstructionSite, RDO } from '@/types'

const obra = (p: Partial<ConstructionSite> = {}): ConstructionSite => ({
  id: 'obra-1', code: 'OBRA-1', name: 'Supera', company: '', owner: '', manager: '',
  description: '', status: 'active', street: '', number: '', district: '', city: '', state: '',
  buildingType: '', totalArea: 0, floors: 0, startDate: '2026-01-01', expectedEnd: '2026-12-31',
  risks: [], ...p,
} as ConstructionSite)

const rdo = (date: string, status?: 'rascunho' | 'finalizado'): RDO =>
  ({ id: `r-${date}`, number: 1, date, siteId: 'obra-1', status } as RDO)

const SEM_FERIADO: { date: string; description: string }[] = []
const vazio = new Map<string, string>()

const chamar = (p: Partial<Parameters<typeof lacunaDeRdo>[0]> = {}) => lacunaDeRdo({
  site: obra(), rdos: [], semProducao: vazio, hoje: '2026-08-20',
  feriados: SEM_FERIADO as never, jornada: 'mon_fri', ...p,
})

// ─── Dias úteis (a peça compartilhada) ─────────────────────────────────────────

test('domingo nunca é dia útil; sábado depende da jornada', () => {
  const semFeriado = new Set<string>()
  assert.equal(ehDiaUtil('2026-08-23', semFeriado, 'mon_sat').util, false, 'domingo, jornada 6x1')
  assert.equal(ehDiaUtil('2026-08-23', semFeriado, 'mon_fri').util, false, 'domingo, jornada 5x2')
  assert.equal(ehDiaUtil('2026-08-22', semFeriado, 'mon_fri').util, false, 'sábado fora da jornada')
  assert.equal(ehDiaUtil('2026-08-22', semFeriado, 'mon_sat').util, true, 'sábado dentro da jornada')
  assert.equal(ehDiaUtil('2026-08-20', semFeriado, 'mon_fri').util, true, 'quinta')
})

test('feriado cadastrado não é dia útil', () => {
  assert.equal(ehDiaUtil('2026-08-20', new Set(['2026-08-20']), 'mon_fri').util, false)
  assert.equal(ehDiaUtil('2026-08-20', new Set(['2026-08-20']), 'mon_fri').razao, 'feriado')
})

test('contagem de dias úteis na semana e na virada do ano', () => {
  const s = new Set<string>()
  assert.equal(contarDiasUteis('2026-08-17', '2026-08-23', s, 'mon_fri'), 5, 'seg a dom, 5x2')
  assert.equal(contarDiasUteis('2026-08-17', '2026-08-23', s, 'mon_sat'), 6, 'seg a dom, 6x1')
  assert.equal(contarDiasUteis('2026-08-20', '2026-08-19', s, 'mon_fri'), 0, 'intervalo invertido')
  assert.equal(contarDiasUteis('2026-08-20', '2026-08-20', s, 'mon_fri'), 1, 'um dia só')
  assert.equal(diasEntre('2026-12-28', '2027-01-04'), 7, 'atravessa o ano')
})

// ─── ehDiaCobravel ─────────────────────────────────────────────────────────────

test('antes do início da obra não se cobra RDO', () => {
  const nova = obra({ startDate: '2026-08-18' })
  const s = new Set<string>()
  assert.equal(ehDiaCobravel(nova, '2026-08-17', s, 'mon_fri').cobra, false)
  assert.equal(ehDiaCobravel(nova, '2026-08-17', s, 'mon_fri').razao, 'antes do início da obra')
  assert.equal(ehDiaCobravel(nova, '2026-08-18', s, 'mon_fri').cobra, true, 'o primeiro dia já cobra')
})

test('obra parada, concluída ou arquivada não cobra', () => {
  const s = new Set<string>()
  for (const st of ['paused', 'completed', 'planning'] as const) {
    assert.equal(ehDiaCobravel(obra({ status: st }), '2026-08-20', s, 'mon_fri').cobra, false, st)
  }
  assert.equal(ehDiaCobravel(obra({ ativa: false }), '2026-08-20', s, 'mon_fri').cobra, false, 'arquivada')
})

// ─── A lacuna ──────────────────────────────────────────────────────────────────

test('RDO de hoje finalizado: nenhuma lacuna', () => {
  assert.equal(chamar({ rdos: [rdo('2026-08-20')] }), null)
})

test('sem RDO nenhum: a lacuna começa hoje e vai até o início da obra', () => {
  const l = chamar()
  assert.ok(l, 'tem de haver lacuna')
  assert.equal(l.maisAntigo <= '2026-08-20', true, 'o mais antigo não pode ser depois de hoje')
  assert.equal(l.diasEmAberto > 0, true)
  assert.equal(l.diasDesde, diasEntre(l.maisAntigo, '2026-08-20'))
})

test('a sequência para no primeiro dia resolvido', () => {
  // Feito na terça (18); hoje é quinta (20). Em aberto: quinta e quarta. A terça fecha a conta.
  const l = chamar({ rdos: [rdo('2026-08-18')] })
  assert.equal(l?.diasEmAberto, 2)
  assert.equal(l?.maisAntigo, '2026-08-19', 'a quarta é o mais antigo em aberto')
  assert.equal(l?.diasDesde, 1, 'a quarta foi ontem')
})

test('buraco antigo NÃO é somado quando os dias recentes estão em dia', () => {
  // A semana passada tem buracos, mas ontem e hoje foram feitos → nenhuma lacuna aberta.
  const l = chamar({ rdos: [rdo('2026-08-20'), rdo('2026-08-19')] })
  assert.equal(l, null, 'um contador que soma tudo desde sempre vira paisagem')
})

test('fim de semana não conta na lacuna', () => {
  // Hoje é segunda (24). Feito na sexta (21). Sábado e domingo não são cobráveis na jornada 5x2.
  const l = chamar({ hoje: '2026-08-24', rdos: [rdo('2026-08-21')] })
  assert.equal(l?.diasEmAberto, 1, 'só a própria segunda')
  assert.equal(l?.maisAntigo, '2026-08-24')
})

test('sábado conta quando a jornada é 6x1', () => {
  // Hoje é segunda (24), feito na sexta (21). Com 6x1 o sábado (22) entra na conta.
  const l = chamar({ hoje: '2026-08-24', jornada: 'mon_sat', rdos: [rdo('2026-08-21')] })
  assert.equal(l?.diasEmAberto, 2, 'sábado e segunda')
  assert.equal(l?.maisAntigo, '2026-08-22')
})

test('feriado não conta na lacuna', () => {
  const l = chamar({ rdos: [rdo('2026-08-18')], feriados: [{ date: '2026-08-19', description: 'X' }] as never })
  assert.equal(l?.diasEmAberto, 1, 'a quarta virou feriado; sobra só a quinta')
  assert.equal(l?.maisAntigo, '2026-08-20')
})

test('"não teve produção" fecha o dia igual a um RDO', () => {
  const justificado = new Map([['obra-1|2026-08-19', 'chuva']])
  const l = chamar({ rdos: [], semProducao: justificado })
  assert.equal(l?.diasEmAberto, 1, 'a quarta está justificada, então a sequência para nela')
  assert.equal(l?.maisAntigo, '2026-08-20')
})

test('rascunho NÃO fecha o dia', () => {
  const l = chamar({ rdos: [rdo('2026-08-20', 'rascunho'), rdo('2026-08-19')] })
  assert.equal(l?.diasEmAberto, 1, 'o rascunho de hoje não alimenta nada, então hoje segue aberto')
  assert.equal(l?.maisAntigo, '2026-08-20')
})

test('obra criada há 3 dias não acumula 90', () => {
  const l = chamar({ site: obra({ startDate: '2026-08-18' }) })
  assert.equal(l?.diasEmAberto, 3, 'ter, qua, qui — e nada antes do início')
  assert.equal(l?.maisAntigo, '2026-08-18')
})

test('obra arquivada ou parada não gera lacuna', () => {
  assert.equal(chamar({ site: obra({ ativa: false }) }), null)
  assert.equal(chamar({ site: obra({ status: 'paused' }) }), null)
})

test('RDO de OUTRA obra não fecha o dia desta', () => {
  const deOutra = { ...rdo('2026-08-20'), siteId: 'obra-2' } as RDO
  const l = chamar({ rdos: [deOutra] })
  assert.ok(l, 'a lacuna desta obra continua aberta')
  assert.equal(l.maisAntigo <= '2026-08-20', true)
  assert.equal(l.diasEmAberto > 0, true)
})

test('o teto de varredura é sinalizado em vez de mentir', () => {
  const l = chamar({ site: obra({ startDate: '2020-01-01' }), maxDias: 10 })
  assert.equal(l?.truncado, true)
  assert.equal(l?.diasEmAberto, 8, 'oito dias úteis dentro dos dez de calendário varridos')
})
