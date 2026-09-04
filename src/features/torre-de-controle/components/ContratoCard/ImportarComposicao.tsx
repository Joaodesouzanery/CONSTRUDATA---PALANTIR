/**
 * Importar a composição — planilha (.xlsx/.csv) ou colar direto do Excel.
 *
 * Três passos: escolher a origem → conferir para onde cada coluna vai → revisar e confirmar.
 * O mapeamento vem sugerido, mas é editável: nenhuma planilha real tem os cabeçalhos que o
 * sistema esperaria, e rejeitar o arquivo inteiro por causa disso (que é o que o importador
 * genérico faz) não ajuda ninguém.
 *
 * Ler tabela de dentro de PDF ficou de fora de propósito — o texto sai embaralhado e o resultado
 * erra número sem avisar, que é o pior tipo de erro num contrato.
 */
import { useState } from 'react'
import { X, ClipboardPaste, AlertTriangle } from 'lucide-react'
import { previewExcel } from '@/features/suprimentos/utils/parseExcelEstoque'
import {
  mapearAutomatico, aplicarMapeamento, detectarConflitos, lerTabelaColada,
  ROTULO_CAMPO, type CampoComposicao, type LinhaImportada,
} from '@/features/torre-de-controle/utils/composicaoImport'
import { subtotaisComposicao } from '@/features/torre-de-controle/utils/obraMedicao'
import type { ObraContratoServico } from '@/types'
import { TXT, brl, num, inputCls } from './formato'
import { Th, BotaoSec, Aviso } from './ui'
import { AreaDeSoltar } from '@/components/shared/AreaDeSoltar'

const CAMPOS = Object.keys(ROTULO_CAMPO) as CampoComposicao[]

export function ImportarComposicao({ onImportar, onCancelar }: {
  onImportar: (itens: ObraContratoServico[]) => void
  onCancelar: () => void
}) {
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapa, setMapa] = useState<Record<string, CampoComposicao>>({})
  const [colando, setColando] = useState(false)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function receber(hs: string[], rs: Record<string, string>[]) {
    if (hs.length === 0 || rs.length === 0) {
      setErro('Não encontrei nenhuma linha. Confira se a primeira linha é o cabeçalho.')
      return
    }
    setErro(null)
    setHeaders(hs); setRows(rs); setMapa(mapearAutomatico(hs)); setColando(false)
  }

  async function aoEscolherArquivo(file: File) {
    try {
      const p = await previewExcel(file)
      receber(p.headers, p.rows)
    } catch {
      setErro('Não consegui ler este arquivo. Ele precisa ser .xlsx, .xls ou .csv.')
    }
  }

  const conflitos = detectarConflitos(mapa)
  const itens: LinhaImportada[] = headers.length ? aplicarMapeamento(rows, mapa) : []
  const comAviso = itens.filter((i) => i.aviso)
  const sub = subtotaisComposicao(itens as ObraContratoServico[])
  const semDescricao = headers.length > 0 && !Object.values(mapa).includes('descricao')

  function confirmar() {
    onImportar(itens.map((i, idx) => {
      const { aviso: _aviso, ...item } = i
      void _aviso   // o aviso é só da tela de conferência; não vai para o contrato
      return { ...item, id: crypto.randomUUID(), ordem: item.ordem ?? idx + 1 }
    }))
  }

  // ── Passo 1: de onde vem ────────────────────────────────────────────────────
  if (headers.length === 0) {
    return (
      <div className="flex flex-col gap-3 pt-1">
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        {colando ? (
          <>
            <p className={`text-[11px] ${TXT.normal}`}>
              No Excel, selecione as células <b>com a linha de cabeçalho</b>, copie, e cole aqui.
            </p>
            <textarea
              autoFocus rows={8} value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder={'ITEM\tDESCRIÇÃO\tUN\tQTD\tMão de obra\tTOTAL'}
              className={`${inputCls} font-mono`}
            />
            <div className="flex gap-2">
              <button onClick={() => { const t = lerTabelaColada(texto); receber(t.headers, t.rows) }}
                disabled={!texto.trim()}
                className="rounded-lg bg-[#f97316] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#ea580c] disabled:opacity-40">
                Ler o que colei
              </button>
              <BotaoSec onClick={() => setColando(false)}>Voltar</BotaoSec>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <AreaDeSoltar
                compacto
                aceita=".xlsx,.xls,.csv"
                titulo="Arraste a planilha ou clique"
                aoEscolher={(arquivos) => { const f = arquivos[0]; if (f) void aoEscolherArquivo(f) }}
              />
              <BotaoSec onClick={() => setColando(true)}><ClipboardPaste size={11} /> Colar do Excel</BotaoSec>
              <BotaoSec onClick={onCancelar}><X size={11} /> Cancelar</BotaoSec>
            </div>
            <Aviso>
              A planilha do contrato costuma ter ITEM · DESCRIÇÃO · UN · QTD · mão de obra · total.
              Não precisa arrumar os nomes das colunas: o sistema adivinha e você confere no passo seguinte.
              <br />
              <b>PDF não serve para isto.</b> Extrair uma tabela de PDF erra número sem avisar; suba o PDF
              na aba Documentos, para leitura, e traga os números pela planilha.
            </Aviso>
          </>
        )}
      </div>
    )
  }

  // ── Passo 2 e 3: conferir o mapeamento e revisar ────────────────────────────
  return (
    <div className="flex flex-col gap-3 pt-1">
      <p className={`text-[11px] ${TXT.normal}`}>
        <b>{rows.length} linha(s) lida(s).</b> Confira para onde vai cada coluna:
      </p>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {headers.map((h) => (
          <label key={h} className="flex items-center gap-2">
            <span className={`w-1/2 truncate text-[11px] ${TXT.normal}`} title={h}>{h}</span>
            <select className={`${inputCls} w-1/2`} value={mapa[h]}
                    onChange={(e) => setMapa((m) => ({ ...m, [h]: e.target.value as CampoComposicao }))}>
              {CAMPOS.map((c) => <option key={c} value={c}>{ROTULO_CAMPO[c]}</option>)}
            </select>
          </label>
        ))}
      </div>

      {conflitos.length > 0 && (
        <Aviso tom="atencao">
          <AlertTriangle size={11} className="mr-1 inline" />
          Duas colunas apontando para o mesmo campo:{' '}
          {conflitos.map((c) => `${ROTULO_CAMPO[c.campo]} (${c.cabecalhos.join(', ')})`).join(' · ')}.
          Escolha uma e deixe a outra como “ignorar”.
        </Aviso>
      )}
      {semDescricao && <Aviso tom="erro">Falta apontar qual coluna é a <b>descrição</b> — sem ela nenhuma linha entra.</Aviso>}

      {itens.length > 0 && (
        <>
          <div className="max-h-64 overflow-auto rounded border border-[#525252]">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="sticky top-0 bg-[#2c2c2c]">
                <tr>
                  <Th>Nº</Th><Th>Descrição</Th><Th alinha="right">Qtd</Th>
                  <Th alinha="right">Mão de obra</Th><Th alinha="right">Material</Th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i, k) => (
                  <tr key={k} className="border-t border-[#3d3d3d]">
                    <td className={`py-1 pl-1 pr-2 font-mono ${TXT.fraco}`}>{i.ordem}</td>
                    <td className={`py-1 pr-2 ${TXT.forte}`}>
                      {i.descricao}
                      {i.aviso && <span className={`ml-1.5 text-[11px] ${TXT.atencao}`}>⚠ {i.aviso}</span>}
                    </td>
                    <td className={`py-1 text-right font-mono tabular-nums ${TXT.normal}`}>{num(i.qtdContrato)} {i.unidade}</td>
                    <td className={`py-1 text-right font-mono tabular-nums ${TXT.normal}`}>{brl(i.valorUnitario)}</td>
                    <td className={`py-1 pr-1 text-right font-mono tabular-nums ${TXT.normal}`}>{brl(i.valorMaterialUnit ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className={`text-[11px] ${TXT.normal}`}>
            Vai entrar: <b>{itens.length} item(ns)</b> · serviço <b>{brl(sub.servico)}</b> ·
            material <b>{brl(sub.material)}</b> · total <b>{brl(sub.total)}</b>
          </p>
          {comAviso.length > 0 && (
            <Aviso tom="atencao">
              {comAviso.length} linha(s) em que o total da planilha não bate com quantidade × preço.
              Elas entram assim mesmo — confira depois na composição.
            </Aviso>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={confirmar} disabled={itens.length === 0 || conflitos.length > 0}
          className="rounded-lg bg-[#f97316] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#ea580c] disabled:opacity-40">
          Substituir a composição por estes {itens.length} item(ns)
        </button>
        <BotaoSec onClick={() => { setHeaders([]); setRows([]); setTexto('') }}>Escolher outra origem</BotaoSec>
        <BotaoSec onClick={onCancelar}><X size={11} /> Cancelar</BotaoSec>
      </div>
      <p className={`text-[11px] ${TXT.fraco}`}>
        Importar <b>substitui</b> a composição atual inteira — não soma às linhas que já existem.
      </p>
    </div>
  )
}
