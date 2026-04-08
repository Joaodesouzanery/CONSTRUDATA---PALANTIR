/**
 * PlanejamentoImpactWidget — Widget reutilizável para propagar atrasos de
 * material para o módulo de Planejamento.
 *
 * Auditoria #8 — integração ALTA "Planejamento ↔ Suprimentos".
 *
 * UX: input de palavras-chave (ex.: "PVC DN200") + slider de dias de atraso
 * + botão que dispara applyMaterialDelayToPlanejamento e mostra o impacto.
 */
import { useState } from 'react'
import { Zap, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react'
import { applyMaterialDelayToPlanejamento } from '@/store/crossModuleSync'
import type { MaterialDelayImpact } from '@/store/crossModuleSync'

export function PlanejamentoImpactWidget() {
  const [keywords, setKeywords] = useState('')
  const [delayDays, setDelayDays] = useState(3)
  const [result, setResult] = useState<MaterialDelayImpact | null>(null)

  function handleApply() {
    const kws = keywords.split(/\s+/).map((s) => s.trim()).filter(Boolean)
    if (kws.length === 0) {
      setResult({ matchedTrechos: 0, delayDays: 0, affectedTrechosCodes: [] })
      return
    }
    const r = applyMaterialDelayToPlanejamento(kws, delayDays)
    setResult(r)
  }

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={16} className="text-[#f97316]" />
        <h3 className="text-white font-semibold text-sm">
          Propagar atraso de material para Planejamento
        </h3>
      </div>
      <p className="text-[#a3a3a3] text-xs mb-4 leading-relaxed">
        Quando um material atrasa, esta ferramenta procura todos os trechos do
        cronograma cuja descrição contém as palavras-chave informadas e marca
        o cronograma como "sujo" para recálculo. <br />
        <span className="italic text-[#6b6b6b]">
          (No Sprint 2 do Supabase, vira foreign key formal `trecho.material_id` — sem palavras-chave.)
        </span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[#a3a3a3] mb-1.5">
            Palavras-chave do material
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="ex.: PVC DN200"
            className="w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[#a3a3a3] mb-1.5">
            Dias de atraso ({delayDays}d)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={30}
              value={delayDays}
              onChange={(e) => setDelayDays(Number(e.target.value))}
              className="flex-1 accent-[#f97316]"
            />
            <input
              type="number"
              min={1}
              max={365}
              value={delayDays}
              onChange={(e) => setDelayDays(Number(e.target.value) || 1)}
              className="w-16 bg-[#484848] border border-[#5e5e5e] rounded-lg px-2 py-1.5 text-sm text-gray-100 text-center focus:outline-none focus:border-[#f97316]/50"
            />
          </div>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleApply}
            disabled={!keywords.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowRight size={14} />
            Aplicar
          </button>
        </div>
      </div>

      {result && (
        <div
          className={`p-3 rounded-lg border text-xs ${
            result.matchedTrechos > 0
              ? 'border-[#f59e0b]/50 bg-[#f59e0b]/10 text-[#fbbf24]'
              : 'border-[#525252] bg-[#484848] text-[#a3a3a3]'
          }`}
        >
          {result.matchedTrechos > 0 ? (
            <>
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <strong>{result.matchedTrechos}</strong> {result.matchedTrechos === 1 ? 'trecho afetado' : 'trechos afetados'} pelo
                  atraso de <strong>{result.delayDays}</strong> {result.delayDays === 1 ? 'dia' : 'dias'}.
                </div>
              </div>
              <div className="ml-6 text-[10px]">
                Trechos: {result.affectedTrechosCodes.slice(0, 8).join(', ')}
                {result.affectedTrechosCodes.length > 8 && ` e mais ${result.affectedTrechosCodes.length - 8}`}
              </div>
              <div className="ml-6 mt-2 text-[10px] italic">
                Vá em <strong>Planejamento</strong> e clique em <strong>"Rodar Cronograma"</strong> para recalcular CPI/SPI.
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0" />
              Nenhum trecho do cronograma foi encontrado com essas palavras-chave.
              Verifique a grafia ou abra o módulo Planejamento.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
