import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  BadgeCheck,
  Calculator,
  Camera,
  ClipboardList,
  FileSpreadsheet,
  Plus,
  Save,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDecimalInput, parseLocaleNumber } from '@/lib/numberFormat'
import { useAuth } from '@/lib/auth'
import {
  useLevantamentoObraStore,
  type LevantamentoObra,
  type MaoObraFuncao,
  type MedidaLinha,
  type OrcamentoLinha,
} from '@/store/levantamentoObraStore'
import { parseLevantamentoExcel } from './utils/parseLevantamentoExcel'

type TabKey = 'medidas' | 'tecnico' | 'pessoal' | 'orcamento' | 'fotos' | 'resumo'

const tabs: { key: TabKey; label: string; icon: typeof Calculator }[] = [
  { key: 'medidas', label: 'Cálculo de Medidas', icon: Calculator },
  { key: 'tecnico', label: 'Levantamento Técnico', icon: ClipboardList },
  { key: 'pessoal', label: 'Custos com Pessoal', icon: Users },
  { key: 'orcamento', label: 'Orçamento', icon: FileSpreadsheet },
  { key: 'fotos', label: 'Registro Fotográfico', icon: Camera },
  { key: 'resumo', label: 'Resumo', icon: BadgeCheck },
]

const inputClass = 'w-full rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#6b6b6b] focus:border-[#f97316]/60'

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function numberBr(value: number, decimals = 2) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: decimals })
}

function calculateSummary(item: LevantamentoObra | null) {
  const medidas = item?.medidas ?? []
  const maoObra = item?.maoObra ?? []
  const orcamento = item?.orcamento ?? []
  const totalPiso = medidas.filter((line) => line.tipoServico === 'PISO').reduce((sum, line) => sum + line.m2Calculado, 0)
  const totalParede = medidas.filter((line) => line.tipoServico === 'PAREDE').reduce((sum, line) => sum + line.m2Calculado, 0)
  const totalTeto = medidas.filter((line) => line.tipoServico === 'TETO').reduce((sum, line) => sum + line.m2Calculado, 0)
  const totalVagas = medidas.filter((line) => line.tipoServico === 'DEMARCAÇÃO DE VAGAS').reduce((sum, line) => sum + line.metroLinear, 0)
  const totalEspeciais = medidas.filter((line) => line.tipoServico === 'DEMARCAÇÕES ESPECIAIS').reduce((sum, line) => sum + line.quantidade, 0)
  const custoMo = maoObra.reduce((sum, line) => sum + line.quantidadeObra * line.custoDiario * line.diasObra, 0)
  const faturamentoBase = orcamento.find((line) => line.codigo.toLowerCase().includes('nf serviço'))?.valor
  const faturamento = item?.resumoFinanceiro?.faturamentoTotal ?? faturamentoBase ?? orcamento.filter((line) => line.tipo === 'faturamento').reduce((sum, line) => sum + line.valor, 0)
  const impostos = item?.resumoFinanceiro?.totalImpostos ?? orcamento.filter((line) => line.tipo === 'faturamento').reduce((sum, line) => sum + line.impostos, 0)
  const despesas = item?.resumoFinanceiro?.totalDespesas ?? orcamento.filter((line) => line.tipo === 'despesa').reduce((sum, line) => sum + line.valor, 0)
  const saldo = item?.resumoFinanceiro?.saldoLiquido ?? faturamento - impostos - despesas
  return { totalPiso, totalParede, totalTeto, totalVagas, totalEspeciais, custoMo, faturamento, impostos, despesas, saldo }
}

function patchArray<T extends { id: string }>(items: T[], id: string, patch: Partial<T>) {
  return items.map((item) => item.id === id ? { ...item, ...patch } : item)
}

export function LevantamentoObraPage() {
  const profileOrgId = useAuth((state) => state.profile?.organization_id)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [tab, setTab] = useState<TabKey>('medidas')
  const [importing, setImporting] = useState(false)
  const {
    activeOrgId,
    levantamentos,
    activeId,
    addLevantamento,
    upsertLevantamento,
    updateLevantamento,
    deleteLevantamento,
    setActiveId,
    ensureTenantScope,
    pull,
    syncStatus,
    syncError,
  } = useLevantamentoObraStore(
    useShallow((s) => ({
      activeOrgId: s.activeOrgId,
      levantamentos: s.levantamentos,
      activeId: s.activeId,
      addLevantamento: s.addLevantamento,
      upsertLevantamento: s.upsertLevantamento,
      updateLevantamento: s.updateLevantamento,
      deleteLevantamento: s.deleteLevantamento,
      setActiveId: s.setActiveId,
      ensureTenantScope: s.ensureTenantScope,
      pull: s.pull,
      syncStatus: s.syncStatus,
      syncError: s.syncError,
    })),
  )

  useEffect(() => {
    if (!profileOrgId) return
    ensureTenantScope(profileOrgId)
    void pull()
  }, [ensureTenantScope, profileOrgId, pull])

  const tenantReady = Boolean(profileOrgId && activeOrgId === profileOrgId)
  const active = tenantReady ? levantamentos.find((item) => item.id === activeId) ?? null : null
  const summary = useMemo(() => calculateSummary(active), [active])

  function updateActive(patch: Partial<LevantamentoObra>) {
    if (!active) return
    updateLevantamento(active.id, patch)
  }

  function updateMedida(id: string, patch: Partial<MedidaLinha>) {
    if (!active) return
    const current = active.medidas.find((line) => line.id === id)
    const nextPatch = { ...patch }
    if (current && ('comprimento' in patch || 'larguraAltura' in patch)) {
      const comprimento = patch.comprimento ?? current.comprimento
      const larguraAltura = patch.larguraAltura ?? current.larguraAltura
      nextPatch.m2Calculado = comprimento > 0 && larguraAltura > 0 ? comprimento * larguraAltura : current.m2Calculado
    }
    updateActive({ medidas: patchArray(active.medidas, id, nextPatch) })
  }

  function updateMaoObra(id: string, patch: Partial<MaoObraFuncao>) {
    if (!active) return
    updateActive({ maoObra: patchArray(active.maoObra, id, patch) })
  }

  function updateOrcamento(id: string, patch: Partial<OrcamentoLinha>) {
    if (!active) return
    const current = active.orcamento.find((line) => line.id === id)
    const next = { ...patch }
    if (current && ('valor' in patch || 'aliquota' in patch)) {
      const valor = patch.valor ?? current.valor
      const aliquota = patch.aliquota ?? current.aliquota
      next.impostos = valor * aliquota
    }
    updateActive({ orcamento: patchArray(active.orcamento, id, next), resumoFinanceiro: null })
  }

  function updateFoto(id: string, patch: Partial<LevantamentoObra['fotos'][number]>) {
    if (!active) return
    updateActive({ fotos: patchArray(active.fotos, id, patch) })
  }

  function addMaoObra() {
    if (!active) return
    updateActive({
      maoObra: [
        ...active.maoObra,
        {
          id: crypto.randomUUID(),
          funcao: 'Nova função',
          salarioBruto: 0,
          vt: 0,
          va: 0,
          horasExtrasQtd: 0,
          horasExtrasValor: 0,
          custoMensal: 0,
          dias: 30,
          obrasSimultaneas: 1,
          custoDiario: 0,
          quantidadeObra: 0,
          diasObra: 0,
        },
      ],
    })
  }

  function addOrcamentoLine(tipo: OrcamentoLinha['tipo']) {
    if (!active) return
    updateActive({
      resumoFinanceiro: null,
      orcamento: [
        ...active.orcamento,
        {
          id: crypto.randomUUID(),
          codigo: tipo === 'faturamento' ? 'NF' : 'CUSTO',
          descricao: '',
          valor: 0,
          aliquota: 0,
          impostos: 0,
          observacoes: '',
          tipo,
        },
      ],
    })
  }

  function addFotoLine() {
    if (!active) return
    updateActive({
      fotos: [
        ...active.fotos,
        {
          id: crypto.randomUUID(),
          pavimentoSuperficie: '',
          fotos: ['Visão Geral', 'Piso / Vagas', 'Parede', 'Teto', 'Patologias'].map((label) => ({ label })),
          estadoGeral: '',
          data: '',
          responsavelTecnico: '',
          observacoes: '',
        },
      ],
    })
  }

  async function handleImport(file?: File) {
    if (!file) return
    setImporting(true)
    try {
      const parsed = await parseLevantamentoExcel(file)
      upsertLevantamento(parsed)
      setTab('resumo')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (!tenantReady) {
    return <div className="flex h-full items-center justify-center text-sm text-[#a3a3a3]">Carregando empresa ativa...</div>
  }

  return (
    <div className="flex h-full min-h-0 bg-[#262626] text-[#f5f5f5]">
      <aside className="hidden w-80 shrink-0 border-r border-[#525252] bg-[#2c2c2c] p-4 lg:block">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Levantamento de Obra</h2>
            <p className="text-xs text-[#a3a3a3]">Planilha tecnica estruturada por empresa.</p>
          </div>
          <button onClick={() => addLevantamento()} className="rounded-lg bg-[#f97316] p-2 text-white" title="Novo levantamento">
            <Plus size={16} />
          </button>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#f97316]/40 bg-[#f97316]/10 px-3 py-2 text-xs font-semibold text-[#f97316] hover:bg-[#f97316]/15"
        >
          <Upload size={15} />
          {importing ? 'Importando...' : 'Importar Excel Compizzo'}
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void handleImport(event.target.files?.[0])} />
        <div className="space-y-2">
          {levantamentos.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveId(item.id)}
              className={cn('w-full rounded-lg border p-3 text-left transition', activeId === item.id ? 'border-[#f97316]/50 bg-[#f97316]/10' : 'border-[#525252] bg-[#333333] hover:bg-[#3d3d3d]')}
            >
              <p className="truncate text-sm font-bold">{item.obra || 'Levantamento sem obra'}</p>
              <p className="mt-1 truncate text-xs text-[#a3a3a3]">{item.contratante || 'Contratante nao informado'}</p>
              <span className="mt-2 inline-flex rounded-full border border-[#525252] px-2 py-0.5 text-[10px] uppercase text-[#f97316]">{item.status}</span>
            </button>
          ))}
          {levantamentos.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#525252] p-4 text-sm text-[#a3a3a3]">
              Importe a planilha modelo ou crie um levantamento novo.
            </div>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-[#525252] bg-[#2c2c2c] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f97316]">Projetos / Pré-orçamento</p>
              <h1 className="mt-1 text-2xl font-bold">{active?.obra || 'Levantamento de Obra'}</h1>
              <p className="mt-1 text-sm text-[#a3a3a3]">{syncStatus === 'error' ? syncError : `Sync: ${syncStatus}`}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => addLevantamento()} className="inline-flex items-center gap-2 rounded-lg border border-[#525252] px-3 py-2 text-sm font-semibold text-[#e5e5e5] hover:bg-[#333333]">
                <Plus size={15} /> Novo
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]">
                <Upload size={15} /> Importar
              </button>
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn('inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold', tab === key ? 'border-[#f97316]/50 bg-[#f97316]/10 text-[#f97316]' : 'border-[#525252] text-[#a3a3a3] hover:bg-[#333333] hover:text-white')}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </header>

        {!active ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[#a3a3a3]">
            <div>
              <FileSpreadsheet className="mx-auto mb-4 text-[#f97316]" size={42} />
              <p className="font-semibold text-[#f5f5f5]">Nenhum levantamento selecionado.</p>
              <p className="mt-2 text-sm">Crie um novo ou importe a planilha Compizzo para comecar.</p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {tab === 'medidas' && (
              <Section title="Entrada de medidas" action={<button onClick={() => updateActive({ medidas: [...active.medidas, { id: crypto.randomUUID(), item: active.medidas.length + 1, tipoServico: '', pavimentoLocal: '', comprimento: 0, larguraAltura: 0, m2Calculado: 0, metroLinear: 0, quantidade: 0, observacoes: '' }] })} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white"><Plus size={14} /> Linha</button>}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px] text-sm">
                    <thead className="text-left text-xs text-[#a3a3a3]">
                      <tr>{['Item', 'Tipo', 'Pavimento/Local', 'Compr.', 'Larg./Alt.', 'm2', 'ML', 'Qtd', 'Obs.', ''].map((h) => <th key={h} className="px-2 py-2">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-[#525252]/60">
                      {active.medidas.map((line) => (
                        <tr key={line.id}>
                          <td className="px-2 py-2">{line.item}</td>
                          <td className="px-2 py-2"><select value={line.tipoServico} onChange={(e) => updateMedida(line.id, { tipoServico: e.target.value as MedidaLinha['tipoServico'] })} className={inputClass}>{['', 'PISO', 'PAREDE', 'TETO', 'DEMARCAÇÃO DE VAGAS', 'DEMARCAÇÕES ESPECIAIS'].map((v) => <option key={v} value={v}>{v || 'Selecione'}</option>)}</select></td>
                          <td className="px-2 py-2"><TextInput value={line.pavimentoLocal} onChange={(value) => updateMedida(line.id, { pavimentoLocal: value })} /></td>
                          <td className="px-2 py-2"><NumInput value={line.comprimento} onChange={(value) => updateMedida(line.id, { comprimento: value })} /></td>
                          <td className="px-2 py-2"><NumInput value={line.larguraAltura} onChange={(value) => updateMedida(line.id, { larguraAltura: value })} /></td>
                          <td className="px-2 py-2"><NumInput value={line.m2Calculado} onChange={(value) => updateMedida(line.id, { m2Calculado: value })} /></td>
                          <td className="px-2 py-2"><NumInput value={line.metroLinear} onChange={(value) => updateMedida(line.id, { metroLinear: value })} /></td>
                          <td className="px-2 py-2"><NumInput value={line.quantidade} onChange={(value) => updateMedida(line.id, { quantidade: value })} /></td>
                          <td className="px-2 py-2"><TextInput value={line.observacoes} onChange={(value) => updateMedida(line.id, { observacoes: value })} /></td>
                          <td className="px-2 py-2"><button onClick={() => updateActive({ medidas: active.medidas.filter((item) => item.id !== line.id) })} className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#dc2626]/20 hover:text-[#f87171]"><Trash2 size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {tab === 'tecnico' && (
              <Section title="Identificação da obra">
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ['obra', 'Obra / Empreendimento'],
                    ['contratante', 'Contratante'],
                    ['responsavel', 'Responsável'],
                    ['dataLevantamento', 'Data do levantamento'],
                    ['cidadeUf', 'Cidade / UF'],
                    ['tecnicoResponsavel', 'Técnico responsável'],
                    ['numeroOrcamento', 'Nº do orçamento'],
                    ['tipoServico', 'Tipo de serviço'],
                    ['sistemaAplicado', 'Sistema aplicado'],
                    ['produtoPrincipal', 'Produto principal'],
                    ['endereco', 'Endereço'],
                  ].map(([key, label]) => (
                    <label key={key} className={key === 'endereco' ? 'md:col-span-2' : ''}>
                      <span className="mb-1 block text-xs font-semibold text-[#a3a3a3]">{label}</span>
                      <input value={String(active[key as keyof LevantamentoObra] ?? '')} onChange={(e) => updateActive({ [key]: e.target.value } as Partial<LevantamentoObra>)} className={inputClass} />
                    </label>
                  ))}
                  <label>
                    <span className="mb-1 block text-xs font-semibold text-[#a3a3a3]">Prazo estimado (dias)</span>
                    <input value={active.prazoEstimadoDias || ''} onChange={(e) => updateActive({ prazoEstimadoDias: parseLocaleNumber(e.target.value) })} className={inputClass} />
                  </label>
                </div>
              </Section>
            )}

            {tab === 'pessoal' && (
              <Section title="Orçamento de mão de obra desta obra" action={<button onClick={addMaoObra} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white"><Plus size={14} /> Função</button>}>
                <RowsTable headers={['Função', 'Custo diário', 'Qtd', 'Dias', 'Total', '% MO', '']}>
                  {active.maoObra.map((line) => {
                    const total = line.quantidadeObra * line.custoDiario * line.diasObra
                    return (
                      <tr key={line.id}>
                        <Cell><TextInput value={line.funcao} onChange={(value) => updateMaoObra(line.id, { funcao: value })} /></Cell>
                        <Cell><NumInput value={line.custoDiario} onChange={(value) => updateMaoObra(line.id, { custoDiario: value })} /></Cell>
                        <Cell><NumInput value={line.quantidadeObra} onChange={(value) => updateMaoObra(line.id, { quantidadeObra: value })} /></Cell>
                        <Cell><NumInput value={line.diasObra} onChange={(value) => updateMaoObra(line.id, { diasObra: value })} /></Cell>
                        <Cell>{money(total)}</Cell>
                        <Cell>{summary.custoMo > 0 ? `${numberBr((total / summary.custoMo) * 100, 1)}%` : '0%'}</Cell>
                        <Cell><button onClick={() => updateActive({ maoObra: active.maoObra.filter((item) => item.id !== line.id) })} className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#dc2626]/20 hover:text-[#f87171]"><Trash2 size={14} /></button></Cell>
                      </tr>
                    )
                  })}
                </RowsTable>
              </Section>
            )}

            {tab === 'orcamento' && (
              <Section title="Faturamento, impostos e despesas" action={<div className="flex gap-2"><button onClick={() => addOrcamentoLine('faturamento')} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white"><Plus size={14} /> Receita</button><button onClick={() => addOrcamentoLine('despesa')} className="inline-flex items-center gap-2 rounded-lg border border-[#525252] px-3 py-2 text-xs font-semibold text-[#e5e5e5]"><Plus size={14} /> Despesa</button></div>}>
                <RowsTable headers={['Tipo', 'Código', 'Descrição', 'Valor', 'Alíquota', 'Impostos', 'Obs.', '']}>
                  {active.orcamento.map((line) => (
                    <tr key={line.id}>
                      <Cell>{line.tipo}</Cell>
                      <Cell><TextInput value={line.codigo} onChange={(value) => updateOrcamento(line.id, { codigo: value })} /></Cell>
                      <Cell><TextInput value={line.descricao} onChange={(value) => updateOrcamento(line.id, { descricao: value })} /></Cell>
                      <Cell><NumInput value={line.valor} onChange={(value) => updateOrcamento(line.id, { valor: value })} /></Cell>
                      <Cell><NumInput value={line.aliquota * 100} onChange={(value) => updateOrcamento(line.id, { aliquota: value / 100 })} /></Cell>
                      <Cell>{money(line.impostos)}</Cell>
                      <Cell><TextInput value={line.observacoes} onChange={(value) => updateOrcamento(line.id, { observacoes: value })} /></Cell>
                      <Cell><button onClick={() => updateActive({ orcamento: active.orcamento.filter((item) => item.id !== line.id), resumoFinanceiro: null })} className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#dc2626]/20 hover:text-[#f87171]"><Trash2 size={14} /></button></Cell>
                    </tr>
                  ))}
                </RowsTable>
              </Section>
            )}

            {tab === 'fotos' && (
              <Section title="Registro fotográfico" action={<button onClick={addFotoLine} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white"><Plus size={14} /> Registro</button>}>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {active.fotos.map((line) => (
                    <div key={line.id} className="rounded-xl border border-[#525252] bg-[#333333] p-4">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <TextInput value={line.pavimentoSuperficie} onChange={(value) => updateFoto(line.id, { pavimentoSuperficie: value })} />
                          <TextInput value={line.estadoGeral} onChange={(value) => updateFoto(line.id, { estadoGeral: value })} />
                        </div>
                        <button onClick={() => updateActive({ fotos: active.fotos.filter((item) => item.id !== line.id) })} className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#dc2626]/20 hover:text-[#f87171]"><Trash2 size={14} /></button>
                      </div>
                      <div className="mt-4 grid grid-cols-5 gap-2">
                        {line.fotos.map((foto) => (
                          <div key={foto.label} className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-[#525252] bg-[#2f2f2f] text-center text-[10px] text-[#a3a3a3]">{foto.label}</div>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-2">
                        <TextInput value={line.data} onChange={(value) => updateFoto(line.id, { data: value })} />
                        <TextInput value={line.responsavelTecnico} onChange={(value) => updateFoto(line.id, { responsavelTecnico: value })} />
                        <TextInput value={line.observacoes} onChange={(value) => updateFoto(line.id, { observacoes: value })} />
                      </div>
                    </div>
                  ))}
                  {active.fotos.length === 0 && <p className="text-sm text-[#a3a3a3]">Importe a planilha ou adicione registros fotográficos.</p>}
                </div>
              </Section>
            )}

            {tab === 'resumo' && (
              <Section title="Resumo consolidado" action={<button onClick={() => updateActive({ status: 'orcamento_pronto' })} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white"><Save size={14} /> Marcar orçamento pronto</button>}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    ['M² Piso', `${numberBr(summary.totalPiso)} m²`],
                    ['M² Paredes', `${numberBr(summary.totalParede)} m²`],
                    ['ML Vagas', `${numberBr(summary.totalVagas)} ml`],
                    ['Custo MO', money(summary.custoMo)],
                    ['Saldo líquido', money(summary.saldo)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-[#525252] bg-[#333333] p-4">
                      <p className="text-xs font-semibold text-[#a3a3a3]">{label}</p>
                      <p className="mt-2 text-xl font-bold">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <SummaryLine label="Faturamento total" value={money(summary.faturamento)} />
                  <SummaryLine label="Total impostos" value={money(summary.impostos)} />
                  <SummaryLine label="Total despesas" value={money(summary.despesas)} />
                  <SummaryLine label="Margem líquida" value={summary.faturamento > 0 ? `${numberBr((summary.saldo / summary.faturamento) * 100, 2)}%` : '0%'} />
                </div>
                <div className="mt-5 flex justify-end">
                  <button onClick={() => deleteLevantamento(active.id)} className="inline-flex items-center gap-2 rounded-lg border border-[#dc2626]/40 px-3 py-2 text-sm font-semibold text-[#f87171] hover:bg-[#dc2626]/10">
                    <Trash2 size={15} /> Excluir levantamento
                  </button>
                </div>
              </Section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#525252] bg-[#2f2f2f] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function TextInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
}

function NumInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <input inputMode="decimal" value={formatDecimalInput(value, 4)} onChange={(e) => onChange(parseLocaleNumber(e.target.value))} className={inputClass} />
}

function RowsTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-sm">
        <thead className="text-left text-xs text-[#a3a3a3]"><tr>{headers.map((h) => <th key={h} className="px-2 py-2">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-[#525252]/60">{children}</tbody>
      </table>
    </div>
  )
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="px-2 py-2 align-middle text-[#e5e5e5]">{children}</td>
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#525252] bg-[#333333] px-4 py-3">
      <span className="text-sm text-[#a3a3a3]">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
