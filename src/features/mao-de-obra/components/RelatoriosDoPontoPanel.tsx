/**
 * Relatórios do ponto — espelho, banco de horas, pendências, em PDF e Excel.
 *
 * ⚠️ O recorte vai IMPRESSO no documento, por extenso ("Período: 01/09 a 30/09 · Obra: Bertioga ·
 * 12 funcionários"). É isso que torna o papel conferível: quem recebe sabe o que foi somado e o
 * que ficou de fora. Relatório sem recorte declarado é um número que ninguém pode auditar — e o
 * destino deste aqui é a contabilidade e, eventualmente, uma fiscalização.
 */
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { FileText, Sheet, AlertTriangle, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useCompanySettingsStore } from '@/store/companySettingsStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { useAppModeStore } from '@/store/appModeStore'
import { openReportWindow, printHtmlInto, printViaIframe } from '@/lib/printReport'
import { saldoDoPeriodo } from '../utils/bancoDeHoras'
import { buildEspelhoHtml, type EspelhoDoTrabalhador, type EspelhoSecoes } from '../utils/espelhoPontoExport'
import { exportEspelhoXlsx } from '../utils/espelhoPontoXlsx'
import { cn, fmtDataBR } from '@/lib/utils'
import type { Jornada } from '@/features/ponto/jornada'
import type { Worker } from '@/types'

const SECOES: Array<{ key: keyof EspelhoSecoes; label: string; hint: string }> = [
  { key: 'resumo',      label: 'Resumo do período', hint: 'Jornadas, horas e pendências por pessoa' },
  { key: 'grade',       label: 'Marcações',         hint: 'A grade dia a dia, com NSR — o corpo do documento' },
  { key: 'banco',       label: 'Banco de horas',    hint: 'Previsto, trabalhado e saldo' },
  { key: 'pendencias',  label: 'Pendências',        hint: 'O que precisa de correção, listado à parte' },
  { key: 'assinaturas', label: 'Assinaturas',       hint: 'Linhas do trabalhador e da empresa — exigidas no espelho' },
]

const REGIME: Record<string, string> = {
  standard: 'Padrão (5x2)', '5x2': '5x2', '6x1': '6x1', '12x36': '12x36',
  daily: 'Diarista', custom: 'Personalizado',
}

interface Props {
  jornadas: Jornada[]
  workers: Worker[]
  de: string
  ate: string
  obraLabel?: string
}

export function RelatoriosDoPontoPanel({ jornadas, workers, de, ate, obraLabel }: Props) {
  const [secoes, setSecoes] = useState<EspelhoSecoes>({
    resumo: true, grade: true, banco: true, pendencias: true, assinaturas: true,
  })
  const [somenteComBatida, setSomenteComBatida] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const cltSettings = useMaoDeObraStore((s) => s.cltSettings)
  const holidays = usePlanejamentoStore(useShallow((s) => s.holidays))
  const profile = useAuth((s) => s.profile)
  const companyName = useCompanySettingsStore((s) => s.companyName)
  const isDemo = useAppModeStore((s) => s.isDemoMode)

  const feriados = useMemo(() => new Set((holidays ?? []).map((h) => h.date)), [holidays])

  const trabalhadores = useMemo<EspelhoDoTrabalhador[]>(() => {
    const comVinculo = workers.filter((w) => w.authUserId)
    return comVinculo
      .map((w) => {
        const minhas = jornadas.filter((j) => j.workerId === w.id)
        return {
          workerId: w.id,
          nome: w.name,
          matricula: w.registrationNumber,
          cargo: w.role,
          admissao: w.admissionDate,
          regime: w.scheduleType ? REGIME[w.scheduleType] : undefined,
          jornadas: minhas,
          banco: saldoDoPeriodo(w, minhas, de, ate, cltSettings, feriados),
        }
      })
      .filter((t) => !somenteComBatida || t.jornadas.length > 0)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [workers, jornadas, de, ate, cltSettings, feriados, somenteComBatida])

  /** O recorte por extenso — vai impresso no documento. */
  const recorte = useMemo(() => {
    const r = [`Período: ${fmtDataBR(de)} a ${fmtDataBR(ate)}`]
    if (obraLabel) r.push(`Obra: ${obraLabel}`)
    r.push(`${trabalhadores.length} funcionário(s)`)
    const pend = trabalhadores.reduce((s, t) => s + t.jornadas.filter((j) => j.pendencias.length > 0).length, 0)
    if (pend > 0) r.push(`${pend} jornada(s) a conferir`)
    if (somenteComBatida) r.push('Apenas quem bateu ponto no período')
    return r
  }, [de, ate, obraLabel, trabalhadores, somenteComBatida])

  function montarDados() {
    return {
      empresa: companyName || profile?.full_name || 'Empresa',
      organizacao: profile?.organization_id,
      obraLabel,
      emitidoPor: profile?.full_name ?? profile?.email ?? undefined,
      demo: isDemo,
      // ⚠️ `hoje` é INJETADO para o documento ser determinístico: gerar duas vezes no mesmo dia
      // produz exatamente o mesmo HTML, e o teste consegue afirmar isso.
      hoje: new Date().toISOString().slice(0, 10),
      recorte,
      de,
      ate,
      trabalhadores,
      secoes,
    }
  }

  async function gerarPdf() {
    // ⚠️ SÍNCRONO, antes de qualquer await: o navegador bloqueia window.open depois de promessa.
    const win = openReportWindow()
    setGerando(true); setErro(null)
    try {
      const html = buildEspelhoHtml(montarDados())
      if (win) await printHtmlInto(win, html)
      else await printViaIframe(html)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o relatório.')
      win?.close()
    } finally {
      setGerando(false)
    }
  }

  function gerarExcel() {
    setErro(null)
    try {
      exportEspelhoXlsx(trabalhadores, de, ate)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar a planilha.')
    }
  }

  const semGrade = !secoes.grade

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
        <p className="mb-1 text-sm font-semibold text-[#f5f5f5]">Espelho de ponto</p>
        <p className="mb-3 text-[11px] leading-5 text-[#adadad]">
          O documento que a CLT art. 74 §2º manda entregar: as marcações do período, com o número
          sequencial de cada uma, as pendências e as linhas de assinatura. Uma pessoa por página.
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#525252] bg-[#333] px-3 py-2">
          {recorte.map((r) => (
            <span key={r} className="rounded-full border border-[#525252] px-2 py-0.5 text-[10px] text-[#c9c9c9]">{r}</span>
          ))}
        </div>

        <div className="mb-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {SECOES.map((s) => (
            <label key={s.key} title={s.hint} className="flex cursor-pointer items-start gap-2 text-[11px] text-[#d4d4d4]">
              <input
                type="checkbox" checked={secoes[s.key]}
                onChange={(e) => setSecoes((p) => ({ ...p, [s.key]: e.target.checked }))}
                className="mt-0.5 accent-[#f97316]"
              />
              <span><b className="text-[#f5f5f5]">{s.label}</b> — {s.hint}</span>
            </label>
          ))}
          <label className="flex cursor-pointer items-start gap-2 text-[11px] text-[#d4d4d4]">
            <input
              type="checkbox" checked={somenteComBatida}
              onChange={(e) => setSomenteComBatida(e.target.checked)}
              className="mt-0.5 accent-[#f97316]"
            />
            <span>
              <b className="text-[#f5f5f5]">Só quem bateu</b> — desmarcando, entra também quem tem
              conta vinculada e nenhuma marcação no período
            </span>
          </label>
        </div>

        {semGrade && (
          <p className="mb-3 flex items-start gap-2 rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2 text-[11px] leading-5 text-[#fbbf24]">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Sem a seção <b>Marcações</b> o papel deixa de ser um espelho de ponto — vira um resumo.
            Para entregar ao trabalhador ou a um fiscal, mantenha-a marcada.
          </p>
        )}

        {erro && (
          <p className="mb-3 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-[11px] text-[#fca5a5]">{erro}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button" onClick={() => void gerarPdf()} disabled={gerando || trabalhadores.length === 0}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white',
              gerando || trabalhadores.length === 0 ? 'cursor-not-allowed bg-[#525252]' : 'bg-[#f97316] hover:bg-[#ea6c10]',
            )}
          >
            {gerando ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
            {gerando ? 'Gerando…' : 'Gerar PDF'}
          </button>
          <button
            type="button" onClick={gerarExcel} disabled={trabalhadores.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-2 text-xs text-[#adadad] hover:text-[#f5f5f5] disabled:opacity-50"
          >
            <Sheet size={13} /> Excel (uma linha por jornada)
          </button>
          {trabalhadores.length === 0 && (
            <span className="self-center text-[11px] text-[#adadad]">
              Nenhum funcionário com marcação no período.
            </span>
          )}
        </div>
      </div>

      <p className="text-[11px] leading-5 text-[#6b6b6b]">
        O PDF é o documento: vai com NSR, pendências e assinatura, uma pessoa por página. A planilha
        é o outro lado — uma linha por jornada, com as horas em decimal, para a contabilidade somar
        e conferir contra a folha. ⚠️ Dia de regime sem jornada definida (diarista, personalizado)
        sai com previsto e saldo <b>vazios</b>, não zerados: zero afirmaria que a pessoa não devia
        trabalhar nada naquele dia.
      </p>
    </div>
  )
}
