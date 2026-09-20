/**
 * Ajuste de batida — a correção que NÃO apaga o que a pessoa bateu.
 *
 * ⚠️ Esta tela é a única forma de corrigir ponto no sistema, e ela foi desenhada para não conseguir
 * destruir nada. O ajuste entra como **registro novo**, com `origem: 'ajuste'`, autor, instante e
 * motivo; a marcação original continua no banco, visível ao lado no espelho. Não é escrúpulo: é o
 * que a CLT art. 74 §2º e a Portaria 671 exigem de um registro de jornada, e o servidor reforça —
 * o gatilho `ponto_congelar_prova` devolve hora, tipo e dono ao valor antigo em QUALQUER update, e
 * DELETE está bloqueado por policy. Mesmo que esta tela quisesse apagar, não conseguiria.
 *
 * Duas coisas que o ajuste faz e uma que ele não faz:
 *  · **incluir** uma marcação que nunca houve (o caso comum: esqueceu de bater a saída);
 *  · **corrigir** uma marcação errada, apontando para ela por `corrigeId`;
 *  · nunca substituir. As duas linhas coexistem, e é da coexistência que sai a auditoria.
 */
import { useState } from 'react'
import { X, AlertTriangle, ArrowRight } from 'lucide-react'
import { usePontoStore } from '@/store/pontoStore'
import { ROTULO_DA_BATIDA } from '@/features/ponto/batida'
import { cn } from '@/lib/utils'
import type { Jornada } from '@/features/ponto/jornada'
import type { TipoDeBatida } from '@/types'

const TIPOS: TipoDeBatida[] = ['entrada', 'inicio_intervalo', 'fim_intervalo', 'saida']

/** Quantos caracteres de motivo bastam para alguém entender daqui a um ano. */
const MOTIVO_MINIMO = 8

interface Props {
  jornada: Jornada
  nomeDoTrabalhador: string
  onClose: () => void
}

export function AjusteDeBatidaDialog({ jornada, nomeDoTrabalhador, onClose }: Props) {
  const ajustar = usePontoStore((s) => s.ajustar)

  const [modo, setModo] = useState<'incluir' | 'corrigir'>('incluir')
  const [corrigeId, setCorrigeId] = useState<string>('')
  const [tipo, setTipo] = useState<TipoDeBatida>(() => sugerirTipo(jornada))
  const [hora, setHora] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const original = jornada.batidas.find((b) => b.id === corrigeId)
  const podeSalvar =
    /^\d{2}:\d{2}$/.test(hora)
    && motivo.trim().length >= MOTIVO_MINIMO
    && (modo === 'incluir' || !!original)

  function salvar() {
    if (!podeSalvar) return
    // A hora digitada pertence ao DIA DA JORNADA, não ao dia de hoje: quem corrige a saída de
    // ontem às 22h digita 22:00 e a marcação precisa cair em ontem.
    const momento = new Date(`${jornada.data}T${hora}:00`)
    if (Number.isNaN(momento.getTime())) { setErro('Hora inválida.'); return }

    const id = ajustar({
      workerId: jornada.workerId,
      // ⚠️ A jornada é do TRABALHADOR, não de quem está corrigindo. `authUserId` aqui é o dono da
      // jornada — o autor do ajuste vai em `ajustadoPor`, carimbado pelo store.
      authUserId: jornada.entrada?.authUserId ?? jornada.batidas[0]?.authUserId ?? '',
      siteId: jornada.siteId,
      tipo: modo === 'corrigir' && original ? original.tipo : tipo,
      data: jornada.data,
      momentoDispositivo: momento.toISOString(),
      motivoAjuste: motivo.trim(),
      corrigeId: modo === 'corrigir' ? corrigeId : undefined,
    })
    if (!id) { setErro('Seu perfil não tem permissão para ajustar ponto.'); return }
    onClose()
  }

  const campo = 'w-full rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]/60'
  const rotulo = 'mb-1 block text-[11px] text-[#adadad]'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#525252] bg-[#333]">
        <div className="flex items-center justify-between border-b border-[#525252] p-5">
          <div>
            <h2 className="text-base font-semibold text-[#f5f5f5]">Ajustar ponto</h2>
            <p className="text-[11px] text-[#adadad]">
              {nomeDoTrabalhador} · jornada de {jornada.data.slice(8, 10)}/{jornada.data.slice(5, 7)}
            </p>
          </div>
          <button onClick={onClose} className="text-[#adadad] hover:text-[#f5f5f5]" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {/* O aviso vem ANTES dos campos: quem vai digitar precisa saber o que acontece. */}
          <p className="flex items-start gap-2 rounded-lg border border-[#3b82f6]/40 bg-[#3b82f6]/10 px-3 py-2 text-[11px] leading-5 text-[#93c5fd]">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>
              O ajuste <b>não apaga nem substitui</b> nenhuma marcação. Ele entra como registro novo,
              com o seu nome e o motivo, e a batida original continua ao lado no espelho — é assim
              que a correção fica auditável.
            </span>
          </p>

          <MarcacoesDaJornada jornada={jornada} />

          <div className="flex gap-1">
            {(['incluir', 'corrigir'] as const).map((m) => (
              <button
                key={m} type="button"
                onClick={() => { setModo(m); setErro(null) }}
                disabled={m === 'corrigir' && jornada.batidas.length === 0}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
                  modo === m ? 'bg-[#f97316] text-white' : 'border border-[#525252] text-[#adadad] hover:text-[#f5f5f5]',
                )}
              >
                {m === 'incluir' ? 'Incluir marcação que faltou' : 'Corrigir uma marcação'}
              </button>
            ))}
          </div>

          {modo === 'corrigir' && (
            <div>
              <label className={rotulo}>Qual marcação está errada</label>
              <select className={campo} value={corrigeId} onChange={(e) => setCorrigeId(e.target.value)}>
                <option value="">— escolha —</option>
                {jornada.batidas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {ROTULO_DA_BATIDA[b.tipo]} às {hhmm(b.momentoDispositivo)}
                    {b.nsr ? ` (NSR ${b.nsr})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {modo === 'incluir' && (
            <div>
              <label className={rotulo}>Que marcação faltou</label>
              <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeBatida)}>
                {TIPOS.map((t) => <option key={t} value={t}>{ROTULO_DA_BATIDA[t]}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={rotulo}>
              Hora {modo === 'corrigir' && original ? 'correta' : 'da marcação'}
              {original && (
                <span className="ml-1 text-[#6b6b6b]">
                  (estava {hhmm(original.momentoDispositivo)} <ArrowRight size={9} className="inline" />)
                </span>
              )}
            </label>
            <input type="time" className={campo} value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>

          <div>
            <label className={rotulo}>
              Motivo <span className="text-[#6b6b6b]">— vai impresso no espelho, ao lado da correção</span>
            </label>
            <input
              className={campo} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: esqueceu de bater a saída; conferido com o encarregado"
            />
            {motivo.trim().length > 0 && motivo.trim().length < MOTIVO_MINIMO && (
              <p className="mt-1 text-[10px] text-[#fbbf24]">
                Escreva um motivo que alguém entenda daqui a um ano — "ok" não serve de justificativa
                em conferência nenhuma.
              </p>
            )}
          </div>

          {erro && <p className="text-[11px] text-[#fca5a5]">{erro}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button" onClick={onClose}
              className="rounded-lg border border-[#525252] px-4 py-2 text-sm text-[#adadad] hover:text-[#f5f5f5]"
            >
              Cancelar
            </button>
            <button
              type="button" onClick={salvar} disabled={!podeSalvar}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-semibold text-white',
                podeSalvar ? 'bg-[#f97316] hover:bg-[#ea6c10]' : 'cursor-not-allowed bg-[#525252]',
              )}
            >
              Registrar ajuste
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MarcacoesDaJornada({ jornada }: { jornada: Jornada }) {
  if (jornada.batidas.length === 0) {
    return <p className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-[11px] text-[#adadad]">
      Nenhuma marcação nesta jornada.
    </p>
  }
  return (
    <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-3">
      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[#adadad]">Marcações de hoje</p>
      <ul className="flex flex-col gap-1">
        {jornada.batidas.map((b) => (
          <li key={b.id} className="flex items-center justify-between text-xs text-[#d4d4d4]">
            <span>
              {ROTULO_DA_BATIDA[b.tipo]}
              {b.origem === 'ajuste' && (
                <span className="ml-1.5 rounded bg-[#3b82f6]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#93c5fd]">
                  ajuste de {b.ajustadoPor ?? 'alguém'}
                </span>
              )}
            </span>
            <span className="tabular-nums text-[#f5f5f5]">{hhmm(b.momentoDispositivo)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Qual marcação provavelmente falta, a partir da pendência. */
function sugerirTipo(j: Jornada): TipoDeBatida {
  if (j.pendencias.includes('sem-saida')) return 'saida'
  if (j.pendencias.includes('intervalo-incompleto')) return 'fim_intervalo'
  if (j.pendencias.includes('sem-marcacao-de-intervalo')) return 'inicio_intervalo'
  return 'saida'
}
