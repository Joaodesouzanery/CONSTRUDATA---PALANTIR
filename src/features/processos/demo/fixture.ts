import rawFixture from './processos-demo.json' with { type: 'json' }
import type {
  DefinicaoProcesso,
  EventoProcesso,
  ObjetoJson,
  ResultadoDescoberta,
  ResumoCasoProcesso,
} from '../core/index.ts'

export interface CasoDemoProcessos {
  key: string
  label: string
  summary: ResumoCasoProcesso
  events: EventoProcesso[]
}

export interface ArtefatoDemoProcessos {
  schemaVersion: 1
  sourceDatasetChecksum: string
  sourceDatasetCaseCount: number
  sourceDatasetEventCount: number
  definition: DefinicaoProcesso
  parameters: ObjetoJson
  result: ResultadoDescoberta
  cases: CasoDemoProcessos[]
  artifactChecksum: string
}

export const DEMO_PROCESSOS = rawFixture as unknown as ArtefatoDemoProcessos
