/**
 * PlanejamentoMestrePage — main page for the Planejamento Mestre module.
 *
 * Empty state quando não há atividades — usuário pode criar do zero (wizard)
 * ou carregar dados de exemplo (loadDemoData).
 */
import { useState, useEffect, useRef } from 'react'
import { Sparkles, FlaskConical, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { PlanejamentoMestreHeader } from './components/PlanejamentoMestreHeader'
import { PlanejamentoMacroPanel } from './components/PlanejamentoMacroPanel'
import { DerivacaoPanel } from './components/DerivacaoPanel'
import { CurtoPrazoPanel } from './components/CurtoPrazoPanel'
import { VisaoIntegradaPanel } from './components/VisaoIntegradaPanel'
import { ProgramacaoSemanalPanel } from './components/ProgramacaoSemanalPanel'
import { CriarCronogramaWizard } from './components/CriarCronogramaWizard'

export function PlanejamentoMestrePage() {
  const activeTab = usePlanejamentoMestreStore((s) => s.activeTab)
  const activities = usePlanejamentoMestreStore((s) => s.activities)
  const loadDemoData = usePlanejamentoMestreStore((s) => s.loadDemoData)
  const pull = usePlanejamentoMestreStore((s) => s.pull)
  const addActivity = usePlanejamentoMestreStore((s) => s.addActivity)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void pull() }, [])

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetName = wb.SheetNames[0]
      if (!sheetName) { setImportError('Planilha vazia.'); return }
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: '' })
      if (raw.length === 0) { setImportError('Nenhuma linha encontrada.'); return }
      const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
      const sample = raw[0]
      const keys = Object.keys(sample)
      const find = (kws: string[]) => keys.find((k) => kws.some((kw) => norm(k).includes(kw)))
      const colNome  = find(['nome', 'atividade', 'tarefa', 'descri'])
      const colWbs   = find(['wbs', 'codigo', 'cod', 'item'])
      const colStart = find(['inicio', 'start', 'data ini'])
      const colEnd   = find(['fim', 'end', 'termino', 'data fim', 'data ter'])
      if (!colNome) { setImportError('Coluna "Nome" não encontrada. Inclua um cabeçalho com o nome da atividade.'); return }
      const now = new Date().toISOString().slice(0, 10)
      const imported = raw.map((row, i) => ({
        wbsCode:         colWbs   ? String(row[colWbs]   ?? `1.${i + 1}`) : `1.${i + 1}`,
        name:            String(row[colNome] ?? ''),
        level:           1,
        plannedStart:    colStart ? String(row[colStart] ?? now) : now,
        plannedEnd:      colEnd   ? String(row[colEnd]   ?? now) : now,
        trendStart:      colStart ? String(row[colStart] ?? now) : now,
        trendEnd:        colEnd   ? String(row[colEnd]   ?? now) : now,
        durationDays:    0,
        percentComplete: 0,
        status:          'not_started' as const,
        isMilestone:     false,
        parentId:        null,
      })).filter((a) => a.name.trim())
      if (imported.length === 0) { setImportError('Nenhuma atividade válida encontrada.'); return }
      imported.forEach((a) => addActivity(a))
    } catch {
      setImportError('Erro ao ler o arquivo. Certifique-se de que é um .xlsx ou .csv válido.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Empty state — cliente novo, sem cronograma
  if (activities.length === 0) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-[#1f1f1f]">
        <PlanejamentoMestreHeader onNewProject={() => setWizardOpen(true)} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-xl w-full text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-[#f97316]/15 flex items-center justify-center">
              <Sparkles size={36} className="text-[#f97316]" />
            </div>
            <h2 className="text-white text-2xl font-bold mb-2">Nenhum cronograma ainda</h2>
            <p className="text-[#a3a3a3] text-sm mb-8 leading-relaxed">
              Comece criando um cronograma macro do zero para sua obra. Em 3 passos rápidos
              você define o nome do projeto, as frentes e a estrutura inicial.
              <br />
              <span className="text-[#6b6b6b]">Tudo é editável depois.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-[#f97316]/20"
              >
                <Sparkles size={16} />
                Criar Cronograma do Zero
              </button>
              <button
                onClick={loadDemoData}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#3a3a3a] hover:bg-[#484848] text-[#f5f5f5] border border-[#525252] rounded-xl font-semibold text-sm transition-colors"
              >
                <FlaskConical size={16} />
                Carregar Exemplo
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#3a3a3a] hover:bg-[#484848] text-[#f5f5f5] border border-[#525252] rounded-xl font-semibold text-sm transition-colors"
              >
                <FileSpreadsheet size={16} />
                Importar Planilha
              </button>
            </div>
            {importError && (
              <p className="mt-3 text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-2">
                {importError}
              </p>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
          </div>
        </div>

        <CriarCronogramaWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PlanejamentoMestreHeader onNewProject={() => setWizardOpen(true)} />
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'macro'     && <PlanejamentoMacroPanel onCreateProject={() => setWizardOpen(true)} />}
        {activeTab === 'derivacao' && <DerivacaoPanel />}
        {activeTab === 'whatif'    && <CurtoPrazoPanel />}
        {activeTab === 'integrada' && <VisaoIntegradaPanel />}
        {activeTab === 'semanal'   && <ProgramacaoSemanalPanel />}
      </div>
      <CriarCronogramaWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  )
}
