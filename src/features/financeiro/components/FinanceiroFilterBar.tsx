/**
 * FinanceiroFilterBar — barra de filtros avançados compartilhada (Visão Geral, DRE).
 * Intervalo de datas livre + presets, obra, categoria e tipo. Puramente controlada.
 */
import { Filter, X } from 'lucide-react'
import { useTorreStore } from '@/store/torreDeControleStore'
import { ENTRADA_CATS, SAIDA_CATS, catLabel, presetDePeriodo } from '../lib/financeiroCalc'
import type { FinanceiroFilter } from '../lib/financeiroCalc'

const inputCls = 'bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60'

interface Props {
  value: FinanceiroFilter
  onChange: (next: FinanceiroFilter) => void
  showTipo?: boolean
  showCategoria?: boolean
  /** A tela "Por Obra" tem seletor de obra próprio — dois na mesma barra confundem. */
  showObra?: boolean
}

export function FinanceiroFilterBar({ value, onChange, showTipo = true, showCategoria = true, showObra = true }: Props) {
  const sites = useTorreStore((s) => s.sites)
  const set = (patch: Partial<FinanceiroFilter>) => onChange({ ...value, ...patch })
  const cats = [
    ...ENTRADA_CATS.map((c) => ({ key: c, label: `Entrada · ${catLabel(c)}` })),
    ...SAIDA_CATS.map((c) => ({ key: c, label: `Saída · ${catLabel(c)}` })),
  ]
  const hasActive = value.from || value.to || value.obraId || value.categoria || value.tipo

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#525252] bg-[#333333] p-3">
      <div className="flex items-center gap-1.5 text-[#a3a3a3] text-xs font-semibold pr-1">
        <Filter size={13} /> Filtros
      </div>

      {/* Presets de período */}
      <div className="flex gap-1">
        {([['mes', 'Este mês'], ['ano', 'Este ano'], ['12m', '12 meses'], ['tudo', 'Tudo']] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => set(presetDePeriodo(k))}
            className="px-2 py-1 rounded-md text-[11px] font-medium text-[#a3a3a3] bg-[#2c2c2c] border border-[#525252] hover:text-white hover:border-[#f97316]/50 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Intervalo livre */}
      <div className="flex items-center gap-1">
        <input type="date" value={value.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} className={inputCls} aria-label="De" />
        <span className="text-[#6b6b6b] text-xs">até</span>
        <input type="date" value={value.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} className={inputCls} aria-label="Até" />
      </div>

      {/* Obra */}
      {showObra && (
        <select value={value.obraId ?? ''} onChange={(e) => set({ obraId: e.target.value || undefined })} className={inputCls} aria-label="Obra">
          <option value="">Todas as obras</option>
          {sites.map((o) => <option key={o.id} value={o.id}>{o.code ? `${o.code} — ` : ''}{o.name}</option>)}
        </select>
      )}

      {/* Categoria */}
      {showCategoria && (
        <select value={value.categoria ?? ''} onChange={(e) => set({ categoria: e.target.value || undefined })} className={inputCls} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      )}

      {/* Tipo */}
      {showTipo && (
        <div className="inline-flex rounded-lg border border-[#525252] overflow-hidden">
          {([['', 'Ambos'], ['entrada', 'Entradas'], ['saida', 'Saídas']] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => set({ tipo: k })}
              className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${(value.tipo ?? '') === k ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:text-white bg-[#2c2c2c]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ⚠️ Sem janela, entrada antiga é confrontada com saída de agora e o resultado engana.
          O atalho "Tudo" continua existindo — mas quando está ligado, a barra DIZ o que está
          fazendo, em vez de deixar o número falar sozinho. */}
      {!value.from && !value.to && (
        <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
          somando o histórico inteiro — sem recorte de período
        </span>
      )}

      {hasActive && (
        <button
          type="button"
          onClick={() => onChange(presetDePeriodo('mes'))}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#a3a3a3] hover:text-white transition-colors"
        >
          <X size={12} /> Voltar ao mês
        </button>
      )}
    </div>
  )
}
