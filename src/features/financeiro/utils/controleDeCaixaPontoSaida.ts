/**
 * controleDeCaixaPontoSaida.ts — a aba "AUSÊNCIA PONTO SAÍDA" do arquivo do cliente.
 *
 * ─── O QUE ESTA ABA É ─────────────────────────────────────────────────────────
 * Quem não bateu o ponto na saída teve horas descontadas pelo relógio; a empresa conferiu que a
 * pessoa estava lá e **devolve** essas horas, junto com a hora extra do mesmo dia. A planilha traz
 * a conta pronta, coluna a coluna, e uma coluna solta dizendo "Pago em 10/09".
 *
 * ─── AS TRÊS DECISÕES QUE ESTE ARQUIVO TOMA ───────────────────────────────────
 * ⚠️ **Grava o valor DECLARADO, nunca o recalculado.** A coluna TOTAL é o que saiu do caixa —
 *    já foi pago. Regravar em silêncio com a conta do sistema mudaria o valor de um pagamento
 *    feito. O recalculado vira CONFERÊNCIA, e a diferença vira alerta na tela.
 * ⚠️ **`"13 e 20/08"` vira UM registro.** São dois dias com as horas já somadas; a planilha não
 *    diz quanto é de cada, e ratear inventaria número. O texto cru fica em `detalhe.diasTexto`.
 * ⚠️ **A linha de total não tem rótulo** — só a coluna TOTAL preenchida. Sem regra própria,
 *    nasceria um colaborador chamado `2065.148832`.
 *
 * Nenhuma conta nova é escrita aqui: quem calcula é `calcularPontoSaida`, o mesmo motor da tela
 * de Mão de Obra, já conferido contra este mesmo arquivo de agosto.
 */
import type { HoraExtra } from '@/types'
import {
  calcularPontoSaida, chaveDaPessoa, idDaHoraExtra, fatorDoAdicional,
} from '@/features/mao-de-obra/utils/horaExtraCalculo'
import { lerData, lerValor, normalizarTexto, type Matriz, type ProblemaNaLinha } from './controleDeCaixaPlanilha'

/** Uma linha da aba, já lida — antes de virar `HoraExtra`. */
export interface LinhaDoPontoSaida {
  colaborador: string
  /** O primeiro dia, ISO. É por ele que a linha ordena e filtra. */
  data: string
  /** O que a célula DIA diz, cru. `"13 e 20/08"` é uma linha real. */
  diasTexto: string
  horasDescontadas: number
  horasExtras: number
  salario: number
  /** A coluna TOTAL da planilha — o valor que de fato saiu do caixa. */
  totalDeclarado: number
  /** O que `calcularPontoSaida` devolve para os mesmos insumos. */
  totalRecalculado: number
  /** `totalRecalculado − totalDeclarado`. Positivo = o sistema acha que faltou pagar. */
  diferenca: number
  /** Da coluna solta "Pago em 10/09", quando ela existe. ISO. */
  pagoEm?: string
  linha: number
}

export interface LeituraDoPontoSaida {
  linhas: LinhaDoPontoSaida[]
  problemas: ProblemaNaLinha[]
  /** A linha de total da aba, quando existe. É contra ela que o vínculo com o caixa é proposto. */
  totalDeclaradoDaAba: number | null
  /** Quantas linhas fecham ao centavo contra o motor do sistema. */
  batem: number
  /** A soma de `totalDeclarado` das linhas de pessoa. */
  somaDeclarada: number
  /** A soma de `totalRecalculado`. */
  somaRecalculada: number
}

/** Reconhece a aba pelo nome. Aceita com e sem acento, e "AUSENCIA DE PONTO". */
export function ehAbaDePontoSaida(nome: string): boolean {
  const t = normalizarTexto(nome)
  return t.includes('AUSENCIA') && t.includes('PONTO')
}

const CABECALHOS: Record<string, string[]> = {
  colaborador: ['COLABORADOR', 'NOME', 'FUNCIONARIO'],
  dia: ['DIA', 'DIAS', 'DATA'],
  horasDescontadas: ['HORAS DESCONTADAS'],
  horasExtras: ['HORAS EXTRAS'],
  salario: ['SALARIO'],
  total: ['TOTAL'],
}

/**
 * Onde está cada coluna.
 *
 * ⚠️ O cabeçalho real traz quebra de linha dentro da célula (`"HORAS \nDESCONTADAS"`), e é por
 * isso que a comparação passa por `normalizarTexto` — que colapsa o branco. Comparar cru não
 * casaria uma única coluna.
 *
 * ⚠️ `VALOR HORAS EXTRAS` contém a palavra `HORAS EXTRAS`. Por isso o casamento é EXATO e não por
 * `includes`: por `includes`, a coluna de dinheiro seria lida como a de horas.
 */
export function colunasDoPontoSaida(cabecalho: readonly unknown[]): Record<string, number> {
  const mapa: Record<string, number> = {}
  for (let c = 0; c < cabecalho.length; c++) {
    const t = normalizarTexto(cabecalho[c])
    if (!t) continue
    for (const [campo, nomes] of Object.entries(CABECALHOS)) {
      if (mapa[campo] !== undefined) continue
      if (nomes.includes(t)) { mapa[campo] = c; break }
    }
  }
  return mapa
}

/**
 * "13 e 20/08" → o primeiro dia, com o mês/ano da própria célula.
 *
 * Devolve `null` quando não dá para ler — e aí a linha é recusada, porque devolução sem data não
 * tem como ser conferida contra o ponto depois.
 */
export function primeiroDiaDoTexto(bruto: unknown, ano: number): string | null {
  const direto = lerData(bruto)
  if (direto) return direto.data

  // "13 e 20/08" — o mês vem do último pedaço, e o primeiro dia é o que abre o texto.
  const t = String(bruto ?? '').trim()
  const comMes = /(\d{1,2})\s*(?:E|,|\/|-|\s)+\s*(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/i.exec(t)
  if (comMes) {
    const dia = Number(comMes[1])
    const mes = Number(comMes[3])
    const a = comMes[4] ? Number(comMes[4].length === 2 ? `20${comMes[4]}` : comMes[4]) : ano
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      return `${a}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    }
  }
  return null
}

/** A coluna sem cabeçalho que diz "Pago em 10/09". Procurada por conteúdo, como a de Conferido. */
function acharPagoEm(linha: readonly unknown[], ano: number): string | undefined {
  for (const celula of linha) {
    const t = String(celula ?? '').trim()
    const m = /PAGO\s+EM\s+(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/i.exec(t)
    if (!m) continue
    const a = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : ano
    return `${a}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`
  }
  return undefined
}

export function lerPontoSaida(
  matriz: Matriz,
  opcoes: { ano: number; fatorAdicional?: number },
): LeituraDoPontoSaida {
  const problemas: ProblemaNaLinha[] = []
  const linhas: LinhaDoPontoSaida[] = []
  const fator = opcoes.fatorAdicional ?? fatorDoAdicional()
  const col = colunasDoPontoSaida(matriz[0] ?? [])

  if (col.colaborador === undefined || col.total === undefined) {
    return {
      linhas: [],
      problemas: [{
        linha: 1,
        motivo: 'Não reconheci o cabeçalho desta aba. Preciso de pelo menos COLABORADOR e TOTAL.',
        gravidade: 'recusa',
      }],
      totalDeclaradoDaAba: null, batem: 0, somaDeclarada: 0, somaRecalculada: 0,
    }
  }

  let totalDeclaradoDaAba: number | null = null

  for (let i = 1; i < matriz.length; i++) {
    const l = matriz[i] ?? []
    const numeroDaLinha = i + 1
    const colaborador = String(l[col.colaborador] ?? '').trim()
    const total = lerValor(l[col.total])

    // ⚠️ A linha de total da aba NÃO tem rótulo: só a coluna TOTAL vem preenchida. Sem esta
    // guarda, nasceria um colaborador chamado "2065.148832" com o valor da aba inteira.
    if (!colaborador) {
      if (total !== null && total !== 0) totalDeclaradoDaAba = total
      continue
    }
    // E quando ela TEM rótulo, é a palavra TOTAL.
    if (/^TOTAIS?$|^TOTAL/.test(normalizarTexto(colaborador))) {
      if (total !== null) totalDeclaradoDaAba = total
      continue
    }

    if (total === null || total === 0) continue    // linha em branco no meio da aba

    const celulaDoDia = col.dia !== undefined ? l[col.dia] : null
    /** O texto cru, só quando ele diz algo que a data ISO não diz (`"13 e 20/08"`). */
    const bruta = lerData(celulaDoDia) ? null : celulaDoDia
    const data = primeiroDiaDoTexto(celulaDoDia, opcoes.ano)
    if (!data) {
      problemas.push({
        linha: numeroDaLinha, coluna: 'DIA',
        motivo: 'Não consegui ler o dia — sem data não dá para conferir a devolução contra o ponto.',
        conteudo: String(l[col.dia ?? -1] ?? ''), gravidade: 'recusa',
      })
      continue
    }

    const horasDescontadas = (col.horasDescontadas !== undefined ? lerValor(l[col.horasDescontadas]) : 0) ?? 0
    const horasExtras = (col.horasExtras !== undefined ? lerValor(l[col.horasExtras]) : 0) ?? 0
    const salario = (col.salario !== undefined ? lerValor(l[col.salario]) : 0) ?? 0
    const calc = calcularPontoSaida({ salario, horasDescontadas, horasExtras, fatorAdicional: fator })

    linhas.push({
      colaborador,
      data,
      // ⚠️ Só quando a célula NÃO é uma data legível. Guardar o texto de um `Date` produziria
      // `"Thu Aug 20 2026 00:00:28 GMT-0300"` dentro do registro — `data` já diz isso, e melhor.
      diasTexto: bruta === null ? '' : String(bruta).trim(),
      horasDescontadas, horasExtras, salario,
      totalDeclarado: total,
      totalRecalculado: calc.total,
      diferenca: calc.total - total,
      pagoEm: acharPagoEm(l, opcoes.ano),
      linha: numeroDaLinha,
    })
  }

  return {
    linhas,
    problemas,
    totalDeclaradoDaAba,
    batem: linhas.filter((x) => Math.abs(x.diferenca) <= 0.005).length,
    somaDeclarada: linhas.reduce((a, x) => a + x.totalDeclarado, 0),
    somaRecalculada: linhas.reduce((a, x) => a + x.totalRecalculado, 0),
  }
}

/**
 * A linha lida vira o registro de Mão de Obra.
 *
 * ⚠️ O id é o MESMO que a tela de ponto-saída gera (`idDaHoraExtra`), e é isso que faz importar
 * por cima do que foi digitado à mão ser **atualização**, não duplicata. Por isso também
 * `pago`/`pagoEm`/`entryId` do registro existente são preservados: o vínculo com o caixa e a
 * marcação de pago foram feitos por uma pessoa, e a planilha não sabe deles.
 */
export function horaExtraDoPontoSaida(
  l: LinhaDoPontoSaida,
  opcoes: { agora: string; obraId?: string; fatorAdicional?: number; entryId?: string },
  existente?: HoraExtra,
): HoraExtra {
  const workerNome = l.colaborador
  const id = idDaHoraExtra(chaveDaPessoa({ workerId: existente?.workerId, workerNome }), l.data, 'ponto-saida')
  return {
    id,
    workerId: existente?.workerId,
    workerNome,
    data: l.data,
    tipo: 'ponto-saida',
    // ⚠️ O DECLARADO. Ver o cabeçalho deste arquivo: é o que já saiu do caixa.
    valor: l.totalDeclarado,
    obraId: existente?.obraId ?? opcoes.obraId,
    pago: existente?.pago ?? Boolean(l.pagoEm),
    pagoEm: existente?.pagoEm ?? l.pagoEm,
    pagoPor: existente?.pagoPor,
    // O vínculo com o lançamento que JÁ existe no caixa — nunca uma despesa nova.
    entryId: existente?.entryId ?? opcoes.entryId,
    origem: 'planilha',
    detalhe: {
      horasDescontadas: l.horasDescontadas,
      horasExtras: l.horasExtras,
      salario: l.salario,
      fatorAdicional: opcoes.fatorAdicional ?? fatorDoAdicional(),
      diasTexto: l.diasTexto || undefined,
    },
    createdAt: existente?.createdAt ?? opcoes.agora,
  }
}

/**
 * O lançamento que já está no caixa e corresponde a esta devolução.
 *
 * ⚠️ **Proposta, nunca automática.** É o valor e o período que sugerem o par; quem confirma é a
 * pessoa. Casar sozinho apontaria dez devoluções para a despesa errada sem ninguém notar — e o
 * `entryId` é o que faz o estorno encontrar o lançamento depois.
 *
 * A ordem dos critérios é deliberada: valor ao centavo primeiro (é o sinal mais forte — no arquivo
 * real a linha L214 de R$ 2.065,15 é exatamente o total da aba), e a palavra "HORAS EXTRAS" na
 * descrição só desempata.
 */
export function candidatosAoVinculo(
  entries: readonly { id: string; tipo: string; valor: number; data: string; descricao: string }[],
  total: number,
  pagoEm?: string,
): Array<{ id: string; data: string; descricao: string; valor: number; exato: boolean }> {
  const perto = (v: number) => Math.abs(v - total) <= 0.01
  const candidatos = entries
    .filter((e) => e.tipo === 'saida')
    .filter((e) => perto(e.valor) || /HORAS?\s+EXTRAS?/i.test(e.descricao))
    .map((e) => ({ id: e.id, data: e.data, descricao: e.descricao, valor: e.valor, exato: perto(e.valor) }))

  return candidatos.sort((a, b) => {
    if (a.exato !== b.exato) return a.exato ? -1 : 1
    // Depois do valor, a proximidade da data de pagamento.
    if (pagoEm) {
      const d = (x: string) => Math.abs(new Date(x).getTime() - new Date(pagoEm).getTime())
      return d(a.data) - d(b.data)
    }
    return b.data.localeCompare(a.data)
  })
}

/**
 * A aba avulsa que é só uma lista de palavras — no arquivo do cliente, `Planilha1`, com as 13
 * classificações que ele usa.
 *
 * ⚠️ Reconhecida pelo CONTEÚDO, não pelo nome: uma coluna só, texto, sem número nenhum. Pelo nome
 * seria impossível (`Planilha1` é o padrão do Excel para qualquer aba).
 */
export function lerListaDeClassificacoes(matriz: Matriz): string[] {
  const palavras: string[] = []
  for (const linha of matriz) {
    const primeira = String(linha?.[0] ?? '').trim()
    // Alguma outra coluna preenchida? Então não é uma lista — é uma tabela, e não é isto aqui.
    if ((linha ?? []).slice(1).some((c) => c !== null && c !== undefined && String(c).trim() !== '')) return []
    if (!primeira) continue
    if (lerValor(primeira) !== null) return []      // coluna de números não é lista de palavras
    if (!palavras.includes(primeira)) palavras.push(primeira)
  }
  return palavras
}
