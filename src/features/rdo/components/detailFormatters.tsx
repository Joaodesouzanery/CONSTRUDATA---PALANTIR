/**
 * detailFormatters — helpers de formatação (data/clima/status) do detalhe do RDO.
 * Separado de detailPrimitives.tsx porque aquele exporta componentes e o fast-refresh
 * exige que um arquivo só exporte componentes OU só helpers (não misture os dois).
 */
import { Sun, Cloud, CloudRain, Zap } from 'lucide-react'
import type { RdoWeatherCondition, RdoTrechoStatus } from '@/types'

export function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function weatherIcon(cond: RdoWeatherCondition) {
  switch (cond) {
    case 'good':   return <Sun size={14} className="text-yellow-400" />
    case 'cloudy': return <Cloud size={14} className="text-[#a3a3a3]" />
    case 'rain':   return <CloudRain size={14} className="text-blue-400" />
    case 'storm':  return <Zap size={14} className="text-purple-400" />
    default:       return null
  }
}

export function weatherLabel(cond: RdoWeatherCondition) {
  const map: Record<RdoWeatherCondition, string> = {
    good: 'Bom', cloudy: 'Nublado', rain: 'Chuva', storm: 'Tempestade',
  }
  return map[cond] ?? '—'
}

export function trechoStatusBadge(status: RdoTrechoStatus | string) {
  if (status === 'completed')   return <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-900/50 text-emerald-300">Concluído</span>
  if (status === 'in_progress') return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-900/50 text-yellow-300">Em Execução</span>
  return <span className="px-2 py-0.5 rounded-full text-xs bg-[#484848] text-[#a3a3a3]">Não Iniciado</span>
}
