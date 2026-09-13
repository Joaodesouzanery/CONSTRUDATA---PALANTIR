/**
 * PlanoContasPanel — Plano de Contas orçado × real do módulo Financeiro.
 * Custos em 4 pilares (orçado dos costAccounts × real dos lançamentos), seção
 * de Receitas (orçado = valor de contrato da obra × real das entradas), vínculo
 * de cada seção com a linha da DRE, e filtro/subtotais por obra.
 * Real e orçado são derivados (não altera lançamentos nem métricas do EVM).
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Receipt, Trash2, Package, Wrench, Users, FileText, X, TrendingUp, ArrowRight } from 'lucide-react'
import { useEvmStore } from '@/store/evmStore'
import { ehLinhaTotal, obraBacFromSite, vigenciaDaObra } from '@/features/torre-de-controle/utils/obraBudget'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { formatCurrency } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { filterEntries, catLabel, DRE_LINE_LABELS, num, presetDePeriodo } from '@/features/financeiro/lib/financeiroCalc'
import type { FinanceiroFilter } from '@/features/financeiro/lib/financeiroCalc'
import { FinanceiroFilterBar } from '@/features/financeiro/components/FinanceiroFilterBar'
import type { ConstructionSite, CostPillar, ImpostoNF, DreLineKey, SaidaCategoria, EntradaCategoria } from '@/types'
import { valoresDoContrato } from '@/features/torre-de-controle/utils/obraMedicao'

interface PillarConfig {
  key: CostPillar
  label: string
  color: string
  icon: typeof Package
  cats: SaidaCategoria[]     // categorias de saída somadas como "real" deste pilar
  dreLine: DreLineKey
}

const PILLARS: PillarConfig[] = [
  { key: 'material', label: 'Material', color: '#38bdf8', icon: Package, cats: ['materiais'], dreLine: 'custo' },
  { key: 'equipamento', label: 'Equipamentos', color: '#f97316', icon: Wrench, cats: ['equipamentos'], dreLine: 'custo' },
  { key: 'mao_de_obra', label: 'Mão de Obra', color: '#22c55e', icon: Users, cats: ['mao_de_obra', 'subempreiteiros'], dreLine: 'custo' },
  { key: 'impostos_indiretos', label: 'Impostos / Indiretos', color: '#a78bfa', icon: FileText, cats: ['administrativo', 'outro'], dreLine: 'despesa_adm' },
]

interface NewEntryForm {
  pillar: CostPillar
  description: string
  unitCostBRL: string
  quantity: string
  activityId: string
  obraId: string
}
const EMPTY_FORM: NewEntryForm = { pillar: 'material', description: '', unitCostBRL: '', quantity: '', activityId: '', obraId: '' }

function VarianceStrip({ orcado, real, mode, color }: { orcado: number; real: number; mode: 'custo' | 'receita'; color: string }) {
  const variancia = orcado - real
  const pct = orcado > 0 ? (real / orcado) * 100 : 0
  // Custo: consumir acima do orçado é ruim (vermelho). Receita: faturar mais é bom.
  const over = mode === 'custo' ? real > orcado : false
  const barColor = over ? '#ef4444' : color
  return (
    <div className="flex flex-col gap-1 min-w-[220px]">
      <div className="flex items-center justify-between gap-4 text-[11px]">
        <span className="text-[#a3a3a3]">Orçado <strong className="text-[#f5f5f5] font-mono">{formatCurrency(orcado)}</strong></span>
        <span className="text-[#a3a3a3]">Real <strong className="font-mono" style={{ color: barColor }}>{formatCurrency(real)}</strong></span>
      </div>
      <div className="h-2 bg-[#2c2c2c] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[#6b6b6b]">{pct.toFixed(0)}% {mode === 'custo' ? 'consumido' : 'realizado'}</span>
        <span style={{ color: variancia >= 0 ? '#22c55e' : '#ef4444' }} className="font-mono">
          {mode === 'custo' ? 'Saldo ' : 'Falta '}{formatCurrency(Math.abs(variancia))}
        </span>
      </div>
    </div>
  )
}

function DreBadge({ line }: { line: DreLineKey }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-[#2c2c2c] text-[#a3a3a3] border border-[#525252]">
      DRE <ArrowRight size={9} /> {DRE_LINE_LABELS[line]}
    </span>
  )
}

export function PlanoContasPanel() {
  const { costAccounts, addCostAccount, updateCostAccount, removeCostAccount } = useEvmStore()
  const entries = useFinanceiroStore((s) => s.entries)
  const sites = useTorreStore((s) => s.sites)

  const [obraFilter, setObraFilter] = useState('')
  /** A janela do realizado. Nasce no mês, como as outras telas do módulo. */
  const [periodo, setPeriodo] = useState<FinanceiroFilter>(() => presetDePeriodo('mes'))
  const [addingPillar, setAddingPillar] = useState<CostPillar | null>(null)
  const [form, setForm] = useState<NewEntryForm>({ ...EMPTY_FORM })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ description: string; unitCostBRL: string; quantity: string; obraId: string }>({ description: '', unitCostBRL: '', quantity: '', obraId: '' })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const siteName = useMemo(() => {
    const m = new Map(sites.map((s) => [s.id, s.code ? `${s.code} — ${s.name}` : s.name]))
    return (id?: string) => (id ? (m.get(id) ?? '—') : '—')
  }, [sites])

  // Escopo por obra
  const scopedCAs = useMemo(
    () => (obraFilter ? costAccounts.filter((ca) => (ca.obraId ?? '') === obraFilter) : costAccounts),
    [costAccounts, obraFilter],
  )
  /**
   * ⚠️ Havia `filterEntries` SEM `from`/`to`: o orçado (valor cheio do contrato) era confrontado
   * com o realizado de todo o tempo. O "% consumido" e o "Saldo" comparavam coisas de janelas
   * diferentes, e o saldo parecia melhor do que é.
   */
  const vigencia = useMemo(
    () => (obraFilter ? vigenciaDaObra(sites.find((s) => s.id === obraFilter)) : null),
    [obraFilter, sites],
  )

  const scopedEntries = useMemo(
    () => filterEntries(entries, { from: periodo.from, to: periodo.to, obraId: obraFilter || undefined }),
    [entries, obraFilter, periodo.from, periodo.to],
  )
  const saidas = useMemo(() => scopedEntries.filter((e) => e.tipo === 'saida'), [scopedEntries])
  const entradas = useMemo(() => scopedEntries.filter((e) => e.tipo === 'entrada'), [scopedEntries])

  const realByCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of saidas) m.set(e.categoria, (m.get(e.categoria) ?? 0) + num(e.valor))
    return m
  }, [saidas])

  function orcadoPillar(p: PillarConfig) { return scopedCAs.filter((ca) => ca.pillar === p.key).reduce((s, ca) => s + ca.totalCostBRL, 0) }
  function realPillar(p: PillarConfig) { return p.cats.reduce((s, c) => s + (realByCat.get(c) ?? 0), 0) }

  // Receitas
  //
  // Usa `obraBacFromSite`, que é a MESMA precedência da Carteira e do Planejamento Mestre:
  // contrato → linha 'Total' do orçamento → soma das linhas → `orcamentoBRL` do cadastro.
  //
  // Antes esta tela lia SÓ `orcamentoBRL`, ignorando o contrato. O resultado era duas telas do
  // mesmo sistema dando respostas diferentes para "quanto vale a obra": a Carteira mostrava o
  // contrato (ex.: R$ 592.324,14) e aqui aparecia o valor solto do cadastro (R$ 12.000).
  const orcadoReceita = obraFilter
    ? obraBacFromSite(sites.find((s) => s.id === obraFilter))
    : sites.reduce((s, o) => s + obraBacFromSite(o), 0)
  const realReceita = entradas.reduce((s, e) => s + num(e.valor), 0)
  const realReceitaByCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of entradas) m.set(e.categoria, (m.get(e.categoria) ?? 0) + num(e.valor))
    return m
  }, [entradas])

  // Totais
  const orcadoCustoTotal = PILLARS.reduce((s, p) => s + orcadoPillar(p), 0)
  const realCustoTotal = saidas.reduce((s, e) => s + num(e.valor), 0)
  const margemOrcada = orcadoReceita - orcadoCustoTotal
  const resultadoReal = realReceita - realCustoTotal

  function startEdit(id: string) {
    const ca = costAccounts.find((c) => c.id === id)
    if (!ca) return
    setEditingId(id)
    setEditForm({ description: ca.description, unitCostBRL: String(ca.unitCostBRL), quantity: String(ca.quantity), obraId: ca.obraId ?? '' })
  }
  function confirmEdit() {
    if (!editingId) return
    const unitCost = parseFloat(editForm.unitCostBRL)
    const qty = parseFloat(editForm.quantity)
    if (!editForm.description.trim() || isNaN(unitCost) || isNaN(qty)) return
    updateCostAccount(editingId, { description: editForm.description, unitCostBRL: unitCost, quantity: qty, obraId: editForm.obraId || undefined })
    setEditingId(null)
  }
  function openAddForm(pillar: CostPillar) {
    setAddingPillar(pillar)
    setForm({ ...EMPTY_FORM, pillar, obraId: obraFilter })
  }
  function handleAdd() {
    const unitCost = parseFloat(form.unitCostBRL)
    const qty = parseFloat(form.quantity)
    if (!form.description.trim() || isNaN(unitCost) || isNaN(qty)) return
    addCostAccount({
      activityId: form.activityId || crypto.randomUUID().slice(0, 8),
      pillar: form.pillar,
      description: form.description,
      unitCostBRL: unitCost,
      quantity: qty,
      obraId: form.obraId || undefined,
    })
    setAddingPillar(null)
    setForm({ ...EMPTY_FORM })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header + filtro de obra */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-[#f5f5f5] text-sm font-semibold">Plano de Contas — Orçado × Real</h2>
        <select
          value={obraFilter}
          onChange={(e) => setObraFilter(e.target.value)}
          className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]"
        >
          <option value="">Todas as obras</option>
          {sites.map((o) => <option key={o.id} value={o.id}>{o.code ? `${o.code} — ` : ''}{o.name}</option>)}
        </select>
      </div>

      {/* A janela do REALIZADO. O orçado é o do contrato inteiro e não se recorta —
          por isso o aviso abaixo, para ninguém ler "% consumido" como se as duas pontas
          cobrissem o mesmo período. */}
      <FinanceiroFilterBar value={periodo} onChange={setPeriodo} showTipo={false} showCategoria={false} showObra={false} vigencia={vigencia} />
      <p className="-mt-3 text-[10px] text-[#6b6b6b]">
        O <b>orçado</b> é o valor do contrato, inteiro. O <b>real</b> é o do período selecionado
        acima — para ver o consumo total da obra, escolha “Tudo”.
      </p>

      {/* Resumo geral */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ResumoCard label="Receita orçada" value={formatCurrency(orcadoReceita)} sub={`Real ${formatCurrency(realReceita)}`} tone="#22c55e" />
        <ResumoCard label="Custo orçado" value={formatCurrency(orcadoCustoTotal)} sub={`Real ${formatCurrency(realCustoTotal)}`} tone="#ef4444" />
        <ResumoCard label="Margem orçada" value={formatCurrency(margemOrcada)} sub={`% ${orcadoReceita > 0 ? ((margemOrcada / orcadoReceita) * 100).toFixed(1) : '0'}`} tone={margemOrcada >= 0 ? '#22c55e' : '#ef4444'} />
        <ResumoCard label="Resultado real" value={formatCurrency(resultadoReal)} sub={`% ${realReceita > 0 ? ((resultadoReal / realReceita) * 100).toFixed(1) : '0'}`} tone={resultadoReal >= 0 ? '#22c55e' : '#ef4444'} />
      </div>

      {/* Receitas */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#525252] flex-wrap gap-3" style={{ borderLeftWidth: 4, borderLeftColor: '#22c55e' }}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#22c55e20' }}>
              <TrendingUp size={15} style={{ color: '#22c55e' }} />
            </div>
            <span className="text-[#f5f5f5] text-sm font-semibold">Receitas</span>
            <DreBadge line="receita_bruta" />
          </div>
          <VarianceStrip orcado={orcadoReceita} real={realReceita} mode="receita" color="#22c55e" />
        </div>
        <div className="px-4 py-3">
          {realReceitaByCat.size === 0 ? (
            /* ⚠️ Este vazio precisa ENSINAR O CAMINHO, não só constatar. A pergunta que ele
               responde é a que o cliente fez olhando a tela: "por que tem receita orçada e não tem
               receita real?". A resposta é que o valor do contrato NÃO é receita — receita nasce de
               nota emitida, e nota se lança no extrato de faturamento da obra. */
            <div className="text-xs text-[#6b6b6b] space-y-1.5">
              <p>
                <span className="text-[#a3a3a3]">Nenhuma receita realizada ainda.</span>{' '}
                O valor do contrato é o que a obra <em>vale</em>; receita só nasce de nota emitida.
              </p>
              <p>
                Para aparecer aqui: <span className="text-[#a3a3a3]">Torre de Controle → Obras →
                Detalhe → Contrato &amp; Medição → extrato de faturamento</span>. Cada nota vira um
                título em Pagamentos e Cobranças, e dar baixa no título gera a entrada.
              </p>
              <OrigemDoOrcado sites={sites} obraFilter={obraFilter} />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {(['medicao', 'adiantamento', 'reajuste', 'outro'] as EntradaCategoria[]).map((c) => {
                const v = realReceitaByCat.get(c) ?? 0
                if (!v) return null
                return (
                  <div key={c} className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2">
                    <p className="text-[10px] text-[#6b6b6b]">{catLabel(c)}</p>
                    <p className="text-sm font-mono text-emerald-400">{formatCurrency(v)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Custos por pilar */}
      {PILLARS.map((pillar) => {
        const pillarCAs = scopedCAs.filter((ca) => ca.pillar === pillar.key)
        const orcado = orcadoPillar(pillar)
        const real = realPillar(pillar)
        const Icon = pillar.icon
        const isAdding = addingPillar === pillar.key

        return (
          <div key={pillar.key} className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#525252] flex-wrap gap-3" style={{ borderLeftWidth: 4, borderLeftColor: pillar.color }}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${pillar.color}20` }}>
                  <Icon size={15} style={{ color: pillar.color }} />
                </div>
                <span className="text-[#f5f5f5] text-sm font-semibold">{pillar.label}</span>
                <span className="text-[#6b6b6b] text-xs">({pillarCAs.length} itens)</span>
                <DreBadge line={pillar.dreLine} />
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <VarianceStrip orcado={orcado} real={real} mode="custo" color={pillar.color} />
                <button
                  onClick={() => openAddForm(pillar.key)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
                >
                  <Plus size={13} /> Adicionar
                </button>
              </div>
            </div>

            {isAdding && (
              <div className="px-4 py-3 bg-[#2c2c2c] border-b border-[#525252] space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-[#a3a3a3] text-xs block mb-1">Descrição</label>
                    <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]" placeholder="Descrição do item" />
                  </div>
                  <div>
                    <label className="text-[#a3a3a3] text-xs block mb-1">Custo Unit. (R$)</label>
                    <input type="number" min={0} step={0.01} value={form.unitCostBRL} onChange={(e) => setForm({ ...form, unitCostBRL: e.target.value })} className="w-full bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] font-mono outline-none focus:border-[#f97316]" placeholder="0,00" />
                  </div>
                  <div>
                    <label className="text-[#a3a3a3] text-xs block mb-1">Quantidade</label>
                    <input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] font-mono outline-none focus:border-[#f97316]" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[#a3a3a3] text-xs block mb-1">Obra</label>
                    <select value={form.obraId} onChange={(e) => setForm({ ...form, obraId: e.target.value })} className="w-full bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]">
                      <option value="">— Geral —</option>
                      {sites.map((o) => <option key={o.id} value={o.id}>{o.code ? `${o.code} — ` : ''}{o.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setAddingPillar(null); setForm({ ...EMPTY_FORM }) }} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors">Cancelar</button>
                  <button onClick={handleAdd} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors">Confirmar</button>
                </div>
              </div>
            )}

            {pillarCAs.length === 0 ? (
              <div className="flex items-center justify-center h-[60px] text-[#6b6b6b] text-xs">
                Nenhum item orçado{obraFilter ? ' nesta obra' : ''}. Real (lançamentos): <span className="font-mono ml-1" style={{ color: pillar.color }}>{formatCurrency(real)}</span>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#525252]/50">
                    <th className="text-left text-[#a3a3a3] text-xs font-medium px-4 py-2">Descrição</th>
                    <th className="text-left text-[#a3a3a3] text-xs font-medium px-4 py-2 w-40">Obra</th>
                    <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2 w-32">Custo Unit.</th>
                    <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2 w-20">Qtd.</th>
                    <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2 w-36">Total</th>
                    <th className="text-center text-[#a3a3a3] text-xs font-medium px-4 py-2 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {pillarCAs.map((ca) => {
                    const isEditing = editingId === ca.id
                    return (
                      <tr key={ca.id} className="border-b border-[#525252]/30 hover:bg-[#484848]/30 transition-colors">
                        <td className="px-4 py-2.5">
                          {isEditing ? (
                            <input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]" />
                          ) : (
                            <>
                              <span className="text-[#f5f5f5] text-sm">{ca.description}</span>
                              <span className="text-[#6b6b6b] text-[10px] font-mono ml-2">{ca.activityId}</span>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {isEditing ? (
                            <select value={editForm.obraId} onChange={(e) => setEditForm({ ...editForm, obraId: e.target.value })} className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]">
                              <option value="">— Geral —</option>
                              {sites.map((o) => <option key={o.id} value={o.id}>{o.code ? `${o.code} — ` : ''}{o.name}</option>)}
                            </select>
                          ) : (
                            <span className="text-[#a3a3a3] text-xs">{ca.obraId ? siteName(ca.obraId) : 'Geral'}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[#a3a3a3] text-sm">
                          {isEditing ? (
                            <input type="number" min={0} step={0.01} value={editForm.unitCostBRL} onChange={(e) => setEditForm({ ...editForm, unitCostBRL: e.target.value })} className="w-24 bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1 text-sm text-right text-[#f5f5f5] font-mono outline-none focus:border-[#f97316]" />
                          ) : formatCurrency(ca.unitCostBRL)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[#a3a3a3] text-sm">
                          {isEditing ? (
                            <input type="number" min={0} value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} className="w-16 bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1 text-sm text-right text-[#f5f5f5] font-mono outline-none focus:border-[#f97316]" />
                          ) : ca.quantity.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[#f5f5f5] text-sm font-semibold">{formatCurrency(ca.totalCostBRL)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {isEditing ? (
                              <>
                                <button onClick={confirmEdit} className="text-[#22c55e] hover:text-[#16a34a] transition-colors" aria-label="Salvar edição"><Check size={14} /></button>
                                <button onClick={() => setEditingId(null)} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors" aria-label="Cancelar edição"><X size={14} /></button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEdit(ca.id)} className="text-[#6b6b6b] hover:text-[#f97316] transition-colors" aria-label="Editar item"><Pencil size={14} /></button>
                                <button onClick={() => setDeletingId(ca.id)} className="text-[#6b6b6b] hover:text-red-400 transition-colors" aria-label="Excluir item"><Trash2 size={14} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#2c2c2c]/50">
                    <td colSpan={4} className="px-4 py-2.5 text-right text-[#a3a3a3] text-xs font-medium">Subtotal orçado {pillar.label}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold" style={{ color: pillar.color }}>{formatCurrency(orcado)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )
      })}

      <ImpostosNFSection />

      <ConfirmDialog
        open={deletingId !== null}
        title="Excluir item do plano de contas"
        message="O item será removido do plano de contas. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={() => { if (deletingId) removeCostAccount(deletingId); setDeletingId(null) }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}

function ResumoCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-widest text-[#6b6b6b] mb-1">{label}</p>
      <p className="text-lg font-bold font-mono" style={{ color: tone }}>{value}</p>
      <p className="text-[10px] text-[#a3a3a3] mt-0.5">{sub}</p>
    </div>
  )
}

/* ── Impostos Notas Fiscais — tabela pré-configurada e 100% editável ──── */

const IMPOSTOS_COLOR = '#fbbf24'

function ImpostosNFSection() {
  const { impostosNF, seedImpostosNF, addImpostoNF, updateImpostoNF, removeImpostoNF } = useEvmStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Omit<ImpostoNF, 'id' | 'createdAt'>>({ nome: '', aliquota: '', observacao: '' })
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState<Omit<ImpostoNF, 'id' | 'createdAt'>>({ nome: '', aliquota: '', observacao: '' })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => { seedImpostosNF() }, [seedImpostosNF])

  function startEdit(imp: ImpostoNF) {
    setEditingId(imp.id)
    setEditForm({ nome: imp.nome, aliquota: imp.aliquota, observacao: imp.observacao })
  }
  function confirmEdit() {
    if (!editingId || !editForm.nome.trim()) return
    updateImpostoNF(editingId, { ...editForm })
    setEditingId(null)
  }
  function confirmAdd() {
    if (!addForm.nome.trim()) return
    addImpostoNF({ ...addForm })
    setAdding(false)
    setAddForm({ nome: '', aliquota: '', observacao: '' })
  }

  const deleting = impostosNF.find((i) => i.id === deletingId)
  const cellInput = 'w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]'

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#525252]" style={{ borderLeftWidth: 4, borderLeftColor: IMPOSTOS_COLOR }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${IMPOSTOS_COLOR}20` }}>
            <Receipt size={15} style={{ color: IMPOSTOS_COLOR }} />
          </div>
          <span className="text-[#f5f5f5] text-sm font-semibold">Impostos Notas Fiscais</span>
          <span className="text-[#6b6b6b] text-xs">({impostosNF.length} itens)</span>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors">
          <Plus size={13} /> Adicionar
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#525252]/50">
            <th className="text-left text-[#a3a3a3] text-xs font-medium px-4 py-2 w-44">Imposto / Retenção</th>
            <th className="text-left text-[#a3a3a3] text-xs font-medium px-4 py-2 w-28">Alíquota</th>
            <th className="text-left text-[#a3a3a3] text-xs font-medium px-4 py-2">Observação</th>
            <th className="text-center text-[#a3a3a3] text-xs font-medium px-4 py-2 w-20" />
          </tr>
        </thead>
        <tbody>
          {adding && (
            <tr className="border-b border-[#525252]/30 bg-[#2c2c2c]/60">
              <td className="px-4 py-2.5"><input value={addForm.nome} onChange={(e) => setAddForm({ ...addForm, nome: e.target.value })} placeholder="Nome" className={cellInput} autoFocus /></td>
              <td className="px-4 py-2.5"><input value={addForm.aliquota} onChange={(e) => setAddForm({ ...addForm, aliquota: e.target.value })} placeholder="Ex.: 1,00%" className={`${cellInput} font-mono`} /></td>
              <td className="px-4 py-2.5"><input value={addForm.observacao} onChange={(e) => setAddForm({ ...addForm, observacao: e.target.value })} placeholder="Observação" className={cellInput} /></td>
              <td className="px-4 py-2.5 text-center">
                <div className="flex items-center justify-center gap-2">
                  <button onClick={confirmAdd} className="text-[#22c55e] hover:text-[#16a34a] transition-colors" aria-label="Confirmar adição"><Check size={14} /></button>
                  <button onClick={() => setAdding(false)} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors" aria-label="Cancelar adição"><X size={14} /></button>
                </div>
              </td>
            </tr>
          )}
          {impostosNF.length === 0 && !adding && (
            <tr><td colSpan={4} className="px-4 py-4 text-center text-[#6b6b6b] text-xs">Nenhum imposto cadastrado.</td></tr>
          )}
          {impostosNF.map((imp) => {
            const isEditing = editingId === imp.id
            return (
              <tr key={imp.id} className="border-b border-[#525252]/30 hover:bg-[#484848]/30 transition-colors align-top">
                <td className="px-4 py-2.5">
                  {isEditing ? (
                    <input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} className={cellInput} />
                  ) : <span className="text-[#f5f5f5] text-sm font-medium">{imp.nome}</span>}
                </td>
                <td className="px-4 py-2.5">
                  {isEditing ? (
                    <input value={editForm.aliquota} onChange={(e) => setEditForm({ ...editForm, aliquota: e.target.value })} className={`${cellInput} font-mono`} />
                  ) : <span className="font-mono text-sm" style={{ color: IMPOSTOS_COLOR }}>{imp.aliquota}</span>}
                </td>
                <td className="px-4 py-2.5">
                  {isEditing ? (
                    <input value={editForm.observacao} onChange={(e) => setEditForm({ ...editForm, observacao: e.target.value })} className={cellInput} />
                  ) : <span className="text-[#a3a3a3] text-sm leading-relaxed">{imp.observacao}</span>}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {isEditing ? (
                      <>
                        <button onClick={confirmEdit} className="text-[#22c55e] hover:text-[#16a34a] transition-colors" aria-label="Salvar edição"><Check size={14} /></button>
                        <button onClick={() => setEditingId(null)} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors" aria-label="Cancelar edição"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(imp)} className="text-[#6b6b6b] hover:text-[#f97316] transition-colors" aria-label="Editar imposto"><Pencil size={14} /></button>
                        <button onClick={() => setDeletingId(imp.id)} className="text-[#6b6b6b] hover:text-red-400 transition-colors" aria-label="Excluir imposto"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <ConfirmDialog
        open={deletingId !== null}
        title="Excluir imposto/retenção"
        message={`"${deleting?.nome ?? ''}" será removido da tabela de impostos de notas fiscais.`}
        confirmLabel="Excluir"
        onConfirm={() => { if (deletingId) removeImpostoNF(deletingId); setDeletingId(null) }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}

/**
 * De onde vem a receita orçada — obra por obra, com a origem de cada parcela.
 *
 * ⚠️ Existe porque o número aparecia sem explicação e parecia dado de demonstração. Ele é real, mas
 * a fonte é uma cascata: **contrato → linha 'Total' do orçamento → soma das linhas → o campo
 * "Orçamento" do cadastro da obra**. O último é fácil de preencher sem perceber e sem contrato
 * nenhum — e é justamente o caso que dá "receita orçada alta com receita real zero".
 */
function OrigemDoOrcado({ sites, obraFilter }: { sites: ConstructionSite[]; obraFilter: string }) {
  const [aberto, setAberto] = useState(false)

  const linhas = useMemo(() => (obraFilter ? sites.filter((s) => s.id === obraFilter) : sites)
    .map((s) => ({ nome: s.name, valor: obraBacFromSite(s), origem: origemDoBac(s) }))
    .filter((l: { valor: number }) => l.valor > 0)
    .sort((a, b) => b.valor - a.valor),
  [sites, obraFilter])

  if (linhas.length === 0) return null

  return (
    <div>
      <button
        type="button" onClick={() => setAberto((v) => !v)}
        className="text-[11px] text-[#f97316] hover:underline"
      >
        {aberto ? 'Esconder' : `De onde vêm os ${formatCurrency(linhas.reduce((s, l) => s + l.valor, 0))} orçados?`}
      </button>
      {aberto && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-[#525252]">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]">
                <th className="px-3 py-1.5 text-left">Obra</th>
                <th className="px-3 py-1.5 text-right">Valor</th>
                <th className="px-3 py-1.5 text-left">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {linhas.map((l) => (
                <tr key={l.nome}>
                  <td className="px-3 py-1.5 text-[#f5f5f5]">{l.nome}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-[#f5f5f5]">{formatCurrency(l.valor)}</td>
                  <td className={`px-3 py-1.5 ${l.origem === 'cadastro' ? 'text-amber-300' : 'text-[#6b6b6b]'}`}>
                    {ROTULO_ORIGEM[l.origem]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const ROTULO_ORIGEM: Record<string, string> = {
  contrato: 'Contrato da obra',
  total: 'Linha “Total” do orçamento',
  linhas: 'Soma das linhas do orçamento',
  cadastro: 'Campo “Orçamento” do cadastro — sem contrato',
}

/**
 * A mesma cascata de `obraBacFromSite`, só que dizendo QUAL degrau respondeu.
 *
 * Reaproveita `ehLinhaTotal` de `obraBudget.ts` em vez de duplicar o regex — uma cópia solta
 * aqui já tinha ficado dessincronizada da exclusão de linha derivada (Saldo/Resultado) que o
 * `obraBacFromSite` ganhou.
 */
function origemDoBac(site: ConstructionSite): keyof typeof ROTULO_ORIGEM {
  if (valoresDoContrato(site.contrato).total > 0) return 'contrato'
  const lines = site.budgetLines ?? []
  if (lines.length) return lines.some((l) => ehLinhaTotal(l.label)) ? 'total' : 'linhas'
  return 'cadastro'
}
