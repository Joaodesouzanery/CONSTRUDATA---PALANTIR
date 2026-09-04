/**
 * Gera `docs/FUNCIONARIOS-MODELO.xlsx` — a fixture do QA de importação de funcionários.
 *
 * ─── POR QUE SINTÉTICA ────────────────────────────────────────────────────────
 * A planilha real do cliente tem CPF, RG, CNH e título de eleitor de pessoas de verdade, e o
 * `SECURITY.md` proíbe commitar isso. Mas o motivo não é só esse: a sintética **prova mais**.
 * A real não tem os casos que o teste precisa — uma categoria de CNH preenchida com o NÚMERO,
 * uma equipe que não existe no cadastro, um nome com espaço duplo. Aqui esses casos são postos
 * de propósito.
 *
 * ⚠️ As colunas proibidas ESTÃO no arquivo, preenchidas. É isso que dá valor ao teste: sem elas,
 * "nenhum dado proibido foi importado" seria indistinguível de "não havia dado proibido".
 *
 * ⚠️ Determinístico: nada de Math.random nem new Date. Rodar duas vezes tem de dar o mesmo
 * arquivo, senão o QA passa a depender do dia.
 *
 * Uso:  node scripts/gerar-fixture-funcionarios.mjs
 */
import xlsx from 'xlsx'

const CABECALHOS = [
  'EQUIPE', 'NOME', 'CPF', 'RG', 'CNH', 'TIPO CNH', 'TÍTULO',
  'CARGO', 'TELEFONE', 'EXAME', 'CTPS', 'RESIDÊNCIA', 'RESERVISTA',
  'ANTECEDENTES', 'CONTA', 'OBSERVAÇÕES',
]

/** O banner mesclado da linha 1 — é ele que faz o cabeçalho cair na linha 2. */
const BANNER = ['', 'DADOS', '', '', '', '', '', '', '', '', 'DOCUMENTOS', '', '', '', 'OBS', '']

const SIDNEI = [
  ['Encarregado', 'Sidnei Ficticio dos Santos', '000.000.000-00', '00000000-0', '00000000000', 'A/B', '000000000000', 'Encarregado', '24 90000-0000', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'responde pela frente'],
  ['A', 'Ricardo Ficticio da Silva', '000.000.000-01', '00000000-1', 'NSA', 'NSA', '000000000001', 'Ajudante geral', '13 90000-0001', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', ''],
  ['A', 'Jean Ficticio de Oliveira', '000.000.000-02', '00000000-2', '00000000002', 'A/B', '000000000002', 'Encanador motorizado', '13 90000-0002', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', ''],
  ['B', 'Paulo  Ficticio  de Paula', '000.000.000-03', '00000000-3', 'NSA', 'NSA', '', 'Pedreiro', '13 90000-0003', 'PENDENTE', '', 'OK', 'NSA', 'OK', '', 'exame vencido'],
  // ⚠️ Caso adversarial: a categoria veio preenchida com o NÚMERO da CNH. Tem de ser recusada.
  ['B', 'Kaua Ficticio Rodrigues', '000.000.000-04', '00000000-4', '00000000004', '00000000004', '000000000004', 'Ajudante geral', '13 90000-0004', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', ''],
  // ⚠️ Equipe que não existe no cadastro — o import tem de reportar, não travar.
  ['Z', 'Marcelo Ficticio de Araujo', '000.000.000-05', '00000000-5', '00000000005', 'A/B', '000000000005', 'Encanador motorizado', '49 90000-0005', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', ''],
]

const MAUA = [
  ['A', 'Jerailson Ficticio da Silva', '000.000.000-10', '00000000-9', '00000000010', 'B', '000000000010', 'Encanador', '11 90000-0010', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'frente Mauá'],
  ['A', 'Egmar Ficticio Pinto', '000.000.000-11', '00000000-8', 'NSA', 'NSA', '000000000011', 'Ajudante geral', '11 90000-0011', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', ''],
]

function aba(linhas) {
  return xlsx.utils.aoa_to_sheet([BANNER, CABECALHOS, ...linhas])
}

const wb = xlsx.utils.book_new()
xlsx.utils.book_append_sheet(wb, aba(SIDNEI), 'Equipes Sidnei')
xlsx.utils.book_append_sheet(wb, aba(MAUA), 'Equipes Mauá')

const destino = 'docs/FUNCIONARIOS-MODELO.xlsx'
xlsx.writeFile(wb, destino)

console.log(`Fixture gerada: ${destino}`)
console.log(`  2 abas · ${SIDNEI.length + MAUA.length} linhas · ${CABECALHOS.length} colunas`)
console.log('  ⚠️ Nomes fictícios. Colunas proibidas preenchidas DE PROPÓSITO, para o QA provar que são barradas.')
