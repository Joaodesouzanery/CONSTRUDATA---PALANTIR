import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { NotaFiscal, SaidaCategoria } from '@/types'
import {
  etiquetasUsadas, normalizarEtiqueta, sugerirClassificacao,
} from './categoriaAprendida'

const CNPJ = '55737356000102'
const OUTRO = '11222333000181'

let n = 0
function nota(p: {
  cnpj?: string
  categoria?: SaidaCategoria
  etiqueta?: string
  confirmadaEm?: string | null
  status?: NotaFiscal['status']
} = {}): NotaFiscal {
  n++
  return {
    id: `n-${n}`,
    chaveAcesso: String(n).padStart(44, '0'),
    cnpjEmitente: p.cnpj ?? CNPJ,
    modelo: '65', numero: String(n), serie: '1', uf: 'DF', competencia: '2026-08',
    valor: 35, valorOrigem: 'manual',
    categoria: p.categoria ?? 'administrativo',
    etiqueta: p.etiqueta,
    categoriaConfirmadaEm: p.confirmadaEm === null ? undefined : (p.confirmadaEm ?? `2026-08-${String(n).padStart(2, '0')}T00:00:00.000Z`),
    status: p.status ?? 'arquivada',
    createdAt: '2026-08-01T00:00:00.000Z',
  }
}

describe('sugerirClassificacao', () => {
  it('sem histórico, não sugere nada', () => {
    assert.equal(sugerirClassificacao(CNPJ, []), null)
  })

  it('com uma nota só, sugere e a frase diz que é uma só', () => {
    const s = sugerirClassificacao(CNPJ, [nota({ categoria: 'materiais' })])
    assert.equal(s?.categoria, 'materiais')
    assert.equal(s?.baseadoEm, 1)
    assert.match(s!.motivo, /a nota anterior/)
  })

  it('a maioria vence, e a frase mostra a força', () => {
    const h = [
      nota({ categoria: 'materiais' }), nota({ categoria: 'materiais' }),
      nota({ categoria: 'materiais' }), nota({ categoria: 'materiais' }),
      nota({ categoria: 'outro' }),
    ]
    const s = sugerirClassificacao(CNPJ, h)
    assert.equal(s?.categoria, 'materiais')
    assert.equal(s?.concordam, 4)
    assert.equal(s?.baseadoEm, 5)
    assert.match(s!.motivo, /4 de 5/)
  })

  it('no empate, vence a mais recente', () => {
    const h = [
      nota({ categoria: 'materiais', confirmadaEm: '2026-08-01T00:00:00.000Z' }),
      nota({ categoria: 'materiais', confirmadaEm: '2026-08-02T00:00:00.000Z' }),
      nota({ categoria: 'equipamentos', confirmadaEm: '2026-08-03T00:00:00.000Z' }),
      nota({ categoria: 'equipamentos', confirmadaEm: '2026-08-04T00:00:00.000Z' }),
    ]
    assert.equal(sugerirClassificacao(CNPJ, h)?.categoria, 'equipamentos')
  })

  it('nota de outro CNPJ não entra na conta', () => {
    const h = [nota({ categoria: 'materiais' }), nota({ cnpj: OUTRO, categoria: 'equipamentos' })]
    const s = sugerirClassificacao(CNPJ, h)
    assert.equal(s?.baseadoEm, 1)
    assert.equal(s?.categoria, 'materiais')
  })

  it('aceita o CNPJ escrito com pontuação', () => {
    const s = sugerirClassificacao('55.737.356/0001-02', [nota({ categoria: 'materiais' })])
    assert.equal(s?.categoria, 'materiais')
  })

  /**
   * ⚠️ A regra mais importante do arquivo: sugestão aceita por inércia não pode
   * virar evidência de si mesma, senão um erro calcifica para sempre.
   */
  it('só nota com categoria confirmada por gente vota', () => {
    const h = [
      ...Array.from({ length: 10 }, () => nota({ categoria: 'outro', confirmadaEm: null })),
      nota({ categoria: 'equipamentos' }),
    ]
    const s = sugerirClassificacao(CNPJ, h)
    assert.equal(s?.categoria, 'equipamentos')
    assert.equal(s?.baseadoEm, 1)
  })

  it('nota cancelada não vota', () => {
    const h = [
      nota({ categoria: 'outro', status: 'cancelada' }),
      nota({ categoria: 'outro', status: 'cancelada' }),
      nota({ categoria: 'materiais' }),
    ]
    assert.equal(sugerirClassificacao(CNPJ, h)?.categoria, 'materiais')
  })

  it('a janela deixa uma mudança de hábito vencer o histórico antigo', () => {
    const antigas = Array.from({ length: 25 }, (_, i) =>
      nota({ categoria: 'outro', confirmadaEm: `2025-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z` }))
    const recentes = Array.from({ length: 20 }, (_, i) =>
      nota({ categoria: 'equipamentos', confirmadaEm: `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` }))
    const s = sugerirClassificacao(CNPJ, [...antigas, ...recentes])
    assert.equal(s?.categoria, 'equipamentos')
    assert.equal(s?.baseadoEm, 20)
  })

  /**
   * ⚠️ Etiqueta e categoria são contadas SEPARADAMENTE. O posto de combustível é
   * `equipamentos` para o caminhão e `administrativo` para o carro do gerente — e
   * a etiqueta "combustível" continua certa nos dois casos.
   */
  it('a etiqueta sobrevive mesmo quando a categoria está dividida', () => {
    const h = [
      nota({ categoria: 'equipamentos', etiqueta: 'combustivel', confirmadaEm: '2026-08-01T00:00:00.000Z' }),
      nota({ categoria: 'equipamentos', etiqueta: 'combustivel', confirmadaEm: '2026-08-02T00:00:00.000Z' }),
      nota({ categoria: 'administrativo', etiqueta: 'combustivel', confirmadaEm: '2026-08-03T00:00:00.000Z' }),
      nota({ categoria: 'administrativo', etiqueta: 'combustivel', confirmadaEm: '2026-08-04T00:00:00.000Z' }),
    ]
    const s = sugerirClassificacao(CNPJ, h)
    assert.equal(s?.etiqueta, 'combustivel')
    assert.equal(s?.concordam, 2, 'a categoria está mesmo dividida')
  })

  it('sem etiqueta nenhuma, não inventa uma', () => {
    assert.equal(sugerirClassificacao(CNPJ, [nota()])?.etiqueta, undefined)
  })

  it('CNPJ vazio não sugere', () => {
    assert.equal(sugerirClassificacao('', [nota()]), null)
  })
})

describe('etiquetasUsadas', () => {
  it('devolve as mais frequentes primeiro', () => {
    const h = [
      nota({ etiqueta: 'combustivel' }), nota({ etiqueta: 'combustivel' }),
      nota({ etiqueta: 'alimentacao' }), nota({ etiqueta: 'epi' }), nota({ etiqueta: 'epi' }),
      nota({ etiqueta: 'epi' }),
    ]
    assert.deepEqual(etiquetasUsadas(h), ['epi', 'combustivel', 'alimentacao'])
  })

  it('ignora vazias e espaços', () => {
    assert.deepEqual(etiquetasUsadas([nota({ etiqueta: '  ' }), nota()]), [])
  })
})

describe('normalizarEtiqueta', () => {
  it('junta as três formas de escrever a mesma coisa', () => {
    const alvo = normalizarEtiqueta('combustivel')
    assert.equal(normalizarEtiqueta('Combustível'), alvo)
    assert.equal(normalizarEtiqueta('COMBUSTÍVEL'), alvo)
    assert.equal(normalizarEtiqueta('  Combustivel  '), alvo)
  })

  it('colapsa espaços do meio', () => {
    assert.equal(normalizarEtiqueta('material   de  limpeza'), 'material de limpeza')
  })

  it('não junta palavras diferentes', () => {
    assert.notEqual(normalizarEtiqueta('epi'), normalizarEtiqueta('epc'))
  })
})
