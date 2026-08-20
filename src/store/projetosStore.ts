/**
 * projetosStore.ts — Zustand store da entidade central Project.
 *
 * Sprint 4: migrado para Supabase via storeSync helper.
 * Tabelas: projects (1 row por projeto, payload jsonb com phases/budgetLines),
 * project_documents (metadata; binário no bucket project-documents/).
 * Exclusão é soft delete (`deleted_at`) — não passa mais pelo request_action RPC.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { changedColumns, flushQueue, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { uploadFile, removeFile, getSignedUrl, type UploadResult } from '@/lib/storage'
import { MOCK_PROJETOS } from '@/data/mockProjetos'
import type {
  Project,
  ProjectPhase,
  BudgetLine,
  ProjectDocument,
  DesignViewType,
} from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type PhaseGroup = 'planning' | 'execution'

interface EditingPhase {
  projectId: string
  group: PhaseGroup
  phaseId: string
}

interface EditingBudgetLine {
  projectId: string
  lineId: string | 'new'
}

interface ProjetosState {
  activeOrgId: string | null
  projects: Project[]
  selectedProjectId: string | null
  activeTab: number
  activeDesignView: DesignViewType
  editingProjectId: string | null
  editingPhase: EditingPhase | null
  editingBudgetLine: EditingBudgetLine | null

  // Sync
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
}

interface ProjetosActions {
  ensureTenantScope: (organizationId: string) => void
  addProject: (payload: Omit<Project, 'id'>) => void
  updateProject: (id: string, patch: Partial<Omit<Project, 'id'>>) => void
  deleteProject: (id: string) => void
  selectProject: (id: string | null) => void
  setActiveTab: (tab: number) => void
  setActiveDesignView: (view: DesignViewType) => void
  setEditingProject: (id: string | null) => void
  setEditingPhase: (args: EditingPhase | null) => void
  setEditingBudgetLine: (args: EditingBudgetLine | null) => void
  updatePhase: (projectId: string, group: PhaseGroup, phaseId: string, patch: Partial<ProjectPhase>) => void
  addBudgetLine: (projectId: string, line: Omit<BudgetLine, 'id'>) => void
  updateBudgetLine: (projectId: string, lineId: string, patch: Partial<Omit<BudgetLine, 'id'>>) => void
  deleteBudgetLine: (projectId: string, lineId: string) => void
  addDocument: (projectId: string, doc: ProjectDocument) => void
  deleteDocument: (projectId: string, docId: string) => void
  /** Faz upload de um File real para o Storage e adiciona como documento. */
  uploadDocument: (projectId: string, file: File) => Promise<ProjectDocument | null>
  /** Resolve URL signed para baixar/visualizar um documento já no Storage. */
  resolveDocumentUrl: (doc: ProjectDocument) => Promise<string | null>
  loadDemoData: () => void
  clearData: () => void
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

// ─── Mappers ──────────────────────────────────────────────────────────────────
function projectToRow(p: Project, orgId: string, userId: string) {
  return {
    id:              p.id,
    organization_id: orgId,
    code:            (p as { code?: string }).code ?? `PRJ-${p.id.slice(0, 6)}`,
    name:            p.name,
    status:          (p as { status?: string }).status ?? 'planning',
    start_date:      (p as { startDate?: string }).startDate ?? null,
    end_date:        (p as { endDate?: string }).endDate ?? null,
    payload:         p as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}

function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useProjetosStore = create<ProjetosState & ProjetosActions>()(
  persist(
    (set, get) => {
      const enqueue = (op: PendingOp) => set((s) => ({ pendingSync: [...s.pendingSync, op] }))

      /**
       * Reenfileira o projeto inteiro.
       *
       * Fases, linhas de orçamento e documentos moram todos dentro de `projects.payload` — quem
       * mexe em qualquer um deles precisa mandar o projeto de volta, senão o `pull` traz o payload
       * antigo e desfaz a mudança. Este trecho estava copiado em quatro lugares.
       */
      const enqueueProjetoInteiro = (projectId: string) => {
        const target = get().projects.find((p) => p.id === projectId)
        if (!target) return
        const { orgId, userId } = ctxAuth()
        const row = projectToRow(target, orgId, userId)
        const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id', 'organization_id', 'created_by'].includes(k)))
        enqueue(makeOp({ entity: 'project', type: 'update', recordId: projectId, patch, table: 'projects' }))
      }
      return {
        activeOrgId: null,
        projects: [],
        selectedProjectId: null,
        activeTab: 0,
        activeDesignView: '3D',
        editingProjectId: null,
        editingPhase: null,
        editingBudgetLine: null,

        pendingSync:  [],
        syncStatus:   'idle',
        lastSyncedAt: null,
        syncError:    null,

        ensureTenantScope: (organizationId) => {
          if (!organizationId || get().activeOrgId === organizationId) return
          set({
            activeOrgId: organizationId,
            projects: [],
            selectedProjectId: null,
            activeTab: 0,
            editingProjectId: null,
            editingPhase: null,
            editingBudgetLine: null,
            pendingSync: [],
            syncStatus: 'idle',
            syncError: null,
          })
        },

        addProject: (payload) => {
          // code é único por org (projects_unique_code_per_org). Se já há projeto local com o
          // mesmo code, reusa o id (upsert atualiza) em vez de inserir outro → evita 23505 preso.
          const codeKey = (payload as { code?: string }).code?.trim()
          const dup = codeKey ? get().projects.find((p) => (p as { code?: string }).code?.trim() === codeKey) : undefined
          const id = dup?.id ?? crypto.randomUUID()
          const newProject: Project = { ...payload, id }
          set((s) => ({ projects: dup ? s.projects.map((p) => (p.id === id ? newProject : p)) : [...s.projects, newProject], selectedProjectId: id }))
          const { orgId, userId } = ctxAuth()
          enqueue(makeOp({ entity: 'project', type: 'insert', recordId: id, row: projectToRow(newProject, orgId, userId), table: 'projects' }))
          void get().flush()
        },

        updateProject: (id, patch) => {
          const prev = get().projects.find((p) => p.id === id)
          set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
          const target = get().projects.find((p) => p.id === id)
          if (target && prev) {
            const { orgId, userId } = ctxAuth()
            // patch de campo: só as colunas que mudaram (anti-clobber concorrente)
            const updatePatch = changedColumns(projectToRow(prev, orgId, userId), projectToRow(target, orgId, userId))
            if (Object.keys(updatePatch).length > 0) {
              enqueue(makeOp({ entity: 'project', type: 'update', recordId: id, patch: updatePatch, table: 'projects' }))
              void get().flush()
            }
          }
        },

        deleteProject: (id) => {
          set((s) => {
            const remaining = s.projects.filter((p) => p.id !== id)
            return {
              projects: remaining,
              selectedProjectId: remaining[0]?.id ?? null,
              activeTab: 0,
            }
          })
          // Era `type: 'delete'` com `approvalActionType`, que chama o RPC `request_action`: aquilo
          // só CRIA um pedido em `pending_actions` e não apaga o projeto. A op saía da fila como
          // concluída e a obra voltava inteira no pull seguinte — com fases, orçamento e documentos —
          // e ainda virava a obra selecionada. Com uma conta só na empresa não há segundo aprovador
          // (approve_pending_action proíbe o próprio solicitante), então excluir era impossível.
          // A RLS aceita o soft delete direto (`projects_update_role`), e o SELECT já filtra
          // `deleted_at IS NULL`, então o registro some do pull.
          enqueue(makeOp({ entity: 'project', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'projects' }))
          void get().flush()
        },

        selectProject: (id) => set({ selectedProjectId: id, activeTab: 0 }),
        setActiveTab: (tab) => set({ activeTab: tab }),
        setActiveDesignView: (view) => set({ activeDesignView: view }),
        setEditingProject: (id) => set({ editingProjectId: id }),
        setEditingPhase: (args) => set({ editingPhase: args }),
        setEditingBudgetLine: (args) => set({ editingBudgetLine: args }),

        // ── Phase update ──────────────────────────────────────────────────────
        // Phases ficam dentro de project.payload — atualizamos o projeto inteiro
        // (last-write-wins via updateProject), mantendo simples.
        updatePhase: (projectId, group, phaseId, patch) => {
          set((s) => ({
            projects: s.projects.map((p) => {
              if (p.id !== projectId) return p
              const key = group === 'planning' ? 'planningPhases' : 'executionPhases'
              return {
                ...p,
                [key]: p[key].map((ph) => (ph.id === phaseId ? { ...ph, ...patch } : ph)),
              }
            }),
          }))
          // Re-enfileira update do projeto inteiro
          const target = get().projects.find((p) => p.id === projectId)
          if (target) {
            const { orgId, userId } = ctxAuth()
            const row = projectToRow(target, orgId, userId)
            const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'project', type: 'update', recordId: projectId, patch: updatePatch, table: 'projects' }))
            void get().flush()
          }
        },

        // ── Budget lines (ficam dentro de project.payload.budgetLines) ────────
        addBudgetLine: (projectId, line) => {
          set((s) => ({
            projects: s.projects.map((p) =>
              p.id === projectId
                ? { ...p, budgetLines: [...p.budgetLines, { ...line, id: crypto.randomUUID() }] }
                : p
            ),
          }))
          const target = get().projects.find((p) => p.id === projectId)
          if (target) {
            const { orgId, userId } = ctxAuth()
            const row = projectToRow(target, orgId, userId)
            const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'project', type: 'update', recordId: projectId, patch: updatePatch, table: 'projects' }))
            void get().flush()
          }
        },

        updateBudgetLine: (projectId, lineId, patch) => {
          set((s) => ({
            projects: s.projects.map((p) =>
              p.id === projectId
                ? { ...p, budgetLines: p.budgetLines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }
                : p
            ),
          }))
          const target = get().projects.find((p) => p.id === projectId)
          if (target) {
            const { orgId, userId } = ctxAuth()
            const row = projectToRow(target, orgId, userId)
            const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'project', type: 'update', recordId: projectId, patch: updatePatch, table: 'projects' }))
            void get().flush()
          }
        },

        deleteBudgetLine: (projectId, lineId) => {
          set((s) => ({
            projects: s.projects.map((p) =>
              p.id === projectId
                ? { ...p, budgetLines: p.budgetLines.filter((l) => l.id !== lineId) }
                : p
            ),
          }))
          const target = get().projects.find((p) => p.id === projectId)
          if (target) {
            const { orgId, userId } = ctxAuth()
            const row = projectToRow(target, orgId, userId)
            const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'project', type: 'update', recordId: projectId, patch: updatePatch, table: 'projects' }))
            void get().flush()
          }
        },

        // ── Documents (metadata em project_documents, binário no Storage) ─────
        addDocument: (projectId, doc) => {
          // Modo legado/manual: adiciona doc local sem upload (compat com demo data)
          set((s) => ({
            projects: s.projects.map((p) =>
              p.id === projectId ? { ...p, documents: [...p.documents, doc] } : p
            ),
          }))
          // Se já tem storage_path (vindo de uploadDocument), enfileira insert
          const sp = (doc as unknown as { storagePath?: string }).storagePath
          if (sp) {
            const { orgId, userId } = ctxAuth()
            enqueue(makeOp({
              entity: 'project_document',
              type:   'insert',
              recordId: doc.id,
              row: {
                id:              doc.id,
                organization_id: orgId,
                project_id:      projectId,
                name:            doc.name,
                mime_type:       doc.mimeType ?? null,
                size_bytes:      doc.sizeBytes ?? null,
                storage_path:    sp,
                payload:         doc as unknown as Record<string, unknown>,
                created_by:      userId,
              },
              table: 'project_documents',
            }))
          }
          // O projeto vai junto SEMPRE — inclusive no modo legado sem `storagePath`, porque é o
          // payload dele que a tela lê. Sem isto, o documento recém-anexado sumia no próximo pull.
          enqueueProjetoInteiro(projectId)
          void get().flush()
        },

        deleteDocument: (projectId, docId) => {
          // Identifica o doc antes de remover para limpar o Storage
          const target = get().projects.find((p) => p.id === projectId)
          const doc    = target?.documents.find((d) => d.id === docId)
          set((s) => ({
            projects: s.projects.map((p) =>
              p.id === projectId
                ? { ...p, documents: p.documents.filter((d) => d.id !== docId) }
                : p
            ),
          }))
          // Era `type: 'delete'` com `approvalActionType`: o RPC `request_action` só registra o
          // pedido, então o metadata continuava em project_documents e o anexo reaparecia na lista
          // do projeto — só que apontando para um arquivo que o removeFile() logo abaixo já tinha
          // tirado do Storage, ou seja, um documento fantasma cujo download quebra. Soft delete
          // direto: `project_documents_update_role` aceita o UPDATE e o SELECT filtra `deleted_at`.
          enqueue(makeOp({
            entity: 'project_document', type: 'update', recordId: docId,
            patch: { deleted_at: new Date().toISOString() }, table: 'project_documents',
          }))
          // E o projeto TAMBÉM precisa ir, senão o soft delete acima não resolve nada: a tela lê
          // `project.documents`, que mora dentro de `projects.payload` (`projectToRow` serializa o
          // Project inteiro). Sem esta segunda op, o `pull` traz o payload antigo e o documento
          // reaparece na lista — apontando para um arquivo que o `removeFile` abaixo já apagou do
          // Storage. É o mesmo par que `deleteBudgetLine` já fazia.
          enqueueProjetoInteiro(projectId)
          // Limpa o arquivo do Storage best-effort (não bloqueia a exclusão)
          const sp = (doc as unknown as { storagePath?: string } | undefined)?.storagePath
          if (sp) void removeFile('project-documents', sp)
          void get().flush()
        },

        uploadDocument: async (projectId, file) => {
          const result: UploadResult | null = await uploadFile('project-documents', file, projectId)
          if (!result) return null
          const { user } = useAuth.getState()
          const newDoc: ProjectDocument = {
            id:         crypto.randomUUID(),
            name:       file.name,
            mimeType:   result.mimeType,
            sizeBytes:  result.size,
            uploadedAt: new Date().toISOString(),
            uploadedBy: user?.id ?? 'unknown',
            category:   'outros' as ProjectDocument['category'],
            // base64 some — agora referenciamos via storagePath
            base64:     '',
          }
          // Anexa storagePath via cast (campo extra preservado em payload)
          ;(newDoc as unknown as { storagePath: string }).storagePath = result.path
          get().addDocument(projectId, newDoc)
          return newDoc
        },

        resolveDocumentUrl: async (doc) => {
          const sp = (doc as unknown as { storagePath?: string }).storagePath
          if (!sp) return null
          return getSignedUrl('project-documents', sp)
        },

        loadDemoData: () =>
          set({ projects: MOCK_PROJETOS, selectedProjectId: MOCK_PROJETOS[0]?.id ?? null }),

        clearData: () =>
          set({ activeOrgId: null, projects: [], selectedProjectId: null, pendingSync: [], syncError: null }),

        flush: async () => {
          const queue = get().pendingSync
          if (queue.length === 0) return
          if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }
          const { profile } = useAuth.getState()
          if (!profile) { set({ syncStatus: 'unauth' }); return }
          set({ syncStatus: 'syncing', syncError: null })
          const result = await flushQueue(queue)
          set((s) => ({
            pendingSync: s.pendingSync
              .filter((p) => !result.completed.includes(p.id))
              .map((p) => result.errored.includes(p.id) ? { ...p, retries: p.retries + 1 } : p),
            syncStatus:   result.lastError ? 'error' : 'idle',
            lastSyncedAt: new Date().toISOString(),
            syncError:    result.lastError ?? null,
          }))
        },

        pull: async () => {
          const { profile } = useAuth.getState()
          if (!profile) {
            set({ syncStatus: 'unauth' })
            return
          }
          get().ensureTenantScope(profile.organization_id)
          // Sempre puxa: mergePull mescla o servidor com os registros que ainda têm op
          // pendente (não-sincronizados), preservando-os em vez de congelar a tabela toda.
          const rows = await pullTable<{ payload: Project }>('projects')
          if (rows) {
            set((s) => {
              const projects = mergePull(rows.map((r) => r.payload), s.projects, s.pendingSync, 'projects')
              return { projects, selectedProjectId: projects[0]?.id ?? null }
            })
          }
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-projetos',
      partialize: (s) => ({
        activeOrgId:       s.activeOrgId,
        projects:         s.projects,
        selectedProjectId: s.selectedProjectId,
        pendingSync:      s.pendingSync,
        lastSyncedAt:     s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useProjetosStore.getState().flush()
  })
}
