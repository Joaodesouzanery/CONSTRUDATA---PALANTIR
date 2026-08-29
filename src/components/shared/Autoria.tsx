/**
 * Autoria — "Criado por X em Y · Última alteração por Z em W", com o histórico completo atrás de
 * um botão. Serve qualquer módulo: recebe o nome da tabela e o id do registro, e mais nada.
 *
 * ⚠️ Lê do SERVIDOR, não do store. É de propósito: os tipos locais não carregam `created_by` nem
 * `updated_by`, e fazer 35 stores passarem a carregar seria uma mudança grande para exibir duas
 * linhas de texto. Quem preenche esses campos é o banco (gatilho `trg_updated_by`), então o
 * servidor é a única fonte que sempre os tem.
 *
 * Em Modo Demonstração NÃO consulta nada — o registro de demonstração não existe no servidor, e
 * uma consulta por id inventado só produziria erro no console.
 */
import { useEffect, useState } from 'react'
import { History, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAppModeStore } from '@/store/appModeStore'
import {
  camposAlterados, corDaAcao, rotuloDaAcao, rotuloDoRegistro, valorLegivel,
  type CorDeAcao,
} from '@/lib/auditoria'

// ─── Nomes, resolvidos uma vez por sessão ─────────────────────────────────────
// Várias telas montam <Autoria> ao mesmo tempo; sem cache seriam N consultas ao `profiles` para
// devolver os mesmos três nomes.
const nomes = new Map<string, string>()

async function resolverNomes(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const faltando = [...new Set(ids.filter((i): i is string => !!i && !nomes.has(i)))]
  if (faltando.length > 0) {
    const { data } = await supabase.from('profiles').select('id, full_name').in('id', faltando)
    for (const p of data ?? []) nomes.set(p.id as string, (p.full_name as string) ?? '—')
    // Quem não voltou (usuário removido) fica marcado, para não ser consultado de novo a cada linha.
    for (const id of faltando) if (!nomes.has(id)) nomes.set(id, 'usuário removido')
  }
  return nomes
}

function quando(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const COR: Record<CorDeAcao, string> = {
  criar:     'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  editar:    'bg-sky-500/15 text-sky-300 border-sky-500/30',
  excluir:   'bg-red-500/15 text-red-300 border-red-500/30',
  restaurar: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

// ─── A linha ──────────────────────────────────────────────────────────────────

interface AutoriaProps {
  tabela: string
  registroId: string | null | undefined
  /** Some com o botão de histórico — para linhas de lista, onde só cabe o texto. */
  semHistorico?: boolean
  className?: string
}

interface Carimbos {
  created_by?: string | null
  created_at?: string | null
  updated_by?: string | null
  updated_at?: string | null
}

export function Autoria({ tabela, registroId, semHistorico, className }: AutoriaProps) {
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)
  const [carimbos, setCarimbos] = useState<Carimbos | null>(null)
  const [porNome, setPorNome]   = useState<Map<string, string>>(new Map())
  const [aberto, setAberto]     = useState(false)

  useEffect(() => {
    if (isDemoMode || !registroId) { setCarimbos(null); return }
    let vivo = true
    ;(async () => {
      const { data } = await supabase
        .from(tabela)
        .select('created_by, created_at, updated_by, updated_at')
        .eq('id', registroId)
        .maybeSingle()
      if (!vivo || !data) return
      const c = data as Carimbos
      setCarimbos(c)
      setPorNome(new Map(await resolverNomes([c.created_by, c.updated_by])))
    })().catch(() => { /* tabela sem esses campos, ou sem permissão: a linha simplesmente não aparece */ })
    return () => { vivo = false }
  }, [tabela, registroId, isDemoMode])

  if (isDemoMode) {
    return (
      <p className={`text-[11px] text-[#6b6b6b] ${className ?? ''}`}>
        Autoria não se aplica a dados de demonstração.
      </p>
    )
  }
  if (!carimbos) return null

  const criador = carimbos.created_by ? porNome.get(carimbos.created_by) ?? '—' : null
  const editor  = carimbos.updated_by ? porNome.get(carimbos.updated_by) ?? '—' : null
  // Só vale mostrar "última alteração" se ela for diferente da criação. Repetir a mesma pessoa e a
  // mesma data em duas metades da frase faz o registro parecer editado quando ele nunca foi.
  const houveEdicao = !!carimbos.updated_at && carimbos.updated_at !== carimbos.created_at

  return (
    <>
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#6b6b6b] ${className ?? ''}`}>
        {criador && <span>Criado por <span className="text-[#a3a3a3]">{criador}</span> em {quando(carimbos.created_at)}</span>}
        {criador && houveEdicao && <span className="text-[#525252]">·</span>}
        {houveEdicao && (
          <span>Última alteração por <span className="text-[#a3a3a3]">{editor ?? '—'}</span> em {quando(carimbos.updated_at)}</span>
        )}
        {!semHistorico && registroId && (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="inline-flex items-center gap-1 rounded border border-[#525252] px-1.5 py-0.5 text-[10px] font-medium text-[#a3a3a3] transition-colors hover:border-[#f97316]/40 hover:text-[#f5f5f5]"
          >
            <History size={11} /> Histórico
          </button>
        )}
      </div>
      {aberto && registroId && (
        <HistoricoModal tabela={tabela} registroId={registroId} onClose={() => setAberto(false)} />
      )}
    </>
  )
}

// ─── O histórico completo daquele registro ────────────────────────────────────

interface LinhaLog {
  id: number
  created_at: string
  actor_id: string | null
  action: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

export function HistoricoModal({ tabela, registroId, onClose }: { tabela: string; registroId: string; onClose: () => void }) {
  const [linhas, setLinhas]   = useState<LinhaLog[] | null>(null)
  const [porNome, setPorNome] = useState<Map<string, string>>(new Map())
  const [erro, setErro]       = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      // Esta consulta usa o índice `idx_audit_table_record (table_name, record_id)`, que já existia
      // desde `0006_audit_log.sql` — é justamente para isto que ele foi criado.
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, created_at, actor_id, action, before, after')
        .eq('table_name', tabela)
        .eq('record_id', registroId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (!vivo) return
      if (error) { setErro(error.message); setLinhas([]); return }
      const rows = (data ?? []) as unknown as LinhaLog[]
      setLinhas(rows)
      setPorNome(new Map(await resolverNomes(rows.map((r) => r.actor_id))))
    })()
    return () => { vivo = false }
  }, [tabela, registroId])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl border border-[#525252] bg-[#2d2d2d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252] shrink-0">
          <div>
            <p className="text-sm font-semibold text-white">Histórico</p>
            <p className="text-[11px] text-[#9ca3af] mt-0.5">Tudo que aconteceu com este {rotuloDoRegistro(tabela)}.</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#6b6b6b] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {linhas === null ? (
            <p className="text-xs text-[#6b6b6b]">Carregando…</p>
          ) : erro ? (
            <p className="text-xs text-red-300">{erro}</p>
          ) : linhas.length === 0 ? (
            <div className="text-xs text-[#9ca3af] space-y-2">
              <p>Nenhuma alteração registrada para este {rotuloDoRegistro(tabela)}.</p>
              {/* Honestidade sobre o que o log NÃO tem: ele começa na data em que o gatilho foi
                  ligado. Sem esta frase, um registro antigo parece nunca ter sido tocado. */}
              <p className="text-[#6b6b6b]">
                O registro de alterações começou em 29/08/2026. O que aconteceu antes disso não foi
                gravado.
              </p>
            </div>
          ) : (
            <ol className="space-y-3">
              {linhas.map((l) => {
                const mudancas = camposAlterados(l.before, l.after)
                return (
                  <li key={l.id} className="rounded-lg border border-[#525252] bg-[#3d3d3d] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${COR[corDaAcao(l.action)]}`}>
                        {rotuloDaAcao(l.action)}
                      </span>
                      <span className="text-xs text-[#f5f5f5]">
                        {l.actor_id ? porNome.get(l.actor_id) ?? '—' : 'sistema'}
                      </span>
                      <span className="ml-auto text-[11px] text-[#6b6b6b]">{quando(l.created_at)}</span>
                    </div>
                    {mudancas.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {mudancas.map((m) => (
                          <li key={m.campo} className="text-[11px] flex flex-wrap items-baseline gap-1.5">
                            <span className="text-[#a3a3a3]">{m.rotulo}:</span>
                            {l.action !== 'insert' && (
                              <>
                                <span className="text-[#6b6b6b] line-through">{valorLegivel(m.antes)}</span>
                                <span className="text-[#525252]">→</span>
                              </>
                            )}
                            <span className="text-[#f5f5f5]">{valorLegivel(m.depois)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
