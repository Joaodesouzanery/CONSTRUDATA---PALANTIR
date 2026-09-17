/**
 * sabespStore — o Operacional com chão: `persist` + fila de sincronização.
 *
 * ─── O QUE MUDOU, E POR QUE ERA GRAVE ─────────────────────────────────────────
 * Este era o ÚNICO store de dado do projeto sem `persist` e sem `pendingSync` — conferi os 43.
 * Ele guardava o workbook inteiro em memória e empurrava um blob para `app_state`. Na prática:
 * importar a planilha, apertar F5, e a tela voltava vazia. Offline, o módulo abria sem nada. E na
 * troca de empresa nada era zerado, porque o store não estava em `resetTenantScopedRuntimeStores`.
 *
 * Agora é linha, não blob (`operacional_linhas`, migração `20260917120000`), com o mesmo desenho
 * dos outros 42 stores: escrita otimista + op na fila + `mergePull` no pull.
 *
 * ⚠️ `origem` ('planilha' | 'sistema') é o campo que sustenta o pedido do cliente: dá para editar
 * no sistema, e quando a planilha chega ela manda — mas a tela mostra ANTES o que vai sobrescrever.
 * Ver `conferenciaOperacional.ts`.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { flushQueue, makeFlushSerializer, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { useAuth } from '@/lib/auth'
import { podeEscreverTorre } from '@/lib/roles'
import { seededId } from '@/lib/seededId'
import { getTenantMarker } from '@/lib/tenantCache'
import type { ColunaLida, ParametroDeConfiguracao } from './leitorPlanilha'

// ─── As abas ──────────────────────────────────────────────────────────────────

export type SabespSheetId =
  | 'configuracoes' | 'banco_custos' | 'carteira_ticket' | 'tabela_precos' | 'cadastro_servicos'
  | 'programacao' | 'ordens_servico' | 'apontamento' | 'materiais' | 'equipe' | 'medicao'
  | 'diario_obra' | 'ocorrencias' | 'faturamento' | 'resumo' | 'dashboard' | 'atas'
  | 'lookahead' | 'plano_semanal' | 'planejado_realizado'

export interface SabespSheetDefinition {
  id: SabespSheetId
  sheetName: string
  label: string
  keyColumns: string[]
  /**
   * Aba DERIVADA: na planilha ela é fórmula. Não se edita aqui — editar seria discordar da fonte.
   */
  readonly?: boolean
  /** Agrupamento da barra de abas. 20 pílulas numa tira só era o principal problema de uso. */
  grupo: 'Cadastros' | 'Execução' | 'Medição' | 'Gestão'
}

export const SABESP_SHEETS: SabespSheetDefinition[] = [
  { id: 'configuracoes',       sheetName: '01. CONFIGURAÇÕES',        label: 'Configurações',        grupo: 'Cadastros', keyColumns: ['Empresa executante'] },
  { id: 'banco_custos',        sheetName: '01A. BANCO DE CUSTOS',     label: 'Banco de Custos',      grupo: 'Cadastros', keyColumns: ['ITEM', 'CUSTO MENSAL'] },
  { id: 'carteira_ticket',     sheetName: '01B. CARTEIRA E TICKET',   label: 'Carteira e Ticket',    grupo: 'Cadastros', keyColumns: ['TIPO DE SERVIÇO', 'CONTRATO'] },
  { id: 'tabela_precos',       sheetName: '02. TABELA DE PREÇOS',     label: 'Tabela de Preços',     grupo: 'Cadastros', keyColumns: ['CHAVE'], readonly: true },
  { id: 'cadastro_servicos',   sheetName: '03. CADASTRO DE SERVIÇOS', label: 'Cadastro de Serviços', grupo: 'Cadastros', keyColumns: ['ID', 'CONTRATO'] },
  { id: 'equipe',              sheetName: '08. EQUIPE',               label: 'Equipe',               grupo: 'Cadastros', keyColumns: ['MATRÍCULA', 'CONTRATO'] },

  { id: 'programacao',         sheetName: '04. PROGRAMAÇÃO DIÁRIA',   label: 'Programação Diária',   grupo: 'Execução', keyColumns: ['DATA', 'CONTRATO', 'EQUIPE', 'ID DO SERVIÇO'] },
  { id: 'ordens_servico',      sheetName: '05. ORDENS DE SERVIÇO',    label: 'Ordens de Serviço',    grupo: 'Execução', keyColumns: ['ID DO SERVIÇO', 'CONTRATO', 'Nº OS SABESP'] },
  { id: 'apontamento',         sheetName: '06. APONTAMENTO DIÁRIO',   label: 'Apontamento Diário',   grupo: 'Execução', keyColumns: ['DATA', 'CONTRATO', 'EQUIPE'] },
  { id: 'materiais',           sheetName: '07. MATERIAIS',            label: 'Materiais',            grupo: 'Execução', keyColumns: ['DATA', 'ID DO SERVIÇO / OS', 'MATERIAL', 'MOVIMENTO'] },
  { id: 'diario_obra',         sheetName: '10. DIÁRIO DE OBRA',       label: 'Diário de Obra',       grupo: 'Execução', keyColumns: ['Nº DO RDO', 'CONTRATO'] },

  { id: 'medicao',             sheetName: '09. MEDIÇÃO',              label: 'Medição',              grupo: 'Medição', keyColumns: ['Nº BOLETIM', 'ID DO SERVIÇO', 'CÓD. PREÇO (CHAVE)'] },
  { id: 'faturamento',         sheetName: '12. FATURAMENTO',          label: 'Faturamento',          grupo: 'Medição', keyColumns: ['MÊS', 'CONTRATO'] },

  { id: 'ocorrencias',         sheetName: '11. OCORRÊNCIAS',          label: 'Ocorrências',          grupo: 'Gestão', keyColumns: ['Nº', 'CONTRATO'] },
  { id: 'atas',                sheetName: '15. ATAS DE REUNIÃO',      label: 'Atas de Reunião',      grupo: 'Gestão', keyColumns: ['Nº DA ATA', 'PENDÊNCIA / AÇÃO'] },
  { id: 'lookahead',           sheetName: '16. LOOKAHEAD E RESTRIÇÕES', label: 'Lookahead',          grupo: 'Gestão', keyColumns: ['SEMANA (2ª feira)', 'CONTRATO', 'ID DO SERVIÇO'] },
  { id: 'plano_semanal',       sheetName: '17. PLANO SEMANAL E PPC',  label: 'Plano Semanal e PPC',  grupo: 'Gestão', keyColumns: ['SEMANA (2ª feira)', 'CONTRATO', 'ID DO SERVIÇO'] },
  { id: 'resumo',              sheetName: '13. RESUMO GERENCIAL',     label: 'Resumo Gerencial',     grupo: 'Gestão', keyColumns: ['MÊS DE REFERÊNCIA'], readonly: true },
  { id: 'dashboard',           sheetName: '14. DASHBOARD',            label: 'Dashboard',            grupo: 'Gestão', keyColumns: ['SERVIÇOS EXECUTADOS NO MÊS'], readonly: true },
  { id: 'planejado_realizado', sheetName: '18. PLANEJADO x REALIZADO', label: 'Planejado × Realizado', grupo: 'Gestão', keyColumns: ['SEMANA (2ª feira)'], readonly: true },
]

export const GRUPOS = ['Cadastros', 'Execução', 'Medição', 'Gestão'] as const

export function definicaoDaAba(id: SabespSheetId): SabespSheetDefinition {
  const d = SABESP_SHEETS.find((x) => x.id === id)
  if (!d) throw new Error(`aba desconhecida: ${id}`)
  return d
}

// ─── O dado ───────────────────────────────────────────────────────────────────

export interface LinhaOperacional {
  id: string
  aba: SabespSheetId
  /** A identidade da linha na planilha. É por ela que a reimportação reconhece. */
  chave: string
  valores: Record<string, string>
  /** Quem escreveu por último. É o que faz a conferência distinguir conflito de rotina. */
  origem: 'planilha' | 'sistema'
  editadoPor?: string
  editadoEm?: string
  /** `false` = sumiu da planilha numa reimportação. Fica visível, marcado, nunca apagado calado. */
  ativa: boolean
}

export interface AbaNoSistema {
  colunas: ColunaLida[]
  ordemDasChaves: string[]
}

export interface SabespGuide { titulo: string; linhas: string[] }

export interface SabespImportBatch {
  id: string
  arquivo: string
  criadoEm: string
  novas: number
  atualizadas: number
  conflitos: number
  inalteradas: number
  ausentes: number
  abasLidas: number
  listas: number
  regras: number
}

interface Estado {
  activeOrgId: string | null
  linhas: LinhaOperacional[]
  abas: Partial<Record<SabespSheetId, AbaNoSistema>>
  configuracoes: ParametroDeConfiguracao[]
  guias: { rapido?: SabespGuide; leiaMe?: SabespGuide }
  imports: SabespImportBatch[]

  pendingSync: PendingOp[]
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  syncError: string | null

  gravarLinhas: (linhas: LinhaOperacional[]) => void
  editarCelula: (id: string, campo: string, valor: string) => void
  registrarImportacao: (batch: SabespImportBatch, meta: {
    abas: Partial<Record<SabespSheetId, AbaNoSistema>>
    configuracoes: ParametroDeConfiguracao[]
    guias: Estado['guias']
  }) => void

  ensureTenantScope: (organizationId: string) => void
  clearData: () => void
  flush: () => Promise<void>
  pull: () => Promise<void>
}

/** Id determinístico: a MESMA linha, reimportada em outro aparelho, é a mesma linha. */
export function idDaLinha(orgId: string | null | undefined, aba: SabespSheetId, chave: string): string {
  return seededId(orgId, 'operacional-linha', aba, chave)
}

function ctx() {
  const { profile, user } = useAuth.getState()
  return {
    orgId: profile?.organization_id ?? 'pending',
    userId: user?.id ?? 'pending',
    nome: profile?.full_name || profile?.email || 'alguém',
  }
}

function linhaParaRow(l: LinhaOperacional, orgId: string, userId: string) {
  return {
    id: l.id,
    organization_id: orgId,
    aba: l.aba,
    chave: l.chave,
    origem: l.origem,
    editado_por: l.editadoPor ?? null,
    editado_em: l.editadoEm ?? null,
    payload: { valores: l.valores, ativa: l.ativa } as unknown as Record<string, unknown>,
    created_by: userId,
    deleted_at: null,
  }
}

interface RowLida {
  id: string
  aba: string
  chave: string
  origem: string
  editado_por: string | null
  editado_em: string | null
  payload: { valores?: Record<string, string>; ativa?: boolean } | null
}

const vazio = () => ({
  linhas: [] as LinhaOperacional[],
  abas: {} as Partial<Record<SabespSheetId, AbaNoSistema>>,
  configuracoes: [] as ParametroDeConfiguracao[],
  guias: {} as Estado['guias'],
  imports: [] as SabespImportBatch[],
})

export const useSabespStore = create<Estado>()(
  persist(
    (set, get) => {
      const serializarFlush = makeFlushSerializer()
      return {
        activeOrgId: null,
        ...vazio(),
        pendingSync: [],
        syncStatus: 'idle',
        lastSyncedAt: null,
        syncError: null,

        gravarLinhas: (novas) => {
          // Gate espelhando a policy `op_linhas_insert_with_role`. Sem ele a tela diria "importado"
          // e cada op voltaria 42501, entupindo a fila — o erro que a Torre tinha em 8 escritas.
          if (!podeEscreverTorre().pode) {
            set({ syncError: 'O seu perfil não tem permissão para gravar no Operacional.' })
            return
          }
          if (novas.length === 0) return
          const { orgId, userId } = ctx()
          const ids = new Set(novas.map((l) => l.id))
          set((s) => ({
            linhas: [...s.linhas.filter((l) => !ids.has(l.id)), ...novas],
            pendingSync: [
              ...s.pendingSync,
              ...novas.map((l) => makeOp({
                entity: 'operacional_linha', type: 'insert', recordId: l.id,
                row: linhaParaRow(l, orgId, userId), table: 'operacional_linhas',
              })),
            ],
          }))
          void get().flush()
        },

        editarCelula: (id, campo, valor) => {
          if (!podeEscreverTorre().pode) {
            set({ syncError: 'O seu perfil não tem permissão para editar o Operacional.' })
            return
          }
          const atual = get().linhas.find((l) => l.id === id)
          if (!atual) return
          const def = SABESP_SHEETS.find((d) => d.id === atual.aba)
          // Aba derivada é fórmula na planilha. Editar aqui seria discordar da fonte sem poder
          // recalcular nada — e o número editado sumiria na próxima importação, o que é pior.
          if (def?.readonly) return

          const { orgId, userId, nome } = ctx()
          const editada: LinhaOperacional = {
            ...atual,
            valores: { ...atual.valores, [campo]: valor },
            // ⚠️ `origem: 'sistema'` é o que faz a próxima reimportação chamar isto de CONFLITO em
            // vez de atualização silenciosa. Sem este carimbo, a planilha sobrescreveria a edição
            // do usuário sem ninguém ver — que é exatamente o que o cliente pediu para não acontecer.
            origem: 'sistema',
            editadoPor: nome,
            editadoEm: new Date().toISOString(),
          }
          set((s) => ({
            linhas: s.linhas.map((l) => (l.id === id ? editada : l)),
            pendingSync: [...s.pendingSync, makeOp({
              entity: 'operacional_linha', type: 'insert', recordId: id,
              row: linhaParaRow(editada, orgId, userId), table: 'operacional_linhas',
            })],
          }))
          void get().flush()
        },

        registrarImportacao: (batch, meta) => {
          set((s) => ({
            abas: { ...s.abas, ...meta.abas },
            configuracoes: meta.configuracoes.length ? meta.configuracoes : s.configuracoes,
            // ⚠️ Só substitui o guia quando o arquivo REALMENTE trouxe um. O código anterior
            // mandava sempre um objeto (nunca nullish), então o `??` era código morto e importar
            // um arquivo sem as abas opcionais apagava os guias já carregados.
            guias: {
              rapido: meta.guias.rapido ?? s.guias.rapido,
              leiaMe: meta.guias.leiaMe ?? s.guias.leiaMe,
            },
            imports: [batch, ...s.imports].slice(0, 50),
          }))
        },

        ensureTenantScope: (organizationId) => {
          if (!organizationId) return
          const cur = get().activeOrgId
          if (cur === organizationId) return
          if (cur == null) {
            const marker = getTenantMarker()
            if (marker && marker !== organizationId) get().clearData()
            set({ activeOrgId: organizationId })
            return
          }
          get().clearData()
          set({ activeOrgId: organizationId })
        },

        clearData: () => set({ ...vazio(), activeOrgId: null, syncError: null }),

        flush: async () => serializarFlush(async () => {
          const fila = get().pendingSync
          if (fila.length === 0) return
          if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }
          if (!useAuth.getState().profile) { set({ syncStatus: 'unauth' }); return }
          set({ syncStatus: 'syncing', syncError: null })
          const r = await flushQueue(fila)
          set((s) => ({
            pendingSync: s.pendingSync
              .filter((p) => !r.completed.includes(p.id))
              .map((p) => (r.errored.includes(p.id) ? { ...p, retries: p.retries + 1 } : p)),
            syncStatus: r.lastError ? 'error' : 'idle',
            lastSyncedAt: new Date().toISOString(),
            syncError: r.lastError ?? null,
          }))
        }, () => get().pendingSync.length),

        pull: async () => {
          const rows = await pullTable<RowLida>('operacional_linhas', { column: 'aba', ascending: true })
          if (!rows) return
          const doServidor: LinhaOperacional[] = rows.map((r) => ({
            id: r.id,
            aba: r.aba as SabespSheetId,
            chave: r.chave,
            valores: r.payload?.valores ?? {},
            origem: r.origem === 'sistema' ? 'sistema' : 'planilha',
            editadoPor: r.editado_por ?? undefined,
            editadoEm: r.editado_em ?? undefined,
            ativa: r.payload?.ativa !== false,
          }))
          set((s) => ({
            linhas: mergePull(doServidor, s.linhas, s.pendingSync, 'operacional_linhas'),
            syncStatus: 'idle',
            lastSyncedAt: new Date().toISOString(),
          }))
        },
      }
    },
    {
      name: 'cdata-operacional',
      version: 1,
      // O store nasceu sem `persist` nenhum; o `migrate` existe desde a v1 porque `version` sem
      // `migrate` faz o zustand DESCARTAR o estado inteiro — inclusive a fila. Ver `financeiroStore`.
      migrate: (persisted) => (persisted ?? {}) as never,
      partialize: (s) => ({
        activeOrgId: s.activeOrgId,
        linhas: s.linhas,
        abas: s.abas,
        configuracoes: s.configuracoes,
        guias: s.guias,
        imports: s.imports,
        pendingSync: s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)
