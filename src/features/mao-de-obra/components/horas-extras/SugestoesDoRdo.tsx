/**
 * "O RDO diz que essas pessoas estavam na obra num dia que não é útil."
 *
 * Um aviso recolhido, que só aparece quando há o que sugerir. Confirmar escreve a hora extra
 * **não paga** — pagar continua sendo outro gesto, na grade. Nada aqui grava sozinho, e a linha
 * diz de onde veio o número sugerido para quem confere poder discordar com informação.
 */
import { useMemo, useState } from 'react'
import { CalendarClock, Check } from 'lucide-react'
import type { SugestaoDeHoraExtra } from '../../utils/sugestaoHoraExtraRdo'
import { horaExtraDaSugestao } from '../../utils/sugestaoHoraExtraRdo'
import type { HoraExtra } from '@/types'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

interface Props {
  sugestoes: SugestaoDeHoraExtra[]
  podeEscrever: boolean
  upsertHoraExtra: (he: HoraExtra) => void
}

export function SugestoesDoRdo({ sugestoes, podeEscrever, upsertHoraExtra }: Props) {
  const [aberto, setAberto] = useState(false)
  const [valores, setValores] = useState<Record<string, string>>({})

  const prontas = useMemo(
    () => sugestoes.filter((s) => valorDe(s, valores) !== null),
    [sugestoes, valores],
  )

  if (!sugestoes.length) return null

  function confirmar(lista: SugestaoDeHoraExtra[]) {
    const agora = new Date().toISOString()
    for (const s of lista) {
      const v = valorDe(s, valores)
      if (v === null || v <= 0) continue
      upsertHoraExtra(horaExtraDaSugestao(s, v, agora))
    }
  }

  return (
    <div className="rounded-xl border border-[#eab308]/40 bg-[#eab308]/[0.07]">
      <button
        type="button" onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-[#fbbf24]">
          <CalendarClock size={14} />
          {sugestoes.length} presença(s) em dia não útil sem hora extra lançada
          <span className="font-normal text-[#d1a54a]">— sugestão do RDO, nada foi gravado</span>
        </span>
        <span className="text-xs text-[#d1a54a]">{aberto ? 'Recolher' : 'Revisar'}</span>
      </button>

      {aberto && (
        <div className="border-t border-[#eab308]/30 p-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-xs">
              <thead>
                <tr className="text-[#d1a54a]">
                  {['Dia', 'Motivo', 'Pessoa', 'Cargo', 'RDO', 'Valor', 'Base da sugestão', ''].map((t) => (
                    <th key={t} className="px-2 py-1.5 text-left font-medium">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sugestoes.map((s) => {
                  const v = valorDe(s, valores)
                  return (
                    <tr key={s.id} className="border-t border-[#eab308]/20">
                      <td className="px-2 py-1.5 text-[#f5f5f5]">{dataBR(s.data)}</td>
                      <td className="px-2 py-1.5 text-[#adadad]">{s.razao}</td>
                      <td className="px-2 py-1.5 text-[#f5f5f5]">
                        {s.workerNome}
                        {s.semCadastro && (
                          <span className="ml-1 rounded bg-[#ef4444]/15 px-1 text-[10px] text-[#fca5a5]" title="O nome do RDO não casou com nenhum funcionário. A hora extra entra sem vínculo.">
                            sem cadastro
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-[#adadad]">{s.cargo || '—'}</td>
                      <td className="px-2 py-1.5 text-[#adadad]">#{s.rdoNumero}</td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number" min={0} step={10} disabled={!podeEscrever}
                          aria-label={`Valor da hora extra de ${s.workerNome}`}
                          value={valores[s.id] ?? (s.valorSugerido === null ? '' : String(s.valorSugerido))}
                          placeholder="informe"
                          onChange={(e) => setValores((m) => ({ ...m, [s.id]: e.target.value }))}
                          className="w-20 rounded border border-[#525252] bg-[#484848] px-1 py-1 text-right text-[11px] text-[#f5f5f5] placeholder:text-[#7a7a7a]"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-[#8a8a8a]">{s.base}</td>
                      <td className="px-2 py-1.5">
                        {podeEscrever && (
                          <button
                            type="button" onClick={() => confirmar([s])} disabled={v === null || v <= 0}
                            className="rounded border border-[#525252] px-2 py-0.5 text-[11px] text-[#adadad] transition-colors hover:border-[#22c55e]/40 hover:text-[#4ade80] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Lançar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {podeEscrever && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-[#d1a54a]">
                Lançar cria a hora extra <b>não paga</b>. A despesa no Controle de Caixa só nasce
                quando alguém marcar Pago na grade.
                {prontas.length < sugestoes.length && (
                  <> {sugestoes.length - prontas.length} linha(s) ficam de fora por não ter valor informado.</>
                )}
              </p>
              <button
                type="button" disabled={!prontas.length}
                onClick={() => confirm(
                  `Lançar ${prontas.length} hora(s) extra(s), somando ${brl(prontas.reduce((t, s) => t + (valorDe(s, valores) ?? 0), 0))}?\n\n` +
                  'Elas nascem NÃO pagas — nenhuma despesa é criada agora.',
                ) && confirmar(prontas)}
                className="flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check size={14} /> Lançar {prontas.length} sugestão(ões)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function valorDe(s: SugestaoDeHoraExtra, valores: Record<string, string>): number | null {
  const digitado = valores[s.id]
  if (digitado !== undefined) {
    const n = Number(digitado.replace(',', '.'))
    return digitado.trim() === '' || !Number.isFinite(n) ? null : n
  }
  return s.valorSugerido
}
