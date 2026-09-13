import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { ConstructionSite } from '@/types'
import { buildObraDetailHtml, montarObraDetailJson } from './obraDetailExport'

const site = (p: Partial<ConstructionSite> = {}): ConstructionSite => ({
  id: 'o1', name: 'SQS 314', code: 'SQS-314', status: 'em_andamento',
  street: 'Rua X', number: '100', district: 'Bairro', city: 'Brasília', state: 'DF', cep: '70000-000',
  company: 'ConstruData', owner: 'Fulano', manager: 'Ciclano',
  risks: [],
  ...p,
} as unknown as ConstructionSite)

const ctx = { hoje: '2026-09-13' }

describe('montarObraDetailJson', () => {
  it('obra sem contrato: orcamentoBac é null, não zero', () => {
    const j = montarObraDetailJson(site(), ctx)
    assert.equal(j.orcamentoBac, null)
  })

  it('obra com contrato de serviço: orcamentoBac reflete o valor cheio', () => {
    const j = montarObraDetailJson(site({ contrato: { services: [], valorServico: 195900.65, valorMaterial: 0 } as never }), ctx)
    assert.equal(j.orcamentoBac, 195900.65)
  })

  it('leva o id da obra e o recorte de endereço', () => {
    const j = montarObraDetailJson(site(), ctx)
    assert.equal(j.obra.id, 'o1')
    assert.equal(j.obra.endereco.cidade, 'Brasília')
  })
})

describe('buildObraDetailHtml', () => {
  it('nunca embute imagem de documento — só a lista de referência', () => {
    const s = site({
      contrato: {
        services: [],
        documentos: [{ id: 'd1', tipo: 'contrato', nome: 'Contrato assinado.pdf', storagePath: 'x/y', enviadoEm: '2026-09-01T00:00:00.000Z' }],
      } as never,
    })
    const html = buildObraDetailHtml(s, [], ctx)
    assert.ok(!html.includes('<img'), 'documento entrou como imagem embutida — reabre o teto de ~25MB medido em sessão anterior')
    assert.ok(html.includes('Contrato assinado.pdf'), 'o nome do documento precisa aparecer na lista de referência')
  })

  it('obra sem orçamento definido mostra o motivo, nunca zero', () => {
    const html = buildObraDetailHtml(site(), [], ctx)
    assert.match(html, /sem orçamento definido/)
  })
})
