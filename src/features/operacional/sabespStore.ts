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
  /**
   * Rótulos usados para ACHAR A LINHA DO CABEÇALHO na aba — e nada mais.
   *
   * ⚠️ Isto **não é a identidade da linha**. Chamava-se `keyColumns`, e o nome fez o projeto
   * carregar duas verdades sobre o que identifica um registro: esta lista e as exigências de
   * `ehRegistroReal`. Para a Programação uma pedia `EQUIPE` e a outra não; para a Medição uma pedia
   * `Nº BOLETIM` e a outra não. Foi assim que uma troca de chave passou sem nada acusar.
   *
   * A identidade mora em `COLUNAS_DE_IDENTIDADE` (`chaveDaLinha.ts`), fonte única. Aqui quanto mais
   * rótulos, melhor: `lerAba` pontua a linha candidata por quantos deles ela contém.
   */
  colunasDoCabecalho: string[]
  /**
   * Aba DERIVADA: na planilha ela é fórmula. Não se edita aqui — editar seria discordar da fonte.
   */
  readonly?: boolean
  /** Agrupamento da barra de abas. 20 pílulas numa tira só era o principal problema de uso. */
  grupo: 'Cadastros' | 'Execução' | 'Medição' | 'Gestão'
}

export const SABESP_SHEETS: SabespSheetDefinition[] = [
  { id: 'configuracoes',       sheetName: '01. CONFIGURAÇÕES',        label: 'Configurações',        grupo: 'Cadastros', colunasDoCabecalho: ['Empresa executante'] },
  { id: 'banco_custos',        sheetName: '01A. BANCO DE CUSTOS',     label: 'Banco de Custos',      grupo: 'Cadastros', colunasDoCabecalho: ['ITEM', 'CUSTO MENSAL'] },
  { id: 'carteira_ticket',     sheetName: '01B. CARTEIRA E TICKET',   label: 'Carteira e Ticket',    grupo: 'Cadastros', colunasDoCabecalho: ['TIPO DE SERVIÇO', 'CONTRATO'] },
  { id: 'tabela_precos',       sheetName: '02. TABELA DE PREÇOS',     label: 'Tabela de Preços',     grupo: 'Cadastros', colunasDoCabecalho: ['CHAVE'], readonly: true },
  { id: 'cadastro_servicos',   sheetName: '03. CADASTRO DE SERVIÇOS', label: 'Cadastro de Serviços', grupo: 'Cadastros', colunasDoCabecalho: ['ID', 'CONTRATO'] },
  { id: 'equipe',              sheetName: '08. EQUIPE',               label: 'Equipe',               grupo: 'Cadastros', colunasDoCabecalho: ['MATRÍCULA', 'CONTRATO'] },

  { id: 'programacao',         sheetName: '04. PROGRAMAÇÃO DIÁRIA',   label: 'Programação Diária',   grupo: 'Execução', colunasDoCabecalho: ['DATA', 'CONTRATO', 'EQUIPE', 'ID DO SERVIÇO'] },
  { id: 'ordens_servico',      sheetName: '05. ORDENS DE SERVIÇO',    label: 'Ordens de Serviço',    grupo: 'Execução', colunasDoCabecalho: ['ID DO SERVIÇO', 'CONTRATO', 'Nº OS SABESP'] },
  { id: 'apontamento',         sheetName: '06. APONTAMENTO DIÁRIO',   label: 'Apontamento Diário',   grupo: 'Execução', colunasDoCabecalho: ['DATA', 'CONTRATO', 'EQUIPE'] },
  { id: 'materiais',           sheetName: '07. MATERIAIS',            label: 'Materiais',            grupo: 'Execução', colunasDoCabecalho: ['DATA', 'ID DO SERVIÇO / OS', 'MATERIAL', 'MOVIMENTO'] },
  { id: 'diario_obra',         sheetName: '10. DIÁRIO DE OBRA',       label: 'Diário de Obra',       grupo: 'Execução', colunasDoCabecalho: ['Nº DO RDO', 'CONTRATO'] },

  { id: 'medicao',             sheetName: '09. MEDIÇÃO',              label: 'Medição',              grupo: 'Medição', colunasDoCabecalho: ['Nº BOLETIM', 'ID DO SERVIÇO', 'CÓD. PREÇO (CHAVE)'] },
  { id: 'faturamento',         sheetName: '12. FATURAMENTO',          label: 'Faturamento',          grupo: 'Medição', colunasDoCabecalho: ['MÊS', 'CONTRATO'] },

  { id: 'ocorrencias',         sheetName: '11. OCORRÊNCIAS',          label: 'Ocorrências',          grupo: 'Gestão', colunasDoCabecalho: ['Nº', 'CONTRATO'] },
  { id: 'atas',                sheetName: '15. ATAS DE REUNIÃO',      label: 'Atas de Reunião',      grupo: 'Gestão', colunasDoCabecalho: ['Nº DA ATA', 'PENDÊNCIA / AÇÃO'] },
  { id: 'lookahead',           sheetName: '16. LOOKAHEAD E RESTRIÇÕES', label: 'Lookahead',          grupo: 'Gestão', colunasDoCabecalho: ['SEMANA (2ª feira)', 'CONTRATO', 'ID DO SERVIÇO'] },
  { id: 'plano_semanal',       sheetName: '17. PLANO SEMANAL E PPC',  label: 'Plano Semanal e PPC',  grupo: 'Gestão', colunasDoCabecalho: ['SEMANA (2ª feira)', 'CONTRATO', 'ID DO SERVIÇO'] },
  { id: 'resumo',              sheetName: '13. RESUMO GERENCIAL',     label: 'Resumo Gerencial',     grupo: 'Gestão', colunasDoCabecalho: ['MÊS DE REFERÊNCIA'], readonly: true },
  { id: 'dashboard',           sheetName: '14. DASHBOARD',            label: 'Dashboard',            grupo: 'Gestão', colunasDoCabecalho: ['SERVIÇOS EXECUTADOS NO MÊS'], readonly: true },
  { id: 'planejado_realizado', sheetName: '18. PLANEJADO x REALIZADO', label: 'Planejado × Realizado', grupo: 'Gestão', colunasDoCabecalho: ['SEMANA (2ª feira)'], readonly: true },
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
  /** Matriz fiel da aba. Mantém títulos, blocos e notas que não são registros de negócio. */
  matriz?: string[][]
  linhaDoCabecalho?: number
  registros?: number
  estruturais?: number
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
  arquivoPath?: string
}

export interface AlteracaoOperacional {
  id: string
  linhaId: string
  aba: SabespSheetId
  chave: string
  acao: 'editar' | 'criar' | 'duplicar' | 'arquivar' | 'restaurar' | 'importar'
  antes?: Record<string, string>
  depois?: Record<string, string>
  criadoEm: string
}

interface Estado {
  activeOrgId: string | null
  linhas: LinhaOperacional[]
  abas: Partial<Record<SabespSheetId, AbaNoSistema>>
  configuracoes: ParametroDeConfiguracao[]
  guias: { rapido?: SabespGuide; leiaMe?: SabespGuide }
  imports: SabespImportBatch[]
  historico: AlteracaoOperacional[]
  arquivoOriginal?: { nome: string; path: string }

  pendingSync: PendingOp[]
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  syncError: string | null

  /**
   * Grava o lote da importação. O `rastro` é o histórico por linha da ação `importar`.
   *
   * ⚠️ `importar` está no `check` da migração desde o primeiro dia e **nunca era gravada**: a
   * importação sobrescrevia linha por linha sem deixar um único registro de que tinha sido ela. A
   * tabela de lotes diz "aconteceu uma importação"; só o rastro diz "e ela mudou ESTA linha, de X
   * para Y".
   */
  gravarLinhas: (linhas: LinhaOperacional[], rastro?: AlteracaoOperacional[]) => void
  editarCelula: (id: string, campo: string, valor: string) => void
  criarLinha: (aba: SabespSheetId, valores?: Record<string, string>) => void
  duplicarLinha: (id: string) => void
  alternarLinha: (id: string) => void
  desfazer: () => void
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

interface EstadoRow {
  payload: Partial<Pick<Estado, 'abas' | 'configuracoes' | 'guias' | 'imports'>> | null
  arquivo_original_path: string | null
  arquivo_original_nome: string | null
}

const vazio = () => ({
  linhas: [] as LinhaOperacional[],
  abas: {} as Partial<Record<SabespSheetId, AbaNoSistema>>,
  configuracoes: [] as ParametroDeConfiguracao[],
  guias: {} as Estado['guias'],
  imports: [] as SabespImportBatch[],
  historico: [] as AlteracaoOperacional[],
  arquivoOriginal: undefined as Estado['arquivoOriginal'],
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

        gravarLinhas: (novas, rastro = []) => {
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
            historico: [...rastro, ...s.historico].slice(0, 500),
            pendingSync: [
              ...s.pendingSync,
              ...novas.map((l) => makeOp({
                entity: 'operacional_linha', type: 'insert', recordId: l.id,
                row: linhaParaRow(l, orgId, userId), table: 'operacional_linhas',
              })),
              ...rastro.map((h) => makeOp({
                entity: 'operacional_historico', type: 'insert', recordId: h.id, table: 'operacional_historico',
                row: { id: h.id, organization_id: orgId, linha_id: h.linhaId, aba: h.aba, chave: h.chave, acao: h.acao, antes: h.antes, depois: h.depois, created_by: userId },
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
          const alteracao: AlteracaoOperacional = {
            id: crypto.randomUUID(), linhaId: id, aba: atual.aba, chave: atual.chave, acao: 'editar',
            antes: atual.valores, depois: editada.valores, criadoEm: new Date().toISOString(),
          }
          set((s) => ({
            linhas: s.linhas.map((l) => (l.id === id ? editada : l)),
            historico: [alteracao, ...s.historico].slice(0, 500),
            pendingSync: [...s.pendingSync, makeOp({
              entity: 'operacional_linha', type: 'insert', recordId: id,
              row: linhaParaRow(editada, orgId, userId), table: 'operacional_linhas',
            }), makeOp({ entity: 'operacional_historico', type: 'insert', recordId: alteracao.id, table: 'operacional_historico', row: { id: alteracao.id, organization_id: orgId, linha_id: id, aba: atual.aba, chave: atual.chave, acao: 'editar', antes: atual.valores, depois: editada.valores, created_by: userId } })],
          }))
          void get().flush()
        },

        criarLinha: (aba, valores = {}) => {
          // ⚠️ O gate faltava nas QUATRO ações de linha (criar, duplicar, alternar, desfazer) —
          // só `gravarLinhas` e `editarCelula` tinham. A policy `op_linhas_insert_with_role` exige
          // papel: 6 dos 11 clicavam, viam a linha mudar na tela, e a op voltava 42501 — que é
          // classe BLOQUEANTE, ou seja, fila travada. É o mesmo incidente que Torre, RDO e
          // Suprimentos já corrigiram.
          if (!podeEscreverTorre().pode) {
            set({ syncError: 'O seu perfil não tem permissão para criar linhas no Operacional.' })
            return
          }
          const { orgId, userId, nome } = ctx()
          const chave = `LOCAL-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
          const linha: LinhaOperacional = { id: idDaLinha(orgId, aba, chave), aba, chave, valores, origem: 'sistema', editadoPor: nome, editadoEm: new Date().toISOString(), ativa: true }
          const h: AlteracaoOperacional = { id: crypto.randomUUID(), linhaId: linha.id, aba, chave, acao: 'criar', depois: valores, criadoEm: new Date().toISOString() }
          set((s) => ({ linhas: [...s.linhas, linha], historico: [h, ...s.historico].slice(0, 500), pendingSync: [...s.pendingSync, makeOp({ entity: 'operacional_linha', type: 'insert', recordId: linha.id, row: linhaParaRow(linha, orgId, userId), table: 'operacional_linhas' }), makeOp({ entity: 'operacional_historico', type: 'insert', recordId: h.id, table: 'operacional_historico', row: { id: h.id, organization_id: orgId, linha_id: linha.id, aba, chave, acao: 'criar', depois: valores, created_by: userId } })] }))
          void get().flush()
        },

        duplicarLinha: (id) => {
          // Sem gate próprio: delega a `criarLinha`, que já barra. Fica explícito para quem ler.
          const original = get().linhas.find((l) => l.id === id)
          if (original) get().criarLinha(original.aba, { ...original.valores })
        },

        alternarLinha: (id) => {
          if (!podeEscreverTorre().pode) {
            set({ syncError: 'O seu perfil não tem permissão para arquivar ou restaurar linhas.' })
            return
          }
          const atual = get().linhas.find((l) => l.id === id)
          if (!atual) return
          const { orgId, userId, nome } = ctx()
          const linha = { ...atual, ativa: !atual.ativa, origem: 'sistema' as const, editadoPor: nome, editadoEm: new Date().toISOString() }
          const h: AlteracaoOperacional = { id: crypto.randomUUID(), linhaId: id, aba: linha.aba, chave: linha.chave, acao: linha.ativa ? 'restaurar' : 'arquivar', antes: atual.valores, depois: linha.valores, criadoEm: new Date().toISOString() }
          set((s) => ({ linhas: s.linhas.map((l) => l.id === id ? linha : l), historico: [h, ...s.historico].slice(0, 500), pendingSync: [...s.pendingSync, makeOp({ entity: 'operacional_linha', type: 'insert', recordId: id, row: linhaParaRow(linha, orgId, userId), table: 'operacional_linhas' }), makeOp({ entity: 'operacional_historico', type: 'insert', recordId: h.id, table: 'operacional_historico', row: { id: h.id, organization_id: orgId, linha_id: id, aba: linha.aba, chave: linha.chave, acao: h.acao, antes: atual.valores, depois: linha.valores, created_by: userId } })] }))
          void get().flush()
        },

        desfazer: () => {
          // Desfazer reescreve dado: passa pelo mesmo gate. As ações que ele chama
          // (`alternarLinha`, `editarCelula`) também barram, mas sair aqui evita consumir o
          // histórico sem ter desfeito nada.
          if (!podeEscreverTorre().pode) return
          const h = get().historico[0]
          if (!h) return
          const linha = get().linhas.find((l) => l.id === h.linhaId)
          if (!linha) return
          if (h.acao === 'criar' || h.acao === 'duplicar') get().alternarLinha(h.linhaId)
          else if (h.antes) {
            for (const [campo, valor] of Object.entries(h.antes)) if (linha.valores[campo] !== valor) get().editarCelula(linha.id, campo, valor)
          }
          set((s) => ({ historico: s.historico.filter((x) => x.id !== h.id) }))
        },

        registrarImportacao: (batch, meta) => {
          const { orgId, userId } = ctx()
          const estadoPayload = {
            abas: { ...get().abas, ...meta.abas },
            configuracoes: meta.configuracoes.length ? meta.configuracoes : get().configuracoes,
            guias: { rapido: meta.guias.rapido ?? get().guias.rapido, leiaMe: meta.guias.leiaMe ?? get().guias.leiaMe },
            imports: [batch, ...get().imports].slice(0, 50),
          }
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
            arquivoOriginal: batch.arquivoPath ? { nome: batch.arquivo, path: batch.arquivoPath } : s.arquivoOriginal,
            pendingSync: [...s.pendingSync,
              makeOp({ entity: 'operacional_estado', type: 'insert', recordId: orgId, table: 'operacional_estado', row: { id: orgId, organization_id: orgId, payload: estadoPayload, arquivo_original_path: batch.arquivoPath ?? null, arquivo_original_nome: batch.arquivo, updated_by: userId, updated_at: new Date().toISOString() } }),
              makeOp({ entity: 'operacional_importacao', type: 'insert', recordId: batch.id, table: 'operacional_importacoes', row: { id: batch.id, organization_id: orgId, arquivo: batch.arquivo, arquivo_path: batch.arquivoPath ?? null, resumo: batch, metadados: { abas: meta.abas, configuracoes: meta.configuracoes, guias: meta.guias }, created_by: userId } }),
            ],
          }))
          void get().flush()
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
          const [rows, estados] = await Promise.all([
            pullTable<RowLida>('operacional_linhas', { column: 'aba', ascending: true }),
            pullTable<EstadoRow>('operacional_estado', { column: 'updated_at', ascending: false, activeOnly: false }),
          ])
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
          const meta = estados?.[0]
          set((s) => ({
            linhas: mergePull(doServidor, s.linhas, s.pendingSync, 'operacional_linhas'),
            abas: meta?.payload?.abas ?? s.abas,
            configuracoes: meta?.payload?.configuracoes ?? s.configuracoes,
            guias: meta?.payload?.guias ?? s.guias,
            imports: meta?.payload?.imports ?? s.imports,
            arquivoOriginal: meta?.arquivo_original_path && meta.arquivo_original_nome
              ? { path: meta.arquivo_original_path, nome: meta.arquivo_original_nome }
              : s.arquivoOriginal,
            syncStatus: 'idle',
            lastSyncedAt: new Date().toISOString(),
          }))
        },
      }
    },
    {
      name: 'cdata-operacional',
      version: 2,
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
            historico: s.historico,
            arquivoOriginal: s.arquivoOriginal,
        pendingSync: s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)
