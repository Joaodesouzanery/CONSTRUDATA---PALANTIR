/**
 * CalcWizardModal — "Calcular Quantitativo" 3-step wizard.
 *
 * Step 1: Select cost base (SINAPI | SEINFRA | Base Própria | Manual)
 * Step 2: Review items with editable quantities
 * Step 3: Apply BDI + Calculate → summary with totals
 *
 * OrcaFascio-style flow: guides the user through cost estimation
 * with transparency at every step.
 */
import { useState, useRef } from 'react'
import { X, ChevronRight, ChevronLeft, Calculator, Upload, Check, Database, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import type { CostBaseSource, OrcamentoItem } from '@/types'

const ACCENT = '#8b5cf6'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  const s = String(v ?? '').trim().replace(/R\$\s?/g, '').replace(/\s/g, '')
  if (!s) return 0
  if (s.includes(',') && s.includes('.')) {
    return s.lastIndexOf(',') > s.lastIndexOf('.')
      ? parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
      : parseFloat(s.replace(/,/g, '')) || 0
  }
  if (s.includes(',')) return parseFloat(s.replace(',', '.')) || 0
  return parseFloat(s) || 0
}

// ─── Cost base options ────────────────────────────────────────────────────────

const COST_BASES: { key: CostBaseSource; label: string; desc: string; icon: string }[] = [
  { key: 'sinapi',  label: 'SINAPI',       desc: 'Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil — Caixa Econômica Federal', icon: '🏛️' },
  { key: 'seinfra', label: 'SEINFRA',      desc: 'Sistema de Custos de Referência de Obras — base estadual de infraestrutura', icon: '🔧' },
  { key: 'custom',  label: 'Base Própria', desc: 'Importe sua planilha de preços unitários (código | descrição | unidade | custo)', icon: '📂' },
  { key: 'manual',  label: 'Manual',       desc: 'Custos inseridos diretamente por você, sem base de referência', icon: '✏️' },
]

// ─── Step 1: Select cost base ─────────────────────────────────────────────────

function Step1CostBase({
  selected, onSelect, onImportBase,
}: {
  selected: CostBaseSource
  onSelect: (b: CostBaseSource) => void
  onImportBase: (file: File) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-3">
      <p className="text-[#a3a3a3] text-xs leading-relaxed">
        Selecione a base de custos de referência. O custo unitário de cada item
        será extraído da base selecionada e combinado com as quantidades do projeto.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {COST_BASES.map((b) => (
          <button
            key={b.key}
            onClick={() => onSelect(b.key)}
            className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors ${
              selected === b.key
                ? 'border-violet-500 bg-violet-500/10'
                : 'border-[#525252] bg-[#3a3a3a] hover:border-[#6b6b6b]'
            }`}
          >
            <span className="text-xl leading-none mt-0.5">{b.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-semibold text-sm ${selected === b.key ? 'text-violet-300' : 'text-white'}`}>
                  {b.label}
                </span>
                {selected === b.key && <Check size={13} className="text-violet-400 shrink-0" />}
              </div>
              <p className="text-[#6b6b6b] text-xs mt-0.5 leading-relaxed">{b.desc}</p>
            </div>
          </button>
        ))}
      </div>
      {selected === 'custom' && (
        <div className="mt-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border border-dashed border-[#525252] text-[#a3a3a3] hover:border-violet-400 hover:text-violet-300 transition-colors w-full justify-center"
          >
            <Upload size={14} />
            Importar planilha de preços (XLSX / CSV)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportBase(f); if (fileRef.current) fileRef.current.value = '' }}
          />
          <p className="text-[10px] text-[#6b6b6b] mt-1 text-center">
            Colunas esperadas: código | descrição | unidade | custo unitário
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Step 2: Review items ─────────────────────────────────────────────────────

function Step2Items({
  items, bdi, onQtyChange, onUnitCostChange,
}: {
  items: OrcamentoItem[]
  bdi: number
  onQtyChange: (id: string, qty: number) => void
  onUnitCostChange: (id: string, cost: number) => void
}) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <Database size={32} className="mx-auto mb-3 text-[#525252]" />
        <p className="text-[#6b6b6b] text-sm">
          Nenhum item no orçamento. Adicione itens na aba{' '}
          <strong className="text-violet-400">Composição</strong> antes de calcular.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[#a3a3a3] text-xs">
        Revise quantidades e custos unitários. O BDI de{' '}
        <strong className="text-violet-300">{bdi}%</strong> será aplicado no próximo passo.
      </p>
      <div className="overflow-x-auto rounded-xl border border-[#525252]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#1f1f1f] text-[#6b6b6b] uppercase text-[9px]">
              <th className="px-3 py-2 text-left border-r border-[#525252]">Descrição</th>
              <th className="px-3 py-2 text-center border-r border-[#525252] w-14">Un</th>
              <th className="px-3 py-2 text-right border-r border-[#525252] w-24">Quantidade</th>
              <th className="px-3 py-2 text-right border-r border-[#525252] w-28">Custo Unit.</th>
              <th className="px-3 py-2 text-right w-28">Total s/BDI</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-[#525252] hover:bg-[#3a3a3a]/30">
                <td className="px-3 py-2 border-r border-[#525252] text-[#f5f5f5] max-w-[220px] truncate">
                  {it.description}
                </td>
                <td className="px-3 py-2 border-r border-[#525252] text-center text-[#a3a3a3]">
                  {it.unit}
                </td>
                <td className="px-2 py-1 border-r border-[#525252]">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={it.quantity}
                    onChange={(e) => onQtyChange(it.id, parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#484848] border border-[#525252] focus:border-violet-500 rounded px-2 py-0.5 text-right text-[#f5f5f5] focus:outline-none text-xs"
                  />
                </td>
                <td className="px-2 py-1 border-r border-[#525252]">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={it.unitCost}
                    onChange={(e) => onUnitCostChange(it.id, parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#484848] border border-[#525252] focus:border-violet-500 rounded px-2 py-0.5 text-right text-[#f5f5f5] focus:outline-none text-xs"
                  />
                </td>
                <td className="px-3 py-2 text-right text-[#f5f5f5] font-medium">
                  {fmtBRL(it.quantity * it.unitCost)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#1f1f1f]">
              <td colSpan={4} className="px-3 py-2 text-right text-[#a3a3a3] font-semibold border-r border-[#525252]">
                Subtotal s/BDI
              </td>
              <td className="px-3 py-2 text-right font-bold text-violet-300">
                {fmtBRL(items.reduce((s, it) => s + it.quantity * it.unitCost, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Step 3: BDI + Calculate ──────────────────────────────────────────────────

function Step3Calculate({
  items, bdi, onBdiChange, calculated, onCalculate,
}: {
  items: OrcamentoItem[]
  bdi: number
  onBdiChange: (v: number) => void
  calculated: boolean
  onCalculate: () => void
}) {
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitCost, 0)
  const bdiFactor = bdi / 100
  const totalBDI  = subtotal * bdiFactor
  const totalFinal = subtotal + totalBDI

  // Category breakdown
  const byCategory: Record<string, number> = {}
  for (const it of items) {
    const cat = it.category || 'Outros'
    byCategory[cat] = (byCategory[cat] ?? 0) + it.quantity * it.unitCost
  }
  const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-4">
      {/* BDI config */}
      <div className="bg-[#3a3a3a] border border-[#525252] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-white font-semibold text-sm">BDI Global</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={50}
              step={0.5}
              value={bdi}
              onChange={(e) => onBdiChange(parseFloat(e.target.value))}
              className="w-28 accent-violet-500"
            />
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={bdi}
              onChange={(e) => onBdiChange(parseFloat(e.target.value) || 0)}
              className="w-16 bg-[#484848] border border-[#525252] focus:border-violet-500 rounded px-2 py-1 text-center text-[#f5f5f5] text-sm focus:outline-none"
            />
            <span className="text-[#a3a3a3] text-sm">%</span>
          </div>
        </div>
        <p className="text-[10px] text-[#6b6b6b]">
          BDI inclui: Administração Central, ISS, PIS/COFINS, Seguro, Garantia e Lucro.
          Típico para obras públicas: 20–28%.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden">
        <div className="bg-[#3a3a3a] px-4 py-2.5 border-b border-[#525252]">
          <span className="text-white font-semibold text-xs uppercase tracking-wide">Resumo do Orçamento</span>
        </div>
        <div className="divide-y divide-[#525252]">
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-[#a3a3a3] text-xs">Subtotal sem BDI</span>
            <span className="text-[#f5f5f5] font-medium text-xs">{fmtBRL(subtotal)}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-[#a3a3a3] text-xs">BDI ({bdi}%)</span>
            <span className="text-[#f5f5f5] font-medium text-xs">{fmtBRL(totalBDI)}</span>
          </div>
          <div className="flex justify-between px-4 py-3 bg-violet-500/5">
            <span className="text-white font-bold text-sm">Total com BDI</span>
            <span className="text-violet-300 font-black text-base">{fmtBRL(totalFinal)}</span>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden">
          <div className="bg-[#3a3a3a] px-4 py-2.5 border-b border-[#525252]">
            <span className="text-white font-semibold text-xs uppercase tracking-wide">Por Categoria (Curva ABC)</span>
          </div>
          <div className="divide-y divide-[#525252]">
            {categories.map(([cat, val]) => (
              <div key={cat} className="flex items-center gap-3 px-4 py-2">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-[#f5f5f5] text-xs truncate">{cat}</span>
                    <span className="text-[#a3a3a3] text-xs shrink-0 ml-2">
                      {((val / subtotal) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1 bg-[#484848] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full"
                      style={{ width: `${Math.min(100, (val / subtotal) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-[#f5f5f5] text-xs font-medium w-28 text-right shrink-0">
                  {fmtBRL(val * (1 + bdiFactor))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!calculated && (
        <button
          onClick={onCalculate}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: ACCENT }}
        >
          <Calculator size={16} />
          Calcular e Aplicar BDI
        </button>
      )}
      {calculated && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-900/20 border border-emerald-700/30 rounded-xl text-emerald-300 text-xs">
          <Check size={14} />
          <span>BDI aplicado — valores atualizados no orçamento.</span>
        </div>
      )}
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export function CalcWizardModal({ onClose }: Props) {
  const {
    currentItems, costBase, bdiGlobal,
    setCostBase, setBdiGlobal, updateItem, importCustomBase, calculateBudget, saveBudget,
  } = useQuantitativosStore()

  const [step, setStep] = useState(1)
  const [localBdi, setLocalBdi] = useState(bdiGlobal)
  const [calculated, setCalculated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [budgetName, setBudgetName] = useState('')

  function handleImportBase(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        if (!ws) return
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })
        const entries = rows
          .filter((r) => Object.values(r).some(Boolean))
          .map((r) => {
            const keys = Object.keys(r)
            const norm = (k: string) => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
            const find = (kws: string[]) => keys.find((k) => kws.some((kw) => norm(k).includes(kw)))
            const colCode = find(['codigo', 'cod', 'item', 'ref'])
            const colDesc = find(['descri', 'servico', 'nome', 'produto'])
            const colUnit = find(['unid', 'un', 'und'])
            const colCost = find(['custo', 'preco', 'valor', 'unit'])
            return {
              code:        colCode ? String(r[colCode] ?? '') : '',
              description: colDesc ? String(r[colDesc] ?? '') : '',
              unit:        colUnit ? String(r[colUnit] ?? '') || 'un' : 'un',
              unitCost:    colCost ? toNum(r[colCost]) : 0,
              category:    'Base Própria',
              source:      'Importado Excel',
            }
          })
          .filter((e) => e.description)
        importCustomBase(entries)
        setCostBase('custom')
      } catch { /* ignore parse errors */ }
    }
    reader.readAsBinaryString(file)
  }

  function handleCalculate() {
    setBdiGlobal(localBdi)
    calculateBudget()
    setCalculated(true)
  }

  function handleSave() {
    if (!budgetName.trim()) return
    saveBudget(budgetName.trim())
    setSaving(false)
    onClose()
  }

  const STEPS = ['Base de Custos', 'Revisar Itens', 'Calcular']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Calculator size={16} style={{ color: ACCENT }} />
            <span className="text-white font-semibold text-sm">Calcular Quantitativo</span>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-5 py-3 gap-0 shrink-0 border-b border-[#525252] bg-[#1f1f1f]">
          {STEPS.map((label, i) => {
            const num = i + 1
            const active = step === num
            const done   = step > num
            return (
              <div key={label} className="flex items-center">
                <div className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    done   ? 'bg-emerald-500 text-white' :
                    active ? 'text-white' :
                    'bg-[#484848] text-[#6b6b6b]'
                  }`} style={active ? { backgroundColor: ACCENT } : {}}>
                    {done ? <Check size={10} /> : num}
                  </div>
                  <span className={`text-xs font-medium ${active ? 'text-white' : 'text-[#6b6b6b]'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight size={13} className="mx-2 text-[#525252] shrink-0" />
                )}
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 && (
            <Step1CostBase
              selected={costBase}
              onSelect={setCostBase}
              onImportBase={handleImportBase}
            />
          )}
          {step === 2 && (
            <Step2Items
              items={currentItems}
              bdi={localBdi}
              onQtyChange={(id, qty) => updateItem(id, { quantity: qty })}
              onUnitCostChange={(id, cost) => updateItem(id, { unitCost: cost })}
            />
          )}
          {step === 3 && (
            <Step3Calculate
              items={currentItems}
              bdi={localBdi}
              onBdiChange={setLocalBdi}
              calculated={calculated}
              onCalculate={handleCalculate}
            />
          )}

          {/* Save dialog (shown after calculation) */}
          {step === 3 && calculated && !saving && (
            <button
              onClick={() => setSaving(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border border-[#525252] text-[#a3a3a3] hover:text-white hover:border-violet-400 transition-colors"
            >
              <FileSpreadsheet size={13} />
              Salvar como Orçamento
            </button>
          )}
          {saving && (
            <div className="mt-3 flex gap-2">
              <input
                autoFocus
                type="text"
                placeholder="Nome do orçamento…"
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                className="flex-1 bg-[#3a3a3a] border border-violet-500 rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none"
              />
              <button
                onClick={handleSave}
                disabled={!budgetName.trim()}
                className="px-4 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
                style={{ backgroundColor: ACCENT }}
              >
                Salvar
              </button>
              <button onClick={() => setSaving(false)} className="px-3 py-2 text-xs text-[#6b6b6b] hover:text-white transition-colors">
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#525252] flex justify-between items-center bg-[#1f1f1f] shrink-0">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors"
          >
            <ChevronLeft size={13} />
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
              style={{ backgroundColor: ACCENT }}
            >
              Próximo
              <ChevronRight size={13} />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg text-xs font-semibold border border-[#525252] text-[#f5f5f5] hover:bg-[#3a3a3a] transition-colors"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
