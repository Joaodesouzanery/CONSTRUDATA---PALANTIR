/**
 * "A planilha vai sobrescrever isto." — a tela que o cliente pediu.
 *
 * A planilha VENCE, sempre; a lista abaixo existe para que ela não vença calada. O que aparece
 * primeiro é o CONFLITO: a linha que alguém editou no sistema e a planilha contradiz, com nome e
 * data de quem editou. O resto (linha nova, atualização de rotina) fica resumido em contadores.
 */
import { AlertTriangle, ArrowRight, Download, FileSpreadsheet, X } from 'lucide-react'
import type { PreviaDaImportacao } from '../importarPlanilha'
import { relatorioDeDivergencias, resumirPorAba } from '../conferenciaOperacional'
import { SABESP_SHEETS } from '../sabespStore'

const dataBR = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

export function ConferenciaImportacao({ previa, onCancelar, onConfirmar }: {
  previa: PreviaDaImportacao
  onCancelar: () => void
  onConfirmar: () => void
}) {
  const conflitos = previa.conferencia.filter((l) => l.situacao === 'conflito')
  const ausentes = previa.conferencia.filter((l) => l.situacao === 'ausente')
  const porAba = resumirPorAba(previa.conferencia)
  // As contagens estruturais moram em `abas`, indexadas pelo id interno; a conferência usa o
  // rótulo da aba. É aqui que as duas se encontram.
  const estruturalDaAba = new Map(SABESP_SHEETS.map((d) => [d.label, previa.abas[d.id]]))
  const reidentificadas = previa.resumo.reidentificadas

  function baixarRelatorio() {
    const csv = relatorioDeDivergencias(previa.conferencia)
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `divergencias-${previa.arquivo.replace(/\.[^.]+$/, '')}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onCancelar}>
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-[#525252] bg-[#2c2c2c]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#525252] px-5 py-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="text-[#f97316]" size={20} />
            <div>
              <h3 className="text-sm font-semibold text-[#f5f5f5]">Conferir antes de aplicar</h3>
              <p className="text-xs text-[#a3a3a3]">{previa.arquivo}</p>
            </div>
          </div>
          <button type="button" onClick={onCancelar} aria-label="Fechar" className="text-[#a3a3a3] hover:text-[#f5f5f5]"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-[#525252] p-4 sm:grid-cols-6">
          <Contador rotulo="Novas" valor={previa.resumo.novas} />
          <Contador rotulo="Atualizadas" valor={previa.resumo.atualizadas} />
          <Contador rotulo="Suas edições" valor={previa.resumo.conflitos} tom={previa.resumo.conflitos ? '#fbbf24' : undefined} />
          <Contador rotulo="Inalteradas" valor={previa.resumo.inalteradas} />
          <Contador rotulo="Sumiram" valor={previa.resumo.ausentes} tom={previa.resumo.ausentes ? '#fca5a5' : undefined} />
          <Contador rotulo="Reconhecidas" valor={reidentificadas} tom={reidentificadas ? '#93c5fd' : undefined} />
        </div>

        {/* ⚠️ Sem esta frase o número "Reconhecidas" é um enigma. Ele existe justamente para que
            ninguém mais veja um par "nova + sumiu" e conclua que o sistema perdeu dado. */}
        {reidentificadas > 0 && (
          <p className="border-b border-[#525252] bg-[#3b82f6]/[0.07] px-4 py-2 text-[11px] leading-5 text-[#93c5fd]">
            <b>{reidentificadas} linha(s) mudaram de identidade e foram reconhecidas pelo conteúdo.</b>{' '}
            Elas não são novas e não sumiram — são as mesmas linhas, com a chave atualizada. Já estão
            contadas acima como inalteradas, atualizadas ou edições suas.
          </p>
        )}

        <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-[#525252] px-4 py-2 text-[11px] text-[#a3a3a3]">
          <span><b className="text-[#f5f5f5]">{previa.diagnostico.abasReconhecidas}/22</b> abas reconhecidas</span>
          <span><b className="text-[#f5f5f5]">{previa.diagnostico.registros}</b> registros reais</span>
          <span><b className="text-[#f5f5f5]">{previa.diagnostico.estruturais}</b> linhas estruturais preservadas</span>
          <span><b className="text-[#f5f5f5]">{previa.diagnostico.formulas}</b> fórmulas detectadas</span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {/* A conferência ABA POR ABA. Cinco números globais para 20 abas não dizem onde olhar. */}
          <div className="mb-4 overflow-x-auto rounded-lg border border-[#525252]">
            <table className="w-full min-w-[640px] text-[11px]">
              <thead className="bg-[#333] text-[#a3a3a3]">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">Aba</th>
                  <th className="px-2 py-1.5 text-right font-medium">Iguais</th>
                  <th className="px-2 py-1.5 text-right font-medium">Atualizadas</th>
                  <th className="px-2 py-1.5 text-right font-medium">Novas</th>
                  <th className="px-2 py-1.5 text-right font-medium">Sumiram</th>
                  <th className="px-2 py-1.5 text-right font-medium">Suas edições</th>
                  <th className="px-2 py-1.5 text-right font-medium">Reconhecidas</th>
                  <th className="px-2 py-1.5 text-right font-medium">Estruturais</th>
                </tr>
              </thead>
              <tbody>
                {porAba.map((r) => (
                  <tr key={r.aba} className="border-t border-[#3f3f3f]">
                    <td className="px-3 py-1 text-[#d4d4d4]">{r.aba}</td>
                    <Celula valor={r.inalteradas} />
                    <Celula valor={r.atualizadas} tom="#4ade80" />
                    <Celula valor={r.novas} tom="#93c5fd" />
                    <Celula valor={r.ausentes} tom="#fca5a5" />
                    <Celula valor={r.conflitos} tom="#fbbf24" />
                    <Celula valor={r.reidentificadas} tom="#93c5fd" />
                    <Celula valor={estruturalDaAba.get(r.aba)?.estruturais ?? 0} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {conflitos.length > 0 ? (
            <>
              <p className="mb-3 rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2 text-[11px] leading-5 text-[#fbbf24]">
                <AlertTriangle size={13} className="mr-1 inline" />
                <b>{conflitos.length} linha(s) que você editou no sistema</b> têm valor diferente na
                planilha. A planilha é a fonte da verdade e vai vencer — estas são as alterações que
                ela vai desfazer.
              </p>
              <div className="flex flex-col gap-2">
                {conflitos.map((l) => (
                  <div key={`${l.aba}-${l.chave}`} className="rounded-lg border border-[#525252] bg-[#333] p-3">
                    <p className="text-[11px] font-semibold text-[#f5f5f5]">
                      {l.aba} · <span className="font-normal text-[#a3a3a3]">{l.chave}</span>
                    </p>
                    {l.editadoPor && (
                      <p className="mt-0.5 text-[10px] text-[#8a8a8a]">editado por {l.editadoPor} em {dataBR(l.editadoEm)}</p>
                    )}
                    <table className="mt-2 w-full text-[11px]">
                      <thead>
                        <tr className="text-[#8a8a8a]">
                          <th className="w-1/3 text-left font-medium">campo</th>
                          <th className="text-left font-medium">no sistema</th>
                          <th className="w-6" />
                          <th className="text-left font-medium">vai valer (planilha)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {l.divergencias.map((d) => (
                          <tr key={d.campo}>
                            <td className="py-0.5 text-[#a3a3a3]">{d.campo}</td>
                            <td className="py-0.5 text-[#fca5a5] line-through">{d.noSistema || '—'}</td>
                            <td className="py-0.5 text-[#6b6b6b]"><ArrowRight size={11} /></td>
                            <td className="py-0.5 font-medium text-[#4ade80]">{d.naPlanilha || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="rounded-lg border border-[#525252] bg-[#333] px-3 py-6 text-center text-xs text-[#a3a3a3]">
              Nenhuma edição sua será sobrescrita por esta planilha.
            </p>
          )}

          {ausentes.length > 0 && (
            <p className="mt-3 rounded-lg border border-[#525252] bg-[#333] px-3 py-2 text-[11px] leading-5 text-[#a3a3a3]">
              <b className="text-[#fca5a5]">{ausentes.length} linha(s)</b> estão no sistema e não vieram
              nesta planilha. Elas <b>não serão apagadas</b> — ficam marcadas como fora da planilha
              atual, visíveis na grade.
            </p>
          )}

          {previa.naoLidas.length > 0 && (
            <p className="mt-3 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-3 py-2 text-[11px] leading-5 text-[#fbbf24]">
              {previa.naoLidas.join(' · ')}. As demais abas entram normalmente.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#525252] px-5 py-4">
          <p className="text-[11px] text-[#8a8a8a]">
            {previa.listas} lista(s) suspensa(s) e {previa.regras} regra(s) de preenchimento vieram
            junto — as células passam a usá-las.
          </p>
          <div className="flex gap-2">
            <button
              type="button" onClick={baixarRelatorio}
              title="Uma linha por campo divergente, em CSV — para conferir fora do sistema antes de aplicar"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-2 text-xs text-[#d4d4d4] hover:bg-[#333]"
            >
              <Download size={13} /> Relatório de divergências
            </button>
            <button type="button" onClick={onCancelar} className="rounded-lg px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5]">Cancelar</button>
            <button type="button" onClick={onConfirmar} className="rounded-lg bg-[#22c55e] px-4 py-2 text-xs font-semibold text-white hover:bg-[#16a34a]">
              Aplicar planilha
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Celula({ valor, tom }: { valor: number; tom?: string }) {
  // Zero fica apagado de propósito: numa tabela de 20 linhas, é o que não é zero que importa.
  return (
    <td className="px-2 py-1 text-right tabular-nums" style={{ color: valor ? (tom ?? '#f5f5f5') : '#6b6b6b' }}>
      {valor}
    </td>
  )
}

function Contador({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: string }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#333] px-3 py-2">
      <p className="text-[10px] text-[#a3a3a3]">{rotulo}</p>
      <p className="mt-0.5 text-lg font-bold leading-none" style={{ color: tom ?? '#f5f5f5' }}>{valor}</p>
    </div>
  )
}
