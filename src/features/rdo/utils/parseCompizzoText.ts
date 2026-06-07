/**
 * parseCompizzoText — extrai os campos do documento "DIÁRIO DE OBRA" da Compizzo
 * a partir de texto colado, marcando checkboxes e preenchendo tabelas/observações.
 * Reconhece também blocos genéricos (Mão de Obra) compatíveis com o Novo RDO.
 */
import type {
  RdoCompizzoServicos,
  RdoCompizzoOcorrencias,
  RdoCompizzoProducaoRow,
  RdoCompizzoMaterialRow,
} from '@/types'

export interface ParsedCompizzo {
  obra?: string
  data?: string
  diaObra?: string
  responsavelNome?: string
  responsavelData?: string
  condicaoClimatica?: 'sol' | 'nublado' | 'chuva' | 'outros'
  servicos: Partial<RdoCompizzoServicos>
  descricaoServicos?: string
  producao: RdoCompizzoProducaoRow[]
  materiais: RdoCompizzoMaterialRow[]
  ocorrencias: Partial<RdoCompizzoOcorrencias>
  observacoes?: string
  planejamentoProximoDia?: string
  employeeNames: string[]
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

const SERVICO_MAP: Record<string, keyof RdoCompizzoServicos> = {
  'limpeza da area': 'limpezaArea',
  'isolamento da area': 'isolamentoArea',
  'preparacao do piso': 'preparacaoPiso',
  'aplicacao de tinta vermelha': 'tintaVermelha',
  'aplicacao de tinta amarela': 'tintaAmarela',
  'demarcacao faixa branca': 'faixaBranca',
  'demarcacao faixa amarela': 'faixaAmarela',
  'demarcacao faixa vermelha': 'faixaVermelha',
  'pintura de vagas pcd': 'vagasPCD',
  'retoques': 'retoques',
  'limpeza final': 'limpezaFinal',
}

const OCORRENCIA_MAP: Record<string, keyof RdoCompizzoOcorrencias> = {
  'sem ocorrencias': 'semOcorrencias',
  'chuva': 'chuva',
  'area nao liberada': 'areaNaoLiberada',
  'interferencia de terceiros': 'interferenciaTerceiros',
  'falta de energia': 'faltaEnergia',
  'equipamento com defeito': 'equipamentoDefeito',
  'outros': 'outros',
}

/** "03/06/2026" → "2026-06-03" (retorna original se não casar) */
function toIsoDate(raw: string): string {
  const m = raw.trim().match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim()
  return ''
}

/** Linha marcada: começa com "x " ou contém caixa marcada. Retorna o rótulo. */
function checkedLabel(line: string): string | null {
  const t = line.trim()
  // "x Preparação do piso"  ou  "(x) Sol"  ou  "☑ ..."
  let m = t.match(/^[x✔☑]\s+(.*)$/i)
  if (m) return m[1].trim()
  m = t.match(/^\(x\)\s*(.*)$/i)
  if (m) return m[1].trim()
  return null
}

/** Detecta se a linha é um rótulo de checkbox (marcado ou não) e o texto. */
function anyCheckboxLabel(line: string): string | null {
  const t = line.trim()
  const m = t.match(/^(?:[x✔☑☐□]|\(\s*[x ]?\s*\))\s*(.*)$/i)
  return m ? m[1].trim() : null
}

type Section =
  | 'none' | 'maoDeObra' | 'servicos' | 'descricao' | 'producao'
  | 'materiais' | 'ocorrencias' | 'observacoes' | 'planejamento'

export function parseCompizzoText(text: string): ParsedCompizzo {
  const result: ParsedCompizzo = {
    servicos: {},
    ocorrencias: {},
    producao: [],
    materiais: [],
    employeeNames: [],
  }
  const descricaoLines: string[] = []
  const observacoesLines: string[] = []
  const planejamentoLines: string[] = []

  const lines = text.split(/\r?\n/)
  let section: Section = 'none'

  for (const rawLine of lines) {
    const line = rawLine.replace(/ /g, ' ')
    const n = norm(line)
    if (!n) continue

    // ── Section headers ──
    if (/^1[.)]?\s*mao de obra/.test(n)) { section = 'maoDeObra'; continue }
    if (/^2[.)]?\s*servicos executados/.test(n)) { section = 'servicos'; continue }
    if (/^descricao dos servicos/.test(n)) { section = 'descricao'; continue }
    if (/^3[.)]?\s*producao do dia/.test(n)) { section = 'producao'; continue }
    if (/^4[.)]?\s*materiais utilizados/.test(n)) { section = 'materiais'; continue }
    if (/^5[.)]?\s*ocorrencias/.test(n)) { section = 'ocorrencias'; continue }
    if (/^observacoes/.test(n)) { section = 'observacoes'; continue }
    if (/^(6[.)]?\s*registro fotografico)/.test(n)) { section = 'none'; continue }
    if (/^7[.)]?\s*planejamento para o proximo dia/.test(n)) { section = 'planejamento'; continue }
    if (/^condicoes climaticas/.test(n)) { section = 'none' }

    // ── Key/values (válidos em qualquer seção) ──
    let m: RegExpMatchArray | null
    if ((m = line.match(/^obra:\s*(.+)$/i))) { result.obra = m[1].trim(); continue }
    if ((m = line.match(/^dia da obra:\s*(.+)$/i))) { result.diaObra = m[1].trim(); continue }
    if ((m = line.match(/^data:\s*(.+)$/i))) {
      const iso = toIsoDate(m[1])
      if (section === 'planejamento' || result.responsavelNome) result.responsavelData = iso || m[1].trim()
      else result.data = iso || m[1].trim()
      continue
    }
    if ((m = line.match(/^respons[aá]vel:\s*(.+)$/i))) { result.responsavelNome = m[1].replace(/\s*-\s*arquiteto.*/i, '').trim(); continue }
    if ((m = line.match(/^nome:\s*(.+)$/i))) { result.responsavelNome = m[1].trim(); continue }

    // Condições climáticas (linhas tipo "(x) Sol")
    const clima = checkedLabel(line)
    if (clima) {
      const cn = norm(clima)
      if (cn.startsWith('sol')) { result.condicaoClimatica = 'sol' }
      else if (cn.startsWith('nublado')) { result.condicaoClimatica = 'nublado' }
      else if (cn.startsWith('chuva') && section === 'none') { result.condicaoClimatica = 'chuva' }
      else if (cn.startsWith('outros') && section === 'none') { result.condicaoClimatica = 'outros' }
    }

    // ── Section bodies ──
    switch (section) {
      case 'maoDeObra': {
        if (/^total de colaboradores/.test(n)) break
        // "Pedro Augusto - Arquiteto" / "Evandro Lima – Encarregado"
        const name = line.split(/[-–—]/)[0].trim()
        if (name && !/^total/i.test(name)) result.employeeNames.push(name)
        break
      }
      case 'servicos': {
        const label = anyCheckboxLabel(line)
        if (label) {
          const key = SERVICO_MAP[norm(label)]
          if (key) result.servicos[key] = checkedLabel(line) !== null
        }
        break
      }
      case 'descricao': {
        if (!/^descricao dos servicos/.test(n)) descricaoLines.push(line.trim())
        break
      }
      case 'producao': {
        // "Pintura Vermelha (m²)   120"  → separa rótulo e (opcional) quantidade
        if (/^servico\s+quantidade/.test(n)) break
        const qm = line.trim().match(/^(.*?)[\s.]+([\d.,]+)\s*$/)
        if (qm && /\d/.test(qm[2])) result.producao.push({ servico: qm[1].trim(), quantidade: qm[2].trim() })
        else result.producao.push({ servico: line.trim(), quantidade: '' })
        break
      }
      case 'materiais': {
        if (/^material\s+quantidade/.test(n)) break
        const qm = line.trim().match(/^(.*?)[\s.]+([\d.,]+)\s*$/)
        if (qm && /\d/.test(qm[2])) result.materiais.push({ material: qm[1].trim(), quantidade: qm[2].trim() })
        else result.materiais.push({ material: line.trim(), quantidade: '' })
        break
      }
      case 'ocorrencias': {
        const label = anyCheckboxLabel(line)
        if (label) {
          const key = OCORRENCIA_MAP[norm(label)]
          if (key) result.ocorrencias[key] = checkedLabel(line) !== null
        }
        break
      }
      case 'observacoes': {
        observacoesLines.push(line.trim())
        break
      }
      case 'planejamento': {
        if (/^respons[aá]vel pela obra/.test(n)) { section = 'none'; break }
        planejamentoLines.push(line.trim())
        break
      }
    }
  }

  if (descricaoLines.length) result.descricaoServicos = descricaoLines.join('\n').trim()
  if (observacoesLines.length) result.observacoes = observacoesLines.join('\n').trim()
  if (planejamentoLines.length) result.planejamentoProximoDia = planejamentoLines.join('\n').trim()

  return result
}
