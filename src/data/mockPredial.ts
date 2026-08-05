/**
 * mockPredial.ts — dados de DEMONSTRAÇÃO do módulo Predial ("Residencial Modelo — 96 unidades").
 * Só entram quando o modo Demo está ligado (appModeStore.toggleDemoMode) — nunca se misturam
 * com os dados reais (o snapshot/restore preserva o real e o sync faz no-op em demo).
 * Builders (não constantes) para as datas serem sempre relativas a hoje → laudos/preventivas
 * caem em vários status (em dia / a vencer / vencido) independente de quando o demo é aberto.
 */
import type { ConstructionSite } from '@/types'
import type { MaintenanceAsset, MaintenancePlan, MaintenanceWorkOrder } from '@/store/manutencoesStore'
import type { Laudo } from '@/store/laudosStore'

export const PREDIAL_DEMO_SITE_ID = 'predial-demo-residencial'
const now = () => new Date().toISOString()
const dISO = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10)
const tsISO = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString()

/** Prédio-modelo (entra no MOCK_OBRAS da Torre em modo demo). */
export function predialDemoSite(): ConstructionSite {
  return {
    id: PREDIAL_DEMO_SITE_ID,
    code: 'PRED-DEMO',
    name: 'Residencial Modelo',
    company: 'Condomínio Residencial Modelo',
    owner: 'Assembleia de Condôminos',
    manager: 'Síndico — Ana Ribeiro',
    description: 'Condomínio residencial de demonstração — 2 torres, 96 unidades, 3 subsolos de garagem, salão de festas, piscina e academia.',
    status: 'active',
    street: 'Rua das Acácias', number: '350', district: 'Jardim das Flores', city: 'Brasília', state: 'DF', cep: '70000-000',
    buildingType: 'Condomínio Residencial',
    totalArea: 12800, floors: 18,
    startDate: dISO(-3650), expectedEnd: dISO(-3650),
    lat: -15.79, lng: -47.88,
    risks: [], budgetLines: [], planningMilestones: [], executionMilestones: [],
  }
}

// ─── factories (defaults completos; partial sobrescreve) ───────────────────────
let seq = 0
const uid = (p: string) => `${p}-${(seq += 1).toString().padStart(3, '0')}`

function asset(p: Partial<MaintenanceAsset> & Pick<MaintenanceAsset, 'name' | 'type' | 'sistema' | 'criticality' | 'location'>): MaintenanceAsset {
  return {
    id: uid('demo-atv'), code: `ATV-${String(seq).padStart(3, '0')}`, status: 'active',
    responsible: 'Zelador — Marcos', qrCode: '', projectId: null, constructionSiteId: PREDIAL_DEMO_SITE_ID,
    createdAt: now(), updatedAt: now(), ...p,
  }
}
function plan(p: Partial<MaintenancePlan> & Pick<MaintenancePlan, 'title' | 'frequency' | 'nextDueDate' | 'assetIds'>): MaintenancePlan {
  return {
    id: uid('demo-pln'), code: `PLN-${String(seq).padStart(3, '0')}`, description: '', priority: 'media',
    estimatedDurationMinutes: 60, checklist: [], active: true, projectId: null, constructionSiteId: PREDIAL_DEMO_SITE_ID,
    createdAt: now(), updatedAt: now(), ...p,
  }
}
function wo(p: Partial<MaintenanceWorkOrder> & Pick<MaintenanceWorkOrder, 'title' | 'status' | 'assetIds'>): MaintenanceWorkOrder {
  return {
    id: uid('demo-os'), code: `OS-${String(seq).padStart(4, '0')}`, description: '', priority: 'media', severity: 'media',
    planned: false, progress: p.status === 'concluida' ? 100 : 0, scheduledDate: dISO(-2), dueDate: dISO(3),
    startedAt: null, completedAt: null, assignee: 'Prestador — HidroTech', requester: 'Zelador — Marcos',
    estimatedDurationMinutes: 90, actualDurationMinutes: null, estimatedCost: 0, actualCost: 0,
    checklist: [], evidence: [], pmbok: {}, leanLps: {}, planId: null, projectId: null,
    constructionSiteId: PREDIAL_DEMO_SITE_ID, createdAt: now(), updatedAt: now(), ...p,
  }
}
function laudo(p: Partial<Laudo> & Pick<Laudo, 'tipo' | 'validade'>): Laudo {
  return {
    id: uid('demo-laudo'), constructionSiteId: PREDIAL_DEMO_SITE_ID, projectId: null,
    responsavel: 'Empresa credenciada', createdAt: now(), updatedAt: now(), ...p,
  }
}

/** 15 ativos prediais com vocabulário próprio, idades e criticidades variadas. */
export function predialDemoAssets(): MaintenanceAsset[] {
  seq = 0
  return [
    asset({ name: 'Bomba de Recalque 01', type: 'Bomba', sistema: 'Hidráulico', criticality: 'critica', location: 'Subsolo 3 · Casa de Bombas', areaAtendida: 'Abastecimento geral', fabricante: 'KSB', dataInstalacao: dISO(-365 * 13), vidaUtilAnosNBR: 15, replacementCostBRL: 18000 }),
    asset({ name: 'Bomba de Recalque 02', type: 'Bomba', sistema: 'Hidráulico', criticality: 'alta', location: 'Subsolo 3 · Casa de Bombas', areaAtendida: 'Abastecimento geral (reserva)', fabricante: 'KSB', dataInstalacao: dISO(-365 * 7), vidaUtilAnosNBR: 15, replacementCostBRL: 18000 }),
    asset({ name: 'Elevador Social — Torre A', type: 'Elevador', sistema: 'Elevadores', criticality: 'critica', location: 'Torre A · Casa de Máquinas', areaAtendida: 'Pavimentos 1–18', fabricante: 'Atlas Schindler', dataInstalacao: dISO(-365 * 12), vidaUtilAnosNBR: 25, replacementCostBRL: 220000 }),
    asset({ name: 'Elevador de Serviço — Torre A', type: 'Elevador', sistema: 'Elevadores', criticality: 'alta', location: 'Torre A · Casa de Máquinas', areaAtendida: 'Pavimentos 1–18', fabricante: 'Atlas Schindler', dataInstalacao: dISO(-365 * 12), vidaUtilAnosNBR: 25, replacementCostBRL: 200000 }),
    asset({ name: 'Elevador Social — Torre B', type: 'Elevador', sistema: 'Elevadores', criticality: 'critica', location: 'Torre B · Casa de Máquinas', areaAtendida: 'Pavimentos 1–18', fabricante: 'Otis', dataInstalacao: dISO(-365 * 9), vidaUtilAnosNBR: 25, replacementCostBRL: 220000 }),
    asset({ name: 'Gerador Diesel 250 kVA', type: 'Gerador', sistema: 'Elétrico', criticality: 'critica', location: 'Subsolo 2 · Casa de Máquinas', areaAtendida: 'Emergência (elevadores, bombas, iluminação)', fabricante: 'Stemac', dataInstalacao: dISO(-365 * 8), vidaUtilAnosNBR: 20, replacementCostBRL: 95000 }),
    asset({ name: 'Quadro Geral — QGBT', type: 'Quadro elétrico', sistema: 'Elétrico', criticality: 'alta', location: 'Subsolo 1 · Medição', areaAtendida: 'Distribuição geral', fabricante: 'Schneider', dataInstalacao: dISO(-365 * 10), vidaUtilAnosNBR: 25 }),
    asset({ name: 'Central de Alarme de Incêndio', type: 'Central de incêndio', sistema: 'Incêndio', criticality: 'critica', location: 'Portaria', areaAtendida: 'Detecção/alarme geral', fabricante: 'Intelbras', dataInstalacao: dISO(-365 * 6), vidaUtilAnosNBR: 15 }),
    asset({ name: 'Bomba de Incêndio', type: 'Bomba', sistema: 'Incêndio', criticality: 'critica', location: 'Subsolo 3 · Casa de Bombas', areaAtendida: 'Rede de hidrantes/sprinklers', fabricante: 'KSB', dataInstalacao: dISO(-365 * 6), vidaUtilAnosNBR: 15, replacementCostBRL: 22000 }),
    asset({ name: 'Pressurizador de Escada', type: 'Ventilador', sistema: 'Incêndio', criticality: 'media', location: 'Torre A · Casa de Máquinas', areaAtendida: 'Escada pressurizada', fabricante: 'Projelmec', dataInstalacao: dISO(-365 * 6), vidaUtilAnosNBR: 20 }),
    asset({ name: 'Portão Basculante — Garagem', type: 'Portão', sistema: 'Outros', criticality: 'media', location: 'Térreo · Acesso garagem', areaAtendida: 'Entrada/saída de veículos', fabricante: 'PPA', dataInstalacao: dISO(-365 * 5), vidaUtilAnosNBR: 10 }),
    asset({ name: 'Bomba da Piscina', type: 'Bomba', sistema: 'Hidráulico', criticality: 'baixa', location: 'Lazer · Casa de Máquinas Piscina', areaAtendida: 'Filtragem da piscina', fabricante: 'Dancor', dataInstalacao: dISO(-365 * 4), vidaUtilAnosNBR: 12 }),
    asset({ name: 'Reservatório Superior', type: 'Reservatório', sistema: 'Hidráulico', criticality: 'media', location: 'Cobertura · Barrilete', areaAtendida: 'Reserva de água', dataInstalacao: dISO(-365 * 10), vidaUtilAnosNBR: 30 }),
    asset({ name: 'Ar-condicionado — Salão de Festas', type: 'Split', sistema: 'HVAC', criticality: 'baixa', location: 'Lazer · Salão de Festas', areaAtendida: 'Salão de festas', fabricante: 'LG', dataInstalacao: dISO(-365 * 3), vidaUtilAnosNBR: 12, replacementCostBRL: 9000 }),
    asset({ name: 'Central de Interfonia', type: 'Interfone', sistema: 'Elétrico', criticality: 'baixa', location: 'Portaria', areaAtendida: 'Comunicação com as unidades', fabricante: 'Intelbras', dataInstalacao: dISO(-365 * 5), vidaUtilAnosNBR: 10 }),
  ]
}

/** 6 planos preventivos — alguns vencidos (alimentam criticidade + "gerar preventivas"). */
export function predialDemoPlans(assets: MaintenanceAsset[]): MaintenancePlan[] {
  const byName = (n: string) => assets.find((a) => a.name.startsWith(n))?.id
  const ids = (names: string[]) => names.map(byName).filter(Boolean) as string[]
  return [
    plan({ title: 'Preventiva mensal — Bombas de recalque', frequency: 'mensal', priority: 'alta', nextDueDate: dISO(-8), assetIds: ids(['Bomba de Recalque 01', 'Bomba de Recalque 02']), checklist: ['Verificar vazamentos', 'Medir corrente do motor', 'Testar boia de nível'] }),
    plan({ title: 'Manutenção mensal — Elevadores (contrato)', frequency: 'mensal', priority: 'critica', nextDueDate: dISO(4), assetIds: ids(['Elevador Social — Torre A', 'Elevador de Serviço — Torre A', 'Elevador Social — Torre B']) }),
    plan({ title: 'Teste mensal — Gerador (partida em carga)', frequency: 'mensal', priority: 'alta', nextDueDate: dISO(-2), assetIds: ids(['Gerador Diesel 250 kVA']), checklist: ['Nível de combustível', 'Partida automática', 'Registro de horas'] }),
    plan({ title: 'Preventiva trimestral — Sistema de incêndio', frequency: 'trimestral', priority: 'critica', nextDueDate: dISO(20), assetIds: ids(['Central de Alarme de Incêndio', 'Bomba de Incêndio', 'Pressurizador de Escada']) }),
    plan({ title: 'Limpeza semestral — Reservatórios', frequency: 'semestral', priority: 'media', nextDueDate: dISO(45), assetIds: ids(['Reservatório Superior']) }),
    plan({ title: 'Preventiva anual — Portão da garagem', frequency: 'anual', priority: 'baixa', nextDueDate: dISO(-30), assetIds: ids(['Portão Basculante — Garagem']) }),
  ]
}

/** ~26 ordens de serviço — status variados + reincidência + custo (mês e 12m p/ CapEx). */
export function predialDemoWorkOrders(assets: MaintenanceAsset[]): MaintenanceWorkOrder[] {
  const id = (n: string) => { const a = assets.find((x) => x.name.startsWith(n)); return a ? [a.id] : [] }
  const out: MaintenanceWorkOrder[] = []
  // Reincidência na Bomba 01 (4 corretivas em 12m) — puxa criticidade e custo.
  out.push(wo({ title: 'Vazamento na gaxeta — Bomba 01', status: 'concluida', assetIds: id('Bomba de Recalque 01'), priority: 'alta', completedAt: tsISO(-300), scheduledDate: dISO(-302), actualCost: 850 }))
  out.push(wo({ title: 'Troca de rolamento — Bomba 01', status: 'concluida', assetIds: id('Bomba de Recalque 01'), priority: 'alta', completedAt: tsISO(-190), scheduledDate: dISO(-192), actualCost: 1600 }))
  out.push(wo({ title: 'Superaquecimento do motor — Bomba 01', status: 'concluida', assetIds: id('Bomba de Recalque 01'), priority: 'critica', completedAt: tsISO(-70), scheduledDate: dISO(-72), actualCost: 2400 }))
  out.push(wo({ title: 'Ruído anormal — Bomba 01', status: 'em_processo', assetIds: id('Bomba de Recalque 01'), priority: 'alta', scheduledDate: dISO(-1), dueDate: dISO(2), startedAt: tsISO(-1) }))
  // Elevadores
  out.push(wo({ title: 'Nivelamento fora do padrão — Elevador Social A', status: 'pendente', assetIds: id('Elevador Social — Torre A'), priority: 'alta', dueDate: dISO(1) }))
  out.push(wo({ title: 'Revisão mensal — Elevador Social B', status: 'concluida', assetIds: id('Elevador Social — Torre B'), completedAt: tsISO(-12), scheduledDate: dISO(-14), actualCost: 1200, planned: true }))
  out.push(wo({ title: 'Porta não fecha — Elevador de Serviço A', status: 'em_verificacao', assetIds: id('Elevador de Serviço — Torre A'), priority: 'alta', scheduledDate: dISO(-3), startedAt: tsISO(-3), actualCost: 680 }))
  // Gerador
  out.push(wo({ title: 'Falha na partida automática — Gerador', status: 'concluida', assetIds: id('Gerador Diesel 250 kVA'), priority: 'critica', completedAt: tsISO(-6), scheduledDate: dISO(-8), actualCost: 3200 }))
  out.push(wo({ title: 'Troca de filtros e óleo — Gerador', status: 'concluida', assetIds: id('Gerador Diesel 250 kVA'), completedAt: tsISO(-120), scheduledDate: dISO(-122), actualCost: 900, planned: true }))
  // Incêndio
  out.push(wo({ title: 'Ponto de detecção com falha — Central de incêndio', status: 'pendente', assetIds: id('Central de Alarme de Incêndio'), priority: 'critica', dueDate: dISO(0) }))
  out.push(wo({ title: 'Teste de pressão — Bomba de incêndio', status: 'concluida', assetIds: id('Bomba de Incêndio'), completedAt: tsISO(-25), scheduledDate: dISO(-27), actualCost: 500, planned: true }))
  // Diversos deste mês (custo do mês)
  out.push(wo({ title: 'Motor do portão travando', status: 'concluida', assetIds: id('Portão Basculante — Garagem'), completedAt: tsISO(-4), scheduledDate: dISO(-5), actualCost: 780 }))
  out.push(wo({ title: 'Limpeza do filtro — Bomba da piscina', status: 'concluida', assetIds: id('Bomba da Piscina'), completedAt: tsISO(-9), scheduledDate: dISO(-10), actualCost: 260, planned: true }))
  out.push(wo({ title: 'Não gela — Ar-condicionado do salão', status: 'em_processo', assetIds: id('Ar-condicionado — Salão de Festas'), scheduledDate: dISO(-1), dueDate: dISO(3), startedAt: tsISO(-1) }))
  out.push(wo({ title: 'Interfone da unidade 802 sem sinal', status: 'concluida', assetIds: id('Central de Interfonia'), completedAt: tsISO(-2), scheduledDate: dISO(-2), actualCost: 180 }))
  out.push(wo({ title: 'Disjuntor desarmando — QGBT', status: 'pendente', assetIds: id('Quadro Geral — QGBT'), priority: 'alta', dueDate: dISO(2) }))
  out.push(wo({ title: 'Boia do reservatório superior', status: 'pendente', assetIds: id('Reservatório Superior'), dueDate: dISO(5) }))
  out.push(wo({ title: 'Pressurizador com vibração', status: 'cancelada', assetIds: id('Pressurizador de Escada'), scheduledDate: dISO(-15) }))
  // histórico concluído (12m) para CapEx de outros ativos
  out.push(wo({ title: 'Reparo no comando — Elevador Social A', status: 'concluida', assetIds: id('Elevador Social — Torre A'), completedAt: tsISO(-210), scheduledDate: dISO(-212), actualCost: 4200 }))
  out.push(wo({ title: 'Troca de contatora — Elevador Social A', status: 'concluida', assetIds: id('Elevador Social — Torre A'), completedAt: tsISO(-95), scheduledDate: dISO(-97), actualCost: 3100 }))
  out.push(wo({ title: 'Reaperto geral — QGBT', status: 'concluida', assetIds: id('Quadro Geral — QGBT'), completedAt: tsISO(-160), scheduledDate: dISO(-162), actualCost: 600, planned: true }))
  out.push(wo({ title: 'Selo mecânico — Bomba 02', status: 'concluida', assetIds: id('Bomba de Recalque 02'), completedAt: tsISO(-40), scheduledDate: dISO(-42), actualCost: 1100 }))
  out.push(wo({ title: 'Recarga de bateria — Central de incêndio', status: 'concluida', assetIds: id('Central de Alarme de Incêndio'), completedAt: tsISO(-15), scheduledDate: dISO(-16), actualCost: 420, planned: true }))
  return out
}

/** 8 laudos/obrigações em vários status (vencido / a vencer / em dia). */
export function predialDemoLaudos(): Laudo[] {
  seq = 0
  return [
    laudo({ tipo: 'AVCB / CBMDF', validade: dISO(-12), ultimaExecucao: dISO(-365 - 12), periodicidadeMeses: 12, titulo: 'AVCB do condomínio', observacoes: 'VENCIDO — renovação em andamento no CBMDF.' }),
    laudo({ tipo: 'Inspeção de elevadores', validade: dISO(18), ultimaExecucao: dISO(-347), periodicidadeMeses: 12 }),
    laudo({ tipo: "Limpeza de caixa d'água", validade: dISO(35), ultimaExecucao: dISO(-145), periodicidadeMeses: 6 }),
    laudo({ tipo: 'Recarga de extintores', validade: dISO(-3), ultimaExecucao: dISO(-368), periodicidadeMeses: 12, observacoes: 'Vencido há poucos dias.' }),
    laudo({ tipo: 'SPDA (para-raios)', validade: dISO(120), ultimaExecucao: dISO(-245), periodicidadeMeses: 12 }),
    laudo({ tipo: 'Dedetização', validade: dISO(52), ultimaExecucao: dISO(-128), periodicidadeMeses: 6 }),
    laudo({ tipo: 'Gás (NR-13 / rede)', validade: dISO(200), ultimaExecucao: dISO(-165), periodicidadeMeses: 12 }),
    laudo({ tipo: 'Pressurização de escada', validade: dISO(8), ultimaExecucao: dISO(-357), periodicidadeMeses: 12, observacoes: 'A vencer — agendar teste.' }),
  ]
}
