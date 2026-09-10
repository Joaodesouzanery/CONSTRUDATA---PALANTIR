/**
 * Lançamento Rápido — várias obras e equipes de uma vez, no ritmo de planilha.
 *
 * ─── POR QUE ESTA TELA EXISTE ─────────────────────────────────────────────────
 * O apontamento chega por WhatsApp o dia inteiro, de vários encarregados, intercalando obras:
 * Boi Malhado, depois Sakura, depois Bertioga. Abrir um RDO por vez obriga a trocar de tela a cada
 * mensagem — mais lento que a planilha à parte que a tela deveria substituir. Aqui é uma grade só,
 * uma linha por equipe, e "adicionar linha" repete a obra e a data porque é esse o gesto repetido.
 *
 * ⚠️ **NÃO interpreta o texto, de propósito.** O campo continua escrevendo como sempre escreveu; a
 * pessoa cola a mensagem ao lado e digita os números olhando para ela. Foi decisão explícita, e ela
 * tem uma consequência boa: nada sai do navegador. Nenhum nome de funcionário viaja para serviço
 * nenhum — que seria o caso se a mensagem fosse mandada para um modelo interpretar.
 *
 * O texto colado é guardado como ORIGEM (`textoOriginal`, campo que o `RdoWcrApontamento` já tem).
 * É a prova de onde o número veio, e é o que responde "perdi a foto do lacre" sem inventar dado.
 *
 * ⚠️ Vazio é NÃO INFORMADO, nunca zero. É a mesma invariante do `apontamentoWcr.ts`: a equipe só
 * escreve o que fez, e gravar `0` nas outras 12 siglas afirmaria que não se produziu nada delas —
 * o que ninguém disse.
 */
import { useMemo, useState } from 'react'
import { Plus, Trash2, MessageSquareText, AlertTriangle, CheckCircle2, CalendarOff } from 'lucide-react'
import type { ConstructionSite, RdoWcrData } from '@/types'
import { useRdoStore } from '@/store/rdoStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useDiasSemProducaoStore, MOTIVOS_SEM_PRODUCAO, type MotivoSemProducao } from '@/store/diasSemProducaoStore'
import { useStoreSync } from '@/lib/useStoreSync'
import { usePermissaoEscrita, ROLES_RDO_WRITE } from '@/lib/roles'
import { obraEstaAtiva } from '@/lib/obraAtiva'
import { hojeLocalISO } from '@/lib/utils'
import { SIGLAS_WCR } from '../utils/apontamentoWcr'
import { producaoDasQuantidades, horasInformadas, linhaTemConteudo } from '../utils/lancamentoRapido'

interface Linha {
  /** Só na tela — o id do RDO é gerado na gravação. */
  id: string
  obraId: string
  equipe: string
  nucleo: string
  /** sigla → texto digitado. ⚠️ Ausente/vazio = não informado. */
  quantidades: Record<string, string>
  horas: string
  observacoes: string
  /** A mensagem do WhatsApp, guardada como prova da origem. */
  textoOriginal: string
  semProducao: boolean
  motivoSemProducao: MotivoSemProducao
  motivoTexto: string
}

const linhaNova = (base?: Partial<Linha>): Linha => ({
  id: crypto.randomUUID(),
  obraId: '', equipe: '', nucleo: '', quantidades: {}, horas: '', observacoes: '',
  textoOriginal: '', semProducao: false, motivoSemProducao: 'chuva', motivoTexto: '',
  ...base,
})

export function LancamentoRapidoPanel() {
  useStoreSync(useRdoStore)
  const addRdo = useRdoStore((s) => s.addRdo)
  const sites = useTorreStore((s) => s.sites)
  const updateSite = useTorreStore((s) => s.updateSite)
  const crews = useMaoDeObraStore((s) => s.crews)
  const marcarSemProducao = useDiasSemProducaoStore((s) => s.marcar)
  const podeEscrever = usePermissaoEscrita(ROLES_RDO_WRITE)

  const [data, setData] = useState(hojeLocalISO())
  const [linhas, setLinhas] = useState<Linha[]>([linhaNova()])
  const [textoAberto, setTextoAberto] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [gravando, setGravando] = useState(false)

  const obras = useMemo(() => sites.filter(obraEstaAtiva), [sites])
  const porId = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras])
  const prontas = linhas.filter(linhaTemConteudo)

  const mexer = (id: string, patch: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  const mexerQtd = (id: string, sigla: string, valor: string) =>
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, quantidades: { ...l.quantidades, [sigla]: valor } } : l)))

  function adicionar() {
    const ultima = linhas[linhas.length - 1]
    // Repete obra e núcleo: lançar várias equipes da mesma obra em sequência é o gesto comum.
    setLinhas((ls) => [...ls, linhaNova({ obraId: ultima?.obraId ?? '', nucleo: ultima?.nucleo ?? '' })])
  }

  function gravar() {
    if (!podeEscrever.pode) {
      setAviso({ tom: 'erro', texto: 'Seu perfil não pode salvar RDO. Quem pode: engenheiro, qualidade, gerente, diretor e owner.' })
      return
    }
    setGravando(true)
    try {
      let rdos = 0
      let paradas = 0
      const recusadas: string[] = []

      for (const l of prontas) {
        const obra = porId.get(l.obraId)
        if (l.semProducao) {
          const r = marcarSemProducao({
            siteId: l.obraId, data,
            categoria: l.motivoSemProducao,
            motivo: l.motivoTexto.trim() || undefined,
          })
          if (r) paradas++; else recusadas.push(obra?.name ?? l.obraId)
          continue
        }

        const producao = producaoDasQuantidades(l.quantidades)
        const horas = horasInformadas(l.horas)
        const wcr: RdoWcrData = {
          equipe: l.equipe.trim() || undefined,
          nucleo: l.nucleo.trim() || undefined,
          imoveis: [],
          producao,
          observacoes: l.observacoes.trim() || undefined,
          ...(horas !== undefined ? { horas } : {}),
          // A mensagem que originou a linha. Não foi interpretada — foi lida por uma pessoa.
          textoOriginal: l.textoOriginal.trim() || undefined,
        }
        const id = addRdo({
          title: `RDO${obra ? ' — ' + obra.name : ''}${l.nucleo ? ' · ' + l.nucleo : ''}`,
          date: data,
          responsible: l.equipe.trim(),
          weather: { morning: 'good', afternoon: 'good', night: 'good', temperatureC: 0 },
          manpower: { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0 },
          equipment: [], services: [], trechos: [], geolocation: null,
          observations: l.observacoes.trim(),
          incidents: '', photos: [],
          siteId: l.obraId,
          // ⚠️ `wcr` de propósito: são as siglas do WCR, e é esse template que faz o custo NÃO ser
          // lançado em dobro no Financeiro (o da WCR entra pelo Controle de Caixa).
          template: 'wcr' as const,
          wcr,
          status: 'finalizado' as const,
        })
        // ⚠️ `addRdo` devolve '' quando o papel não pode gravar. Silêncio aqui seria dizer que
        // salvou — o mesmo defeito que a conferência de faltas do RDO WCR teve.
        if (id) rdos++; else recusadas.push(obra?.name ?? l.obraId)
      }

      if (recusadas.length > 0) {
        setAviso({ tom: 'erro', texto: `Não consegui gravar ${recusadas.length} linha(s): ${[...new Set(recusadas)].join(', ')}. Verifique a permissão do seu perfil.` })
        return
      }
      const partes = [rdos > 0 && `${rdos} RDO(s)`, paradas > 0 && `${paradas} dia(s) sem produção`].filter(Boolean)
      setAviso({ tom: 'ok', texto: `${partes.join(' e ')} gravado(s). As linhas seguem na tela para você conferir.` })
    } finally { setGravando(false) }
  }

  const inputBase = 'w-full rounded border border-[#525252] bg-[#1f1f1f] px-1.5 py-1 text-[11px] text-[#f5f5f5] outline-none focus:border-[#f97316]/60'
  const th = 'px-1.5 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-[#adadad] whitespace-nowrap'

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-6">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#f5f5f5]">Lançamento Rápido</h2>
          <p className="text-[11px] text-[#a3a3a3]">
            Uma linha por equipe. Cole a mensagem do WhatsApp ao lado e digite os números olhando para ela.
          </p>
        </div>
        <label className="ml-auto flex items-center gap-2 text-[11px] text-[#a3a3a3]">
          Data
          <input type="date" value={data} onChange={(e) => setData(e.target.value)}
            className="rounded-lg border border-[#525252] bg-[#1f1f1f] px-2 py-1 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60" />
        </label>
      </header>

      {!podeEscrever.pode && (
        <p className="rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2 text-[11px] text-[#fbbf24]">
          <AlertTriangle size={12} className="mr-1 inline" />
          Seu perfil não salva RDO — você pode montar as linhas, mas não gravar.
        </p>
      )}

      {aviso && (
        <p className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] ${aviso.tom === 'erro'
          ? 'border-[#ef4444]/40 bg-[#ef4444]/10 text-[#fca5a5]'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
          {aviso.tom === 'erro' ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />} {aviso.texto}
        </p>
      )}

      {obras.length === 0 && (
        <p className="rounded-xl border border-dashed border-[#525252] p-6 text-center text-xs text-[#6b6b6b]">
          Nenhuma obra ativa cadastrada. Cadastre em Torre de Controle → Obras.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#525252]">
        <table className="w-full border-collapse">
          <thead className="bg-[#2c2c2c]">
            <tr className="border-b border-[#525252]">
              <th className={`${th} sticky left-0 z-10 bg-[#2c2c2c] min-w-[150px]`}>Obra</th>
              <th className={`${th} min-w-[110px]`}>Equipe</th>
              <th className={`${th} min-w-[110px]`}>Núcleo</th>
              {SIGLAS_WCR.map((s) => (
                <th key={s.sigla} className={`${th} text-center`} title={`${s.rotulo} (${s.unidade})`}>
                  {s.sigla}
                  <span className="ml-0.5 text-[9px] text-[#6b6b6b]">{s.unidade}</span>
                </th>
              ))}
              <th className={`${th} min-w-[60px]`}>Horas</th>
              <th className={`${th} min-w-[150px]`}>Observações</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3d3d3d]">
            {linhas.map((l) => {
              const obra: ConstructionSite | undefined = porId.get(l.obraId)
              const semTipo = !!obra && !obra.tipoApontamento
              const ehOs = obra?.tipoApontamento === 'ordem-servico'
              return (
                <RowGroup key={l.id}>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="sticky left-0 z-10 bg-[#333333] px-1.5 py-1">
                      <select value={l.obraId} onChange={(e) => mexer(l.id, { obraId: e.target.value })} className={inputBase}>
                        <option value="">— obra —</option>
                        {obras.map((o) => <option key={o.id} value={o.id}>{o.code ? `${o.code} · ` : ''}{o.name}</option>)}
                      </select>
                    </td>
                    <td className="px-1.5 py-1">
                      <input list="equipes-rapido" value={l.equipe} onChange={(e) => mexer(l.id, { equipe: e.target.value })}
                        placeholder="Gilvan" className={inputBase} />
                    </td>
                    <td className="px-1.5 py-1">
                      <input value={l.nucleo} onChange={(e) => mexer(l.id, { nucleo: e.target.value })}
                        placeholder="Boi Malhado" className={inputBase} />
                    </td>

                    {l.semProducao || ehOs || semTipo ? (
                      <td colSpan={SIGLAS_WCR.length + 2} className="px-2 py-1">
                        {l.semProducao ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <select value={l.motivoSemProducao} onChange={(e) => mexer(l.id, { motivoSemProducao: e.target.value as MotivoSemProducao })}
                              className="rounded border border-[#525252] bg-[#1f1f1f] px-1.5 py-1 text-[11px] text-[#f5f5f5]">
                              {MOTIVOS_SEM_PRODUCAO.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                            </select>
                            <input value={l.motivoTexto} onChange={(e) => mexer(l.id, { motivoTexto: e.target.value })}
                              placeholder="detalhe (opcional)" className={`${inputBase} max-w-[240px]`} />
                          </div>
                        ) : semTipo ? (
                          // ⚠️ PERGUNTA em vez de adivinhar. Deduzir o gênero pelo texto seria chute.
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#fbbf24]">
                            <AlertTriangle size={12} />
                            Que tipo de apontamento esta obra manda?
                            <button type="button" onClick={() => updateSite(l.obraId, { tipoApontamento: 'producao' })}
                              className="rounded border border-[#f97316]/50 px-2 py-0.5 text-[#ffa055] hover:bg-[#f97316]/10">
                              Produção por sigla
                            </button>
                            <button type="button" onClick={() => updateSite(l.obraId, { tipoApontamento: 'ordem-servico' })}
                              className="rounded border border-[#525252] px-2 py-0.5 text-[#a3a3a3] hover:text-[#f5f5f5]">
                              Ordem de serviço
                            </button>
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#a3a3a3]">
                            Esta obra é de <strong className="text-[#f5f5f5]">ordem de serviço</strong> — endereço, peças e
                            dimensão da vala. Essas colunas ainda não existem aqui; por enquanto use o campo de
                            observações e o texto da mensagem.
                          </p>
                        )}
                      </td>
                    ) : (
                      <>
                        {SIGLAS_WCR.map((s) => (
                          <td key={s.sigla} className="px-0.5 py-1">
                            <input
                              inputMode="decimal"
                              value={l.quantidades[s.sigla] ?? ''}
                              onChange={(e) => mexerQtd(l.id, s.sigla, e.target.value)}
                              className={`${inputBase} w-[54px] text-center`}
                              // ⚠️ Sem placeholder "0": vazio quer dizer não informado, e um zero
                              // fantasma na tela convida a pessoa a ler como "produziu nada".
                            />
                          </td>
                        ))}
                        <td className="px-0.5 py-1">
                          <input inputMode="decimal" value={l.horas} onChange={(e) => mexer(l.id, { horas: e.target.value })}
                            className={`${inputBase} w-[54px] text-center`} />
                        </td>
                        <td className="px-1.5 py-1">
                          <input value={l.observacoes} onChange={(e) => mexer(l.id, { observacoes: e.target.value })}
                            className={inputBase} />
                        </td>
                      </>
                    )}

                    <td className="whitespace-nowrap px-1.5 py-1">
                      <div className="flex items-center gap-1">
                        <button type="button" title="Colar a mensagem do WhatsApp"
                          onClick={() => setTextoAberto(textoAberto === l.id ? null : l.id)}
                          className={`rounded p-1 ${l.textoOriginal.trim() ? 'text-[#ffa055]' : 'text-[#6b6b6b] hover:text-[#f5f5f5]'}`}>
                          <MessageSquareText size={13} />
                        </button>
                        <button type="button" title="Não houve produção neste dia"
                          onClick={() => mexer(l.id, { semProducao: !l.semProducao })}
                          className={`rounded p-1 ${l.semProducao ? 'text-[#fbbf24]' : 'text-[#6b6b6b] hover:text-[#f5f5f5]'}`}>
                          <CalendarOff size={13} />
                        </button>
                        <button type="button" title="Remover linha"
                          onClick={() => setLinhas((ls) => (ls.length > 1 ? ls.filter((x) => x.id !== l.id) : [linhaNova()]))}
                          className="rounded p-1 text-[#6b6b6b] hover:text-[#fca5a5]">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {textoAberto === l.id && (
                    <tr className="bg-[#2c2c2c]">
                      <td colSpan={SIGLAS_WCR.length + 6} className="px-3 py-2">
                        <p className="mb-1 text-[10px] text-[#6b6b6b]">
                          A mensagem como ela chegou. Guardada junto do lançamento — é a prova de onde o número
                          veio. Nada aqui é interpretado pela máquina.
                        </p>
                        <textarea
                          value={l.textoOriginal} onChange={(e) => mexer(l.id, { textoOriginal: e.target.value })}
                          rows={4} placeholder="Cole aqui a mensagem do WhatsApp…"
                          className="w-full rounded border border-[#525252] bg-[#1f1f1f] px-2 py-1.5 font-mono text-[11px] text-[#f5f5f5] outline-none focus:border-[#f97316]/60"
                        />
                      </td>
                    </tr>
                  )}
                </RowGroup>
              )
            })}
          </tbody>
        </table>
      </div>

      <datalist id="equipes-rapido">
        {crews.map((c) => <option key={c.id} value={c.foreman || c.name} />)}
      </datalist>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={adicionar}
          className="flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5]">
          <Plus size={14} /> Adicionar linha
        </button>
        <button type="button" onClick={gravar} disabled={gravando || prontas.length === 0 || !podeEscrever.pode}
          className="rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
          {gravando ? 'Gravando…' : `Salvar ${prontas.length} lançamento(s)`}
        </button>
        <span className="text-[10px] text-[#6b6b6b]">
          Linha em branco é ignorada. Campo de sigla vazio quer dizer <strong>não informado</strong>, não zero.
        </span>
      </div>
    </div>
  )
}

/** `<tbody>` não aceita fragmento com key em TS sem isto — a linha e o seu detalhe são irmãos. */
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
