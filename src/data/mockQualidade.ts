/**
 * mockQualidade.ts — Dados mock para o módulo Qualidade / FVS.
 *
 * Inclui 3 FVSs de exemplo:
 *  - 1 totalmente conforme
 *  - 1 com não-conformidade aberta (NC)
 *  - 1 reinspeção OK
 */
import type { FVS, FvsItem, FvsItemGroup } from '@/types'
import { FVS_ITEMS_TEMPLATE } from '@/features/qualidade/schemas'

function makeItems(
  conformities: Array<'conforme' | 'nao_conforme' | 'reinspecao_ok' | null>,
  date: string,
): FvsItem[] {
  return FVS_ITEMS_TEMPLATE.map((tpl, i) => ({
    id:          `mock-item-${tpl.number}-${date}-${i}`,
    number:      tpl.number,
    group:       tpl.group as FvsItemGroup,
    description: tpl.description,
    criteria:    defaultCriteria(tpl.number),
    conformity:  conformities[i] ?? null,
    date:        date,
  }))
}

function defaultCriteria(num: number): string {
  switch (num) {
    case 1: return 'Local limpo, seco, sem umidade ou contaminação'
    case 2: return 'Tubos íntegros, sem riscos profundos ou ovalização'
    case 3: return 'Códigos legíveis e rastreáveis ao lote/fabricante'
    case 4: return 'Tubos alinhados conforme tolerância da máquina'
    case 5: return '210 ± 10 °C'
    case 6: return 'Conforme tabela do fabricante (espessura/diâmetro)'
    case 7: return '0,15 N/mm² ± 0,02'
    case 8: return 'Mínimo conforme tabela do fabricante'
    case 9: return 'Cordão uniforme, sem trincas, dobras ou inclusões'
    default: return ''
  }
}

export const MOCK_FVSS: FVS[] = [
  // ── FVS #1 — Totalmente conforme ────────────────────────────────────────────
  {
    id:               'mock-fvs-1',
    number:           1,
    identificationNo: 'FVS-001/2026',
    contractNo:       '00.954/24',
    date:             '2026-04-02',
    items:            makeItems(
      ['conforme', 'conforme', 'conforme', 'conforme', 'conforme', 'conforme', 'conforme', 'conforme', 'conforme'],
      '2026-04-02',
    ),
    problems:         [],
    ncRequired:       false,
    ncNumber:         '',
    responsibleLeader: 'Eng. Carlos Mendes',
    weldTrackingNo:    'SOLDA-PE-2026-001',
    welderSignature:   'João Silva (CPF 123.456.789-00)',
    qualitySignature:  'Eng. Ana Ribeiro (CREA-PE 1234)',
    createdAt:         '2026-04-02T10:00:00.000Z',
    updatedAt:         '2026-04-02T10:00:00.000Z',
  },

  // ── FVS #2 — Não conformidade aberta ────────────────────────────────────────
  {
    id:               'mock-fvs-2',
    number:           2,
    identificationNo: 'FVS-002/2026',
    contractNo:       '00.954/24',
    date:             '2026-04-04',
    items:            makeItems(
      ['conforme', 'conforme', 'conforme', 'conforme', 'nao_conforme', 'conforme', 'nao_conforme', 'conforme', 'conforme'],
      '2026-04-04',
    ),
    problems: [
      {
        id:          'mock-prob-2-1',
        itemNumber:  5,
        description: 'Temperatura da placa registrada em 188 °C — fora do range 200–220 °C',
        action:      'Reaquecer placa, calibrar termopar e refazer ensaio antes de prosseguir',
      },
      {
        id:          'mock-prob-2-2',
        itemNumber:  7,
        description: 'Pressão de fusão oscilando entre 0,10 e 0,12 N/mm²',
        action:      'Verificar manômetro e bomba hidráulica da máquina; substituir vedação',
      },
    ],
    ncRequired:        true,
    ncNumber:          'NC-2026-007',
    responsibleLeader: 'Eng. Roberto Lima',
    weldTrackingNo:    'SOLDA-PE-2026-014',
    welderSignature:   'Marcos Pereira (CPF 987.654.321-00)',
    qualitySignature:  'Eng. Ana Ribeiro (CREA-PE 1234)',
    createdAt:         '2026-04-04T14:30:00.000Z',
    updatedAt:         '2026-04-04T14:30:00.000Z',
  },

  // ── FVS #3 — Conforme após reinspeção ───────────────────────────────────────
  {
    id:               'mock-fvs-3',
    number:           3,
    identificationNo: 'FVS-003/2026',
    contractNo:       '00.954/24',
    date:             '2026-04-05',
    items:            makeItems(
      ['conforme', 'conforme', 'conforme', 'reinspecao_ok', 'conforme', 'conforme', 'conforme', 'conforme', 'reinspecao_ok'],
      '2026-04-05',
    ),
    problems: [
      {
        id:          'mock-prob-3-1',
        itemNumber:  4,
        description: 'Desalinhamento inicial de 3mm entre tubos',
        action:      'Reposicionados na máquina, novo alinhamento OK conforme tolerância',
      },
    ],
    ncRequired:        false,
    ncNumber:          '',
    responsibleLeader: 'Eng. Carlos Mendes',
    weldTrackingNo:    'SOLDA-PE-2026-022',
    welderSignature:   'João Silva (CPF 123.456.789-00)',
    qualitySignature:  'Eng. Ana Ribeiro (CREA-PE 1234)',
    createdAt:         '2026-04-05T09:15:00.000Z',
    updatedAt:         '2026-04-05T11:45:00.000Z',
  },
]
