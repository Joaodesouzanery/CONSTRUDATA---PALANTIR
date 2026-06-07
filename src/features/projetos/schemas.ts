import { z } from 'zod'
import { parseISO } from 'date-fns'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// Todos os campos do projeto são opcionais — é possível criar um projeto em branco
// e preencher depois. Defaults mantêm os tipos de saída como string/enum (não
// undefined), preservando compatibilidade com o formulário. A única validação
// remanescente é coerência de datas, aplicada apenas quando ambas estão presentes.
export const projectInfoSchema = z
  .object({
    code:           z.string().max(20).default(''),
    name:           z.string().max(100).default(''),
    owner:          z.string().max(100).default(''),
    manager:        z.string().max(100).default(''),
    description:    z.string().max(500).optional(),
    status:         z.enum(['active', 'planning', 'completed', 'on_hold'] as const).default('planning'),
    startDate:      z.string().default(''),
    endDate:        z.string().default(''),
    contractNumber: z.string().max(50).optional(),
    clientName:     z.string().max(100).optional(),
    projectManager: z.string().max(100).optional(),
    riskLevel:      z.enum(['low', 'medium', 'high', 'critical'] as const).optional(),
    priority:       z.enum(['low', 'medium', 'high'] as const).optional(),
    address:        z.string().max(200).optional(),
    lat:            z.number().optional(),
    lng:            z.number().optional(),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: 'Data de término deve ser após data de início',
    path: ['endDate'],
  })

export type ProjectInfoFormValues = z.infer<typeof projectInfoSchema>
export type ProjectInfoFormInput = z.input<typeof projectInfoSchema>

export const phaseSchema = z
  .object({
    status:    z.enum(['not_started', 'in_progress', 'completed', 'delayed'] as const),
    progress:  z.number().int().min(0, 'Mínimo 0').max(100, 'Máximo 100'),
    startDate: z.string().regex(DATE_REGEX, 'Data inválida (yyyy-mm-dd)'),
    endDate:   z.string().regex(DATE_REGEX, 'Data inválida (yyyy-mm-dd)'),
    notes:     z.string().max(500).optional(),
  })
  .refine(
    (d) => {
      try { return parseISO(d.endDate) >= parseISO(d.startDate) }
      catch { return true }
    },
    { message: 'Data de término deve ser após data de início', path: ['endDate'] }
  )

export type PhaseFormValues = z.infer<typeof phaseSchema>

export const budgetLineSchema = z.object({
  type:        z.enum(['labor', 'equipment', 'materials', 'subcontract', 'overhead', 'other'] as const),
  description: z.string().min(1, 'Descrição obrigatória').max(100),
  budgeted:    z.number().min(0, 'Deve ser positivo'),
  projected:   z.number().min(0, 'Deve ser positivo'),
  spent:       z.number().min(0, 'Deve ser positivo'),
})

export type BudgetLineFormValues = z.infer<typeof budgetLineSchema>
