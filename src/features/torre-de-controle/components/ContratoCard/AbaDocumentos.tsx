/**
 * Aba DOCUMENTOS — o contrato assinado, aditivos e propostas, abrindo na própria tela.
 *
 * O arquivo vai para o Storage (bucket `project-documents`, que já existe e já tem regra por
 * organização); só a ficha fica no payload da obra. É o padrão de `PlanoAnexo` em
 * `ExecucaoPanel.tsx`, e deliberadamente NÃO o da aba Documentos de Projetos, que grava o PDF
 * inteiro em base64 dentro do banco — erro que o próprio repositório já teve de reverter no RDO
 * ("estourava localStorage e inflava o banco", 20260722130000_rdo_photos_bucket.sql).
 *
 * Duas coisas que nenhuma outra tela do projeto faz e que aqui importam: o PDF abre **inline**
 * (todas as outras abrem em aba nova), e a URL assinada é **renovada sob demanda** — ela expira
 * em uma hora e ninguém trata isso hoje.
 */
import { useState } from 'react'
import { Trash2, FileText, Eye, EyeOff, Download } from 'lucide-react'
import { uploadFile, getSignedUrl, removeFile } from '@/lib/storage'
import { useAuth } from '@/lib/auth'
import { fmtDataBR } from '@/lib/utils'
import type { ObraContrato, ObraDocumento } from '@/types'
import { TXT } from './formato'
import { BotaoSec, Aviso } from './ui'
import { AreaDeSoltar } from '@/components/shared/AreaDeSoltar'

const BUCKET = 'project-documents' as const
const LIMITE_MB = 15

const TIPOS: { v: ObraDocumento['tipo']; label: string }[] = [
  { v: 'contrato', label: 'Contrato' },
  { v: 'aditivo',  label: 'Aditivo' },
  { v: 'proposta', label: 'Proposta' },
  { v: 'art',      label: 'ART' },
  { v: 'nf',       label: 'Nota fiscal' },
  { v: 'outro',    label: 'Outro' },
]

const tamanho = (b?: number) =>
  b == null ? '' : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`

export function AbaDocumentos({ contrato, salvar }: {
  contrato: ObraContrato
  salvar: (patch: Partial<ObraContrato>) => void
}) {
  const email = useAuth((s) => s.profile?.email)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tipo, setTipo] = useState<ObraDocumento['tipo']>('contrato')
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)

  const docs = contrato.documentos ?? []
  // Mais recente em cima: é o que "versões empilhadas por data" quer dizer na prática — o aditivo
  // de ontem aparece antes do contrato original, sem ninguém ter de numerar versão à mão.
  const ordenados = [...docs].sort((a, b) => (b.enviadoEm ?? '').localeCompare(a.enviadoEm ?? ''))

  async function enviar(file: File) {
    setErro(null)
    if (file.size > LIMITE_MB * 1024 * 1024) {
      setErro(`O arquivo tem ${tamanho(file.size)} e o limite é ${LIMITE_MB} MB.`)
      return
    }
    setEnviando(true)
    try {
      const r = await uploadFile(BUCKET, file, `contrato/${(contrato.numeroContrato || 'obra').replace(/[^\w-]/g, '')}`)
      if (!r) { setErro('Não consegui enviar o arquivo. Tente de novo.'); return }
      const doc: ObraDocumento = {
        id: crypto.randomUUID(), tipo, nome: file.name, storagePath: r.path,
        mime: r.mimeType, tamanho: r.size, enviadoEm: new Date().toISOString(), enviadoPor: email ?? undefined,
      }
      salvar({ documentos: [...docs, doc] })
    } finally { setEnviando(false) }
  }

  /** Abre o visualizador. A URL é pedida na hora — assinada, e válida por uma hora. */
  async function abrir(doc: ObraDocumento) {
    if (abertoId === doc.id) { setAbertoId(null); setUrl(null); return }
    setAbertoId(doc.id); setUrl(null)
    setUrl(await getSignedUrl(BUCKET, doc.storagePath, 3600))
  }

  async function baixar(doc: ObraDocumento) {
    const u = await getSignedUrl(BUCKET, doc.storagePath, 300)
    if (u) window.open(u, '_blank', 'noopener')
  }

  async function excluir(doc: ObraDocumento) {
    // Confirmação continua aqui de propósito: desfazer não traz de volta um arquivo já apagado do
    // bucket. O critério do projeto é esse — o que tem arquivo ou cascata pergunta antes.
    if (!window.confirm(`Excluir "${doc.nome}"?\n\nO arquivo sai do servidor e não dá para desfazer.`)) return
    salvar({ documentos: docs.filter((d) => d.id !== doc.id) })
    if (abertoId === doc.id) { setAbertoId(null); setUrl(null) }
    // Best-effort: se a remoção do arquivo falhar, a ficha já saiu e o arquivo fica órfão — o que
    // é preferível ao contrário (ficha apontando para arquivo que não existe mais).
    void removeFile(BUCKET, doc.storagePath)
  }

  return (
    <div className="flex flex-col gap-2.5 pt-1">
      {erro && <Aviso tom="erro">{erro}</Aviso>}

      <div className="flex flex-wrap items-center gap-2">
        <label className={`text-[11px] ${TXT.fraco}`}>Tipo:</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as ObraDocumento['tipo'])}
                className="rounded border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-[11px] text-[#f5f5f5] outline-none">
          {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
        <AreaDeSoltar
          compacto
          aceita="application/pdf,image/*"
          desabilitado={enviando}
          titulo={enviando ? 'Enviando…' : 'Arraste o arquivo ou clique'}
          aoEscolher={(arquivos) => { const f = arquivos[0]; if (f) void enviar(f) }}
        />
      </div>

      {ordenados.length === 0 ? (
        <p className={`py-2 text-[11px] ${TXT.fraco}`}>
          Nenhum documento. Suba o contrato assinado, os aditivos e a proposta — eles ficam empilhados
          por data, o mais recente em cima, e abrem aqui mesmo.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {ordenados.map((d) => (
            <li key={d.id} className="rounded-lg border border-[#525252] bg-[#2c2c2c]">
              <div className="flex items-center gap-2 px-2.5 py-2">
                <FileText size={13} className="shrink-0 text-[#a3a3a3]" />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-xs font-semibold ${TXT.forte}`}>{d.nome}</p>
                  <p className={`text-[11px] ${TXT.fraco}`}>
                    {TIPOS.find((t) => t.v === d.tipo)?.label ?? d.tipo}
                    {' · '}{fmtDataBR(d.enviadoEm.slice(0, 10))}
                    {d.tamanho ? ` · ${tamanho(d.tamanho)}` : ''}
                    {d.enviadoPor ? ` · ${d.enviadoPor}` : ''}
                  </p>
                </div>
                <BotaoSec onClick={() => void abrir(d)} title="Ver aqui na tela">
                  {abertoId === d.id ? <EyeOff size={11} /> : <Eye size={11} />}
                  {abertoId === d.id ? 'Fechar' : 'Ver'}
                </BotaoSec>
                <BotaoSec onClick={() => void baixar(d)} title="Abrir em outra aba"><Download size={11} /></BotaoSec>
                <button onClick={() => void excluir(d)} title="Excluir"
                        className="rounded px-2 py-1 text-[#a3a3a3] hover:bg-[#ef4444]/15 hover:text-[#ef4444]">
                  <Trash2 size={12} />
                </button>
              </div>

              {abertoId === d.id && (
                <div className="border-t border-[#525252] p-2">
                  {!url ? (
                    <p className={`py-6 text-center text-[11px] ${TXT.fraco}`}>Abrindo…</p>
                  ) : d.mime?.startsWith('image/') ? (
                    <img src={url} alt={d.nome} className="max-h-[520px] w-full rounded object-contain" />
                  ) : (
                    <iframe src={url} title={d.nome} className="h-[520px] w-full rounded bg-white" />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className={`text-[11px] ${TXT.fraco}`}>
        PDF e imagem, até {LIMITE_MB} MB. Os arquivos ficam no servidor, visíveis só para a sua empresa.
      </p>
    </div>
  )
}
