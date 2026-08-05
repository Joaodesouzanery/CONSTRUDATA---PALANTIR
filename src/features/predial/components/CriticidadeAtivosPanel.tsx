/**
 * CriticidadeAtivosPanel — "Criticidade de Ativos" por REGRA EXPLÍCITA (substitui o antigo
 * "Saúde & Preditiva", que era da frota). Ranqueia os ativos e mostra SEMPRE a memória de
 * cálculo (cada fator, sua contribuição e o porquê). Sem "engine", sem "preditiva", sem custo
 * chumbado. Só lê o manutencoesStore, escopado pela obra ativa.
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { useManutencoesStore } from '@/store/manutencoesStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { calcCriticidade, nivelLabel, type CriticidadeNivel } from '../utils/criticidade'

const NIVEL: Record<CriticidadeNivel, { dot: string; text: string; bar: string }> = {
  critico: { dot: 'bg-[#ef4444]', text: 'text-[#f87171]', bar: '#ef4444' },
  alto:    { dot: 'bg-[#f97316]', text: 'text-[#fb923c]', bar: '#f97316' },
  medio:   { dot: 'bg-[#eab308]', text: 'text-[#fbbf24]', bar: '#eab308' },
  baixo:   { dot: 'bg-[#22c55e]', text: 'text-[#4ade80]', bar: '#22c55e' },
}

export function CriticidadeAtivosPanel() {
  const orgId = useAuth((s) => s.profile?.organization_id ?? null)
  const ensure = useManutencoesStore((s) => s.ensureTenantScope)
  const pull = useManutencoesStore((s) => s.pull)
  const allAssets = useManutencoesStore((s) => s.assets)
  const allPlans = useManutencoesStore((s) => s.plans)
  const allWO = useManutencoesStore((s) => s.workOrders)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const [sel, setSel] = useState<string | null>(null)

  useEffect(() => { if (orgId) { ensure(orgId); void pull() } }, [orgId, ensure, pull])

  const ranked = useMemo(() => {
    const scope = <T extends { constructionSiteId?: string | null }>(l: T[]) => (activeObraId ? l.filter((x) => (x.constructionSiteId ?? null) === activeObraId) : l)
    const assets = scope(allAssets), plans = scope(allPlans), wo = scope(allWO)
    return assets.map((a) => ({ a, c: calcCriticidade(a, plans, wo) })).sort((x, y) => y.c.score - x.c.score)
  }, [allAssets, allPlans, allWO, activeObraId])

  const selected = ranked.find((r) => r.a.id === sel) ?? ranked[0] ?? null

  return (
    <div className="flex flex-col gap-6 overflow-auto p-6 lg:flex-row">
      {/* Ranking */}
      <div className="shrink-0 space-y-2 lg:w-[380px]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#a3a3a3]">Ativos por criticidade (regra)</p>
        {ranked.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#525252] py-8 text-center text-xs text-[#6b6b6b]">Nenhum ativo cadastrado.</div>
        ) : ranked.map(({ a, c }) => {
          const isSel = selected?.a.id === a.id
          const cls = NIVEL[c.nivel]
          return (
            <button key={a.id} onClick={() => setSel(a.id)} className={cn('w-full rounded-xl border p-3 text-left transition-colors', isSel ? 'border-[#f97316] bg-[#3d3d3d]' : 'border-[#525252] bg-[#333333] hover:border-[#f97316]/50')}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-white">{a.name || a.code}</span>
                <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', cls.text)}><span className={cn('h-2.5 w-2.5 rounded-full', cls.dot)} /> {c.score}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#6b6b6b]">
                <span>{a.sistema ?? a.type}{a.location ? ` · ${a.location}` : ''}</span>
                <span className={cls.text}>{nivelLabel(c.nivel)}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-[#525252]"><div className="h-1.5 rounded-full" style={{ width: `${c.score}%`, background: cls.bar }} /></div>
            </button>
          )
        })}
      </div>

      {/* Memória de cálculo */}
      <div className="min-w-0 flex-1">
        {!selected ? (
          <div className="rounded-xl border border-dashed border-[#525252] py-16 text-center text-sm text-[#6b6b6b]">Selecione um ativo.</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#525252] bg-[#333333] p-5">
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangle size={16} className={NIVEL[selected.c.nivel].text} />
                <h2 className="text-sm font-semibold text-white">{selected.a.name || selected.a.code}</h2>
                <span className={cn('ml-auto text-2xl font-bold tabular-nums', NIVEL[selected.c.nivel].text)}>{selected.c.score}<span className="text-sm text-[#6b6b6b]">/100</span></span>
              </div>
              <p className="text-xs text-[#a3a3a3]">Criticidade <strong className={NIVEL[selected.c.nivel].text}>{nivelLabel(selected.c.nivel)}</strong> · {selected.a.sistema ?? selected.a.type}{selected.a.location ? ` · ${selected.a.location}` : ''}</p>
            </div>

            <div className="rounded-2xl border border-[#525252] bg-[#333333] p-5">
              <div className="mb-3 flex items-center gap-2"><ListChecks size={15} className="text-[#a3a3a3]" /><p className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3]">Memória de cálculo</p></div>
              <div className="space-y-3">
                {selected.c.fatores.map((f) => (
                  <div key={f.label}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-[#e5e5e5]">{f.label}</span>
                      <span className="font-mono tabular-nums text-white">+{f.valor}<span className="text-[10px] text-[#6b6b6b]"> / {f.max}</span></span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-[#525252]"><div className="h-1.5 rounded-full bg-[#f97316]" style={{ width: `${f.max ? (f.valor / f.max) * 100 : 0}%` }} /></div>
                    <p className="mt-1 text-[11px] text-[#6b6b6b]">{f.detalhe}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 border-t border-[#525252] pt-3 text-[11px] leading-5 text-[#6b6b6b]">
                Regra determinística (não é predição — o sistema não tem sensores): criticidade cadastrada + idade/vida útil NBR + preventiva vencida + reincidência de chamados nos últimos 12 meses. Cadastre data de instalação e vida útil (NBR) nos Ativos para refinar.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
