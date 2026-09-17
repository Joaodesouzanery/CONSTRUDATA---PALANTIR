/**
 * leitorPlanilhaZip.ts — abrir o `.xlsx` e entregar o XML das abas.
 *
 * Só encanamento. A REGRA (os três formatos de lista, os tipos que não são lista, o mapa nome da
 * aba → arquivo) mora em `leitorPlanilha.ts`, que é puro e testado. A separação existe por um
 * motivo prático: o `jszip` não carrega no resolver de testes de mesa do projeto, e deixar a regra
 * junto dele deixaria a regra sem teste. A cobertura ponta-a-ponta contra o arquivo real fica no
 * `scripts/qa/qa-operacional.mjs`.
 */
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { mapaDasAbas, validacoesDoXml, type ValidacaoLida } from './leitorPlanilha'

export async function lerValidacoes(buffer: ArrayBuffer, wb: XLSX.WorkBook): Promise<ValidacaoLida[]> {
  const zip = await JSZip.loadAsync(buffer)
  const rels = await zip.file('xl/_rels/workbook.xml.rels')?.async('text')
  const workbookXml = await zip.file('xl/workbook.xml')?.async('text')
  if (!rels || !workbookXml) return []

  const arquivos = mapaDasAbas(workbookXml, rels)
  const out: ValidacaoLida[] = []
  for (const aba of wb.SheetNames) {
    const caminho = arquivos.get(aba)
    const xml = caminho ? await zip.file(caminho)?.async('text') : undefined
    if (!xml) continue
    out.push(...validacoesDoXml(xml, aba, wb))
  }
  return out
}

/** Quantos blocos de formatação condicional a planilha tem — hoje só para informar na conferência. */
export async function contarFormatacaoCondicional(buffer: ArrayBuffer): Promise<number> {
  const zip = await JSZip.loadAsync(buffer)
  let total = 0
  for (const nome of Object.keys(zip.files)) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(nome)) continue
    const xml = await zip.file(nome)?.async('text')
    if (xml) total += [...xml.matchAll(/<conditionalFormatting/g)].length
  }
  return total
}
