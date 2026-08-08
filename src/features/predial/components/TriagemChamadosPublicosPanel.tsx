/**
 * TriagemChamadosPublicosPanel — o síndico/zelador (logado) vê os chamados abertos pelo QR
 * público (tabela predial_chamados_publicos, status='novo') e os TRIA: "Converter em OS" cria
 * uma MaintenanceWorkOrder real via addWorkOrder (created_by = o triador) ou "Descartar". Leitura
 * autenticada via RLS (só a própria org). Indisponível em modo Demonstração (não puxa dado real).
 */
import { useCallback, useEffect, useState } from 'react'
import { Check, Inbox, RefreshCcw, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useManutencoesStore } from '@/store/manutencoesStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { isNonProductionDataMode } from '@/lib/runtimeMode'
import { cn } from '@/lib/utils'

interface ChamadoPublico {
  id: string
  construction_site_id: string | null
  sistema: string | null
  componente: string | null
  sintoma: string | null
  impacto: 'baixa' | 'media' | 'alta'
  urgencia: 'baixa' | 'media' | 'alta'
  prioridade: 'baixa' | 'media' | 'alta' | 'critica'
  descricao: string | null
  solicitante_nome: string | null
  solicitante_contato: string | null
  local_texto: string | null
  created_at: string
}

const PRIO_CLS: Record<string, string> = {
  critica: 'text-[#f87171] bg-[#ef4444]/10',
  alta: 'text-[#fbbf24] bg-[#f59e0b]/10',
  media: 'text-[#7dd3fc] bg-[#38bdf8]/10',
  baixa: 'text-[#a3a3a3] bg-white/5',
}

export function TriagemChamadosPublicosPanel() {
  const orgId = useAuth((s) => s.profile?.organization_id ?? null)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const addWorkOrder = useManutencoesStore((s) => s.addWorkOrder)
  const demo = isNonProductionDataMode()
  const [chamados, setChamados] = useState<ChamadoPublico[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // RLS já filtra por organização; só puxamos os pendentes de triagem. Retorna as linhas (não
  // faz setState) para o effect poder aplicar de forma assíncrona (evita set-state-in-effect).
  const fetchChamados = useCallback(async (): Promise<ChamadoPublico[]> => {
    if (!orgId || demo) return []
    let q = supabase.from('predial_chamados_publicos').select('*').eq('status', 'novo')
    // Escopa pelo prédio ativo (consistente com a página). Só filtra quando HÁ obra selecionada:
    // com activeObraId null ("Todos os prédios") um .eq(...null) não retornaria nada.
    if (activeObraId) q = q.eq('construction_site_id', activeObraId)
    const { data } = await q.order('created_at', { ascending: false })
    return (data ?? []) as ChamadoPublico[]
  }, [orgId, demo, activeObraId])

  useEffect(() => {
    let ok = true
    void fetchChamados().then((rows) => { if (ok) setChamados(rows) })
    return () => { ok = false }
  }, [fetchChamados])

  // Refresh manual (handler de clique — pode setState livremente, não é effect).
  async function refresh() {
    setLoading(true)
    setChamados(await fetchChamados())
    setLoading(false)
  }

  async function converter(c: ChamadoPublico) {
    setBusyId(c.id)
    const titulo = [c.sistema, c.componente, c.sintoma].filter(Boolean).join(' · ') || 'Chamado público'
    const desc = `Chamado aberto pelo QR público.${c.descricao ? ` ${c.descricao}` : ''}\nLocal: ${c.local_texto || '—'} · Solicitante: ${c.solicitante_nome || '—'}${c.solicitante_contato ? ` (${c.solicitante_contato})` : ''}`
    const woId = await addWorkOrder({
      title: titulo,
      description: desc,
      status: 'pendente',
      planned: false,
      priority: c.prioridade,
      severity: c.prioridade,
      impacto: c.impacto,
      urgencia: c.urgencia,
      requester: c.solicitante_nome || 'Chamado público',
      assetIds: [],
      projectId: null,
      constructionSiteId: c.construction_site_id,
    })
    if (!woId) { setBusyId(null); return }
    // A OS é local-first (otimista + fila). Só linka o FK work_order_id DEPOIS que ela subiu ao
    // servidor — senão o UPDATE viola a FK (a OS ainda não existe no banco) e falharia em silêncio.
    await useManutencoesStore.getState().flush()
    const pendente = useManutencoesStore.getState().pendingSync.some((op) => op.table === 'maintenance_work_orders' && op.recordId === woId)
    if (pendente) { setBusyId(null); return }   // offline/não confirmada — mantém na triagem p/ tentar depois
    const { error } = await supabase.from('predial_chamados_publicos').update({ status: 'convertido', work_order_id: woId, updated_at: new Date().toISOString() }).eq('id', c.id)
    if (!error) setChamados((list) => list.filter((x) => x.id !== c.id))
    setBusyId(null)
  }

  async function descartar(c: ChamadoPublico) {
    setBusyId(c.id)
    await supabase.from('predial_chamados_publicos').update({ status: 'descartado', updated_at: new Date().toISOString() }).eq('id', c.id)
    setChamados((list) => list.filter((x) => x.id !== c.id))
    setBusyId(null)
  }

  if (demo || (!loading && chamados.length === 0)) return null

  return (
    <div className="rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/[0.06] p-3">
      <div className="mb-2 flex items-center gap-2">
        <Inbox size={15} className="text-[#fbbf24]" />
        <p className="text-xs font-semibold uppercase tracking-wider text-[#fbbf24]">Chamados públicos aguardando triagem ({chamados.length})</p>
        <button onClick={() => void refresh()} className="ml-auto rounded p-1 text-[#a3a3a3] hover:text-white" title="Atualizar"><RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /></button>
      </div>
      <div className="space-y-2">
        {chamados.map((c) => (
          <div key={c.id} className="rounded-lg border border-[#525252] bg-[#333333] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', PRIO_CLS[c.prioridade])}>{c.prioridade}</span>
                  <p className="truncate text-sm font-semibold text-white">{[c.sistema, c.componente, c.sintoma].filter(Boolean).join(' · ') || 'Chamado'}</p>
                </div>
                {c.descricao && <p className="mt-1 text-xs text-[#d4d4d4]">{c.descricao}</p>}
                <p className="mt-1 text-[11px] text-[#6b6b6b]">
                  {c.local_texto ? `${c.local_texto} · ` : ''}{c.solicitante_nome || 'anônimo'}{c.solicitante_contato ? ` · ${c.solicitante_contato}` : ''} · {new Date(c.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button disabled={busyId === c.id} onClick={() => void converter(c)} title="Converter em OS" className="inline-flex items-center gap-1 rounded-lg bg-[#f97316] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#ea580c] disabled:opacity-60"><Check size={13} /> OS</button>
                <button disabled={busyId === c.id} onClick={() => void descartar(c)} title="Descartar" className="rounded-lg border border-[#525252] p-1.5 text-[#a3a3a3] hover:bg-red-500/20 hover:text-red-400 disabled:opacity-60"><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
