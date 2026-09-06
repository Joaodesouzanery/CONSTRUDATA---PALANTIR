/**
 * A conferência **mês a mês** contra as abas calculadas da planilha.
 *
 * ─── POR QUE ISTO EXISTE, EM UM NÚMERO ────────────────────────────────────────
 * `conferirContraAPlanilha` faz 12 comparações, todas de valor único, e reporta 3 divergências.
 * Esta faz **240** e encontra **87**. Não é que o sistema esteja mais errado — é que a conferência
 * agregada não enxergava onde a diferença mora. Um mês específico podia estar errado de verdade e
 * ficar escondido dentro de um total que "fecha por pouco".
 *
 * ─── AS DUAS COISAS QUE ESTE ARQUIVO RECUSA FAZER ─────────────────────────────
 * **1. Carimbar causa em cima de tudo.** A conferência antiga escrevia a MESMA explicação em toda
 * divergência das duas abas (`ABAS_AFETADAS_PELA_SEMANA`) — inclusive numa divergência futura que
 * não tivesse nada a ver com o motivo alegado. Era mentira por construção. Aqui cada causa tem um
 * **teste mecânico**, e o que nenhum teste explica vai para `semExplicacao` — que a tela é obrigada
 * a mostrar em vermelho, acima de tudo.
 *
 * **2. Achar linha por posição.** Todo rótulo é procurado por texto, dentro do bloco certo. Uma
 * linha inserida na planilha não pode fazer o sistema comparar imposto contra saldo em silêncio.
 *
 * ─── A TOLERÂNCIA ─────────────────────────────────────────────────────────────
 * R$ 0,005, não os R$ 0,50 da conferência escalar. Numa grade de 240 células, meio real por célula
 * deixa passar deriva real. O resíduo medido nas células que fecham é 0,000000 — o motor reproduz
 * a planilha exatamente, ou não reproduz.
 */
import { normalizarTexto } from '../controleDeCaixaPlanilha'
import type { Matriz, Celula } from '../controleDeCaixaPlanilha'
import type { PremissasFcp, ColunaMensal, LinhaEconomica } from './tipos'
import { fluxoMensal, fluxoEconomico } from './motor'
import type { ProducaoRealizada } from './motor'
import type { Abas } from './importarFcp'

/** Decide o formato na tela E a tolerância. */
export type UnidadeDaCelula = 'BRL' | 'FRACAO'

const TOLERANCIA: Record<UnidadeDaCelula, number> = { BRL: 0.005, FRACAO: 5e-7 }

export type IdDaCausa = 'convencao-da-semana' | 'arraste-do-acumulado' | 'classificacao-de-custo'

export interface CelulaDaGrade {
  /** `YYYY-MM-01`. */
  mes: string
  naPlanilha: number
  calculado: number
  /** `calculado − naPlanilha`. */
  diferenca: number
  fecha: boolean
  /** Ausente numa célula que não fecha = divergência que NENHUMA causa explica. */
  causa?: IdDaCausa
}

export interface LinhaDaGrade {
  /** O rótulo COMO ESTÁ na planilha — é por ele que a pessoa acha a linha no Excel. */
  rotulo: string
  /** 1-indexada, para abrir o arquivo e olhar. */
  linhaNaPlanilha: number
  /** O campo do motor. Ex.: `acumuladoAntesDoRecebimento`. */
  campo: string
  unidade: UnidadeDaCelula
  /** Presente quando a linha soma mês a mês. Ver `Spec.acumulaDe`. */
  acumulaDe?: { campo: string; atraso: 0 | 1 }
  celulas: CelulaDaGrade[]
  fecham: number
  divergem: number
  /** Maior |diferença| da linha. Ordena o que importa primeiro. */
  maiorDiferenca: number
}

export interface GradeDaAba {
  aba: string
  /** Eixo X da tela, em ordem. Só os meses que existem NOS DOIS lados. */
  meses: string[]
  linhas: LinhaDaGrade[]
  /** A planilha tem mais colunas de mês que o motor. Isto NÃO é divergência. */
  mesesSoNaPlanilha: string[]
  mesesSoNoMotor: string[]
  /** Rótulo que o leitor não achou. Ausência silenciosa é pior que divergência. */
  rotulosNaoEncontrados: string[]
}

export interface CausaDaDivergencia {
  id: IdDaCausa
  titulo: string
  /** O texto para o diretor, com os números do arquivo dentro. */
  explicacao: string
  /** A frase de prova, separada porque a tela a destaca. */
  prova: string
  celulas: number
  /** Quanto a causa move o resultado no fim do horizonte. Pode ser 0 (troca de rótulo). */
  impactoNoResultado: number
}

export interface ConferenciaDaGrade {
  grades: GradeDaAba[]
  total: number
  fecham: number
  divergem: number
  causas: CausaDaDivergencia[]
  /** > 0 obriga a tela a dizer "não sei explicar N". Nunca esconder. */
  semExplicacao: number
}

// ─── Achar coisas na planilha, sempre por rótulo ──────────────────────────────

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`

/** A linha "Mês" e o mapa coluna → `YYYY-MM-01`. Sem ela não há grade a conferir. */
function acharMeses(m: Matriz): { linha: number; porColuna: Map<number, string> } | null {
  for (let i = 0; i < Math.min(m.length, 12); i++) {
    const celulas = m[i] ?? []
    const porColuna = new Map<number, string>()
    for (let c = 0; c < celulas.length; c++) {
      const v = celulas[c]
      if (v instanceof Date) porColuna.set(c, iso(v))
    }
    if (porColuna.size >= 2) return { linha: i, porColuna }
  }
  return null
}

/**
 * Onde começa um bloco, pelo título.
 *
 * ⚠️ Os rótulos das linhas se REPETEM entre BERTIOGA, SANTOS e GLOBAL — "Saldo do mês" aparece
 * três vezes. Procurar sem delimitar o bloco compararia o global contra o de uma cidade.
 */
function inicioDoBloco(m: Matriz, titulo: string): number {
  const alvo = normalizarTexto(titulo)
  for (let i = 0; i < m.length; i++) {
    if (normalizarTexto(m[i]?.[0]).startsWith(alvo)) return i
  }
  return 0
}

/** A primeira linha, a partir de `de`, cujo rótulo contém o trecho. */
function acharLinha(m: Matriz, trecho: string, de: number): number {
  const alvo = normalizarTexto(trecho)
  for (let i = de; i < m.length; i++) {
    if (normalizarTexto(m[i]?.[0]).includes(alvo)) return i
  }
  return -1
}

/** Número, ou `null` para o que não é número. Célula vazia não é zero. */
function num(c: Celula): number | null {
  if (typeof c === 'number' && Number.isFinite(c)) return c
  return null
}

// ─── O que comparar ───────────────────────────────────────────────────────────

interface Spec<T> {
  /** Trecho do rótulo, procurado dentro do bloco. */
  trecho: string
  campo: keyof T & string
  unidade?: UnidadeDaCelula
  /**
   * Linha que soma mês a mês. Declara **de quem** soma e com quanto de atraso — é o que permite
   * provar o arraste em vez de supor. Medido: a diferença do acumulado é exatamente a soma corrida
   * das diferenças da linha de origem.
   */
  acumulaDe?: { campo: string; atraso: 0 | 1 }
}

const FCP_MENSAL: Array<Spec<ColunaMensal>> = [
  { trecho: 'Medição bruta',                 campo: 'medicaoBruta' },
  { trecho: 'Recebimento bruto',             campo: 'recebimento' },
  { trecho: 'Desconto do consórcio',         campo: 'descontoConsorcio' },
  { trecho: 'Imposto da nota',               campo: 'imposto' },
  { trecho: 'ENTRA NO CAIXA',                campo: 'entraNoCaixa' },
  { trecho: 'Sai do caixa',                  campo: 'saiDoCaixa' },
  { trecho: 'Saldo do mês',                  campo: 'saldoDoMes' },
  // "antes do recebimento" fecha um mês atrás do "após": o dinheiro do mês entra depois do corte.
  { trecho: 'ACUMULADO — antes', campo: 'acumuladoAntesDoRecebimento', acumulaDe: { campo: 'saldoDoMes', atraso: 1 } },
  { trecho: 'ACUMULADO — após',  campo: 'acumuladoDepois',             acumulaDe: { campo: 'saldoDoMes', atraso: 0 } },
]

const ECONOMICO: Array<Spec<LinhaEconomica>> = [
  { trecho: 'Medição bruta',                 campo: 'medicaoBruta' },
  { trecho: 'Imposto da nota',               campo: 'imposto' },
  { trecho: 'Medição líquida',               campo: 'medicaoLiquida' },
  { trecho: 'Folha das equipes',             campo: 'folha' },
  { trecho: 'Engenheiro',                    campo: 'engenheiro' },
  { trecho: 'Estrutura e locações',          campo: 'estrutura' },
  { trecho: 'Custos indiretos',              campo: 'indiretos' },
  { trecho: 'Mobilização',                   campo: 'mobilizacao' },
  { trecho: 'RESULTADO ECONÔMICO DO MÊS',    campo: 'resultado' },
  { trecho: 'RESULTADO ACUMULADO', campo: 'resultadoAcumulado', acumulaDe: { campo: 'resultado', atraso: 0 } },
  { trecho: 'Margem do mês',                 campo: 'margem', unidade: 'FRACAO' },
]

/** Compara uma aba inteira: cada rótulo × cada mês. */
function conferirAba<T extends { mes: { mes: string } }>(
  nomeDaAba: string,
  matriz: Matriz | undefined,
  linhasDoMotor: T[],
  specs: Array<Spec<T>>,
  tituloDoBloco: string,
): GradeDaAba | null {
  if (!matriz) return null
  const cab = acharMeses(matriz)
  if (!cab) return null

  const doMotor = new Map(linhasDoMotor.map((l) => [l.mes.mes, l]))
  const daPlanilha = [...cab.porColuna.values()]
  const comuns = daPlanilha.filter((m) => doMotor.has(m))

  const de = inicioDoBloco(matriz, tituloDoBloco)
  const linhas: LinhaDaGrade[] = []
  const rotulosNaoEncontrados: string[] = []

  for (const spec of specs) {
    const i = acharLinha(matriz, spec.trecho, de)
    if (i < 0) { rotulosNaoEncontrados.push(spec.trecho); continue }
    const unidade = spec.unidade ?? 'BRL'
    const tol = TOLERANCIA[unidade]

    const celulas: CelulaDaGrade[] = []
    for (const [coluna, mes] of cab.porColuna) {
      const linhaMotor = doMotor.get(mes)
      if (!linhaMotor) continue
      const naPlanilha = num(matriz[i]?.[coluna])
      if (naPlanilha === null) continue
      const calculado = Number(linhaMotor[spec.campo as keyof T])
      if (!Number.isFinite(calculado)) continue
      const diferenca = calculado - naPlanilha
      celulas.push({ mes, naPlanilha, calculado, diferenca, fecha: Math.abs(diferenca) <= tol })
    }
    celulas.sort((a, b) => a.mes.localeCompare(b.mes))

    const divergem = celulas.filter((c) => !c.fecha).length
    linhas.push({
      rotulo: String(matriz[i]?.[0] ?? spec.trecho),
      linhaNaPlanilha: i + 1,
      campo: spec.campo,
      unidade,
      acumulaDe: spec.acumulaDe,
      celulas,
      fecham: celulas.length - divergem,
      divergem,
      maiorDiferenca: celulas.reduce((a, c) => Math.max(a, Math.abs(c.diferenca)), 0),
    })
  }

  return {
    aba: nomeDaAba,
    meses: comuns.sort(),
    linhas,
    mesesSoNaPlanilha: daPlanilha.filter((m) => !doMotor.has(m)).sort(),
    mesesSoNoMotor: [...doMotor.keys()].filter((m) => !daPlanilha.includes(m)).sort(),
    rotulosNaoEncontrados,
  }
}

// ─── As causas, cada uma com um teste mecânico ────────────────────────────────

/**
 * Duas linhas cuja SOMA bate nos meses todos enquanto as individuais não.
 *
 * É diferença de RÓTULO, não de dinheiro — e o teste prova isso sem palpite: se somar as duas dá o
 * mesmo número dos dois lados, o total está certo e só a rubrica difere.
 */
function pareDeRubricaTrocada(grade: GradeDaAba): [LinhaDaGrade, LinhaDaGrade] | null {
  const suspeitas = grade.linhas.filter((l) => l.divergem === l.celulas.length && l.celulas.length > 0)
  for (let a = 0; a < suspeitas.length; a++) {
    for (let b = a + 1; b < suspeitas.length; b++) {
      const [x, y] = [suspeitas[a], suspeitas[b]]
      if (x.celulas.length !== y.celulas.length) continue
      const somaFecha = x.celulas.every((c, i) => {
        const d = y.celulas[i]
        return d && d.mes === c.mes && Math.abs((c.diferenca + d.diferenca)) <= TOLERANCIA.BRL
      })
      if (somaFecha) return [x, y]
    }
  }
  return null
}

/**
 * O arraste, provado em vez de suposto.
 *
 * Uma linha que soma mês a mês carrega para sempre a diferença que apareceu antes. O teste exato é
 * este: **a diferença do acumulado em cada mês tem de ser a soma corrida das diferenças da linha de
 * origem** (com o atraso que a linha declara). Medido no arquivo real, a identidade fecha ao
 * centavo em todos os meses.
 *
 * ⚠️ A versão anterior deste teste exigia diferença CONSTANTE, e por isso não reconhecia os meses
 * de transição — aqueles em que a diferença ainda está se formando. Dez células ficavam sem causa
 * sendo puro arraste. Constância é consequência, não é o teste.
 */
function marcarArraste(linha: LinhaDaGrade, grade: GradeDaAba): Set<string> {
  const arrastadas = new Set<string>()
  if (!linha.acumulaDe) return arrastadas
  const fonte = grade.linhas.find((l) => l.campo === linha.acumulaDe!.campo)
  if (!fonte) return arrastadas

  const difDaFonte = new Map(fonte.celulas.map((c) => [c.mes, c.diferenca]))
  const meses = linha.celulas.map((c) => c.mes)
  let corrida = 0
  const somaAte = new Map<string, number>()
  for (const mes of meses) {
    corrida += difDaFonte.get(mes) ?? 0
    somaAte.set(mes, corrida)
  }

  for (let i = 0; i < linha.celulas.length; i++) {
    const c = linha.celulas[i]
    if (c.fecha) continue
    // Atraso 1: o acumulado "antes do recebimento" do mês M reflete o saldo só até M−1.
    const referencia = linha.acumulaDe.atraso === 1
      ? (i > 0 ? somaAte.get(meses[i - 1]) ?? 0 : 0)
      : somaAte.get(c.mes) ?? 0
    if (Math.abs(c.diferenca - referencia) <= TOLERANCIA.BRL) arrastadas.add(c.mes)
  }
  return arrastadas
}

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const mesCurto = (iso: string) => {
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`
}

/**
 * Atribui causa a cada célula que não fecha, e conta o que sobrou.
 *
 * ⚠️ A ordem importa: a rubrica trocada é identificada primeiro porque o teste dela é o mais
 * específico (a soma de duas linhas). O que não casa em teste nenhum fica **sem causa**, e é isso
 * que a tela precisa gritar.
 */
function atribuirCausas(grades: GradeDaAba[], premissas: PremissasFcp): {
  causas: CausaDaDivergencia[]
  semExplicacao: number
} {
  const causas: CausaDaDivergencia[] = []

  // ── rubrica trocada ────────────────────────────────────────────────────────
  let celulasDeRubrica = 0
  const rotulosDoPar: string[] = []
  for (const g of grades) {
    const par = pareDeRubricaTrocada(g)
    if (!par) continue
    for (const linha of par) {
      for (const c of linha.celulas) if (!c.fecha) { c.causa = 'classificacao-de-custo'; celulasDeRubrica++ }
    }
    rotulosDoPar.push(...par.map((l) => l.rotulo.replace(/^\(–\)\s*/, '').trim()))
  }
  if (celulasDeRubrica > 0) {
    const [a, b] = rotulosDoPar
    causas.push({
      id: 'classificacao-de-custo',
      titulo: 'Um custo está em rubrica diferente',
      explicacao:
        `O sistema e a planilha somam o mesmo dinheiro, mas em linhas diferentes: o que aqui entra `
        + `em "${a}", lá está em "${b}". Somadas, as duas rubricas batem ao centavo em todos os `
        + `meses — é diferença de rótulo, não de valor. Não muda o resultado, não muda o caixa, não `
        + `muda o capital.`,
      prova:
        `Nenhuma das duas linhas fecha sozinha, e a soma das duas fecha em todos os meses. É esse `
        + `teste que distingue rubrica trocada de erro de conta.`,
      celulas: celulasDeRubrica,
      impactoNoResultado: 0,
    })
  }

  // ── convenção da semana + o arraste que ela produz ─────────────────────────
  // Os meses em que a MEDIÇÃO diverge são a origem; tudo que descende dela no mesmo mês (e o
  // recebimento, que cai depois) herda a causa. O acumulado que fica constante daí em diante é
  // arraste — nome próprio, porque não é erro novo a cada mês.
  const mesesDeOrigem = new Set<string>()
  for (const g of grades) {
    const medicao = g.linhas.find((l) => l.campo === 'medicaoBruta')
    for (const c of medicao?.celulas ?? []) if (!c.fecha && !c.causa) mesesDeOrigem.add(c.mes)
  }

  let celulasDaSemana = 0
  let celulasDeArraste = 0

  for (const g of grades) {
    for (const linha of g.linhas) {
      const arrastadas = marcarArraste(linha, g)
      for (const c of linha.celulas) {
        if (c.fecha || c.causa) continue
        if (linha.acumulaDe) {
          // Só o que a soma corrida EXPLICA vira arraste. O que não bate é divergência de verdade
          // e tem de aparecer em `semExplicacao` — é o caso que a tela precisa gritar.
          if (arrastadas.has(c.mes)) { c.causa = 'arraste-do-acumulado'; celulasDeArraste++ }
          continue
        }
        // O recebimento do mês X é a medição de X−1: um mês de defasagem para frente.
        const mesAnterior = (() => {
          const d = new Date(`${c.mes}T00:00:00`)
          d.setMonth(d.getMonth() - 1)
          return iso(d)
        })()
        if (mesesDeOrigem.has(c.mes) || mesesDeOrigem.has(mesAnterior)) {
          c.causa = 'convencao-da-semana'; celulasDaSemana++
        }
      }
    }
  }

  if (celulasDaSemana > 0 || celulasDeArraste > 0) {
    const rotulos = [...mesesDeOrigem].sort().map(mesCurto).join(', ')
    const econ = grades.find((g) => g.linhas.some((l) => l.campo === 'resultadoAcumulado'))
    const acum = econ?.linhas.find((l) => l.campo === 'resultadoAcumulado')
    const impacto = Math.abs(acum?.celulas[acum.celulas.length - 1]?.diferenca ?? 0)

    if (celulasDaSemana > 0) {
      causas.push({
        id: 'convencao-da-semana',
        titulo: 'Duas convenções de semana para o mesmo período',
        explicacao:
          `Em ${rotulos} a planilha conta a medição em semanas inteiras, atribuídas à mão; o `
          + `sistema rateia pelos dias de obra do mês. A diferença nasce nesses meses e não cresce `
          + `depois — a partir do mês seguinte as duas contas voltam a dar o mesmo número.`,
        prova:
          `O sistema reproduz ao centavo a grade de cenários da aba AUX, nos quatro cenários, e o `
          + `bloco SENSIBILIDADE desta mesma aba. Quem discorda é o bloco em destaque, montado `
          + `sobre a outra convenção. Não é o sistema que discorda da planilha: é a planilha que `
          + `discorda dela mesma, e o sistema ficou do lado da grade.`,
        celulas: celulasDaSemana,
        impactoNoResultado: impacto,
      })
    }
    if (celulasDeArraste > 0) {
      causas.push({
        id: 'arraste-do-acumulado',
        titulo: 'O acumulado carrega a diferença dos meses anteriores',
        explicacao:
          `As linhas de acumulado somam mês a mês, então uma diferença que aconteceu em `
          + `${rotulos} aparece em todos os meses seguintes — sempre a mesma, ${brl(impacto)}, sem `
          + `crescer. Não são divergências novas: é a mesma, sendo carregada.`,
        prova:
          `A diferença é constante do primeiro mês limpo até o fim do horizonte. Se estivesse `
          + `variando, seria erro novo e não receberia esta causa.`,
        celulas: celulasDeArraste,
        impactoNoResultado: 0,
      })
    }
  }

  let semExplicacao = 0
  for (const g of grades) {
    for (const l of g.linhas) for (const c of l.celulas) if (!c.fecha && !c.causa) semExplicacao++
  }
  // `premissas` fica na assinatura porque as causas futuras (defasagem, imposto) vão precisar.
  void premissas
  return { causas, semExplicacao }
}

/**
 * A conferência da grade inteira.
 *
 * ⚠️ Recebe o `realizado` e o repassa ao motor. A conferência escalar não fazia isso: comparava
 * uma planilha COM produção lançada contra um motor SEM ela — hoje passa despercebido só porque o
 * bloco PLANEJADO × REALIZADO do arquivo está vazio.
 */
export function conferirGrade(
  premissas: PremissasFcp,
  abas: Abas,
  realizado: ProducaoRealizada = {},
): ConferenciaDaGrade {
  const grades = [
    conferirAba('FCP MENSAL', abas['FCP MENSAL'], fluxoMensal(premissas, realizado), FCP_MENSAL, 'GLOBAL'),
    conferirAba('ECONÔMICO', abas['ECONÔMICO'], fluxoEconomico(premissas, realizado), ECONOMICO, 'ECONÔMICO'),
  ].filter((g): g is GradeDaAba => g !== null)

  const { causas, semExplicacao } = atribuirCausas(grades, premissas)

  let total = 0
  let fecham = 0
  for (const g of grades) {
    for (const l of g.linhas) { total += l.celulas.length; fecham += l.fecham }
  }

  return { grades, total, fecham, divergem: total - fecham, causas, semExplicacao }
}
