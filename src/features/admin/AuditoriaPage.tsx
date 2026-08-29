/**
 * AuditoriaPage — a tela global de auditoria, para diretoria e owner.
 *
 * Mostra tudo que aconteceu na organização: quem criou, editou e excluiu o quê, em que módulo e
 * quando. É alimentada pelo gatilho genérico `registrar_auditoria` (migração `20260829120000`),
 * que cobre toda tabela com `organization_id`.
 *
 * ⚠️ A leitura ampla é feita pela RPC `auditoria_da_organizacao`, não pela tabela. A RPC tem o gate
 * de papel dentro dela (`has_role(['diretor','owner'])`) e devolve o NOME do ator já resolvido —
 * a tela nunca vê UUID cru. O gate de tela abaixo é conveniência: quem burlar a tela esbarra na
 * RPC do mesmo jeito.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { History, ShieldAlert, Filter, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { HistoricoModal } from '@/components/shared/Autoria'
import {
  acoesConhecidas, camposAlterados, corDaAcao, modulosConhecidos, rotuloDaAcao,
  rotuloDoModulo, rotuloDoRegistro, valorLegivel, type CorDeAcao,
} from '@/lib/auditoria'

const POR_PAGINA = 50

const COR: Record<CorDeAcao, string> = {
  criar:     'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  editar:    'bg-sky-500/15 text-sky-300 border-sky-500/30',
  excluir:   'bg-red-500/15 text-red-300 border-red-500/30',
  restaurar: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

interface LinhaAuditoria {
  id: number
  created_at: string
  actor_id: string | null
  actor_nome: string | null
  action: string
  table_name: string
  record_id: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

interface Pessoa { id: string; full_name: string | null }

function inputParaISO(v: string, fimDoDia: boolean): string | null {
  if (!v) return null
  const d = new Date(`${v}T${fimDoDia ? '23:59:59' : '00:00:00'}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function AuditoriaPage() {
  const profile = useAuth((s) => s.profile)
  const podeVer = profile?.role === 'owner' || profile?.role === 'diretor'

  const [linhas,  setLinhas]  = useState<LinhaAuditoria[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro,    setErro]    = useState<string | null>(null)
  const [pagina,  setPagina]  = useState(0)
  const [detalhe, setDetalhe] = useState<{ tabela: string; id: string } | null>(null)

  // Filtros
  const [de,     setDe]     = useState('')
  const [ate,    setAte]    = useState('')
  const [ator,   setAtor]   = useState('')
  const [modulo, setModulo] = useState('')
  const [acao,   setAcao]   = useState('')

  const modulos = useMemo(() => modulosConhecidos(), [])
  const acoes   = useMemo(
    () => acoesConhecidas().sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR')),
    [],
  )

  // ⚠️ O filtro por MÓDULO vira vários filtros por tabela — a RPC recebe uma tabela por vez. Com
  // mais de uma tabela no módulo, filtramos aqui em cima do resultado; com uma só, mandamos para o
  // servidor, que é mais barato.
  const tabelasDoModulo = useMemo(
    () => (modulo ? modulos.find((m) => m.modulo === modulo)?.tabelas ?? [] : []),
    [modulo, modulos],
  )

  const buscar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    const { data, error } = await supabase.rpc('auditoria_da_organizacao', {
      p_de:     inputParaISO(de, false),
      p_ate:    inputParaISO(ate, true),
      p_actor:  ator || null,
      p_tabela: tabelasDoModulo.length === 1 ? tabelasDoModulo[0] : null,
      p_acao:   acao || null,
      p_limite: POR_PAGINA,
      p_deslocamento: pagina * POR_PAGINA,
    })
    if (error) setErro(error.message)
    else setLinhas((data ?? []) as LinhaAuditoria[])
    setCarregando(false)
  }, [de, ate, ator, acao, pagina, tabelasDoModulo])

  useEffect(() => { if (podeVer) void buscar() }, [podeVer, buscar])

  useEffect(() => {
    if (!podeVer || !profile) return
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('organization_id', profile.organization_id)
        .order('full_name')
      setPessoas((data ?? []) as Pessoa[])
    })()
  }, [podeVer, profile])

  // Quando o módulo tem várias tabelas, o corte final é aqui.
  const visiveis = useMemo(
    () => (tabelasDoModulo.length > 1 ? linhas.filter((l) => tabelasDoModulo.includes(l.table_name)) : linhas),
    [linhas, tabelasDoModulo],
  )

  const limparFiltros = () => { setDe(''); setAte(''); setAtor(''); setModulo(''); setAcao(''); setPagina(0) }
  const temFiltro = !!(de || ate || ator || modulo || acao)

  if (!podeVer) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-amber-200">
          <ShieldAlert size={20} className="shrink-0" />
          <div>
            <p className="font-semibold mb-1">Acesso restrito</p>
            <p className="text-sm">
              A auditoria da empresa é da diretoria. O histórico de cada registro continua visível
              dentro do próprio módulo, no botão “Histórico”.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#f97316]/15">
          <History size={18} className="text-[#f97316]" />
        </div>
        <div>
          <h1 className="text-[#f5f5f5] text-lg font-semibold leading-none">Auditoria</h1>
          <p className="text-[#6b6b6b] text-xs mt-0.5">
            Toda criação, edição e exclusão da empresa. O registro é imutável — nem o owner apaga.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void buscar()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-xs font-medium text-[#a3a3a3] transition-colors hover:border-[#f97316]/40 hover:text-[#f5f5f5]"
        >
          <RotateCw size={13} /> Atualizar
        </button>
      </div>

      {/* ── Filtros ── */}
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={13} className="text-[#6b6b6b]" />
          <span className="text-xs font-semibold text-[#a3a3a3]">Filtros</span>
          {temFiltro && (
            <button type="button" onClick={limparFiltros} className="ml-auto text-[11px] text-[#f97316] hover:underline">
              Limpar
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Campo rotulo="De">
            <input type="date" value={de} onChange={(e) => { setDe(e.target.value); setPagina(0) }} className={ENTRADA} />
          </Campo>
          <Campo rotulo="Até">
            <input type="date" value={ate} onChange={(e) => { setAte(e.target.value); setPagina(0) }} className={ENTRADA} />
          </Campo>
          <Campo rotulo="Usuário">
            <select value={ator} onChange={(e) => { setAtor(e.target.value); setPagina(0) }} className={ENTRADA}>
              <option value="">Todos</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0, 8)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Módulo">
            <select value={modulo} onChange={(e) => { setModulo(e.target.value); setPagina(0) }} className={ENTRADA}>
              <option value="">Todos</option>
              {modulos.map((m) => <option key={m.modulo} value={m.modulo}>{m.modulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Tipo de ação">
            <select value={acao} onChange={(e) => { setAcao(e.target.value); setPagina(0) }} className={ENTRADA}>
              <option value="">Todas</option>
              {acoes.map((a) => <option key={a.acao} value={a.acao}>{a.rotulo}</option>)}
            </select>
          </Campo>
        </div>
        {tabelasDoModulo.length > 1 && (
          <p className="mt-2 text-[10px] text-[#6b6b6b]">
            O módulo “{modulo}” cobre {tabelasDoModulo.length} tabelas; o corte é feito sobre a
            página carregada, então algumas páginas podem vir mais curtas.
          </p>
        )}
      </div>

      {erro && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{erro}</div>
      )}

      {/* ── Lista ── */}
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] overflow-hidden">
        {carregando ? (
          <p className="p-6 text-sm text-[#6b6b6b]">Carregando…</p>
        ) : visiveis.length === 0 ? (
          <div className="p-6 text-sm text-[#9ca3af]">
            <p>{temFiltro ? 'Nada encontrado com esses filtros.' : 'Nenhum registro ainda.'}</p>
            {!temFiltro && (
              <p className="text-[#6b6b6b] text-xs mt-1">
                O registro de alterações começou em 29/08/2026; o que aconteceu antes não foi gravado.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wide text-[#6b6b6b] border-b border-[#525252]">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Quando</th>
                  <th className="text-left px-4 py-2 font-semibold">Quem</th>
                  <th className="text-left px-4 py-2 font-semibold">Ação</th>
                  <th className="text-left px-4 py-2 font-semibold">Módulo</th>
                  <th className="text-left px-4 py-2 font-semibold">O que mudou</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => {
                  const mudancas = camposAlterados(l.before, l.after)
                  return (
                    <tr key={l.id} className="border-b border-[#525252]/50 last:border-0 hover:bg-[#454545]">
                      <td className="px-4 py-2.5 text-[11px] text-[#a3a3a3] whitespace-nowrap align-top">
                        {new Date(l.created_at).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#f5f5f5] align-top">
                        {l.actor_nome ?? (l.actor_id ? 'usuário removido' : 'sistema')}
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${COR[corDaAcao(l.action)]}`}>
                          {rotuloDaAcao(l.action)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#a3a3a3] align-top whitespace-nowrap">
                        {rotuloDoModulo(l.table_name)}
                        <span className="block text-[10px] text-[#6b6b6b]">{rotuloDoRegistro(l.table_name)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-[#a3a3a3] align-top">
                        {mudancas.length === 0 ? (
                          <span className="text-[#6b6b6b]">—</span>
                        ) : (
                          <>
                            {mudancas.slice(0, 3).map((m) => (
                              <span key={m.campo} className="block">
                                <span className="text-[#6b6b6b]">{m.rotulo}:</span>{' '}
                                {l.action !== 'insert' && (
                                  <><span className="text-[#6b6b6b] line-through">{valorLegivel(m.antes)}</span> → </>
                                )}
                                <span className="text-[#f5f5f5]">{valorLegivel(m.depois)}</span>
                              </span>
                            ))}
                            {mudancas.length > 3 && (
                              <span className="block text-[#6b6b6b]">+{mudancas.length - 3} campo(s)</span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-2.5 align-top text-right">
                        {l.record_id && (
                          <button
                            type="button"
                            onClick={() => setDetalhe({ tabela: l.table_name, id: l.record_id! })}
                            className="text-[10px] text-[#f97316] hover:underline whitespace-nowrap"
                          >
                            Ver histórico
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Paginação ── */}
      {/* Sem contagem total: contar o log inteiro a cada página é caro e não muda decisão nenhuma.
          O botão de avançar some quando a página vem incompleta, que é o sinal de fim. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pagina === 0}
          onClick={() => setPagina((p) => Math.max(0, p - 1))}
          className={BOTAO_PAGINA}
        >
          <ChevronLeft size={13} /> Anterior
        </button>
        <span className="text-[11px] text-[#6b6b6b]">Página {pagina + 1}</span>
        <button
          type="button"
          disabled={linhas.length < POR_PAGINA}
          onClick={() => setPagina((p) => p + 1)}
          className={BOTAO_PAGINA}
        >
          Próxima <ChevronRight size={13} />
        </button>
      </div>

      {detalhe && (
        <HistoricoModal tabela={detalhe.tabela} registroId={detalhe.id} onClose={() => setDetalhe(null)} />
      )}
    </div>
  )
}

const ENTRADA =
  'w-full rounded-lg border border-[#525252] bg-[#2d2d2d] px-2 py-1.5 text-xs text-[#f5f5f5] focus:border-[#f97316] focus:outline-none'

const BOTAO_PAGINA =
  'inline-flex items-center gap-1 rounded-lg border border-[#525252] px-3 py-1.5 text-xs font-medium text-[#a3a3a3] transition-colors hover:border-[#f97316]/40 hover:text-[#f5f5f5] disabled:opacity-40 disabled:hover:border-[#525252] disabled:hover:text-[#a3a3a3]'

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">{rotulo}</span>
      {children}
    </label>
  )
}
