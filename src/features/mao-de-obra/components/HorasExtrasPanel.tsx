/**
 * Horas Extras — as duas abas da planilha do cliente, no sistema.
 *
 * ─── O QUE ESTA TELA RESOLVE ──────────────────────────────────────────────────
 * Até aqui a hora extra só existia DEPOIS de paga: o único registro era o lançamento do Controle
 * de Caixa, criado pela importação da planilha. "Lançado, ainda não pago" — o estado em que a
 * grade do cliente passa o mês inteiro — não tinha onde morar.
 *
 * Agora tem. E a caixinha **Pago** é a única ponte com o dinheiro: marcar gera a despesa,
 * desmarcar apaga. Nunca o contrário, nunca em silêncio.
 */
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { podeEscreverMaoDeObra } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useRdoStore } from '@/store/rdoStore'
import { sugestoesDeHoraExtra } from '../utils/sugestaoHoraExtraRdo'
import { GradeFimDeSemana } from './horas-extras/GradeFimDeSemana'
import { PontoSaidaTabela } from './horas-extras/PontoSaidaTabela'
import { SugestoesDoRdo } from './horas-extras/SugestoesDoRdo'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

type Visao = 'fim-de-semana' | 'ponto-saida'

export function HorasExtrasPanel() {
  const { workers, cargos, horasExtras, cltSettings } = useMaoDeObraStore(
    useShallow((s) => ({
      workers: s.workers, cargos: s.cargos, horasExtras: s.horasExtras, cltSettings: s.cltSettings,
    })),
  )
  const upsertHoraExtra = useMaoDeObraStore((s) => s.upsertHoraExtra)
  const removeHoraExtra = useMaoDeObraStore((s) => s.removeHoraExtra)
  const marcarPaga      = useMaoDeObraStore((s) => s.marcarHoraExtraPaga)
  const desmarcarPaga   = useMaoDeObraStore((s) => s.desmarcarHoraExtraPaga)
  const feriados        = usePlanejamentoStore((s) => s.holidays)
  const jornada         = usePlanejamentoStore((s) => s.scheduleConfig.workWeekMode)
  const rdos            = useRdoStore((s) => s.rdos)

  // Inicializador preguiçoso: `new Date()` direto no corpo é impuro e mudaria a cada render.
  const [mes, setMes] = useState(() => new Date().getMonth() + 1)
  const [ano, setAno] = useState(() => new Date().getFullYear())
  const [anos] = useState(() => { const a = new Date().getFullYear(); return [a - 1, a, a + 1] })
  const [visao, setVisao] = useState<Visao>('fim-de-semana')
  const podeEscrever = useMemo(() => podeEscreverMaoDeObra().pode, [])

  // A ponte com o RDO: presença em dia não útil vira SUGESTÃO, nunca lançamento automático.
  const sugestoes = useMemo(
    () => sugestoesDeHoraExtra({
      rdos, workers, cargos, horasExtras, feriados, jornada,
      mes: `${ano}-${String(mes).padStart(2, '0')}`,
    }),
    [rdos, workers, cargos, horasExtras, feriados, jornada, ano, mes],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-[#525252] bg-[#3d3d3d] p-1">
          {([['fim-de-semana', 'Fim de semana e feriado'], ['ponto-saida', 'Ausência / ponto saída']] as const).map(([id, label]) => (
            <button
              key={id} type="button" onClick={() => setVisao(id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                visao === id ? 'bg-[#f97316] text-white' : 'text-[#adadad] hover:text-[#f5f5f5]',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={mes} onChange={(e) => setMes(Number(e.target.value))} aria-label="Mês"
            className="rounded-lg border border-[#525252] bg-[#484848] px-2 py-2 text-xs text-[#f5f5f5]"
          >
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano"
            className="rounded-lg border border-[#525252] bg-[#484848] px-2 py-2 text-xs text-[#f5f5f5]"
          >
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {visao === 'fim-de-semana' && (
        <SugestoesDoRdo sugestoes={sugestoes} podeEscrever={podeEscrever} upsertHoraExtra={upsertHoraExtra} />
      )}

      {visao === 'fim-de-semana' ? (
        <GradeFimDeSemana
          workers={workers} cargos={cargos} horasExtras={horasExtras} feriados={feriados}
          mes={mes} ano={ano} podeEscrever={podeEscrever}
          upsertHoraExtra={upsertHoraExtra} removeHoraExtra={removeHoraExtra}
          marcarPaga={marcarPaga} desmarcarPaga={desmarcarPaga}
        />
      ) : (
        <PontoSaidaTabela
          workers={workers} horasExtras={horasExtras} cltSettings={cltSettings}
          mes={mes} ano={ano} podeEscrever={podeEscrever}
          upsertHoraExtra={upsertHoraExtra} removeHoraExtra={removeHoraExtra}
          marcarPaga={marcarPaga} desmarcarPaga={desmarcarPaga}
        />
      )}
    </div>
  )
}
