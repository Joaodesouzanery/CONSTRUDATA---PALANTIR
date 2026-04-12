/**
 * CriteriosMedicaoPanel — Step 2: Critérios de Medição.
 *
 * Search, view and add Sabesp measurement criteria by service code or description.
 */
import { useState, useCallback, useRef } from 'react'
import { Search, BookOpen, Plus, Trash2, X as XIcon, Upload, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { searchCriterios, getAllCriterios, addCustomCriterio, removeCustomCriterio, isCustomCriterio } from '../data/criterios'
import type { CriterioMedicao } from '../data/criterios'
import { parseCriterioPdf } from '../utils/criterioPdfParser'

const GRUPO_COLORS: Record<string, string> = {
  '01': 'text-amber-400 bg-amber-400/10 border-amber-500/30',
  '02': 'text-blue-400 bg-blue-400/10 border-blue-500/30',
  '03': 'text-cyan-400 bg-cyan-400/10 border-cyan-500/30',
}

function AddCriterioModal({ onClose, onAdd }: { onClose: () => void; onAdd: (c: CriterioMedicao) => void }) {
  const [nPreco, setNPreco] = useState('')
  const [descricao, setDescricao] = useState('')
  const [unidade, setUnidade] = useState('UN')
  const [grupo, setGrupo] = useState<'01' | '02' | '03'>('03')
  const [compreende, setCompreende] = useState('')
  const [medicao, setMedicao] = useState('')
  const [notas, setNotas] = useState('')

  const grupoNomes: Record<string, string> = { '01': 'Canteiros e Planos', '02': 'Esgoto', '03': 'Água' }

  function handleSubmit() {
    if (!nPreco.trim() || !descricao.trim()) return
    onAdd({
      nPreco: nPreco.trim(),
      descricao: descricao.trim(),
      unidade: unidade.trim() || 'UN',
      grupo,
      grupoNome: grupoNomes[grupo],
      compreende: compreende.trim(),
      medicao: medicao.trim(),
      notas: notas.trim(),
    })
    onClose()
  }

  const inputCls = 'w-full bg-[#1f1f1f] border border-[#525252] rounded px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]'
  const labelCls = 'text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252] flex items-center justify-between">
          <span className="text-white font-semibold text-sm">Adicionar Critério de Medição</span>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-white"><XIcon size={16} /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Nº Preço</label>
              <input value={nPreco} onChange={(e) => setNPreco(e.target.value)} placeholder="ex.: 410002" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Unidade</label>
              <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="UN" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Grupo</label>
              <select value={grupo} onChange={(e) => setGrupo(e.target.value as '01' | '02' | '03')} className={inputCls}>
                <option value="01">01 — Canteiros e Planos</option>
                <option value="02">02 — Esgoto</option>
                <option value="03">03 — Água</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Descrição</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do serviço" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Compreende</label>
            <textarea value={compreende} onChange={(e) => setCompreende(e.target.value)} placeholder="O que o serviço compreende..." rows={4} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Medição</label>
            <textarea value={medicao} onChange={(e) => setMedicao(e.target.value)} placeholder="Como será medido..." rows={2} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Notas</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas adicionais (opcional)" rows={2} className={inputCls} />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[#525252] flex justify-end gap-2 bg-[#1f1f1f]">
          <button onClick={onClose} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={!nPreco.trim() || !descricao.trim()}
            className="px-5 py-2 text-xs font-medium text-white rounded-lg disabled:opacity-50 transition-colors" style={{ backgroundColor: '#f97316' }}>
            Salvar Critério
          </button>
        </div>
      </div>
    </div>
  )
}

/** Download empty template XLSX for criteria import */
function downloadTemplateCriterios() {
  const template = [{
    'N. Preço': '500001',
    'Descrição': 'CANTEIRO DE OBRAS - IMPLANTAÇÃO',
    'Unidade': 'GB',
    'Grupo': '01',
    'Compreende': 'Disponibilização de imóvel e/ou construção de escritórios, vestiários...',
    'Medição': 'Pelo preço global: 90% após conclusão; 10% após desmobilização.',
    'Notas': 'Canteiro conforme NR-18.',
  }]
  const ws = XLSX.utils.json_to_sheet(template)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template Critérios')
  XLSX.writeFile(wb, 'Template_Criterios_Medicao_ConstruData.xlsx')
}

/** Parse an XLSX/CSV file containing Sabesp measurement criteria */
function parseCriteriosXlsx(wb: XLSX.WorkBook): { items: CriterioMedicao[]; errors: string[] } {
  const items: CriterioMedicao[] = []
  const errors: string[] = []

  const sheetName = wb.SheetNames[0]
  if (!sheetName) { errors.push('Planilha vazia.'); return { items, errors } }

  const raw: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false }) as unknown[][]
  if (raw.length < 2) { errors.push('Planilha sem dados.'); return { items, errors } }

  const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

  // Find header row
  let headerIdx = -1
  for (let i = 0; i < Math.min(raw.length, 15); i++) {
    const rowStr = raw[i].map(norm).join(' ')
    if (/n[\s.]*preco/.test(rowStr) && /descri/.test(rowStr)) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    errors.push('Cabeçalho não encontrado. A planilha deve ter colunas: N. Preço, Descrição, Unidade, Compreende, Medição, Notas.')
    return { items, errors }
  }

  const headers = raw[headerIdx].map(norm)
  const find = (keywords: string[]) => headers.findIndex(h => keywords.some(kw => h.includes(kw)))

  const iNPreco = find(['n preco', 'npreco', 'numero', 'codigo'])
  const iDesc = find(['descri', 'servico'])
  const iUnid = find(['unid', 'un'])
  const iCompr = find(['compreende', 'compreen'])
  const iMed = find(['medicao', 'medic'])
  const iNotas = find(['nota', 'observ'])
  const iGrupo = find(['grupo'])

  if (iNPreco === -1 || iDesc === -1) {
    errors.push('Colunas obrigatórias não encontradas: N. Preço e Descrição.')
    return { items, errors }
  }

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i]
    const nPreco = String(row[iNPreco] ?? '').trim()
    const descricao = String(row[iDesc] ?? '').trim()
    if (!nPreco || !descricao) continue
    if (!/^\d+$/.test(nPreco.replace(/\s/g, ''))) continue

    const grupoRaw = iGrupo >= 0 ? String(row[iGrupo] ?? '').trim() : ''
    let grupo: '01' | '02' | '03' = '03'
    let grupoNome = 'Água'
    if (grupoRaw === '01' || /canteiro|plano/i.test(descricao)) { grupo = '01'; grupoNome = 'Canteiros e Planos' }
    else if (grupoRaw === '02' || /esgoto|rede colet/i.test(descricao)) { grupo = '02'; grupoNome = 'Esgoto' }
    else if (grupoRaw === '03' || /agua|abastec/i.test(descricao)) { grupo = '03'; grupoNome = 'Água' }

    items.push({
      nPreco: nPreco.replace(/\s/g, ''),
      descricao,
      unidade: iUnid >= 0 ? String(row[iUnid] ?? 'UN').trim() || 'UN' : 'UN',
      grupo,
      grupoNome,
      compreende: iCompr >= 0 ? String(row[iCompr] ?? '').trim() : '',
      medicao: iMed >= 0 ? String(row[iMed] ?? '').trim() : '',
      notas: iNotas >= 0 ? String(row[iNotas] ?? '').trim() : '',
    })
  }

  if (items.length === 0) errors.push('Nenhum critério válido encontrado na planilha.')
  return { items, errors }
}

export function CriteriosMedicaoPanel() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [ver, setVer] = useState(0) // force re-render after add/remove
  const [importPreview, setImportPreview] = useState<{ items: CriterioMedicao[]; errors: string[] } | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const results = searchCriterios(query)
  const allCriterios = getAllCriterios()
  const selectedCrit = allCriterios.find((c) => c.nPreco === selected)

  const handleAdd = useCallback((c: CriterioMedicao) => {
    addCustomCriterio(c)
    setSelected(c.nPreco)
    setVer((v) => v + 1)
  }, [])

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportLoading(true)
    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        // PDF import using pdfjs-dist
        setImportPreview(await parseCriterioPdf(file))
      } else {
        // XLSX/CSV import
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        setImportPreview(parseCriteriosXlsx(wb))
      }
    } catch (err) {
      setImportPreview({ items: [], errors: [`Erro ao ler arquivo: ${err instanceof Error ? err.message : 'formato inválido'}`] })
    } finally {
      setImportLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function handleConfirmImport() {
    if (!importPreview) return
    for (const c of importPreview.items) addCustomCriterio(c)
    setImportPreview(null)
    setVer((v) => v + 1)
  }

  const handleRemove = useCallback((nPreco: string) => {
    removeCustomCriterio(nPreco)
    if (selected === nPreco) setSelected(null)
    setVer((v) => v + 1)
  }, [selected])

  // suppress unused var warning
  void ver

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left — search + list */}
      <div className="w-72 shrink-0 flex flex-col border-r border-[#525252] bg-[#1f1f1f]">
        <div className="p-3 border-b border-[#525252]">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por código ou descrição…"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg pl-8 pr-3 py-2 text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]"
            />
          </div>
          <div className="text-[10px] text-[#6b6b6b] mt-1.5">{results.length} critérios</div>
          <div className="flex flex-col gap-1.5 mt-2">
            <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
            <button onClick={() => fileRef.current?.click()} disabled={importLoading}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] disabled:opacity-50 transition-colors">
              <Upload size={13} />
              {importLoading ? 'Lendo...' : 'Importar PDF / XLSX / CSV'}
            </button>
            <button onClick={() => setAddOpen(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#f97316] border border-dashed border-[#f97316]/30 hover:bg-[#f97316]/10 transition-colors">
              <Plus size={13} /> Adicionar manualmente
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.nPreco}
              type="button"
              onClick={() => setSelected(c.nPreco)}
              className={`w-full text-left px-3 py-2.5 border-b border-[#2c2c2c] transition-colors ${
                selected === c.nPreco
                  ? 'bg-[#f97316]/10 border-l-2 border-l-[#f97316]'
                  : 'hover:bg-[#2c2c2c]'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${GRUPO_COLORS[c.grupo] ?? 'text-[#a3a3a3]'}`}>
                  {c.grupo}
                </span>
                <span className="font-mono text-xs text-[#f97316] font-bold">{c.nPreco}</span>
                <span className="text-[10px] text-[#a3a3a3]">{c.unidade}</span>
                {isCustomCriterio(c.nPreco) && (
                  <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">CUSTOM</span>
                )}
              </div>
              <div className="text-xs text-[#f5f5f5] leading-tight line-clamp-2">{c.descricao}</div>
            </button>
          ))}
          {results.length === 0 && (
            <div className="p-6 text-center text-xs text-[#6b6b6b] italic">
              Nenhum critério encontrado para "{query}"
            </div>
          )}
        </div>
      </div>

      {/* Right — detail view */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedCrit ? (
          <div className="max-w-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#f97316' }}>
                <BookOpen size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${GRUPO_COLORS[selectedCrit.grupo] ?? ''}`}>
                    Grupo {selectedCrit.grupo} — {selectedCrit.grupoNome}
                  </span>
                  <span className="text-xs text-[#a3a3a3] font-mono">{selectedCrit.nPreco}</span>
                  <span className="text-xs text-[#6b6b6b]">· {selectedCrit.unidade}</span>
                  {isCustomCriterio(selectedCrit.nPreco) && (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">ADICIONADO MANUALMENTE</span>
                  )}
                </div>
                <h2 className="text-white font-bold text-lg leading-snug">{selectedCrit.descricao}</h2>
              </div>
              {isCustomCriterio(selectedCrit.nPreco) && (
                <button onClick={() => handleRemove(selectedCrit.nPreco)} className="text-red-400 hover:bg-red-900/20 rounded p-2 transition-colors shrink-0" title="Remover critério">
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden divide-y divide-[#525252]">
              <div className="p-4">
                <div className="text-[10px] font-semibold uppercase text-[#f97316] tracking-widest mb-2">Compreende</div>
                <p className="text-[#e5e5e5] text-sm leading-relaxed">{selectedCrit.compreende}</p>
              </div>
              <div className="p-4">
                <div className="text-[10px] font-semibold uppercase text-[#f97316] tracking-widest mb-2">Medição</div>
                <p className="text-[#e5e5e5] text-sm leading-relaxed">{selectedCrit.medicao}</p>
              </div>
              {selectedCrit.notas && (
                <div className="p-4 bg-amber-900/10">
                  <div className="text-[10px] font-semibold uppercase text-amber-400 tracking-widest mb-2">Notas</div>
                  <p className="text-amber-200/80 text-sm leading-relaxed">{selectedCrit.notas}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <BookOpen size={40} className="text-[#525252] mb-4" />
            <p className="text-[#6b6b6b] text-sm">Selecione um código de serviço à esquerda para ver os critérios de medição.</p>
            <p className="text-[#6b6b6b] text-xs mt-1">
              {allCriterios.length} critérios disponíveis · Contrato 11481051
            </p>
            <div className="flex items-center gap-3 mt-4">
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-white transition-colors" style={{ backgroundColor: '#f97316' }}>
                <Upload size={14} /> Importar XLSX
              </button>
              <button onClick={() => setAddOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-[#f97316] border border-[#f97316]/30 hover:bg-[#f97316]/10 transition-colors">
                <Plus size={14} /> Adicionar manual
              </button>
              <button onClick={downloadTemplateCriterios}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-[#6b6b6b] border border-dashed border-[#525252] hover:text-[#f5f5f5] transition-colors">
                Template XLSX
              </button>
            </div>
          </div>
        )}
      </div>

      {addOpen && <AddCriterioModal onClose={() => setAddOpen(false)} onAdd={handleAdd} />}

      {/* Import preview modal */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setImportPreview(null)}>
          <div className="w-full max-w-xl bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252] flex items-center justify-between">
              <span className="text-white font-semibold text-sm">Importar Critérios de Medição</span>
              <button onClick={() => setImportPreview(null)} className="text-[#6b6b6b] hover:text-white"><XIcon size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              {importPreview.errors.length > 0 ? (
                <div className="flex items-start gap-2 text-red-400 text-xs bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <div>{importPreview.errors.join(' ')}</div>
                </div>
              ) : (
                <>
                  <p className="text-[#a3a3a3] text-xs">{importPreview.items.length} critérios encontrados. Serão adicionados ao catálogo como critérios customizados.</p>
                  <div className="overflow-x-auto max-h-56 border border-[#525252] rounded-lg">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#1f1f1f] text-[#6b6b6b] uppercase text-[9px]">
                          <th className="px-3 py-2 text-left">N. Preço</th>
                          <th className="px-3 py-2 text-left">Descrição</th>
                          <th className="px-3 py-2 text-center">Un</th>
                          <th className="px-3 py-2 text-center">Grupo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.items.slice(0, 8).map((c, i) => (
                          <tr key={i} className="border-t border-[#525252]">
                            <td className="px-3 py-1.5 font-mono text-[#f97316]">{c.nPreco}</td>
                            <td className="px-3 py-1.5 text-[#f5f5f5] max-w-[200px] truncate">{c.descricao}</td>
                            <td className="px-3 py-1.5 text-center text-[#a3a3a3]">{c.unidade}</td>
                            <td className="px-3 py-1.5 text-center text-[#a3a3a3]">{c.grupo}</td>
                          </tr>
                        ))}
                        {importPreview.items.length > 8 && (
                          <tr><td colSpan={4} className="px-3 py-2 text-center text-[#6b6b6b] text-[10px]">+ {importPreview.items.length - 8} critérios adicionais</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="px-5 py-3 border-t border-[#525252] flex justify-end gap-2 bg-[#1f1f1f]">
              <button onClick={() => setImportPreview(null)} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">Cancelar</button>
              {importPreview.errors.length === 0 && (
                <button onClick={handleConfirmImport}
                  className="px-5 py-2 text-xs font-medium text-white rounded-lg transition-colors" style={{ backgroundColor: '#f97316' }}>
                  Importar {importPreview.items.length} critérios
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
