/**
 * Roda a importação de funcionários contra a fixture e prova a coisa mais importante dela:
 * **nenhum documento pessoal chega ao objeto que é gravado.**
 *
 * A fixture é sintética e ADVERSARIAL — tem CPF, RG, CNH, título e antecedentes preenchidos, de
 * propósito. Sem isso, "nada proibido foi importado" seria indistinguível de "nada foi importado".
 *
 * ⚠️ Este script NUNCA imprime conteúdo de coluna nominal. Só contagem e nome de coluna. Ver a
 * seção "Risco aceito" do SECURITY.md: stdout de QA vai para o terminal E para o log de CI.
 *
 * Rode com:
 *   node --import ./scripts/testes/resolver-ts.mjs scripts/qa/qa-funcionarios.mjs
 */
import { readFileSync } from 'node:fs'
import { parseAndValidate } from '../../src/lib/importEngine.ts'
import { WORKER_IMPORT_CONFIG } from '../../src/lib/importConfigs.ts'
import { sanitizarFuncionarioImportado, PROIBIDO_NO_NOME } from '../../src/lib/funcionarioImportado.ts'

const CAMINHO = 'docs/FUNCIONARIOS-MODELO.xlsx'

let falhas = 0
const conferir = (ok, rotulo, detalhe = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FALHA'}  ${rotulo}${detalhe ? `  ${detalhe}` : ''}`)
  if (!ok) falhas++
}

console.log(`\n=== ${CAMINHO} ===`)

const buf = readFileSync(CAMINHO)
const arquivo = new File([buf], 'FUNCIONARIOS-MODELO.xlsx', {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
})

const r = await parseAndValidate(arquivo, WORKER_IMPORT_CONFIG)

console.log('\n-- leitura --')
conferir(r.porAba.length === 2, 'as DUAS abas foram lidas', `abas=${r.porAba.map((a) => a.aba).join(', ')}`)
conferir(r.validRows.length === 8, 'as 8 linhas entraram', `linhas=${r.validRows.length}`)
conferir(r.errors.length === 0, 'nenhum erro de leitura', r.errors.map((e) => e.message).join(' | '))

console.log('\n-- cabeçalho na linha 2 (banner na linha 1) --')
// ⚠️ A conferência era `headerRow === 1` — o literal. Quando o config passou para 'auto'
// (detecção por conteúdo, que resolve a mesma linha 2 E as planilhas com banner de outro tamanho)
// este QA caiu sem que nada tivesse quebrado de verdade. Agora confere o COMPORTAMENTO: o valor
// tem que ser uma linha fixa OU a detecção automática, e a prova de que acertou é a linha abaixo.
conferir(WORKER_IMPORT_CONFIG.headerRow === 1 || WORKER_IMPORT_CONFIG.headerRow === 'auto',
  'o config acha o cabeçalho (linha fixa ou detecção automática)', `headerRow=${WORKER_IMPORT_CONFIG.headerRow}`)
conferir(r.validRows.every((l) => typeof l.name === 'string' && l.name.length > 0),
  'toda linha tem nome — se o banner tivesse sido lido como cabeçalho, viriam vazias')

console.log('\n-- ⚠️ a porta que barra documento --')
const proibidosVistos = new Set()
let comProibido = 0
for (const linha of r.validRows) {
  const { limpo } = sanitizarFuncionarioImportado(linha)
  for (const chave of Object.keys(limpo)) {
    if (chave !== 'tipoCnh' && PROIBIDO_NO_NOME.test(chave)) { proibidosVistos.add(chave); comProibido++ }
  }
}
conferir(comProibido === 0, 'NENHUM campo de documento sobrevive à sanitização',
  proibidosVistos.size ? `vazaram: ${[...proibidosVistos].join(', ')}` : '')

// A contraprova: o que DEVE entrar entrou. Sem isto o teste acima passaria com tudo vazio.
const primeiro = sanitizarFuncionarioImportado(r.validRows[0]).limpo
conferir(!!primeiro.name && !!primeiro.role, 'nome e cargo entraram (contraprova do teste acima)')
conferir(r.validRows.some((l) => l.observacoes), 'observações entraram')

console.log('\n-- ⚠️ Tipo CNH: categoria sim, número não --')
const categorias = r.validRows.map((l) => l.tipoCnh)
const comCategoria = categorias.filter((c) => c === 'AB' || c === 'B' || c === 'A').length
const comNumero = categorias.filter((c) => c && /\d/.test(c)).length
conferir(comCategoria >= 4, 'as categorias A/B foram guardadas', `categorias=${comCategoria}`)
conferir(comNumero === 0, 'NENHUM número de CNH foi guardado como categoria', `números=${comNumero}`)
const nsa = categorias.filter((c) => c === undefined).length
conferir(nsa >= 3, 'NSA virou ausente, não string vazia', `ausentes=${nsa}`)

console.log('\n-- a aba vira frente de trabalho --')
const abas = r.porAba.map((a) => a.aba)
conferir(abas.includes('Equipes Sidnei') && abas.includes('Equipes Mauá'),
  'as duas frentes são distinguíveis — a "Equipe A" de uma não é a da outra')

console.log('\n-- o template baixável --')
const pedidos = [
  ...(WORKER_IMPORT_CONFIG.exampleHeaders ?? []),
  ...Object.keys(WORKER_IMPORT_CONFIG.exampleRow ?? {}),
]
const ehCategoria = (n) => /^(tipo|categoria)\s*cnh$/.test(String(n).toLowerCase().replace(/\s+/g, ' ').trim())
const pedeDocumento = pedidos.filter((n) => !ehCategoria(n) && PROIBIDO_NO_NOME.test(n))
conferir(pedeDocumento.length === 0, 'o modelo que o cliente baixa NÃO pede documento',
  pedeDocumento.length ? `pede: ${pedeDocumento.join(', ')}` : '')

console.log(falhas === 0 ? '\nTUDO CONFERE.\n' : `\n${falhas} FALHA(S).\n`)
process.exit(falhas === 0 ? 0 : 1)
