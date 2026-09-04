import { useState } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, Download, Edit2, FileDown, Package, Plus, Trash2, X as XIcon } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useMedicaoBillingStore } from '@/store/medicaoBillingStore'
import type { Fornecedor, FornecedorMedicaoItem, SupplierMeasurementControlRow } from '@/store/medicaoBillingStore'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { readWorkbook, parseFornecedorSheet } from '../utils/xlsxParsers'
import type { FornecedorParseResult } from '../utils/xlsxParsers'
import { exportFornecedoresPdf } from '../utils/exportPdf'
import { promoteFornecedorImportToUnified } from '../utils/unifiedImportPromotion'
import { AreaDeSoltar } from '@/components/shared/AreaDeSoltar'

const fieldClass = 'w-full rounded border border-[#525252] bg-[#1f1f1f] px-2 py-1.5 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]'
const btnMuted = 'inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#484848] px-3 py-2 text-xs font-medium text-[#f5f5f5] hover:bg-[#525252]'

function downloadTemplateForn() {
  const template = [{
    'Nome / Empresa': 'WERT AMBIENTAL',
    'Mês de Referência': 'mar/26',
    'Obra / Núcleo': 'Núcleo 1',
    'Medição': '01',
    'Responsável': 'Engenharia',
    'Nº de Revisão': 'R0',
    'Contrato': '11481051',
    'Período': '01/03/2026 a 31/03/2026',
    'Setor': 'Fornecimento',
    'Data': '2026-03-31',
    'Descrição dos serviços': 'Fornecimento de materiais',
    'Trabalhos executados Aprovados (R$)': 86200,
    'Total Descontos (R$)': 0,
    'Adiantamento (R$)': 0,
    'Fechamento Anterior (R$)': 0,
    'Relatório (R$)': 0,
    'Valor Total Medição - NF (R$)': 86200,
  }]
  const ws = XLSX.utils.json_to_sheet(template)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template Fornecedores')
  XLSX.writeFile(wb, 'Template_Fornecedores_ConstruData.xlsx')
}

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function toNumber(value: string | number | undefined) {
  if (typeof value === 'number') return value
  return Number(String(value ?? '').replace(/\./g, '').replace(',', '.')) || 0
}

function supplierTotal(f: Fornecedor) {
  const approved = Number(f.valorAprovado) || 0
  const discounts = Number(f.totalDescontos) || 0
  const advance = Number(f.adiantamento) || 0
  const previous = Number(f.fechamentoAnterior) || 0
  const report = Number(f.relatorio) || 0
  return Number(f.valorTotalMedicaoNf) || approved - discounts - advance + previous + report
}

function normalizeSupplierName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function safeSheetName(value: string, fallback = 'Fornecedor') {
  const cleaned = (value || fallback).replace(/[\\/?*[\]:]/g, ' ').slice(0, 28).trim()
  return cleaned || fallback
}

function upsertSupplierCatalog(fornecedores: Omit<Fornecedor, 'id'>[]) {
  const { suppliers, addSupplier } = useSuprimentosStore.getState()
  const known = new Map(suppliers.map((supplier) => [normalizeSupplierName(supplier.name), supplier.id]))

  return fornecedores.map((fornecedor) => {
    const key = normalizeSupplierName(fornecedor.empresa || fornecedor.nome)
    const existingId = known.get(key)
    if (existingId) return { ...fornecedor, supplierId: existingId }

    addSupplier({
      cnpj: '',
      name: fornecedor.empresa || fornecedor.nome,
      category: fornecedor.setor || 'Fornecedor de obra',
      contactName: fornecedor.responsavel || '',
      phone: '',
      email: '',
      paymentTerms: fornecedor.contrato ? `Contrato ${fornecedor.contrato}` : '',
    })
    const created = useSuprimentosStore.getState().suppliers.find((supplier) => normalizeSupplierName(supplier.name) === key)
    if (created) known.set(key, created.id)
    return { ...fornecedor, supplierId: created?.id ?? null, importWarnings: [...(fornecedor.importWarnings ?? []), 'Fornecedor criado/associado no cadastro oficial de Suprimentos.'] }
  })
}

function buildResumoSheet(fornecedor: Fornecedor) {
  return XLSX.utils.aoa_to_sheet([
    ['Resumo - Fechamento de Medição Fornecedor'],
    ['Mês de Referência', fornecedor.mesReferencia || fornecedor.periodo],
    ['Empresa', fornecedor.empresa || fornecedor.nome],
    ['Obra/Núcleo', fornecedor.obraNucleo || ''],
    ['Contrato', fornecedor.contrato || ''],
    ['Medição', fornecedor.medicao || ''],
    ['Período', fornecedor.periodo],
    ['Responsável', fornecedor.responsavel || ''],
    ['Setor', fornecedor.setor || ''],
    ['Revisão', fornecedor.numeroRevisao || ''],
    ['Data', fornecedor.data || ''],
    [],
    ['TRABALHOS EXECUTADOS APROVADOS', fornecedor.valorAprovado || 0],
    ['TOTAL DESCONTOS', fornecedor.totalDescontos || 0],
    ['ADIANTAMENTO', fornecedor.adiantamento || 0],
    ['FECHAMENTO ANTERIOR', fornecedor.fechamentoAnterior || 0],
    ['RELATÓRIO', fornecedor.relatorio || 0],
    ['VALOR TOTAL MEDIÇÃO - NF', supplierTotal(fornecedor)],
  ])
}

function buildMedicaoSheet(fornecedor: Fornecedor) {
  const rows = [
    ['ITEM', 'DESCRIÇÃO DOS SERVIÇOS', 'EMPREITEIRO', 'NÚCLEO', 'PERÍODO', 'UNID.', 'PREÇO UNITÁRIO', 'QTD ANTERIOR', 'QTD NO MÊS', 'QTD ACUMULADO', 'VALOR ANTERIOR', 'VALOR NO MÊS', 'VALOR ACUMULADO', 'ORIGEM', 'PENDÊNCIAS'],
    ...(fornecedor.medicaoItens ?? []).map((item) => [
      item.item,
      item.descricao,
      item.empreiteiro || '',
      item.nucleo || '',
      item.periodo,
      item.unidade,
      item.precoUnitario,
      item.quantidadeAnterior || '',
      item.quantidadeMes || '',
      item.quantidadeAcumulada || '',
      item.valorAnterior || '',
      item.valorMes ?? item.noMes,
      item.valorAcumulado ?? item.total,
      item.origem || 'Manual',
      (item.pendencias ?? []).join('; '),
    ]),
  ]
  return XLSX.utils.aoa_to_sheet(rows)
}

function buildMemoriaSheet(fornecedor: Fornecedor) {
  const rows = [
    ['ITEM', 'DESCRIÇÃO', 'NÚMERO', 'PLACA/MODELO', 'EMPREITEIRO', 'NÚCLEO', 'DATA INÍCIO', 'DATA TÉRMINO', 'TOTAL DIAS', 'UNID', 'QNTD', 'VALOR UNIT.', 'VALOR FINAL', 'ORIGEM'],
    ...(fornecedor.memoriaItens ?? []).map((item) => [
      item.item || '',
      item.descricao,
      item.numero || '',
      item.placaModelo || '',
      item.empreiteiro || '',
      item.nucleo || '',
      item.dataInicio || '',
      item.dataTermino || '',
      item.totalDias || '',
      item.unidade || '',
      item.quantidade,
      item.valorUnitario,
      item.valorFinal,
      item.origem || '',
    ]),
  ]
  return XLSX.utils.aoa_to_sheet(rows)
}

function controleRowsForExport(fornecedor: Fornecedor): SupplierMeasurementControlRow[] {
  if (fornecedor.controleLinhas?.length) return fornecedor.controleLinhas
  return [{
    id: fornecedor.id,
    nucleo: fornecedor.obraNucleo,
    empreiteiro: fornecedor.empresa || fornecedor.nome,
    subcontratado: fornecedor.nome,
    servico: fornecedor.descricao,
    mesReferencia: fornecedor.mesReferencia || fornecedor.periodo,
    valorMedicao: fornecedor.valorAprovado,
    status: fornecedor.status,
  }]
}

function buildControleSheet(fornecedores: Fornecedor[]) {
  const rows = [
    ['Núcleo', 'Empreiteiro', 'Subcontratado', 'Serviço', 'Mês Referência', 'Valor Medição (R$)', 'Data Entrega Medição', 'Engenheiro Validou', 'Coordenação', 'Gerência', 'Status', 'Data Limite P/ Pagamento', 'Dias em Aberto', 'Observações'],
    ...fornecedores.flatMap((fornecedor) => controleRowsForExport(fornecedor).map((row) => [
      row.nucleo || '',
      row.empreiteiro || '',
      row.subcontratado,
      row.servico || '',
      row.mesReferencia || '',
      row.valorMedicao || 0,
      row.dataEntregaMedicao || '',
      row.engenheiroValidou || '',
      row.coordenacao || '',
      row.gerencia || '',
      row.status || '',
      row.dataLimitePagamento || '',
      row.diasEmAberto || '',
      row.observacoes || '',
    ])),
  ]
  return XLSX.utils.aoa_to_sheet(rows)
}

function buildControleSheetLegacyUnused(fornecedores: Fornecedor[]) {
  const rows = [
    ['Núcleo', 'Empreiteiro', 'Subcontratado', 'Serviço', 'Mês Referência', 'Valor Medição (R$)', 'Data Entrega Medição', 'Engenheiro Validou', 'Coordenação', 'Gerência', 'Status', 'Data Limite P/ Pagamento', 'Dias em Aberto', 'Observações'],
    ...fornecedores.flatMap((fornecedor) => (fornecedor.controleLinhas?.length ? fornecedor.controleLinhas : [{
      id: fornecedor.id,
      nucleo: fornecedor.obraNucleo,
      empreiteiro: fornecedor.empresa || fornecedor.nome,
      subcontratado: fornecedor.nome,
      servico: fornecedor.descricao,
      mesReferencia: fornecedor.mesReferencia || fornecedor.periodo,
      valorMedicao: fornecedor.valorAprovado,
      status: fornecedor.status,
    }]).map((row: SupplierMeasurementControlRow) => [
      row.nucleo || '',
      row.empreiteiro || '',
      row.subcontratado,
      row.servico || '',
      row.mesReferencia || '',
      row.valorMedicao || 0,
      row.dataEntregaMedicao || '',
      row.engenheiroValidou || '',
      row.coordenacao || '',
      row.gerencia || '',
      row.status || '',
      row.dataLimitePagamento || '',
      row.diasEmAberto || '',
      row.observacoes || '',
    ])),
  ]
  return XLSX.utils.aoa_to_sheet(rows)
}

function buildCalendarioSheet(fornecedores: Fornecedor[]) {
  const etapas = fornecedores.flatMap((fornecedor) => fornecedor.etapasAprovacao ?? [])
  return XLSX.utils.aoa_to_sheet([
    ['Etapa', 'Responsável', 'Prazo limite (dia do mês)', 'O que precisa ser enviado/validado', 'Status'],
    ...etapas.map((item) => [item.etapa, item.responsavel, item.prazoLimite, item.descricao, item.status || 'pendente']),
  ])
}

function buildBaseServicosSheet(fornecedores: Fornecedor[]) {
  const services = fornecedores.flatMap((fornecedor) => fornecedor.servicosBase ?? [])
  return XLSX.utils.aoa_to_sheet([
    ['NOME', 'DESCRIÇÃO'],
    ...services.map((item) => [item.nome, item.descricao]),
  ])
}

function exportFornecedoresXlsx(fornecedores: Fornecedor[], periodo: string) {
  const wb = XLSX.utils.book_new()
  fornecedores.forEach((fornecedor, index) => {
    const prefix = safeSheetName(`${index + 1}_${fornecedor.nome}`, `Fornecedor_${index + 1}`)
    XLSX.utils.book_append_sheet(wb, buildResumoSheet(fornecedor), safeSheetName(`Resumo_${prefix}`))
    XLSX.utils.book_append_sheet(wb, buildMedicaoSheet(fornecedor), safeSheetName(`MEDICAO_${prefix}`))
    XLSX.utils.book_append_sheet(wb, buildMemoriaSheet(fornecedor), safeSheetName(`MC_${prefix}`))
  })
  XLSX.utils.book_append_sheet(wb, buildControleSheet(fornecedores), 'Controle_Medições')
  XLSX.utils.book_append_sheet(wb, buildControleSheetLegacyUnused(fornecedores), 'Controle_Legado')
  XLSX.utils.book_append_sheet(wb, buildCalendarioSheet(fornecedores), 'Calendário_Medição')
  XLSX.utils.book_append_sheet(wb, buildBaseServicosSheet(fornecedores), 'Base_Serviços')
  XLSX.writeFile(wb, `Fornecedores_${periodo.replace(/[^\w-]+/g, '-')}.xlsx`)
}

function emptySupplier(periodo: string): Omit<Fornecedor, 'id'> {
  return {
    nome: '',
    periodo,
    descricao: '',
    valorAprovado: 0,
    mesReferencia: periodo,
    obraNucleo: '',
    medicao: '',
    responsavel: '',
    numeroRevisao: '',
    empresa: '',
    contrato: '',
    setor: '',
    data: new Date().toISOString().slice(0, 10),
    totalDescontos: 0,
    adiantamento: 0,
    fechamentoAnterior: 0,
    relatorio: 0,
    valorTotalMedicaoNf: 0,
    medicaoItens: [],
  }
}

function XlsxImportFornecedor({ periodo }: { periodo: string }) {
  const { importFornecedores } = useMedicaoBillingStore()
  const [preview, setPreview] = useState<FornecedorParseResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setLoading(true)
    try {
      const merged: FornecedorParseResult = { list: [], errors: [] }
      for (const file of files) {
        const wb = await readWorkbook(file)
        const parsed = parseFornecedorSheet(wb, periodo)
        merged.list.push(...parsed.list.map((fornecedor) => ({
          ...fornecedor,
          sourceWorkbookName: file.name,
          importWarnings: [...(fornecedor.importWarnings ?? []), ...parsed.errors.map((error) => `${file.name}: ${error}`)],
        })))
        merged.errors.push(...parsed.errors.map((error) => `${file.name}: ${error}`))
      }
      setPreview(merged)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!preview || preview.errors.length > 0) return
    const list = upsertSupplierCatalog(preview.list)
    importFornecedores(list, false)
    await promoteFornecedorImportToUnified(list)
    setPreview(null)
  }

  return (
    <>
      <AreaDeSoltar
        compacto
        varios
        aceita=".xlsx,.xls,.csv"
        desabilitado={loading}
        titulo={loading ? 'Lendo…' : 'Arraste a planilha de fornecedores ou clique'}
        aoEscolher={(arquivos) => {
          void handleFile({ target: { files: arquivos, value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>)
        }}
      />

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#525252] bg-[#2c2c2c] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#525252] bg-[#3a3a3a] px-5 py-3">
              <span className="text-sm font-semibold text-white">Pré-visualização - Fornecedores</span>
              <button onClick={() => setPreview(null)} className="text-[#6b6b6b] hover:text-white"><XIcon size={16} /></button>
            </div>
            <div className="space-y-3 p-5">
              {preview.errors.length > 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-700/30 bg-red-900/20 p-3 text-xs text-red-400">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <div>{preview.errors.join(' ')}</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#a3a3a3]">Ao confirmar, os fornecedores serão criados/associados no cadastro oficial de Suprimentos.</p>
                  <p className="text-xs text-[#a3a3a3]">{preview.list.length} fornecedor(es) encontrado(s). Serão adicionados ao boletim atual.</p>
                  {preview.list.map((f, i) => (
                    <div key={i} className="rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">{f.nome}</span>
                        <span className="text-sm font-bold text-blue-400">{fmt(f.valorAprovado)}</span>
                      </div>
                      {f.descricao && <p className="mt-0.5 truncate text-xs text-[#6b6b6b]">{f.descricao}</p>}
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[#a3a3a3]">
                        <span>{f.medicaoItens?.length ?? 0} linha(s)</span>
                        <span>{f.memoriaItens?.length ?? 0} memória(s)</span>
                        <span>{f.controleLinhas?.length ?? 0} controle(s)</span>
                        {f.sourceWorkbookName && <span>{f.sourceWorkbookName}</span>}
                      </div>
                      {(f.importWarnings?.length ?? 0) > 0 && (
                        <p className="mt-2 text-[11px] text-amber-300">{f.importWarnings?.slice(0, 3).join(' · ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#525252] bg-[#1f1f1f] px-5 py-3">
              <button onClick={() => setPreview(null)} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5]">Cancelar</button>
              {preview.errors.length === 0 && (
                <button onClick={handleConfirm} className="rounded-lg bg-[#f97316] px-5 py-2 text-xs font-medium text-white">
                  Adicionar {preview.list.length} fornecedor(es)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SupplierForm({
  value,
  onCancel,
  onSave,
}: {
  value: Omit<Fornecedor, 'id'> | Fornecedor
  onCancel: () => void
  onSave: (value: Omit<Fornecedor, 'id'>) => void
}) {
  const [form, setForm] = useState<Omit<Fornecedor, 'id'>>({ ...value })
  const set = (key: keyof Omit<Fornecedor, 'id'>, next: string | number | FornecedorMedicaoItem[]) => setForm((current) => ({ ...current, [key]: next }))

  function save() {
    if (!form.nome.trim()) return
    onSave({
      ...form,
      empresa: form.empresa || form.nome,
      valorAprovado: toNumber(form.valorAprovado),
      totalDescontos: toNumber(form.totalDescontos),
      adiantamento: toNumber(form.adiantamento),
      fechamentoAnterior: toNumber(form.fechamentoAnterior),
      relatorio: toNumber(form.relatorio),
      valorTotalMedicaoNf: supplierTotal(form as Fornecedor),
    })
  }

  return (
    <div className="rounded-xl border border-[#525252] bg-[#1f1f1f] p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Empresa"><input value={form.nome} onChange={(e) => set('nome', e.target.value)} className={fieldClass} /></Field>
        <Field label="Mês de Referência"><input value={form.mesReferencia ?? form.periodo} onChange={(e) => { set('mesReferencia', e.target.value); set('periodo', e.target.value) }} className={fieldClass} /></Field>
        <Field label="Obra / Núcleo"><input value={form.obraNucleo ?? ''} onChange={(e) => set('obraNucleo', e.target.value)} className={fieldClass} /></Field>
        <Field label="Medição"><input value={form.medicao ?? ''} onChange={(e) => set('medicao', e.target.value)} className={fieldClass} /></Field>
        <Field label="Responsável"><input value={form.responsavel ?? ''} onChange={(e) => set('responsavel', e.target.value)} className={fieldClass} /></Field>
        <Field label="Nº de Revisão"><input value={form.numeroRevisao ?? ''} onChange={(e) => set('numeroRevisao', e.target.value)} className={fieldClass} /></Field>
        <Field label="Contrato"><input value={form.contrato ?? ''} onChange={(e) => set('contrato', e.target.value)} className={fieldClass} /></Field>
        <Field label="Período"><input value={form.periodo} onChange={(e) => set('periodo', e.target.value)} className={fieldClass} /></Field>
        <Field label="Setor"><input value={form.setor ?? ''} onChange={(e) => set('setor', e.target.value)} className={fieldClass} /></Field>
        <Field label="Data"><input type="date" value={form.data ?? ''} onChange={(e) => set('data', e.target.value)} className={fieldClass} /></Field>
        <Field label="Trabalhos executados Aprovados (R$)"><input value={form.valorAprovado || ''} onChange={(e) => set('valorAprovado', e.target.value)} className={fieldClass} /></Field>
        <Field label="Total Descontos (R$)"><input value={form.totalDescontos || ''} onChange={(e) => set('totalDescontos', e.target.value)} className={fieldClass} /></Field>
        <Field label="Adiantamento (R$)"><input value={form.adiantamento || ''} onChange={(e) => set('adiantamento', e.target.value)} className={fieldClass} /></Field>
        <Field label="Fechamento Anterior (R$)"><input value={form.fechamentoAnterior || ''} onChange={(e) => set('fechamentoAnterior', e.target.value)} className={fieldClass} /></Field>
        <Field label="Relatório (R$)"><input value={form.relatorio || ''} onChange={(e) => set('relatorio', e.target.value)} className={fieldClass} /></Field>
        <Field label="Valor Total Medição - NF (R$)"><input value={supplierTotal(form as Fornecedor)} readOnly className={`${fieldClass} text-blue-300`} /></Field>
        <div className="md:col-span-4">
          <Field label="Descrição dos serviços">
            <textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)} rows={2} className={`${fieldClass} resize-none`} />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className={btnMuted}>Cancelar</button>
        <button onClick={save} disabled={!form.nome.trim()} className="rounded-lg bg-[#f97316] px-4 py-2 text-xs font-medium text-white disabled:opacity-50">Salvar fornecedor</button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase text-[#a3a3a3]">{label}</span>
      {children}
    </label>
  )
}

function SupplierItems({
  fornecedor,
  onUpdate,
}: {
  fornecedor: Fornecedor
  onUpdate: (patch: Partial<Omit<Fornecedor, 'id'>>) => void
}) {
  const [form, setForm] = useState<Omit<FornecedorMedicaoItem, 'id'>>({ item: '', descricao: '', empreiteiro: fornecedor.nome, nucleo: fornecedor.obraNucleo, periodo: fornecedor.periodo, unidade: 'UN', precoUnitario: 0, quantidadeMes: 0, noMes: 0, total: 0, origem: 'Manual' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const rows = fornecedor.medicaoItens ?? []
  const set = (key: keyof Omit<FornecedorMedicaoItem, 'id'>, next: string | number) => setForm((current) => {
    const updated = { ...current, [key]: next }
    const preco = key === 'precoUnitario' ? toNumber(next) : toNumber(updated.precoUnitario)
    const qtd = key === 'quantidadeMes' ? toNumber(next) : toNumber(updated.quantidadeMes)
    const total = preco * qtd
    return { ...updated, noMes: total, valorMes: total, total }
  })

  function saveItem() {
    if (!form.descricao.trim()) return
    const nextItem: FornecedorMedicaoItem = {
      id: editingId || crypto.randomUUID(),
      item: form.item,
      descricao: form.descricao,
      empreiteiro: form.empreiteiro,
      nucleo: form.nucleo,
      periodo: form.periodo,
      unidade: form.unidade,
      precoUnitario: toNumber(form.precoUnitario),
      quantidadeMes: toNumber(form.quantidadeMes),
      noMes: toNumber(form.precoUnitario) * toNumber(form.quantidadeMes),
      valorMes: toNumber(form.precoUnitario) * toNumber(form.quantidadeMes),
      total: toNumber(form.precoUnitario) * toNumber(form.quantidadeMes),
      origem: form.origem ?? 'Manual',
    }
    const nextRows = editingId ? rows.map((row) => row.id === editingId ? nextItem : row) : [...rows, nextItem]
    onUpdate({
      medicaoItens: nextRows,
      valorAprovado: nextRows.reduce((sum, row) => sum + row.total, 0),
      valorTotalMedicaoNf: nextRows.reduce((sum, row) => sum + row.total, 0) - Number(fornecedor.totalDescontos || 0) - Number(fornecedor.adiantamento || 0) + Number(fornecedor.fechamentoAnterior || 0) + Number(fornecedor.relatorio || 0),
    })
    setForm({ item: '', descricao: '', empreiteiro: fornecedor.nome, nucleo: fornecedor.obraNucleo, periodo: fornecedor.periodo, unidade: 'UN', precoUnitario: 0, quantidadeMes: 0, noMes: 0, total: 0, origem: 'Manual' })
    setEditingId(null)
  }

  function edit(row: FornecedorMedicaoItem) {
    setEditingId(row.id)
    setForm({ item: row.item, descricao: row.descricao, empreiteiro: row.empreiteiro, nucleo: row.nucleo, periodo: row.periodo, unidade: row.unidade, precoUnitario: row.precoUnitario, quantidadeMes: row.quantidadeMes ?? (row.precoUnitario > 0 ? row.noMes / row.precoUnitario : 0), noMes: row.noMes, valorMes: row.valorMes, total: row.total, origem: row.origem ?? 'Manual' })
  }

  function remove(id: string) {
    const nextRows = rows.filter((row) => row.id !== id)
    onUpdate({ medicaoItens: nextRows, valorAprovado: nextRows.reduce((sum, row) => sum + row.total, 0) })
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Medição</h3>
        <p className="text-xs text-[#a3a3a3]">{rows.length} item(ns)</p>
      </div>
      <div className="grid gap-2 rounded-xl border border-[#525252] bg-[#1f1f1f] p-3 md:grid-cols-[70px_1fr_130px_120px_130px_80px_110px_110px_120px_auto]">
        <input value={form.item} onChange={(e) => set('item', e.target.value)} placeholder="Item" className={fieldClass} />
        <input value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Descrição dos serviços" className={fieldClass} />
        <input value={form.empreiteiro ?? ''} onChange={(e) => set('empreiteiro', e.target.value)} placeholder="Empreiteiro" className={fieldClass} />
        <input value={form.nucleo ?? ''} onChange={(e) => set('nucleo', e.target.value)} placeholder="Núcleo" className={fieldClass} />
        <input value={form.periodo} onChange={(e) => set('periodo', e.target.value)} placeholder="Período" className={fieldClass} />
        <input value={form.unidade} onChange={(e) => set('unidade', e.target.value)} placeholder="Unidade" className={fieldClass} />
        <input value={form.precoUnitario || ''} onChange={(e) => set('precoUnitario', e.target.value)} placeholder="Preço Unitário" className={fieldClass} />
        <input value={form.quantidadeMes || ''} onChange={(e) => set('quantidadeMes', e.target.value)} placeholder="Qtd mês" className={fieldClass} />
        <input value={fmt(form.total)} readOnly className={`${fieldClass} text-blue-300`} />
        <button onClick={saveItem} className="rounded-lg bg-[#f97316] px-4 py-2 text-xs font-medium text-white">{editingId ? 'Salvar' : 'Adicionar'}</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#525252]">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-[#1f1f1f] text-left text-xs uppercase text-[#a3a3a3]">
            <tr><th className="p-2">Item</th><th className="p-2">Descrição dos serviços</th><th className="p-2">Empreiteiro</th><th className="p-2">Núcleo</th><th className="p-2">Período</th><th className="p-2">Unidade</th><th className="p-2">Preço Unitário</th><th className="p-2">Qtd mês</th><th className="p-2">No mês (R$)</th><th className="p-2 text-right">Ações</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="p-6 text-center text-sm text-[#6b6b6b]">Nenhum item de medição cadastrado.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-t border-[#3d3d3d] text-[#f5f5f5]">
                <td className="p-2">{row.item}</td><td className="p-2">{row.descricao}</td><td className="p-2">{row.empreiteiro || '-'}</td><td className="p-2">{row.nucleo || '-'}</td><td className="p-2">{row.periodo}</td><td className="p-2">{row.unidade}</td><td className="p-2">{fmt(row.precoUnitario)}</td><td className="p-2">{row.quantidadeMes ?? '-'}</td><td className="p-2">{fmt(row.valorMes ?? row.noMes)}</td>
                <td className="p-2"><div className="flex justify-end gap-2"><button onClick={() => edit(row)} className="rounded border border-[#525252] px-2 py-1 text-xs text-[#d4d4d4]">Editar</button><button onClick={() => remove(row.id)} className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300">Excluir</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function FornecedoresPanel() {
  const { getActiveBoletim, addFornecedor, updateFornecedor, removeFornecedor } = useMedicaoBillingStore()
  const boletim = getActiveBoletim()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')

  if (!boletim) return <div className="p-8 text-center text-sm text-[#6b6b6b]">Nenhum boletim ativo.</div>

  const fornecedores = boletim.fornecedores
  const selected = fornecedores.find((f) => f.id === selectedId) ?? fornecedores[0] ?? null
  const totalAprovado = fornecedores.reduce((s, f) => s + Number(f.valorAprovado || 0), 0)
  const totalNf = fornecedores.reduce((s, f) => s + supplierTotal(f), 0)

  return (
    <div className="mx-auto max-w-[1180px] space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Fornecedores</h2>
          <p className="mt-0.5 text-xs text-[#a3a3a3]">{fornecedores.length} fornecedores · Período: {boletim.periodo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <XlsxImportFornecedor periodo={boletim.periodo} />
          <button type="button" onClick={downloadTemplateForn} className={btnMuted}><Download size={13} /> Template</button>
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-medium text-white"><Plus size={13} /> Adicionar</button>
          {fornecedores.length > 0 && (
            <>
              <button type="button" onClick={() => {
                const rows = fornecedores.map((f) => ({ Fornecedor: f.nome, Período: f.periodo, Descrição: f.descricao, 'Valor Aprovado (R$)': f.valorAprovado, 'Valor Total Medição - NF (R$)': supplierTotal(f) }))
                const ws = XLSX.utils.json_to_sheet(rows)
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, 'Fornecedores')
                XLSX.writeFile(wb, `Fornecedores_${boletim.periodo.replace('/', '-')}.xlsx`)
              }} className={btnMuted}><FileDown size={13} /> XLSX</button>
              <button type="button" onClick={() => exportFornecedoresXlsx(fornecedores, boletim.periodo)} className={btnMuted}><FileDown size={13} /> XLSX padrão</button>
              <button type="button" onClick={() => exportFornecedoresPdf(fornecedores, boletim.periodo, boletim.contrato)} className={btnMuted}><FileDown size={13} /> PDF</button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Fornecedores" value={fornecedores.length} />
        <Metric label="Trabalhos aprovados" value={fmt(totalAprovado)} />
        <Metric label="Valor Total Medição - NF" value={fmt(totalNf)} />
      </div>

      <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 text-xs leading-relaxed text-blue-100">
        O importador reconhece os formatos enviados com abas Resumo, boletim do fornecedor/empreiteiro, MC/mc e Controle_Medicoes.
        O resultado entra como rascunho conferivel: arquivo, aba, linha, confianca e pendencias ficam visiveis antes do fechamento.
      </div>

      {adding && (
        <SupplierForm
          value={emptySupplier(boletim.periodo)}
          onCancel={() => setAdding(false)}
          onSave={(value) => {
            addFornecedor(value)
            setAdding(false)
          }}
        />
      )}

      {fornecedores.length === 0 && !adding ? (
        <div className="py-12 text-center text-sm text-[#6b6b6b]">
          <Package size={32} className="mx-auto mb-3 text-[#525252]" />
          Nenhum fornecedor adicionado ainda.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
          <div className="space-y-2">
            {fornecedores.map((f) => (
              <button key={f.id} onClick={() => setSelectedId(f.id)} className={`w-full rounded-xl border p-3 text-left transition-colors ${selected?.id === f.id ? 'border-[#f97316] bg-[#3a2a1f]' : 'border-[#525252] bg-[#2c2c2c] hover:bg-[#333333]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div><p className="text-sm font-semibold text-white">{f.nome}</p><p className="mt-0.5 text-xs text-[#a3a3a3]">{f.periodo}</p></div>
                  <span className="text-xs font-bold text-blue-400">{fmt(supplierTotal(f))}</span>
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="space-y-4 rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
              {editingId === selected.id ? (
                <SupplierForm
                  value={selected}
                  onCancel={() => setEditingId(null)}
                  onSave={(value) => {
                    updateFornecedor(selected.id, value)
                    setEditingId(null)
                  }}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Resumo - Fechamento de Medição Fornecedor</h3>
                      <p className="mt-1 text-xs text-[#a3a3a3]">{selected.nome} · {selected.periodo}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingId(selected.id)} className={btnMuted}><Edit2 size={13} /> Editar</button>
                      <button onClick={() => removeFornecedor(selected.id)} className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-[#3a3a3a] px-3 py-2 text-xs font-medium text-red-300 hover:border-red-300"><Trash2 size={13} /> Excluir</button>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <Summary label="Mês de Referência" value={selected.mesReferencia || selected.periodo} />
                    <Summary label="Obra / Núcleo" value={selected.obraNucleo || '-'} />
                    <Summary label="Medição" value={selected.medicao || '-'} />
                    <Summary label="Responsável" value={selected.responsavel || '-'} />
                    <Summary label="Nº de Revisão" value={selected.numeroRevisao || '-'} />
                    <Summary label="Empresa" value={selected.empresa || selected.nome} />
                    <Summary label="Contrato" value={selected.contrato || boletim.contrato} />
                    <Summary label="Período" value={selected.periodo} />
                    <Summary label="Setor" value={selected.setor || '-'} />
                    <Summary label="Data" value={selected.data || '-'} />
                    <Summary label="Trabalhos executados Aprovados (R$)" value={fmt(selected.valorAprovado)} />
                    <Summary label="Total Descontos (R$)" value={fmt(selected.totalDescontos || 0)} />
                    <Summary label="Adiantamento (R$)" value={fmt(selected.adiantamento || 0)} />
                    <Summary label="Fechamento Anterior (R$)" value={fmt(selected.fechamentoAnterior || 0)} />
                    <Summary label="Relatório (R$)" value={fmt(selected.relatorio || 0)} />
                    <Summary label="Valor Total Medição - NF (R$)" value={fmt(supplierTotal(selected))} strong />
                  </div>
                  {selected.descricao && <p className="rounded-lg border border-[#525252] bg-[#1f1f1f] p-3 text-sm text-[#d4d4d4]">{selected.descricao}</p>}
                  <div className="grid gap-2 md:grid-cols-4">
                    <Summary label="Cadastro Suprimentos" value={selected.supplierId ? 'Vinculado' : 'Pendente'} />
                    <Summary label="Linhas Medição" value={selected.medicaoItens?.length ?? 0} />
                    <Summary label="Linhas MC" value={selected.memoriaItens?.length ?? 0} />
                    <Summary label="Linhas Controle" value={selected.controleLinhas?.length ?? 0} />
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <Summary label="Confianca Importacao" value={`${selected.parseConfidence ?? 0}%`} />
                    <Summary label="Arquivo Origem" value={selected.sourceWorkbookName || selected.sourceSheet || '-'} />
                    <Summary label="Pendencias Bloqueantes" value={selected.blockingIssues?.length ?? 0} />
                  </div>
                  {(selected.blockingIssues?.length ?? 0) > 0 && (
                    <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-200">
                      {selected.blockingIssues?.map((issue, index) => <p key={index}>{issue}</p>)}
                    </div>
                  )}
                  {(selected.importWarnings?.length ?? 0) > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
                      {selected.importWarnings?.slice(0, 8).map((warning, index) => <p key={index}>{warning}</p>)}
                    </div>
                  )}
                </>
              )}
              <SupplierItems fornecedor={selected} onUpdate={(patch) => updateFornecedor(selected.id, patch)} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3"><p className="text-xs text-[#a3a3a3]">{label}</p><p className="mt-1 text-lg font-semibold text-white">{value}</p></div>
}

function Summary({ label, value, strong }: { label: string; value: string | number; strong?: boolean }) {
  return <div className="rounded-lg border border-[#525252] bg-[#1f1f1f] p-3"><p className="text-[10px] font-semibold uppercase text-[#a3a3a3]">{label}</p><p className={`mt-1 text-sm ${strong ? 'font-bold text-blue-300' : 'text-[#f5f5f5]'}`}>{value}</p></div>
}
