import { useEffect } from 'react'
import { Wrench } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isDemoModeEnabled } from '@/lib/runtimeMode'
import { useSabespStore } from './sabespStore'
import { SabespPanel } from './SabespPanel'

/** Operacional é a cópia funcional do workbook Sabesp; Manutenções genéricas vivem no Predial. */
export function OperacionalPage() {
  const profileOrgId = useAuth((s) => s.profile?.organization_id)
  const ensureTenantScope = useSabespStore((s) => s.ensureTenantScope)
  const flush = useSabespStore((s) => s.flush)
  const pull = useSabespStore((s) => s.pull)

  // Mesmo ciclo dos outros módulos: carimba a empresa, sobe o pendente, puxa o servidor.
  // ⚠️ Antes disto o módulo não tinha ciclo nenhum — nem `ensureTenantScope`, nem pull.
  useEffect(() => {
    if (!profileOrgId) return
    ensureTenantScope(profileOrgId)
    if (isDemoModeEnabled()) return
    void (async () => { await flush(); await pull() })()
  }, [ensureTenantScope, flush, profileOrgId, pull])

  return (
    // ⚠️ `min-h-full`, NUNCA `h-full`. Com `h-full` a página fica exatamente da altura do
    // `<main class="app-main">` do AppShell — que é quem rola no app inteiro — e aí o main não tem
    // o que rolar: a rolagem cai num pane interno e a planilha fica presa numa janelinha de 300px
    // no meio da tela. É o padrão do `relatorio360`, o único módulo que já rolava a página.
    <div className="flex min-h-full flex-col bg-[#1f1f1f]">
      {/* ⚠️ NÃO é sticky, de propósito. Quem precisa grudar é o cabeçalho da TABELA — e dois
          elementos grudados no topo brigam: o `<thead sticky top-0>` ficaria escondido atrás deste.
          Deixando este rolar, a planilha ganha a tela inteira, que é o que o módulo precisa. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-[#525252] bg-[#2c2c2c] px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f97316] text-white">
          <Wrench size={20} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[#f5f5f5]">Operacional</h1>
          <p className="text-xs text-[#a3a3a3]">Controle operacional e financeiro contratual Sabesp</p>
        </div>
      </header>
      <SabespPanel />
    </div>
  )
}
