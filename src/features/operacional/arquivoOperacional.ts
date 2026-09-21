import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { SABESP_SHEETS, type AbaNoSistema, type LinhaOperacional, type SabespGuide, type SabespSheetId } from './sabespStore'
import { chaveDaColuna } from './leitorPlanilha'

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
