import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Link2, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { prontidaoRestricao, usePlanejamentoRestricoesStore, type PlanejamentoRestricao, type PlanejamentoRestricaoCategoria, type PlanejamentoRestricaoHorizonte } from '@/store/planejamentoRestricoesStore'
import { useLpsStore } from '@/store/lpsStore'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { cn } from '@/lib/utils'
import type { LpsRestrictionCategory } from '@/types'

const horizonteLabel: Record<PlanejamentoRestricaoHorizonte, string> = {
  longo: 'Longo Prazo',
  medio: 'Médio Prazo',
  curto: 'Curto Prazo',
  semanal: 'Programação Semanal',
}

const categoriaLabel: Record<PlanejamentoRestricaoCategoria, string> = {
  materiais: 'Materiais',
  projeto_engenharia: 'Projeto/Engenharia',
  mao_de_obra: 'Mão de Obra',
  equipamentos: 'Equipamentos',
  qualidade: 'Qualidade',
  externo: 'Externo',
  outros: 'Outros',
}

const statusLabel: Record<PlanejamentoRestricao['status'], string> = {
  identificada: 'Identificada',
  em_remocao: 'Em remoção',
  resolvida: 'Resolvida',
}

const prontidaoLabel = {
  pronto: 'Pronto',
  risco: 'Risco',
  bloqueado: 'Bloqueado',
}

const categoryOptions = Object.keys(categoriaLabel) as PlanejamentoRestricaoCategoria[]
const horizonOptions = Object.keys(horizonteLabel) as PlanejamentoRestricaoHorizonte[]

function toCategoria(categoria: LpsRestrictionCategory): PlanejamentoRestricaoCategoria {
  if (categoria === 'projeto_engenharia') return 'projeto_engenharia'
  if (categoria === 'materiais') return 'materiais'
  if (categoria === 'mao_de_obra') return 'mao_de_obra'
  if (categoria === 'equipamentos') return 'equipamentos'
  if (categoria === 'externo') return 'externo'
  return 'outros'
}

function todayPlus(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function Kpi({ label, value, tone = 'text-[#f5f5f5]' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-3">
      <p className="text-xs text-[#a3a3a3]">{label}</p>
      <p className={cn('mt-2 text-xl font-bold tabular-nums', tone)}>{value}</p>
    </div>
  )
}

function SmallInput({ value, onChange, type = 'text', className }: { value: string | number; onChange: (value: string) => void; type?: string; className?: string }) {
  return <input value={value} type={type} onChange={(event) => onChange(event.target.value)} className={cn('h-8 w-full rounded border border-[#525252] bg-[#1f1f1f] px-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]', className)} />
}

function SmallSelect<T extends string>({ value, options, onChange, labels }: { value: T; options: T[]; onChange: (value: T) => void; labels: Record<string, string> }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as T)} className="h-8 w-full rounded border border-[#525252] bg-[#1f1f1f] px-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]">
      {options.map((option) => <option key={option} value={option}>{labels[option]}</option>)}
    </select>
  )
}

export function PlanejamentoRestricoesPanel() {
  const activities = usePlanejamentoMestreStore((state) => state.activities)
  const derivedActivities = usePlanejamentoMestreStore((state) => state.derivedActivities)
  const programacaoSemanal = usePlanejamentoMestreStore((state) => state.programacaoSemanal)
  const lpsRestrictions = useLpsStore((state) => state.restrictions)
  const estoqueItens = useSuprimentosStore((state) => state.estoqueItens)
  const reservas = useSuprimentosStore((state) => state.reservas)
  const leadTimeRecords = useSuprimentosStore((state) => state.leadTimeRecords)
  const { restricoes, addRestricao, updateRestricao, removeRestricao, importFromLps } = usePlanejamentoRestricoesStore()
  const [horizonFilter, setHorizonFilter] = useState<'todos' | PlanejamentoRestricaoHorizonte>('todos')

  const visible = horizonFilter === 'todos' ? restricoes : restricoes.filter((restricao) => restricao.horizonte === horizonFilter)
  const open = restricoes.filter((restricao) => restricao.status !== 'resolvida')
  const blocked = open.filter((restricao) => prontidaoRestricao(restricao) === 'bloqueado')
  const ppcRisk = Math.max(0, Math.round(Math.abs(open.reduce((total, restricao) => total + restricao.impactoPpc, 0))))
  const curvaImpact = Math.abs(open.reduce((total, restricao) => total + restricao.impactoCurvaS, 0)).toFixed(1)
  const weeklyCommitments = useMemo(() => Object.values(programacaoSemanal).reduce((total, byDate) => total + Object.values(byDate).filter((day) => day.previsto > 0).length, 0), [programacaoSemanal])

  function addDefaultRestricao(horizonte: PlanejamentoRestricaoHorizonte = 'medio') {
    addRestricao({
      titulo: 'Nova restrição planejada',
      descricao: 'Descreva a restrição que impede a atividade de ficar pronta.',
      horizonte,
      categoria: 'materiais',
      status: 'identificada',
      responsavel: 'Responsável',
      prazoRemocao: todayPlus(7),
      planoRemocao: 'Definir plano de remoção, responsável e data de aceite.',
      impactoDias: 1,
      impactoPpc: -3,
      impactoCurvaS: -0.2,
      atividadeMestreId: activities.find((activity) => !activity.isMilestone)?.id ?? '',
      lookaheadId: derivedActivities[0]?.id ?? '',
      lpsRestrictionId: '',
      origem: 'Manual',
    })
  }

  const notImportedLps = lpsRestrictions.filter((restriction) => !restricoes.some((item) => item.lpsRestrictionId === restriction.id))

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-[#f97316]" />
              <h2 className="text-base font-bold text-[#f5f5f5]">Planejamento por Restrições</h2>
            </div>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-[#a3a3a3]">
              Planeje por prontidão: Longo Prazo, Médio Prazo, Curto Prazo e Programação Semanal conectados ao LPS/Lean, materiais, estoque, lead time e PPC.
            </p>
          </div>
          <button onClick={() => addDefaultRestricao()} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white hover:bg-[#ea580c]">
            <Plus size={14} /> Nova restrição
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi label="Restrições abertas" value={open.length} tone={open.length ? 'text-[#f87171]' : 'text-[#4ade80]'} />
        <Kpi label="Atividades mestre" value={activities.length} />
        <Kpi label="Lookahead" value={derivedActivities.length} tone="text-[#38bdf8]" />
        <Kpi label="Compromissos semanais" value={weeklyCommitments} />
        <Kpi label="Risco PPC" value={`${ppcRisk} p.p.`} tone={ppcRisk ? 'text-[#fbbf24]' : 'text-[#4ade80]'} />
        <Kpi label="Impacto Curva S" value={`${curvaImpact}%`} tone="text-[#fbbf24]" />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#525252] bg-[#2c2c2c] p-3">
        <span className="text-xs text-[#a3a3a3]">Horizonte:</span>
        <button onClick={() => setHorizonFilter('todos')} className={cn('rounded px-3 py-1.5 text-xs font-semibold', horizonFilter === 'todos' ? 'bg-[#f97316] text-white' : 'bg-[#3d3d3d] text-[#a3a3a3]')}>Todos</button>
        {horizonOptions.map((horizon) => (
          <button key={horizon} onClick={() => setHorizonFilter(horizon)} className={cn('rounded px-3 py-1.5 text-xs font-semibold', horizonFilter === horizon ? 'bg-[#f97316] text-white' : 'bg-[#3d3d3d] text-[#a3a3a3]')}>
            {horizonteLabel[horizon]}
          </button>
        ))}
      </div>

      {notImportedLps.length > 0 && (
        <div className="rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-[#fbbf24]">
            <Link2 size={16} />
            <p className="text-sm font-bold">{notImportedLps.length} restrição(ões) do LPS podem entrar no planejamento</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {notImportedLps.slice(0, 4).map((restriction) => (
              <div key={restriction.id} className="flex items-center justify-between gap-3 rounded border border-[#f59e0b]/30 bg-[#1f1f1f] p-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#f5f5f5]">{restriction.tema}</p>
                  <p className="text-[11px] text-[#a3a3a3]">{restriction.responsavel || 'Responsável não definido'} · {restriction.prazoRemocao || 'sem prazo'}</p>
                </div>
                <button
                  onClick={() => importFromLps({
                    titulo: restriction.tema,
                    descricao: restriction.descricao,
                    categoria: toCategoria(restriction.categoria),
                    responsavel: restriction.responsavel ?? '',
                    prazoRemocao: restriction.prazoRemocao ?? todayPlus(5),
                    planoRemocao: restriction.acoesNecessarias ?? 'Tratar no Constraint Register e liberar a atividade.',
                    lpsRestrictionId: restriction.id,
                    atividadeMestreId: restriction.linkedMasterActivityIds?.[0],
                  })}
                  className="shrink-0 rounded bg-[#f97316] px-2 py-1 text-[11px] font-bold text-white"
                >
                  Importar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-3">
          {visible.map((restricao) => {
            const prontidao = prontidaoRestricao(restricao)
            const activity = activities.find((item) => item.id === restricao.atividadeMestreId)
            return (
              <div key={restricao.id} className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <SmallInput value={restricao.titulo} onChange={(value) => updateRestricao(restricao.id, { titulo: value })} className="max-w-xl font-semibold" />
                      <span className={cn('rounded-full px-2 py-1 text-[10px] font-bold', prontidao === 'pronto' ? 'bg-[#16a34a]/15 text-[#4ade80]' : prontidao === 'risco' ? 'bg-[#ca8a04]/15 text-[#fbbf24]' : 'bg-[#dc2626]/15 text-[#f87171]')}>
                        {prontidaoLabel[prontidao]}
                      </span>
                    </div>
                    <textarea value={restricao.descricao} onChange={(event) => updateRestricao(restricao.id, { descricao: event.target.value })} className="mt-3 min-h-[64px] w-full rounded border border-[#525252] bg-[#1f1f1f] p-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]" />
                  </div>
                  <button onClick={() => removeRestricao(restricao.id)} className="rounded p-1 text-[#f87171] hover:bg-[#dc2626]/10"><Trash2 size={14} /></button>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <SmallSelect value={restricao.horizonte} options={horizonOptions} labels={horizonteLabel} onChange={(value) => updateRestricao(restricao.id, { horizonte: value })} />
                  <SmallSelect value={restricao.categoria} options={categoryOptions} labels={categoriaLabel} onChange={(value) => updateRestricao(restricao.id, { categoria: value })} />
                  <SmallSelect value={restricao.status} options={['identificada', 'em_remocao', 'resolvida']} labels={statusLabel} onChange={(value) => updateRestricao(restricao.id, { status: value })} />
                  <SmallInput type="date" value={restricao.prazoRemocao} onChange={(value) => updateRestricao(restricao.id, { prazoRemocao: value })} />
                  <SmallInput value={restricao.responsavel} onChange={(value) => updateRestricao(restricao.id, { responsavel: value })} />
                  <select value={restricao.atividadeMestreId} onChange={(event) => updateRestricao(restricao.id, { atividadeMestreId: event.target.value })} className="h-8 rounded border border-[#525252] bg-[#1f1f1f] px-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316] md:col-span-2">
                    <option value="">Sem atividade mestre</option>
                    {activities.filter((item) => !item.isMilestone).map((item) => <option key={item.id} value={item.id}>{item.wbsCode} - {item.name}</option>)}
                  </select>
                  <SmallInput value={restricao.origem} onChange={(value) => updateRestricao(restricao.id, { origem: value })} />
                  <SmallInput type="number" value={restricao.impactoDias} onChange={(value) => updateRestricao(restricao.id, { impactoDias: num(value) })} />
                  <SmallInput type="number" value={restricao.impactoPpc} onChange={(value) => updateRestricao(restricao.id, { impactoPpc: num(value) })} />
                  <SmallInput type="number" value={restricao.impactoCurvaS} onChange={(value) => updateRestricao(restricao.id, { impactoCurvaS: num(value) })} />
                  <SmallInput value={activity?.name ?? 'Atividade não vinculada'} onChange={() => undefined} className="md:col-span-1 opacity-70" />
                </div>
                <textarea value={restricao.planoRemocao} onChange={(event) => updateRestricao(restricao.id, { planoRemocao: event.target.value })} className="mt-3 min-h-[54px] w-full rounded border border-[#525252] bg-[#1f1f1f] p-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]" />
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
            <h3 className="text-sm font-bold text-[#f5f5f5]">Leitura de prontidão</h3>
            <div className="mt-3 space-y-2 text-xs text-[#d4d4d4]">
              <p><strong className="text-[#4ade80]">Pronto:</strong> sem restrição ativa.</p>
              <p><strong className="text-[#fbbf24]">Risco:</strong> em remoção, dentro do prazo.</p>
              <p><strong className="text-[#f87171]">Bloqueado:</strong> identificada ou vencida.</p>
            </div>
          </div>
          <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
            <h3 className="text-sm font-bold text-[#f5f5f5]">Materiais e lead time</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Kpi label="Itens em estoque" value={estoqueItens.length} />
              <Kpi label="Reservas LPS" value={reservas.length} />
              <Kpi label="Fornecedores com lead time" value={leadTimeRecords.length} />
              <Kpi label="Bloqueios" value={blocked.length} tone={blocked.length ? 'text-[#f87171]' : 'text-[#4ade80]'} />
            </div>
          </div>
          <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
            <h3 className="text-sm font-bold text-[#f5f5f5]">Horizontes</h3>
            <div className="mt-3 space-y-2">
              {horizonOptions.map((horizon) => {
                const count = restricoes.filter((restricao) => restricao.horizonte === horizon && restricao.status !== 'resolvida').length
                return (
                  <button key={horizon} onClick={() => addDefaultRestricao(horizon)} className="flex w-full items-center justify-between rounded border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-xs text-[#f5f5f5] hover:border-[#f97316]/50">
                    <span>{horizonteLabel[horizon]}</span>
                    <span className={count ? 'text-[#f87171]' : 'text-[#4ade80]'}>{count} abertas</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
            <h3 className="text-sm font-bold text-[#f5f5f5]">Critério de liberação</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#a3a3a3]">
              Uma atividade só deve entrar na programação semanal como compromisso quando as restrições de material, projeto, equipe, qualidade e frente estiverem removidas ou formalmente aceitas.
            </p>
            {open.length === 0 && <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#4ade80]"><CheckCircle2 size={14} /> Todas as atividades estão prontas.</p>}
            {open.length > 0 && <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#fbbf24]"><AlertTriangle size={14} /> Existem restrições ativas antes da liberação.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
