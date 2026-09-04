import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { ConstructionSite } from '@/types'
import { obraBacFromSite, vigenciaDaObra } from './obraBudget'

const obra = (p: Partial<ConstructionSite> = {}): ConstructionSite => ({
  id: 'o1', name: 'SQS 314', status: 'em_andamento',
  startDate: '2026-07-01', expectedEnd: '2026-12-31',
  ...p,
} as ConstructionSite)

describe('vigenciaDaObra', () => {
  it('o contrato manda quando tem as duas datas', () => {
    const v = vigenciaDaObra(obra({
      contrato: { services: [], vigenciaInicio: '2026-08-01', vigenciaFim: '2026-10-31' } as never,
    }))
    assert.deepEqual(v, { de: '2026-08-01', ate: '2026-10-31', origem: 'contrato' })
  })

  /**
   * ⚠️ O recurso é declarado, não silencioso: a data da obra é quando o canteiro abre e fecha,
   * que nem sempre é a vigência do contrato. Por isso a `origem` viaja junto — a tela mostra
   * "Período da obra" em vez de "Contrato", e ninguém confunde exato com aproximado.
   */
  it('sem vigência no contrato, cai para as datas da obra — dizendo que caiu', () => {
    const v = vigenciaDaObra(obra())
    assert.deepEqual(v, { de: '2026-07-01', ate: '2026-12-31', origem: 'obra' })
  })

  it('contrato com só uma das datas não vale — cai para a obra', () => {
    const v = vigenciaDaObra(obra({ contrato: { services: [], vigenciaInicio: '2026-08-01' } as never }))
    assert.equal(v?.origem, 'obra')
  })

  it('fim antes do início é recusado nos dois níveis', () => {
    const v = vigenciaDaObra(obra({
      startDate: '2026-12-31', expectedEnd: '2026-01-01',
      contrato: { services: [], vigenciaInicio: '2026-10-01', vigenciaFim: '2026-08-01' } as never,
    }))
    assert.equal(v, null)
  })

  it('data em formato errado não passa', () => {
    const v = vigenciaDaObra(obra({
      startDate: '01/07/2026', expectedEnd: '31/12/2026',
      contrato: { services: [], vigenciaInicio: 'julho', vigenciaFim: 'dezembro' } as never,
    }))
    assert.equal(v, null)
  })

  it('obra sem data nenhuma devolve null em vez de inventar janela', () => {
    assert.equal(vigenciaDaObra(obra({ startDate: '', expectedEnd: '' })), null)
    assert.equal(vigenciaDaObra(null), null)
    assert.equal(vigenciaDaObra(undefined), null)
  })

  it('um dia só é vigência válida', () => {
    const v = vigenciaDaObra(obra({
      contrato: { services: [], vigenciaInicio: '2026-08-05', vigenciaFim: '2026-08-05' } as never,
    }))
    assert.equal(v?.origem, 'contrato')
  })
})

describe('obraBacFromSite — a fonte única do orçamento', () => {
  /**
   * ⚠️ O defeito que o "Por Obra" tinha: somar as `budgetLines` cruas conta em DOBRO, porque
   * `withTotalBudgetLine` grava a linha 'Total' JUNTO com as categorias.
   */
  it('com linha Total presente, usa ela — não soma tudo de novo', () => {
    const bac = obraBacFromSite(obra({
      budgetLines: [
        { label: 'Total', amount: 100000, projected: 100000 },
        { label: 'Materiais', amount: 60000, projected: 60000 },
        { label: 'Mão de obra', amount: 40000, projected: 40000 },
      ],
    }))
    assert.equal(bac, 100000, 'somar tudo daria 200.000 — o dobro')
  })

  it('o contrato vence as linhas de orçamento', () => {
    const bac = obraBacFromSite(obra({
      contrato: { services: [], valorServico: 195900.65, valorMaterial: 0 } as never,
      budgetLines: [{ label: 'Total', amount: 12000, projected: 12000 }],
    }))
    assert.equal(bac, 195900.65)
  })

  it('sem contrato e sem linha Total, soma as categorias', () => {
    const bac = obraBacFromSite(obra({
      budgetLines: [
        { label: 'Materiais', amount: 60000, projected: 0 },
        { label: 'Mão de obra', amount: 40000, projected: 0 },
      ],
    }))
    assert.equal(bac, 100000)
  })

  it('"Total de materiais" NÃO é a linha Total', () => {
    const bac = obraBacFromSite(obra({
      budgetLines: [
        { label: 'Total de materiais', amount: 60000, projected: 0 },
        { label: 'Mão de obra', amount: 40000, projected: 0 },
      ],
    }))
    assert.equal(bac, 100000, 'senão o BAC da obra viraria o valor do material')
  })
})
