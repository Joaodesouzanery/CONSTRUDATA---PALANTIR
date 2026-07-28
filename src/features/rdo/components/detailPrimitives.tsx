/**
 * detailPrimitives — blocos de apresentação read-only compartilhados pelo detalhe
 * completo do RDO (RdoDetalhe / RdoIntegracaoStatus). Extraídos do padrão visual já
 * usado no RdoCompizzoPanel (Section/Meta/SupplyBlock/Row) para reuso sem duplicar
 * o estilo. Somente componentes — os helpers de formatação vivem em detailFormatters.
 */
import type { ReactNode } from 'react'

export function Section({ title, icon, right, children }: { title: string; icon?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#525252] bg-[#333333] p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="flex items-center gap-2 text-[#f5f5f5] font-semibold text-sm">{icon}{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

/** Rótulo minúsculo + valor em negrito, truncado (grade de metadados). */
export function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wider text-[#6b6b6b]">{label}</p>
      <p className="text-[11px] font-semibold text-[#e5e5e5] truncate" title={value}>{value}</p>
    </div>
  )
}

/** Campo maior (label em cima, valor livre embaixo) para blocos de identificação. */
export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-[#6b6b6b] mb-0.5">{label}</p>
      <div className="text-sm text-[#e5e5e5] break-words">{value}</div>
    </div>
  )
}

export function SupplyBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-3">
      <p className="text-[11px] font-semibold text-[#a3a3a3] mb-1.5">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

export function Row({ left, right, tone = 'text-[#c9c9c9]' }: { left: ReactNode; right: ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="truncate text-[#c9c9c9]" title={typeof left === 'string' ? left : undefined}>{left}</span>
      <span className={`tabular-nums shrink-0 ${tone}`}>{right}</span>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[11px] text-[#6b6b6b] italic">{children}</p>
}

/** Pílula de flag booleana (serviços/ocorrências do Compizzo). */
export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'on' | 'warn' }) {
  const cls = tone === 'on'
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    : tone === 'warn'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
      : 'border-[#525252] bg-[#2c2c2c] text-[#a3a3a3]'
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>{children}</span>
}
