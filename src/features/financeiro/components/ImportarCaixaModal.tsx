/**
 * A importação da planilha de Controle de Caixa — e a conferência antes de gravar.
 *
 * ⚠️ **Nada é gravado sem confirmar, e nada é apagado nunca.** O que sumiu da planilha é apontado,
 * não removido: a linha pode ter sido apagada por engano, e o lançamento já pode ter sido
 * conciliado. Quem apaga é a pessoa, uma a uma, na tela de Lançamentos.
 *
 * O fluxo é o que o cliente faz de verdade: mexe na planilha o mês inteiro e joga o arquivo aqui
 * várias vezes. Por isso a tela não pergunta "importar?" — ela responde "o que muda se eu
 * importar isto?".
 */
import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '@/lib/auth'
import { validateFileBeforeParse } from '@/lib/importEngine'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, X } from 'lucide-react'
import { fmtBRL } from '@/features/financeiro/lib/financeiroCalc'
import { fmtDataBR } from '@/lib/utils'
import { useEnvioUnico } from '@/hooks/useEnvioUnico'
import {
  lerLancamentos, lerHorasExtras, mesDoNomeDaAba, conferirTotaisDeHorasExtras,
  abasDeHorasExtras, abaDeLancamentos,
  type Matriz, type LeituraHorasExtras,
} from '../utils/controleDeCaixaPlanilha'
import {
  conferir, lancamentoDaLinha, lancamentoDaHoraExtra, horasExtrasQueViramDespesa,
  linhasAGravar, ROTULO_SITUACAO, type Conferencia, type Situacao,
} from '../utils/controleDeCaixaImport'
import type { FinanceiroEntry } from '@/types'

const COR_SITUACAO: Record<Situacao, string> = {
  'novo':              'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'valor-alterado':    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'cadastro-alterado': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  'inalterado':        'bg-[#3d3d3d] text-[#6b6b6b] border-[#525252]',
  'duplicado':         'bg-red-500/15 text-red-300 border-red-500/30',
}

const BTN_PRIMARIO = 'px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors disabled:opacity-40 disabled:hover:bg-[#f97316]'
const BTN_SECUNDARIO = 'rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-xs font-semibold text-[#e5e5e5] hover:border-[#f97316]/50 hover:text-[#f97316] transition-colors disabled:opacity-40'

interface Props {
  entries: FinanceiroEntry[]
  orgId: string | null | undefined
  obraId?: string
  onGravar: (lancamentos: FinanceiroEntry[]) => void
  onClose: () => void
}

interface Lido {
  nomeArquivo: string
  conferencia: Conferencia
  /**
   * ⚠️ LISTA. Era uma aba só, achada com `find` — e o cliente tem uma aba de horas extras POR MÊS
   * ("HORAS EXTRAS 08", "09"…). Da segunda em diante o dinheiro pago sumia sem erro na tela.
   */
  horasExtras: Array<{ aba: string; leitura: LeituraHorasExtras }>
  /** Abas de horas extras encontradas mas NÃO lidas, com o motivo. Nada some calado. */
  horasExtrasPuladas: Array<{ aba: string; motivo: string }>
  /** `true` quando nenhuma aba casou pelo nome e caiu na primeira. */
  abaPorPosicao: boolean
  ano: number
}

export function ImportarCaixaModal({ entries, orgId, obraId, onGravar, onClose }: Props) {
  const [lido, setLido] = useState<Lido | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const [mostrarInalterados, setMostrarInalterados] = useState(false)
  const perfil = useAuth((s) => s.profile)
  // Quem está importando é quem está conferindo — é o mesmo gesto.
  const quemConfere = perfil?.full_name ?? perfil?.email ?? undefined
  const travarEnvio = useEnvioUnico()

  async function aoEscolherArquivo(file: File) {
    setErro(null)
    setLendo(true)
    try {
      // ⚠️ O limite existe em `importEngine` desde sempre e este modal nunca o chamou: dava para
      // soltar um arquivo de 200 MB e travar a aba do navegador antes de qualquer erro útil.
      const ok = validateFileBeforeParse(file)
      if (!ok.ok) { setErro(ok.error); setLendo(false); return }

      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })

      // A aba de lançamentos é a que o gerador chama de LANÇAMENTOS; a planilha do cliente chama
      // de DESPESAS. Aceita as duas, e cai na primeira aba se não achar nenhuma — recusar por
      // causa do nome seria recusar o arquivo de quem montou a planilha sozinho.
      const escolha = abaDeLancamentos(wb.SheetNames)
      if (!escolha) { setErro('O arquivo não tem nenhuma aba.'); setLendo(false); return }
      const nomeLanc = escolha.aba
      const matriz = XLSX.utils.sheet_to_json(wb.Sheets[nomeLanc], { header: 1, raw: true, defval: null }) as Matriz
      const leitura = lerLancamentos(matriz)

      const agora = new Date().toISOString()
      const conferencia = conferir(leitura.lancamentos, entries, leitura.problemas, orgId, {
        obraId, agora, totaisDeclarados: leitura.totaisDeclarados,
      })

      // ⚠️ TODAS as abas de horas extras, não a primeira. O cliente tem uma por mês; com `find`,
      // de agosto em diante o dinheiro pago não entrava e ninguém era avisado.
      const abasHE = abasDeHorasExtras(wb.SheetNames)
      const horasExtras: Array<{ aba: string; leitura: LeituraHorasExtras }> = []
      const horasExtrasPuladas: Array<{ aba: string; motivo: string }> = []
      const ano = leitura.lancamentos[0]?.data
        ? Number(leitura.lancamentos[0].data.slice(0, 4))
        : new Date().getFullYear()

      for (const aba of abasHE) {
        const mes = mesDoNomeDaAba(aba)
        if (!mes) {
          // ⚠️ Antes isto era um `if (mes)` sem `else`: a aba existia, não era lida, e a tela não
          // dizia nada. Agora a pessoa sabe que precisa pôr o mês no nome.
          horasExtrasPuladas.push({ aba, motivo: 'não consegui achar o mês no nome da aba (ex.: "HORAS EXTRAS 08")' })
          continue
        }
        const mHE = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, raw: true, defval: null }) as Matriz
        horasExtras.push({ aba, leitura: lerHorasExtras(mHE, { mes, ano, nomeDaAba: aba }) })
      }

      setLido({
        nomeArquivo: file.name, conferencia, horasExtras, horasExtrasPuladas, ano,
        abaPorPosicao: escolha.porPosicao,
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler este arquivo. Ele é mesmo .xlsx?')
    } finally {
      setLendo(false)
    }
  }

  const paraGravar = useMemo(() => {
    if (!lido) return []
    const agora = new Date().toISOString()
    const daPlanilha = linhasAGravar(lido.conferencia)
      .map((l) => lancamentoDaLinha(l.lida, orgId, { obraId, agora, conferidoPor: quemConfere }))
    const daGrade = lido.horasExtras
      .flatMap(({ leitura }) => horasExtrasQueViramDespesa(leitura.registros))
      .map((r) => lancamentoDaHoraExtra(r, orgId, { obraId, agora }))
      // Só as que ainda não existem — reprocessar a grade não pode reescrever o que já está lá.
      .filter((e) => !entries.some((x) => x.id === e.id))
    return [...daPlanilha, ...daGrade]
  }, [lido, orgId, obraId, entries, quemConfere])

  const divergenciasHE = (lido?.horasExtras ?? []).flatMap(({ aba, leitura }) =>
    conferirTotaisDeHorasExtras(leitura).map((d) => ({ ...d, aba })))

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-5xl max-h-[88vh] flex flex-col rounded-xl border border-[#525252] bg-[#2d2d2d] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252] shrink-0">
          <div>
            <p className="text-sm font-semibold text-white">Importar planilha de caixa</p>
            <p className="text-[11px] text-[#9ca3af] mt-0.5">
              {lido
                ? `${lido.nomeArquivo} — confira o que vai mudar antes de gravar.`
                : 'Nada é gravado sem você confirmar, e nada é apagado.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[#6b6b6b] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!lido ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <FileSpreadsheet size={40} className="text-[#525252]" />
              <p className="text-sm text-[#a3a3a3]">Escolha a planilha preenchida.</p>
              <label className={`${BTN_PRIMARIO} inline-flex cursor-pointer items-center gap-1.5`}>
                <Upload size={13} />
                {lendo ? 'Lendo…' : 'Escolher arquivo'}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  disabled={lendo}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void aoEscolherArquivo(f) }}
                />
              </label>
              <p className="text-[11px] text-[#6b6b6b] max-w-md text-center">
                Serve a planilha que o sistema gera e também a que a equipe já mantém. O sistema
                reconhece as colunas pelo nome.
              </p>
              {erro && (
                <p className="rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-[11px] text-red-300">{erro}</p>
              )}
            </div>
          ) : (
            <Conferido
              lido={lido}
              divergenciasHE={divergenciasHE}
              mostrarInalterados={mostrarInalterados}
              onAlternarInalterados={() => setMostrarInalterados((v) => !v)}
            />
          )}
        </div>

        {lido && (
          <div className="flex items-center gap-2 px-5 py-4 border-t border-[#525252] shrink-0">
            <button type="button" onClick={() => setLido(null)} className={BTN_SECUNDARIO}>
              Escolher outro arquivo
            </button>
            <span className="text-[11px] text-[#6b6b6b] ml-auto">
              {paraGravar.length === 0
                ? 'Nada mudou — não há o que gravar.'
                : `${paraGravar.length} lançamento(s) serão gravados.`}
            </span>
            <button
              type="button"
              disabled={paraGravar.length === 0}
              onClick={() => { if (!travarEnvio()) return; onGravar(paraGravar); onClose() }}
              className={BTN_PRIMARIO}
            >
              Gravar {paraGravar.length > 0 ? paraGravar.length : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── O que vai mudar ──────────────────────────────────────────────────────────

function Conferido({
  lido, divergenciasHE, mostrarInalterados, onAlternarInalterados,
}: {
  lido: Lido
  /** `aba` viaja junto porque agora há uma grade de horas extras por mês. */
  divergenciasHE: Array<{ dia: number; calculado: number; declarado: number; aba: string }>
  mostrarInalterados: boolean
  onAlternarInalterados: () => void
}) {
  const c = lido.conferencia
  const visiveis = mostrarInalterados ? c.linhas : c.linhas.filter((l) => l.situacao !== 'inalterado')
  const nadaMudou = c.resumo.novo === 0 && c.resumo['valor-alterado'] === 0 && c.resumo['cadastro-alterado'] === 0

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {(Object.keys(ROTULO_SITUACAO) as Situacao[]).map((s) => (
          <div key={s} className={`rounded-lg border px-3 py-2 ${COR_SITUACAO[s]}`}>
            <p className="text-[10px] uppercase tracking-wider opacity-80">{ROTULO_SITUACAO[s]}</p>
            <p className="text-lg font-bold tabular-nums">{c.resumo[s]}</p>
          </div>
        ))}
      </div>

      {nadaMudou && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <CheckCircle2 size={14} /> Nada mudou. Esta planilha já está toda no sistema.
        </div>
      )}

      {c.periodo && (
        <p className="text-[11px] text-[#6b6b6b]">
          Período do arquivo: {fmtDataBR(c.periodo.de)} a {fmtDataBR(c.periodo.ate)}.
          {' '}A conferência do que sumiu se limita a esse período.
        </p>
      )}

      {/* Divergência com o rodapé da planilha */}
      {c.divergenciaDeTotais.length > 0 && (
        <Aviso titulo="A soma das linhas não bate com o total escrito na planilha">
          {c.divergenciaDeTotais.map((d) => (
            <p key={d.oQue}>
              {d.oQue}: as linhas somam <strong>{fmtBRL(d.calculado)}</strong>, mas o rodapé diz{' '}
              <strong>{fmtBRL(d.declarado)}</strong>. Alguém mexeu numa célula sem mexer na fórmula.
            </p>
          ))}
        </Aviso>
      )}

      {/* Erros de leitura */}
      {c.problemas.length > 0 && (
        <Aviso titulo={`${c.problemas.length} linha(s) não foram lidas`}>
          <ul className="space-y-0.5">
            {c.problemas.slice(0, 12).map((p, i) => (
              <li key={i}>
                Linha {p.linha}{p.coluna ? ` · ${p.coluna}` : ''}: {p.motivo}
                {p.conteudo ? ` (“${p.conteudo}”)` : ''}
              </li>
            ))}
            {c.problemas.length > 12 && <li>+{c.problemas.length - 12} outras</li>}
          </ul>
        </Aviso>
      )}

      {/* O que sumiu */}
      {c.ausentes.length > 0 && (
        <Aviso titulo={`${c.ausentes.length} lançamento(s) estão no sistema e não vieram neste arquivo`}>
          <p className="mb-1">Nada foi apagado. Confira se a linha saiu da planilha de propósito.</p>
          <ul className="space-y-0.5">
            {c.ausentes.slice(0, 8).map((a) => (
              <li key={a.entry.id}>
                {fmtDataBR(a.entry.data)} · {a.entry.descricao} · {fmtBRL(a.entry.valor)}
              </li>
            ))}
            {c.ausentes.length > 8 && <li>+{c.ausentes.length - 8} outros</li>}
          </ul>
        </Aviso>
      )}

      {/* Linha a linha */}
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-[#a3a3a3]">O que vai mudar</p>
        <button type="button" onClick={onAlternarInalterados} className="ml-auto text-[11px] text-[#f97316] hover:underline">
          {mostrarInalterados ? 'Esconder os inalterados' : `Mostrar os ${c.resumo.inalterado} inalterados`}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#525252]">
        <table className="w-full text-xs min-w-max">
          <thead>
            <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]">
              <th className="px-3 py-2 text-left">Situação</th>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-left">Solicitante</th>
              <th className="px-3 py-2 text-left">O que mudou</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f2937]">
            {visiveis.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-[#6b6b6b]">Nenhuma mudança.</td></tr>
            ) : visiveis.slice(0, 300).map((l, i) => (
              <tr key={`${l.id}-${i}`} className="hover:bg-white/[0.02]">
                <td className="px-3 py-2">
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${COR_SITUACAO[l.situacao]}`}>
                    {ROTULO_SITUACAO[l.situacao]}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-[#a3a3a3]">
                  {fmtDataBR(l.lida.data)}
                  {l.lida.dataFim && <span className="text-[#6b6b6b]"> a {fmtDataBR(l.lida.dataFim)}</span>}
                </td>
                <td className="px-3 py-2 text-[#f5f5f5] max-w-md truncate">{l.lida.descricao}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[#f5f5f5]">{fmtBRL(l.lida.valor)}</td>
                <td className="px-3 py-2 text-[#a3a3a3]">{l.lida.solicitantes.join(' + ') || '—'}</td>
                <td className="px-3 py-2 text-[11px]">
                  {l.mudancas.length === 0 ? (
                    <span className="text-[#6b6b6b]">—</span>
                  ) : l.mudancas.map((m) => (
                    <span key={m.campo} className="block">
                      <span className="text-[#6b6b6b]">{m.rotulo}:</span>{' '}
                      <span className="text-[#6b6b6b] line-through">{textoDoValor(m.antes)}</span>
                      {' → '}
                      <span className="text-[#f5f5f5]">{textoDoValor(m.depois)}</span>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visiveis.length > 300 && (
        <p className="text-[11px] text-[#6b6b6b]">
          Mostrando as 300 primeiras de {visiveis.length}. Todas serão gravadas.
        </p>
      )}

      {/* Horas extras — uma seção por aba, porque o cliente tem uma aba por mês */}
      {lido.horasExtras.map(({ aba, leitura }) => {
        const divergencias = divergenciasHE.filter((d) => d.aba === aba)
        return (
          <div key={aba} className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-[#a3a3a3]">
              Horas extras — aba “{aba}”
            </p>
            <p className="text-[11px] text-[#6b6b6b]">
              {leitura.registros.length} lançamento(s) na grade;{' '}
              <strong className="text-[#a3a3a3]">
                {horasExtrasQueViramDespesa(leitura.registros).length} marcados como pagos (PG)
              </strong>{' '}
              viram despesa no caixa. Os demais ficam registrados como previstos e não entram no caixa.
            </p>
            {divergencias.length > 0 && (
              <Aviso titulo="A soma por dia não bate com a linha TOTAIS da grade">
                {divergencias.map((d) => (
                  <p key={d.dia}>
                    Dia {String(d.dia).padStart(2, '0')}: as linhas somam <strong>{fmtBRL(d.calculado)}</strong>,
                    {' '}o rodapé diz <strong>{fmtBRL(d.declarado)}</strong>.
                  </p>
                ))}
              </Aviso>
            )}
            {leitura.problemas.length > 0 && (
              <Aviso titulo={`${leitura.problemas.length} célula(s) da grade não foram lidas`}>
                <ul className="space-y-0.5">
                  {leitura.problemas.slice(0, 8).map((p, i) => (
                    <li key={i}>Linha {p.linha} · {p.coluna}: {p.motivo}</li>
                  ))}
                </ul>
              </Aviso>
            )}
          </div>
        )
      })}

      {/* ⚠️ Aba que existe e NÃO foi lida precisa aparecer. Antes ela sumia calada. */}
      {lido.horasExtrasPuladas.length > 0 && (
        <Aviso titulo={`${lido.horasExtrasPuladas.length} aba(s) de horas extras não foram lidas`}>
          <ul className="space-y-0.5">
            {lido.horasExtrasPuladas.map((h) => (
              <li key={h.aba}>“{h.aba}”: {h.motivo}</li>
            ))}
          </ul>
        </Aviso>
      )}

      {/* ⚠️ Nenhuma aba casou pelo nome — foi lida a primeira. Num arquivo com muitas abas isso
          pode ser a aba errada, e é melhor a pessoa saber antes de gravar. */}
      {lido.abaPorPosicao && (
        <Aviso titulo="Nenhuma aba com nome de lançamentos foi encontrada">
          <p>
            Li a primeira aba do arquivo. Se ela não for a dos lançamentos, renomeie-a para
            “LANÇAMENTOS” ou “DESPESAS” e importe de novo.
          </p>
        </Aviso>
      )}
    </div>
  )
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
      <p className="flex items-center gap-1.5 font-semibold mb-1">
        <AlertTriangle size={13} className="shrink-0" /> {titulo}
      </p>
      <div className="pl-[18px] space-y-0.5">{children}</div>
    </div>
  )
}

function textoDoValor(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return fmtBRL(v)
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  if (Array.isArray(v)) return v.length ? v.join(' + ') : '—'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return fmtDataBR(v)
  return String(v)
}
