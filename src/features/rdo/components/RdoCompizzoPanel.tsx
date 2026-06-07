/**
 * RdoCompizzoPanel — variante de RDO no formato do "Diário de Obra" da Compizzo
 * (demarcação e pintura de piso industrial). Replica os campos do documento e
 * reaproveita campos do Novo RDO (mão de obra, equipamentos, fotos). Salva no
 * mesmo store de RDO (template 'compizzo') e exporta PDF idêntico ao documento.
 */
import { useRef, useState } from 'react'
import {
  ClipboardList, Plus, Trash2, Printer, Save, FileText, Sun, Cloud,
  CloudRain, Wrench, Camera, X, ScanText, CheckCircle2,
} from 'lucide-react'
import { useRdoStore } from '@/store/rdoStore'
import { parseCompizzoText } from '../utils/parseCompizzoText'
import { printCompizzoPdf } from '../utils/rdoCompizzoPdf'
import type {
  RdoCompizzoData, RdoCompizzoServicos, RdoCompizzoOcorrencias,
  RdoCompizzoProducaoRow, RdoCompizzoMaterialRow, RdoEquipmentEntry, RdoPhoto, RdoWeatherCondition,
} from '@/types'

const inputCls = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]/60 placeholder:text-[#525252]'
const labelCls = 'block text-[#a3a3a3] text-xs mb-1'

const SERVICO_ITEMS: Array<[keyof RdoCompizzoServicos, string]> = [
  ['limpezaArea', 'Limpeza da área'],
  ['isolamentoArea', 'Isolamento da área'],
  ['preparacaoPiso', 'Preparação do piso'],
  ['tintaVermelha', 'Aplicação de tinta vermelha'],
  ['tintaAmarela', 'Aplicação de tinta amarela'],
  ['faixaBranca', 'Demarcação faixa branca'],
  ['faixaAmarela', 'Demarcação faixa amarela'],
  ['faixaVermelha', 'Demarcação faixa vermelha'],
  ['vagasPCD', 'Pintura de vagas PCD'],
  ['retoques', 'Retoques'],
  ['limpezaFinal', 'Limpeza final'],
]

const OCORRENCIA_ITEMS: Array<[keyof RdoCompizzoOcorrencias, string]> = [
  ['semOcorrencias', 'Sem ocorrências'],
  ['chuva', 'Chuva'],
  ['areaNaoLiberada', 'Área não liberada'],
  ['interferenciaTerceiros', 'Interferência de terceiros'],
  ['faltaEnergia', 'Falta de energia'],
  ['equipamentoDefeito', 'Equipamento com defeito'],
  ['outros', 'Outros'],
]

const DEFAULT_PRODUCAO: RdoCompizzoProducaoRow[] = [
  { servico: 'Pintura Vermelha (m²)', quantidade: '' },
  { servico: 'Pintura Amarela (m²)', quantidade: '' },
  { servico: 'Faixa Branca (m)', quantidade: '' },
  { servico: 'Faixa Amarela (m)', quantidade: '' },
  { servico: 'Faixa Vermelha (m)', quantidade: '' },
  { servico: 'Vagas PCD (un)', quantidade: '' },
]

const DEFAULT_MATERIAIS: RdoCompizzoMaterialRow[] = [
  { material: 'Tinta Amarela', quantidade: '' },
  { material: 'Tinta Vermelha', quantidade: '' },
  { material: 'Solvente', quantidade: '' },
  { material: 'Fita Crepe', quantidade: '' },
]

const emptyServicos = (): RdoCompizzoServicos => ({
  limpezaArea: false, isolamentoArea: false, preparacaoPiso: false,
  tintaVermelha: false, tintaAmarela: false, faixaBranca: false,
  faixaAmarela: false, faixaVermelha: false, vagasPCD: false,
  retoques: false, limpezaFinal: false,
})

const emptyOcorrencias = (): RdoCompizzoOcorrencias => ({
  semOcorrencias: false, chuva: false, areaNaoLiberada: false,
  interferenciaTerceiros: false, faltaEnergia: false,
  equipamentoDefeito: false, outros: false,
})

const climaToWeather = (c: RdoCompizzoData['condicaoClimatica']): RdoWeatherCondition =>
  c === 'chuva' ? 'rain' : c === 'nublado' ? 'cloudy' : 'good'

export function CompizzoWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight text-[#1f6fd1] ${className}`} style={{ fontFamily: 'Arial, sans-serif' }}>
      compizzo
    </span>
  )
}

export function RdoCompizzoPanel() {
  const addRdo = useRdoStore((s) => s.addRdo)
  const setActiveTab = useRdoStore((s) => s.setActiveTab)
  const today = new Date().toISOString().slice(0, 10)

  const [obra, setObra] = useState('')
  const [data, setData] = useState(today)
  const [diaObra, setDiaObra] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [condicao, setCondicao] = useState<RdoCompizzoData['condicaoClimatica']>('sol')
  const [condicaoOutros, setCondicaoOutros] = useState('')
  const [employeeNames, setEmployeeNames] = useState<string[]>([])
  const [employeeInput, setEmployeeInput] = useState('')
  const [servicos, setServicos] = useState<RdoCompizzoServicos>(emptyServicos)
  const [descricao, setDescricao] = useState('')
  const [producao, setProducao] = useState<RdoCompizzoProducaoRow[]>(DEFAULT_PRODUCAO)
  const [materiais, setMateriais] = useState<RdoCompizzoMaterialRow[]>(DEFAULT_MATERIAIS)
  const [equipment, setEquipment] = useState<Array<Omit<RdoEquipmentEntry, 'id'>>>([])
  const [ocorrencias, setOcorrencias] = useState<RdoCompizzoOcorrencias>(emptyOcorrencias)
  const [observacoes, setObservacoes] = useState('')
  const [planejamento, setPlanejamento] = useState('')
  const [respNome, setRespNome] = useState('')
  const [respData, setRespData] = useState(today)
  const [photos, setPhotos] = useState<RdoPhoto[]>([])

  const [showText, setShowText] = useState(false)
  const [textValue, setTextValue] = useState('')
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function buildCompizzo(): RdoCompizzoData {
    return {
      obra, diaObra, condicaoClimatica: condicao, condicaoClimaticaOutros: condicaoOutros || undefined,
      servicos, descricaoServicos: descricao, producao, materiais, ocorrencias,
      observacoes, planejamentoProximoDia: planejamento,
      responsavelNome: respNome || responsavel, responsavelData: respData,
    }
  }

  function handleApplyText() {
    const p = parseCompizzoText(textValue)
    if (p.obra) setObra(p.obra)
    if (p.data) setData(p.data)
    if (p.diaObra) setDiaObra(p.diaObra)
    if (p.responsavelNome) { setResponsavel(p.responsavelNome); setRespNome(p.responsavelNome) }
    if (p.responsavelData) setRespData(p.responsavelData)
    if (p.condicaoClimatica) setCondicao(p.condicaoClimatica)
    if (Object.keys(p.servicos).length) setServicos((s) => ({ ...s, ...p.servicos }))
    if (p.descricaoServicos) setDescricao(p.descricaoServicos)
    if (p.producao.length) setProducao(p.producao)
    if (p.materiais.length) setMateriais(p.materiais)
    if (Object.keys(p.ocorrencias).length) setOcorrencias((o) => ({ ...o, ...p.ocorrencias }))
    if (p.observacoes) setObservacoes(p.observacoes)
    if (p.planejamentoProximoDia) setPlanejamento(p.planejamentoProximoDia)
    if (p.employeeNames.length) setEmployeeNames((prev) => [...new Set([...prev, ...p.employeeNames])])
    setShowText(false)
    setTextValue('')
  }

  function handlePhotos(files: FileList | null) {
    if (!files) return
    Array.from(files).slice(0, 20).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) return
      const reader = new FileReader()
      reader.onload = () => {
        setPhotos((prev) => [...prev, { id: crypto.randomUUID(), base64: String(reader.result), label: file.name, uploadedAt: new Date().toISOString() }])
      }
      reader.readAsDataURL(file)
    })
  }

  function buildRdoPayload() {
    const w = climaToWeather(condicao)
    return {
      title: `RDO Compizzo${obra ? ' — ' + obra : ''}`,
      date: data || today,
      responsible: respNome || responsavel || '',
      weather: { morning: w, afternoon: w, night: w, temperatureC: 0 },
      manpower: { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0, employeeNames },
      equipment: equipment.map((e) => ({ ...e, id: crypto.randomUUID() })),
      services: [],
      trechos: [],
      geolocation: null,
      observations: observacoes,
      incidents: '',
      photos,
      template: 'compizzo' as const,
      compizzo: buildCompizzo(),
    }
  }

  function handleSave() {
    addRdo(buildRdoPayload())
    setSaved(true)
    setTimeout(() => setActiveTab('historico'), 900)
  }

  function handlePrint() {
    const now = new Date().toISOString()
    printCompizzoPdf({
      id: 'preview', number: 0, createdAt: now, updatedAt: now,
      ...buildRdoPayload(),
    })
  }

  const totalColab = employeeNames.length

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#1f6fd1]/15">
            <ClipboardList size={18} className="text-[#1f6fd1]" />
          </div>
          <div>
            <h2 className="text-[#f5f5f5] font-semibold text-base flex items-center gap-2">RDO <CompizzoWordmark /></h2>
            <p className="text-[#6b6b6b] text-xs">Diário de Obra — demarcação e pintura de piso industrial</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowText(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#f97316]/40 transition-colors">
            <ScanText size={14} /> Preencher com Texto
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#f97316]/40 transition-colors">
            <Printer size={14} /> Imprimir / PDF
          </button>
          <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors">
            {saved ? <CheckCircle2 size={14} /> : <Save size={14} />} {saved ? 'Salvo!' : 'Salvar RDO'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Informações Gerais */}
        <Section title="Informações Gerais" icon={<FileText size={16} className="text-[#1f6fd1]" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Obra</label>
              <input className={inputCls} value={obra} onChange={(e) => setObra(e.target.value)} placeholder="Demarcação e Pintura de Piso Industrial – Ambev Sousa/PB" />
            </div>
            <div><label className={labelCls}>Data</label><input type="date" className={inputCls} value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><label className={labelCls}>Dia da Obra</label><input className={inputCls} value={diaObra} onChange={(e) => setDiaObra(e.target.value)} placeholder="03" /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Responsável</label><input className={inputCls} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Pedro Augusto - Arquiteto" /></div>
          </div>
          <div className="mt-3">
            <label className={labelCls}>Condições Climáticas</label>
            <div className="flex flex-wrap gap-2">
              {([['sol', 'Sol', Sun], ['nublado', 'Nublado', Cloud], ['chuva', 'Chuva', CloudRain], ['outros', 'Outros', Cloud]] as const).map(([val, lbl, Icon]) => (
                <button key={val} type="button" onClick={() => setCondicao(val)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${condicao === val ? 'bg-[#1f6fd1] text-white border-[#1f6fd1]' : 'bg-transparent text-[#a3a3a3] border-[#525252] hover:text-[#f5f5f5]'}`}>
                  <Icon size={13} /> {lbl}
                </button>
              ))}
              {condicao === 'outros' && (
                <input className={`${inputCls} max-w-[180px]`} value={condicaoOutros} onChange={(e) => setCondicaoOutros(e.target.value)} placeholder="Especifique" />
              )}
            </div>
          </div>
        </Section>

        {/* Mão de Obra */}
        <Section title={`Mão de Obra (${totalColab})`} icon={<FileText size={16} className="text-[#1f6fd1]" />}>
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={employeeInput}
              onChange={(e) => setEmployeeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = employeeInput.trim(); if (v) setEmployeeNames((p) => [...p, v]); setEmployeeInput('') } }}
              placeholder="Nome do colaborador (Enter para adicionar)"
            />
            <button type="button" onClick={() => { const v = employeeInput.trim(); if (v) setEmployeeNames((p) => [...p, v]); setEmployeeInput('') }} className="px-3 rounded-lg bg-[#1f6fd1] text-white"><Plus size={15} /></button>
          </div>
          {employeeNames.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {employeeNames.map((nme, i) => (
                <span key={`${nme}-${i}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3d3d3d] text-[#f5f5f5] text-xs">
                  {nme}
                  <button onClick={() => setEmployeeNames((p) => p.filter((_, idx) => idx !== i))} className="text-[#6b6b6b] hover:text-[#ef4444]"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* Serviços Executados */}
        <Section title="Serviços Executados no Dia" icon={<CheckCircle2 size={16} className="text-[#1f6fd1]" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {SERVICO_ITEMS.map(([key, lbl]) => (
              <Checkbox key={key} checked={servicos[key]} label={lbl} onChange={(v) => setServicos((s) => ({ ...s, [key]: v }))} />
            ))}
          </div>
          <div className="mt-3">
            <label className={labelCls}>Descrição dos serviços executados</label>
            <textarea rows={2} className={inputCls} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Foi dado início ao serviço com a demarcação do piso." />
          </div>
        </Section>

        {/* Produção do Dia */}
        <Section title="Produção do Dia" icon={<ClipboardList size={16} className="text-[#1f6fd1]" />}>
          <EditableRows
            rows={producao}
            cols={[['servico', 'Serviço'], ['quantidade', 'Quantidade']]}
            onChange={setProducao}
            makeEmpty={() => ({ servico: '', quantidade: '' })}
          />
        </Section>

        {/* Materiais */}
        <Section title="Materiais Utilizados" icon={<ClipboardList size={16} className="text-[#1f6fd1]" />}>
          <EditableRows
            rows={materiais}
            cols={[['material', 'Material'], ['quantidade', 'Quantidade']]}
            onChange={setMateriais}
            makeEmpty={() => ({ material: '', quantidade: '' })}
          />
        </Section>

        {/* Equipamentos */}
        <Section title="Equipamentos" icon={<Wrench size={16} className="text-[#1f6fd1]" />}>
          {equipment.length === 0 && <p className="text-[#6b6b6b] text-sm italic">Nenhum equipamento adicionado.</p>}
          <div className="space-y-2">
            {equipment.map((row, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_90px_32px] gap-2 items-end">
                <div><label className={labelCls}>Equipamento</label><input className={inputCls} value={row.name} onChange={(e) => setEquipment((eq) => eq.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))} placeholder="Ex.: Maçarico, compactador" /></div>
                <div><label className={labelCls}>Qtd.</label><input type="number" min={0} className={inputCls} value={row.quantity} onChange={(e) => setEquipment((eq) => eq.map((r, idx) => idx === i ? { ...r, quantity: Number(e.target.value) } : r))} /></div>
                <div><label className={labelCls}>Horas</label><input type="number" min={0} step={0.5} className={inputCls} value={row.hours} onChange={(e) => setEquipment((eq) => eq.map((r, idx) => idx === i ? { ...r, hours: Number(e.target.value) } : r))} /></div>
                <button type="button" onClick={() => setEquipment((eq) => eq.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 p-2"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setEquipment((eq) => [...eq, { name: '', quantity: 1, hours: 0 }])} className="flex items-center gap-1.5 text-[#1f6fd1] hover:text-[#1a5cb0] text-sm mt-2"><Plus size={14} /> Adicionar Equipamento</button>
        </Section>

        {/* Ocorrências */}
        <Section title="Ocorrências" icon={<CheckCircle2 size={16} className="text-[#1f6fd1]" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {OCORRENCIA_ITEMS.map(([key, lbl]) => (
              <Checkbox key={key} checked={ocorrencias[key]} label={lbl} onChange={(v) => setOcorrencias((o) => ({ ...o, [key]: v }))} />
            ))}
          </div>
          <div className="mt-3">
            <label className={labelCls}>Observações</label>
            <textarea rows={4} className={inputCls} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Descreva as ocorrências do dia..." />
          </div>
        </Section>

        {/* Registro Fotográfico */}
        <Section title={`Registro Fotográfico (${photos.length})`} icon={<Camera size={16} className="text-[#1f6fd1]" />}>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotos(e.target.files)} />
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-[#1f6fd1] hover:text-[#1a5cb0] text-sm"><Plus size={14} /> Adicionar Fotos</button>
          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              {photos.map((p, i) => (
                <div key={p.id} className="relative group">
                  <img src={p.base64} alt={p.label} className="w-full h-24 object-cover rounded-lg border border-[#525252]" />
                  <button onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/60 rounded p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Planejamento próximo dia */}
        <Section title="Planejamento para o Próximo Dia" icon={<ClipboardList size={16} className="text-[#1f6fd1]" />}>
          <textarea rows={3} className={inputCls} value={planejamento} onChange={(e) => setPlanejamento(e.target.value)} placeholder="Dar continuidade aos serviços de demarcação nas áreas já liberadas..." />
        </Section>

        {/* Responsável pela Obra */}
        <Section title="Responsável pela Obra" icon={<FileText size={16} className="text-[#1f6fd1]" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Nome</label><input className={inputCls} value={respNome} onChange={(e) => setRespNome(e.target.value)} placeholder="Pedro Augusto Marques Pereira" /></div>
            <div><label className={labelCls}>Data</label><input type="date" className={inputCls} value={respData} onChange={(e) => setRespData(e.target.value)} /></div>
          </div>
        </Section>
      </div>

      {/* Modal: Preencher com Texto */}
      {showText && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }} onClick={(e) => { if (e.target === e.currentTarget) setShowText(false) }}>
          <div className="w-full max-w-2xl rounded-2xl border border-[#525252] bg-[#333333] shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
              <h3 className="text-[#f5f5f5] font-bold text-sm flex items-center gap-2"><ScanText size={16} className="text-[#1f6fd1]" /> Preencher com Texto</h3>
              <button onClick={() => setShowText(false)} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={16} /></button>
            </div>
            <div className="p-5 overflow-y-auto">
              <p className="text-xs text-[#a3a3a3] mb-2">Cole o texto do Diário de Obra (formato Compizzo). Os checkboxes, tabelas e textos serão preenchidos automaticamente. Campos do Novo RDO (mão de obra) também são reconhecidos.</p>
              <textarea rows={12} className={inputCls} value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder={'Obra: ...\nData: 03/06/2026\nDia da Obra: 03\n...\n2. SERVIÇOS EXECUTADOS NO DIA\nx Preparação do piso\n...'} />
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#525252]">
              <button onClick={() => setShowText(false)} className="px-3 py-1.5 rounded-lg border border-[#525252] text-xs text-[#a3a3a3] hover:text-[#f5f5f5]">Cancelar</button>
              <button onClick={handleApplyText} disabled={!textValue.trim()} className="px-4 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c] disabled:opacity-50">Analisar e preencher</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Subcomponents ──────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#525252] bg-[#333333] p-4">
      <h3 className="flex items-center gap-2 text-[#f5f5f5] font-semibold text-sm mb-3">{icon}{title}</h3>
      {children}
    </section>
  )
}

function Checkbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm text-[#f5f5f5] hover:bg-[#3d3d3d] transition-colors">
      <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? 'bg-[#1f6fd1] border-[#1f6fd1]' : 'border-[#6b6b6b]'}`}>
        {checked && <CheckCircle2 size={11} className="text-white" />}
      </span>
      {label}
    </button>
  )
}

function EditableRows<T extends Record<string, string>>({
  rows, cols, onChange, makeEmpty,
}: { rows: T[]; cols: Array<[keyof T, string]>; onChange: (rows: T[]) => void; makeEmpty: () => T }) {
  return (
    <div className="space-y-2">
      <div className="hidden sm:grid gap-2 px-1" style={{ gridTemplateColumns: `${cols.map(() => '1fr').join(' ')} 32px` }}>
        {cols.map(([, lbl]) => <span key={String(lbl)} className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">{lbl}</span>)}
        <span />
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid gap-2" style={{ gridTemplateColumns: `${cols.map(() => '1fr').join(' ')} 32px` }}>
          {cols.map(([field, lbl]) => (
            <input
              key={String(field)}
              className={inputCls}
              value={row[field]}
              placeholder={lbl}
              onChange={(e) => onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: e.target.value } : r))}
            />
          ))}
          <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 flex items-center justify-center"><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, makeEmpty()])} className="flex items-center gap-1.5 text-[#1f6fd1] hover:text-[#1a5cb0] text-sm"><Plus size={14} /> Adicionar linha</button>
    </div>
  )
}
