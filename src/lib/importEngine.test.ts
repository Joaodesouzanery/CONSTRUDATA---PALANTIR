/**
 * O motor de importação é usado por SEIS módulos. Este arquivo existe porque ele foi reescrito
 * para ler várias abas e cabeçalho fora da primeira linha, e uma regressão aqui quebraria
 * Orçamento, Trechos, Obras, Funcionários, Apontamentos e Fornecedores de uma vez — sem que
 * nenhum teste deles percebesse, porque nenhum deles testa o motor.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { parseAndValidate, z, type ImportConfig } from './importEngine.ts'

type Linha = { nome: string; qtd: number } & Record<string, unknown>

const CONFIG: ImportConfig<Linha> = {
  schema: z.object({ nome: z.string().min(1), qtd: z.number().default(0) }),
  columns: [
    { key: 'nome', headerAliases: ['nome'], type: 'string', required: true },
    { key: 'qtd',  headerAliases: ['qtd'],  type: 'number', defaultValue: 0 },
  ],
}

/** Monta um .xlsx de verdade em memória e embrulha num File, como o navegador entrega. */
function arquivo(abas: Record<string, unknown[][]>, nome = 'teste.xlsx'): File {
  const wb = XLSX.utils.book_new()
  for (const [aba, linhas] of Object.entries(abas)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), aba)
  }
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([buf], nome, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ─── o comportamento de sempre, que não pode ter mudado ──────────────────────

test('sem opção nenhuma: primeira aba, cabeçalho na primeira linha', async () => {
  const r = await parseAndValidate(arquivo({
    Dados:  [['nome', 'qtd'], ['Ana', 3], ['Bruno', 5]],
    Outra:  [['nome', 'qtd'], ['NÃO DEVE ENTRAR', 9]],
  }), CONFIG)
  assert.equal(r.errors.length, 0)
  assert.deepEqual(r.validRows.map((l) => l.nome), ['Ana', 'Bruno'])
  assert.equal(r.totalProcessed, 2)
})

test('porAba existe mesmo no caso de uma aba só', async () => {
  const r = await parseAndValidate(arquivo({ Dados: [['nome'], ['Ana']] }), CONFIG)
  assert.equal(r.porAba.length, 1)
  assert.equal(r.porAba[0].aba, 'Dados')
  assert.deepEqual(r.porAba[0].linhas.map((l) => l.nome), ['Ana'])
})

test('cabeçalho obrigatório ausente é reportado', async () => {
  const r = await parseAndValidate(arquivo({ Dados: [['outra coisa'], ['x']] }), CONFIG)
  assert.equal(r.validRows.length, 0)
  assert.match(r.errors[0].message, /Cabeçalhos obrigatórios ausentes/)
})

test('linha sem campo obrigatório vira erro com o número da linha', async () => {
  const r = await parseAndValidate(arquivo({ Dados: [['nome', 'qtd'], ['', 1], ['Ana', 2]] }), CONFIG)
  assert.equal(r.validRows.length, 1)
  assert.equal(r.errors.length, 1)
  assert.equal(r.errors[0].rowNumber, 2)
})

test('arquivo de tipo não suportado é recusado antes de qualquer leitura', async () => {
  const f = new File(['bla'], 'x.pdf', { type: 'application/pdf' })
  const r = await parseAndValidate(f, CONFIG)
  assert.match(r.errors[0].message, /não suportado/)
  assert.deepEqual(r.porAba, [])
})

// ─── o que é novo ────────────────────────────────────────────────────────────

test("sheets:'todas' lê todas as abas e diz de qual veio cada linha", async () => {
  const r = await parseAndValidate(arquivo({
    'Equipes Sidnei': [['nome', 'qtd'], ['Ana', 1]],
    'Equipes Mauá':   [['nome', 'qtd'], ['Bruno', 2]],
  }), { ...CONFIG, sheets: 'todas' })
  assert.equal(r.validRows.length, 2)
  assert.deepEqual(r.porAba.map((a) => a.aba), ['Equipes Sidnei', 'Equipes Mauá'])
  assert.equal(r.porAba[1].linhas[0].nome, 'Bruno')
})

test('⚠️ aba fora do formato NÃO descarta as outras', async () => {
  const r = await parseAndValidate(arquivo({
    Boa:  [['nome', 'qtd'], ['Ana', 1]],
    Ruim: [['zzz'], ['x']],
  }), { ...CONFIG, sheets: 'todas' })
  assert.deepEqual(r.validRows.map((l) => l.nome), ['Ana'], 'a aba boa tem de sobreviver')
  assert.equal(r.errors.length, 1)
  assert.match(r.errors[0].message, /\[Ruim\]/, 'o erro diz de qual aba é')
})

test('headerRow pula o banner e acha o cabeçalho de verdade', async () => {
  const r = await parseAndValidate(arquivo({
    Dados: [['DADOS', null], ['nome', 'qtd'], ['Ana', 7]],
  }), { ...CONFIG, headerRow: 1 })
  assert.equal(r.errors.length, 0)
  assert.deepEqual(r.validRows, [{ nome: 'Ana', qtd: 7 }])
})

test('⚠️ sem headerRow, o mesmo arquivo com banner NÃO é lido — é a prova de que a opção faz algo', async () => {
  const r = await parseAndValidate(arquivo({
    Dados: [['DADOS', null], ['nome', 'qtd'], ['Ana', 7]],
  }), CONFIG)
  assert.equal(r.validRows.length, 0)
})

test('o número da linha do erro considera o banner pulado', async () => {
  const r = await parseAndValidate(arquivo({
    Dados: [['DADOS', null], ['nome', 'qtd'], ['', 1]],
  }), { ...CONFIG, headerRow: 1 })
  assert.equal(r.errors[0].rowNumber, 3, 'a linha vazia é a 3 do arquivo, não a 2')
})

test('as duas abas com o mesmo nome de equipe não se fundem — a aba viaja junto', async () => {
  const r = await parseAndValidate(arquivo({
    'Equipes Sidnei': [['nome', 'qtd'], ['A', 1]],
    'Equipes Mauá':   [['nome', 'qtd'], ['A', 2]],
  }), { ...CONFIG, sheets: 'todas' })
  assert.equal(r.porAba.length, 2)
  assert.notEqual(r.porAba[0].aba, r.porAba[1].aba)
})
