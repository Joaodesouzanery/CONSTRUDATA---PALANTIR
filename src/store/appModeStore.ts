/**
 * Global application mode store.
 * Controls whether the app shows rich mock/demo data or an empty "live" state.
 *
 * When entering demo mode, the user's real data is snapshot to localStorage
 * so it can be restored when demo mode is turned off — no data loss.
 */
import { create } from 'zustand'
import { isNonProductionDataMode } from '@/lib/runtimeMode'

interface AppModeState {
  isDemoMode: boolean
  toggleDemoMode: () => void
}

interface TenantSyncState {
  pendingSync?: unknown[]
  syncStatus?: string
  syncError?: string | null
  flush?: () => Promise<void> | void
  pull?: () => Promise<void> | void
}

/** Resumo global de sincronização (para o indicador de "não salvo" em produção). */
export async function getPendingSummary(): Promise<{ pending: number; error: boolean; syncing: boolean }> {
  if (isNonProductionDataMode()) return { pending: 0, error: false, syncing: false }
  const stores = await getAllTenantStores()
  let pending = 0, error = false, syncing = false
  for (const s of stores) {
    const st = s.getState()
    pending += st.pendingSync?.length ?? 0
    if (st.syncStatus === 'error') error = true
    if (st.syncStatus === 'syncing') syncing = true
  }
  return { pending, error, syncing }
}

const STORAGE_KEY = 'cdata-demo'
const SNAPSHOT_KEY = 'cdata-user-snapshot'

// All persist keys used by feature stores (user data that must be preserved)
const STORE_KEYS = [
  'cdata-rdo', 'cdata-suprimentos', 'cdata-agenda', 'cdata-projetos',
  'cdata-planejamento', 'cdata-planejamento-restricoes', 'cdata-quantitativos', 'cdata-relatorio360', 'cdata-bim',
  'cdata-torre-controle', 'cdata-equipamentos', 'cdata-gestao-equipamentos',
  'cdata-preconstrucao', 'cdata-mao-de-obra', 'cdata-otimizacao-frota',
  'cdata-lps', 'cdata-evm', 'cdata-mapa-interativo', 'cdata-gestao-360',
  'cdata-qualidade', 'cdata-medicao', 'cdata-medicao-billing',
  'cdata-medicao-unificada', 'cdata-medicao-assistida',
  'cdata-planejamento-mestre', 'cdata-operacao-campo', 'cdata-rede-360',
  'cdata-frota-veicular', 'cdata-financeiro', 'cdata-financeiro-titulos', 'cdata-rdo-sabesp',
  'cdata-company-settings', 'cdata-contractors', 'cdata-economia',
  'cdata-manutencoes', 'cdata-laudos', 'cdata-user-routine', 'cdata-plano-execucao', 'cdata-servicos',
  'cdata-manejo-financeiro',
]

function clearLocalOnlyModuleData() {
  localStorage.removeItem('cdata-manutencoes')
  localStorage.removeItem('cdata-laudos')
}

/**
 * Guarda o estado do usuário antes de carregar o demo.
 *
 * O QUE ESTAVA ERRADO, e valia para TODOS os módulos. O laço só guardava a chave que já
 * existia (`if (val)`), e o restore devolvia `true` de qualquer jeito — pulando o `clearData()`
 * de todos os stores. Consequência: qualquer módulo que estivesse **vazio** quando você ligou o
 * Modo Demo ganhava a chave com dado de demonstração, e desligar o Demo não a removia, porque
 * ela não estava no snapshot e o caminho de limpeza nunca rodava. O dado demo ficava, com o
 * Modo Demo desligado.
 *
 * A correção é gravar o "não existia" explicitamente, como `null`. Assim o restore sabe a
 * diferença entre "não guardei isso" e "isso não existia, apague".
 */
function snapshotUserData() {
  const snapshot: Record<string, string | null> = {}
  for (const key of STORE_KEYS) {
    // `null` é informação: significa "esta chave não existia, e precisa deixar de existir".
    snapshot[key] = localStorage.getItem(key)
  }
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    // localStorage cheio — segue sem snapshot; o restore cai no clearData().
  }
}

/** Restore user data from snapshot and rehydrate all stores. */
async function restoreUserData() {
  const raw = localStorage.getItem(SNAPSHOT_KEY)
  if (!raw) return false

  try {
    const snapshot: Record<string, string | null> = JSON.parse(raw)
    for (const [key, val] of Object.entries(snapshot)) {
      // `null` = a chave não existia antes do demo. Removê-la é o que impede o dado de
      // demonstração de sobreviver ao desligamento do Modo Demo.
      if (val === null) localStorage.removeItem(key)
      else localStorage.setItem(key, val)
    }
    // Snapshots antigos (formato sem null) não listavam as chaves ausentes. Para eles, apagar
    // tudo que está fora do snapshot é o que restaura o estado de verdade.
    for (const key of STORE_KEYS) {
      if (!(key in snapshot)) localStorage.removeItem(key)
    }
    localStorage.removeItem(SNAPSHOT_KEY)

    // Rehydrate each store from restored localStorage
    const stores = await Promise.all([
      import('./projetosStore').then(m => m.useProjetosStore),
      import('./agendaStore').then(m => m.useAgendaStore),
      import('./relatorio360Store').then(m => m.useRelatorio360Store),
      import('./equipamentosStore').then(m => m.useEquipamentosStore),
      import('./gestaoEquipamentosStore').then(m => m.useGestaoEquipamentosStore),
      import('./torreDeControleStore').then(m => m.useTorreStore),
      import('./suprimentosStore').then(m => m.useSuprimentosStore),
      import('./preConstrucaoStore').then(m => m.usePreConstrucaoStore),
      import('./maoDeObraStore').then(m => m.useMaoDeObraStore),
      import('./otimizacaoFrotaStore').then(m => m.useOtimizacaoFrotaStore),
      import('./gestao360Store').then(m => m.useGestao360Store),
      import('./planejamentoStore').then(m => m.usePlanejamentoStore),
      import('./rdoStore').then(m => m.useRdoStore),
      import('./quantitativosStore').then(m => m.useQuantitativosStore),
      import('./bimStore').then(m => m.useBimStore),
      import('./lpsStore').then(m => m.useLpsStore),
      import('./mapaInterativoStore').then(m => m.useMapaInterativoStore),
      import('./evmStore').then(m => m.useEvmStore),
      import('./qualidadeStore').then(m => m.useQualidadeStore),
      import('./planejamentoMestreStore').then(m => m.usePlanejamentoMestreStore),
      import('./operacaoCampoStore').then(m => m.useOperacaoCampoStore),
      import('./rede360Store').then(m => m.useRede360Store),
      import('./frotaVeicularStore').then(m => m.useFrotaVeicularStore),
      import('./medicaoStore').then(m => m.useMedicaoStore),
      import('./medicaoBillingStore').then(m => m.useMedicaoBillingStore),
      import('./financeiroStore').then(m => m.useFinanceiroStore),
      import('./financeiroTitulosStore').then(m => m.useFinanceiroTitulosStore),
      import('./planoExecucaoStore').then(m => m.usePlanoExecucaoStore),
      import('./servicosStore').then(m => m.useServicosStore),
      import('./companySettingsStore').then(m => m.useCompanySettingsStore),
      import('./economiaStore').then(m => m.useEconomiaStore),
      import('./manejoFinanceiroStore').then(m => m.useManejoFinanceiroStore),
      import('./manutencoesStore').then(m => m.useManutencoesStore),
      import('./laudosStore').then(m => m.useLaudosStore),
    ])
    for (const store of stores) {
      store.persist?.rehydrate?.()
    }
    return true
  } catch {
    return false
  }
}

interface TenantStoreApi {
  getState: () => TenantSyncState
  setState: (partial: Partial<TenantSyncState>) => void
}

// Lista rotulada dos stores tenant-scoped (label amigável p/ o painel de sincronização).
const TENANT_STORE_DEFS: Array<{ key: string; label: string; load: () => Promise<TenantStoreApi> }> = [
  { key: 'projetos', label: 'Projetos', load: () => import('./projetosStore').then(m => m.useProjetosStore as unknown as TenantStoreApi) },
  { key: 'agenda', label: 'Agenda', load: () => import('./agendaStore').then(m => m.useAgendaStore as unknown as TenantStoreApi) },
  { key: 'relatorio360', label: 'Relatório 360', load: () => import('./relatorio360Store').then(m => m.useRelatorio360Store as unknown as TenantStoreApi) },
  { key: 'equipamentos', label: 'Equipamentos', load: () => import('./equipamentosStore').then(m => m.useEquipamentosStore as unknown as TenantStoreApi) },
  { key: 'gestao-equipamentos', label: 'Gestão de Equipamentos', load: () => import('./gestaoEquipamentosStore').then(m => m.useGestaoEquipamentosStore as unknown as TenantStoreApi) },
  { key: 'torre', label: 'Torre de Controle (Obras)', load: () => import('./torreDeControleStore').then(m => m.useTorreStore as unknown as TenantStoreApi) },
  { key: 'suprimentos', label: 'Suprimentos / Estoque', load: () => import('./suprimentosStore').then(m => m.useSuprimentosStore as unknown as TenantStoreApi) },
  { key: 'preconstrucao', label: 'Pré-Construção', load: () => import('./preConstrucaoStore').then(m => m.usePreConstrucaoStore as unknown as TenantStoreApi) },
  { key: 'mao-de-obra', label: 'Mão de Obra', load: () => import('./maoDeObraStore').then(m => m.useMaoDeObraStore as unknown as TenantStoreApi) },
  { key: 'otimizacao-frota', label: 'Otimização de Frota', load: () => import('./otimizacaoFrotaStore').then(m => m.useOtimizacaoFrotaStore as unknown as TenantStoreApi) },
  { key: 'gestao360', label: 'Gestão 360', load: () => import('./gestao360Store').then(m => m.useGestao360Store as unknown as TenantStoreApi) },
  { key: 'planejamento', label: 'Planejamento (Trechos)', load: () => import('./planejamentoStore').then(m => m.usePlanejamentoStore as unknown as TenantStoreApi) },
  { key: 'rdo', label: 'RDO', load: () => import('./rdoStore').then(m => m.useRdoStore as unknown as TenantStoreApi) },
  { key: 'quantitativos', label: 'Quantitativos', load: () => import('./quantitativosStore').then(m => m.useQuantitativosStore as unknown as TenantStoreApi) },
  { key: 'bim', label: 'BIM', load: () => import('./bimStore').then(m => m.useBimStore as unknown as TenantStoreApi) },
  { key: 'lps', label: 'LPS / Lean', load: () => import('./lpsStore').then(m => m.useLpsStore as unknown as TenantStoreApi) },
  { key: 'mapa', label: 'Mapa Interativo', load: () => import('./mapaInterativoStore').then(m => m.useMapaInterativoStore as unknown as TenantStoreApi) },
  { key: 'evm', label: 'Financeiro (EVM)', load: () => import('./evmStore').then(m => m.useEvmStore as unknown as TenantStoreApi) },
  { key: 'qualidade', label: 'Qualidade (FVS)', load: () => import('./qualidadeStore').then(m => m.useQualidadeStore as unknown as TenantStoreApi) },
  { key: 'planejamento-mestre', label: 'Planejamento', load: () => import('./planejamentoMestreStore').then(m => m.usePlanejamentoMestreStore as unknown as TenantStoreApi) },
  { key: 'planejamento-restricoes', label: 'Restrições', load: () => import('./planejamentoRestricoesStore').then(m => m.usePlanejamentoRestricoesStore as unknown as TenantStoreApi) },
  { key: 'operacao-campo', label: 'Operação de Campo', load: () => import('./operacaoCampoStore').then(m => m.useOperacaoCampoStore as unknown as TenantStoreApi) },
  { key: 'rede360', label: 'Rede 360', load: () => import('./rede360Store').then(m => m.useRede360Store as unknown as TenantStoreApi) },
  { key: 'frota-veicular', label: 'Frota Veicular', load: () => import('./frotaVeicularStore').then(m => m.useFrotaVeicularStore as unknown as TenantStoreApi) },
  { key: 'medicao', label: 'Medição', load: () => import('./medicaoStore').then(m => m.useMedicaoStore as unknown as TenantStoreApi) },
  { key: 'financeiro', label: 'Financeiro', load: () => import('./financeiroStore').then(m => m.useFinanceiroStore as unknown as TenantStoreApi) },
  { key: 'plano-execucao', label: 'Planejamento de Execução', load: () => import('./planoExecucaoStore').then(m => m.usePlanoExecucaoStore as unknown as TenantStoreApi) },
  { key: 'servicos', label: 'Catálogo de Serviços', load: () => import('./servicosStore').then(m => m.useServicosStore as unknown as TenantStoreApi) },
  { key: 'company-settings', label: 'Configurações da Empresa', load: () => import('./companySettingsStore').then(m => m.useCompanySettingsStore as unknown as TenantStoreApi) },
  { key: 'economia', label: 'Economia', load: () => import('./economiaStore').then(m => m.useEconomiaStore as unknown as TenantStoreApi) },
  { key: 'manejo-financeiro', label: 'Manejo Financeiro', load: () => import('./manejoFinanceiroStore').then(m => m.useManejoFinanceiroStore as unknown as TenantStoreApi) },
  { key: 'medicao-unificada', label: 'Medição Unificada', load: () => import('./medicaoUnificadaStore').then(m => m.useMedicaoUnificadaStore as unknown as TenantStoreApi) },
  { key: 'contractors', label: 'Empreiteiros / Faturas', load: () => import('./contractorStore').then(m => m.useContractorStore as unknown as TenantStoreApi) },
  { key: 'financeiro-titulos', label: 'Pagamentos e Cobranças', load: () => import('./financeiroTitulosStore').then(m => m.useFinanceiroTitulosStore as unknown as TenantStoreApi) },
  { key: 'rateio-consumo', label: 'Rateio de Consumo', load: () => import('./rateioConsumoStore').then(m => m.useRateioConsumoStore as unknown as TenantStoreApi) },
  { key: 'laudos', label: 'Compliance de Laudos', load: () => import('./laudosStore').then(m => m.useLaudosStore as unknown as TenantStoreApi) },
  { key: 'manutencoes', label: 'Manutenções', load: () => import('./manutencoesStore').then(m => m.useManutencoesStore as unknown as TenantStoreApi) },
  { key: 'medicao-billing', label: 'Medição (Boletins)', load: () => import('./medicaoBillingStore').then(m => m.useMedicaoBillingStore as unknown as TenantStoreApi) },
]

async function getAllTenantStores(): Promise<Array<{ getState: () => TenantSyncState }>> {
  return Promise.all(TENANT_STORE_DEFS.map((d) => d.load()))
}

/** Diagnóstico por módulo: só os que têm pendências ou erro, com a mensagem real. */
export async function getSyncDiagnostics(): Promise<Array<{ key: string; label: string; pending: number; error: boolean; syncError: string | null }>> {
  if (isNonProductionDataMode()) return []
  const out: Array<{ key: string; label: string; pending: number; error: boolean; syncError: string | null }> = []
  await Promise.all(TENANT_STORE_DEFS.map(async (d) => {
    try {
      const store = await d.load()
      const st = store.getState() as TenantSyncState & { syncError?: string | null }
      const pending = st.pendingSync?.length ?? 0
      const error = st.syncStatus === 'error'
      if (pending > 0 || error) out.push({ key: d.key, label: d.label, pending, error, syncError: st.syncError ?? null })
    } catch { /* store não carregou — ignora */ }
  }))
  return out.sort((a, b) => Number(b.error) - Number(a.error) || b.pending - a.pending)
}

/** Re-tenta subir as ops paradas de todos os módulos (mesma coisa que flush em todos). */
export async function retryAllTenantStores(): Promise<void> {
  await flushAllTenantStores()
}

/** Escotilha de escape: descarta as ops não salvas de um módulo (perda de dados — confirmar antes). */
export async function discardErroredOps(storeKey: string): Promise<void> {
  const def = TENANT_STORE_DEFS.find((d) => d.key === storeKey)
  if (!def) return
  const store = await def.load()
  store.setState({ pendingSync: [], syncStatus: 'idle', syncError: null } as Partial<TenantSyncState>)
}

async function pullRealData() {
  const stores = await getAllTenantStores()
  await Promise.allSettled(stores.map((store) => store.getState().pull?.()))
  const { useMedicaoBillingStore } = await import('./medicaoBillingStore')
  await useMedicaoBillingStore.getState().loadRemote().catch(() => undefined)
}

/**
 * Sincroniza TODOS os stores tenant-scoped quando a organização ativa carrega
 * (login/troca de empresa): primeiro faz flush das ops locais ainda não
 * sincronizadas (recuperando dados criados offline ou antes do perfil), depois
 * faz pull do servidor APENAS onde a fila esvaziou — assim nunca sobrescreve
 * dado local que ainda não subiu. No modo demo/homologação, não sincroniza.
 */
/**
 * Sobe (flush) as ops pendentes de TODOS os stores tenant-scoped ANTES de qualquer
 * limpeza de cache (troca de empresa / logout). Evita perder dados criados e ainda
 * não sincronizados quando os caches locais são apagados. No-op no modo demo/homolog.
 */
export async function flushAllTenantStores(): Promise<void> {
  if (isNonProductionDataMode()) return
  const stores = await getAllTenantStores()
  await Promise.allSettled(stores.map((s) => s.getState().flush?.()))
}

export async function syncAllTenantStores(): Promise<void> {
  if (isNonProductionDataMode()) return
  const stores = await getAllTenantStores()
  // 1) flush primeiro (sobe o local-only, re-carimbando a organização ativa)
  await Promise.allSettled(stores.map((s) => s.getState().flush?.()))
  // 2) pull SEMPRE — inclusive com fila pendente. Quem protege o dado local é o
  //    `mergePull` de storeSync: ele atualiza os registros sem op pendente e mantém os
  //    pendentes. Pular a tabela quando havia qualquer pendência (a política antiga)
  //    fazia UMA op presa congelar o pull daquela tabela para sempre — o usuário nunca
  //    mais via o que os colegas cadastravam, sem sintoma nenhum.
  await Promise.allSettled(stores.map((s) => s.getState().pull?.()))
  const { useMedicaoBillingStore } = await import('./medicaoBillingStore')
  await useMedicaoBillingStore.getState().loadRemote().catch(() => undefined)
}

const savedRaw = localStorage.getItem(STORAGE_KEY)
const initialDemo: boolean = savedRaw === 'true'

export const useAppModeStore = create<AppModeState>((set) => ({
  isDemoMode: initialDemo,

  toggleDemoMode: () =>
    set((s) => {
      const next = !s.isDemoMode
      localStorage.setItem(STORAGE_KEY, String(next))

      // Cascade to all feature stores — import lazily to avoid circular deps
      if (next) {
        // Snapshot user data before overwriting with demo
        snapshotUserData()

        // Load demo data in each store
        import('./projetosStore').then(({ useProjetosStore }) => useProjetosStore.getState().loadDemoData())
        import('./agendaStore').then(({ useAgendaStore }) => useAgendaStore.getState().loadDemoData())
        import('./relatorio360Store').then(({ useRelatorio360Store }) => useRelatorio360Store.getState().loadDemoData())
        import('./equipamentosStore').then(({ useEquipamentosStore }) => useEquipamentosStore.getState().loadDemoData())
        import('./gestaoEquipamentosStore').then(({ useGestaoEquipamentosStore }) => useGestaoEquipamentosStore.getState().loadDemoData())
        import('./torreDeControleStore').then(({ useTorreStore }) => useTorreStore.getState().loadDemoData())
        import('./suprimentosStore').then(({ useSuprimentosStore }) => useSuprimentosStore.getState().loadDemoData())
        import('./preConstrucaoStore').then(({ usePreConstrucaoStore }) => usePreConstrucaoStore.getState().loadDemoData())
        import('./maoDeObraStore').then(({ useMaoDeObraStore }) => useMaoDeObraStore.getState().loadDemoData())
        import('./otimizacaoFrotaStore').then(({ useOtimizacaoFrotaStore }) => useOtimizacaoFrotaStore.getState().loadDemoData())
        import('./gestao360Store').then(({ useGestao360Store }) => useGestao360Store.getState().loadDemoData())
        import('./planejamentoStore').then(({ usePlanejamentoStore }) => usePlanejamentoStore.getState().loadDemoData())
        import('./rdoStore').then(({ useRdoStore }) => useRdoStore.getState().loadDemoData())
        import('./quantitativosStore').then(({ useQuantitativosStore }) => useQuantitativosStore.getState().loadDemoData())
        import('./bimStore').then(({ useBimStore }) => useBimStore.getState().loadDemoData())
        import('./lpsStore').then(({ useLpsStore }) => useLpsStore.getState().loadDemoData())
        import('./mapaInterativoStore').then(({ useMapaInterativoStore }) => useMapaInterativoStore.getState().loadDemoData())
        import('./evmStore').then(({ useEvmStore }) => useEvmStore.getState().loadDemoData())
        // Stores previously missing from cascade
        import('./qualidadeStore').then(({ useQualidadeStore }) => useQualidadeStore.getState().loadDemoData())
        import('./planejamentoMestreStore').then(({ usePlanejamentoMestreStore }) => usePlanejamentoMestreStore.getState().loadDemoData())
        import('./operacaoCampoStore').then(({ useOperacaoCampoStore }) => useOperacaoCampoStore.getState().loadDemoData())
        import('./rede360Store').then(({ useRede360Store }) => useRede360Store.getState().loadDemoData())
        import('./frotaVeicularStore').then(({ useFrotaVeicularStore }) => useFrotaVeicularStore.getState().loadDemoData())
        import('./medicaoStore').then(({ useMedicaoStore }) => useMedicaoStore.getState().loadDemoData())
        import('./medicaoBillingStore').then(({ useMedicaoBillingStore }) => useMedicaoBillingStore.getState().loadDemoData())
        import('./financeiroStore').then(({ useFinanceiroStore }) => useFinanceiroStore.getState().loadDemoData())
        import('./financeiroTitulosStore').then(({ useFinanceiroTitulosStore }) => useFinanceiroTitulosStore.getState().loadDemoData())
        // Predial (demo isolado): ativos/planos/OS + laudos do "Residencial Modelo".
        import('./manutencoesStore').then(({ useManutencoesStore }) => useManutencoesStore.getState().loadDemoData())
        import('./laudosStore').then(({ useLaudosStore }) => useLaudosStore.getState().loadDemoData())
      } else {
        // Try to restore user data from snapshot; fallback to clearing
        restoreUserData().then((restored) => {
          if (!restored) {
            // No snapshot — clear all stores to empty state (original behavior)
            import('./projetosStore').then(({ useProjetosStore }) => useProjetosStore.getState().clearData())
            import('./agendaStore').then(({ useAgendaStore }) => useAgendaStore.getState().clearData())
            import('./relatorio360Store').then(({ useRelatorio360Store }) => useRelatorio360Store.getState().clearData())
            import('./equipamentosStore').then(({ useEquipamentosStore }) => useEquipamentosStore.getState().clearData())
            import('./gestaoEquipamentosStore').then(({ useGestaoEquipamentosStore }) => useGestaoEquipamentosStore.getState().clearData())
            import('./torreDeControleStore').then(({ useTorreStore }) => useTorreStore.getState().clearData())
            import('./suprimentosStore').then(({ useSuprimentosStore }) => useSuprimentosStore.getState().clearData())
            import('./preConstrucaoStore').then(({ usePreConstrucaoStore }) => usePreConstrucaoStore.getState().clearData())
            import('./maoDeObraStore').then(({ useMaoDeObraStore }) => useMaoDeObraStore.getState().clearData())
            import('./otimizacaoFrotaStore').then(({ useOtimizacaoFrotaStore }) => useOtimizacaoFrotaStore.getState().clearData())
            import('./gestao360Store').then(({ useGestao360Store }) => useGestao360Store.getState().clearData())
            import('./planejamentoStore').then(({ usePlanejamentoStore }) => usePlanejamentoStore.getState().clearData())
            import('./rdoStore').then(({ useRdoStore }) => useRdoStore.getState().clearData())
            import('./quantitativosStore').then(({ useQuantitativosStore }) => useQuantitativosStore.getState().clearData())
            import('./bimStore').then(({ useBimStore }) => useBimStore.getState().clearData())
            import('./lpsStore').then(({ useLpsStore }) => useLpsStore.getState().clearData())
            import('./mapaInterativoStore').then(({ useMapaInterativoStore }) => useMapaInterativoStore.getState().clearData())
            import('./evmStore').then(({ useEvmStore }) => useEvmStore.getState().clearData())
            // Stores previously missing from cascade
            import('./qualidadeStore').then(({ useQualidadeStore }) => useQualidadeStore.getState().clearData())
            import('./planejamentoMestreStore').then(({ usePlanejamentoMestreStore }) => usePlanejamentoMestreStore.getState().clearData())
            import('./operacaoCampoStore').then(({ useOperacaoCampoStore }) => useOperacaoCampoStore.getState().clearData())
            import('./rede360Store').then(({ useRede360Store }) => useRede360Store.getState().clearData())
            import('./frotaVeicularStore').then(({ useFrotaVeicularStore }) => useFrotaVeicularStore.getState().clearData())
            import('./medicaoStore').then(({ useMedicaoStore }) => useMedicaoStore.getState().clearData())
            import('./medicaoBillingStore').then(({ useMedicaoBillingStore }) => useMedicaoBillingStore.getState().clearData())
            import('./financeiroStore').then(({ useFinanceiroStore }) => useFinanceiroStore.getState().clearData())
            import('./financeiroTitulosStore').then(({ useFinanceiroTitulosStore }) => useFinanceiroTitulosStore.getState().clearData())
            import('./manutencoesStore').then(({ useManutencoesStore }) => useManutencoesStore.getState().clearData())
            import('./laudosStore').then(({ useLaudosStore }) => useLaudosStore.getState().clearData())
            clearLocalOnlyModuleData()
          }
          void pullRealData()
        })
      }

      return { isDemoMode: next }
    }),
}))
