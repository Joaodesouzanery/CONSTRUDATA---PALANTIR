import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileSpreadsheet, Link2, Plus, Trash2, Upload } from 'lucide-react'
import { useMedicaoAssistidaStore, type MedicaoAssistidaItem, type MedicaoAssistidaParceiro } from '@/store/medicaoAssistidaStore'
import { getItensBaseCalculoFromBoletim, useMedicaoBillingStore } from '@/store/medicaoBillingStore'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { useLpsStore } from '@/store/lpsStore'
import { useRdoStore } from '@/store/rdoStore'
import { cn } from '@/lib/utils'

type AssistidaTab = 'fluxo' | 'itens' | 'criterios' | 'execucao' | 'parceiros' | 'conferencia' | 'final'

interface Divergencia {
  key: string
  tipo: string
  item: string
  detalhe: string
  criticidade: 'alta' | 'media' | 'baixa'
}

const tabs: { key: AssistidaTab; label: string }[] = [
  { key: 'fluxo', label: 'Fluxo Ideal' },
  { key: 'itens', label: 'Base de Itens' },
  { key: 'criterios', label: 'Critérios' },
  { key: 'execucao', label: 'Execução Medível' },
  { key: 'parceiros', label: 'Subempreiteiros e Fornecedores' },
  { key: 'conferencia', label: 'Conferência' },
  { key: 'final', label: 'Medição Final' },
]

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
const decimal = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const firstValue = (row: Record<string, unknown>, keys: string[]) => {
  const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value]))
  for (const key of keys) {
    const value = normalized[key.toLowerCase()]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return ''
}

function SmallInput({ value, onChange, type = 'text', className }: { value: string | number; onChange: (value: string) => void; type?: string; className?: string }) {
  return (
    <input
      value={value}
      type={type}
      onChange={(event) => onChange(event.target.value)}
      className={cn('h-8 w-full min-w-[96px] rounded border border-[#525252] bg-[#1f1f1f] px-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]', className)}
    />
  )
}

function Kpi({ label, value, tone = 'text-[#f5f5f5]' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-3">
      <p className="text-xs text-[#a3a3a3]">{label}</p>
      <p className={cn('mt-2 text-xl font-bold tabular-nums', tone)}>{value}</p>
    </div>
  )
}

function Select<T extends string>({ value, options, onChange, labels }: { value: T; options: T[]; onChange: (value: T) => void; labels?: Record<string, string> }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as T)} className="h-8 w-full rounded border border-[#525252] bg-[#1f1f1f] px-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]">
      {options.map((option) => <option key={option} value={option}>{labels?.[option] ?? option}</option>)}
    </select>
  )
}

function buildDivergencias(
  itens: MedicaoAssistidaItem[],
  parceiros: MedicaoAssistidaParceiro[],
  criteriosObrigatorios: Set<string>,
): Divergencia[] {
  const divergencias: Divergencia[] = []
  for (const item of itens) {
    const saldo = item.qtdContrato - item.qtdAnterior - item.qtdPeriodo
    if (saldo < 0) {
      divergencias.push({ key: `saldo-${item.id}`, tipo: 'Saldo contratual', item: item.codigo, detalhe: `Quantidade do período supera o saldo em ${decimal(Math.abs(saldo))} ${item.unidade}.`, criticidade: 'alta' })
    }
    if (!item.criterioId) {
      divergencias.push({ key: `criterio-${item.id}`, tipo: 'Critério ausente', item: item.codigo, detalhe: 'Item sem critério de medição vinculado.', criticidade: 'media' })
    }
    if (criteriosObrigatorios.has(item.criterioId) && !item.evidencia.trim()) {
      divergencias.push({ key: `evidencia-${item.id}`, tipo: 'Evidência obrigatória', item: item.codigo, detalhe: 'Critério exige evidência e o item ainda não possui referência.', criticidade: 'media' })
    }
    const valorItem = item.qtdPeriodo * item.precoUnitario
    const valorParceiros = parceiros
      .filter((parceiro) => parceiro.itemCodigo === item.codigo)
      .reduce((total, parceiro) => total + parceiro.valorAprovado, 0)
    if (valorParceiros > valorItem && valorItem > 0) {
      divergencias.push({ key: `parceiro-${item.id}`, tipo: 'Parceiro acima da medição', item: item.codigo, detalhe: `Parceiros aprovados somam ${brl(valorParceiros)} contra ${brl(valorItem)} medido no item.`, criticidade: 'alta' })
    }
  }
  return divergencias
}

export function MedicaoAssistidaPanel() {
  const {
    medicoes,
    activeMedicaoId,
    criterios,
    itens,
    parceiros,
    divergenciasResolvidas,
    createMedicao,
    setActiveMedicao,
    updateMedicao,
    removeMedicao,
    addCriterio,
    updateCriterio,
    removeCriterio,
    addItem,
    updateItem,
    removeItem,
    addParceiro,
    updateParceiro,
    removeParceiro,
    resolveDivergencia,
    reopenDivergencia,
  } = useMedicaoAssistidaStore()
  const boletins = useMedicaoBillingStore((state) => state.boletins)
  const activeBoletimId = useMedicaoBillingStore((state) => state.activeBoletimId)
  const estoqueItens = useSuprimentosStore((state) => state.estoqueItens)
  const purchaseOrders = useSuprimentosStore((state) => state.purchaseOrders)
  const masterActivities = usePlanejamentoMestreStore((state) => state.activities)
  const lpsRestrictions = useLpsStore((state) => state.restrictions)
  const rdos = useRdoStore((state) => state.rdos)
  const [tab, setTab] = useState<AssistidaTab>('fluxo')
  const itemImportRef = useRef<HTMLInputElement>(null)
  const criterioImportRef = useRef<HTMLInputElement>(null)
  const parceiroImportRef = useRef<HTMLInputElement>(null)

  const activeBoletim = boletins.find((boletim) => boletim.id === activeBoletimId)
  const medicao = medicoes.find((item) => item.id === activeMedicaoId) ?? medicoes[0] ?? null
  const medicaoItens = useMemo(() => medicao ? itens.filter((item) => item.medicaoId === medicao.id) : [], [itens, medicao])
  const medicaoParceiros = useMemo(() => medicao ? parceiros.filter((parceiro) => parceiro.medicaoId === medicao.id) : [], [parceiros, medicao])
  const criteriosObrigatorios = useMemo(() => new Set(criterios.filter((criterio) => criterio.evidenciaObrigatoria.trim()).map((criterio) => criterio.id)), [criterios])
  const divergencias = useMemo(() => buildDivergencias(medicaoItens, medicaoParceiros, criteriosObrigatorios), [medicaoItens, medicaoParceiros, criteriosObrigatorios])
  const resolvedKeys = new Set(divergenciasResolvidas.filter((item) => item.medicaoId === medicao?.id).map((item) => item.divergenciaKey))
  const divergenciasAbertas = divergencias.filter((item) => !resolvedKeys.has(item.key))
  const totalPeriodo = medicaoItens.reduce((total, item) => total + item.qtdPeriodo * item.precoUnitario, 0)
  const totalAcumulado = medicaoItens.reduce((total, item) => total + (item.qtdAnterior + item.qtdPeriodo) * item.precoUnitario, 0)
  const totalParceiros = medicaoParceiros.reduce((total, parceiro) => total + parceiro.valorAprovado, 0)
  const saldoContrato = medicaoItens.reduce((total, item) => total + Math.max(0, item.qtdContrato - item.qtdAnterior - item.qtdPeriodo) * item.precoUnitario, 0)

  function createDefaultMedicao() {
    const sequence = medicoes.length + 1
    const id = createMedicao({
      nome: `Medição Assistida ${sequence}`,
      periodo: activeBoletim?.periodo ?? 'mai/26',
      contrato: activeBoletim?.contrato ?? '11481051',
      obra: activeBoletim?.consorcio ?? 'SE LIGA NA REDE - SANTOS',
      responsavel: 'Gestor de Medição',
      origem: activeBoletim ? 'Boletim Sabesp existente' : 'Criada do zero no sistema',
    })
    setActiveMedicao(id)
    setTab('final')
  }

  async function readSheetRows(file: File) {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  }

  async function importItens(file: File | null) {
    if (!file || !medicao) return
    const rows = await readSheetRows(file)
    rows.forEach((row, index) => {
      addItem({
        medicaoId: medicao.id,
        codigo: String(firstValue(row, ['codigo', 'código', 'npreco', 'n preço', 'nPreço']) || `ITEM-${String(medicaoItens.length + index + 1).padStart(3, '0')}`),
        descricao: String(firstValue(row, ['descricao', 'descrição', 'item', 'atividade']) || 'Item importado'),
        unidade: String(firstValue(row, ['unidade', 'un']) || 'un'),
        qtdContrato: num(firstValue(row, ['qtd contrato', 'quantidade contrato', 'contrato'])),
        qtdAnterior: num(firstValue(row, ['qtd anterior', 'anterior', 'acumulado anterior'])),
        qtdPeriodo: num(firstValue(row, ['qtd periodo', 'qtd período', 'periodo', 'período', 'quantidade'])),
        precoUnitario: num(firstValue(row, ['preco unitario', 'preço unitário', 'pu', 'valor unitario', 'valor unitário'])),
        criterioId: criterios[0]?.id ?? '',
        fornecedor: String(firstValue(row, ['fornecedor'])),
        subempreiteiro: String(firstValue(row, ['subempreiteiro'])),
        evidencia: String(firstValue(row, ['evidencia', 'evidência'])),
        origem: `Importado de ${file.name}`,
      })
    })
  }

  async function importCriterios(file: File | null) {
    if (!file) return
    const rows = await readSheetRows(file)
    rows.forEach((row) => {
      addCriterio({
        nome: String(firstValue(row, ['nome', 'criterio', 'critério']) || 'Critério importado'),
        regra: String(firstValue(row, ['regra', 'descricao', 'descrição']) || 'Regra importada.'),
        unidade: String(firstValue(row, ['unidade', 'un']) || 'un'),
        evidenciaObrigatoria: String(firstValue(row, ['evidencia', 'evidência', 'evidencia obrigatoria', 'evidência obrigatória'])),
        condicaoAceite: String(firstValue(row, ['condicao aceite', 'condição aceite', 'aceite', 'condicao'])),
      })
    })
  }

  async function importParceiros(file: File | null) {
    if (!file || !medicao) return
    const rows = await readSheetRows(file)
    rows.forEach((row) => {
      const tipoRaw = String(firstValue(row, ['tipo', 'categoria'])).toLowerCase()
      addParceiro({
        medicaoId: medicao.id,
        tipo: tipoRaw.includes('forn') ? 'fornecedor' : 'subempreiteiro',
        nome: String(firstValue(row, ['nome', 'parceiro', 'fornecedor', 'subempreiteiro']) || 'Parceiro importado'),
        itemCodigo: String(firstValue(row, ['item', 'codigo item', 'código item', 'codigo', 'código'])),
        valorMedido: num(firstValue(row, ['valor medido', 'medido'])),
        valorAprovado: num(firstValue(row, ['valor aprovado', 'aprovado', 'valor'])),
        retencao: num(firstValue(row, ['retencao', 'retenção'])),
        nf: String(firstValue(row, ['nf', 'nota fiscal'])),
        status: 'pendente',
      })
    })
  }

  function addManualItem() {
    if (!medicao) return
    addItem({
      medicaoId: medicao.id,
      codigo: `ITEM-${String(medicaoItens.length + 1).padStart(3, '0')}`,
      descricao: 'Novo item medível',
      unidade: 'm',
      qtdContrato: 100,
      qtdAnterior: 0,
      qtdPeriodo: 0,
      precoUnitario: 0,
      criterioId: criterios[0]?.id ?? '',
      fornecedor: '',
      subempreiteiro: '',
      evidencia: '',
      origem: 'Manual',
    })
  }

  function mirrorSabespItems() {
    if (!medicao || !activeBoletim) return
    const existing = new Set(medicaoItens.map((item) => item.vinculoSabesp).filter(Boolean))
    getItensBaseCalculoFromBoletim(activeBoletim).slice(0, 25).forEach((item) => {
      if (existing.has(item.id)) return
      addItem({
        medicaoId: medicao.id,
        codigo: item.nPreco || item.itemEAP,
        descricao: item.descricao,
        unidade: item.unidade,
        qtdContrato: item.qtdContrato,
        qtdAnterior: item.qtdAnterior,
        qtdPeriodo: item.qtdMedida,
        precoUnitario: item.valorUnitario,
        criterioId: criterios[0]?.id ?? '',
        fornecedor: '',
        subempreiteiro: '',
        evidencia: '',
        origem: 'Espelhado da Medição Sabesp',
        vinculoSabesp: item.id,
      })
    })
  }

  function addDefaultParceiro(tipo: MedicaoAssistidaParceiro['tipo']) {
    if (!medicao) return
    const item = medicaoItens[0]
    addParceiro({
      medicaoId: medicao.id,
      tipo,
      nome: tipo === 'fornecedor' ? purchaseOrders[0]?.supplier ?? 'Novo fornecedor' : 'Novo subempreiteiro',
      itemCodigo: item?.codigo ?? '',
      valorMedido: item ? item.qtdPeriodo * item.precoUnitario : 0,
      valorAprovado: item ? item.qtdPeriodo * item.precoUnitario : 0,
      retencao: 0,
      nf: '',
      status: 'pendente',
    })
  }

  return (
    <div className="flex flex-col gap-4 p-5 text-[#f5f5f5]">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck size={18} className="text-[#f97316]" />
            <h2 className="text-base font-bold">Medição Assistida</h2>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#a3a3a3]">
            Fluxo completo para substituir planilhas: base de itens, critérios, execução medível, parceiros, conferência e medição final, lendo dados dos módulos existentes sem alterar o fluxo Sabesp atual.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {medicoes.length > 0 && (
            <select value={medicao?.id ?? ''} onChange={(event) => setActiveMedicao(event.target.value)} className="h-9 rounded border border-[#525252] bg-[#1f1f1f] px-2 text-xs text-[#f5f5f5]">
              {medicoes.map((item) => <option key={item.id} value={item.id}>{item.nome || `${item.periodo} - ${item.contrato}`}</option>)}
            </select>
          )}
          <button onClick={createDefaultMedicao} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white hover:bg-[#ea580c]">
            <Plus size={14} /> Nova Medição Assistida
          </button>
        </div>
      </div>

      {medicao ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi label="Valor do período" value={brl(totalPeriodo)} tone="text-[#4ade80]" />
            <Kpi label="Valor acumulado" value={brl(totalAcumulado)} />
            <Kpi label="Saldo contratual" value={brl(saldoContrato)} tone="text-[#38bdf8]" />
            <Kpi label="Parceiros aprovados" value={brl(totalParceiros)} tone="text-[#fbbf24]" />
            <Kpi label="Divergências abertas" value={divergenciasAbertas.length} tone={divergenciasAbertas.length > 0 ? 'text-[#f87171]' : 'text-[#4ade80]'} />
          </div>

          <div className="grid gap-3 rounded-lg border border-[#525252] bg-[#2c2c2c] p-4 md:grid-cols-5">
            <SmallInput value={medicao.nome || ''} onChange={(value) => updateMedicao(medicao.id, { nome: value })} />
            <SmallInput value={medicao.periodo} onChange={(value) => updateMedicao(medicao.id, { periodo: value })} />
            <SmallInput value={medicao.contrato} onChange={(value) => updateMedicao(medicao.id, { contrato: value })} />
            <SmallInput value={medicao.obra} onChange={(value) => updateMedicao(medicao.id, { obra: value })} />
            <SmallInput value={medicao.responsavel} onChange={(value) => updateMedicao(medicao.id, { responsavel: value })} />
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg border border-[#525252] bg-[#2c2c2c] p-1">
            {tabs.map((item) => (
              <button key={item.key} onClick={() => setTab(item.key)} className={cn('rounded px-3 py-1.5 text-xs font-medium transition-colors', tab === item.key ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:bg-[#3d3d3d] hover:text-white')}>
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'fluxo' && (
            <div className="grid gap-3 lg:grid-cols-4">
              {[
                ['1. Criar', 'Defina período, contrato, obra, responsável e origem da medição.'],
                ['2. Base de Itens', 'Adicione itens manualmente ou espelhe a Planilha Sabesp existente.'],
                ['3. Critérios', 'Vincule regras de aceite, evidências obrigatórias e unidades.'],
                ['4. Execução', 'Compare com RDO, planejamento, LPS, estoque e fornecedores.'],
                ['5. Parceiros', 'Registre subempreiteiros, fornecedores, retenções, NF e glosas.'],
                ['6. Conferência', 'Resolva divergências antes de finalizar.'],
                ['7. Final', 'Gere totais do período, acumulado, saldo e pendências.'],
                ['Integrações', `${rdos.length} RDOs, ${masterActivities.length} atividades, ${lpsRestrictions.length} restrições LPS, ${estoqueItens.length} itens de estoque.`],
              ].map(([title, text]) => (
                <div key={title} className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
                  <p className="text-sm font-bold text-[#f97316]">{title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-[#d4d4d4]">{text}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'itens' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={addManualItem} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white"><Plus size={14} /> Item manual</button>
                <button onClick={mirrorSabespItems} disabled={!activeBoletim} className="inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2 text-xs font-semibold text-[#f5f5f5] disabled:opacity-40"><FileSpreadsheet size={14} /> Espelhar Sabesp</button>
                <button onClick={() => itemImportRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2 text-xs font-semibold text-[#f5f5f5]"><Upload size={14} /> Importar itens</button>
                <input ref={itemImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { void importItens(event.target.files?.[0] ?? null); event.target.value = '' }} />
              </div>
              <div className="overflow-x-auto rounded-lg border border-[#525252]">
                <table className="w-full min-w-[1180px] text-xs">
                  <thead className="bg-[#2c2c2c] text-[#a3a3a3]">
                    <tr>{['Código', 'Descrição', 'Un.', 'Contrato', 'Anterior', 'Período', 'PU', 'Critério', 'Evidência', 'Origem', ''].map((head) => <th key={head} className="px-3 py-2 text-left">{head}</th>)}</tr>
                  </thead>
                  <tbody>
                    {medicaoItens.map((item) => (
                      <tr key={item.id} className="border-t border-[#525252]">
                        <td className="px-3 py-2"><SmallInput value={item.codigo} onChange={(value) => updateItem(item.id, { codigo: value })} /></td>
                        <td className="px-3 py-2"><SmallInput value={item.descricao} onChange={(value) => updateItem(item.id, { descricao: value })} className="min-w-[240px]" /></td>
                        <td className="px-3 py-2"><SmallInput value={item.unidade} onChange={(value) => updateItem(item.id, { unidade: value })} /></td>
                        <td className="px-3 py-2"><SmallInput type="number" value={item.qtdContrato} onChange={(value) => updateItem(item.id, { qtdContrato: num(value) })} /></td>
                        <td className="px-3 py-2"><SmallInput type="number" value={item.qtdAnterior} onChange={(value) => updateItem(item.id, { qtdAnterior: num(value) })} /></td>
                        <td className="px-3 py-2"><SmallInput type="number" value={item.qtdPeriodo} onChange={(value) => updateItem(item.id, { qtdPeriodo: num(value) })} /></td>
                        <td className="px-3 py-2"><SmallInput type="number" value={item.precoUnitario} onChange={(value) => updateItem(item.id, { precoUnitario: num(value) })} /></td>
                        <td className="px-3 py-2">
                          <select value={item.criterioId} onChange={(event) => updateItem(item.id, { criterioId: event.target.value })} className="h-8 min-w-[180px] rounded border border-[#525252] bg-[#1f1f1f] px-2 text-xs text-[#f5f5f5]">
                            <option value="">Sem critério</option>
                            {criterios.map((criterio) => <option key={criterio.id} value={criterio.id}>{criterio.nome}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2"><SmallInput value={item.evidencia} onChange={(value) => updateItem(item.id, { evidencia: value })} className="min-w-[180px]" /></td>
                        <td className="px-3 py-2 text-[#d4d4d4]">{item.origem}</td>
                        <td className="px-3 py-2"><button onClick={() => removeItem(item.id)} className="rounded p-1 text-[#f87171] hover:bg-[#dc2626]/10"><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'criterios' && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="flex flex-wrap gap-2 lg:col-span-2">
                <button onClick={() => criterioImportRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2 text-xs font-semibold text-[#f5f5f5]"><Upload size={14} /> Importar critérios</button>
                <input ref={criterioImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { void importCriterios(event.target.files?.[0] ?? null); event.target.value = '' }} />
              </div>
              {criterios.map((criterio) => (
                <div key={criterio.id} className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <SmallInput value={criterio.nome} onChange={(value) => updateCriterio(criterio.id, { nome: value })} className="font-semibold" />
                    <button onClick={() => removeCriterio(criterio.id)} className="rounded p-1 text-[#f87171] hover:bg-[#dc2626]/10"><Trash2 size={14} /></button>
                  </div>
                  <textarea value={criterio.regra} onChange={(event) => updateCriterio(criterio.id, { regra: event.target.value })} className="mt-3 min-h-[72px] w-full rounded border border-[#525252] bg-[#1f1f1f] p-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]" />
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <SmallInput value={criterio.unidade} onChange={(value) => updateCriterio(criterio.id, { unidade: value })} />
                    <SmallInput value={criterio.evidenciaObrigatoria} onChange={(value) => updateCriterio(criterio.id, { evidenciaObrigatoria: value })} className="sm:col-span-2" />
                    <SmallInput value={criterio.condicaoAceite} onChange={(value) => updateCriterio(criterio.id, { condicaoAceite: value })} className="sm:col-span-3" />
                  </div>
                </div>
              ))}
              <button onClick={() => addCriterio({ nome: 'Novo critério', regra: 'Descreva a regra de medição.', unidade: 'un', evidenciaObrigatoria: '', condicaoAceite: '' })} className="rounded-lg border border-dashed border-[#525252] p-4 text-xs font-semibold text-[#f97316] hover:bg-[#f97316]/10">
                + Novo critério
              </button>
            </div>
          )}

          {tab === 'execucao' && (
            <div className="grid gap-3 lg:grid-cols-4">
              <Kpi label="RDOs disponíveis" value={rdos.length} />
              <Kpi label="Serviços executados em RDO" value={rdos.reduce((total, rdo) => total + rdo.services.length, 0)} />
              <Kpi label="Atividades de planejamento" value={masterActivities.length} />
              <Kpi label="Restrições LPS abertas" value={lpsRestrictions.filter((restriction) => restriction.status !== 'resolvida').length} tone="text-[#f87171]" />
              <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4 lg:col-span-4">
                <p className="text-sm font-bold">Sugestões de execução medível</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {rdos.slice(0, 6).map((rdo) => (
                    <div key={rdo.id} className="rounded border border-[#525252] bg-[#1f1f1f] p-3 text-xs">
                      <p className="font-semibold text-[#f5f5f5]">RDO #{rdo.number} - {rdo.date}</p>
                      <p className="mt-1 text-[#a3a3a3]">{rdo.services.length} serviços e {rdo.trechos.length} trechos podem alimentar quantidades medidas.</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'parceiros' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => addDefaultParceiro('subempreiteiro')} className="rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white">+ Subempreiteiro</button>
                <button onClick={() => addDefaultParceiro('fornecedor')} className="rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2 text-xs font-semibold text-[#f5f5f5]">+ Fornecedor</button>
                <button onClick={() => parceiroImportRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2 text-xs font-semibold text-[#f5f5f5]"><Upload size={14} /> Importar parceiros</button>
                <input ref={parceiroImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { void importParceiros(event.target.files?.[0] ?? null); event.target.value = '' }} />
              </div>
              <div className="overflow-x-auto rounded-lg border border-[#525252]">
                <table className="w-full min-w-[980px] text-xs">
                  <thead className="bg-[#2c2c2c] text-[#a3a3a3]">
                    <tr>{['Tipo', 'Nome', 'Item', 'Medido', 'Aprovado', 'Retenção', 'NF', 'Status', ''].map((head) => <th key={head} className="px-3 py-2 text-left">{head}</th>)}</tr>
                  </thead>
                  <tbody>
                    {medicaoParceiros.map((parceiro) => (
                      <tr key={parceiro.id} className="border-t border-[#525252]">
                        <td className="px-3 py-2"><Select value={parceiro.tipo} options={['subempreiteiro', 'fornecedor']} labels={{ subempreiteiro: 'Subempreiteiro', fornecedor: 'Fornecedor' }} onChange={(value) => updateParceiro(parceiro.id, { tipo: value })} /></td>
                        <td className="px-3 py-2"><SmallInput value={parceiro.nome} onChange={(value) => updateParceiro(parceiro.id, { nome: value })} className="min-w-[180px]" /></td>
                        <td className="px-3 py-2"><SmallInput value={parceiro.itemCodigo} onChange={(value) => updateParceiro(parceiro.id, { itemCodigo: value })} /></td>
                        <td className="px-3 py-2"><SmallInput type="number" value={parceiro.valorMedido} onChange={(value) => updateParceiro(parceiro.id, { valorMedido: num(value) })} /></td>
                        <td className="px-3 py-2"><SmallInput type="number" value={parceiro.valorAprovado} onChange={(value) => updateParceiro(parceiro.id, { valorAprovado: num(value) })} /></td>
                        <td className="px-3 py-2"><SmallInput type="number" value={parceiro.retencao} onChange={(value) => updateParceiro(parceiro.id, { retencao: num(value) })} /></td>
                        <td className="px-3 py-2"><SmallInput value={parceiro.nf} onChange={(value) => updateParceiro(parceiro.id, { nf: value })} /></td>
                        <td className="px-3 py-2"><Select value={parceiro.status} options={['pendente', 'aprovado', 'glosado']} labels={{ pendente: 'Pendente', aprovado: 'Aprovado', glosado: 'Glosado' }} onChange={(value) => updateParceiro(parceiro.id, { status: value })} /></td>
                        <td className="px-3 py-2"><button onClick={() => removeParceiro(parceiro.id)} className="rounded p-1 text-[#f87171] hover:bg-[#dc2626]/10"><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'conferencia' && (
            <div className="flex flex-col gap-3">
              {divergencias.length === 0 && <div className="rounded-lg border border-[#16a34a]/30 bg-[#16a34a]/10 p-4 text-sm text-[#4ade80]">Nenhuma divergência encontrada.</div>}
              {divergencias.map((divergencia) => {
                const resolved = resolvedKeys.has(divergencia.key)
                return (
                  <div key={divergencia.key} className={cn('rounded-lg border p-4', resolved ? 'border-[#16a34a]/30 bg-[#16a34a]/10' : 'border-[#dc2626]/30 bg-[#dc2626]/10')}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{divergencia.tipo} - {divergencia.item}</p>
                        <p className="mt-1 text-xs text-[#d4d4d4]">{divergencia.detalhe}</p>
                      </div>
                      <button onClick={() => resolved ? reopenDivergencia(medicao.id, divergencia.key) : resolveDivergencia(medicao.id, divergencia.key)} className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold', resolved ? 'bg-[#3d3d3d] text-[#f5f5f5]' : 'bg-[#f97316] text-white')}>
                        {resolved ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                        {resolved ? 'Reabrir' : 'Resolver'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'final' && (
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
                <h3 className="text-sm font-bold">Medição final assistida</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Kpi label="Total do período" value={brl(totalPeriodo)} tone="text-[#4ade80]" />
                  <Kpi label="Total acumulado" value={brl(totalAcumulado)} />
                  <Kpi label="Saldo contratual" value={brl(saldoContrato)} tone="text-[#38bdf8]" />
                  <Kpi label="Glosas/Pendências" value={divergenciasAbertas.length} tone={divergenciasAbertas.length ? 'text-[#f87171]' : 'text-[#4ade80]'} />
                </div>
                <button disabled={divergenciasAbertas.length > 0} onClick={() => updateMedicao(medicao.id, { status: 'finalizada' })} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">
                  <CheckCircle2 size={14} /> Finalizar medição assistida
                </button>
              </div>
              <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
                <h3 className="text-sm font-bold">Dados da medição</h3>
                <div className="mt-3 space-y-2">
                  <SmallInput value={medicao.periodo} onChange={(value) => updateMedicao(medicao.id, { periodo: value })} />
                  <SmallInput value={medicao.contrato} onChange={(value) => updateMedicao(medicao.id, { contrato: value })} />
                  <SmallInput value={medicao.obra} onChange={(value) => updateMedicao(medicao.id, { obra: value })} />
                  <SmallInput value={medicao.responsavel} onChange={(value) => updateMedicao(medicao.id, { responsavel: value })} />
                </div>
                <button onClick={() => removeMedicao(medicao.id)} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#dc2626]/40 px-3 py-2 text-xs font-semibold text-[#f87171]">
                  <Trash2 size={14} /> Remover medição
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-[#525252] bg-[#2c2c2c] p-8 text-center">
          <Link2 size={28} className="mx-auto text-[#f97316]" />
          <h3 className="mt-3 text-lg font-bold">Crie a primeira Medição Assistida</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[#a3a3a3]">Ela ficará separada do fluxo atual de Medição e poderá usar dados de Sabesp, RDO, Suprimentos, Planejamento e LPS como referência.</p>
          <button onClick={createDefaultMedicao} className="mt-4 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white">Criar agora</button>
        </div>
      )}
    </div>
  )
}
