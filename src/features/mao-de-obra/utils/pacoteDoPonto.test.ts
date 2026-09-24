/**
 * O pacote do mês que vai para a contabilidade.
 *
 * ⚠️ O que estes testes protegem não é a formatação: é a **honestidade do arquivo**. Um CSV de
 * ponto que sai errado não dá erro — ele é somado pelo contador, vira folha, e só aparece meses
 * depois, numa reclamação. Por isso: o separador que o Excel brasileiro entende, a hora local (e
 * não a UTC crua), os três estados da cerca em vez de sim/não, e o diarista dizendo que não tem
 * banco em vez de mostrar zero.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  arquivosDoPacote, csvDeBatidas, csvDeJornadas, csvDeBancoDeHoras, csvDeHorasExtras,
  csvDeFaltas, leiaMeDoPacote, type EntradaDoPacote,
} from './pacoteDoPonto'
import type { RegistroDePonto, Worker } from '@/types'
import type { Jornada } from '@/features/ponto/jornada'
import type { SaldoDoPeriodo } from './bancoDeHoras'

const WORKER = {
  id: 'w-1', name: 'João da Silva', role: 'Pintor', status: 'active',
  registrationNumber: '00123', scheduleType: '5x2', admissionDate: '2026-01-10',
} as Worker

const saldo = (over: Partial<SaldoDoPeriodo> = {}): SaldoDoPeriodo => ({
  de: '2026-09-01', ate: '2026-09-30',
  previstoMin: 10_560, trabalhadoMin: 10_800, saldoMin: 240,
  dias: [], diasIndefinidos: 0,
  ...over,
})

const BASE: EntradaDoPacote = {
  de: '2026-09-01', ate: '2026-09-30',
  empresa: 'WCR Saneamento', obraLabel: 'Bertioga',
  emitidoPor: 'Fulano', emitidoEm: '24/09/2026 09:00',
  workers: [WORKER], jornadas: [], registros: [],
  saldos: [{ workerId: 'w-1', saldo: saldo() }],
  horasExtras: [], ausencias: [],
  espelhoHtml: '<html><body>espelho</body></html>',
}

// ─── 🔴 O dialeto que o Excel em português abre ───────────────────────────────

test('🔴 o separador é ponto e vírgula — com vírgula o Excel joga tudo na coluna A', () => {
  const csv = csvDeBancoDeHoras(BASE)
  const [cabecalho] = csv.split('\r\n')
  assert.equal(cabecalho.split(';').length, 7)
  assert.ok(!cabecalho.includes(','), 'vírgula como separador transforma o relatório num bloco de texto')
})

test('🔴 as horas saem em DECIMAL, que é o que a contabilidade soma', () => {
  // 240 minutos de saldo = 4,00 h. O espelho mostra "4h00"; aqui, 4,00.
  const linha = csvDeBancoDeHoras(BASE).split('\r\n')[1]
  assert.ok(linha.includes('4,00'), `esperava o saldo em decimal, veio: ${linha}`)
  assert.ok(linha.includes('176,00'), 'previsto de 10.560 min = 176 h')
})

test('campo com ponto e vírgula dentro é escapado, não quebra a coluna', () => {
  const csv = csvDeFaltas({
    ...BASE,
    ausencias: [{
      id: 'a-1', workerId: 'w-1', date: '2026-09-10', type: 'justified',
      status: 'covered', registeredAt: '', description: 'atestado; 2 dias',
    }] as EntradaDoPacote['ausencias'],
  })
  assert.match(csv, /"atestado; 2 dias"/)
})

// ─── 🔴 A cerca tem TRÊS estados, não dois ────────────────────────────────────

const batida = (over: Partial<RegistroDePonto>): RegistroDePonto => ({
  id: 'b-1', workerId: 'w-1', authUserId: 'u-1', siteId: null,
  tipo: 'entrada', data: '2026-09-10',
  momentoDispositivo: '2026-09-10T10:00:00.000Z',
  origem: 'app',
  ...over,
} as RegistroDePonto)

test('🔴 "não deu para avaliar" NÃO vira "não" — são coisas diferentes', () => {
  const csv = csvDeBatidas({
    ...BASE,
    registros: [
      batida({ id: 'b-1', dentroDaCerca: true }),
      batida({ id: 'b-2', dentroDaCerca: false, distanciaM: 7300 }),
      batida({ id: 'b-3', motivoSemCerca: 'permissao-negada' }),
    ],
  })
  assert.match(csv, /;sim;/)
  assert.match(csv, /;NÃO;/)
  assert.match(csv, /não avaliada \(permissao-negada\)/,
    'reduzir a sim/não faria a batida sem GPS parecer uma batida fora da obra — e é o gestor que '
    + 'lê este arquivo para decidir se desconta o dia de alguém')
})

test('🔴 o CSV leva as DUAS horas e a divergência entre elas', () => {
  const csv = csvDeBatidas({
    ...BASE,
    registros: [batida({
      momentoDispositivo: '2026-09-10T10:00:00.000Z',
      momentoServidor: '2026-09-10T10:02:00.000Z',
      divergenciaRelogioS: 120, nsr: 42,
    })],
  })
  const linha = csv.split('\r\n')[1]
  assert.ok(linha.startsWith('42;'), 'o NSR abre a linha — é o número da Portaria 671')
  assert.ok(linha.includes(';120;'),
    'guardar as duas horas e nunca compará-las é o mesmo que não ter a segunda: é a divergência '
    + 'NEGATIVA que denuncia relógio adulterado')
})

test('🔴 a hora sai LOCAL, não em UTC — senão a batida das 21h cai no dia errado', () => {
  const csv = csvDeBatidas({ ...BASE, registros: [batida({ momentoDispositivo: '2026-09-10T10:00:00.000Z' })] })
  // Não interessa o fuso da máquina que roda o teste: interessa que NÃO saiu o ISO cru.
  assert.ok(!csv.includes('2026-09-10T10:00:00.000Z'))
  assert.match(csv, /\d{2}:\d{2}/)
})

// ─── 🔴 Diarista não tem banco, e o arquivo diz isso ──────────────────────────

test('🔴 quem não tem banco não aparece zerado — aparece com o motivo', () => {
  const csv = csvDeBancoDeHoras({
    ...BASE,
    saldos: [{ workerId: 'w-1', saldo: saldo({ previstoMin: 0, trabalhadoMin: 0, saldoMin: 0, semBanco: 'diarista' }) }],
  })
  assert.match(csv, /Diarista/,
    'uma linha zerada leria como "trabalhou exatamente o previsto", que é outra coisa')
})

// ─── As horas extras e as jornadas ────────────────────────────────────────────

test('as horas extras saem com pago/não pago e o valor em reais', () => {
  const csv = csvDeHorasExtras({
    ...BASE,
    horasExtras: [
      { id: 'h-1', workerNome: 'João da Silva', data: '2026-09-13', tipo: 'fim-de-semana', valor: 180, pago: false, origem: 'manual', createdAt: '' },
      { id: 'h-2', workerNome: 'João da Silva', data: '2026-08-30', tipo: 'fim-de-semana', valor: 180, pago: true, origem: 'manual', createdAt: '' },
    ] as EntradaDoPacote['horasExtras'],
  })
  const linhas = csv.split('\r\n')
  assert.equal(linhas.length, 2, 'a de agosto está fora do período e não entra')
  assert.match(linhas[1], /180,00;não/)
})

test('uma linha por jornada, com as pendências por extenso', () => {
  const jornada: Jornada = {
    id: 'j-1', workerId: 'w-1', data: '2026-09-10', siteId: null,
    entrada: batida({ momentoDispositivo: '2026-09-10T10:00:00.000Z' }),
    saida: undefined,
    intervaloMin: 0, minutosTrabalhados: 0,
    pendencias: ['sem-saida'], batidas: [], nsrs: [],
  }
  const csv = csvDeJornadas({ ...BASE, jornadas: [jornada] })
  assert.match(csv, /2026-09-10;João da Silva/)
  assert.match(csv, /saída/i, 'a pendência sai por extenso, não como código')
})

// ─── 🔴 O LEIA-ME é o arquivo mais importante do pacote ───────────────────────

test('🔴 o LEIA-ME declara o recorte e diz o que o pacote NÃO é', () => {
  const txt = leiaMeDoPacote(BASE)
  assert.match(txt, /2026-09-01 a 2026-09-30/)
  assert.match(txt, /Bertioga/)
  assert.match(txt, /Fulano/, 'quem emitiu — número sem autor não se audita')

  // ⚠️ As duas afirmações que evitam a conversa cara com o contador.
  assert.match(txt, /NÃO é um arquivo PDF/,
    'o espelho é HTML que se imprime em PDF; chamá-lo de PDF faz o contador procurar um Acrobat '
    + 'que não vai abrir nada')
  assert.match(txt, /AFD/)
  assert.match(txt, /AEJ/)
  assert.match(txt, /art\. 74/,
    'dizer o que o sistema CUMPRE é tão importante quanto dizer o que ele não cumpre')
})

test('o pacote tem os sete arquivos, nomeados pelo mês', () => {
  const arquivos = arquivosDoPacote(BASE)
  assert.equal(arquivos.length, 7)
  const nomes = arquivos.map((a) => a.nome)
  assert.deepEqual(nomes, [
    'LEIA-ME.txt',
    'espelho-de-ponto-2026-09.html',
    'batidas-2026-09.csv',
    'jornadas-2026-09.csv',
    'banco-de-horas-2026-09.csv',
    'horas-extras-2026-09.csv',
    'faltas-2026-09.csv',
  ])
  assert.ok(arquivos.every((a) => a.conteudo.length > 0), 'nenhum arquivo vazio')
})

test('🔴 o zip grava BOM em todo arquivo de texto', async () => {
  const { readFile } = await import('node:fs/promises')
  const zip = await readFile(new URL('./pacoteDoPontoZip.ts', import.meta.url), 'utf8')
  assert.match(zip, /\\ufeff/,
    'sem BOM o Excel no Windows lê "Serviço" como "ServiÃ§o" — o relatório chega à contabilidade '
    + 'com o nome de todo mundo corrompido')
})
