/**
 * NovoPredioWizard — onboarding de um prédio novo (modal 4 etapas): identificação → estrutura
 * (torres/unidades/m²/pavimentos) → obrigações legais padrão → revisão. Ao concluir, cria o
 * site na Torre de Controle, ativa-o como obra atual e semeia os laudos escolhidos (reusando o
 * catálogo LAUDO_TIPOS). Client-only (persiste no payload jsonb do site — sem migração).
 *
 * Isolamento demo: NÃO deixa cadastrar prédio real enquanto o modo Demonstração está ligado
 * (senão o site de demo entraria na fila de sync e misturaria com o real). Bloqueia com aviso.
 */
import { useState } from 'react'
import { Building2, Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useLaudosStore } from '@/store/laudosStore'
import { isNonProductionDataMode } from '@/lib/runtimeMode'
import { LAUDO_TIPOS, LAUDO_PERIODICIDADE_PADRAO } from '../utils/laudos'
import type { ConstructionSite } from '@/types'

const inputCls = 'w-full rounded-lg border border-[#525252] bg-[#333333] px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]'
const TIPOS = ['Condomínio Residencial', 'Torre Comercial', 'Condomínio Misto', 'Hotel / Flat', 'Galpão / Industrial', 'Edificação'] as const
const LAUDOS_SEMEAVEIS = LAUDO_TIPOS.filter((t) => t !== 'Outro')

export function NovoPredioWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const orgId = useAuth((s) => s.profile?.organization_id ?? null)
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '', code: '', buildingType: 'Condomínio Residencial' as string, manager: '',
    street: '', number: '', district: '', city: '', state: '', cep: '',
    torres: '1', unidades: '', totalArea: '', floors: '',
  })
  const [laudos, setLaudos] = useState<Record<string, boolean>>(() => Object.fromEntries(LAUDOS_SEMEAVEIS.map((t) => [t, true])))
  const set = (patch: Partial<typeof form>) => setForm((s) => ({ ...s, ...patch }))
  const nSel = LAUDOS_SEMEAVEIS.filter((t) => laudos[t]).length

  if (!open) return null

  function next() {
    setError(null)
    if (step === 1 && !form.name.trim()) return setError('Informe o nome do prédio.')
    setStep((s) => Math.min(4, s + 1))
  }

  async function criar() {
    setError(null)
    if (isNonProductionDataMode()) {
      return setError('Saia do modo Demonstração antes de cadastrar um prédio real — os dados de demo não podem se misturar com os reais.')
    }
    if (!orgId) return setError('Empresa ativa ainda carregando. Aguarde um instante e tente de novo.')
    if (!form.name.trim()) { setStep(1); return setError('Informe o nome do prédio.') }
    setSaving(true)
    const num = (v: string) => { const n = Number(v.replace(',', '.')); return v.trim() && Number.isFinite(n) ? n : undefined }
    const today = new Date().toISOString().slice(0, 10)
    const code = form.code.trim() || 'PRED-' + (form.name.trim().split(/\s+/).map((w) => w[0]).join('') || 'X').toUpperCase().slice(0, 4)
    const payload: Omit<ConstructionSite, 'id'> = {
      projectId: null,
      code,
      name: form.name.trim(),
      company: '',
      owner: '',
      manager: form.manager.trim(),
      description: '',
      status: 'active',
      street: form.street.trim(), number: form.number.trim(), district: form.district.trim(),
      city: form.city.trim(), state: form.state.trim(), cep: form.cep.trim(),
      buildingType: form.buildingType,
      totalArea: num(form.totalArea) ?? 0,
      floors: num(form.floors) ?? 0,
      torres: num(form.torres),
      unidades: num(form.unidades),
      serviceScope: form.buildingType,
      startDate: today, expectedEnd: today,
      lat: null, lng: null,
      risks: [],
    }
    useTorreStore.getState().addSite(payload)
    const newId = useTorreStore.getState().selectedId
    if (!newId) { setSaving(false); return setError('Não foi possível criar o prédio. Tente novamente.') }
    useActiveObraStore.getState().setActiveObra(newId)
    // Semeia as obrigações legais escolhidas (sem validade — o síndico informa a data depois).
    for (const tipo of LAUDOS_SEMEAVEIS) {
      if (laudos[tipo]) {
        await useLaudosStore.getState().addLaudo({ tipo, constructionSiteId: newId, periodicidadeMeses: LAUDO_PERIODICIDADE_PADRAO[tipo] })
      }
    }
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#525252] bg-[#2c2c2c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#525252] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f97316]"><Building2 size={18} className="text-white" /></div>
            <div>
              <h2 className="text-base font-bold text-[#f5f5f5]">Novo prédio</h2>
              <p className="text-xs text-[#a3a3a3]">Etapa {step} de 4</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={18} /></button>
        </div>
        <div className="h-1 bg-[#3d3d3d]"><div className="h-full bg-[#f97316] transition-all" style={{ width: `${(step / 4) * 100}%` }} /></div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nome do prédio"><input value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} placeholder="Ed. Jardins, Residencial Aurora..." autoFocus /></Field>
              <Field label="Código (opcional)"><input value={form.code} onChange={(e) => set({ code: e.target.value })} className={inputCls} placeholder="gerado a partir do nome" /></Field>
              <Field label="Tipo">
                <select value={form.buildingType} onChange={(e) => set({ buildingType: e.target.value })} className={inputCls}>
                  {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Síndico / responsável"><input value={form.manager} onChange={(e) => set({ manager: e.target.value })} className={inputCls} placeholder="Nome do síndico" /></Field>
              <Field label="Rua"><input value={form.street} onChange={(e) => set({ street: e.target.value })} className={inputCls} /></Field>
              <Field label="Número"><input value={form.number} onChange={(e) => set({ number: e.target.value })} className={inputCls} /></Field>
              <Field label="Bairro"><input value={form.district} onChange={(e) => set({ district: e.target.value })} className={inputCls} /></Field>
              <Field label="Cidade"><input value={form.city} onChange={(e) => set({ city: e.target.value })} className={inputCls} /></Field>
              <Field label="UF"><input value={form.state} onChange={(e) => set({ state: e.target.value })} className={inputCls} maxLength={2} placeholder="DF" /></Field>
              <Field label="CEP"><input value={form.cep} onChange={(e) => set({ cep: e.target.value })} className={inputCls} /></Field>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-[#a3a3a3]">Estrutura do prédio — usada nos indicadores por m² e na localização dos ativos.</p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field label="Torres / blocos"><input type="number" min={0} value={form.torres} onChange={(e) => set({ torres: e.target.value })} className={inputCls} /></Field>
                <Field label="Unidades"><input type="number" min={0} value={form.unidades} onChange={(e) => set({ unidades: e.target.value })} className={inputCls} placeholder="ex.: 96" /></Field>
                <Field label="Área total (m²)"><input type="number" min={0} value={form.totalArea} onChange={(e) => set({ totalArea: e.target.value })} className={inputCls} placeholder="ex.: 12800" /></Field>
                <Field label="Pavimentos"><input type="number" min={0} value={form.floors} onChange={(e) => set({ floors: e.target.value })} className={inputCls} placeholder="ex.: 18" /></Field>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-[#a3a3a3]">Marque as obrigações legais que se aplicam ao prédio. Elas entram na aba <strong className="text-[#e5e5e5]">Laudos</strong> já com a periodicidade padrão — você informa as datas depois.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {LAUDOS_SEMEAVEIS.map((t) => (
                  <label key={t} className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm', laudos[t] ? 'border-[#f97316]/60 bg-[#f97316]/10 text-[#f5f5f5]' : 'border-[#525252] bg-[#333333] text-[#a3a3a3]')}>
                    <input type="checkbox" checked={!!laudos[t]} onChange={(e) => setLaudos((s) => ({ ...s, [t]: e.target.checked }))} className="accent-[#f97316]" />
                    <span>{t}</span>
                    <span className="ml-auto text-[10px] text-[#737373]">{LAUDO_PERIODICIDADE_PADRAO[t]}m</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-[#737373]">{nSel} obrigação(ões) serão criadas.</p>
            </div>
          )}
          {step === 4 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Summary label="Prédio" value={form.name || '—'} />
              <Summary label="Tipo" value={form.buildingType} />
              <Summary label="Torres" value={form.torres || '—'} />
              <Summary label="Unidades" value={form.unidades || '—'} />
              <Summary label="Área" value={form.totalArea ? `${form.totalArea} m²` : '—'} />
              <Summary label="Pavimentos" value={form.floors || '—'} />
              <Summary label="Obrigações" value={String(nSel)} />
              <Summary label="Síndico" value={form.manager || '—'} />
            </div>
          )}
          {error && <div className="mt-4 rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-xs text-red-300">{error}</div>}
        </div>

        <div className="flex items-center justify-between border-t border-[#525252] bg-[#1f1f1f] px-6 py-3">
          {step > 1 ? <button onClick={() => { setError(null); setStep((s) => Math.max(1, s - 1)) }} className="flex items-center gap-1.5 rounded px-3 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5]"><ChevronLeft size={14} /> Voltar</button> : <span />}
          {step < 4
            ? <button onClick={next} className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">Próximo <ChevronRight size={14} /></button>
            : <button onClick={() => void criar()} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-5 py-2 text-sm font-bold text-white disabled:opacity-70"><Check size={14} /> {saving ? 'Criando...' : 'Criar prédio'}</button>}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#a3a3a3]">{label}{children}</label>
}
function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[#525252] bg-[#333333] p-4"><p className="text-[10px] uppercase tracking-wider text-[#6b6b6b]">{label}</p><p className="mt-1 truncate text-lg font-bold text-[#f5f5f5]">{value}</p></div>
}
