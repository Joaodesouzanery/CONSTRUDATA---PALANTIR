import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizarFuncionarioImportado,
  CAMPOS_DO_FUNCIONARIO_IMPORTADO,
  PROIBIDO_NO_NOME,
} from './funcionarioImportado.ts'
import { WORKER_IMPORT_CONFIG } from './importConfigs.ts'

/**
 * ⚠️ A fixture é ADVERSARIAL de propósito: ela CONTÉM todos os campos proibidos, preenchidos.
 *
 * Sem isso o teste não vale nada — "nenhum dado proibido foi gravado" ficaria indistinguível de
 * "nenhum dado foi gravado". É a diferença entre provar que a porta está trancada e constatar que
 * ninguém tentou entrar.
 *
 * Os números são fictícios; os NOMES DE COLUNA são os da planilha real do cliente.
 */
const LINHA_ADVERSARIAL: Record<string, unknown> = {
  // o que PODE entrar
  name: 'Sidnei José da Silva',
  role: 'Encarregado',
  crewId: 'A',
  phone: '13 99999-0000',
  tipoCnh: 'AB',
  observacoes: 'trabalha na frente norte',
  workFront: 'Sidnei',
  // o que NÃO pode — todos preenchidos
  cpf: '000.000.000-00',
  cpfMasked: '***.***.***-00',
  rg: '00000000-0',
  RG: '00000000-0',
  cnh: '00000000000',
  'tipo cnh numero': '00000000000',
  titulo: '000000000000',
  tituloEleitor: '000000000000',
  antecedentes: 'OK',
  exame: 'PENDENTE',
  aso: 'OK',
  conta: '0000-0',
  contaBancaria: '0000-0',
  reservista: 'OK',
  ctps: '0000000',
  certifications: [{ id: 'x' }],
  biometricToken: 'abc',
  id: 'id-que-nao-e-nosso',
}

test('⚠️ NENHUM campo proibido sobrevive à sanitização', () => {
  const { limpo } = sanitizarFuncionarioImportado(LINHA_ADVERSARIAL)
  const sobreviventes = Object.keys(limpo).filter((k) => k !== 'tipoCnh' && PROIBIDO_NO_NOME.test(k))
  assert.deepEqual(sobreviventes, [], 'campo com cara de documento chegou ao objeto gravado')

  for (const proibido of ['cpf', 'cpfMasked', 'rg', 'RG', 'cnh', 'titulo', 'tituloEleitor',
                          'antecedentes', 'exame', 'aso', 'conta', 'contaBancaria', 'reservista',
                          'ctps', 'certifications', 'biometricToken', 'id']) {
    assert.equal(limpo[proibido], undefined, `"${proibido}" não pode entrar`)
  }
})

test('e o que DEVE entrar entrou — senão o teste acima passaria com o objeto vazio', () => {
  const { limpo } = sanitizarFuncionarioImportado(LINHA_ADVERSARIAL)
  assert.equal(limpo.name, 'Sidnei José da Silva')
  assert.equal(limpo.role, 'Encarregado')
  assert.equal(limpo.crewId, 'A')
  assert.equal(limpo.phone, '13 99999-0000')
  assert.equal(limpo.tipoCnh, 'AB')
  assert.equal(limpo.observacoes, 'trabalha na frente norte')
  assert.equal(limpo.workFront, 'Sidnei')
})

test('a sanitização relata o que barrou, em vez de descartar calada', () => {
  const { ignorados } = sanitizarFuncionarioImportado(LINHA_ADVERSARIAL)
  assert.ok(ignorados.includes('cpf'))
  assert.ok(ignorados.includes('antecedentes'))
  assert.ok(ignorados.length >= 15)
})

test('⚠️ a lista de campos permitidos não contém nome de documento', () => {
  // `tipoCnh` é a ÚNICA exceção, e é declarada: guarda a categoria (A/B), nunca o número.
  const suspeitos = CAMPOS_DO_FUNCIONARIO_IMPORTADO.filter(
    (c) => c !== 'tipoCnh' && PROIBIDO_NO_NOME.test(c),
  )
  assert.deepEqual(suspeitos, [])
})

test('⚠️ o TEMPLATE baixável não pede documento nenhum', () => {
  // `downloadTemplate` monta o cabeçalho a partir de `exampleHeaders`, NÃO de `columns` — tirar a
  // coluna do importador e esquecer o exemplo deixaria o produto continuar PEDINDO o CPF.
  const cabecalhos = WORKER_IMPORT_CONFIG.exampleHeaders ?? []
  const exemplo = Object.keys(WORKER_IMPORT_CONFIG.exampleRow ?? {})
  const colunas = WORKER_IMPORT_CONFIG.columns.flatMap((c) => [String(c.key), ...c.headerAliases])

  // A única exceção declarada: os rótulos da CATEGORIA da habilitação. Comparada sem depender de
  // grafia — 'tipoCnh', 'tipo cnh' e 'tipocnh' são a mesma coluna.
  const ehCategoriaDeCnh = (n: string) =>
    /^(tipo|categoria)\s*cnh$/.test(n.toLowerCase().replace(/\s+/g, ' ').trim())
      || n.toLowerCase() === 'categoria'

  for (const [onde, lista] of [['exampleHeaders', cabecalhos], ['exampleRow', exemplo], ['columns', colunas]] as const) {
    const maus = lista.filter((n) => !ehCategoriaDeCnh(n) && PROIBIDO_NO_NOME.test(n))
    assert.deepEqual(maus, [], `${onde} ainda pede documento: ${maus.join(', ')}`)
  }
})

test('o importador detecta o cabeçalho e prioriza a aba oficial', () => {
  assert.equal(WORKER_IMPORT_CONFIG.sheets, 'todas')
  assert.equal(WORKER_IMPORT_CONFIG.headerRow, 'auto')
  assert.deepEqual(WORKER_IMPORT_CONFIG.preferredSheets, ['HORAS EXTRAS AGOSTO'])
})

test('⚠️ "Tipo CNH" guarda a categoria e RECUSA número', () => {
  const col = WORKER_IMPORT_CONFIG.columns.find((c) => c.key === 'tipoCnh')
  assert.ok(col?.transform)
  const t = col.transform!
  assert.equal(t('AB'), 'AB')
  assert.equal(t('A/B'), 'AB')
  assert.equal(t('a'), 'A')
  // NSA vira ausente, não string vazia: "não se aplica" ≠ "esqueceram de preencher".
  assert.equal(t('NSA'), undefined)
  assert.equal(t(''), undefined)
  assert.equal(t('-'), undefined)
  // e o número da CNH, que na planilha do cliente está na coluna VIZINHA, é recusado
  assert.equal(t('00000000000'), undefined)
  assert.equal(t('07126297000'), undefined)
})

test('linha sem nada aproveitável devolve objeto vazio, não lixo', () => {
  const { limpo } = sanitizarFuncionarioImportado({ cpf: '1', rg: '2' })
  assert.deepEqual(limpo, {})
})

test('valor undefined não vira chave', () => {
  const { limpo } = sanitizarFuncionarioImportado({ name: 'Ana', phone: undefined })
  assert.deepEqual(Object.keys(limpo), ['name'])
})
