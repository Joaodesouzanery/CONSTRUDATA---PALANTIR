import type {
  Worker,
  LaborCrew,
  TimecardEntry,
  PhysicalProgress,
  LaborOccurrence,
  RiskArea,
  ReallocationSuggestion,
} from '@/types'

// ─── Workers ──────────────────────────────────────────────────────────────────

export const mockWorkers: Worker[] = [
  {
    id: 'w-1',
    name: 'José Aparecido da Silva',
    role: 'Pedreiro Oficial',
    cpfMasked: '***.***.**-74',
    crewId: 'lc-1',
    status: 'active',
    hourlyRate: 32.50,
    biometricToken: 'hash:sha256:3a7f2c1b',
    certifications: [
      { id: 'cert-1-1', type: 'NR18', issuedDate: '2024-03-10', expiryDate: '2026-03-10', status: 'valid' },
      { id: 'cert-1-2', type: 'NR35', issuedDate: '2024-06-15', expiryDate: '2026-06-15', status: 'valid' },
      { id: 'cert-1-3', type: 'ASO', issuedDate: '2025-01-20', expiryDate: '2026-01-20', status: 'expiring' },
    ],
  },
  {
    id: 'w-2',
    name: 'Ronaldo Ferreira Mendes',
    role: 'Pedreiro Especializado',
    cpfMasked: '***.***.**-31',
    crewId: 'lc-1',
    status: 'active',
    hourlyRate: 36.00,
    certifications: [
      { id: 'cert-2-1', type: 'NR18', issuedDate: '2023-11-05', expiryDate: '2025-11-05', status: 'expiring' },
      { id: 'cert-2-2', type: 'NR35', issuedDate: '2024-01-12', expiryDate: '2026-01-12', status: 'valid' },
    ],
  },
  {
    id: 'w-3',
    name: 'Marcos Antônio Pereira',
    role: 'Servente de Obras',
    cpfMasked: '***.***.**-88',
    crewId: 'lc-1',
    status: 'active',
    hourlyRate: 22.00,
    certifications: [
      { id: 'cert-3-1', type: 'NR18', issuedDate: '2024-07-20', expiryDate: '2026-07-20', status: 'valid' },
    ],
  },
  {
    id: 'w-4',
    name: 'Carlos Eduardo Santos',
    role: 'Carpinteiro de Formas',
    cpfMasked: '***.***.**-56',
    crewId: 'lc-2',
    status: 'active',
    hourlyRate: 40.00,
    certifications: [
      { id: 'cert-4-1', type: 'NR18', issuedDate: '2024-02-28', expiryDate: '2026-02-28', status: 'valid' },
      { id: 'cert-4-2', type: 'NR35', issuedDate: '2024-02-28', expiryDate: '2026-02-28', status: 'valid' },
      { id: 'cert-4-3', type: 'NR10', issuedDate: '2023-08-10', expiryDate: '2025-08-10', status: 'expiring' },
    ],
  },
  {
    id: 'w-5',
    name: 'Antônio Luiz Rodrigues',
    role: 'Armador de Ferro',
    cpfMasked: '***.***.**-19',
    crewId: 'lc-2',
    status: 'active',
    hourlyRate: 38.50,
    certifications: [
      { id: 'cert-5-1', type: 'NR18', issuedDate: '2024-09-01', expiryDate: '2026-09-01', status: 'valid' },
      { id: 'cert-5-2', type: 'NR35', issuedDate: '2024-09-01', expiryDate: '2026-09-01', status: 'valid' },
    ],
  },
  {
    id: 'w-6',
    name: 'Fernando Costa Lima',
    role: 'Pintor de Obras',
    cpfMasked: '***.***.**-02',
    crewId: 'lc-3',
    status: 'active',
    hourlyRate: 30.00,
    certifications: [
      { id: 'cert-6-1', type: 'NR18', issuedDate: '2024-05-14', expiryDate: '2026-05-14', status: 'valid' },
    ],
  },
  {
    id: 'w-7',
    name: 'Gilberto Nascimento',
    role: 'Azulejista',
    cpfMasked: '***.***.**-45',
    crewId: 'lc-3',
    status: 'active',
    hourlyRate: 34.00,
    certifications: [
      { id: 'cert-7-1', type: 'NR18', issuedDate: '2024-08-19', expiryDate: '2026-08-19', status: 'valid' },
    ],
  },
  {
    id: 'w-8',
    name: 'Paulo Roberto Gomes',
    role: 'Eletricista',
    cpfMasked: '***.***.**-63',
    crewId: 'lc-2',
    status: 'suspended',
    hourlyRate: 45.00,
    certifications: [
      { id: 'cert-8-1', type: 'NR18', issuedDate: '2022-06-01', expiryDate: '2024-06-01', status: 'expired' },
      { id: 'cert-8-2', type: 'NR10', issuedDate: '2022-06-01', expiryDate: '2024-06-01', status: 'expired' },
    ],
  },
]

// ─── Labor Crews ──────────────────────────────────────────────────────────────

export const mockLaborCrews: LaborCrew[] = [
  {
    id: 'lc-1',
    name: 'Equipe Alvenaria A',
    foreman: 'José Aparecido da Silva',
    specialty: 'Alvenaria e Reboco',
    workerIds: ['w-1', 'w-2', 'w-3'],
    projectRef: 'PRJ-001',
  },
  {
    id: 'lc-2',
    name: 'Equipe Concreto B',
    foreman: 'Carlos Eduardo Santos',
    specialty: 'Estrutura e Concretagem',
    workerIds: ['w-4', 'w-5', 'w-8'],
    projectRef: 'PRJ-001',
  },
  {
    id: 'lc-3',
    name: 'Equipe Acabamento C',
    foreman: 'Fernando Costa Lima',
    specialty: 'Pintura e Revestimento',
    workerIds: ['w-6', 'w-7'],
    projectRef: 'PRJ-001',
  },
]

// ─── Timecard Entries (last 7 days) ──────────────────────────────────────────

const today = new Date()
function daysAgo(n: number): string {
  const d = new Date(today)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export const mockTimecards: TimecardEntry[] = [
  // Day 0 — today
  { id: 'tc-01', workerId: 'w-1', date: daysAgo(0), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Elevação de alvenaria bloco A', reportedQty: 18, unit: 'm²', notes: '' },
  { id: 'tc-02', workerId: 'w-2', date: daysAgo(0), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Elevação de alvenaria bloco A', reportedQty: 16, unit: 'm²' },
  { id: 'tc-03', workerId: 'w-4', date: daysAgo(0), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Montagem de formas laje L4', reportedQty: 22, unit: 'm²' },
  { id: 'tc-04', workerId: 'w-5', date: daysAgo(0), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Armação laje L4', reportedQty: 280, unit: 'kg' },
  // Day 1
  { id: 'tc-05', workerId: 'w-1', date: daysAgo(1), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Elevação de alvenaria bloco B', reportedQty: 20, unit: 'm²' },
  { id: 'tc-06', workerId: 'w-2', date: daysAgo(1), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Elevação de alvenaria bloco B', reportedQty: 18, unit: 'm²' },
  { id: 'tc-07', workerId: 'w-3', date: daysAgo(1), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Transporte e apoio alvenaria', reportedQty: 12, unit: 'm²' },
  { id: 'tc-08', workerId: 'w-4', date: daysAgo(1), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Montagem de formas vigas', reportedQty: 15, unit: 'm²' },
  // Day 2
  { id: 'tc-09', workerId: 'w-1', date: daysAgo(2), hoursWorked: 9, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Chapisco e emboço paredes', reportedQty: 35, unit: 'm²' },
  { id: 'tc-10', workerId: 'w-5', date: daysAgo(2), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Armação vigas V1-V8', reportedQty: 350, unit: 'kg' },
  { id: 'tc-11', workerId: 'w-6', date: daysAgo(2), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Aplicação massa corrida dormitórios', reportedQty: 40, unit: 'm²' },
  // Day 3 — material delay, reduced productivity
  { id: 'tc-12', workerId: 'w-1', date: daysAgo(3), hoursWorked: 5, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Elevação de alvenaria — aguardando blocos', reportedQty: 8, unit: 'm²', notes: 'Atraso entrega blocos cerâmicos' },
  { id: 'tc-13', workerId: 'w-2', date: daysAgo(3), hoursWorked: 5, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Elevação de alvenaria — aguardando blocos', reportedQty: 7, unit: 'm²', notes: 'Atraso entrega blocos cerâmicos' },
  { id: 'tc-14', workerId: 'w-4', date: daysAgo(3), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Concretagem pilares P9-P16', reportedQty: 12, unit: 'm³' },
  // Day 4
  { id: 'tc-15', workerId: 'w-1', date: daysAgo(4), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Elevação de alvenaria bloco C', reportedQty: 21, unit: 'm²' },
  { id: 'tc-16', workerId: 'w-3', date: daysAgo(4), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Apoio e transporte materiais', reportedQty: 0, unit: 'serv' },
  { id: 'tc-17', workerId: 'w-7', date: daysAgo(4), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Assentamento cerâmica banheiros', reportedQty: 24, unit: 'm²' },
  // Day 5
  { id: 'tc-18', workerId: 'w-4', date: daysAgo(5), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Concretagem laje L3', reportedQty: 28, unit: 'm³' },
  { id: 'tc-19', workerId: 'w-5', date: daysAgo(5), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Desforma pilares P1-P8', reportedQty: 8, unit: 'un' },
  { id: 'tc-20', workerId: 'w-6', date: daysAgo(5), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Pintura seladora hall', reportedQty: 55, unit: 'm²' },
  // Day 6 — holiday, no work
  // Day 7
  { id: 'tc-21', workerId: 'w-1', date: daysAgo(7), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Emboço paredes bloco B', reportedQty: 30, unit: 'm²' },
  { id: 'tc-22', workerId: 'w-2', date: daysAgo(7), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Emboço paredes bloco B', reportedQty: 28, unit: 'm²' },
  { id: 'tc-23', workerId: 'w-7', date: daysAgo(7), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Assentamento cerâmica salas', reportedQty: 20, unit: 'm²' },
  { id: 'tc-24', workerId: 'w-6', date: daysAgo(7), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Aplicação textura fachada bloco A', reportedQty: 45, unit: 'm²' },
  { id: 'tc-25', workerId: 'w-5', date: daysAgo(7), hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: 'Armação laje L3', reportedQty: 400, unit: 'kg' },
]

// ─── Physical Progress ────────────────────────────────────────────────────────

export const mockPhysicalProgress: PhysicalProgress[] = [
  { id: 'pp-01', date: daysAgo(0), phaseId: 'exec-1', activityName: 'Alvenaria Bloco A', plannedQty: 40, reportedQty: 34, unit: 'm²' },
  { id: 'pp-02', date: daysAgo(0), phaseId: 'exec-1', activityName: 'Formas Laje L4',    plannedQty: 30, reportedQty: 22, unit: 'm²' },
  { id: 'pp-03', date: daysAgo(1), phaseId: 'exec-1', activityName: 'Alvenaria Bloco B', plannedQty: 50, reportedQty: 50, unit: 'm²' },
  { id: 'pp-04', date: daysAgo(1), phaseId: 'exec-1', activityName: 'Formas Vigas',      plannedQty: 20, reportedQty: 15, unit: 'm²' },
  { id: 'pp-05', date: daysAgo(2), phaseId: 'exec-1', activityName: 'Chapisco/Emboço',   plannedQty: 50, reportedQty: 35, unit: 'm²' },
  { id: 'pp-06', date: daysAgo(2), phaseId: 'exec-1', activityName: 'Armação Vigas',     plannedQty: 400, reportedQty: 350, unit: 'kg' },
  { id: 'pp-07', date: daysAgo(3), phaseId: 'exec-1', activityName: 'Alvenaria (reduzida)', plannedQty: 50, reportedQty: 15, unit: 'm²' },
  { id: 'pp-08', date: daysAgo(3), phaseId: 'exec-1', activityName: 'Concretagem P9-P16', plannedQty: 12, reportedQty: 12, unit: 'm³' },
  { id: 'pp-09', date: daysAgo(4), phaseId: 'exec-1', activityName: 'Alvenaria Bloco C',  plannedQty: 30, reportedQty: 21, unit: 'm²' },
  { id: 'pp-10', date: daysAgo(4), phaseId: 'exec-1', activityName: 'Cerâmica Banheiros', plannedQty: 30, reportedQty: 24, unit: 'm²' },
  { id: 'pp-11', date: daysAgo(5), phaseId: 'exec-1', activityName: 'Concretagem L3',     plannedQty: 30, reportedQty: 28, unit: 'm³' },
  { id: 'pp-12', date: daysAgo(5), phaseId: 'exec-1', activityName: 'Pintura Seladora',   plannedQty: 60, reportedQty: 55, unit: 'm²' },
  { id: 'pp-13', date: daysAgo(7), phaseId: 'exec-1', activityName: 'Emboço Bloco B',     plannedQty: 60, reportedQty: 58, unit: 'm²' },
  { id: 'pp-14', date: daysAgo(7), phaseId: 'exec-1', activityName: 'Cerâmica Salas',     plannedQty: 25, reportedQty: 20, unit: 'm²' },
]

// ─── Occurrences ─────────────────────────────────────────────────────────────

export const mockOccurrences: LaborOccurrence[] = [
  {
    id: 'occ-1',
    date: daysAgo(3),
    type: 'material_delay',
    description: 'Atraso na entrega de blocos cerâmicos pelo fornecedor — 2.000 unidades não chegaram no prazo acordado.',
    impactHours: 16,
    affectedCrewIds: ['lc-1'],
  },
  {
    id: 'occ-2',
    date: daysAgo(6),
    type: 'holiday',
    description: 'Feriado municipal — Aniversário da cidade. Canteiro paralisado conforme convenção coletiva.',
    impactHours: 56,
    affectedCrewIds: ['lc-1', 'lc-2', 'lc-3'],
  },
  {
    id: 'occ-3',
    date: daysAgo(9),
    type: 'weather',
    description: 'Chuva intensa com ventos — serviços externos suspensos por segurança (NR18 item 18.13).',
    impactHours: 24,
    affectedCrewIds: ['lc-1', 'lc-2'],
  },
  {
    id: 'occ-4',
    date: daysAgo(12),
    type: 'equipment_failure',
    description: 'Falha hidráulica no caminhão betoneira EQ-017 — manutenção emergencial. Concretagem suspensa por 4h.',
    impactHours: 8,
    affectedCrewIds: ['lc-2'],
  },
]

// ─── Risk Areas ───────────────────────────────────────────────────────────────

export const mockRiskAreas: RiskArea[] = [
  {
    id: 'ra-1',
    name: 'Trabalho em Altura (> 2m)',
    requiredCertTypes: ['NR35', 'NR18', 'ASO'],
  },
  {
    id: 'ra-2',
    name: 'Área Elétrica / Subestação',
    requiredCertTypes: ['NR10', 'NR18', 'ASO'],
  },
  {
    id: 'ra-3',
    name: 'Canteiro Geral',
    requiredCertTypes: ['NR18'],
  },
]

// ─── Reallocation Suggestions ─────────────────────────────────────────────────

export const mockReallocationSuggestions: ReallocationSuggestion[] = [
  {
    id: 'rs-1',
    delayedTaskId: 'task-formas-L4',
    delayedTaskName: 'Montagem Formas Laje L4',
    delayDays: 3,
    sourceCrew: 'Equipe Acabamento C',
    sourceTaskId: 'task-pintura-ext',
    sourceTaskName: 'Pintura Fachada Externa',
    sourceTaskFloat: 12,
    reason: '"Pintura Fachada Externa" tem folga de 12 dias — realocar Equipe Acabamento C para reforçar "Montagem Formas Laje L4" que está 3 dias atrasada no caminho crítico.',
    accepted: undefined,
  },
  {
    id: 'rs-2',
    delayedTaskId: 'task-alvenaria-C',
    delayedTaskName: 'Elevação Alvenaria Bloco C',
    delayDays: 2,
    sourceCrew: 'Equipe Concreto B',
    sourceTaskId: 'task-desforma',
    sourceTaskName: 'Desforma Pilares P9-P16',
    sourceTaskFloat: 8,
    reason: '"Desforma Pilares P9-P16" tem folga de 8 dias — parte da Equipe Concreto B pode auxiliar temporariamente na "Elevação Alvenaria Bloco C" para recuperar os 2 dias de atraso.',
    accepted: undefined,
  },
  {
    id: 'rs-3',
    delayedTaskId: 'task-ceramica',
    delayedTaskName: 'Revestimento Cerâmico Banheiros',
    delayDays: 1,
    sourceCrew: 'Equipe Alvenaria A',
    sourceTaskId: 'task-chapisco',
    sourceTaskName: 'Chapisco Paredes Internas',
    sourceTaskFloat: 7,
    reason: '"Chapisco Paredes Internas" tem folga de 7 dias — realocar 1 pedreiro da Equipe Alvenaria A para auxiliar no "Revestimento Cerâmico Banheiros" e recuperar o atraso de 1 dia.',
    accepted: undefined,
  },
]
