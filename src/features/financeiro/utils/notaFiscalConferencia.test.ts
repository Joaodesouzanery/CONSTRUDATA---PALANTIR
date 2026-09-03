import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { NotaFiscal } from '@/types'
import {
  conferirLote, conferirNota, idDaNota, idDoLancamentoDaNota, lancamentoDaNota,
  notaDoRascunho, podeGravar, SITUACOES_QUE_GRAVAM_NOTA, type RascunhoDeNota,
} from './notaFiscalConferencia'

const CHAVE = '53260855737356000102650020000021871005967012'
const ORG = 'org-1'
const AGORA = '2026-09-03T12:00:00.000Z'

const rascunho = (p: Partial<RascunhoDeNota> = {}): RascunhoDeNota => ({
  chave: CHAVE, valor: 35, categoria: 'administrativo', ...p,
})

const existente = (p: Partial<NotaFiscal> = {}): NotaFiscal => ({
  ...notaDoRascunho(conferirNota(rascunho(), { orgId: ORG, existentes: [] }), AGORA),
  ...p,
})

describe('conferirNota — o caminho normal', () => {
  it('primeira importação é nova, com id determinístico pela chave', () => {
    const c = conferirNota(rascunho(), { orgId: ORG, existentes: [] })
    assert.equal(c.situacao, 'nova')
    assert.equal(c.id, idDaNota(ORG, CHAVE))
    assert.deepEqual(c.impedimentos, [])
    assert.equal(podeGravar(c), true)
    assert.equal(c.dados?.cnpj, '55737356000102')
  })

  /**
   * ⚠️ O teste que separa este motor de um que duplica: a MESMA foto de novo não
   * grava nada. É o espelho do passo do `controleDeCaixaImport`.
   */
  it('a mesma foto importada de novo não grava nada', () => {
    const c = conferirNota(rascunho(), { orgId: ORG, existentes: [existente()] })
    assert.equal(c.situacao, 'ja-arquivada')
    assert.equal(podeGravar(c), false)
    assert.ok(!SITUACOES_QUE_GRAVAM_NOTA.includes(c.situacao))
  })

  it('valor corrigido vira valor-alterado, com o antes e o depois', () => {
    const c = conferirNota(rascunho({ valor: 47.9 }), { orgId: ORG, existentes: [existente()] })
    assert.equal(c.situacao, 'valor-alterado')
    assert.deepEqual(c.mudancas, [{ campo: 'valor', rotulo: 'Valor', antes: 35, depois: 47.9 }])
    assert.equal(podeGravar(c), true)
  })

  it('categoria corrigida também aparece no diff', () => {
    const c = conferirNota(rascunho({ categoria: 'materiais' }), { orgId: ORG, existentes: [existente()] })
    assert.equal(c.mudancas.length, 1)
    assert.equal(c.mudancas[0].campo, 'categoria')
  })

  /**
   * ⚠️ Nota já lançada virou número na DRE. Reimportar a foto não pode mexer nele
   * por baixo — corrigir é ato deliberado, na tela, não efeito colateral.
   */
  it('nota já lançada nunca é regravada pela reimportação', () => {
    const ja = existente({ status: 'lancada', entryId: 'e-1' })
    const c = conferirNota(rascunho({ valor: 999 }), { orgId: ORG, existentes: [ja] })
    assert.equal(c.situacao, 'ja-lancada')
    assert.deepEqual(c.mudancas, [])
    assert.equal(podeGravar(c), false)
  })
})

describe('conferirNota — o que impede gravar', () => {
  it('chave com DV errado não produz id nenhum', () => {
    const errada = CHAVE.slice(0, 43) + '9'
    const c = conferirNota(rascunho({ chave: errada }), { orgId: ORG, existentes: [] })
    assert.equal(c.id, '', 'chave inválida não pode gerar identidade')
    assert.equal(c.impedimentos.length, 1)
    assert.match(c.impedimentos[0], /dígito verificador/)
    assert.equal(podeGravar(c), false)
  })

  it('sem valor, não grava', () => {
    const c = conferirNota(rascunho({ valor: null }), { orgId: ORG, existentes: [] })
    assert.match(c.impedimentos.join(' '), /Sem valor/)
    assert.equal(podeGravar(c), false)
  })

  it('valor zero ou negativo não grava', () => {
    for (const v of [0, -10]) {
      const c = conferirNota(rascunho({ valor: v }), { orgId: ORG, existentes: [] })
      assert.equal(podeGravar(c), false, `valor ${v} passou`)
    }
  })

  it('valor absurdo é recusado — é OCR fundindo números', () => {
    const c = conferirNota(rascunho({ valor: 4_790_000 }), { orgId: ORG, existentes: [] })
    assert.match(c.impedimentos.join(' '), /dois números/)
  })

  it('sem categoria, não grava — é ela que leva o gasto para a DRE', () => {
    const c = conferirNota(rascunho({ categoria: undefined }), { orgId: ORG, existentes: [] })
    assert.match(c.impedimentos.join(' '), /categoria/)
  })
})

describe('conferirNota — isolamento entre empresas', () => {
  it('a mesma chave em duas organizações dá ids diferentes', () => {
    assert.notEqual(idDaNota('org-a', CHAVE), idDaNota('org-b', CHAVE))
  })

  it('nota de outra org não bloqueia a importação nesta', () => {
    const deOutra: NotaFiscal = { ...existente(), id: idDaNota('org-b', CHAVE) }
    // Casa por chave também, de propósito: dentro da MESMA lista de existentes
    // (que já vem recortada por org pelo store) a chave é suficiente.
    const c = conferirNota(rascunho(), { orgId: ORG, existentes: [] })
    assert.equal(c.situacao, 'nova')
    assert.notEqual(c.id, deOutra.id)
  })
})

describe('conferirLote', () => {
  it('a segunda foto da mesma nota no envio é marcada como repetida', () => {
    const { notas, resumo } = conferirLote([rascunho(), rascunho()], { orgId: ORG, existentes: [] })
    assert.equal(notas[0].situacao, 'nova')
    assert.equal(notas[1].situacao, 'duplicada-no-lote')
    assert.equal(resumo['nova'], 1)
    assert.equal(resumo['duplicada-no-lote'], 1)
  })

  it('chave inválida no meio do lote não derruba as outras', () => {
    const { notas } = conferirLote(
      [rascunho({ chave: '123' }), rascunho()],
      { orgId: ORG, existentes: [] },
    )
    assert.equal(podeGravar(notas[0]), false)
    assert.equal(podeGravar(notas[1]), true)
  })
})

describe('notaDoRascunho', () => {
  it('copia os campos derivados da chave, sem reparsear depois', () => {
    const n = notaDoRascunho(conferirNota(rascunho(), { orgId: ORG, existentes: [] }), AGORA)
    assert.equal(n.cnpjEmitente, '55737356000102')
    assert.equal(n.modelo, '65')
    assert.equal(n.numero, '2187')
    assert.equal(n.serie, '2')
    assert.equal(n.uf, 'DF')
    assert.equal(n.competencia, '2026-08')
    assert.equal(n.status, 'arquivada')
  })

  it('marca a categoria como confirmada por gente — é o que alimenta a sugestão', () => {
    const n = notaDoRascunho(conferirNota(rascunho(), { orgId: ORG, existentes: [] }), AGORA)
    assert.equal(n.categoriaConfirmadaEm, AGORA)
  })

  it('preserva o createdAt e o lançamento da nota que já existia', () => {
    const antiga = existente({ createdAt: '2026-08-01T00:00:00.000Z', entryId: 'e-9' })
    const c = conferirNota(rascunho({ valor: 40 }), { orgId: ORG, existentes: [antiga] })
    const n = notaDoRascunho(c, AGORA)
    assert.equal(n.createdAt, '2026-08-01T00:00:00.000Z')
    assert.equal(n.entryId, 'e-9')
  })

  it('recusa virar registro sem chave válida', () => {
    const c = conferirNota(rascunho({ chave: 'xx' }), { orgId: ORG, existentes: [] })
    assert.throws(() => notaDoRascunho(c, AGORA), /chave válida/)
  })
})

describe('lancamentoDaNota', () => {
  it('gera saída com id determinístico — dois cliques, um lançamento', () => {
    const n = notaDoRascunho(conferirNota(rascunho({ emitente: 'Hora Extra' }), { orgId: ORG, existentes: [] }), AGORA)
    const a = lancamentoDaNota(n, ORG, '2026-09-03')
    const b = lancamentoDaNota(n, ORG, '2026-09-03')
    assert.equal(a.id, b.id)
    assert.equal(a.id, idDoLancamentoDaNota(ORG, n.id))
    assert.equal(a.tipo, 'saida')
    assert.equal(a.valor, 35)
    assert.equal(a.categoria, 'administrativo')
    assert.equal(a.referencia, CHAVE)
    assert.match(a.descricao, /Hora Extra/)
  })

  it('usa a data de emissão quando existe, e a data do dia quando não', () => {
    const base = conferirNota(rascunho({ dataEmissao: '2026-08-31' }), { orgId: ORG, existentes: [] })
    assert.equal(lancamentoDaNota(notaDoRascunho(base, AGORA), ORG, '2026-09-03').data, '2026-08-31')
    const sem = conferirNota(rascunho(), { orgId: ORG, existentes: [] })
    assert.equal(lancamentoDaNota(notaDoRascunho(sem, AGORA), ORG, '2026-09-03').data, '2026-09-03')
  })
})
