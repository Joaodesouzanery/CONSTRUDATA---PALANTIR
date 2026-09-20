/**
 * Espelho de ponto em Excel — a planilha que vai para a contabilidade.
 *
 * O PDF é o documento (assinado, com NSR, para o trabalhador e o fiscal). Este arquivo é o outro
 * lado: uma linha por jornada, para o contador somar, filtrar e conferir contra a folha.
 *
 * Receita copiada de `boletosXlsxExport.ts`, que já resolveu os dois detalhes que estragam
 * planilha gerada por sistema: coluna de texto longo forçada a string (senão o Excel transforma
 * matrícula em número e come o zero à esquerda) e largura de coluna definida, para ninguém receber
 * uma planilha de `####`.
 */
import * as XLSX from 'xlsx'
import { TEXTO_DA_PENDENCIA } from '@/features/ponto/jornada'
import type { EspelhoDoTrabalhador } from './espelhoPontoExport'

const CABECALHO = [
  'Matrícula', 'Funcionário', 'Cargo', 'Data', 'Dia', 'Entrada', 'Saída',
  'Intervalo (h)', 'Trabalhado (h)', 'Previsto (h)', 'Saldo (h)', 'NSR', 'Pendências',
]

const LARGURAS = [12, 28, 18, 11, 6, 9, 9, 13, 15, 13, 11, 18, 40]

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** Minutos → horas decimais, que é o que a contabilidade soma. O PDF mostra "8h48"; aqui, 8,8. */
const emHoras = (min: number) => Math.round((min / 60) * 100) / 100

const hora = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

export function exportEspelhoXlsx(
  trabalhadores: readonly EspelhoDoTrabalhador[],
  de: string,
  ate: string,
  nomeArquivo?: string,
): void {
  const linhas: Array<Array<string | number>> = []

  for (const t of trabalhadores) {
    // O saldo por dia vem do banco de horas quando ele existe; diarista e regime personalizado
    // simplesmente não têm previsto, e a célula fica VAZIA em vez de zero — zero seria afirmar
    // que a pessoa não devia trabalhar nada naquele dia.
    const porDia = new Map((t.banco?.dias ?? []).map((d) => [d.data, d]))

    for (const j of t.jornadas) {
      const dia = porDia.get(j.data)
      const temPrevisto = !!dia && !dia.foraDaConta
      linhas.push([
        t.matricula ?? '',
        t.nome,
        t.cargo ?? '',
        j.data,
        SEMANA[new Date(j.data + 'T00:00:00').getDay()],
        hora(j.entrada?.momentoDispositivo),
        hora(j.saida?.momentoDispositivo),
        emHoras(j.intervaloMin),
        emHoras(j.minutosTrabalhados),
        temPrevisto ? emHoras(dia!.previstoMin) : '',
        temPrevisto ? emHoras(dia!.saldoMin) : '',
        j.nsrs.join(' '),
        j.pendencias.map((p) => TEXTO_DA_PENDENCIA[p]).join('; '),
      ])
    }
  }

  const totalTrabalhado = trabalhadores
    .flatMap((t) => t.jornadas)
    .reduce((s, j) => s + j.minutosTrabalhados, 0)

  linhas.push([])
  linhas.push(['', 'TOTAL', '', '', '', '', '', '', emHoras(totalTrabalhado), '', '', '', ''])

  const ws = XLSX.utils.aoa_to_sheet([CABECALHO, ...linhas])
  ws['!cols'] = LARGURAS.map((wch) => ({ wch }))

  // ⚠️ Matrícula e NSR são IDENTIFICADORES, não números. Sem forçar o tipo, o Excel come o zero à
  // esquerda de "0042" e escreve NSR longo em notação científica.
  const intervalo = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let linha = 1; linha <= intervalo.e.r; linha++) {
    for (const coluna of [0, 11]) {
      const cel = ws[XLSX.utils.encode_cell({ r: linha, c: coluna })]
      if (cel) { cel.t = 's'; cel.z = '@' }
    }
    for (const coluna of [7, 8, 9, 10]) {
      const cel = ws[XLSX.utils.encode_cell({ r: linha, c: coluna })]
      if (cel && typeof cel.v === 'number') cel.z = '#,##0.00'
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Espelho de ponto')
  XLSX.writeFile(wb, nomeArquivo ?? `espelho-de-ponto-${de}-a-${ate}.xlsx`)
}
