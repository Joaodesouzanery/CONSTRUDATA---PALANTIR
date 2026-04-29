import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type MedicaoAssistidaStatus = 'rascunho' | 'em_conferencia' | 'finalizada'
export type MedicaoAssistidaParceiroTipo = 'subempreiteiro' | 'fornecedor'
export type MedicaoAssistidaDivergenciaStatus = 'pendente' | 'resolvida'

export interface MedicaoAssistida {
  id: string
  nome?: string
  periodo: string
  contrato: string
  obra: string
  responsavel: string
  origem: string
  status: MedicaoAssistidaStatus
  createdAt: string
  updatedAt: string
}

export interface MedicaoAssistidaCriterio {
  id: string
  nome: string
  regra: string
  unidade: string
  evidenciaObrigatoria: string
  condicaoAceite: string
}

export interface MedicaoAssistidaItem {
  id: string
  medicaoId: string
  codigo: string
  descricao: string
  unidade: string
  qtdContrato: number
  qtdAnterior: number
  qtdPeriodo: number
  precoUnitario: number
  criterioId: string
  fornecedor: string
  subempreiteiro: string
  evidencia: string
  origem: string
  vinculoSabesp?: string
  vinculoRdo?: string
  vinculoLps?: string
}

export interface MedicaoAssistidaParceiro {
  id: string
  medicaoId: string
  tipo: MedicaoAssistidaParceiroTipo
  nome: string
  itemCodigo: string
  valorMedido: number
  valorAprovado: number
  retencao: number
  nf: string
  status: 'pendente' | 'aprovado' | 'glosado'
}

export interface MedicaoAssistidaDivergenciaResolvida {
  id: string
  medicaoId: string
  divergenciaKey: string
  observacao: string
  resolvedAt: string
}

interface MedicaoAssistidaState {
  medicoes: MedicaoAssistida[]
  activeMedicaoId: string | null
  criterios: MedicaoAssistidaCriterio[]
  itens: MedicaoAssistidaItem[]
  parceiros: MedicaoAssistidaParceiro[]
  divergenciasResolvidas: MedicaoAssistidaDivergenciaResolvida[]

  createMedicao: (input: Omit<MedicaoAssistida, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => string
  setActiveMedicao: (id: string) => void
  updateMedicao: (id: string, patch: Partial<Omit<MedicaoAssistida, 'id' | 'createdAt'>>) => void
  removeMedicao: (id: string) => void

  addCriterio: (criterio: Omit<MedicaoAssistidaCriterio, 'id'>) => void
  updateCriterio: (id: string, patch: Partial<Omit<MedicaoAssistidaCriterio, 'id'>>) => void
  removeCriterio: (id: string) => void

  addItem: (item: Omit<MedicaoAssistidaItem, 'id'>) => void
  updateItem: (id: string, patch: Partial<Omit<MedicaoAssistidaItem, 'id' | 'medicaoId'>>) => void
  removeItem: (id: string) => void

  addParceiro: (parceiro: Omit<MedicaoAssistidaParceiro, 'id'>) => void
  updateParceiro: (id: string, patch: Partial<Omit<MedicaoAssistidaParceiro, 'id' | 'medicaoId'>>) => void
  removeParceiro: (id: string) => void

  resolveDivergencia: (medicaoId: string, divergenciaKey: string, observacao?: string) => void
  reopenDivergencia: (medicaoId: string, divergenciaKey: string) => void
}

const nowIso = () => new Date().toISOString()
const id = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

const criteriosIniciais: MedicaoAssistidaCriterio[] = [
  {
    id: 'crit-metro-executado',
    nome: 'Metro executado e aprovado',
    regra: 'Mede pela quantidade executada no período, limitada ao saldo contratual e vinculada a RDO ou trecho aprovado.',
    unidade: 'm',
    evidenciaObrigatoria: 'RDO, trecho executado e foto georreferenciada',
    condicaoAceite: 'Sem não conformidade aberta e com recomposição/qualidade liberada quando aplicável.',
  },
  {
    id: 'crit-unidade-instalada',
    nome: 'Unidade instalada',
    regra: 'Mede por unidade concluída, testada e liberada pela fiscalização.',
    unidade: 'un',
    evidenciaObrigatoria: 'Foto, checklist/FVS e identificação do local',
    condicaoAceite: 'Item instalado, conferido e sem pendência de material ou qualidade.',
  },
  {
    id: 'crit-fornecedor-nf',
    nome: 'Fornecedor com NF conferida',
    regra: 'Mede o valor aprovado do fornecedor depois da conciliação entre pedido, recebimento e nota fiscal.',
    unidade: 'R$',
    evidenciaObrigatoria: 'Pedido, recebimento e NF',
    condicaoAceite: 'Sem divergência aberta entre valor medido e valor aprovado.',
  },
]

export const useMedicaoAssistidaStore = create<MedicaoAssistidaState>()(
  persist(
    (set, get) => ({
      medicoes: [],
      activeMedicaoId: null,
      criterios: criteriosIniciais,
      itens: [],
      parceiros: [],
      divergenciasResolvidas: [],

      createMedicao: (input) => {
        const medicao: MedicaoAssistida = {
          ...input,
          id: id('ma'),
          status: 'rascunho',
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }
        set((state) => ({ medicoes: [...state.medicoes, medicao], activeMedicaoId: medicao.id }))
        return medicao.id
      },

      setActiveMedicao: (activeMedicaoId) => set({ activeMedicaoId }),

      updateMedicao: (idValue, patch) =>
        set((state) => ({
          medicoes: state.medicoes.map((medicao) =>
            medicao.id === idValue ? { ...medicao, ...patch, updatedAt: nowIso() } : medicao,
          ),
        })),

      removeMedicao: (idValue) =>
        set((state) => ({
          medicoes: state.medicoes.filter((medicao) => medicao.id !== idValue),
          itens: state.itens.filter((item) => item.medicaoId !== idValue),
          parceiros: state.parceiros.filter((parceiro) => parceiro.medicaoId !== idValue),
          divergenciasResolvidas: state.divergenciasResolvidas.filter((divergencia) => divergencia.medicaoId !== idValue),
          activeMedicaoId: state.activeMedicaoId === idValue ? state.medicoes.find((medicao) => medicao.id !== idValue)?.id ?? null : state.activeMedicaoId,
        })),

      addCriterio: (criterio) => set((state) => ({ criterios: [...state.criterios, { ...criterio, id: id('crit') }] })),
      updateCriterio: (idValue, patch) =>
        set((state) => ({ criterios: state.criterios.map((criterio) => criterio.id === idValue ? { ...criterio, ...patch } : criterio) })),
      removeCriterio: (idValue) =>
        set((state) => ({
          criterios: state.criterios.filter((criterio) => criterio.id !== idValue),
          itens: state.itens.map((item) => item.criterioId === idValue ? { ...item, criterioId: '' } : item),
        })),

      addItem: (item) => set((state) => ({ itens: [...state.itens, { ...item, id: id('mai') }] })),
      updateItem: (idValue, patch) =>
        set((state) => ({ itens: state.itens.map((item) => item.id === idValue ? { ...item, ...patch } : item) })),
      removeItem: (idValue) => set((state) => ({ itens: state.itens.filter((item) => item.id !== idValue) })),

      addParceiro: (parceiro) => set((state) => ({ parceiros: [...state.parceiros, { ...parceiro, id: id('map') }] })),
      updateParceiro: (idValue, patch) =>
        set((state) => ({ parceiros: state.parceiros.map((parceiro) => parceiro.id === idValue ? { ...parceiro, ...patch } : parceiro) })),
      removeParceiro: (idValue) => set((state) => ({ parceiros: state.parceiros.filter((parceiro) => parceiro.id !== idValue) })),

      resolveDivergencia: (medicaoId, divergenciaKey, observacao = '') => {
        const exists = get().divergenciasResolvidas.some((divergencia) => divergencia.medicaoId === medicaoId && divergencia.divergenciaKey === divergenciaKey)
        if (exists) return
        set((state) => ({
          divergenciasResolvidas: [
            ...state.divergenciasResolvidas,
            { id: id('mad'), medicaoId, divergenciaKey, observacao, resolvedAt: nowIso() },
          ],
        }))
      },

      reopenDivergencia: (medicaoId, divergenciaKey) =>
        set((state) => ({
          divergenciasResolvidas: state.divergenciasResolvidas.filter((divergencia) => !(divergencia.medicaoId === medicaoId && divergencia.divergenciaKey === divergenciaKey)),
        })),
    }),
    { name: 'cdata-medicao-assistida' },
  ),
)
