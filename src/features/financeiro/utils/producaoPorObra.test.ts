import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { ConstructionSite, ObraContratoServico, RDO } from '@/types'
import { producaoDaObra } from './producaoPorObra'

const servico = (p: Partial<ObraContratoServico>): ObraContratoServico => ({
  id: 'svc-1', descricao: 'Rede de água', unidade: 'm', qtdContrato: 1000, valorUnitario: 50, ...p,
})

const obra = (p: Partial<ConstructionSite> = {}): ConstructionSite => ({
  id: 'o1', name: 'SQS 314', status: 'em_andamento', ...p,
} as ConstructionSite)

describe('producaoDaObra', () => {
  it('sem obra, devolve null — não zero', () => {
    assert.equal(producaoDaObra(undefined, []).produzido, null)
  })

  it('obra sem contrato, devolve null — a Compizzo hoje é exatamente este caso', () => {
    assert.equal(producaoDaObra(obra(), []).produzido, null)
  })

  it('obra com contrato mas sem nenhum serviço cadastrado, devolve null', () => {
    const site = obra({ contrato: { services: [] } as never })
    assert.equal(producaoDaObra(site, []).produzido, null)
  })

  it('serviço com qtdMedidaOverride: produzido = override × preço', () => {
    const site = obra({
      contrato: { services: [servico({ qtdMedidaOverride: 200, valorUnitario: 50 })] } as never,
    })
    assert.equal(producaoDaObra(site, []).produzido, 10_000)
  })

  it('serviço genuinamente sem medição ainda é 0 de verdade, não null', () => {
    const site = obra({ contrato: { services: [servico({})] } as never })
    assert.equal(producaoDaObra(site, []).produzido, 0)
  })

  it('soma vários serviços do contrato', () => {
    const site = obra({
      contrato: {
        services: [
          servico({ id: 's1', qtdMedidaOverride: 100, valorUnitario: 30 }),
          servico({ id: 's2', qtdMedidaOverride: 50, valorUnitario: 20 }),
        ],
      } as never,
    })
    assert.equal(producaoDaObra(site, []).produzido, 100 * 30 + 50 * 20)
  })

  it('mede a partir dos RDOs Compizzo finalizados quando não há override', () => {
    const rdo: RDO = {
      id: 'rdo-1', siteId: 'o1', template: 'compizzo', status: 'finalizado',
      compizzo: { producao: [{ contractServiceId: 'svc-1', quantidade: 40 }] },
    } as never
    const site = obra({ contrato: { services: [servico({ valorUnitario: 25 })] } as never })
    assert.equal(producaoDaObra(site, [rdo]).produzido, 40 * 25)
  })
})
