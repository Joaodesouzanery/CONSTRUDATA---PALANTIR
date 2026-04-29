/**
 * PlanejamentoMestrePage — main page for the Planejamento Mestre module.
 *
 * Empty state quando não há atividades — usuário pode criar do zero (wizard)
 * ou carregar dados de exemplo (loadDemoData).
 */
import { useState, useEffect, useRef } from 'react'
import { Sparkles, FlaskConical, FileSpreadsheet, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { PlanejamentoMestreHeader } from './components/PlanejamentoMestreHeader'
import { PlanejamentoMacroPanel } from './components/PlanejamentoMacroPanel'
import { DerivacaoPanel } from './components/DerivacaoPanel'
import { CurtoPrazoPanel } from './components/CurtoPrazoPanel'
import { VisaoIntegradaPanel } from './components/VisaoIntegradaPanel'
import { ProgramacaoSemanalPanel } from './components/ProgramacaoSemanalPanel'
import { CriarCronogramaWizard } from './components/CriarCronogramaWizard'
import { PlanejamentoRestricoesPanel } from './components/PlanejamentoRestricoesPanel'

export function PlanejamentoMestrePage() {
  const activeTab = usePlanejamentoMestreStore((s) => s.activeTab)
  const activities = usePlanejamentoMestreStore((s) => s.activities)
  const loadDemoData = usePlanejamentoMestreStore((s) => s.loadDemoData)
  const pull = usePlanejamentoMestreStore((s) => s.pull)
  const addActivity = usePlanejamentoMestreStore((s) => s.addActivity)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void pull() }, [pull])

  function downloadTemplate() {
    const title = ['ATLÂNTICO CONSTRUDATA — PLANEJAMENTO MESTRE']
    const meta = ['Projeto:', '', 'Data Base:', '', 'Responsável:', '', 'Contrato:', '']
    const blank: string[] = []
    const headers = [
      'WBS / Código', 'Nome da Atividade', 'Nível', 'Data Início Planejada', 'Data Fim Planejada',
      'Data Início Tendência', 'Data Fim Tendência', 'Duração (dias)', 'Progresso (%)',
      'Responsável / Equipe', 'Coordenador', 'Tipo de Rede', 'Serviço/Categoria',
      'Núcleo / Frente', 'Local / Rua', 'Comprimento (m)', 'DN (mm)',
      'Qtd Ligações', 'Peso / Prioridade', 'Predecessores', 'Marco (S/N)', 'Observações',
    ]

    // Projeto raiz
    const r0 = ['1', 'SE LIGA NA REDE - SANTOS', '0', '01/04/2026', '30/12/2026', '01/04/2026', '30/12/2026', '274', '0', 'Gerente Geral', 'José Márcio', 'geral', '', '', '', '', '', '', '10', '', 'N', 'Contrato CT 11481051']
    // Frente 1: Esgoto
    const r1 = ['1.1', 'FRENTE ESGOTO — Vila Criadores', '1', '01/04/2026', '30/09/2026', '01/04/2026', '30/09/2026', '183', '0', 'Equipe A', 'Priscila', 'esgoto', '', 'Vila Criadores', '', '', '', '', '8', '', 'N', '']
    const r1a = ['1.1.1', 'Rede Coletora DN 200mm — Rua B', '2', '01/04/2026', '15/06/2026', '01/04/2026', '20/06/2026', '76', '31', 'Equipe A', 'Priscila', 'esgoto', 'LE', 'Vila Criadores', 'Rua B', '350', '200', '8', '5', '', 'N', 'Status: Em execução']
    const r1b = ['1.1.2', 'Rede Coletora DN 150mm — Beco Amizade', '2', '15/06/2026', '30/07/2026', '20/06/2026', '05/08/2026', '46', '0', 'Equipe A', 'Priscila', 'esgoto', 'LE', 'Vila Criadores', 'Beco da Amizade', '210', '150', '5', '3', '1.1.1', 'N', '']
    const r1c = ['1.1.3', 'Poços de Visita (PVs)', '2', '01/04/2026', '30/07/2026', '01/04/2026', '05/08/2026', '122', '15', 'Equipe B', 'Priscila', 'esgoto', 'LE', 'Vila Criadores', '', '', '', '25', '4', '', 'N', '']
    const r1d = ['1.1.4', 'MARCO: Conclusão Esgoto Vila Criadores', '2', '30/09/2026', '30/09/2026', '30/09/2026', '30/09/2026', '0', '0', '', '', 'esgoto', '', 'Vila Criadores', '', '', '', '', '1', '1.1.1;1.1.2;1.1.3', 'S', 'Marco contratual']
    // Frente 2: Água
    const r2 = ['1.2', 'FRENTE ÁGUA — Morro do Teteu', '1', '01/05/2026', '30/11/2026', '01/05/2026', '30/11/2026', '214', '0', 'Equipe C', 'José Márcio', 'agua', '', 'Morro do Teteu', '', '', '', '', '7', '', 'N', '']
    const r2a = ['1.2.1', 'Rede Distribuição PEAD DN 160mm', '2', '01/05/2026', '30/08/2026', '01/05/2026', '30/08/2026', '122', '25', 'Equipe C', '', 'agua', 'LA', 'Morro do Teteu', 'Rua das Pedras', '810', '160', '15', '6', '', 'N', '']
    const r2b = ['1.2.2', 'Ligações domiciliares (PEAD 32mm)', '2', '01/07/2026', '30/11/2026', '01/07/2026', '30/11/2026', '153', '0', 'Equipe D', '', 'agua', 'LA', 'Morro do Teteu', '', '', '32', '82', '3', '1.2.1', 'N', '']
    // Frente 3: Pavimentação
    const r3 = ['1.3', 'REPOSIÇÃO DE PAVIMENTO', '1', '01/06/2026', '30/12/2026', '01/06/2026', '30/12/2026', '214', '0', 'Equipe E', '', 'civil', 'reposicao', '', '', '', '', '', '2', '1.1;1.2', 'N', 'Depende de esgoto e água']

    const instructions = [
      ['ATLÂNTICO CONSTRUDATA — INSTRUÇÕES DO TEMPLATE DE PLANEJAMENTO MESTRE'], [''],
      ['COLUNA', 'DESCRIÇÃO', 'OBRIGATÓRIO?', 'VALORES ACEITOS', 'EXEMPLO'],
      ['WBS / Código', 'Código hierárquico. Define pai-filho automaticamente (1 → 1.1 → 1.1.1).', 'Recomendado', 'Texto com pontos', '1.2.1'],
      ['Nome da Atividade', 'Nome descritivo do serviço ou marco.', 'SIM', 'Texto livre', 'Rede DN 200mm - Rua A'],
      ['Nível', 'Nível na hierarquia WBS. Auto-calculado se omitido.', 'Não', '0=Projeto, 1=Frente, 2=Atividade', '2'],
      ['Data Início Planejada', 'Data de início do baseline (plano original).', 'Recomendado', 'dd/MM/yyyy', '01/04/2026'],
      ['Data Fim Planejada', 'Data de fim do baseline.', 'Recomendado', 'dd/MM/yyyy', '30/06/2026'],
      ['Data Início Tendência', 'Data de início atual (replanejado). Se igual à planejada, copie.', 'Não', 'dd/MM/yyyy', '05/04/2026'],
      ['Data Fim Tendência', 'Data de fim atual. Permite comparar baseline vs tendência no Gantt.', 'Não', 'dd/MM/yyyy', '15/07/2026'],
      ['Duração (dias)', 'Dias úteis. Calculada das datas se omitida.', 'Não', 'Número inteiro', '91'],
      ['Progresso (%)', 'Percentual concluído (0-100).', 'Não', '0 a 100 (ou 0.0 a 1.0)', '25'],
      ['Responsável / Equipe', 'Nome da equipe responsável pela execução.', 'Recomendado', 'Texto', 'Equipe A'],
      ['Coordenador', 'Nome do coordenador da frente.', 'Não', 'Texto', 'Priscila'],
      ['Tipo de Rede', 'Tipo de infraestrutura. Define cores no Gantt.', 'Recomendado', 'agua, esgoto, civil, geral', 'esgoto'],
      ['Serviço/Categoria', 'Categoria técnica do serviço.', 'Não', 'LA, LE, intra, interligacao, reposicao, OS, pavimentacao', 'LE'],
      ['Núcleo / Frente', 'Nome do núcleo ou comunidade.', 'Recomendado', 'Texto', 'Vila Criadores'],
      ['Local / Rua', 'Logradouro específico.', 'Não', 'Texto', 'Rua B'],
      ['Comprimento (m)', 'Extensão em metros lineares.', 'Não', 'Número decimal', '350'],
      ['DN (mm)', 'Diâmetro nominal da tubulação.', 'Não', 'Número inteiro', '200'],
      ['Qtd Ligações', 'Número de ligações domiciliares.', 'Não', 'Número inteiro', '82'],
      ['Peso / Prioridade', 'Peso para curva S (1-10). Maior = mais impacto.', 'Não', '1 a 10', '5'],
      ['Predecessores', 'WBS das atividades predecessoras (separar por ;).', 'Não', 'WBS codes', '1.1.1;1.1.2'],
      ['Marco (S/N)', 'S = marco contratual (duração 0). N = atividade.', 'Não', 'S ou N', 'N'],
      ['Observações', 'Notas livres.', 'Não', 'Texto', 'Marco contratual'],
      [''],
      ['REGRAS DE IMPORTAÇÃO:'],
      ['1. A coluna "Nome da Atividade" é obrigatória — linhas sem nome serão ignoradas.'],
      ['2. Hierarquia WBS: 1 é pai de 1.1, que é pai de 1.1.1. O sistema detecta automaticamente.'],
      ['3. Datas aceitas: dd/MM/yyyy, yyyy-MM-dd, ou números seriais do Excel.'],
      ['4. Progresso aceita tanto 25 (percentual) quanto 0.25 (fração).'],
      ['5. Marcos: atividades com duração 0 ou "Marco (S/N) = S" aparecem como diamante no Gantt.'],
      ['6. Predecessores: use WBS separados por ; para definir dependências.'],
    ]

    const wb = XLSX.utils.book_new()
    const wsCrono = XLSX.utils.aoa_to_sheet([title, meta, blank, headers, r0, blank, r1, r1a, r1b, r1c, r1d, blank, r2, r2a, r2b, blank, r3])
    wsCrono['!cols'] = [
      { wch: 14 }, { wch: 48 }, { wch: 6 }, { wch: 16 }, { wch: 16 },
      { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 10 },
      { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
      { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 8 },
      { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 28 },
    ]
    XLSX.utils.book_append_sheet(wb, wsCrono, 'Cronograma Mestre')
    const wsInstr = XLSX.utils.aoa_to_sheet(instructions)
    wsInstr['!cols'] = [{ wch: 22 }, { wch: 55 }, { wch: 14 }, { wch: 40 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Instruções')
    XLSX.writeFile(wb, 'atlantico-planejamento-mestre-template.xlsx')
  }

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
      const keys = Object.keys(raw[0])
      const find = (kws: string[]) => keys.find((k) => kws.some((kw) => norm(k).includes(kw)))

      // Column detection — extended with more aliases
      const colNome     = find(['nome', 'atividade', 'tarefa', 'descri', 'servico', 'name', 'activity'])
      const colWbs      = find(['wbs', 'codigo', 'cod', 'item', 'edt', 'id'])
      const colStart    = find(['inicio', 'start', 'data ini', 'dt inicio', 'planned start'])
      const colEnd      = find(['fim', 'end', 'termino', 'data fim', 'data ter', 'planned end', 'dt fim'])
      const colDuration = find(['duracao', 'duration', 'dias', 'days', 'dur'])
      const colPct      = find(['progresso', 'avanco', 'percent', 'pct', 'completo', 'complete'])
      const colResp     = find(['responsavel', 'equipe', 'team', 'responsible', 'coordenador'])
      const colType     = find(['tipo', 'rede', 'type', 'network', 'categoria'])
      const colWeight   = find(['peso', 'weight', 'prioridade'])
      const colNucleo   = find(['nucleo', 'frente', 'comunidade', 'localidade'])
      const colLocal    = find(['local', 'endereco', 'rua', 'logradouro'])
      const colCompr    = find(['comprimento', 'extensao', 'metros', 'length'])
      const colLig      = find(['ligacoes', 'conexoes', 'connections'])
      const colMilestone = find(['marco', 'milestone'])

      if (!colNome) { setImportError('Coluna "Nome/Atividade" não encontrada. Inclua um cabeçalho com o nome da atividade.'); return }

      const now = new Date().toISOString().slice(0, 10)

      // Helper: parse date (supports dd/MM/yyyy, yyyy-MM-dd, Excel serial)
      const parseDate = (v: unknown): string => {
        if (!v) return now
        const s = String(v).trim()
        if (!s) return now
        // Excel serial number
        if (/^\d{4,5}$/.test(s)) {
          const d = new Date((Number(s) - 25569) * 86400000)
          return isNaN(d.getTime()) ? now : d.toISOString().slice(0, 10)
        }
        // dd/MM/yyyy
        const brMatch = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
        if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`
        // yyyy-MM-dd (already correct)
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
        return now
      }

      const toNum = (v: unknown): number => {
        if (typeof v === 'number') return isNaN(v) ? 0 : v
        const s = String(v ?? '').trim().replace(/[%,]/g, '')
        return parseFloat(s) || 0
      }

      // Detect WBS level from code (e.g., "1.2.1" → level 2)
      const wbsLevel = (code: string): number => {
        const parts = code.split(/[.\-/]/).filter(Boolean)
        return Math.max(0, parts.length - 1)
      }

      // Infer network type
      const inferType = (v: string): 'agua' | 'esgoto' | 'civil' | 'geral' => {
        const s = v.toLowerCase()
        if (s.includes('agua') || s.includes('water') || s.includes('la')) return 'agua'
        if (s.includes('esgoto') || s.includes('sewer') || s.includes('le')) return 'esgoto'
        if (s.includes('civil') || s.includes('pav')) return 'civil'
        return 'geral'
      }

      const imported = raw.map((row, i) => {
        const wbs = colWbs ? String(row[colWbs] ?? `1.${i + 1}`) : `1.${i + 1}`
        const pStart = parseDate(colStart ? row[colStart] : null)
        const pEnd   = parseDate(colEnd ? row[colEnd] : null)

        // Calculate duration from dates if not provided
        let duration = colDuration ? toNum(row[colDuration]) : 0
        if (duration === 0 && pStart !== now && pEnd !== now) {
          const d1 = new Date(pStart).getTime()
          const d2 = new Date(pEnd).getTime()
          if (d2 > d1) duration = Math.ceil((d2 - d1) / 86400000)
        }

        const pct = colPct ? toNum(row[colPct]) : 0
        const isMilestone = colMilestone
          ? ['sim', 'yes', 'true', '1', 'x'].includes(norm(row[colMilestone]))
          : duration === 0 && pStart === pEnd && pStart !== now

        return {
          wbsCode:         wbs,
          name:            String(row[colNome] ?? ''),
          level:           wbsLevel(wbs),
          plannedStart:    pStart,
          plannedEnd:      pEnd,
          trendStart:      pStart,
          trendEnd:        pEnd,
          durationDays:    duration,
          percentComplete: Math.min(100, pct > 1 ? pct : pct * 100), // handle 0.75 or 75
          status:          pct >= 100 ? 'completed' as const
                         : pct > 0   ? 'in_progress' as const
                         :             'not_started' as const,
          isMilestone,
          parentId:        null as string | null,
          responsibleTeam: colResp   ? String(row[colResp]   ?? '') : undefined,
          networkType:     colType   ? inferType(String(row[colType] ?? '')) : undefined,
          weight:          colWeight ? toNum(row[colWeight]) : undefined,
          nucleo:          colNucleo ? String(row[colNucleo] ?? '') : undefined,
          local:           colLocal  ? String(row[colLocal]  ?? '') : undefined,
          comprimento:     colCompr  ? toNum(row[colCompr]) : undefined,
          quantidadeLigacoes: colLig ? toNum(row[colLig]) : undefined,
        }
      }).filter((a) => a.name.trim())

      if (imported.length === 0) { setImportError('Nenhuma atividade válida encontrada.'); return }

      // Auto-detect parent-child from WBS codes (e.g., "1.2" is parent of "1.2.1")
      const ids: Record<string, string> = {}
      imported.forEach((a) => {
        const id = crypto.randomUUID().slice(0, 8)
        ids[a.wbsCode] = id
      })
      imported.forEach((a) => {
        if (a.level > 0) {
          const parentWbs = a.wbsCode.split(/[.\-/]/).slice(0, -1).join('.')
          if (ids[parentWbs]) a.parentId = ids[parentWbs]
        }
      })

      // Add all activities
      imported.forEach((a) => addActivity(a))
      setImportError(null)
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

            {/* Template download */}
            <button
              onClick={downloadTemplate}
              className="mt-4 flex items-center justify-center gap-2 mx-auto text-[#f97316] hover:text-[#ea580c] text-xs font-medium transition-colors"
            >
              <Download size={13} />
              Baixar template padronizado (.xlsx)
            </button>
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
        {activeTab === 'restricoes' && <PlanejamentoRestricoesPanel />}
      </div>
      <CriarCronogramaWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  )
}
