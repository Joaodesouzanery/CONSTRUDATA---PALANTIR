/**
 * O encanamento do pacote do mês: monta o `.zip` e baixa.
 *
 * Nenhuma regra mora aqui — ela está em `pacoteDoPonto.ts`, que é puro e testado. A separação
 * existe porque o `jszip` não carrega no resolver de testes do projeto; é a mesma divisão de
 * `leitorPlanilha` / `leitorPlanilhaZip`.
 */
import JSZip from 'jszip'
import { arquivosDoPacote, type EntradaDoPacote } from './pacoteDoPonto'

export async function baixarPacoteDoPonto(e: EntradaDoPacote, nomeBase: string): Promise<number> {
  const zip = new JSZip()
  const arquivos = arquivosDoPacote(e)
  for (const a of arquivos) {
    // ⚠️ BOM em todo arquivo de texto. Sem ele o Excel em Windows lê "Serviço" como "ServiÃ§o", e
    // o relatório chega ao contador com o nome de todo mundo corrompido.
    zip.file(a.nome, `\ufeff${a.conteudo}`, { createFolders: false })
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${nomeBase}.zip`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 500)
  return arquivos.length
}
