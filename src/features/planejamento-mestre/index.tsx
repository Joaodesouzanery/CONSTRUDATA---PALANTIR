/**
 * PlanejamentoMestrePage — main page for the Planejamento Mestre module.
 *
 * Empty state quando não há atividades — usuário pode criar do zero (wizard)
 * ou carregar dados de exemplo (loadDemoData).
 */
import { useState, useEffect, useRef } from 'react'
import { AlertCircle, CheckCircle2, Sparkles, FlaskConical, FileSpreadsheet, Download, BrainCircuit, Target, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { authHeader } from '@/lib/supabase'
import { PlanejamentoMestreHeader } from './components/PlanejamentoMestreHeader'
import { PlanejamentoMacroPanel } from './components/PlanejamentoMacroPanel'
import { DerivacaoPanel } from './components/DerivacaoPanel'
import { CurtoPrazoPanel } from './components/CurtoPrazoPanel'
import { VisaoIntegradaPanel } from './components/VisaoIntegradaPanel'
import { ProgramacaoSemanalPanel } from './components/ProgramacaoSemanalPanel'
import { CriarCronogramaWizard } from './components/CriarCronogramaWizard'
import { PlanejamentoRestricoesPanel } from './components/PlanejamentoRestricoesPanel'
import { MedicaoPlanejamentoTestePanel } from './components/MedicaoPlanejamentoTestePanel'
import { PlanejamentoOperacionalPanel } from './components/PlanejamentoOperacionalPanel'
import { ExecucaoPanel } from '@/features/planejamento/components/ExecucaoPanel'
import { LpsHeader } from '@/features/lps-lean/components/LpsHeader'
import { SemaforoPanel } from '@/features/lps-lean/components/SemaforoPanel'
import { LookAheadPanel } from '@/features/lps-lean/components/LookAheadPanel'
import { PpcDashboard } from '@/features/lps-lean/components/PpcDashboard'
import { TaktTimePanel } from '@/features/lps-lean/components/TaktTimePanel'
import { RestricoesPanel } from '@/features/lps-lean/components/RestricoesPanel'
import { LpsAnalyticsPanel } from '@/features/lps-lean/components/LpsAnalyticsPanel'
import { TimelineRestricoesPanel } from '@/features/lps-lean/components/TimelineRestricoesPanel'
import { AlertasPanel } from '@/features/lps-lean/components/AlertasPanel'
import { MaoDeObraLpsPanel } from '@/features/lps-lean/components/MaoDeObraLpsPanel'
import { IntegracoesPanel } from '@/features/lps-lean/components/IntegracoesPanel'
import { ReuniaoSemanalPanel } from '@/features/lps-lean/components/ReuniaoSemanalPanel'
import { useLpsStore } from '@/store/lpsStore'
import type { LpsRestriction, MasterActivity } from '@/types'
import { readLocalRdoSabesp } from '@/features/rdo-sabesp/lib/rdoSabespLocalStore'
import { getCriadouroLabel, getRdoSabespExecutedServices } from '@/features/rdo-sabesp/lib/rdoSabespUtils'

type ImportedScheduleActivity = Omit<MasterActivity, 'id'> & {
  resources?: string[]
}

type MppImportPreview = {
  source: 'mpxj' | 'mpp-fallback'
  fileName: string
  projectName: string
  activities: ImportedScheduleActivity[]
  warnings: string[]
  mappings: {
    nuclei: string[]
    extractedStrings: number
  }
}

export function PlanejamentoMestrePage() {
  const activeTab = usePlanejamentoMestreStore((s) => s.activeTab)
  const activities = usePlanejamentoMestreStore((s) => s.activities)
  const loadDemoData = usePlanejamentoMestreStore((s) => s.loadDemoData)
  const pull = usePlanejamentoMestreStore((s) => s.pull)
  const addActivity = usePlanejamentoMestreStore((s) => s.addActivity)
  const setActiveTab = usePlanejamentoMestreStore((s) => s.setActiveTab)
  const lpsActiveTab = useLpsStore((s) => s.activeTab)
  const lpsRestrictions = useLpsStore((s) => s.restrictions)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [mppPreview, setMppPreview] = useState<MppImportPreview | null>(null)
  const [workspace, setWorkspace] = useState<'planejamento' | 'lps'>('planejamento')
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

  function arrayBufferToBase64(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunkSize = 0x8000
    for (let index = 0; index < bytes.length; index += chunkSize) {
      const chunk = bytes.subarray(index, index + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    return btoa(binary)
  }

  async function importMppPreview(file: File, buf: ArrayBuffer) {
    const response = await fetch('/api/import-mpp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ fileName: file.name, dataBase64: arrayBufferToBase64(buf) }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(payload?.error || 'Erro ao converter arquivo .mpp')
    setMppPreview(payload as MppImportPreview)
  }

  function confirmMppImport() {
    if (!mppPreview) return
    mppPreview.activities.forEach((activity) => addActivity({
      ...activity,
      parentId: null,
      notes: [
        activity.notes,
        `Origem: ${mppPreview.fileName}`,
        mppPreview.source === 'mpp-fallback' ? 'Importacao MPP em previa textual; revisar campos tecnicos antes da linha de base final.' : 'Importacao MPP via conversor backend.',
      ].filter(Boolean).join(' | '),
    }))
    setActiveTab('derivacao')
    setMppPreview(null)
    setImportError(null)
    setWorkspace('planejamento')
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    try {
      const buf = await file.arrayBuffer()
      if (/\.mpp$/i.test(file.name)) {
        await importMppPreview(file, buf)
        return
      }
      if (/\.xml$/i.test(file.name)) {
        const text = new TextDecoder('utf-8').decode(buf)
        const xml = new DOMParser().parseFromString(text, 'application/xml')
        if (xml.querySelector('parsererror')) {
          setImportError('XML invalido. Exporte o cronograma no MS Project como XML.')
          return
        }
        const taskNodes = Array.from(xml.getElementsByTagName('Task'))
        const importedXml = taskNodes.flatMap((task, index) => {
          const read = (tag: string) => task.getElementsByTagName(tag)[0]?.textContent?.trim() || ''
          const name = read('Name')
          if (!name || name === '0') return []
          const uid = read('UID') || String(index + 1)
          const wbs = read('WBS') || read('OutlineNumber') || `1.${index + 1}`
          const start = read('Start').slice(0, 10) || new Date().toISOString().slice(0, 10)
          const finish = read('Finish').slice(0, 10) || start
          const percent = Number(read('PercentComplete')) || 0
          const outlineLevel = Math.max(0, (Number(read('OutlineLevel')) || 1) - 1)
          const predecessors = Array.from(task.getElementsByTagName('PredecessorLink'))
            .map((node) => node.getElementsByTagName('PredecessorUID')[0]?.textContent?.trim())
            .filter(Boolean) as string[]
          const critical = read('Critical') === '1'
          const totalSlack = read('TotalSlack') || read('FreeSlack')
          const notes = [
            critical ? 'Caminho crítico: sim' : '',
            totalSlack ? `Folga MS Project: ${totalSlack}` : '',
            predecessors.length ? `Predecessoras MS Project: ${predecessors.join('; ')}` : '',
          ].filter(Boolean).join(' | ')
          return [{
            wbsCode: wbs,
            name,
            level: outlineLevel,
            plannedStart: start,
            plannedEnd: finish,
            trendStart: start,
            trendEnd: finish,
            durationDays: Math.max(0, Math.ceil((new Date(finish).getTime() - new Date(start).getTime()) / 86400000)),
            percentComplete: Math.min(100, percent),
            status: percent >= 100 ? 'completed' as const : percent > 0 ? 'in_progress' as const : 'not_started' as const,
            isMilestone: read('Milestone') === '1',
            parentId: null,
            responsibleTeam: read('ResourceNames'),
            predecessors,
            notes,
            weight: critical ? 10 : undefined,
            networkType: 'geral' as const,
            externalId: uid,
          }]
        })
        if (importedXml.length === 0) {
          setImportError('Nenhuma tarefa valida encontrada no XML do MS Project.')
          return
        }
        importedXml.forEach((activity) => addActivity(activity))
        setActiveTab('derivacao')
        setImportError(null)
        return
      }
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
      const colPrevPct  = find(['previsao', 'percentual previsto', 'peso do servico', 'peso servico', 'planned pct', 'planned percent'])
      const colResp     = find(['responsavel', 'equipe', 'team', 'responsible', 'coordenador'])
      const colType     = find(['tipo', 'rede', 'type', 'network', 'categoria'])
      const colWeight   = find(['peso', 'weight', 'prioridade'])
      const colNucleo   = find(['nucleo', 'frente', 'comunidade', 'localidade'])
      const colArea     = find(['area', 'setor', 'zona'])
      const colLocal    = find(['local', 'endereco', 'rua', 'logradouro'])
      const colServico  = find(['servico', 'categoria', 'tipo de servico'])
      const colCritico  = find(['critico', 'critical', 'caminho critico'])
      const colPred     = find(['predecessor', 'predecessora'])
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
        const prevPct = colPrevPct ? toNum(row[colPrevPct]) : 0
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
          plannedProgressPct: prevPct ? Math.min(100, prevPct > 1 ? prevPct : prevPct * 100) : undefined,
          percentComplete: Math.min(100, pct > 1 ? pct : pct * 100), // handle 0.75 or 75
          status:          pct >= 100 ? 'completed' as const
                         : pct > 0   ? 'in_progress' as const
                         :             'not_started' as const,
          isMilestone,
          parentId:        null as string | null,
          responsibleTeam: colResp   ? String(row[colResp]   ?? '') : undefined,
          networkType:     colType   ? inferType(String(row[colType] ?? '')) : undefined,
          serviceCategory:  colServico ? String(row[colServico] ?? '') as never : undefined,
          weight:          colWeight ? toNum(row[colWeight]) : undefined,
          nucleo:          colNucleo ? String(row[colNucleo] ?? '') : undefined,
          local:           [colArea ? String(row[colArea] ?? '') : '', colLocal ? String(row[colLocal] ?? '') : ''].filter(Boolean).join(' - ') || undefined,
          predecessors:     colPred ? String(row[colPred] ?? '').split(/[;,]/).map((item) => item.trim()).filter(Boolean) : undefined,
          notes:            colCritico && ['sim', 'yes', 'true', '1', 'x'].includes(norm(row[colCritico])) ? 'Caminho crítico: sim' : undefined,
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
      setActiveTab('derivacao')
      setImportError(null)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Erro ao ler o arquivo. Certifique-se de que é um .mpp, .xml, .xlsx ou .csv válido.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Empty state — cliente novo, sem cronograma
  if (workspace === 'planejamento' && activities.length === 0 && activeTab !== 'medicao-planejamento' && activeTab !== 'operacional' && activeTab !== 'execucao') {
    return (
      <div className="planning-lps-readable flex flex-col h-full overflow-hidden bg-[#1f1f1f]">
        <PlanejamentoMestreHeader showTabs={workspace === 'planejamento'} onNewProject={() => setWizardOpen(true)} onImportProject={() => fileRef.current?.click()} />
        <WorkspaceSwitch workspace={workspace} onChange={setWorkspace} />
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
                Importar MS Project
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
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.xml,.mpp" className="hidden" onChange={handleImportFile} />
          </div>
        </div>

        <MppImportPreviewModal preview={mppPreview} onCancel={() => setMppPreview(null)} onConfirm={confirmMppImport} />
        <CriarCronogramaWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      </div>
    )
  }

  return (
    <div className="planning-lps-readable flex flex-col h-full overflow-hidden">
      <PlanejamentoMestreHeader showTabs={workspace === 'planejamento'} onNewProject={() => setWizardOpen(true)} onImportProject={() => fileRef.current?.click()} />
      <WorkspaceSwitch workspace={workspace} onChange={setWorkspace} />
      <div className="flex-1 overflow-y-auto p-6">
        {importError && (
          <p className="mb-4 rounded-lg border border-red-700/30 bg-red-900/20 px-4 py-2 text-xs text-red-400">
            {importError}
          </p>
        )}
        {workspace === 'planejamento' && activeTab !== 'execucao' && <RdoPlanningBridgePanel activities={activities} />}
        {workspace === 'planejamento' && activeTab === 'execucao'  && <ExecucaoPanel />}
        {workspace === 'planejamento' && activeTab === 'macro'     && <PlanejamentoMacroPanel onCreateProject={() => setWizardOpen(true)} />}
        {workspace === 'planejamento' && activeTab === 'derivacao' && <DerivacaoPanel />}
        {workspace === 'planejamento' && activeTab === 'whatif'    && <CurtoPrazoPanel />}
        {workspace === 'planejamento' && activeTab === 'integrada' && <VisaoIntegradaPanel />}
        {workspace === 'planejamento' && activeTab === 'semanal'   && <ProgramacaoSemanalPanel />}
        {workspace === 'planejamento' && activeTab === 'restricoes' && <PlanejamentoRestricoesPanel />}
        {workspace === 'planejamento' && activeTab === 'operacional' && <PlanejamentoOperacionalPanel />}
        {workspace === 'planejamento' && activeTab === 'medicao-planejamento' && <MedicaoPlanejamentoTestePanel />}
        {workspace === 'lps' && (
          <div className="-m-6 flex min-h-full flex-col bg-[#1f1f1f]">
            <LpsHeader />
            <div className="flex-1 overflow-y-auto">
              <PlanningLpsBridge activities={activities} restrictions={lpsRestrictions} />
              {lpsActiveTab === 'reuniao'             && <ReuniaoSemanalPanel />}
              {lpsActiveTab === 'semaforo'            && <SemaforoPanel />}
              {lpsActiveTab === 'lookahead'           && <LookAheadPanel />}
              {lpsActiveTab === 'ppc'                 && <PpcDashboard />}
              {lpsActiveTab === 'takt'                && <TaktTimePanel />}
              {lpsActiveTab === 'restricoes'          && <RestricoesPanel />}
              {lpsActiveTab === 'analytics'           && <LpsAnalyticsPanel />}
              {lpsActiveTab === 'timeline-restricoes' && <div className="p-6"><TimelineRestricoesPanel /></div>}
              {lpsActiveTab === 'alertas'             && <div className="p-6"><AlertasPanel /></div>}
              {lpsActiveTab === 'mao-de-obra'         && <div className="p-6"><MaoDeObraLpsPanel /></div>}
              {lpsActiveTab === 'integracoes'         && <div className="p-6"><IntegracoesPanel /></div>}
            </div>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.xml,.mpp" className="hidden" onChange={handleImportFile} />
      <MppImportPreviewModal preview={mppPreview} onCancel={() => setMppPreview(null)} onConfirm={confirmMppImport} />
      <CriarCronogramaWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  )
}

function MppImportPreviewModal({ preview, onCancel, onConfirm }: { preview: MppImportPreview | null; onCancel: () => void; onConfirm: () => void }) {
  if (!preview) return null
  const nuclei = preview.mappings?.nuclei ?? []
  const grouped = preview.activities.reduce((map, activity) => {
    const key = activity.nucleo || 'Cronograma-base'
    map.set(key, [...(map.get(key) ?? []), activity])
    return map
  }, new Map<string, ImportedScheduleActivity[]>())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4" onClick={onCancel}>
      <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-[#525252] bg-[#2c2c2c] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[#525252] bg-[#3a3a3a] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#f97316]">Previa de importacao MPP</p>
            <h2 className="mt-1 text-base font-bold text-white">{preview.projectName}</h2>
            <p className="mt-1 text-xs text-[#d4d4d4]">
              {preview.fileName} - {preview.activities.length} atividade(s) - {preview.source === 'mpxj' ? 'Conversor MPXJ' : 'Fallback textual backend'}
            </p>
          </div>
          <button onClick={onCancel} className="text-[#d4d4d4] hover:text-white"><X size={18} /></button>
        </div>

        <div className="max-h-[62vh] space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 md:grid-cols-5">
            <PreviewMetric label="Atividades" value={preview.activities.length} />
            <PreviewMetric label="Nucleos" value={nuclei.length} />
            <PreviewMetric label="Textos extraidos" value={preview.mappings?.extractedStrings ?? 0} />
            <PreviewMetric label="Origem" value={preview.source === 'mpxj' ? 'MPXJ' : 'Previa'} />
            <PreviewMetric label="Criticas" value={preview.activities.filter((activity) => activity.criticalPath).length} />
          </div>

          {preview.warnings?.length > 0 && (
            <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              {preview.warnings.map((warning) => (
                <div key={warning} className="flex gap-2 text-xs leading-relaxed text-amber-200">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-[#525252] bg-[#1f1f1f] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#d4d4d4]">Nucleos detectados</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {nuclei.length ? nuclei.map((nucleo) => (
                <span key={nucleo} className="rounded-full border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-xs text-[#f5f5f5]">{nucleo}</span>
              )) : <span className="text-xs text-[#a3a3a3]">Sem nucleo detectado automaticamente.</span>}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from(grouped.entries()).slice(0, 6).map(([nucleo, rows]) => (
              <div key={nucleo} className="rounded-xl border border-[#525252] bg-[#1f1f1f] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{nucleo}</p>
                  <span className="text-xs text-[#d4d4d4]">{rows.length} item(ns)</span>
                </div>
                <div className="mt-3 space-y-2">
                  {rows.slice(0, 6).map((activity) => (
                    <div key={`${activity.wbsCode}-${activity.name}`} className="rounded-lg border border-[#3a3a3a] bg-[#252525] px-3 py-2">
                      <p className="text-xs font-medium text-white">{activity.wbsCode} - {activity.name}</p>
                      <p className="mt-0.5 text-[11px] text-[#a3a3a3]">{activity.plannedStart} ate {activity.plannedEnd}</p>
                      <p className="mt-0.5 text-[11px] text-[#a3a3a3]">
                        {(activity.predecessors?.length ?? 0) > 0 ? `Pred: ${activity.predecessors?.join('; ')}` : 'Sem predecessoras'}
                        {activity.criticalPath ? ' - caminho critico' : ''}
                        {activity.totalSlack != null ? ` - folga: ${activity.totalSlack}` : ''}
                      </p>
                      {(activity.resources?.length ?? 0) > 0 && (
                        <p className="mt-0.5 text-[11px] text-[#a3a3a3]">Recursos: {activity.resources?.join(', ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#525252] bg-[#1f1f1f] px-5 py-3">
          <button onClick={onCancel} className="px-4 py-2 text-xs text-[#d4d4d4] hover:text-white">Cancelar</button>
          <button onClick={onConfirm} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-5 py-2 text-xs font-semibold text-white">
            <CheckCircle2 size={14} /> Confirmar Cronograma-base
          </button>
        </div>
      </div>
    </div>
  )
}

function PreviewMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#1f1f1f] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[#d4d4d4]">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  )
}

function normalizeBridgeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function RdoPlanningBridgePanel({ activities }: { activities: MasterActivity[] }) {
  const rdos = readLocalRdoSabesp().filter((rdo) => rdo.status !== 'draft')
  const services = rdos.flatMap((rdo) => {
    const nucleo = getCriadouroLabel(rdo.criadouro, rdo.criadouro_outro)
    return getRdoSabespExecutedServices(rdo).map((service) => {
      const code = service.service_id.split('-')[0] || ''
      const description = service.services_catalog.name
      const text = normalizeBridgeText(`${code} ${description} ${rdo.rua_beco}`)
      const matches = activities.filter((activity) => {
        const sameNucleo = !activity.nucleo || !nucleo || normalizeBridgeText(activity.nucleo) === normalizeBridgeText(nucleo)
        const activityText = normalizeBridgeText(`${activity.nPreco ?? ''} ${activity.name} ${activity.local ?? ''} ${activity.notes ?? ''}`)
        const codeHit = Boolean(code && activityText.includes(normalizeBridgeText(code)))
        const descHit = normalizeBridgeText(description).split(' ').filter((part) => part.length > 4).some((part) => activityText.includes(part))
        const localHit = Boolean(rdo.rua_beco && activityText.includes(normalizeBridgeText(rdo.rua_beco)))
        return sameNucleo && (codeHit || descHit || localHit || (activityText.length > 8 && text.includes(activityText)))
      })
      return {
        rdoId: rdo.id,
        date: rdo.report_date || '',
        nucleo,
        local: rdo.rua_beco || '',
        code,
        description,
        quantity: service.quantity,
        matches,
        hasEvidence: Array.isArray(rdo.photo_paths) && rdo.photo_paths.length > 0,
      }
    })
  })
  const linked = services.filter((service) => service.matches.length > 0)
  const pending = services.filter((service) => service.matches.length === 0)
  const withoutEvidence = services.filter((service) => !service.hasEvidence)

  if (rdos.length === 0 && activities.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border border-[#525252] bg-[#252525] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#f97316]">RDO conectado ao Cronograma-base</p>
          <h3 className="mt-1 text-sm font-bold text-white">Previsto x realizado, LPS e medicao usam o mesmo vinculo operacional</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#d4d4d4]">
            O sistema cruza RDO finalizado com cronograma por nucleo, data, rua/beco/local, descricao, equipe/empreiteiro e N. Preco. Vínculos claros entram como realizados; itens sem correspondencia ficam em pendencia de revisao.
          </p>
        </div>
        <div className="grid min-w-[280px] grid-cols-3 gap-2">
          <MiniBridgeKpi label="Vinculados" value={linked.length} tone="text-emerald-300" />
          <MiniBridgeKpi label="Pendencias" value={pending.length} tone={pending.length ? 'text-amber-300' : 'text-emerald-300'} />
          <MiniBridgeKpi label="Sem foto" value={withoutEvidence.length} tone={withoutEvidence.length ? 'text-amber-300' : 'text-emerald-300'} />
        </div>
      </div>
      {pending.length > 0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {pending.slice(0, 6).map((item) => (
            <div key={`${item.rdoId}-${item.code}-${item.description}`} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              <p className="font-semibold">{item.date} - {item.nucleo} - {item.local || 'Sem local'}</p>
              <p className="mt-0.5">{item.code || 'Sem N. Preco'} - {item.description} ({item.quantity})</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PlanningLpsBridge({ activities, restrictions }: { activities: MasterActivity[]; restrictions: LpsRestriction[] }) {
  const mediumActivities = activities.filter((activity) => !activity.isMilestone && activity.level >= 1)
  const critical = mediumActivities.filter((activity) => /caminho critico|caminho crítico/i.test(activity.notes ?? ''))
  const openRestrictions = restrictions.filter((restriction) => restriction.status !== 'resolvida')
  const byNucleo = Array.from(mediumActivities.reduce((map, activity) => {
    const key = activity.nucleo || 'Sem núcleo'
    map.set(key, (map.get(key) ?? 0) + 1)
    return map
  }, new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]).slice(0, 6)

  return (
    <div className="border-b border-[#525252] bg-[#252525] px-6 py-4">
      <div className="grid gap-3 lg:grid-cols-[1.3fr,1fr,1fr]">
        <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#f97316]">Planejamento conectado ao LPS</p>
          <h2 className="mt-1 text-sm font-bold text-white">Médio prazo alimenta Lookahead, Semanal, Restrições e Pareto</h2>
          <p className="mt-2 text-xs leading-relaxed text-[#d4d4d4]">
            Cronogramas importados por MPP, XML ou Excel entram no Médio Prazo como Cronograma-base com WBS, núcleo, área, predecessoras e caminho crítico. O LPS usa estes mesmos campos para filtrar compromissos por núcleo, obra/projeto e tipo de serviço.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
          <MiniBridgeKpi label="Médio prazo" value={mediumActivities.length} />
          <MiniBridgeKpi label="Críticas" value={critical.length} tone="text-amber-300" />
          <MiniBridgeKpi label="Restrições" value={openRestrictions.length} tone={openRestrictions.length ? 'text-red-300' : 'text-emerald-300'} />
        </div>
        <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#d4d4d4]">Núcleos mais carregados</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {byNucleo.length > 0 ? byNucleo.map(([nucleo, total]) => (
              <span key={nucleo} className="rounded-full border border-[#525252] bg-[#1f1f1f] px-2 py-1 text-xs text-[#f5f5f5]">{nucleo}: {total}</span>
            )) : <span className="text-xs text-[#d4d4d4]">Importe um MPP, XML ou Excel do MS Project para iniciar.</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniBridgeKpi({ label, value, tone = 'text-white' }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[#d4d4d4]">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

function WorkspaceSwitch({ workspace, onChange }: { workspace: 'planejamento' | 'lps'; onChange: (workspace: 'planejamento' | 'lps') => void }) {
  const options = [
    { key: 'planejamento' as const, label: 'Planejamento', icon: BrainCircuit },
    { key: 'lps' as const, label: 'LPS / Lean', icon: Target },
  ]

  return (
    <div className="border-b border-[#525252] bg-[#252525] px-6 py-2">
      <div className="inline-flex rounded-lg border border-[#525252] bg-[#1f1f1f] p-1">
        {options.map((option) => {
          const Icon = option.icon
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold transition-colors ${
                workspace === option.key ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:bg-[#3a3a3a] hover:text-white'
              }`}
            >
              <Icon size={14} />
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
