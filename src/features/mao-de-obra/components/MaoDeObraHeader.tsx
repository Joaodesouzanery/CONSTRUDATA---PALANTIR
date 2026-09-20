import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Users, Clock, ShieldCheck, AlertTriangle, MapPin, Upload } from 'lucide-react'
import { useMaoDeObraStore, type MaoDeObraTab } from '@/store/maoDeObraStore'
import { cn, dataLocalISO, hojeLocalISO } from '@/lib/utils'
import { toast } from 'sonner'
import { ImportModal } from '@/components/shared/ImportModal'
import { WORKER_IMPORT_CONFIG } from '@/lib/importConfigs'
import { useStoreSync } from '@/lib/useStoreSync'
import { SyncBadge } from '@/components/shared/SyncBadge'
import { postosDescobertos } from '@/features/mao-de-obra/utils/coberturaDePostos'
import { useTorreStore } from '@/store/torreDeControleStore'

// Re-export so index.tsx can keep using this import path
export type { MaoDeObraTab } from '@/store/maoDeObraStore'

const TABS: Array<{ id: MaoDeObraTab; label: string }> = [
  { id: 'dashboard',     label: 'Dashboard'                 },
  { id: 'funcionarios',  label: 'Funcionários'              },
  // Fundidas em 18/09/2026. Cada uma abre em sub-abas — ver o painel correspondente, que explica
  // por que não viraram tela única (escopos diferentes, semânticas diferentes).
  { id: 'produtividade', label: 'Produtividade e Avaliações' },
  { id: 'escala',        label: 'Escala e Postos'           },
  { id: 'apontamentos',  label: 'Apontamentos'              },
  // Entre Apontamentos e Horas Extras porque é a ordem cronológica do dado: escala → apontamento
  // → ponto → hora extra. A outra metade do módulo, a do funcionário, mora fora do menu, em
  // /app/ponto — o colaborador não alcança esta tela.
  { id: 'ponto',         label: 'Ponto Eletrônico'          },
  { id: 'horas-extras',  label: 'Horas Extras'              },
  { id: 'faltas',        label: 'Faltas e Ausências'        },
  { id: 'cmo',           label: 'Custo Mensal'              },
  { id: 'folha',         label: 'Folha e RH Financeiro'     },
  { id: 'seguranca',     label: 'Segurança'                 },
]

interface Props {
  activeTab: MaoDeObraTab
  onTabChange: (tab: MaoDeObraTab) => void
}

export function MaoDeObraHeader({ activeTab, onTabChange }: Props) {
  const { workers, shifts, absences, workPosts, violations } = useMaoDeObraStore(
    useShallow((s) => ({
      workers:    s.workers,
      shifts:     s.shifts,
      absences:   s.absences,
      workPosts:  s.workPosts,
      violations: s.violations,
    }))
  )
  const importarFuncionarios = useMaoDeObraStore((s) => s.importarFuncionarios)
  const [importOpen, setImportOpen] = useState(false)
  const [importSiteId, setImportSiteId] = useState('')
  const sites = useTorreStore((s) => s.sites)
  const sync = useStoreSync(useMaoDeObraStore)

  const kpis = useMemo(() => {
    const today     = hojeLocalISO()
    const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return dataLocalISO(d) })()

    const activeWorkers = workers.filter((w) => w.status === 'active').length

    // Absences this week (exclude vacations from "faltas" count)
    const faltasSemana = absences.filter(
      (a) => a.date >= weekStart && a.date <= today && a.type !== 'vacation',
    ).length

    // Overtime shifts this week — sum hours approximation
    const heShifts = shifts.filter((s) => s.type === 'overtime' && s.date >= weekStart && s.date <= today)
    const heHours  = heShifts.reduce((sum, s) => {
      const [sh, sm] = s.startTime.split(':').map(Number)
      const [eh, em] = s.endTime.split(':').map(Number)
      let h = (eh * 60 + em - sh * 60 - sm) / 60
      if (h < 0) h += 24
      return sum + Math.max(0, h - s.breakMinutes / 60)
    }, 0)

    // Mesma regra da aba Postos e do Dashboard — antes esta ignorava o cargo.
    const postosDesc = postosDescobertos(workPosts, today, shifts, workers)

    const cltViol = violations.length

    return [
      {
        label: 'Colaboradores Ativos',
        value: `${activeWorkers} / ${workers.length}`,
        icon:  Users,
        color: '#3b82f6',
      },
      {
        label: 'Faltas esta Semana',
        value: String(faltasSemana),
        icon:  AlertTriangle,
        color: faltasSemana === 0 ? '#22c55e' : faltasSemana <= 3 ? '#f59e0b' : '#ef4444',
      },
      {
        label: 'HE esta Semana',
        value: `${heHours.toFixed(1)}h`,
        icon:  Clock,
        color: heHours === 0 ? '#22c55e' : heHours <= 20 ? '#f59e0b' : '#ef4444',
      },
      {
        label: 'Postos Descobertos',
        value: String(postosDesc),
        icon:  MapPin,
        color: postosDesc === 0 ? '#22c55e' : '#ef4444',
      },
      {
        label: 'Violações CLT',
        value: String(cltViol),
        icon:  ShieldCheck,
        color: cltViol === 0 ? '#22c55e' : cltViol <= 3 ? '#f59e0b' : '#ef4444',
      },
    ] as const
  }, [workers, shifts, absences, workPosts, violations])

  return (
    <div className="flex flex-col gap-4 px-6 pt-6 pb-0">
      {/* Title row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#f97316]/15">
            <Users size={18} className="text-[#ffa055]" />
          </div>
          <div>
            <h1 className="text-[#f5f5f5] text-lg font-semibold leading-none">Mão de Obra</h1>
            <p className="text-[#adadad] text-xs mt-0.5">Gestão de equipes, ausências e folha de pagamento</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SyncBadge {...sync} />
          <select value={importSiteId} onChange={(e) => setImportSiteId(e.target.value)} aria-label="Obra da importação de funcionários"
            className="max-w-48 rounded-lg border border-[#525252] bg-[#484848] px-2 py-2 text-xs text-[#f5f5f5]">
            <option value="">Obra da importação…</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button
            onClick={() => setImportOpen(true)} disabled={!importSiteId}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            title="Importar funcionários de Excel/CSV"
          >
            <Upload size={14} />
            Importar Funcionários
          </button>
        </div>
      </div>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar Funcionários"
        description="Aceita .xlsx, .xls ou .csv. CPF é mascarado automaticamente (LGPD)"
        config={WORKER_IMPORT_CONFIG}
        templateFilename="atlantico-funcionarios-template.xlsx"
        commitLabel={(n) => `Importar ${n} ${n === 1 ? 'funcionário' : 'funcionários'}`}
        onCommit={(_rows, resultado) => {
          // ⚠️ A gravação NÃO é um laço de `addWorker`. Vai por `importarFuncionarios`, que
          // sanitiza cada linha (planilha de RH traz CPF, RG, CNH e antecedentes na mesma linha do
          // nome, e `workerToRow` grava o objeto inteiro num jsonb) e grava tudo numa vez só.
          const linhas = resultado.porAba.flatMap(({ aba, linhas: doGrupo }) =>
            doGrupo.map((w) => ({
              ...w,
              // O nome da aba é dado: "Equipes Sidnei" e "Equipes Mauá" são frentes diferentes, e
              // a "Equipe A" de uma NÃO é a "Equipe A" da outra. Sem isto, as duas se fundiriam.
              workFront: w.workFront || aba.replace(/^equipes?\s+/i, '').trim() || aba,
            })),
          )
          const previa = importarFuncionarios(linhas as Array<Record<string, unknown>>, { siteId: importSiteId })
          if (previa.pendentesAtualizacao.length) {
            const detalhes = previa.pendentesAtualizacao.map((p) => `${p.nome}: ${p.cargoAtual || 'sem cargo'} → ${p.cargoNovo}`).join('\n')
            if (!confirm(`Revise as atualizações antes de continuar:\n\n${detalhes}\n\nConfirmar estas alterações?`)) return false
          }
          const r = importarFuncionarios(linhas as Array<Record<string, unknown>>, { siteId: importSiteId, confirmarAtualizacoes: true })
          if (!r.gravou) { toast.error('Seu perfil não pode cadastrar funcionários.'); return false }
          const partes = [`${r.criados} criado(s)`, `${r.atualizados} atualizado(s)`, `${r.inalterados} inalterado(s)`]
          if (r.rejeitados.length) partes.push(`${r.rejeitados.length} rejeitado(s): ${r.rejeitados.join(', ')}`)
          if (r.equipesNaoEncontradas.length) {
            partes.push(`sem equipe: ${r.equipesNaoEncontradas.join(', ')} — cadastre a equipe e importe de novo`)
          }
          if (r.camposIgnorados.length) {
            partes.push(`${r.camposIgnorados.length} coluna(s) ignorada(s) por não entrarem no cadastro`)
          }
          toast.success(partes.join(' · '))
          return true
        }}
      />

      {/* KPI cards — 2 cols on mobile, 5 on xl */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-4 py-3 flex items-center gap-3"
          >
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
              style={{ backgroundColor: `${kpi.color}18` }}
            >
              <kpi.icon size={16} style={{ color: kpi.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[#adadad] text-xs truncate">{kpi.label}</p>
              <p className="text-[#f5f5f5] text-lg font-bold leading-tight">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar — scrollable */}
      <div className="flex gap-1 border-b border-[#525252] -mb-px overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0',
              activeTab === tab.id
                ? 'border-[#f97316] text-[#ffa055]'
                : 'border-transparent text-[#adadad] hover:text-[#f5f5f5]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
