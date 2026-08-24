/**
 * Componentes visuais do card de contrato.
 *
 * A paleta e os formatadores ficam em `formato.ts` — arquivo separado porque misturar constantes
 * com componentes quebra o recarregamento rápido do Vite (regra `react-refresh`).
 */
import type { ReactNode } from 'react'
import { TXT, inputCls, numCls } from './formato'

/** Rótulo de campo: 11px e #a3a3a3. Era 9px e #6b6b6b — 2,4:1, abaixo do mínimo. */
export function Rotulo({ children }: { children: ReactNode }) {
  return <span className="text-[11px] uppercase tracking-wide text-[#a3a3a3]">{children}</span>
}

export function Campo({ label, valor, onChange, numero, tipo, placeholder, className }: {
  label: string
  valor?: string
  onChange: (v: string) => void
  numero?: boolean
  tipo?: 'text' | 'date'
  placeholder?: string
  className?: string
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ''}`}>
      <Rotulo>{label}</Rotulo>
      <input
        type={tipo ?? 'text'}
        className={numero ? numCls : inputCls}
        inputMode={numero ? 'decimal' : undefined}
        value={valor ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

/** Par rótulo/valor para leitura. */
export function Linha({ label, children, largura = 'w-32' }: { label: string; children: ReactNode; largura?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={`shrink-0 ${largura} text-[11px] ${TXT.fraco}`}>{label}</span>
      <span className={`flex-1 text-xs ${TXT.forte}`}>{children}</span>
    </div>
  )
}

/** Cabeçalho de tabela — 11px e #a3a3a3. Era 10px e #3f3f3f, que some no fundo. */
export function Th({ children, alinha = 'left' }: { children: ReactNode; alinha?: 'left' | 'right' | 'center' }) {
  const cls = alinha === 'right' ? 'text-right' : alinha === 'center' ? 'text-center' : 'text-left'
  return <th className={`${cls} pb-1.5 text-[11px] font-semibold uppercase tracking-wide ${TXT.fraco}`}>{children}</th>
}

/** Número grande do cabeçalho do card. */
export function Kpi({ rotulo, valor, cor, detalhe }: { rotulo: string; valor: string; cor?: string; detalhe?: ReactNode }) {
  return (
    <div className="flex min-w-[130px] flex-col gap-0.5">
      <span className={`text-[11px] uppercase tracking-wide ${TXT.fraco}`}>{rotulo}</span>
      <span className="font-mono text-base font-bold tabular-nums" style={{ color: cor ?? '#f5f5f5' }}>{valor}</span>
      {detalhe && <span className={`text-[11px] ${TXT.fraco}`}>{detalhe}</span>}
    </div>
  )
}

/** Aviso discreto ou alerta, conforme a gravidade. */
export function Aviso({ tom = 'info', children }: { tom?: 'info' | 'atencao' | 'erro'; children: ReactNode }) {
  const cores = {
    info:    'border-[#525252] bg-[#3a3a3a]/50 text-[#d4d4d4]',
    atencao: 'border-[#eab308]/40 bg-[#eab308]/10 text-[#fbbf24]',
    erro:    'border-[#ef4444]/40 bg-[#ef4444]/10 text-[#f87171]',
  }[tom]
  return <p className={`rounded border px-2.5 py-1.5 text-[11px] leading-relaxed ${cores}`}>{children}</p>
}

export function BotaoSec({ children, onClick, disabled, title }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; title?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className="inline-flex items-center gap-1 rounded-lg border border-[#525252] px-2.5 py-1 text-[11px]
                 font-semibold text-[#d4d4d4] hover:border-[#f97316]/40 hover:text-[#f97316] disabled:opacity-40">
      {children}
    </button>
  )
}
