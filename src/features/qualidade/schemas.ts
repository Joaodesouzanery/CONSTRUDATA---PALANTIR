/**
 * schemas.ts — Zod validation schemas for the Qualidade / FVS module.
 */
import { z } from 'zod'

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (yyyy-MM-dd)')
const optionalDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').nullable().or(z.literal(''))

export const fvsItemSchema = z.object({
  number:      z.number().int().min(1).max(99),
  group:       z.enum(['verificacao_solda', 'controle_parametros']),
  description: z.string().min(1, 'Descrição obrigatória').max(200),
  criteria:    z.string().max(500),
  conformity:  z.enum(['conforme', 'nao_conforme', 'reinspecao_ok']).nullable(),
  date:        optionalDateString,
})

export const fvsProblemSchema = z.object({
  itemNumber:  z.number().int().min(1).max(99),
  description: z.string().min(1, 'Descrição obrigatória').max(500),
  action:      z.string().min(1, 'Ação obrigatória').max(500),
})

export const fvsSchema = z.object({
  identificationNo:  z.string().min(1, 'Nº Identificação FVS obrigatório').max(50),
  contractNo:        z.string().min(1, 'Contrato obrigatório').max(50),
  date:              dateString,
  ncRequired:        z.boolean(),
  ncNumber:          z.string().max(50),
  responsibleLeader: z.string().min(1, 'Líder Responsável obrigatório').max(100),
  weldTrackingNo:    z.string().max(100),
  welderSignature:   z.string().max(100),
  qualitySignature:  z.string().max(100),
})

export type FvsFormData     = z.infer<typeof fvsSchema>
export type FvsItemData     = z.infer<typeof fvsItemSchema>
export type FvsProblemData  = z.infer<typeof fvsProblemSchema>

// ─── Default template (9 itens fixos do formulário FOR-FVS-02) ────────────────

export const FVS_ITEMS_TEMPLATE: Array<{
  number: number
  group: 'verificacao_solda' | 'controle_parametros'
  description: string
}> = [
  { number: 1, group: 'verificacao_solda',   description: 'Condições do Local'        },
  { number: 2, group: 'verificacao_solda',   description: 'Inspeção dos Tubos'        },
  { number: 3, group: 'verificacao_solda',   description: 'Cód. Rastreio dos Tubos'   },
  { number: 4, group: 'verificacao_solda',   description: 'Alinhamento da Máquina'    },
  { number: 5, group: 'controle_parametros', description: 'Temperatura da Placa'      },
  { number: 6, group: 'controle_parametros', description: 'Tempo de Aquecimento'      },
  { number: 7, group: 'controle_parametros', description: 'Pressão de Fusão'          },
  { number: 8, group: 'controle_parametros', description: 'Tempo de Resfriamento'     },
  { number: 9, group: 'controle_parametros', description: 'Inspeção Visual da Solda'  },
]
