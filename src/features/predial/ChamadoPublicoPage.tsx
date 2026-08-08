/**
 * ChamadoPublicoPage — rota PÚBLICA (sem login) para o morador/zelador abrir um chamado de
 * manutenção via QR do prédio: Sistema → Componente → Sintoma + descrição + local + contato.
 * Não seleciona ativo (o morador não conhece o inventário). Grava via a RPC anônima
 * `abrir_chamado_publico` (o servidor resolve a organização pelo slug — o cliente nunca envia
 * organization_id). Anti-spam: honeypot (campo escondido) + rate-limit no servidor. Reusa o
 * catálogo puro chamadoCatalogo (sem arrastar o store no bundle anônimo).
 */
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Building2, CheckCircle2, Loader2, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { SISTEMAS_CHAMADO, componentesDoSistema, SINTOMAS, IU_LABELS } from '@/features/manutencoes/utils/chamadoCatalogo'
import type { ImpactoUrgencia } from '@/store/manutencoesStore'

const inputCls = 'w-full rounded-lg border border-[#3f3f3f] bg-[#262626] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#6b6b6b] focus:border-[#f97316]'
const labelCls = 'mb-1 block text-xs font-semibold text-[#a3a3a3]'

export function ChamadoPublicoPage() {
  const { slug = '' } = useParams()
  const [sistema, setSistema] = useState('')
  const [componente, setComponente] = useState('')
  const [sintoma, setSintoma] = useState('')
  const [urgencia, setUrgencia] = useState<ImpactoUrgencia>('media')
  const [descricao, setDescricao] = useState('')
  const [local, setLocal] = useState('')
  const [nome, setNome] = useState('')
  const [contato, setContato] = useState('')
  const [honeypot, setHoneypot] = useState('')   // campo-armadilha: humano não vê/preenche
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const componentes = componentesDoSistema(sistema)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!sistema) { setErro('Escolha o sistema (o que apresentou problema).'); return }
    if (!descricao.trim() && !sintoma) { setErro('Descreva o problema ou escolha um sintoma.'); return }
    setEnviando(true)
    const { error } = await supabase.rpc('abrir_chamado_publico', {
      p_slug: slug,
      p_sistema: sistema || null,
      p_componente: componente || null,
      p_sintoma: sintoma || null,
      p_impacto: 'media',
      p_urgencia: urgencia,
      p_descricao: descricao.trim() || null,
      p_nome: nome.trim() || null,
      p_contato: contato.trim() || null,
      p_local: local.trim() || null,
      p_honeypot: honeypot,
    })
    setEnviando(false)
    if (error) { setErro(error.message || 'Não foi possível abrir o chamado. Tente novamente.'); return }
    setOk(true)
  }

  return (
    <div className="min-h-screen bg-[#1c1c1c] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f97316]"><Building2 size={22} className="text-white" /></div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Abrir chamado de manutenção</h1>
            <p className="text-xs text-[#a3a3a3]">Descreva o problema — a administração recebe e cuida.</p>
          </div>
        </div>

        {ok ? (
          <div className="rounded-2xl border border-[#3f3f3f] bg-[#262626] p-6 text-center">
            <CheckCircle2 size={40} className="mx-auto mb-3 text-[#4ade80]" />
            <h2 className="text-base font-bold">Chamado enviado!</h2>
            <p className="mt-1 text-sm text-[#a3a3a3]">A administração do prédio foi notificada e vai avaliar o seu chamado. Obrigado.</p>
            <button onClick={() => { setOk(false); setSistema(''); setComponente(''); setSintoma(''); setDescricao(''); setLocal(''); setNome(''); setContato(''); setUrgencia('media') }} className="mt-5 rounded-lg border border-[#525252] px-4 py-2 text-sm font-semibold text-[#e5e5e5] hover:bg-[#333333]">Abrir outro chamado</button>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-4 rounded-2xl border border-[#3f3f3f] bg-[#262626] p-5">
            <div>
              <label className={labelCls}>Sistema *</label>
              <select value={sistema} onChange={(e) => { setSistema(e.target.value); setComponente('') }} className={inputCls}>
                <option value="">Selecione…</option>
                {SISTEMAS_CHAMADO.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {sistema && (
              <div>
                <label className={labelCls}>O que apresentou problema?</label>
                <select value={componente} onChange={(e) => setComponente(e.target.value)} className={inputCls}>
                  <option value="">— (opcional)</option>
                  {componentes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>Sintoma</label>
              <select value={sintoma} onChange={(e) => setSintoma(e.target.value)} className={inputCls}>
                <option value="">— (opcional)</option>
                {SINTOMAS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Descreva o problema</label>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Ex.: o elevador social está parado no térreo." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Onde? (torre, andar, unidade…)</label>
              <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Torre A, apto 802, garagem" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Urgência</label>
              <div className="grid grid-cols-3 gap-2">
                {(['baixa', 'media', 'alta'] as ImpactoUrgencia[]).map((u) => (
                  <button key={u} type="button" onClick={() => setUrgencia(u)} className={`rounded-lg border px-2 py-2 text-xs font-semibold ${urgencia === u ? 'border-[#f97316] bg-[#f97316]/15 text-white' : 'border-[#3f3f3f] text-[#a3a3a3] hover:border-[#525252]'}`}>{IU_LABELS[u]}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Seu nome (opcional)</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Contato (opcional)</label>
                <input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="Telefone/e-mail" className={inputCls} />
              </div>
            </div>

            {/* Honeypot anti-bot: escondido de humanos; se preenchido, o servidor descarta. */}
            <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="hidden" aria-hidden="true" />

            {erro && <p className="rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-xs text-red-300">{erro}</p>}

            <button type="submit" disabled={enviando} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#f97316] px-4 py-3 text-sm font-bold text-white hover:bg-[#ea580c] disabled:opacity-60">
              {enviando ? <><Loader2 size={16} className="animate-spin" /> Enviando…</> : <><Send size={16} /> Enviar chamado</>}
            </button>
            <p className="text-center text-[10px] leading-4 text-[#6b6b6b]">
              Ao enviar, os dados informados (e o contato, se preenchido) são tratados pela administração do prédio
              apenas para registrar e atender este chamado de manutenção — base legal: legítimo interesse na gestão do
              edificado (LGPD, art. 7º, IX). O contato é opcional. Para exercer seus direitos (acesso, correção,
              eliminação), procure a administração do condomínio.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
