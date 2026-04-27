import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const CEP_REGEX  = /^$|^\d{5}-?\d{3}$/

export const siteSchema = z.object({
  code:        z.string().max(20).optional(),
  name:        z.string().min(2, 'Nome obrigatório').max(100),
  company:     z.string().max(100).optional(),
  owner:       z.string().max(100).optional(),
  manager:     z.string().min(1, 'Gerente obrigatório').max(100),
  description: z.string().max(1000).optional(),
  status:      z.enum(['active', 'planning', 'paused', 'completed'] as const),
  street:      z.string().max(200).optional(),
  number:      z.string().max(20).optional(),
  district:    z.string().max(100).optional(),
  city:        z.string().min(1, 'Cidade obrigatória').max(100),
  state:       z.string().length(2, 'Use a sigla do estado (ex: SP)'),
  cep:         z.string().regex(CEP_REGEX, 'CEP inválido (ex: 01310-200)'),
  buildingType: z.string().min(1, 'Tipo/escopo obrigatório').max(80),
  totalArea:   z.number().min(0, 'Área não pode ser negativa'),
  floors:      z.number().int().min(0, 'Informe zero ou mais frentes/pavimentos'),
  startDate:   z.string().regex(DATE_REGEX, 'Data inválida (yyyy-mm-dd)'),
  expectedEnd: z.string().regex(DATE_REGEX, 'Data inválida (yyyy-mm-dd)'),
  lat: z.string().optional().refine(
    (v) => !v || (!isNaN(Number(v)) && Number(v) >= -90  && Number(v) <= 90),
    'Latitude inválida (entre -90 e 90)'
  ),
  lng: z.string().optional().refine(
    (v) => !v || (!isNaN(Number(v)) && Number(v) >= -180 && Number(v) <= 180),
    'Longitude inválida (entre -180 e 180)'
  ),
})

export type SiteFormValues = z.infer<typeof siteSchema>

export const riskSchema = z.object({
  title:       z.string().min(2, 'Título deve ter ao menos 2 caracteres').max(100),
  description: z.string().min(1, 'Descrição obrigatória').max(500),
  level:       z.enum(['critical', 'high', 'medium', 'low'] as const),
  status:      z.enum(['identified', 'active', 'mitigated', 'resolved'] as const),
  notes:       z.string().max(500).optional(),
})

export type RiskFormValues = z.infer<typeof riskSchema>
