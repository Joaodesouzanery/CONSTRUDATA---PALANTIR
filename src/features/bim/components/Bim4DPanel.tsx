import { useBimStore } from '@/store/bimStore'

export function Bim4DPanel() {
  const project = useBimStore((s) => s.project)
  const range = useBimStore((s) => s.timelineDateRange)
  const activeDate = useBimStore((s) => s.activeDate)
  const setActiveDate = useBimStore((s) => s.setActiveDate)
  const setColorMode = useBimStore((s) => s.setColorMode)

  if (!project) {
    return (
      <div className="h-28 bg-gray-900 border-t border-gray-800 flex items-center justify-center">
        <p className="text-gray-600 text-xs">Carregue um projeto para usar a análise 4D</p>
      </div>
    )
  }

  const minTs = new Date(range.start).getTime()
  const maxTs = new Date(range.end).getTime()
  const activeTs = new Date(activeDate).getTime()
  const pct = maxTs > minTs ? ((activeTs - minTs) / (maxTs - minTs)) * 100 : 0

  // Stats at activeDate
  const segs = project.segments
  const completed = segs.filter((s) => s.constructionDate && s.constructionDate <= activeDate)
  const inProgress = segs.filter((s) => {
    if (!s.constructionDate) return false
    const diff = (activeTs - new Date(s.constructionDate).getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff < 30
  })
  const totalLength = segs.reduce((sum, s) => sum + s.lengthM, 0)
  const completedLength = completed.reduce((sum, s) => sum + s.lengthM, 0)

  function onSlider(e: React.ChangeEvent<HTMLInputElement>) {
    const ts = minTs + ((maxTs - minTs) * Number(e.target.value)) / 100
    const d = new Date(ts)
    const iso = d.toISOString().slice(0, 10)
    setActiveDate(iso)
    setColorMode('date')
  }

  return (
    <div className="h-28 bg-gray-900 border-t border-gray-800 flex flex-col px-4 py-2 shrink-0">
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-300 text-xs font-semibold">Análise 4D — Simulação de Prazo</span>
        <div className="flex items-center gap-4 text-xs">
          <Stat color="bg-gray-600" label="Não iniciado" value={segs.length - completed.length - inProgress.length} />
          <Stat color="bg-yellow-500" label="Em andamento" value={inProgress.length} />
          <Stat color="bg-green-500" label="Concluído" value={completed.length} />
        </div>
      </div>

      {/* Slider */}
      <div className="flex items-center gap-3 mb-1">
        <span className="text-gray-600 text-xs w-20 shrink-0">{range.start}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(pct)}
          onChange={onSlider}
          className="flex-1 h-1.5 accent-indigo-500 cursor-pointer"
        />
        <span className="text-gray-600 text-xs w-20 text-right shrink-0">{range.end}</span>
      </div>

      {/* Active date + progress */}
      <div className="flex items-center justify-between">
        <span className="text-indigo-400 text-xs font-mono font-bold">{activeDate}</span>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>
            Extensão concluída:{' '}
            <span className="text-green-400 font-semibold">
              {completedLength.toFixed(0)} m ({totalLength > 0 ? ((completedLength / totalLength) * 100).toFixed(0) : 0}%)
            </span>
          </span>
        </div>
      </div>

      {/* Thin progress bar */}
      <div className="mt-1.5 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-600 rounded-full transition-all"
          style={{ width: `${pct.toFixed(1)}%` }}
        />
      </div>
    </div>
  )
}

function Stat({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
      <span className="text-gray-500">{label}:</span>
      <span className="text-gray-200 font-semibold">{value}</span>
    </span>
  )
}
