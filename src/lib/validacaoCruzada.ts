/**
 * validacaoCruzada.ts — Cross-validation between Medição data and RDO execution data.
 * Generates glose alerts when quantities or values diverge.
 */
import type { GloseAlert } from '@/types'
import { fuzzyMatch } from './engineeringOntology'

interface MedicaoItemInput {
  item: string
  descricao: string
  unidade: string
  qtdMedida: number
  precoUnitario: number
  valorMedido: number
}

interface RdoServiceInput {
  description: string
  quantity: number
  unit?: string
}

export function cruzarMedicaoComRdo(
  medicaoItems: MedicaoItemInput[],
  rdoServices: RdoServiceInput[],
  tolerancePct = 5,
): GloseAlert[] {
  const alerts: GloseAlert[] = []
  const rdoDescriptions = rdoServices.map((s) => s.description)
  const matchedRdoIndices = new Set<number>()
  const now = new Date().toISOString()

  for (const mi of medicaoItems) {
    const match = fuzzyMatch(mi.descricao, rdoDescriptions, 0.4)

    if (!match) {
      // Item in medição but not found in RDO
      alerts.push({
        id: crypto.randomUUID(),
        tipo: 'item_ausente',
        descricao: `Item "${mi.descricao}" presente na medição mas não encontrado no RDO`,
        itemMedicao: mi.descricao,
        valorMedicao: mi.qtdMedida,
        valorRdo: 0,
        diferenca: mi.qtdMedida,
        diferencaPct: 100,
        severidade: 'aviso',
        criadoEm: now,
      })
      continue
    }

    matchedRdoIndices.add(match.index)
    const rdoSvc = rdoServices[match.index]
    const diff = mi.qtdMedida - rdoSvc.quantity
    const diffPct =
      rdoSvc.quantity !== 0
        ? Math.abs(diff / rdoSvc.quantity) * 100
        : mi.qtdMedida > 0
          ? 100
          : 0

    if (diffPct > tolerancePct) {
      alerts.push({
        id: crypto.randomUUID(),
        tipo: 'quantidade',
        descricao: `Divergência de ${diffPct.toFixed(1)}% na quantidade: Medição=${mi.qtdMedida}, RDO=${rdoSvc.quantity}`,
        itemMedicao: mi.descricao,
        itemRdo: rdoSvc.description,
        valorMedicao: mi.qtdMedida,
        valorRdo: rdoSvc.quantity,
        diferenca: diff,
        diferencaPct: diffPct,
        severidade: diffPct > 20 ? 'critico' : 'aviso',
        criadoEm: now,
      })
    }
  }

  // RDO items not matched to any medição item
  for (let i = 0; i < rdoServices.length; i++) {
    if (!matchedRdoIndices.has(i)) {
      alerts.push({
        id: crypto.randomUUID(),
        tipo: 'item_ausente',
        descricao: `Item "${rdoServices[i].description}" no RDO mas não encontrado na medição`,
        itemMedicao: '',
        itemRdo: rdoServices[i].description,
        valorMedicao: 0,
        valorRdo: rdoServices[i].quantity,
        diferenca: -rdoServices[i].quantity,
        diferencaPct: 100,
        severidade: 'info',
        criadoEm: now,
      })
    }
  }

  return alerts.sort((a, b) => {
    const sev: Record<string, number> = { critico: 0, aviso: 1, info: 2 }
    return (sev[a.severidade] ?? 2) - (sev[b.severidade] ?? 2)
  })
}
