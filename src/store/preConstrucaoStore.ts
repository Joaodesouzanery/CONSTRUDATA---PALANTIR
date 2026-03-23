import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  PipelineStep, TakeoffItem, CostMatch, ContractClause,
  BDIConfig, AnalysisSession, SinapiEntry,
} from '@/types'

interface PreConstrucaoState {
  // Pipeline
  currentStep:   PipelineStep
  uploadedFiles: UploadedFile[]

  // Extraction results
  takeoffItems:  TakeoffItem[]
  clauses:       ContractClause[]

  // Matching
  costMatches:   CostMatch[]
  customBase:    SinapiEntry[]

  // BDI
  bdiConfig: BDIConfig

  // History
  sessions:      AnalysisSession[]

  // Actions — pipeline
  setStep:        (step: PipelineStep)   => void
  addFiles:       (files: UploadedFile[]) => void
  removeFile:     (name: string)          => void
  clearFiles:     ()                      => void

  // Actions — extraction
  setTakeoffItems: (items: TakeoffItem[])     => void
  setClauses:      (clauses: ContractClause[]) => void
  acceptNormalization: (itemId: string) => void
  rejectNormalization: (itemId: string) => void

  // Actions — matching
  setCostMatches:   (matches: CostMatch[])   => void
  toggleMatch:      (takeoffItemId: string, code: string, source: string) => void
  overridePrice:    (takeoffItemId: string, code: string, source: string, price: number) => void

  // Actions — custom base
  addCustomEntry:    (entry: Omit<SinapiEntry, 'referenceDate' | 'state'>) => void
  removeCustomEntry: (code: string) => void

  // Actions — BDI
  setBDI: (config: Partial<BDIConfig>) => void

  // Actions — sessions
  saveSession: (fileNames: string[], totalItems: number, totalCost: number) => void
  resetPipeline: () => void
}

export interface UploadedFile {
  name:    string
  size:    number
  type:    string    // MIME type
  ext:     string    // 'pdf' | 'ifc' | 'dwg' | 'rvt' | 'xlsx' | 'docx'
  fileRef: File
}

const DEFAULT_BDI: BDIConfig = {
  adminCentral: 4.0,
  iss:          3.0,
  pisCofins:    3.65,
  seguro:       0.8,
  lucro:        7.5,
}

export const usePreConstrucaoStore = create<PreConstrucaoState>((set) => ({
  currentStep:   'upload',
  uploadedFiles: [],
  takeoffItems:  [],
  clauses:       [],
  costMatches:   [],
  customBase:    [],
  bdiConfig:     DEFAULT_BDI,
  sessions:      [],

  setStep: (step) => set({ currentStep: step }),

  addFiles: (files) =>
    set((s) => ({
      uploadedFiles: [
        ...s.uploadedFiles,
        ...files.filter((f) => !s.uploadedFiles.some((e) => e.name === f.name)),
      ],
    })),

  removeFile: (name) =>
    set((s) => ({ uploadedFiles: s.uploadedFiles.filter((f) => f.name !== name) })),

  clearFiles: () => set({ uploadedFiles: [] }),

  setTakeoffItems: (items) => set({ takeoffItems: items }),

  setClauses: (clauses) => set({ clauses }),

  acceptNormalization: (itemId) =>
    set((s) => ({
      takeoffItems: s.takeoffItems.map((item) => {
        if (item.id !== itemId || !item.normalized) return item
        return {
          ...item,
          description: item.normalizedDescription ?? item.description,
          quantity:    item.normalizedQuantity    ?? item.quantity,
          unit:        item.normalizedUnit        ?? item.unit,
          normalized:  false,
        }
      }),
    })),

  rejectNormalization: (itemId) =>
    set((s) => ({
      takeoffItems: s.takeoffItems.map((item) =>
        item.id === itemId ? { ...item, normalized: false } : item
      ),
    })),

  setCostMatches: (matches) => set({ costMatches: matches }),

  toggleMatch: (takeoffItemId, code, source) =>
    set((s) => ({
      costMatches: s.costMatches.map((m) =>
        m.takeoffItemId === takeoffItemId
          ? { ...m, selected: m.code === code && m.source === source ? !m.selected : false }
          : m
      ),
    })),

  overridePrice: (takeoffItemId, code, source, price) =>
    set((s) => ({
      costMatches: s.costMatches.map((m) =>
        m.takeoffItemId === takeoffItemId && m.code === code && m.source === source
          ? { ...m, overrideUnitCost: price }
          : m
      ),
    })),

  addCustomEntry: (entry) =>
    set((s) => ({
      customBase: [
        ...s.customBase,
        { ...entry, referenceDate: new Date().toISOString().slice(0, 7), state: 'SP' },
      ],
    })),

  removeCustomEntry: (code) =>
    set((s) => ({ customBase: s.customBase.filter((e) => e.code !== code) })),

  setBDI: (config) =>
    set((s) => ({ bdiConfig: { ...s.bdiConfig, ...config } })),

  saveSession: (fileNames, totalItems, totalCost) =>
    set((s) => ({
      sessions: [
        {
          id: nanoid(),
          createdAt: new Date().toISOString(),
          fileNames,
          totalItems,
          totalCost,
          status: 'proposal' as PipelineStep,
        },
        ...s.sessions,
      ],
    })),

  resetPipeline: () =>
    set({
      currentStep:   'upload',
      uploadedFiles: [],
      takeoffItems:  [],
      clauses:       [],
      costMatches:   [],
    }),
}))

// ─── BDI calculation helper ───────────────────────────────────────────────────

export function calcBDI(config: BDIConfig): number {
  const sum = config.adminCentral + config.iss + config.pisCofins + config.seguro + config.lucro
  return parseFloat((sum).toFixed(2))
}
