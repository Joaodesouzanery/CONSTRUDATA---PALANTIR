/**
 * mockPlanejamentoMestre.ts — Mock data for Planejamento Mestre module.
 */
import type { MasterActivity, MasterBaseline, LookaheadDerivedActivity } from '@/types'

export const MOCK_MASTER_ACTIVITIES: MasterActivity[] = [
  // Level 0 — Phases
  { id: 'ma-01', wbsCode: '1', name: 'Mobilização e Canteiro', parentId: null, level: 0, plannedStart: '2026-04-01', plannedEnd: '2026-04-18', trendStart: '2026-04-01', trendEnd: '2026-04-20', durationDays: 14, percentComplete: 100, status: 'completed', isMilestone: false, weight: 5 },
  { id: 'ma-02', wbsCode: '2', name: 'Movimento de Terra', parentId: null, level: 0, plannedStart: '2026-04-21', plannedEnd: '2026-06-13', trendStart: '2026-04-21', trendEnd: '2026-06-20', durationDays: 40, percentComplete: 65, status: 'in_progress', isMilestone: false, weight: 25 },
  { id: 'ma-03', wbsCode: '3', name: 'Instalação de Tubulação', parentId: null, level: 0, plannedStart: '2026-05-18', plannedEnd: '2026-08-07', trendStart: '2026-05-25', trendEnd: '2026-08-14', durationDays: 60, percentComplete: 30, status: 'in_progress', isMilestone: false, weight: 35 },
  { id: 'ma-04', wbsCode: '4', name: 'Testes e Comissionamento', parentId: null, level: 0, plannedStart: '2026-08-10', plannedEnd: '2026-09-04', trendStart: '2026-08-17', trendEnd: '2026-09-12', durationDays: 20, percentComplete: 0, status: 'not_started', isMilestone: false, weight: 20 },
  { id: 'ma-05', wbsCode: '5', name: 'Desmobilização e Entrega', parentId: null, level: 0, plannedStart: '2026-09-07', plannedEnd: '2026-09-25', trendStart: '2026-09-15', trendEnd: '2026-10-03', durationDays: 15, percentComplete: 0, status: 'not_started', isMilestone: false, weight: 15 },

  // Level 1 — Deliverables
  { id: 'ma-11', wbsCode: '1.1', name: 'Implantação do canteiro', parentId: 'ma-01', level: 1, plannedStart: '2026-04-01', plannedEnd: '2026-04-10', trendStart: '2026-04-01', trendEnd: '2026-04-10', durationDays: 8, percentComplete: 100, status: 'completed', isMilestone: false, weight: 3 },
  { id: 'ma-12', wbsCode: '1.2', name: 'Sinalização e tapumes', parentId: 'ma-01', level: 1, plannedStart: '2026-04-11', plannedEnd: '2026-04-18', trendStart: '2026-04-11', trendEnd: '2026-04-20', durationDays: 6, percentComplete: 100, status: 'completed', isMilestone: false, weight: 2 },
  { id: 'ma-13', wbsCode: '1.3', name: 'Milestone: Canteiro pronto', parentId: 'ma-01', level: 1, plannedStart: '2026-04-18', plannedEnd: '2026-04-18', trendStart: '2026-04-20', trendEnd: '2026-04-20', durationDays: 0, percentComplete: 100, status: 'completed', isMilestone: true, weight: 0 },

  { id: 'ma-21', wbsCode: '2.1', name: 'Escavação mecânica', parentId: 'ma-02', level: 1, plannedStart: '2026-04-21', plannedEnd: '2026-05-23', trendStart: '2026-04-21', trendEnd: '2026-05-30', durationDays: 25, percentComplete: 80, status: 'in_progress', isMilestone: false, responsibleTeam: 'Equipe A', weight: 15 },
  { id: 'ma-22', wbsCode: '2.2', name: 'Escoramento de valas', parentId: 'ma-02', level: 1, plannedStart: '2026-05-05', plannedEnd: '2026-06-06', trendStart: '2026-05-05', trendEnd: '2026-06-13', durationDays: 25, percentComplete: 50, status: 'in_progress', isMilestone: false, responsibleTeam: 'Equipe B', weight: 8 },
  { id: 'ma-23', wbsCode: '2.3', name: 'Reaterro e compactação', parentId: 'ma-02', level: 1, plannedStart: '2026-05-26', plannedEnd: '2026-06-13', trendStart: '2026-06-02', trendEnd: '2026-06-20', durationDays: 15, percentComplete: 20, status: 'in_progress', isMilestone: false, responsibleTeam: 'Equipe A', weight: 7, linkedTrechoCodes: ['T01', 'T02', 'T03'] },

  { id: 'ma-31', wbsCode: '3.1', name: 'Assentamento — Trecho Norte', parentId: 'ma-03', level: 1, plannedStart: '2026-05-18', plannedEnd: '2026-06-19', trendStart: '2026-05-25', trendEnd: '2026-06-27', durationDays: 25, percentComplete: 50, status: 'in_progress', isMilestone: false, responsibleTeam: 'Equipe A', weight: 12, linkedTrechoCodes: ['T01', 'T02', 'T03', 'T04'] },
  { id: 'ma-32', wbsCode: '3.2', name: 'Assentamento — Trecho Sul', parentId: 'ma-03', level: 1, plannedStart: '2026-06-22', plannedEnd: '2026-07-24', trendStart: '2026-06-30', trendEnd: '2026-08-01', durationDays: 25, percentComplete: 10, status: 'in_progress', isMilestone: false, responsibleTeam: 'Equipe B', weight: 12, linkedTrechoCodes: ['T05', 'T06', 'T07', 'T08'] },
  { id: 'ma-33', wbsCode: '3.3', name: 'Conexões e registros', parentId: 'ma-03', level: 1, plannedStart: '2026-07-27', plannedEnd: '2026-08-07', trendStart: '2026-08-04', trendEnd: '2026-08-14', durationDays: 10, percentComplete: 0, status: 'not_started', isMilestone: false, weight: 6 },
  { id: 'ma-34', wbsCode: '3.4', name: 'Milestone: Tubulação completa', parentId: 'ma-03', level: 1, plannedStart: '2026-08-07', plannedEnd: '2026-08-07', trendStart: '2026-08-14', trendEnd: '2026-08-14', durationDays: 0, percentComplete: 0, status: 'not_started', isMilestone: true, weight: 0 },

  { id: 'ma-41', wbsCode: '4.1', name: 'Teste hidrostático', parentId: 'ma-04', level: 1, plannedStart: '2026-08-10', plannedEnd: '2026-08-21', trendStart: '2026-08-17', trendEnd: '2026-08-28', durationDays: 10, percentComplete: 0, status: 'not_started', isMilestone: false, weight: 10 },
  { id: 'ma-42', wbsCode: '4.2', name: 'Comissionamento e entrega', parentId: 'ma-04', level: 1, plannedStart: '2026-08-24', plannedEnd: '2026-09-04', trendStart: '2026-08-31', trendEnd: '2026-09-12', durationDays: 10, percentComplete: 0, status: 'not_started', isMilestone: false, weight: 8 },
  { id: 'ma-43', wbsCode: '4.3', name: 'Milestone: Obra aceita', parentId: 'ma-04', level: 1, plannedStart: '2026-09-04', plannedEnd: '2026-09-04', trendStart: '2026-09-12', trendEnd: '2026-09-12', durationDays: 0, percentComplete: 0, status: 'not_started', isMilestone: true, weight: 0 },

  { id: 'ma-51', wbsCode: '5.1', name: 'Remoção do canteiro', parentId: 'ma-05', level: 1, plannedStart: '2026-09-07', plannedEnd: '2026-09-18', trendStart: '2026-09-15', trendEnd: '2026-09-26', durationDays: 10, percentComplete: 0, status: 'not_started', isMilestone: false, weight: 8 },
  { id: 'ma-52', wbsCode: '5.2', name: 'Pavimentação definitiva', parentId: 'ma-05', level: 1, plannedStart: '2026-09-14', plannedEnd: '2026-09-25', trendStart: '2026-09-22', trendEnd: '2026-10-03', durationDays: 10, percentComplete: 0, status: 'not_started', isMilestone: false, weight: 7 },
]

export const MOCK_MASTER_BASELINE: MasterBaseline = {
  id: 'bl-01',
  name: 'Baseline Rev.0',
  createdAt: '2026-03-15T10:00:00Z',
  activities: structuredClone(MOCK_MASTER_ACTIVITIES),
}

export const MOCK_DERIVED_ACTIVITIES: LookaheadDerivedActivity[] = [
  { id: 'da-01', masterActivityId: 'ma-21', weekIso: '2026-W14', name: 'Escavação — Setor A (conclusão)', responsible: 'Equipe A', status: 'completed' },
  { id: 'da-02', masterActivityId: 'ma-22', weekIso: '2026-W14', name: 'Escoramento — Trecho T03', responsible: 'Equipe B', status: 'ready' },
  { id: 'da-03', masterActivityId: 'ma-23', weekIso: '2026-W15', name: 'Reaterro — Trecho T01', responsible: 'Equipe A', status: 'planned' },
  { id: 'da-04', masterActivityId: 'ma-31', weekIso: '2026-W15', name: 'Assentamento DN300 — T02', responsible: 'Equipe A', status: 'ready' },
  { id: 'da-05', masterActivityId: 'ma-22', weekIso: '2026-W16', name: 'Escoramento — Trecho T04', responsible: 'Equipe B', status: 'blocked', linkedRestrictionIds: ['rest-mat-01'] },
  { id: 'da-06', masterActivityId: 'ma-31', weekIso: '2026-W16', name: 'Assentamento DN300 — T03', responsible: 'Equipe A', status: 'planned' },
  { id: 'da-07', masterActivityId: 'ma-23', weekIso: '2026-W17', name: 'Reaterro — Trecho T02', responsible: 'Equipe A', status: 'planned' },
  { id: 'da-08', masterActivityId: 'ma-32', weekIso: '2026-W17', name: 'Assentamento DN200 — T05 (início)', responsible: 'Equipe B', status: 'planned' },
  { id: 'da-09', masterActivityId: 'ma-31', weekIso: '2026-W18', name: 'Assentamento DN300 — T04', responsible: 'Equipe A', status: 'planned' },
  { id: 'da-10', masterActivityId: 'ma-32', weekIso: '2026-W19', name: 'Assentamento DN200 — T06', responsible: 'Equipe B', status: 'planned' },
]
