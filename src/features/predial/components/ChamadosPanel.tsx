/**
 * ChamadosPanel — chamados do prédio: lista em cards (não tabela, é mobile-first para o zelador
 * em campo) + "Abrir chamado" reusando o QuickChamadoModal (Sistema → Componente → Sintoma →
 * matriz de prioridade), com a triagem da fila do QR público no topo. Sem papel novo de auth —
 * é qualquer membro autenticado da org; a lista é escopada pela obra ativa. Local-first.
 *
 * ── POR QUE VIROU ABA ─────────────────────────────────────────────────────────────────────────
 * Era a página `/app/chamados`, irmã do Predial no menu. Duas coisas justificam a mudança: um
 * chamado **é** uma `MaintenanceWorkOrder` — a mesma tabela e o mesmo dado que a aba
 * "Manutenções" do Predial já mostra —, e a triagem dos chamados vindos do QR público só existia
 * aqui, então quem abria o Predial não via a fila do QR. `/app/chamados` continua funcionando:
 * virou um redirecionamento para esta aba, e o QR impresso aponta para `/chamado/:slug`, que é
 * rota pública separada e não foi tocada.
 *
 * Como aba, dois detalhes de layout mudam em relação à página: o cabeçalho próprio some (o
 * PredialHeader já está acima, e dois títulos empilhados desperdiçam meia tela no celular), e o
 * botão de abrir chamado deixa de ser `fixed` — preso à viewport ele cobria o rodapé do app —
 * para ser `sticky` dentro da própria rolagem do painel.
 */
import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, ClipboardList, Plus, RefreshCcw } from 'lucide-react'
import { cn, hojeLocalISO } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { useManutencoesStore, type MaintenanceWorkOrder } from '@/store/manutencoesStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { QuickChamadoModal } from '@/features/manutencoes/index'
import { TriagemChamadosPublicosPanel } from './TriagemChamadosPublicosPanel'

const STATUS: Record<string, { label: string; cls: string }> = {
  pendente:       { label: 'Pendente', cls: 'bg-[#f59e0b]/15 text-[#fbbf24] border-[#f59e0b]/30' },
  em_processo:    { label: 'Em processo', cls: 'bg-[#38bdf8]/15 text-[#7dd3fc] border-[#38bdf8]/30' },
  em_verificacao: { label: 'Aguardando validação', cls: 'bg-[#a78bfa]/15 text-[#c4b5fd] border-[#a78bfa]/30' },
  concluida:      { label: 'Concluída', cls: 'bg-[#22c55e]/15 text-[#4ade80] border-[#22c55e]/30' },
  cancelada:      { label: 'Cancelada', cls: 'bg-[#525252]/40 text-[#a3a3a3] border-[#525252]' },
}
const PRIORIDADE: Record<string, { label: string; cls: string }> = {
  baixa:  { label: 'Baixa', cls: 'text-[#a3a3a3]' },
  media:  { label: 'Média', cls: 'text-[#7dd3fc]' },
  alta:   { label: 'Alta', cls: 'text-[#fbbf24]' },
  critica:{ label: 'Crítica', cls: 'text-[#f87171]' },
}
const fmtBR = (iso?: string | null) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : null)

export function ChamadosPanel() {
  const orgId = useAuth((s) => s.profile?.organization_id ?? null)
  const ensure = useManutencoesStore((s) => s.ensureTenantScope)
  const pull = useManutencoesStore((s) => s.pull)
  const syncStatus = useManutencoesStore((s) => s.syncStatus)
  const allWO = useManutencoesStore((s) => s.workOrders)
  const assets = useManutencoesStore((s) => s.assets)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const sites = useTorreStore((s) => s.sites)
  const pullTorre = useTorreStore((s) => s.pull)
  const [aberto, setAberto] = useState(true)
  const [quick, setQuick] = useState(false)

  useEffect(() => {
    if (!orgId) return
    ensure(orgId); void pull(); void pullTorre()
  }, [orgId, ensure, pull, pullTorre])

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])
  const scopedAssets = useMemo(() => (activeObraId ? assets.filter((a) => (a.constructionSiteId ?? null) === activeObraId) : assets), [assets, activeObraId])
  // `hojeLocalISO`, não `toISOString()`: depois das 21h no Brasil o UTC já é amanhã, e um
  // chamado que vence hoje aparecia marcado como vencido em vermelho.
  const hoje = hojeLocalISO()

  const lista = useMemo(() => {
    const scoped = activeObraId ? allWO.filter((w) => (w.constructionSiteId ?? null) === activeObraId) : allWO
    const filtered = aberto ? scoped.filter((w) => w.status !== 'concluida' && w.status !== 'cancelada') : scoped
    // Abertos primeiro; dentro disso, por prazo (mais urgente no topo).
    return [...filtered].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
  }, [allWO, activeObraId, aberto])

  const obraNome = activeObraId ? (sites.find((s) => s.id === activeObraId)?.name ?? 'Prédio') : 'Todos os prédios'

  function assetLoc(w: MaintenanceWorkOrder): string | null {
    const a = w.assetIds?.map((id) => assetById.get(id)).find(Boolean)
    if (!a) return null
    const loc = [a.torre, a.pavimento, a.ambiente].filter(Boolean).join(' · ') || a.location
    return [a.name, loc].filter(Boolean).join(' — ') || null
  }

  return (
    <div className="flex h-full flex-col bg-[#303030] text-[#f5f5f5]">
      {/* Sem <h1>: o título do módulo já está no PredialHeader logo acima. Aqui fica só o que
          é desta aba — o prédio em escopo, o filtro e o atualizar. */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#525252] bg-[#2c2c2c] px-4 py-2.5">
        <ClipboardList size={16} className="shrink-0 text-[#f97316]" />
        <p className="min-w-0 truncate text-sm font-semibold">{obraNome}</p>
        <div className="flex items-center gap-1">
          {([['abertos', true], ['todos', false]] as const).map(([label, v]) => (
            <button key={label} onClick={() => setAberto(v)} className={cn('rounded-lg px-3 py-1.5 text-sm font-medium capitalize', aberto === v ? 'bg-[#3d3d3d] text-white' : 'text-[#a3a3a3]')}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={() => void pull()} className="ml-auto rounded-lg border border-[#525252] bg-[#3a3a3a] p-2 text-[#a3a3a3] hover:text-white" title="Atualizar">
          <RefreshCcw size={16} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4 pb-2">
        <TriagemChamadosPublicosPanel />
        {lista.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-[#525252] p-8 text-center text-sm text-[#6b6b6b]">
            {aberto ? 'Nenhum chamado aberto.' : 'Nenhum chamado.'}
          </div>
        ) : lista.map((w) => {
          const st = STATUS[w.status] ?? { label: w.status, cls: 'border-[#525252] text-[#a3a3a3]' }
          const pr = PRIORIDADE[w.priority] ?? { label: w.priority, cls: 'text-[#a3a3a3]' }
          const atrasado = w.status !== 'concluida' && w.status !== 'cancelada' && !!w.dueDate && w.dueDate < hoje
          const loc = assetLoc(w)
          return (
            <div key={w.id} className="rounded-xl border border-[#525252] bg-[#333333] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-semibold text-[#f5f5f5]">{w.title || w.code}</p>
                <span className={cn('shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold', st.cls)}>{st.label}</span>
              </div>
              {loc && <p className="mt-1 truncate text-xs text-[#a3a3a3]">{loc}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                <span className="text-[#737373]">{w.code}</span>
                <span className={pr.cls}>● {pr.label}</span>
                {w.dueDate && (
                  <span className={cn('inline-flex items-center gap-1', atrasado ? 'font-semibold text-[#f87171]' : 'text-[#a3a3a3]')}>
                    <CalendarClock size={12} /> {atrasado ? 'Venceu ' : 'Prazo '}{fmtBR(w.dueDate)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Dentro do fluxo, não `fixed`: preso à viewport este botão flutuava sobre o rodapé do
          app e sobre as outras abas do Predial. */}
      <div className="shrink-0 border-t border-[#525252] bg-[#2c2c2c] p-3">
        <button
          type="button"
          onClick={() => setQuick(true)}
          className="mx-auto flex items-center gap-2 rounded-full bg-[#f97316] px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-[#ea580c]"
        >
          <Plus size={18} /> Abrir chamado
        </button>
      </div>

      {quick && <QuickChamadoModal assets={scopedAssets} onClose={() => setQuick(false)} />}
    </div>
  )
}
