/**
 * RdoSabespPanel.tsx — SABESP daily construction report form.
 * Matches the official SABESP RDO layout exactly.
 */
import { useState } from 'react'
import { Plus, Save, Trash2, CheckCircle2, Circle, FileText } from 'lucide-react'
import { useRdoStore } from '@/store/rdoStore'
import type {
  SabespRDO, SabespClimaRow, SabespMaoDeObraRow,
  SabespEquipamentoRow, SabespAtividadeRow,
} from '@/types'
import { OBRAS_LIST } from '@/types'

// ─── Pre-defined lists ───────────────────────────────────────────────────────

const MO_FUNCOES = [
  'Encarregado', 'Operador de Escavadeira', 'Motorista Caminhão',
  'Pedreiro', 'Servente', 'Técnico de Segurança', 'Topógrafo', 'Eletricista',
]

const EQUIPAMENTOS_LIST = [
  'Escavadeira Hidráulica', 'Retroescavadeira', 'Caminhão Basculante',
  'Compressor', 'Gerador', 'Bomba d\'Água', 'Nível Óptico', 'GPS',
]

const ATIVIDADES_LIST: Array<{ descricao: string; unidade: string }> = [
  { descricao: 'Escavação Manual',           unidade: 'm³' },
  { descricao: 'Escavação Mecânica',         unidade: 'm³' },
  { descricao: 'Assentamento de Tubos',      unidade: 'm'  },
  { descricao: 'Reaterro Compactado',        unidade: 'm³' },
  { descricao: 'Ligação Domiciliar',         unidade: 'un' },
  { descricao: 'Poço de Visita',             unidade: 'un' },
  { descricao: 'Caixa Coletora',             unidade: 'un' },
  { descricao: 'Pavimentação',               unidade: 'm²' },
  { descricao: 'Sinalização de Trânsito',    unidade: 'un' },
  { descricao: 'Serviço de Topografia',      unidade: 'h'  },
]

const CHECKLIST_ITEMS = [
  'EPI verificados',
  'Diário preenchido até 18h',
  'Fotos tiradas',
  'OS vinculada',
  'Trecho registrado',
  'RDO assinado',
]

// ─── Initial form state factory ───────────────────────────────────────────────

function makeDefaultForm(): Omit<SabespRDO, 'id' | 'createdAt'> {
  const today = new Date().toISOString().slice(0, 10)
  return {
    obra: OBRAS_LIST[0],
    data: today,
    horaInicial: '07:00',
    horaFinal: '17:00',
    epi: true,
    clima: [
      { periodo: 'Manhã',  bom: 0, chuva: 0, improdutivo: 0, paradoDias: 0, descontoDias: 0 },
      { periodo: 'Tarde',  bom: 0, chuva: 0, improdutivo: 0, paradoDias: 0, descontoDias: 0 },
      { periodo: 'Noite',  bom: 0, chuva: 0, improdutivo: 0, paradoDias: 0, descontoDias: 0 },
    ],
    prazoExecucaoDias: 0,
    movimentacaoMaterial: '',
    movimentacaoEquip: '',
    turno: 'Diurno',
    maoDeObra: MO_FUNCOES.map((f) => ({ funcao: f, turno1: 0, turno2: 0, total: 0 })),
    equipamentos: EQUIPAMENTOS_LIST.map((e) => ({ equipamento: e, quantidade: 0, horas: 0, observacao: '' })),
    atividades: ATIVIDADES_LIST.map((a) => ({ ...a, executado: false, quantidade: 0 })),
    observacoes: '',
    checklist: Object.fromEntries(CHECKLIST_ITEMS.map((k) => [k, false])),
    responsavelEmpreiteira: '',
    responsavelConsorcio: '',
  }
}

// ─── Helper: input class ─────────────────────────────────────────────────────

const inp = 'w-full bg-[#1a1a1a] border border-[#525252] rounded px-2 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50'
const numInp = 'w-16 bg-[#1a1a1a] border border-[#525252] rounded px-1.5 py-1 text-xs text-right text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50'

// ─── Main component ───────────────────────────────────────────────────────────

export function RdoSabespPanel() {
  const { sabespRdos, addSabespRdo, removeSabespRdo } = useRdoStore(
    (s) => ({ sabespRdos: s.sabespRdos, addSabespRdo: s.addSabespRdo, removeSabespRdo: s.removeSabespRdo })
  )

  const [form, setForm] = useState<Omit<SabespRDO, 'id' | 'createdAt'>>(makeDefaultForm)
  const [saved, setSaved] = useState(false)

  function patchForm(patch: Partial<typeof form>) {
    setSaved(false)
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function patchClima(idx: number, patch: Partial<SabespClimaRow>) {
    const updated = form.clima.map((r, i) => i === idx ? { ...r, ...patch } : r)
    patchForm({ clima: updated })
  }

  function patchMO(idx: number, patch: Partial<SabespMaoDeObraRow>) {
    const updated = form.maoDeObra.map((r, i) => {
      if (i !== idx) return r
      const merged = { ...r, ...patch }
      merged.total = (merged.turno1 || 0) + (merged.turno2 || 0)
      return merged
    })
    patchForm({ maoDeObra: updated })
  }

  function patchEquip(idx: number, patch: Partial<SabespEquipamentoRow>) {
    patchForm({ equipamentos: form.equipamentos.map((r, i) => i === idx ? { ...r, ...patch } : r) })
  }

  function patchAtiv(idx: number, patch: Partial<SabespAtividadeRow>) {
    patchForm({ atividades: form.atividades.map((r, i) => i === idx ? { ...r, ...patch } : r) })
  }

  function patchChecklist(key: string, val: boolean) {
    patchForm({ checklist: { ...form.checklist, [key]: val } })
  }

  function handleSave() {
    addSabespRdo(form)
    setSaved(true)
    setForm(makeDefaultForm())
  }

  function handleNew() {
    setForm(makeDefaultForm())
    setSaved(false)
  }

  const checklistDone = CHECKLIST_ITEMS.filter((k) => form.checklist[k]).length
  const checklistPct = Math.round((checklistDone / CHECKLIST_ITEMS.length) * 100)

  return (
    <div className="flex gap-4 h-full overflow-hidden p-4">

      {/* ── Form ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">

        {/* Section: Identificação */}
        <section className="bg-[#2c2c2c] rounded-lg border border-[#525252] overflow-hidden">
          <div className="px-4 py-2 bg-[#3d3d3d] border-b border-[#525252]">
            <span className="text-xs font-semibold text-[#f97316] uppercase tracking-wide">Identificação da Obra</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] text-[#6b6b6b] mb-1">OBRA</label>
              <select
                value={form.obra}
                onChange={(e) => patchForm({ obra: e.target.value })}
                className={inp}
              >
                {OBRAS_LIST.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#6b6b6b] mb-1">DATA</label>
              <input type="date" value={form.data} onChange={(e) => patchForm({ data: e.target.value })} className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-[#6b6b6b] mb-1">Hora Inicial</label>
                <input type="time" value={form.horaInicial} onChange={(e) => patchForm({ horaInicial: e.target.value })} className={inp} />
              </div>
              <div>
                <label className="block text-[10px] text-[#6b6b6b] mb-1">Hora Final</label>
                <input type="time" value={form.horaFinal} onChange={(e) => patchForm({ horaFinal: e.target.value })} className={inp} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-[#6b6b6b] mb-1">EPI</label>
              <div className="flex gap-2">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => patchForm({ epi: v })}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                      form.epi === v
                        ? v ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                        : 'bg-[#3d3d3d] text-[#a3a3a3] hover:bg-[#525252]'
                    }`}
                  >
                    {v ? 'SIM' : 'NÃO'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-[#6b6b6b] mb-1">Turno</label>
              <div className="flex gap-1">
                {(['Diurno', 'Noturno', 'Integral'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => patchForm({ turno: t })}
                    className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-colors ${
                      form.turno === t
                        ? 'bg-[#f97316] text-white'
                        : 'bg-[#3d3d3d] text-[#a3a3a3] hover:bg-[#525252]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-[#6b6b6b] mb-1">Prazo de Execução (dias)</label>
              <input
                type="number" min={0}
                value={form.prazoExecucaoDias}
                onChange={(e) => patchForm({ prazoExecucaoDias: Number(e.target.value) })}
                className={inp}
              />
            </div>
          </div>
        </section>

        {/* Section: Condições Climáticas */}
        <section className="bg-[#2c2c2c] rounded-lg border border-[#525252] overflow-hidden">
          <div className="px-4 py-2 bg-[#3d3d3d] border-b border-[#525252]">
            <span className="text-xs font-semibold text-[#f97316] uppercase tracking-wide">Condições Climáticas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-[#1f1f1f]">
                  <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Período</th>
                  <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Bom</th>
                  <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Chuva</th>
                  <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Improdutivo</th>
                  <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Parado (dias)</th>
                  <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Desconto (dias)</th>
                </tr>
              </thead>
              <tbody>
                {form.clima.map((row, i) => (
                  <tr key={row.periodo} className={i % 2 === 0 ? 'bg-[#2c2c2c]' : 'bg-[#252525]'}>
                    <td className="px-3 py-1.5 text-[#a3a3a3] font-medium">{row.periodo}</td>
                    {(['bom', 'chuva', 'improdutivo', 'paradoDias', 'descontoDias'] as const).map((field) => (
                      <td key={field} className="px-2 py-1 text-center">
                        <input
                          type="number" min={0} max={1} step={0.5}
                          value={row[field]}
                          onChange={(e) => patchClima(i, { [field]: Number(e.target.value) })}
                          className="w-14 bg-[#1a1a1a] border border-[#525252] rounded px-1.5 py-1 text-xs text-center text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section: Movimentações */}
        <section className="bg-[#2c2c2c] rounded-lg border border-[#525252] overflow-hidden">
          <div className="px-4 py-2 bg-[#3d3d3d] border-b border-[#525252]">
            <span className="text-xs font-semibold text-[#f97316] uppercase tracking-wide">Movimentações</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-[#6b6b6b] mb-1">Material</label>
              <textarea
                rows={3}
                value={form.movimentacaoMaterial}
                onChange={(e) => patchForm({ movimentacaoMaterial: e.target.value })}
                placeholder="Descreva as movimentações de material..."
                className={`${inp} resize-none`}
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#6b6b6b] mb-1">Equipamento</label>
              <textarea
                rows={3}
                value={form.movimentacaoEquip}
                onChange={(e) => patchForm({ movimentacaoEquip: e.target.value })}
                placeholder="Descreva as movimentações de equipamento..."
                className={`${inp} resize-none`}
              />
            </div>
          </div>
        </section>

        {/* Section: Mão de Obra */}
        <section className="bg-[#2c2c2c] rounded-lg border border-[#525252] overflow-hidden">
          <div className="px-4 py-2 bg-[#3d3d3d] border-b border-[#525252]">
            <span className="text-xs font-semibold text-[#f97316] uppercase tracking-wide">Mão de Obra</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-[#1f1f1f]">
                  <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Função</th>
                  <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Turno 1</th>
                  <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Turno 2</th>
                  <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {form.maoDeObra.map((row, i) => (
                  <tr key={row.funcao} className={i % 2 === 0 ? 'bg-[#2c2c2c]' : 'bg-[#252525]'}>
                    <td className="px-3 py-1.5 text-[#a3a3a3]">{row.funcao}</td>
                    <td className="px-2 py-1 text-center">
                      <input type="number" min={0} value={row.turno1}
                        onChange={(e) => patchMO(i, { turno1: Number(e.target.value) })}
                        className={numInp} />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input type="number" min={0} value={row.turno2}
                        onChange={(e) => patchMO(i, { turno2: Number(e.target.value) })}
                        className={numInp} />
                    </td>
                    <td className="px-2 py-1 text-center text-[#f97316] font-semibold">{row.total}</td>
                  </tr>
                ))}
                <tr className="bg-[#3d3d3d] border-t border-[#525252]">
                  <td className="px-3 py-1.5 text-[#f5f5f5] font-semibold text-[10px]">TOTAL</td>
                  <td className="px-2 py-1.5 text-center text-[#f97316] font-bold">
                    {form.maoDeObra.reduce((s, r) => s + r.turno1, 0)}
                  </td>
                  <td className="px-2 py-1.5 text-center text-[#f97316] font-bold">
                    {form.maoDeObra.reduce((s, r) => s + r.turno2, 0)}
                  </td>
                  <td className="px-2 py-1.5 text-center text-[#f97316] font-bold">
                    {form.maoDeObra.reduce((s, r) => s + r.total, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section: Equipamentos */}
        <section className="bg-[#2c2c2c] rounded-lg border border-[#525252] overflow-hidden">
          <div className="px-4 py-2 bg-[#3d3d3d] border-b border-[#525252]">
            <span className="text-xs font-semibold text-[#f97316] uppercase tracking-wide">Equipamentos / Veículos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-[#1f1f1f]">
                  <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Equipamento</th>
                  <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Qtd</th>
                  <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Horas</th>
                  <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Observação</th>
                </tr>
              </thead>
              <tbody>
                {form.equipamentos.map((row, i) => (
                  <tr key={row.equipamento} className={i % 2 === 0 ? 'bg-[#2c2c2c]' : 'bg-[#252525]'}>
                    <td className="px-3 py-1.5 text-[#a3a3a3]">{row.equipamento}</td>
                    <td className="px-2 py-1 text-center">
                      <input type="number" min={0} value={row.quantidade}
                        onChange={(e) => patchEquip(i, { quantidade: Number(e.target.value) })}
                        className={numInp} />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input type="number" min={0} value={row.horas}
                        onChange={(e) => patchEquip(i, { horas: Number(e.target.value) })}
                        className={numInp} />
                    </td>
                    <td className="px-2 py-1">
                      <input type="text" value={row.observacao}
                        onChange={(e) => patchEquip(i, { observacao: e.target.value })}
                        className="w-full bg-[#1a1a1a] border border-[#525252] rounded px-1.5 py-1 text-[10px] text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section: Atividades Executadas */}
        <section className="bg-[#2c2c2c] rounded-lg border border-[#525252] overflow-hidden">
          <div className="px-4 py-2 bg-[#3d3d3d] border-b border-[#525252]">
            <span className="text-xs font-semibold text-[#f97316] uppercase tracking-wide">Atividades Executadas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-[#1f1f1f]">
                  <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Serviço</th>
                  <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Executado</th>
                  <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Quantidade</th>
                  <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Unidade</th>
                </tr>
              </thead>
              <tbody>
                {form.atividades.map((row, i) => (
                  <tr key={row.descricao} className={i % 2 === 0 ? 'bg-[#2c2c2c]' : 'bg-[#252525]'}>
                    <td className="px-3 py-1.5 text-[#a3a3a3]">{row.descricao}</td>
                    <td className="px-2 py-1 text-center">
                      <button
                        onClick={() => patchAtiv(i, { executado: !row.executado })}
                        className={`w-5 h-5 rounded border transition-colors ${
                          row.executado
                            ? 'bg-[#f97316] border-[#f97316]'
                            : 'bg-transparent border-[#525252] hover:border-[#f97316]/50'
                        }`}
                      >
                        {row.executado && <span className="text-white text-[8px] font-bold">✓</span>}
                      </button>
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input type="number" min={0} step={0.1} value={row.quantidade}
                        onChange={(e) => patchAtiv(i, { quantidade: Number(e.target.value) })}
                        disabled={!row.executado}
                        className={`${numInp} ${!row.executado ? 'opacity-30' : ''}`} />
                    </td>
                    <td className="px-2 py-1 text-center text-[#6b6b6b]">{row.unidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section: Observações */}
        <section className="bg-[#2c2c2c] rounded-lg border border-[#525252] overflow-hidden">
          <div className="px-4 py-2 bg-[#3d3d3d] border-b border-[#525252]">
            <span className="text-xs font-semibold text-[#f97316] uppercase tracking-wide">Observações</span>
          </div>
          <div className="p-4">
            <textarea
              rows={4}
              value={form.observacoes}
              onChange={(e) => patchForm({ observacoes: e.target.value })}
              placeholder="Registre observações relevantes do dia..."
              className={`${inp} resize-none`}
            />
          </div>
        </section>

        {/* Section: Assinaturas */}
        <section className="bg-[#2c2c2c] rounded-lg border border-[#525252] overflow-hidden">
          <div className="px-4 py-2 bg-[#3d3d3d] border-b border-[#525252]">
            <span className="text-xs font-semibold text-[#f97316] uppercase tracking-wide">Assinaturas</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-6">
            {/* Left: Empreiteira */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-[#6b6b6b] font-medium uppercase tracking-wide">Responsável pela Empreiteira</label>
              <input
                type="text"
                placeholder="Nome completo"
                value={form.responsavelEmpreiteira}
                onChange={(e) => patchForm({ responsavelEmpreiteira: e.target.value })}
                className={inp}
              />
              <div className="mt-4 border-b border-dashed border-[#525252] pb-1" />
              <span className="text-[9px] text-[#6b6b6b] text-center">Assinatura</span>
            </div>
            {/* Right: Consórcio */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-[#6b6b6b] font-medium uppercase tracking-wide">Responsável do Consórcio</label>
              <input
                type="text"
                placeholder="Nome completo"
                value={form.responsavelConsorcio}
                onChange={(e) => patchForm({ responsavelConsorcio: e.target.value })}
                className={inp}
              />
              <div className="mt-4 border-b border-dashed border-[#525252] pb-1" />
              <span className="text-[9px] text-[#6b6b6b] text-center">Assinatura</span>
            </div>
          </div>
        </section>

        {/* Save / New buttons */}
        <div className="flex gap-3 pb-4">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#f97316] text-white text-sm font-medium hover:bg-[#ea6c0a] transition-colors"
          >
            <Save size={15} /> Salvar RDO SABESP
          </button>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3d3d3d] text-[#a3a3a3] text-sm hover:bg-[#525252] hover:text-[#f5f5f5] transition-colors"
          >
            <Plus size={15} /> Novo
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-green-400 text-sm">
              <CheckCircle2 size={15} /> Salvo com sucesso!
            </span>
          )}
        </div>
      </div>

      {/* ── Right sidebar: Checklist + History ──────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col gap-4 overflow-y-auto">

        {/* Checklist */}
        <div className="bg-[#2c2c2c] rounded-lg border border-[#525252] overflow-hidden">
          <div className="px-4 py-2 bg-[#3d3d3d] border-b border-[#525252] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#f97316] uppercase tracking-wide">Checklist</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              checklistPct === 100 ? 'bg-green-600/20 text-green-400' :
              checklistPct >= 50  ? 'bg-yellow-600/20 text-yellow-400' :
                                    'bg-red-600/20 text-red-400'
            }`}>
              {checklistDone}/{CHECKLIST_ITEMS.length}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-[#1a1a1a]">
            <div
              className={`h-full transition-all ${checklistPct === 100 ? 'bg-green-500' : checklistPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${checklistPct}%` }}
            />
          </div>
          <div className="p-3 space-y-2">
            {CHECKLIST_ITEMS.map((item) => {
              const done = !!form.checklist[item]
              return (
                <button
                  key={item}
                  onClick={() => patchChecklist(item, !done)}
                  className="w-full flex items-center gap-2 text-left transition-colors group"
                >
                  {done
                    ? <CheckCircle2 size={15} className="text-green-400 shrink-0" />
                    : <Circle size={15} className="text-[#525252] group-hover:text-[#a3a3a3] shrink-0" />
                  }
                  <span className={`text-xs ${done ? 'text-green-400 line-through' : 'text-[#a3a3a3]'}`}>
                    {item}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* History */}
        <div className="bg-[#2c2c2c] rounded-lg border border-[#525252] overflow-hidden flex flex-col min-h-0">
          <div className="px-4 py-2 bg-[#3d3d3d] border-b border-[#525252] flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-[#f97316] uppercase tracking-wide">Histórico SABESP</span>
            <span className="text-[10px] text-[#6b6b6b]">{sabespRdos.length} registro{sabespRdos.length !== 1 ? 's' : ''}</span>
          </div>
          {sabespRdos.length === 0 ? (
            <div className="p-4 text-center text-[#6b6b6b] text-xs">Nenhum RDO SABESP salvo.</div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {[...sabespRdos].reverse().map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-2 px-3 py-2.5 border-b border-[#3d3d3d] last:border-0 hover:bg-[#333333] transition-colors group"
                >
                  <FileText size={14} className="text-[#f97316] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-[#f5f5f5] font-medium truncate">{r.obra}</div>
                    <div className="text-[10px] text-[#6b6b6b]">{new Date(r.data).toLocaleDateString('pt-BR')} · {r.turno}</div>
                    <div className="text-[9px] text-[#525252]">
                      MO: {r.maoDeObra.reduce((s, m) => s + m.total, 0)} · EPI: {r.epi ? 'SIM' : 'NÃO'}
                    </div>
                  </div>
                  <button
                    onClick={() => removeSabespRdo(r.id)}
                    className="opacity-0 group-hover:opacity-100 text-[#525252] hover:text-red-400 transition-all p-0.5"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
