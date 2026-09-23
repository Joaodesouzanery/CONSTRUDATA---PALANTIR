import { z } from 'zod'

const DATE_REGEX = /^$|^\d{4}-\d{2}-\d{2}$/
const CEP_REGEX  = /^$|^\d{5}-?\d{3}$/

export const siteSchema = z.object({
  code:        z.string().max(20).optional(),
  name:        z.string().min(2, 'Nome obrigatório').max(100),
  company:     z.string().max(100).optional(),
  owner:       z.string().max(100).optional(),
  manager:     z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  status:      z.enum(['active', 'planning', 'paused', 'completed'] as const),
  projectId:   z.string().optional(),   // vínculo opcional a um Project (bridge EVM/Change Orders)
  street:      z.string().max(200).optional(),
  number:      z.string().max(20).optional(),
  district:    z.string().max(100).optional(),
  city:        z.string().max(100).optional(),
  state:       z.string().max(2, 'Use a sigla do estado (ex: SP)').optional(),
  cep:         z.string().regex(CEP_REGEX, 'CEP inválido (ex: 01310-200)'),
  buildingType: z.string().max(80).optional(),
  totalArea:   z.number().min(0, 'Area nao pode ser negativa'),
  // Contrato da obra. `numeroContrato` e `orcamentoBRL` já existiam no tipo e já eram LIDOS pelo
  // RDO — só nunca houve tela que os gravasse. `precoM2` é novo e passa a ser a fonte da verdade
  // do preço, que até aqui só existia no Plano de Execução.
  numeroContrato: z.string().max(60).optional(),
  orcamentoBRL: z.number().min(0, 'Orçamento não pode ser negativo').optional(),
  precoM2:     z.number().min(0, 'Preço não pode ser negativo').optional(),
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
  /**
   * Raio da cerca do ponto eletrônico, em metros.
   *
   * ⚠️ **Piso de 50 m, e não é capricho.** `avaliarCerca` devolve `precisao-insuficiente` quando a
   * precisão informada pelo aparelho é maior que o raio — e um GPS de celular erra de 10 a 50 m em
   * condição normal. Com raio de 20 m, TODA batida cairia na justificativa obrigatória, todo dia,
   * e em uma semana o campo estaria preenchido com "aaaaa".
   *
   * ⚠️ Teto de 50 km: acima disso não é cerca, é a cidade inteira — e uma cerca que nunca recusa
   * nada dá a impressão de estar conferindo algo.
   */
  raioPontoM: z.string().optional().refine(
    (v) => !v || (!isNaN(Number(v)) && Number(v) >= 50 && Number(v) <= 50_000),
    'Raio inválido (entre 50 m e 50.000 m)'
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



