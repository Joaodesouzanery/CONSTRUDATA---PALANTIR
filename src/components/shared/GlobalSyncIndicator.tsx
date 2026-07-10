/**
 * GlobalSyncIndicator — na sidebar, abaixo do seletor de organização.
 * - Modo demo/homologação: avisa que nada é salvo no servidor.
 * - Produção: mostra "Tudo salvo" ou "N não salvo(s)" agregando a fila de todos
 *   os módulos (o usuário vê quando algo ainda não subiu para a nuvem).
 */
import { useEffect, useState } from 'react'
import { FlaskConical, Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { useAppModeStore, getPendingSummary } from '@/store/appModeStore'
import { useAuth } from '@/lib/auth'
import { isDemoModeEnabled } from '@/lib/runtimeMode'

export function GlobalSyncIndicator({ expanded }: { expanded: boolean }) {
  // Reage à troca de modo demo e de organização ativa.
  useAppModeStore((s) => s.isDemoMode)
  const orgId = useAuth((s) => s.profile?.organization_id)

  const [summary, setSummary] = useState<{ pending: number; error: boolean; syncing: boolean }>({ pending: 0, error: false, syncing: false })
  const demo = isDemoModeEnabled()

  useEffect(() => {
    if (demo) return
    let alive = true
    const tick = () => { void getPendingSummary().then((s) => { if (alive) setSummary(s) }) }
    tick()
    const t = window.setInterval(tick, 4000)
    return () => { alive = false; window.clearInterval(t) }
  }, [demo, orgId])

  // ── Demo/homologação: nada é salvo ──
  if (demo) {
    if (!expanded) return (
      <div className="flex justify-center py-1" title="Modo demo/homologação — alterações NÃO são salvas no servidor.">
        <span className="size-2 rounded-full bg-[#eab308]" />
      </div>
    )
    return (
      <div className="mx-2 my-1 flex items-start gap-2 rounded-lg border border-[#eab308]/30 bg-[#eab308]/10 px-2.5 py-1.5 text-[10px] leading-snug text-[#eab308]">
        <FlaskConical size={13} className="mt-0.5 shrink-0" />
        <span>Modo demo/homologação — alterações <b>não</b> são salvas no servidor.</span>
      </div>
    )
  }

  // ── Produção ──
  const { pending, error, syncing } = summary
  const dirty = pending > 0 || error
  const tone = error ? '#f87171' : dirty ? '#eab308' : syncing ? '#60a5fa' : '#4ade80'
  const Icon = error ? AlertTriangle : dirty ? CloudOff : syncing ? RefreshCw : Cloud
  const label = error ? `${pending} não salvo(s) — erro` : dirty ? `${pending} não salvo(s)` : syncing ? 'Sincronizando…' : 'Tudo salvo na nuvem'
  const title = dirty ? 'Há alterações ainda não salvas na nuvem. Verifique sua conexão; elas sobem automaticamente.' : label

  if (!expanded) return (
    <div className="flex justify-center py-1" title={title}>
      <span className="size-2 rounded-full" style={{ backgroundColor: tone }} />
    </div>
  )
  return (
    <div className="mx-2 my-1 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] leading-snug"
      style={{ borderColor: `${tone}55`, background: `${tone}18`, color: tone }} title={title}>
      <Icon size={13} className={`shrink-0 ${syncing && !dirty ? 'animate-spin' : ''}`} />
      <span>{label}</span>
    </div>
  )
}
