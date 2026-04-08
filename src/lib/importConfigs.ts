/**
 * importConfigs.ts — Configurações declarativas de import por módulo.
 *
 * Cada export é um ImportConfig<T> que diz ao importEngine:
 *  - quais colunas esperar (com aliases em PT-BR)
 *  - quais tipos coergir
 *  - quais campos são obrigatórios
 *  - schema Zod final para validação
 *
 * Mantém TUDO sobre import num lugar só — fácil de auditar e estender.
 */
import { z } from 'zod'
import type { ImportConfig } from './importEngine'
import type { OrcamentoItem, PlanTrecho, ConstructionSite, Worker } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// 1) QUANTITATIVOS — orçamento.xlsx
// ─────────────────────────────────────────────────────────────────────────────

type OrcamentoImportRow = Omit<OrcamentoItem, 'id' | 'totalCost'>

const orcamentoSchema = z.object({
  code:        z.string().min(1, 'Código é obrigatório'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  unit:        z.string().min(1, 'Unidade é obrigatória'),
  quantity:    z.number().nonnegative('Quantidade não pode ser negativa'),
  unitCost:    z.number().nonnegative('Custo unitário não pode ser negativo'),
  bdi:         z.number().min(0).max(100, 'BDI deve estar entre 0 e 100'),
  category:    z.string().min(1, 'Categoria é obrigatória'),
  source:      z.enum(['sinapi', 'seinfra', 'custom', 'manual']),
  notes:       z.string().optional(),
})

export const ORCAMENTO_IMPORT_CONFIG: ImportConfig<OrcamentoImportRow> = {
  schema: orcamentoSchema,
  columns: [
    { key: 'code',        headerAliases: ['code', 'código', 'codigo', 'cod'],                              type: 'string', required: true },
    { key: 'description', headerAliases: ['description', 'descrição', 'descricao', 'item'],                type: 'string', required: true },
    { key: 'unit',        headerAliases: ['unit', 'unidade', 'un'],                                        type: 'string', required: true },
    { key: 'quantity',    headerAliases: ['quantity', 'quantidade', 'qtd', 'qtde'],                        type: 'number', required: true, defaultValue: 0 },
    { key: 'unitCost',    headerAliases: ['unit_cost', 'unit cost', 'custo unitário', 'custo unitario', 'preço unitário', 'preco unitario'], type: 'number', required: true, defaultValue: 0 },
    { key: 'bdi',         headerAliases: ['bdi', 'bdi (%)', 'bdi%'],                                       type: 'number', defaultValue: 25 },
    { key: 'category',    headerAliases: ['category', 'categoria'],                                        type: 'string', required: true },
    { key: 'source',      headerAliases: ['source', 'fonte', 'origem'],                                    type: 'string', defaultValue: 'sinapi', transform: (raw) => {
      const s = String(raw).toLowerCase().trim()
      if (['sinapi', 'seinfra', 'custom', 'manual'].includes(s)) return s as 'sinapi' | 'seinfra' | 'custom' | 'manual'
      return 'sinapi'
    }},
    { key: 'notes',       headerAliases: ['notes', 'observações', 'observacoes', 'obs'],                   type: 'string' },
  ],
  exampleHeaders: ['code', 'description', 'unit', 'quantity', 'unit_cost', 'bdi', 'category', 'source', 'notes'],
  exampleRow: {
    code: 'SINAPI-93358',
    description: 'Escavação mecanizada de vala (até 1.5m, solo de 1ª categoria)',
    unit: 'm³',
    quantity: 480,
    unit_cost: 23.15,
    bdi: 25,
    category: 'Escavação',
    source: 'sinapi',
    notes: 'Solo categoria 1',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) PLANEJAMENTO — trechos.xlsx (PlanTrecho — flat list)
// ─────────────────────────────────────────────────────────────────────────────

type TrechoImportRow = Omit<PlanTrecho, 'id'>

const trechoSchema = z.object({
  code:            z.string().min(1, 'Código é obrigatório'),
  description:     z.string().min(1, 'Descrição é obrigatória'),
  lengthM:         z.number().positive('Comprimento deve ser positivo'),
  depthM:          z.number().positive('Profundidade deve ser positiva'),
  diameterMm:      z.number().positive('Diâmetro deve ser positivo'),
  soilType:        z.enum(['normal', 'rocky', 'mixed']),
  requiresShoring: z.boolean(),
  unitCostBRL:     z.number().nonnegative().optional(),
  notes:           z.string().optional(),
})

export const TRECHO_IMPORT_CONFIG: ImportConfig<TrechoImportRow> = {
  schema: trechoSchema,
  columns: [
    { key: 'code',            headerAliases: ['code', 'código', 'codigo'],                                  type: 'string',  required: true },
    { key: 'description',     headerAliases: ['description', 'descrição', 'descricao'],                     type: 'string',  required: true },
    { key: 'lengthM',         headerAliases: ['lengthm', 'length', 'comprimento', 'comprimento (m)', 'm'],  type: 'number',  required: true, defaultValue: 1 },
    { key: 'depthM',          headerAliases: ['depthm', 'depth', 'profundidade', 'profundidade (m)'],      type: 'number',  required: true, defaultValue: 1.5 },
    { key: 'diameterMm',      headerAliases: ['diametermm', 'diameter', 'diâmetro', 'diametro', 'dn'],     type: 'number',  required: true, defaultValue: 200 },
    { key: 'soilType',        headerAliases: ['soiltype', 'soil', 'tipo solo', 'solo'],                    type: 'string',  defaultValue: 'normal', transform: (raw) => {
      const s = String(raw).toLowerCase().trim()
      if (['normal', 'rocky', 'mixed'].includes(s)) return s as 'normal' | 'rocky' | 'mixed'
      if (['rochoso', 'rocha'].includes(s)) return 'rocky'
      if (['misto', 'mista'].includes(s)) return 'mixed'
      return 'normal'
    }},
    { key: 'requiresShoring', headerAliases: ['requiresshoring', 'shoring', 'escoramento', 'requer escoramento'], type: 'boolean', defaultValue: false },
    { key: 'unitCostBRL',     headerAliases: ['unitcostbrl', 'unit_cost', 'custo unitário', 'r$'],          type: 'number' },
    { key: 'notes',           headerAliases: ['notes', 'observações', 'observacoes'],                      type: 'string' },
  ],
  exampleHeaders: ['code', 'description', 'lengthM', 'depthM', 'diameterMm', 'soilType', 'requiresShoring', 'unitCostBRL'],
  exampleRow: {
    code: 'T01',
    description: 'Rede de água — Av. Principal trecho 1',
    lengthM: 80,
    depthM: 1.5,
    diameterMm: 200,
    soilType: 'normal',
    requiresShoring: 'false',
    unitCostBRL: 145.50,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) TORRE DE CONTROLE — obras.csv
// ─────────────────────────────────────────────────────────────────────────────

type ObraImportRow = Omit<ConstructionSite, 'id' | 'risks' | 'budgetLines' | 'planningMilestones' | 'executionMilestones'>

const obraSchema = z.object({
  code:         z.string().min(1, 'Código é obrigatório'),
  name:         z.string().min(1, 'Nome é obrigatório'),
  company:      z.string().default(''),
  owner:        z.string().default(''),
  manager:      z.string().default(''),
  description:  z.string().default(''),
  status:       z.enum(['active', 'planning', 'paused', 'completed']).default('planning'),
  street:       z.string().default(''),
  number:       z.string().default(''),
  district:     z.string().default(''),
  city:         z.string().min(1, 'Cidade é obrigatória'),
  state:        z.string().length(2, 'Estado deve ter 2 letras (ex: SP)'),
  cep:          z.string().default(''),
  buildingType: z.string().default('Outro'),
  totalArea:    z.number().nonnegative().default(0),
  floors:       z.number().int().nonnegative().default(0),
  startDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser yyyy-MM-dd').default('2026-01-01'),
  expectedEnd:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser yyyy-MM-dd').default('2026-12-31'),
  lat:          z.number().min(-90).max(90).nullable().default(null),
  lng:          z.number().min(-180).max(180).nullable().default(null),
})

export const OBRA_IMPORT_CONFIG: ImportConfig<ObraImportRow> = {
  schema: obraSchema,
  columns: [
    { key: 'code',         headerAliases: ['code', 'código', 'codigo'],                              type: 'string', required: true },
    { key: 'name',         headerAliases: ['name', 'nome'],                                          type: 'string', required: true },
    { key: 'company',      headerAliases: ['company', 'empresa', 'construtora'],                     type: 'string' },
    { key: 'owner',        headerAliases: ['owner', 'dono', 'proprietário', 'proprietario'],         type: 'string' },
    { key: 'manager',      headerAliases: ['manager', 'gerente', 'responsável', 'responsavel'],      type: 'string' },
    { key: 'description',  headerAliases: ['description', 'descrição', 'descricao'],                 type: 'string' },
    { key: 'status',       headerAliases: ['status'],                                                 type: 'string', defaultValue: 'planning', transform: (raw) => {
      const s = String(raw).toLowerCase().trim()
      if (['active', 'planning', 'paused', 'completed'].includes(s)) return s as 'active' | 'planning' | 'paused' | 'completed'
      if (['ativa', 'ativo', 'em andamento'].includes(s)) return 'active'
      if (['planejada', 'planejamento'].includes(s)) return 'planning'
      if (['pausada', 'pausado'].includes(s)) return 'paused'
      if (['concluída', 'concluida', 'completa'].includes(s)) return 'completed'
      return 'planning'
    }},
    { key: 'street',       headerAliases: ['street', 'rua', 'avenida', 'logradouro'],                type: 'string' },
    { key: 'number',       headerAliases: ['number', 'número', 'numero'],                             type: 'string' },
    { key: 'district',     headerAliases: ['district', 'bairro'],                                     type: 'string' },
    { key: 'city',         headerAliases: ['city', 'cidade', 'município', 'municipio'],               type: 'string', required: true },
    { key: 'state',        headerAliases: ['state', 'estado', 'uf'],                                  type: 'string', required: true },
    { key: 'cep',          headerAliases: ['cep', 'zip', 'postal'],                                   type: 'string' },
    { key: 'buildingType', headerAliases: ['buildingtype', 'tipo', 'tipo de obra'],                   type: 'string', defaultValue: 'Outro' },
    { key: 'totalArea',    headerAliases: ['totalarea', 'area', 'área', 'área (m²)', 'area total'],   type: 'number', defaultValue: 0 },
    { key: 'floors',       headerAliases: ['floors', 'andares', 'pavimentos'],                        type: 'number', defaultValue: 0 },
    { key: 'startDate',    headerAliases: ['startdate', 'start_date', 'início', 'inicio', 'data início', 'data inicio'], type: 'date', defaultValue: '2026-01-01' },
    { key: 'expectedEnd',  headerAliases: ['expectedend', 'expected_end', 'fim', 'término', 'termino', 'data fim'], type: 'date', defaultValue: '2026-12-31' },
    { key: 'lat',          headerAliases: ['lat', 'latitude'],                                        type: 'number' },
    { key: 'lng',          headerAliases: ['lng', 'longitude', 'long'],                               type: 'number' },
  ],
  exampleHeaders: ['code', 'name', 'company', 'owner', 'manager', 'status', 'street', 'number', 'district', 'city', 'state', 'cep', 'buildingType', 'totalArea', 'floors', 'startDate', 'expectedEnd', 'lat', 'lng'],
  exampleRow: {
    code: 'OBR-001',
    name: 'Torre Residencial Paulista',
    company: 'Construtora ABC Ltda',
    owner: 'Empreendimentos XYZ',
    manager: 'João Silva',
    status: 'active',
    street: 'Av. Paulista',
    number: '1500',
    district: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    cep: '01310-100',
    buildingType: 'Residencial',
    totalArea: 2400,
    floors: 12,
    startDate: '2026-03-15',
    expectedEnd: '2027-09-30',
    lat: -23.5649,
    lng: -46.6527,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) MÃO DE OBRA — trabalhadores.csv
// ─────────────────────────────────────────────────────────────────────────────

type WorkerImportRow = Omit<Worker, 'id' | 'certifications' | 'biometricToken'>

const workerSchema = z.object({
  name:               z.string().min(1, 'Nome é obrigatório'),
  role:               z.string().min(1, 'Função é obrigatória'),
  cpfMasked:          z.string().default('***.***.***-XX'),
  crewId:             z.string().default(''),
  status:             z.enum(['active', 'inactive', 'suspended', 'pending_approval']).default('active'),
  hourlyRate:         z.number().nonnegative().default(0),
  registrationNumber: z.string().optional(),
  department:         z.string().optional(),
  email:              z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone:              z.string().optional(),
  admissionDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser yyyy-MM-dd').optional().or(z.literal('')),
  contractType:       z.enum(['clt', 'pj', 'freelancer', 'apprentice']).optional(),
  scheduleType:       z.enum(['standard', '6x1', '5x2', '12x36', 'daily', 'custom']).optional(),
  workFront:          z.string().optional(),
})

/**
 * Mascara CPF: aceita "12345678900" / "123.456.789-00" e retorna
 * "***.***.***-00" — só os 2 últimos dígitos visíveis (LGPD).
 */
function maskCpf(raw: unknown): string {
  const str = String(raw ?? '').replace(/\D/g, '')
  if (str.length < 11) return '***.***.***-XX'
  return `***.***.***-${str.slice(-2)}`
}

export const WORKER_IMPORT_CONFIG: ImportConfig<WorkerImportRow> = {
  schema: workerSchema,
  columns: [
    { key: 'name',               headerAliases: ['name', 'nome', 'colaborador'],                       type: 'string', required: true },
    { key: 'role',               headerAliases: ['role', 'função', 'funcao', 'cargo'],                 type: 'string', required: true },
    { key: 'cpfMasked',          headerAliases: ['cpf', 'cpfmasked', 'cpf mascarado'],                 type: 'string', defaultValue: '***.***.***-XX', transform: maskCpf },
    { key: 'crewId',             headerAliases: ['crewid', 'crew', 'equipe', 'turma'],                 type: 'string', defaultValue: '' },
    { key: 'status',             headerAliases: ['status'],                                            type: 'string', defaultValue: 'active', transform: (raw) => {
      const s = String(raw).toLowerCase().trim()
      if (['active', 'inactive', 'suspended', 'pending_approval'].includes(s)) {
        return s as 'active' | 'inactive' | 'suspended' | 'pending_approval'
      }
      if (['ativo', 'ativa'].includes(s)) return 'active'
      if (['inativo', 'inativa'].includes(s)) return 'inactive'
      return 'active'
    }},
    { key: 'hourlyRate',         headerAliases: ['hourlyrate', 'hourly_rate', 'valor hora', 'r$/h', 'salário hora', 'salario hora'], type: 'number', defaultValue: 0 },
    { key: 'registrationNumber', headerAliases: ['registrationnumber', 'matrícula', 'matricula'],     type: 'string' },
    { key: 'department',         headerAliases: ['department', 'departamento'],                       type: 'string' },
    { key: 'email',              headerAliases: ['email', 'e-mail'],                                  type: 'string' },
    { key: 'phone',              headerAliases: ['phone', 'telefone', 'celular'],                     type: 'string' },
    { key: 'admissionDate',      headerAliases: ['admissiondate', 'admission_date', 'data admissão', 'data admissao', 'admissão'], type: 'date' },
    { key: 'contractType',       headerAliases: ['contracttype', 'tipo contrato', 'contrato'],        type: 'string', transform: (raw) => {
      const s = String(raw).toLowerCase().trim()
      if (['clt', 'pj', 'freelancer', 'apprentice'].includes(s)) return s as 'clt' | 'pj' | 'freelancer' | 'apprentice'
      if (['estagiario', 'estagiário', 'aprendiz'].includes(s)) return 'apprentice'
      return undefined as unknown as 'clt'
    }},
    { key: 'workFront',          headerAliases: ['workfront', 'frente', 'frente trabalho'],           type: 'string' },
  ],
  exampleHeaders: ['name', 'role', 'cpf', 'crewId', 'status', 'hourlyRate', 'admissionDate', 'contractType', 'phone'],
  exampleRow: {
    name: 'Carlos Mendes',
    role: 'Encarregado',
    cpf: '12345678900',
    crewId: 'crew-A',
    status: 'active',
    hourlyRate: 28.50,
    admissionDate: '2024-03-15',
    contractType: 'clt',
    phone: '(11) 99999-9999',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) SUPRIMENTOS — fornecedores.csv (cadastro leve, vira "supplier" string em PO)
// ─────────────────────────────────────────────────────────────────────────────

export type SupplierImportRow = {
  cnpj:        string
  name:        string
  category:    string
  contactName: string
  phone:       string
  email:       string
  paymentTerms: string
} & Record<string, unknown>

const supplierSchema = z.object({
  cnpj:         z.string().default(''),
  name:         z.string().min(1, 'Nome do fornecedor é obrigatório'),
  category:     z.string().default('Geral'),
  contactName:  z.string().default(''),
  phone:        z.string().default(''),
  email:        z.string().email('E-mail inválido').optional().or(z.literal('')).default(''),
  paymentTerms: z.string().default(''),
})

export const SUPPLIER_IMPORT_CONFIG: ImportConfig<SupplierImportRow> = {
  schema: supplierSchema,
  columns: [
    { key: 'cnpj',         headerAliases: ['cnpj'],                                                  type: 'string' },
    { key: 'name',         headerAliases: ['name', 'nome', 'razão social', 'razao social'],          type: 'string', required: true },
    { key: 'category',     headerAliases: ['category', 'categoria', 'tipo'],                         type: 'string', defaultValue: 'Geral' },
    { key: 'contactName',  headerAliases: ['contactname', 'contato', 'nome contato'],                type: 'string' },
    { key: 'phone',        headerAliases: ['phone', 'telefone', 'celular'],                          type: 'string' },
    { key: 'email',        headerAliases: ['email', 'e-mail'],                                       type: 'string' },
    { key: 'paymentTerms', headerAliases: ['paymentterms', 'condição pagamento', 'condicao pagamento', 'prazo'], type: 'string' },
  ],
  exampleHeaders: ['cnpj', 'name', 'category', 'contactName', 'phone', 'email', 'paymentTerms'],
  exampleRow: {
    cnpj: '12.345.678/0001-90',
    name: 'Cimpor Brasil',
    category: 'Concreto',
    contactName: 'Ana Ribeiro',
    phone: '(11) 99999-9999',
    email: 'vendas@cimpor.com.br',
    paymentTerms: '30 dias',
  },
}
