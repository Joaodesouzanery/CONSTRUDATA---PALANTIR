/**
 * Global application mode store.
 * Controls whether the app shows rich mock/demo data or an empty "live" state.
 *
 * When entering demo mode, the user's real data is snapshot to localStorage
 * so it can be restored when demo mode is turned off — no data loss.
 */
import { create } from 'zustand'

interface AppModeState {
  isDemoMode: boolean
  toggleDemoMode: () => void
}

const STORAGE_KEY = 'cdata-demo'
const SNAPSHOT_KEY = 'cdata-user-snapshot'

// All persist keys used by feature stores (user data that must be preserved)
const STORE_KEYS = [
  'cdata-rdo', 'cdata-suprimentos', 'cdata-agenda', 'cdata-projetos',
  'cdata-planejamento', 'cdata-quantitativos', 'cdata-relatorio360', 'cdata-bim',
  'cdata-torre-controle', 'cdata-equipamentos', 'cdata-gestao-equipamentos',
  'cdata-preconstrucao', 'cdata-mao-de-obra', 'cdata-otimizacao-frota',
  'cdata-lps', 'cdata-evm', 'cdata-mapa-interativo', 'cdata-gestao-360',
  'cdata-qualidade', 'cdata-medicao', 'cdata-medicao-billing',
  'cdata-planejamento-mestre', 'cdata-operacao-campo', 'cdata-rede-360',
  'cdata-frota-veicular', 'cdata-financeiro',
]

/** Snapshot current user data from localStorage before loading demo. */
function snapshotUserData() {
  const snapshot: Record<string, string> = {}
  for (const key of STORE_KEYS) {
    const val = localStorage.getItem(key)
    if (val) snapshot[key] = val
  }
  if (Object.keys(snapshot).length > 0) {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
    } catch {
      // localStorage full — silently continue (demo will still load)
    }
  }
}

/** Restore user data from snapshot and rehydrate all stores. */
async function restoreUserData() {
  const raw = localStorage.getItem(SNAPSHOT_KEY)
  if (!raw) return false

  try {
    const snapshot: Record<string, string> = JSON.parse(raw)
    for (const [key, val] of Object.entries(snapshot)) {
      localStorage.setItem(key, val)
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
    ])
    for (const store of stores) {
      store.persist?.rehydrate?.()
    }
    return true
  } catch {
    return false
  }
}

// Default to demo mode ON so first-time visitors see a populated platform.
const savedRaw = localStorage.getItem(STORAGE_KEY)
const initialDemo: boolean = savedRaw === null ? true : savedRaw === 'true'

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
          }
        })
      }

      return { isDemoMode: next }
    }),
}))
