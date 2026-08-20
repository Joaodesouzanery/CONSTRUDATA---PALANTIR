/**
 * Ecosystem360Panel — o radar da reunião: um cartão por módulo, com semáforo.
 *
 * Só a apresentação. As contas vivem em `../utils/sinais360`, porque os mesmos números vão para o
 * Radar da aba Dashboard, para o Radar compacto do Daily Report e para o PDF da pauta — e três
 * cálculos independentes é como a reunião acaba discutindo um número que o papel não confirma.
 *
 * O cartão CARIMBA o que não respeita o período. Ver o comentário de escopo em `sinais360.ts`.
 */
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSinais360, type Signal } from '../utils/sinais360'
import type { Periodo } from '@/lib/periodo'

interface Props {
  /** Modo dia único (Relatório 360 diário). Ignorado quando `periodo` vem. */
  date?: string
  /** O período da reunião. Quando ausente, `date` vira um período de um dia só. */
  periodo?: Periodo
  /** Obra em escopo (`construction_sites.id`). `null`/ausente = todas as obras. */
  siteId?: string | null
  projectName?: string
  compact?: boolean
}

const toneClass: Record<Signal['tone'], string> = {
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  danger: 'border-red-500/30 bg-red-500/10 text-red-300',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  neutral: 'border-[#525252] bg-[#333333] text-[#f5f5f5]',
}

const ETIQUETA: Record<'acumulado' | 'sem-obra', { texto: string; titulo: string }> = {
  acumulado: {
    texto: 'acumulado',
    titulo: 'Este número não respeita o período: o dado da origem não tem data para recortar. É o total de sempre.',
  },
  'sem-obra': {
    texto: 'todas as obras',
    titulo: 'Respeita o período, mas o dado da origem não guarda a obra — então soma todas, mesmo com uma obra selecionada.',
  },
}

function SignalCard({ signal }: { signal: Signal }) {
  const Icon = signal.icon
  const etiqueta = signal.escopo && signal.escopo !== 'periodo' ? ETIQUETA[signal.escopo] : null
  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-3 min-w-0">
      <div className="mb-2 flex items-center gap-2 text-[11px] text-[#a3a3a3]">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg border', toneClass[signal.tone])}>
          <Icon size={14} />
        </span>
        <span className="truncate">{signal.label}</span>
      </div>
      <div className="text-xl font-bold text-white tabular-nums">{signal.value}</div>
      <div className="mt-1 truncate text-[11px] text-[#6b6b6b]">{signal.sub}</div>
      {etiqueta && (
        <span
          title={etiqueta.titulo}
          className="mt-1.5 inline-block cursor-help rounded bg-[#525252]/50 px-1.5 py-0.5 text-[9px] text-[#a3a3a3]"
        >
          {etiqueta.texto}
        </span>
      )}
    </div>
  )
}

export function Ecosystem360Panel({ date, periodo, siteId, projectName, compact = false }: Props) {
  const { sinais: signals, periodo: p } = useSinais360({ periodo, date, siteId })

  const critical = signals.filter((signal) => signal.tone === 'danger' || signal.tone === 'warn')
  const naoRecortados = signals.filter((s) => s.escopo === 'acumulado').length

  return (
    <section className="rounded-xl border border-[#525252] bg-[#2f2f2f]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#525252] px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className={critical.length ? 'text-amber-300' : 'text-[#22c55e]'} />
          <h2 className="text-sm font-semibold text-white">Radar 360</h2>
          <span className="text-[11px] text-[#6b6b6b]">
            {p.rotulo}{projectName ? ` · ${projectName}` : ''}
          </span>
        </div>
        <span className="text-[11px] text-[#a3a3a3]">
          {critical.length} ponto{critical.length !== 1 ? 's' : ''} de atenção
          {naoRecortados > 0 && <span className="text-[#6b6b6b]"> · {naoRecortados} cartões acumulados</span>}
        </span>
      </div>
      <div className={cn('grid gap-3 p-4', compact ? 'md:grid-cols-5' : 'md:grid-cols-2 xl:grid-cols-5')}>
        {signals.map((signal) => <SignalCard key={signal.label} signal={signal} />)}
      </div>
      {naoRecortados > 0 && (
        <p className="border-t border-[#525252] px-4 py-2.5 text-[10px] leading-relaxed text-[#6b6b6b]">
          Os cartões marcados como <span className="rounded bg-[#525252]/50 px-1 py-0.5">acumulado</span> mostram o total
          de sempre, não o do período: o dado de origem não tem data (EVM e Rede 360) ou não sincroniza com o servidor
          (Medição, que hoje vive só no navegador de quem abriu a tela). Estão aqui porque a informação vale — mas não
          use esses números para comparar um período com outro.
        </p>
      )}
    </section>
  )
}

