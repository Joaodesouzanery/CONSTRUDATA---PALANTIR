import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import xlsx from 'xlsx'

const XLSX = xlsx.default ?? xlsx

const rootDir = 'F:\\'
const outputArg = process.argv.includes('--write')
  ? process.argv[process.argv.indexOf('--write') + 1]
  : ''

const fixtures = [
  ['fornecedor', 'A.A VIANA.xlsx'],
  ['fornecedor', '3 F ATUALIZADO.xlsx'],
  ['fornecedor', 'CORRENTEZA 1.xlsx'],
  ['fornecedor', 'CALMAQ.xlsx'],
  ['fornecedor', 'COMPASS.xlsx'],
  ['fornecedor', 'ANDRAUS.xlsx'],
  ['fornecedor', 'ANDRAUS 2.xlsx'],
  ['fornecedor', 'ANDRAUS 3.xlsx'],
  ['fornecedor', 'ANDRAUS 4.xlsx'],
  ['fornecedor', 'ANDRAUS 5.xlsx'],
  ['fornecedor', 'APJSERV.xlsx'],
  ['subempreiteiro', 'SLNR MEDIÇÃO CHIRA - MAR.26 - REV01 - 10.04.26.xlsx'],
  ['subempreiteiro', 'SLNR MEDIÇÃO CONSTR. SUL- MAR.26 - REV01.xlsx'],
  ['subempreiteiro', 'SLNR MEDIÇÃO RK - mar.26- rev01 - 01.04.26.xlsx'],
  ['subempreiteiro', 'SLNR MEDIÇÃO THL - MAR- REV00 - 01.04.26.xlsx'],
  ['subempreiteiro', 'SLNR MEDIÇÃO VF - MAR.26 - REV00 - 01.04.26.xlsx'],
  ['subempreiteiro', 'SLNR MEDIÇÃO VIALTA  - mar.26 - REV00 - 01.04.26.xlsx'],
]

const norm = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ')
  .trim()

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const clean = String(value ?? '')
    .replace(/R\$\s?/g, '')
    .replace(/[()]/g, '')
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '')
  if (!clean || clean === '-' || clean === ',' || clean === '.') return 0
  if (clean.includes(',') && clean.includes('.')) {
    return clean.lastIndexOf(',') > clean.lastIndexOf('.')
      ? Number.parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0
      : Number.parseFloat(clean.replace(/,/g, '')) || 0
  }
  return Number.parseFloat(clean.replace(',', '.')) || 0
}

function readRows(wb, sheetName) {
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false })
}

function formulaIssues(wb) {
  const issues = []
  const errorPattern = /#(VALUE|REF|DIV\/0|N\/A|NAME|NUM|NULL)!?/i
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    const ref = sheet?.['!ref']
    if (!sheet || !ref) continue
    const range = XLSX.utils.decode_range(ref)
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      for (let col = range.s.c; col <= range.e.c; col += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col })
        const cell = sheet[address]
        const displayed = String(cell?.w ?? cell?.v ?? '').trim()
        if (cell?.t === 'e' || errorPattern.test(displayed)) issues.push(`${sheetName}!${address}: ${displayed || '#ERROR'}`)
      }
    }
  }
  return issues
}

function sheetKind(name) {
  const n = norm(name)
  if (/^mc$|memoria/.test(n)) return 'memoria'
  if (/^nfs(\s|$)|^nf(\s|$)|notas fiscais/.test(n)) return 'nfs'
  if (/desconto/.test(n)) return 'descontos'
  if (/retencao|reten/.test(n)) return 'retencao'
  if (/resumo|fechamento/.test(n)) return 'resumo'
  if (/^medicao(\s|$)|detalhado|controle.*medicao/.test(n)) return 'medicao'
  if (/mat.*epi|mat.*ferr|agregado|maquina|servico|veiculo|combustivel|loc.*equip/.test(n)) return 'custos'
  return 'outras'
}

function scanTotals(wb) {
  const totals = {
    aprovado: 0,
    nf: 0,
    descontos: 0,
    adiantamento: 0,
    fechamentoAnterior: 0,
    retencao: 0,
    medicao: 0,
    memoria: 0,
  }
  for (const sheetName of wb.SheetNames) {
    const kind = sheetKind(sheetName)
    for (const row of readRows(wb, sheetName)) {
      const text = norm(row.join(' '))
      const values = row.map(toNumber).filter((value) => value > 0 && value < 100_000_000_000)
      const value = values.at(-1) ?? 0
      if (/aprovad/.test(text)) totals.aprovado = Math.max(totals.aprovado, value)
      if (/valor.*nf|nota fiscal/.test(text)) totals.nf = Math.max(totals.nf, value)
      if (/total.*desconto|desconto/.test(text)) totals.descontos = Math.max(totals.descontos, value)
      if (/adiantamento/.test(text)) totals.adiantamento = Math.max(totals.adiantamento, value)
      if (/fechamento.*anterior/.test(text)) totals.fechamentoAnterior = Math.max(totals.fechamentoAnterior, value)
      if (/retencao|reten/.test(text)) totals.retencao = Math.max(totals.retencao, value)
      if (kind === 'medicao') totals.medicao += values.reduce((sum, item) => sum + item, 0)
      if (kind === 'memoria') totals.memoria += values.reduce((sum, item) => sum + item, 0)
    }
  }
  return totals
}

function auditFixture([group, filename]) {
  const filepath = path.join(rootDir, filename)
  if (!fs.existsSync(filepath)) {
    return { group, filename, exists: false, readyForPreview: false, criticalIssues: ['Arquivo nao encontrado'] }
  }
  const wb = XLSX.readFile(filepath, { cellFormula: true, cellNF: true, cellStyles: false })
  const counts = Object.fromEntries(['resumo', 'medicao', 'memoria', 'nfs', 'descontos', 'retencao', 'custos', 'outras'].map((kind) => [kind, 0]))
  for (const sheetName of wb.SheetNames) counts[sheetKind(sheetName)] += readRows(wb, sheetName).filter((row) => row.some(Boolean)).length
  const warnings = []
  if (group === 'fornecedor' && counts.memoria === 0) warnings.push('Sem aba MC/MEMORIA: importar como rascunho conferivel.')
  if (group === 'subempreiteiro' && counts.medicao === 0) warnings.push('Sem aba MEDICAO reconhecida.')
  const errors = formulaIssues(wb)
  const criticalIssues = [...warnings, ...errors.map((item) => `Formula pendente: ${item}`)]
  return {
    group,
    filename,
    exists: true,
    readyForPreview: counts.medicao > 0 || counts.memoria > 0 || counts.resumo > 0,
    readyForAutoClose: criticalIssues.length === 0,
    sheets: wb.SheetNames,
    rowCounts: counts,
    totals: scanTotals(wb),
    formulaErrorCount: errors.length,
    criticalIssues,
  }
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  rootDir,
  fixtures: fixtures.map(auditFixture),
}

snapshot.summary = {
  total: snapshot.fixtures.length,
  missing: snapshot.fixtures.filter((item) => !item.exists).length,
  previewReady: snapshot.fixtures.filter((item) => item.readyForPreview).length,
  autoCloseReady: snapshot.fixtures.filter((item) => item.readyForAutoClose).length,
  criticalIssues: snapshot.fixtures.reduce((sum, item) => sum + item.criticalIssues.length, 0),
}

if (outputArg) {
  fs.mkdirSync(path.dirname(outputArg), { recursive: true })
  fs.writeFileSync(outputArg, `${JSON.stringify(snapshot, null, 2)}\n`)
}

console.log(JSON.stringify(snapshot.summary, null, 2))
for (const item of snapshot.fixtures) {
  console.log(`${item.exists ? 'OK' : 'MISSING'} ${item.group} ${item.filename}: sheets=${item.sheets?.length ?? 0} issues=${item.criticalIssues.length}`)
}
