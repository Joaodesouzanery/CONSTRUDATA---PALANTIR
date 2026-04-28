import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  ChevronRight,
  FileWarning,
  Printer,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { useQualidadeStore } from '@/store/qualidadeStore'
import { printFvsPDF } from '../utils/fvsPdfExport'
import { printQualityNonConformityPDF } from '../utils/nonConformityPdfExport'
import type { FVS, FvsConformity, QualityNonConformity } from '@/types'

type HistoryItem =
  | { type: 'fvs'; id: string; date: string; fvs: FVS }
  | { type: 'nc'; id: string; date: string; nc: QualityNonConformity }

function fmtDate(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

function conformityBadge(c: FvsConformity) {
  if (c === 'conforme') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-900/50 text-emerald-300">Conforme</span>
  if (c === 'nao_conforme') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-900/50 text-red-300">Não Conforme</span>
  if (c === 'reinspecao_ok') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-900/50 text-blue-300">Reinsp. OK</span>
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3a3a3a] text-[#a3a3a3]">—</span>
}

function statusBadge(status: QualityNonConformity['status']) {
  const styles = {
    aberta: 'bg-red-900/50 text-red-300',
    em_tratamento: 'bg-amber-900/50 text-amber-300',
    concluida: 'bg-emerald-900/50 text-emerald-300',
    ineficaz: 'bg-purple-900/50 text-purple-300',
  }
  const labels = {
    aberta: 'Aberta',
    em_tratamento: 'Em tratamento',
    concluida: 'Concluída',
    ineficaz: 'Ineficaz',
  }
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${styles[status]}`}>{labels[status]}</span>
}

function summary(f: FVS) {
  const conformes = f.items.filter((i) => i.conformity === 'conforme').length
  const naoConformes = f.items.filter((i) => i.conformity === 'nao_conforme').length
  const reinspecao = f.items.filter((i) => i.conformity === 'reinspecao_ok').length
  return { conformes, naoConformes, reinspecao, total: f.items.length }
}

export function HistoricoPanel() {
  const { fvss, nonConformities, removeFvs, removeNonConformity, updateNonConformity } = useQualidadeStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [photoTarget, setPhotoTarget] = useState<{ ncId: string; index: number | null } | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const items = useMemo<HistoryItem[]>(() => {
    const term = searchTerm.toLowerCase()
    const all: HistoryItem[] = [
      ...fvss.map((fvs) => ({ type: 'fvs' as const, id: `fvs-${fvs.id}`, date: fvs.date, fvs })),
      ...nonConformities.map((nc) => ({ type: 'nc' as const, id: `nc-${nc.id}`, date: nc.date, nc })),
    ]

    return all
      .filter((item) => {
        const matchesDate = !dateFilter || item.date.startsWith(dateFilter)
        if (!matchesDate) return false
        if (!term) return true

        if (item.type === 'fvs') {
          const f = item.fvs
          return [
            f.responsibleLeader,
            f.identificationNo,
            f.contractNo,
            f.ncNumber,
          ].some((value) => value.toLowerCase().includes(term))
        }

        const nc = item.nc
        return [
          nc.ncNumber,
          nc.location,
          nc.local,
          nc.company,
          nc.openedBy,
          nc.description,
          nc.actionResponsible,
        ].some((value) => value.toLowerCase().includes(term))
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [fvss, nonConformities, searchTerm, dateFilter])

  const total = fvss.length + nonConformities.length

  function handleDelete(item: HistoryItem) {
    if (item.type === 'fvs') removeFvs(item.fvs.id)
    else removeNonConformity(item.nc.id)
    setDeleteConfirm(null)
  }

  function readEvidencePhoto(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function openEvidencePicker(ncId: string, index: number | null = null) {
    setPhotoTarget({ ncId, index })
    window.setTimeout(() => photoInputRef.current?.click(), 0)
  }

  async function handleEvidenceChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (!photoTarget || files.length === 0) return

    const nc = nonConformities.find((item) => item.id === photoTarget.ncId)
    if (!nc) return

    const maxFiles = photoTarget.index === null ? Math.max(0, 12 - nc.evidencePhotos.length) : 1
    const photos = await Promise.all(files.slice(0, maxFiles).map(readEvidencePhoto))
    if (photos.length === 0) return

    const nextPhotos = [...nc.evidencePhotos]
    if (photoTarget.index === null) nextPhotos.push(...photos)
    else nextPhotos[photoTarget.index] = photos[0]

    updateNonConformity(nc.id, { evidencePhotos: nextPhotos })
    setPhotoTarget(null)
    event.target.value = ''
  }

  function removeEvidencePhoto(nc: QualityNonConformity, index: number) {
    updateNonConformity(nc.id, {
      evidencePhotos: nc.evidencePhotos.filter((_, photoIndex) => photoIndex !== index),
    })
  }

  return (
    <div className="p-6 space-y-4">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple={photoTarget?.index === null}
        onChange={handleEvidenceChange}
        className="hidden"
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar FVS, NC, responsável, contrato ou localização..."
            className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg pl-10 pr-3 py-2 text-sm text-[#f5f5f5] placeholder-[#a3a3a3] focus:outline-none focus:border-[#f97316]"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
        />
        {dateFilter && (
          <button
            onClick={() => setDateFilter('')}
            className="text-[#a3a3a3] hover:text-white text-sm flex items-center gap-1"
          >
            <X size={14} /> Limpar data
          </button>
        )}
        <span className="text-xs text-[#a3a3a3] ml-auto">
          {items.length} de {total} registros
        </span>
      </div>

      {items.length === 0 ? (
        <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-10 text-center">
          <ShieldCheck size={32} className="text-[#525252] mx-auto mb-3" />
          <p className="text-[#a3a3a3]">Nenhum registro de qualidade encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isExpanded = expandedId === item.id
            const isDeleting = deleteConfirm === item.id

            if (item.type === 'nc') {
              const nc = item.nc
              return (
                <div key={item.id} className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 p-4 flex-wrap">
                    <button onClick={() => setExpandedId(isExpanded ? null : item.id)} className="text-[#a3a3a3] hover:text-white">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-900/40 text-red-300 flex items-center gap-1">
                      <FileWarning size={12} /> Não Conformidade
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f97316]/15 text-[#f97316]">NC {nc.ncNumber}</span>
                    {statusBadge(nc.status)}

                    <div className="flex-1 min-w-[190px]">
                      <div className="text-white text-sm font-semibold truncate">{nc.location || nc.local || 'Sem localização'}</div>
                      <div className="text-[#a3a3a3] text-xs">
                        {fmtDate(nc.date)} · {nc.openedBy || '—'} · {nc.company || '—'}
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#3a3a3a] text-[#d4d4d4] flex items-center gap-1">
                      <Camera size={11} /> {nc.evidencePhotos.length} evidências
                    </span>

                    <button
                      type="button"
                      onClick={() => openEvidencePicker(nc.id)}
                      disabled={nc.evidencePhotos.length >= 12}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#484848] hover:bg-[#525252] disabled:cursor-not-allowed disabled:opacity-50 text-[#f5f5f5] rounded-lg text-xs font-medium transition-colors"
                      title={nc.evidencePhotos.length >= 12 ? 'Limite de 12 evidências atingido' : 'Adicionar evidências'}
                    >
                      <Camera size={13} /> Fotos
                    </button>

                    <button
                      onClick={() => printQualityNonConformityPDF(nc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-lg text-xs font-medium transition-colors"
                      title="Imprimir / Exportar PDF"
                    >
                      <Printer size={13} /> PDF
                    </button>

                    {isDeleting ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(item)} className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium">Confirmar</button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-2.5 py-1.5 bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] rounded-lg text-xs font-medium">Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(item.id)} className="p-1.5 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-[#525252] bg-[#1f1f1f] p-5 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div><span className="text-[#a3a3a3]">Eng. responsável:</span> <span className="text-[#f5f5f5]">{nc.engineerResponsible || '—'}</span></div>
                        <div><span className="text-[#a3a3a3]">LV Nº:</span> <span className="text-[#f5f5f5]">{nc.lvNumber || 'NA'}</span></div>
                        <div><span className="text-[#a3a3a3]">Prazo:</span> <span className="text-[#f5f5f5]">{fmtDate(nc.deadline)}</span></div>
                      </div>
                      <div className="bg-[#2c2c2c] rounded-lg p-3 border-l-2 border-red-400">
                        <div className="text-sm text-[#f5f5f5] whitespace-pre-wrap"><strong>Descrição:</strong> {nc.description}</div>
                        <div className="text-sm text-[#e5e5e5] mt-2 whitespace-pre-wrap"><strong>Ação imediata:</strong> {nc.immediateAction || '—'}</div>
                        <div className="text-sm text-[#e5e5e5] mt-2 whitespace-pre-wrap"><strong>Ação corretiva:</strong> {nc.correctiveAction || '—'}</div>
                        <div className="text-sm text-[#e5e5e5] mt-2"><strong>Avaliação:</strong> {nc.effectivenessResponsible || '—'} · {fmtDate(nc.effectivenessDate)}</div>
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h4 className="text-xs uppercase tracking-wider text-[#a3a3a3] font-bold">Evidências</h4>
                          <button
                            type="button"
                            onClick={() => openEvidencePicker(nc.id)}
                            disabled={nc.evidencePhotos.length >= 12}
                            className="px-3 py-1.5 rounded-lg bg-[#484848] hover:bg-[#525252] disabled:cursor-not-allowed disabled:opacity-50 text-[#f5f5f5] text-xs font-medium transition-colors"
                          >
                            Adicionar
                          </button>
                        </div>
                        {nc.evidencePhotos.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {nc.evidencePhotos.map((src, idx) => (
                              <div key={idx} className="group relative overflow-hidden rounded-lg border border-[#525252] bg-[#2c2c2c]">
                                <img src={src} alt={`Evidência ${idx + 1}`} className="aspect-square w-full object-cover" />
                                <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-black/70 p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => openEvidencePicker(nc.id, idx)}
                                    className="flex-1 rounded bg-[#f97316] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#ea580c]"
                                  >
                                    Trocar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeEvidencePhoto(nc, idx)}
                                    className="flex-1 rounded bg-red-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-500"
                                  >
                                    Remover
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-[#525252] bg-[#2c2c2c] p-4 text-center text-sm text-[#a3a3a3]">
                            Nenhuma evidência cadastrada.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            }

            const f = item.fvs
            const s = summary(f)
            return (
              <div key={item.id} className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 p-4 flex-wrap">
                  <button onClick={() => setExpandedId(isExpanded ? null : item.id)} className="text-[#a3a3a3] hover:text-white">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#f97316]/15 text-[#f97316]">FVS #{f.number}</span>
                  {f.ncRequired && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-900/50 text-red-300 flex items-center gap-1">
                      <FileWarning size={11} /> {f.ncNumber || 'NC'}
                    </span>
                  )}
                  <div className="flex-1 min-w-[170px]">
                    <div className="text-white text-sm font-semibold truncate">{f.identificationNo}</div>
                    <div className="text-[#a3a3a3] text-xs">
                      {f.responsibleLeader || '—'} · Contrato {f.contractNo} · {fmtDate(f.date)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-emerald-400 font-bold" title="Conformes">{s.conformes}</span>
                    <span className="text-[#a3a3a3]">/</span>
                    <span className="text-red-400 font-bold" title="Não conformes">{s.naoConformes}</span>
                    <span className="text-[#a3a3a3]">/</span>
                    <span className="text-blue-400 font-bold" title="Reinspeção OK">{s.reinspecao}</span>
                  </div>
                  <button onClick={() => printFvsPDF(f)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-lg text-xs font-medium transition-colors" title="Imprimir / Exportar PDF">
                    <Printer size={13} /> PDF
                  </button>
                  {isDeleting ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(item)} className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium">Confirmar</button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2.5 py-1.5 bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] rounded-lg text-xs font-medium">Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(item.id)} className="p-1.5 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-[#525252] bg-[#1f1f1f] p-5 space-y-4">
                    <div>
                      <h4 className="text-xs uppercase tracking-wider text-[#a3a3a3] font-bold mb-2">Itens da FVS</h4>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[#a3a3a3] border-b border-[#525252]">
                            <th className="text-left py-1 px-2 w-10">Item</th>
                            <th className="text-left py-1 px-2">Verificação</th>
                            <th className="text-left py-1 px-2">Critérios</th>
                            <th className="text-center py-1 px-2 w-32">Conformidade</th>
                            <th className="text-left py-1 px-2 w-24">Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {f.items.map((i) => (
                            <tr key={i.id} className="border-b border-[#3a3a3a]">
                              <td className="py-1.5 px-2 text-[#a3a3a3] font-bold">{i.number}</td>
                              <td className="py-1.5 px-2 text-[#f5f5f5]">{i.description}</td>
                              <td className="py-1.5 px-2 text-[#a3a3a3]">{i.criteria || '—'}</td>
                              <td className="py-1.5 px-2 text-center">{conformityBadge(i.conformity)}</td>
                              <td className="py-1.5 px-2 text-[#a3a3a3]">{fmtDate(i.date ?? '')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {f.problems.length > 0 && (
                      <div>
                        <h4 className="text-xs uppercase tracking-wider text-[#a3a3a3] font-bold mb-2 flex items-center gap-1.5">
                          <AlertTriangle size={12} className="text-[#f97316]" /> Problemas e Ações
                        </h4>
                        <div className="space-y-2">
                          {f.problems.map((p) => (
                            <div key={p.id} className="bg-[#2c2c2c] rounded-lg p-3 border-l-2 border-[#f97316]">
                              <div className="text-xs text-[#a3a3a3] mb-1">Item {p.itemNumber}</div>
                              <div className="text-sm text-[#f5f5f5] mb-1"><strong>Problema:</strong> {p.description}</div>
                              <div className="text-sm text-[#e5e5e5]"><strong>Ação:</strong> {p.action}</div>
                              {(p.photos ?? []).length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-3">
                                  {(p.photos ?? []).map((src, idx) => (
                                    <img key={idx} src={src} alt={`Foto do problema ${idx + 1}`} className="aspect-square w-full object-cover rounded-lg border border-[#525252]" />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-[#a3a3a3]">Líder Responsável:</span> <span className="text-[#f5f5f5] font-medium">{f.responsibleLeader || '—'}</span></div>
                      <div><span className="text-[#a3a3a3]">Nº Rastreio da Solda:</span> <span className="text-[#f5f5f5] font-medium">{f.weldTrackingNo || '—'}</span></div>
                      <div><span className="text-[#a3a3a3]">Assinatura Soldador:</span> <span className="text-[#f5f5f5] font-medium">{f.welderSignature || '—'}</span></div>
                      <div><span className="text-[#a3a3a3]">Assinatura Resp. Qualidade:</span> <span className="text-[#f5f5f5] font-medium">{f.qualitySignature || '—'}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
