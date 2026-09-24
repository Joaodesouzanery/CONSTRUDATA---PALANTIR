/**
 * O pacote do mês — os arquivos que vão para a contabilidade, num clique.
 *
 * ─── O QUE DÁ PARA PROMETER, E O QUE NÃO ──────────────────────────────────────
 * ⚠️ **Não existe envio.** Não há backend de e-mail neste projeto, e inventar um aqui seria
 * infraestrutura nova que ninguém pediu — mas, sobretudo, seria uma promessa que quebra na frente
 * do contador. O que existe é baixar tudo de uma vez, com os nomes certos, e anexar.
 *
 * ⚠️ **O `.html` do espelho NÃO é um PDF.** Ele abre em qualquer navegador e imprime em PDF pelo
 * Ctrl+P — é a técnica que o projeto escolheu (`lib/printReport.ts` documenta por que jsPDF ficou
 * de fora). Chamá-lo de PDF no nome do arquivo faria o contador procurar um Acrobat que não vai
 * abrir nada.
 *
 * ⚠️ **AFD e AEJ não estão aqui, e isso vai escrito no LEIA-ME.** São os formatos fiscais da
 * Portaria 671, com layout fechado e numeração própria, e só fazem sentido para empresa que
 * declarou REP-P. O que este sistema cumpre é o art. 74 §2º (espelho com marcações, pendências e
 * assinatura) e o NSR com inalterabilidade. Dizer isso no pacote vale mais que o silêncio.
 *
 * Puro: monta conteúdo de arquivo em memória. Quem zipa e baixa é `pacoteDoPontoZip.ts`, pelo mesmo
 * motivo que separa `leitorPlanilha` de `leitorPlanilhaZip` — o `jszip` não carrega no resolver de
 * testes, e a regra ficaria sem teste.
 */
import type { Jornada } from '@/features/ponto/jornada'
import { TEXTO_DA_PENDENCIA } from '@/features/ponto/jornada'
import type { SaldoDoPeriodo } from './bancoDeHoras'
import { TEXTO_SEM_PREVISTO } from './bancoDeHoras'
import type { HoraExtra, RegistroDePonto, Worker, WorkerAbsence } from '@/types'

/** Um arquivo do pacote. */
export interface ArquivoDoPacote {
  nome: string
  conteudo: string
}

/**
 * Campo de CSV no dialeto que o Excel em pt-BR abre em colunas sem perguntar nada.
 *
 * ⚠️ Separador `;`. Com vírgula, o Excel brasileiro joga a linha inteira na coluna A e o relatório
 * vira um bloco de texto — é a mesma decisão do relatório de divergências do Operacional.
 */
const campo = (v: string | number | undefined | null): string => {
  const t = String(v ?? '')
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}
const linha = (vs: Array<string | number | undefined | null>) => vs.map(campo).join(';')
const csv = (cabecalho: string[], linhas: Array<Array<string | number | undefined | null>>) =>
  [linha(cabecalho), ...linhas.map(linha)].join('\r\n')

/** Minutos → horas decimais. É o que a contabilidade soma; o espelho mostra "8h48". */
const decimal = (min: number) => (min / 60).toFixed(2).replace('.', ',')

/** ISO → hora local `HH:mm`. A MESMA conversão da tela: senão a batida das 21h cai em dias diferentes. */
const horaLocal = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

export interface EntradaDoPacote {
  de: string
  ate: string
  empresa: string
  obraLabel?: string
  emitidoPor: string
  emitidoEm: string
  workers: Worker[]
  jornadas: Jornada[]
  registros: RegistroDePonto[]
  saldos: Array<{ workerId: string; saldo: SaldoDoPeriodo }>
  horasExtras: HoraExtra[]
  ausencias: WorkerAbsence[]
  /** O HTML do espelho, já montado por `buildEspelhoHtml`. */
  espelhoHtml: string
}

/**
 * Uma linha por BATIDA — é o arquivo que responde "a que horas fulano clicou".
 *
 * ⚠️ Leva `momentoServidor` e `divergenciaRelogioS` junto do horário do aparelho. Guardar as duas
 * horas e nunca mostrá-las é o mesmo que não ter a segunda; e é a divergência negativa (o aparelho
 * afirmando ter batido no futuro do servidor) que denuncia relógio adulterado.
 */
export function csvDeBatidas(e: EntradaDoPacote): string {
  const nome = new Map(e.workers.map((w) => [w.id, w.name]))
  const doPeriodo = e.registros
    .filter((r) => r.data >= e.de && r.data <= e.ate)
    .sort((a, b) => a.data.localeCompare(b.data) || a.momentoDispositivo.localeCompare(b.momentoDispositivo))
  return csv(
    ['NSR', 'Data', 'Funcionário', 'Matrícula', 'Marcação', 'Hora do aparelho', 'Hora do servidor',
      'Divergência (s)', 'Origem', 'Dentro da cerca', 'Distância (m)', 'Justificativa'],
    doPeriodo.map((r) => [
      r.nsr ?? '', r.data, nome.get(r.workerId) ?? r.workerId,
      e.workers.find((w) => w.id === r.workerId)?.registrationNumber ?? '',
      r.tipo, horaLocal(r.momentoDispositivo), horaLocal(r.momentoServidor),
      r.divergenciaRelogioS ?? '', r.origem,
      // ⚠️ Três estados, não dois: "sim", "não" e "não deu para avaliar" — e o terceiro leva o
      // motivo. Reduzir a sim/não faria a batida sem GPS parecer uma batida fora da obra.
      r.dentroDaCerca === true ? 'sim' : r.dentroDaCerca === false ? 'NÃO' : `não avaliada${r.motivoSemCerca ? ` (${r.motivoSemCerca})` : ''}`,
      r.distanciaM != null ? Math.round(r.distanciaM) : '',
      r.justificativa ?? '',
    ]),
  )
}

/** Uma linha por JORNADA — o que o espelho mostra, em formato somável. */
export function csvDeJornadas(e: EntradaDoPacote): string {
  const nome = new Map(e.workers.map((w) => [w.id, w.name]))
  return csv(
    ['Data', 'Funcionário', 'Entrada', 'Saída', 'Intervalo (min)', 'Trabalhado (h)', 'Pendências'],
    e.jornadas.map((j) => [
      j.data, nome.get(j.workerId) ?? j.workerId,
      horaLocal(j.entrada?.momentoDispositivo), horaLocal(j.saida?.momentoDispositivo),
      j.intervaloMin, decimal(j.minutosTrabalhados),
      j.pendencias.map((p) => TEXTO_DA_PENDENCIA[p]).join(' · '),
    ]),
  )
}

/** Uma linha por PESSOA — previsto, trabalhado, saldo. */
export function csvDeBancoDeHoras(e: EntradaDoPacote): string {
  const nome = new Map(e.workers.map((w) => [w.id, w.name]))
  return csv(
    ['Funcionário', 'Regime', 'Previsto (h)', 'Trabalhado (h)', 'Saldo (h)', 'Dias fora da conta', 'Observação'],
    e.saldos.map(({ workerId, saldo }) => [
      nome.get(workerId) ?? workerId,
      e.workers.find((w) => w.id === workerId)?.scheduleType ?? '',
      decimal(saldo.previstoMin), decimal(saldo.trabalhadoMin), decimal(saldo.saldoMin),
      saldo.diasIndefinidos,
      // ⚠️ Diarista não tem banco, e o CSV precisa DIZER isso: uma linha zerada leria como
      // "trabalhou exatamente o previsto", que é outra coisa.
      saldo.semBanco ? TEXTO_SEM_PREVISTO[saldo.semBanco] : '',
    ]),
  )
}

export function csvDeHorasExtras(e: EntradaDoPacote): string {
  const doPeriodo = e.horasExtras.filter((h) => h.data >= e.de && h.data <= e.ate)
  return csv(
    ['Data', 'Funcionário', 'Cargo', 'Tipo', 'Valor (R$)', 'Pago', 'Pago em', 'Origem'],
    doPeriodo.map((h) => [
      h.data, h.workerNome, h.cargo ?? '', h.tipo,
      h.valor.toFixed(2).replace('.', ','), h.pago ? 'sim' : 'não', h.pagoEm ?? '', h.origem,
    ]),
  )
}

export function csvDeFaltas(e: EntradaDoPacote): string {
  const nome = new Map(e.workers.map((w) => [w.id, w.name]))
  const doPeriodo = e.ausencias
    .filter((a) => a.date >= e.de && a.date <= e.ate)
    .sort((a, b) => a.date.localeCompare(b.date))
  return csv(
    ['Data', 'Funcionário', 'Tipo', 'Situação', 'Descrição', 'Substituto'],
    doPeriodo.map((a) => [
      a.date, nome.get(a.workerId) ?? a.workerId, a.type, a.status ?? '', a.description ?? '',
      a.substituteWorkerId ? (nome.get(a.substituteWorkerId) ?? a.substituteWorkerId) : '',
    ]),
  )
}

/**
 * O LEIA-ME do pacote.
 *
 * ⚠️ É o arquivo mais importante do zip, e não é burocracia: ele carrega o RECORTE por extenso
 * (período, obra, quantas pessoas, quem emitiu) e o que o pacote **não** é. Número sem recorte
 * declarado é número que ninguém pode auditar — e o destino disto é a contabilidade e,
 * eventualmente, uma fiscalização.
 */
export function leiaMeDoPacote(e: EntradaDoPacote): string {
  return [
    `PONTO ELETRÔNICO — ${e.empresa}`,
    '',
    `Período:     ${e.de} a ${e.ate}`,
    `Obra:        ${e.obraLabel ?? 'todas as obras'}`,
    `Pessoas:     ${e.workers.length}`,
    `Jornadas:    ${e.jornadas.length}`,
    `Emitido por: ${e.emitidoPor}`,
    `Emitido em:  ${e.emitidoEm}`,
    '',
    'ARQUIVOS',
    '  espelho-de-ponto.html    O espelho do art. 74 §2º. Abra no navegador e imprima em PDF',
    '                           (Ctrl+P → Salvar como PDF). NÃO é um arquivo PDF.',
    '  espelho-de-ponto.xlsx    O mesmo espelho em planilha, com as horas em decimal.',
    '  batidas.csv              Uma linha por marcação, com NSR, hora do aparelho, hora do',
    '                           servidor e a divergência entre as duas.',
    '  jornadas.csv             Uma linha por jornada: entrada, saída, intervalo, trabalhado.',
    '  banco-de-horas.csv       Previsto, trabalhado e saldo por pessoa.',
    '  horas-extras.csv         As horas extras lançadas no período, pagas e a pagar.',
    '  faltas.csv               As ausências do período.',
    '',
    'O QUE ESTE PACOTE NÃO É',
    '  Não contém AFD nem AEJ — os arquivos fiscais da Portaria 671, de layout fechado, que só',
    '  fazem sentido para empresa que declarou REP-P. O que está aqui atende o art. 74 §2º da CLT',
    '  (registro com marcações, pendências e assinatura) e carrega o NSR de cada batida.',
    '',
    '  Os CSV usam ponto e vírgula como separador — é o que o Excel em português abre em colunas.',
  ].join('\r\n')
}

/** Todos os arquivos do pacote, já nomeados. */
export function arquivosDoPacote(e: EntradaDoPacote): ArquivoDoPacote[] {
  const mes = e.de.slice(0, 7)
  const sufixo = `${mes}`
  return [
    { nome: 'LEIA-ME.txt', conteudo: leiaMeDoPacote(e) },
    { nome: `espelho-de-ponto-${sufixo}.html`, conteudo: e.espelhoHtml },
    { nome: `batidas-${sufixo}.csv`, conteudo: csvDeBatidas(e) },
    { nome: `jornadas-${sufixo}.csv`, conteudo: csvDeJornadas(e) },
    { nome: `banco-de-horas-${sufixo}.csv`, conteudo: csvDeBancoDeHoras(e) },
    { nome: `horas-extras-${sufixo}.csv`, conteudo: csvDeHorasExtras(e) },
    { nome: `faltas-${sufixo}.csv`, conteudo: csvDeFaltas(e) },
  ]
}
