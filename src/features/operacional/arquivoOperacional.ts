import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { SABESP_SHEETS, type AbaNoSistema, type LinhaOperacional, type SabespGuide, type SabespSheetId } from './sabespStore'
import { chaveDaColuna } from './leitorPlanilha'
import { celulasAlteradas } from './planilhaFiel'
import { gerarPlanilhaAtual, type ResultadoDaPlanilhaAtual } from './planilhaFielZip'

const BUCKET = 'operacional-planilhas'

const seguro = (nome: string) => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-')

export async function enviarArquivoOperacional(file: File, organizationId: string): Promise<string> {
  const path = `${organizationId}/${new Date().toISOString().replace(/[:.]/g, '-')}-${seguro(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', upsert: false })
  if (error) throw error
  return path
}

export async function baixarArquivoOriginal(path: string, nome: string): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw error
  baixarBlob(data, nome)
}

/**
 * "Exportar planilha atual": o arquivo do cliente de volta, com os dados de hoje.
 *
 * ⚠️ É CIRURGIA, não reconstrução. Baixa o `.xlsx` original guardado no bucket e reescreve nele
 * apenas as células que o sistema tem diferentes. As 50.838 fórmulas, as 55 listas, as 13 regras,
 * a ordem das abas, as colunas sem título e as linhas estruturais continuam onde estavam — porque
 * ninguém as tocou. `exportarWorkbookCompleto`, logo abaixo, faz o oposto e por isso se chama
 * "dados para análise": ele monta um arquivo novo, e monta menos do que o original tem.
 *
 * ⚠️ Sem o original guardado não existe planilha fiel — e é por isso que a tela desabilita o botão
 * com o motivo escrito em vez de entregar um arquivo pior fingindo ser este.
 */
export async function exportarPlanilhaAtual(
  path: string,
  abas: Partial<Record<SabespSheetId, AbaNoSistema>>,
  linhas: LinhaOperacional[],
): Promise<ResultadoDaPlanilhaAtual> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw error
  const buffer = await data.arrayBuffer()

  const paraEscrever = SABESP_SHEETS.flatMap((def) => {
    const meta = abas[def.id]
    if (!meta) return []
    const celulas = celulasAlteradas(def.id, meta, linhas.filter((l) => l.aba === def.id && l.ativa))
    return celulas.length ? [{ sheetName: def.sheetName, celulas }] : []
  })

  const r = await gerarPlanilhaAtual(buffer, paraEscrever)
  baixarBlob(r.blob, `Planilha-atual-${new Date().toISOString().slice(0, 10)}.xlsx`)
  return r
}

export function exportarAba(aba: SabespSheetId, meta: AbaNoSistema, linhas: LinhaOperacional[], formato: 'xlsx' | 'csv'): void {
  // ⚠️ O nome SABESP da aba, não o id interno. O arquivo saía com a guia chamada
  // "cadastro_servicos" — um nome que só existe dentro do código e que ninguém reconhece ao abrir.
  const nomeDaAba = SABESP_SHEETS.find((d) => d.id === aba)?.sheetName ?? aba
  const colunas = meta.colunas.filter((c) => c.temTitulo || linhas.some((l) => l.valores[chaveDaColuna(c)]))
  const aoa = [colunas.map((c) => c.titulo || `Campo ${c.indice + 1}`), ...linhas.filter((l) => l.ativa).map((l) => colunas.map((c) => l.valores[chaveDaColuna(c)] ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  if (formato === 'csv') {
    baixarBlob(new Blob(['\ufeff', XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv;charset=utf-8' }), `${nomeDaAba}.csv`)
    return
  }
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, nomeDaAba.slice(0, 31)); XLSX.writeFile(wb, `${nomeDaAba}.xlsx`)
}

export function exportarWorkbookCompleto(
  abas: Partial<Record<SabespSheetId, AbaNoSistema>>,
  linhas: LinhaOperacional[],
  guias: { rapido?: SabespGuide; leiaMe?: SabespGuide },
): void {
  const wb = XLSX.utils.book_new()
  if (guias.rapido) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(guias.rapido.linhas.map((x) => [x])), 'GUIA RÁPIDO')
  if (guias.leiaMe) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(guias.leiaMe.linhas.map((x) => [x])), '00. LEIA-ME')
  for (const def of SABESP_SHEETS) {
    const meta = abas[def.id]
    if (!meta) continue
    const daAba = linhas.filter((l) => l.aba === def.id && l.ativa)
    const colunas = meta.colunas.filter((c) => c.temTitulo || daAba.some((l) => l.valores[chaveDaColuna(c)]))
    const aoa = daAba.length
      ? [colunas.map((c) => c.titulo || `Campo ${c.indice + 1}`), ...daAba.map((l) => colunas.map((c) => l.valores[chaveDaColuna(c)] ?? ''))]
      : (meta.matriz ?? [])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), def.sheetName.slice(0, 31))
  }
  XLSX.writeFile(wb, `Operacional-Sabesp-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 500)
}
