/**
 * consolidadoImport.ts — ImportConfig for the Consolidado v3 spreadsheet.
 *
 * Expected XLSX columns (matching the CONSOLIDADO_v3 format):
 *   Núcleo | Tipo | Rua | NS | PV Mont | PV Jus | DN(mm) | Ext(m) | Mat | CT Mont | CT Jus | Decl‰ | STATUS | Data Exec | Network | Layer | Análise
 */
import { z } from 'zod'
import type { ImportConfig } from '@/lib/importEngine'

export interface ConsolidadoImportRow extends Record<string, unknown> {
  nucleo:       string
  tipo:         string
  rua:          string
  ns:           string
  pvMont:       string
  pvJus:        string
  dnMm:         number
  extM:         number
  material:     string
  ctMont:       number
  ctJus:        number
  declPerMil:   number
  status:       string
  dataExec:     string
  networkLayer: string
  analise:      string
}

const consolidadoSchema = z.object({
  nucleo:       z.string().min(1, 'Núcleo obrigatório'),
  tipo:         z.string().min(1, 'Tipo obrigatório'),
  rua:          z.string().default('Sem Rua'),
  ns:           z.string().default(''),
  pvMont:       z.string().default(''),
  pvJus:        z.string().default(''),
  dnMm:         z.number().default(0),
  extM:         z.number().min(0, 'Extensão deve ser >= 0'),
  material:     z.string().default('PVC'),
  ctMont:       z.number().default(0),
  ctJus:        z.number().default(0),
  declPerMil:   z.number().default(0),
  status:       z.string().min(1, 'Status obrigatório'),
  dataExec:     z.string().default(''),
  networkLayer: z.string().default(''),
  analise:      z.string().default(''),
})

export const consolidadoImportConfig: ImportConfig<ConsolidadoImportRow> = {
  schema: consolidadoSchema,
  columns: [
    { key: 'nucleo', headerAliases: ['núcleo', 'nucleo', 'nucleus', 'frente'], required: true },
    { key: 'tipo', headerAliases: ['tipo', 'type', 'rede'], required: true },
    { key: 'rua', headerAliases: ['rua', 'logradouro', 'street', 'via'], defaultValue: 'Sem Rua' as never },
    { key: 'ns', headerAliases: ['ns', 'n.s.', 'trecho', 'segment'], defaultValue: '' as never },
    { key: 'pvMont', headerAliases: ['pv mont', 'pv montante', 'pv_mont', 'montante'], defaultValue: '' as never },
    { key: 'pvJus', headerAliases: ['pv jus', 'pv jusante', 'pv_jus', 'jusante'], defaultValue: '' as never },
    { key: 'dnMm', headerAliases: ['dn(mm)', 'dn', 'diâmetro', 'diametro', 'dn mm'], type: 'number', defaultValue: 0 as never },
    { key: 'extM', headerAliases: ['ext(m)', 'ext', 'extensão', 'extensao', 'comprimento', 'ext m'], type: 'number', required: true },
    { key: 'material', headerAliases: ['mat', 'material', 'tipo tubo'], defaultValue: 'PVC' as never },
    { key: 'ctMont', headerAliases: ['ct mont', 'ct montante', 'cota mont'], type: 'number', defaultValue: 0 as never },
    { key: 'ctJus', headerAliases: ['ct jus', 'ct jusante', 'cota jus'], type: 'number', defaultValue: 0 as never },
    { key: 'declPerMil', headerAliases: ['decl‰', 'decl', 'declividade', 'i‰', 'i (‰)'], type: 'number', defaultValue: 0 as never },
    { key: 'status', headerAliases: ['status', 'situação', 'situacao', 'estado'], required: true },
    { key: 'dataExec', headerAliases: ['data exec', 'data execução', 'data execucao', 'data', 'date'], defaultValue: '' as never },
    { key: 'networkLayer', headerAliases: ['network', 'layer', 'rede layer'], defaultValue: '' as never },
    { key: 'analise', headerAliases: ['análise', 'analise', 'motivo cadastro', 'obs'], defaultValue: '' as never },
  ],
  exampleHeaders: ['Núcleo', 'Tipo', 'Rua', 'NS', 'PV Mont', 'PV Jus', 'DN(mm)', 'Ext(m)', 'Mat', 'CT Mont', 'CT Jus', 'Decl‰', 'STATUS', 'Data Exec'],
  exampleRow: {
    'Núcleo': 'Joao Carlos',
    'Tipo': 'ESGOTO',
    'Rua': 'BECO 10',
    'NS': 'NS-0001',
    'PV Mont': 'PV-1136 (1)',
    'PV Jus': 'PV-1126 (1)',
    'DN(mm)': 150,
    'Ext(m)': 43.97,
    'Mat': 'PVC',
    'STATUS': 'PENDENTE',
    'Data Exec': '',
  },
}
