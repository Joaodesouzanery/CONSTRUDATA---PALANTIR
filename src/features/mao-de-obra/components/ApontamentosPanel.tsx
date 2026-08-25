import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Plus, Upload, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { TimecardDialog } from './dialogs/TimecardDialog'
import type { TimecardEntry, PhysicalProgress } from '@/types'
import { ImportModal } from '@/components/shared/ImportModal'
import { TIMECARD_IMPORT_CONFIG } from '@/lib/importConfigs'
import { usePermissaoEscrita, ROLES_MAO_DE_OBRA_WRITE } from '@/lib/roles'
import { AcoesDaLinha } from './AcoesDaLinha'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')
}

// ─── Physical Progress sub-table ──────────────────────────────────────────────

function ProgressTable({ progress }: { progress: PhysicalProgress[] }) {
  // Aggregate by activity
  const map = new Map<string, { planned: number; reported: number; unit: string }>()
  for (const p of progress) {
    const ex = map.get(p.activityName)
    if (ex) {
      ex.planned  += p.plannedQty
      ex.reported += p.reportedQty
    } else {
      map.set(p.activityName, { planned: p.plannedQty, reported: p.reportedQty, unit: p.unit })
    }
  }

  const rows = Array.from(map.entries()).map(([name, v]) => ({
    name,
    ...v,
    deviation: v.planned > 0 ? Math.round(((v.reported - v.planned) / v.planned) * 100) : 0,
  }))

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
      <p className="text-[#f5f5f5] text-sm font-semibold mb-3">Progresso Físico Acumulado</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#525252]">
              <th className="text-left text-[#adadad] font-medium pb-2">Atividade</th>
              <th className="text-right text-[#adadad] font-medium pb-2">Planejado</th>
              <th className="text-right text-[#adadad] font-medium pb-2">Realizado</th>
              <th className="text-right text-[#adadad] font-medium pb-2">Desvio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-[#3d3d3d] last:border-0">
                <td className="py-2 text-[#f5f5f5]">{row.name}</td>
                <td className="py-2 text-right text-[#adadad]">{row.planned} {row.unit}</td>
                <td className="py-2 text-right text-[#f5f5f5]">{row.reported} {row.unit}</td>
                <td className="py-2 text-right">
                  <span
                    className="font-semibold"
                    style={{
                      color: row.deviation >= 0 ? '#22c55e' : row.deviation >= -15 ? '#f59e0b' : '#ef4444',
                    }}
                  >
                    {row.deviation >= 0 ? '+' : ''}{row.deviation}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Timecard Table ───────────────────────────────────────────────────────────

function TimecardTable({
  timecards,
  workers,
  podeEditar,
  onEditar,
  onExcluir,
}: {
  timecards: TimecardEntry[]
  workers: import('@/types').Worker[]
  podeEditar: boolean
  onEditar: (tc: TimecardEntry) => void
  onExcluir: (tc: TimecardEntry) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const workerMap = new Map(workers.map((w) => [w.id, w.name]))

  const sorted = [...timecards].sort((a, b) => b.date.localeCompare(a.date))
  const visible = showAll ? sorted : sorted.slice(0, 10)

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
      <p className="text-[#f5f5f5] text-sm font-semibold mb-3">Apontamentos ({timecards.length})</p>
      {timecards.length === 0 ? (
        <p className="text-[#adadad] text-sm">Nenhum apontamento registrado.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#525252]">
                  <th className="text-left text-[#adadad] font-medium pb-2">Data</th>
                  <th className="text-left text-[#adadad] font-medium pb-2">Funcionário</th>
                  <th className="text-left text-[#adadad] font-medium pb-2 hidden md:table-cell">Atividade</th>
                  <th className="text-right text-[#adadad] font-medium pb-2">HH</th>
                  <th className="text-right text-[#adadad] font-medium pb-2">Qtd</th>
                  <th className="text-left text-[#adadad] font-medium pb-2">Un</th>
                  {podeEditar && <th className="text-right text-[#adadad] font-medium pb-2">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((tc) => (
                  <tr key={tc.id} className="border-b border-[#3d3d3d] last:border-0">
                    <td className="py-2 text-[#adadad] shrink-0">{formatDate(tc.date)}</td>
                    <td className="py-2 text-[#f5f5f5] max-w-[120px] truncate">
                      {workerMap.get(tc.workerId) ?? tc.workerId}
                    </td>
                    <td className="py-2 text-[#f5f5f5] max-w-[200px] truncate hidden md:table-cell">
                      {tc.activityDescription}
                    </td>
                    <td className="py-2 text-right text-[#f5f5f5]">{tc.hoursWorked}h</td>
                    <td className="py-2 text-right text-[#f5f5f5]">{tc.reportedQty}</td>
                    <td className="py-2 text-[#adadad]">{tc.unit}</td>
                    {podeEditar && (
                      <td className="py-2 text-right whitespace-nowrap">
                        <div className="flex justify-end">
                          <AcoesDaLinha
                            descricao={`o apontamento de ${tc.date}`}
                            onEditar={() => onEditar(tc)}
                            onExcluir={() => onExcluir(tc)}
                            // A tela já tem a própria confirmação neste caminho.
                            confirmar={false}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sorted.length > 10 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 flex items-center gap-1 text-xs text-[#adadad] hover:text-[#f5f5f5] transition-colors"
            >
              {showAll ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showAll ? 'Mostrar menos' : `Ver todos (${sorted.length})`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

/** Sem acento, sem caixa, sem espaço dobrado — "JOAO  DA SILVA" casa com "João da Silva". */
function normalizarNome(v: string): string {
  return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

export function ApontamentosPanel() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [importOpen, setImportOpen]     = useState(false)
  const [naoEncontrados, setNaoEncontrados] = useState<string[]>([])

  const { workers, timecards, progress, importTimecards, removeTimecard } = useMaoDeObraStore(
    useShallow((s) => ({
      workers:        s.workers,
      timecards:      s.timecards,
      progress:       s.progress,
      importTimecards: s.importTimecards,
      removeTimecard:  s.removeTimecard,
    }))
  )
  const [editando, setEditando] = useState<TimecardEntry | null>(null)
  const permissao = usePermissaoEscrita(ROLES_MAO_DE_OBRA_WRITE)

  /**
   * O botão "Importar Planilha" NÃO lia o arquivo.
   *
   * Ele esperava 1,2 s e injetava dois apontamentos fixos de demonstração — `workerId` 'w-3' e
   * 'w-6', 8h cada — no dado real do cliente. Os dois entravam no RUP e no calendário, nunca
   * chegavam ao servidor (aqueles ids não são uuid), voltavam a cada F5 e não tinham como ser
   * excluídos. Cada clique somava mais dois.
   *
   * Agora usa o mesmo importador do resto do projeto: prévia, validação linha a linha e o
   * funcionário identificado pelo nome, traduzido para o cadastro real na hora de gravar.
   */
  function commitApontamentos(rows: { workerName: string; date: string; hoursWorked: number; projectRef: string; phaseRef: string; activityDescription: string; reportedQty: number; unit: string }[]) {
    const porNome = new Map(workers.map((w) => [normalizarNome(w.name), w.id]))
    const semCadastro: string[] = []
    const entradas: Omit<TimecardEntry, 'id'>[] = []

    for (const linha of rows) {
      const workerId = porNome.get(normalizarNome(linha.workerName))
      if (!workerId) {
        // Inventar o funcionário aqui criaria um cadastro pela porta dos fundos, sem CPF, sem
        // salário e sem contrato — e a folha dele sairia errada. Melhor dizer quem faltou.
        if (!semCadastro.includes(linha.workerName)) semCadastro.push(linha.workerName)
        continue
      }
      entradas.push({
        workerId,
        date: linha.date,
        hoursWorked: linha.hoursWorked,
        projectRef: linha.projectRef,
        phaseRef: linha.phaseRef,
        activityDescription: linha.activityDescription,
        reportedQty: linha.reportedQty,
        unit: linha.unit,
      })
    }

    if (entradas.length) importTimecards(entradas)
    setNaoEncontrados(semCadastro)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Action bar */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-semibold transition-colors"
        >
          <Plus size={15} />
          Novo Apontamento
        </button>

        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1f3c5e] text-[#f5f5f5] text-sm font-medium hover:bg-[#484848] transition-colors"
        >
          <Upload size={15} />
          Importar Planilha
        </button>
      </div>

      {!permissao.pode && (
        <div className="flex items-start gap-2 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/[0.08] px-3 py-2.5 text-[11px] text-[#fbbf24]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span><strong>Este acesso não lança apontamento.</strong> {permissao.explicacao}</span>
        </div>
      )}

      {naoEncontrados.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/[0.08] px-3 py-2.5 text-[11px] text-[#fbbf24]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            <strong>{naoEncontrados.length} nome{naoEncontrados.length !== 1 ? 's' : ''} da planilha não está no cadastro</strong> e
            ficou de fora: {naoEncontrados.join(' · ')}. Cadastre em Funcionários (ou corrija a grafia na planilha) e importe de novo —
            só essas linhas voltam.
          </span>
        </div>
      )}

      <TimecardTable
        timecards={timecards}
        workers={workers}
        podeEditar={permissao.pode}
        onEditar={(tc) => setEditando(tc)}
        onExcluir={(tc) => {
          const nome = workers.find((w) => w.id === tc.workerId)?.name ?? 'este funcionário'
          if (window.confirm(`Excluir o apontamento de ${nome} em ${formatDate(tc.date)} (${tc.hoursWorked}h)?`)) {
            removeTimecard(tc.id)
          }
        }}
      />
      <ProgressTable progress={progress} />

      {isDialogOpen && <TimecardDialog onClose={() => setIsDialogOpen(false)} />}
      {editando && <TimecardDialog apontamento={editando} onClose={() => setEditando(null)} />}

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar Apontamentos"
        description="Aceita .xlsx, .xls ou .csv. O funcionário é identificado pelo nome, como está no cadastro."
        config={TIMECARD_IMPORT_CONFIG}
        templateFilename="apontamentos-template.xlsx"
        commitLabel={(n) => `Importar ${n} ${n === 1 ? 'apontamento' : 'apontamentos'}`}
        onCommit={commitApontamentos}
      />
    </div>
  )
}
