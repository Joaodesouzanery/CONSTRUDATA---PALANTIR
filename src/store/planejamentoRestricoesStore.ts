import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PlanejamentoRestricaoHorizonte = 'longo' | 'medio' | 'curto' | 'semanal'
export type PlanejamentoRestricaoCategoria = 'materiais' | 'projeto_engenharia' | 'mao_de_obra' | 'equipamentos' | 'qualidade' | 'externo' | 'outros'
export type PlanejamentoRestricaoStatus = 'identificada' | 'em_remocao' | 'resolvida'
export type PlanejamentoRestricaoProntidao = 'pronto' | 'risco' | 'bloqueado'

export interface PlanejamentoRestricao {
  id: string
  titulo: string
  descricao: string
  horizonte: PlanejamentoRestricaoHorizonte
  categoria: PlanejamentoRestricaoCategoria
  status: PlanejamentoRestricaoStatus
  responsavel: string
  prazoRemocao: string
  planoRemocao: string
  impactoDias: number
  impactoPpc: number
  impactoCurvaS: number
  atividadeMestreId: string
  lookaheadId: string
  lpsRestrictionId: string
  origem: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string
}

interface PlanejamentoRestricoesState {
  restricoes: PlanejamentoRestricao[]
  addRestricao: (restricao: Omit<PlanejamentoRestricao, 'id' | 'createdAt' | 'updatedAt' | 'resolvedAt'>) => void
  updateRestricao: (id: string, patch: Partial<Omit<PlanejamentoRestricao, 'id' | 'createdAt'>>) => void
  removeRestricao: (id: string) => void
  importFromLps: (input: {
    titulo: string
    descricao: string
    categoria: PlanejamentoRestricaoCategoria
    responsavel: string
    prazoRemocao: string
    planoRemocao: string
    lpsRestrictionId: string
    atividadeMestreId?: string
  }) => void
}

const nowIso = () => new Date().toISOString()
const id = () => `pr-${crypto.randomUUID().slice(0, 8)}`

const restricoesIniciais: PlanejamentoRestricao[] = [
  {
    id: 'pr-mat-001',
    titulo: 'Liberar PEAD DN160 para Morro do Tetéu',
    descricao: 'Material crítico para manter o lookahead de água dentro da janela de seis semanas.',
    horizonte: 'medio',
    categoria: 'materiais',
    status: 'identificada',
    responsavel: 'Suprimentos',
    prazoRemocao: '2026-05-06',
    planoRemocao: 'Confirmar fornecedor, reservar estoque e travar entrega parcial para a frente.',
    impactoDias: 4,
    impactoPpc: -8,
    impactoCurvaS: -1.2,
    atividadeMestreId: '',
    lookaheadId: '',
    lpsRestrictionId: '',
    origem: 'Planejamento por Restrições',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 'pr-qual-001',
    titulo: 'Tratar NC antes da medição e avanço semanal',
    descricao: 'Não conformidade aberta bloqueia aceite da atividade e pode reduzir PPC.',
    horizonte: 'semanal',
    categoria: 'qualidade',
    status: 'em_remocao',
    responsavel: 'Qualidade',
    prazoRemocao: '2026-05-03',
    planoRemocao: 'Encerrar ação corretiva, anexar evidência e liberar o pacote para execução.',
    impactoDias: 2,
    impactoPpc: -5,
    impactoCurvaS: -0.5,
    atividadeMestreId: '',
    lookaheadId: '',
    lpsRestrictionId: '',
    origem: 'Qualidade/LPS',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
]

export function prontidaoRestricao(restricao: Pick<PlanejamentoRestricao, 'status' | 'prazoRemocao'>): PlanejamentoRestricaoProntidao {
  if (restricao.status === 'resolvida') return 'pronto'
  const today = new Date().toISOString().slice(0, 10)
  if (restricao.prazoRemocao && restricao.prazoRemocao < today) return 'bloqueado'
  return restricao.status === 'em_remocao' ? 'risco' : 'bloqueado'
}

export const usePlanejamentoRestricoesStore = create<PlanejamentoRestricoesState>()(
  persist(
    (set, get) => ({
      restricoes: restricoesIniciais,

      addRestricao: (restricao) =>
        set((state) => ({
          restricoes: [...state.restricoes, { ...restricao, id: id(), createdAt: nowIso(), updatedAt: nowIso() }],
        })),

      updateRestricao: (idValue, patch) =>
        set((state) => ({
          restricoes: state.restricoes.map((restricao) => {
            if (restricao.id !== idValue) return restricao
            const nextStatus = patch.status ?? restricao.status
            return {
              ...restricao,
              ...patch,
              updatedAt: nowIso(),
              resolvedAt: nextStatus === 'resolvida' ? restricao.resolvedAt ?? nowIso() : undefined,
            }
          }),
        })),

      removeRestricao: (idValue) => set((state) => ({ restricoes: state.restricoes.filter((restricao) => restricao.id !== idValue) })),

      importFromLps: (input) => {
        const exists = get().restricoes.some((restricao) => restricao.lpsRestrictionId === input.lpsRestrictionId)
        if (exists) return
        set((state) => ({
          restricoes: [
            ...state.restricoes,
            {
              id: id(),
              titulo: input.titulo,
              descricao: input.descricao,
              horizonte: 'medio',
              categoria: input.categoria,
              status: 'identificada',
              responsavel: input.responsavel,
              prazoRemocao: input.prazoRemocao,
              planoRemocao: input.planoRemocao,
              impactoDias: 2,
              impactoPpc: -5,
              impactoCurvaS: -0.7,
              atividadeMestreId: input.atividadeMestreId ?? '',
              lookaheadId: '',
              lpsRestrictionId: input.lpsRestrictionId,
              origem: 'LPS/Lean',
              createdAt: nowIso(),
              updatedAt: nowIso(),
            },
          ],
        }))
      },
    }),
    { name: 'cdata-planejamento-restricoes' },
  ),
)
