/**
 * RdoWcrPanel — o RDO da WCR, preenchido colando o apontamento do WhatsApp ou soltando a planilha.
 *
 * ─── O QUE ESTA TELA PROMETE ──────────────────────────────────────────────────
 * Cola, confere, salva. A conferência não é enfeite: o apontamento vem sem ano na data, com a
 * maioria das siglas em branco e com endereços repetidos — três coisas que a máquina resolve de um
 * jeito que a pessoa precisa ver antes de virar dado. Por isso a pré-visualização mostra a data
 * cheia com o ano que foi deduzido, marca cada sigla vazia como "não informado" (e não zero) e
 * lista o que não foi entendido em vez de engolir.
 *
 * ─── VÁRIOS APONTAMENTOS NO MESMO DIA, E A LISTA DE PRESENÇA ──────────────────
 * Numa noite chegam dois apontamentos (equipe Juan, equipe Gilvan — mesmo dia, núcleos e imóveis
 * diferentes) e quatro "LISTA DE PRESENÇA". O RDO é do DIA: cada texto colado entra como um bloco
 * separado, a tela mostra cada bloco e o TOTAL somado, e a presença vira "quem estava na obra",
 * como nos outros RDOs. A soma e a leitura da presença moram em `utils/apontamentoWcrDia.ts`.
 *
 * ⚠️ A presença NÃO vira custo. O custo de mão de obra da WCR entra pelo Controle de Caixa;
 * `syncRdoToFinanceiro` pula o template `wcr` de propósito, senão a folha contaria duas vezes.
 *
 * A leitura mora em `utils/apontamentoWcr.ts` (texto) e `utils/apontamentoWcrPlanilha.ts`
 * (planilha), as duas puras e testadas. Aqui só tem tela.
 */
import { useMemo, useState } from 'react'
import {
  ClipboardList, Save, Printer, CheckCircle2, AlertTriangle,
  Building2, ScanText, Trash2,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useRdoStore } from '@/store/rdoStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { hojeLocalISO } from '@/lib/utils'
import { abrirJanelaRelatorio, imprimirRelatorioRdos } from '../utils/rdosReportExport'
import {
  parseApontamentoWcr, resumirApontamento, limitarTextoOriginal,
  type ApontamentoWcr,
} from '../utils/apontamentoWcr'
import { lerPlanilhaWcr, type MatrizWcr } from '../utils/apontamentoWcrPlanilha'
import {
  apontamentoParaRdo, resumoDoDia, ehListaDePresenca, parseListaDePresenca, presencaParaRdo,
  manpowerDaPresenca, funcaoCanonica, type PresencaLida,
} from '../utils/apontamentoWcrDia'
import type { RdoWcrData } from '@/types'
import { AreaDeSoltar } from '@/components/shared/AreaDeSoltar'

const MODELO = `📋 APONTAMENTO DIÁRIO — MODELO

Produção - 31/08
Equipe - Gilvan
Núcleo - Boi Malhado
Imóvel - rua santa rosa de sul

SERVIÇO ÁGUA
PRA -
LA -
LIA -
Caixa UMA -
HM - 100
Interligação -
Válvula -

SERVIÇO ESGOTO
PRE -
LE -
LIE -
PV -
PI -
CI -

obs: qualquer coisa fora da lista escreve aqui`

export function RdoWcrPanel() {
  const addRdo    = useRdoStore((s) => s.addRdo)
  const updateRdo = useRdoStore((s) => s.updateRdo)
  const setActiveTab = useRdoStore((s) => s.setActiveTab)
  const sites = useTorreStore((s) => s.sites)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)

  const [texto, setTexto] = useState('')
  /** Um bloco por texto colado. O RDO é do dia; cada apontamento é de uma equipe. */
  const [apontamentos, setApontamentos] = useState<Array<{ lido: ApontamentoWcr; texto: string }>>([])
  const [presencas, setPresencas] = useState<Array<{ lida: PresencaLida; texto: string }>>([])
  const lido = apontamentos[0]?.lido ?? null
  const [obraSiteId, setObraSiteId] = useState<string | null>(activeObraId ?? null)
  const [responsavel, setResponsavel] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [problemasDaPlanilha, setProblemasDaPlanilha] = useState<string[]>([])

  const site = useMemo(() => (obraSiteId ? sites.find((s) => s.id === obraSiteId) ?? null : null), [sites, obraSiteId])
  const blocos = useMemo(() => apontamentos.map((a) => apontamentoParaRdo(a.lido, limitarTextoOriginal(a.texto))), [apontamentos])
  const dia = useMemo(() => (blocos.length ? resumoDoDia(blocos) : null), [blocos])
  const manpower = useMemo(() => manpowerDaPresenca(presencas.map((p) => presencaParaRdo(p.lida, limitarTextoOriginal(p.texto)))), [presencas])
  // ⚠️ Datas diferentes no mesmo RDO é erro de colagem — a tela avisa, não silencia.
  const datas = useMemo(() => [...new Set([...apontamentos.map((a) => a.lido.data), ...presencas.map((p) => p.lida.data)].filter(Boolean))], [apontamentos, presencas])

  function analisar() {
    const t = texto.trim()
    if (!t) return
    setAviso(null)
    // A lista de presença chega como mensagem separada. O mesmo botão lê as duas — o texto diz o que é.
    if (ehListaDePresenca(t)) {
      const lida = parseListaDePresenca(t, { hoje: hojeLocalISO() })
      setPresencas((ps) => [...ps, { lida, texto: t }])
      setTexto('')
      setAviso(`Lista de presença lida: ${lida.pessoas.length} pessoa(s)${lida.equipe ? ` da equipe ${lida.equipe}` : ''}. Cole o próximo texto, ou salve.`)
      return
    }
    const a = parseApontamentoWcr(t, { hoje: hojeLocalISO() })
    setApontamentos((as) => [...as, { lido: a, texto: t }])
    setTexto('')
    if (apontamentos.length > 0) setAviso(`Apontamento ${apontamentos.length + 1} adicionado ao dia. O total é a soma; cada equipe fica separada.`)
  }

  async function lerArquivo(f: File) {
    setAviso(null)
    try {
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const aba = wb.SheetNames[0]
      if (!aba) { setAviso('A planilha não tem nenhuma aba.'); return }
      const matriz = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: null }) as MatrizWcr
      const r = lerPlanilhaWcr(matriz)
      setProblemasDaPlanilha(r.problemas)
      if (!r.apontamentos.length) { setApontamentos([]); return }
      // ⚠️ Uma linha por vez, de propósito: cada apontamento vira UM RDO, e quem salva precisa
      // conferir cada um. Importar 30 RDOs de uma vez sem ninguém olhar é como o dado errado entra.
      const primeiro = r.apontamentos[0]
      setApontamentos([{ lido: primeiro, texto: '' }])
      setTexto('')
      if (r.apontamentos.length > 1) {
        setAviso(`A planilha tem ${r.apontamentos.length} apontamentos. Estou mostrando o da linha ${primeiro.linhaDaPlanilha}; salve e volte para o próximo.`)
      }
    } catch (err) {
      setAviso(`Não consegui ler o arquivo: ${err instanceof Error ? err.message : 'erro desconhecido'}`)
    }
  }

  function montarPayload(status: 'rascunho' | 'finalizado') {
    if (!lido || !dia) return null
    const presencasRdo = presencas.map((p) => presencaParaRdo(p.lida, limitarTextoOriginal(p.texto)))
    const wcr: RdoWcrData = {
      ...dia,
      // Um apontamento só: o RDO continua com o formato antigo, sem lista — nada muda para quem lê.
      apontamentos: blocos.length > 1 ? blocos : undefined,
      presencas: presencasRdo.length ? presencasRdo : undefined,
      textoOriginal: blocos.length === 1 ? blocos[0].textoOriginal : undefined,
    }
    const nomeObra = site?.name ?? ''
    return {
      title: `RDO WCR${nomeObra ? ' — ' + nomeObra : ''}${dia.nucleo ? ' · ' + dia.nucleo : ''}`,
      date: lido.data || hojeLocalISO(),
      responsible: responsavel || dia.equipe || '',
      weather: { morning: 'good' as const, afternoon: 'good' as const, night: 'good' as const, temperatureC: 0 },
      // Quem estava na obra, pela lista de presença. ⚠️ Não vira custo — ver o docblock.
      manpower,
      equipment: [],
      services: [],
      trechos: [],
      geolocation: null,
      observations: dia.observacoes ?? '',
      incidents: '',
      photos: [],
      siteId: obraSiteId,
      template: 'wcr' as const,
      wcr,
      status,
    }
  }

  function salvar(status: 'rascunho' | 'finalizado') {
    const payload = montarPayload(status)
    if (!payload) return
    const id = savedId ? (updateRdo(savedId, payload), savedId) : addRdo(payload)
    if (!id) { setAviso('Seu perfil não tem permissão para salvar RDO.'); return }
    if (!savedId) setSavedId(id)
    setAviso(status === 'rascunho' ? 'Rascunho salvo. Rascunho não alimenta produção nem custo.' : 'RDO salvo.')
    if (status === 'finalizado') setActiveTab('historico')
  }

  function imprimir() {
    const payload = montarPayload('rascunho')
    if (!payload) return
    const agora = new Date().toISOString()
    // ⚠️ A janela abre SÍNCRONA no clique. Depois de um `await` o navegador bloqueia o pop-up —
    // está escrito no docblock do gerador, e é erro que já aconteceu neste módulo.
    const janela = abrirJanelaRelatorio()
    void imprimirRelatorioRdos(
      [{ tipo: 'torre', rdo: { id: 'preview', number: 0, createdAt: agora, updatedAt: agora, ...payload } }],
      'Pré-visualização',
      site?.name ?? null,
      janela,
    )
  }

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center gap-2">
        <ClipboardList size={20} className="text-[#f97316]" />
        <h2 className="text-lg font-semibold text-[#f5f5f5]">RDO WCR</h2>
        <span className="text-xs text-[#6b6b6b]">cole o apontamento ou solte a planilha</span>
      </header>

      {/* ── Entrada ─────────────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4 space-y-3">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={MODELO}
          rows={12}
          className="w-full rounded-lg border border-[#525252] bg-[#1f1f1f] p-3 font-mono text-xs text-[#f5f5f5] placeholder:text-[#525252] focus:border-[#f97316]/50 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={analisar}
            disabled={!texto.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            <ScanText size={14} /> Analisar texto
          </button>
          <AreaDeSoltar
            compacto
            aceita=".xlsx,.xls"
            titulo="Arraste a planilha ou clique"
            aoEscolher={(arquivos) => { const f = arquivos[0]; if (f) void lerArquivo(f) }}
          />
          {(lido || presencas.length > 0 || texto) && (
            <button
              onClick={() => { setTexto(''); setApontamentos([]); setPresencas([]); setSavedId(null); setAviso(null); setProblemasDaPlanilha([]) }}
              className="flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-xs text-[#6b6b6b] hover:text-[#f5f5f5]"
            >
              <Trash2 size={14} /> Limpar o dia
            </button>
          )}
          {(apontamentos.length + presencas.length) > 0 && (
            <span className="text-[11px] text-[#6b6b6b]">
              {apontamentos.length} apontamento(s) · {presencas.length} lista(s) de presença
            </span>
          )}
        </div>
        {problemasDaPlanilha.map((p, i) => (
          <p key={i} className="text-xs text-[#fbbf24]">{p}</p>
        ))}
      </section>

      {/* ── Conferência ─────────────────────────────────────────────────────── */}
      {(lido || presencas.length > 0) && (
        <section className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4 space-y-4">
          <h3 className="text-sm font-semibold text-[#f5f5f5]">Confira antes de salvar</h3>

          {datas.length > 1 && (
            <p className="rounded-lg border border-[#fbbf24]/40 bg-[#fbbf24]/5 p-2 text-xs text-[#fbbf24]">
              <AlertTriangle size={12} className="mr-1 inline" />
              Os textos colados são de datas diferentes ({datas.map((d) => d!.split('-').reverse().join('/')).join(', ')}).
              Um RDO é de um dia só — o RDO vai ficar com a data do primeiro apontamento.
            </p>
          )}

          {apontamentos.map((a, i) => (
            <BlocoApontamento
              key={i} indice={i} total={apontamentos.length} lido={a.lido}
              onRemover={() => setApontamentos((as) => as.filter((_, k) => k !== i))}
            />
          ))}

          {dia && blocos.length > 1 && <TotalDoDia producao={dia.producao} imoveis={dia.imoveis.length} />}

          {presencas.map((p, i) => (
            <BlocoPresenca
              key={i} lida={p.lida}
              onRemover={() => setPresencas((ps) => ps.filter((_, k) => k !== i))}
            />
          ))}

          {presencas.length > 0 && (
            <p className="text-xs text-[#a3a3a3]">
              Na obra: <strong className="text-[#f5f5f5]">{manpower.employeeNames?.length ?? 0}</strong> pessoa(s) —{' '}
              {manpower.foremanCount} encarregado(s) · {manpower.officialCount} oficial(is) · {manpower.helperCount} ajudante(s)
              {manpower.operatorCount > 0 && <> · {manpower.operatorCount} operador(es)</>}
              <span className="text-[#6b6b6b]"> · a presença não vira custo: o custo da WCR entra pelo Controle de Caixa</span>
            </p>
          )}

          {!lido && presencas.length > 0 && (
            <p className="text-xs text-[#fbbf24]">Só lista de presença até agora — cole também o apontamento do dia para salvar o RDO.</p>
          )}
        </section>
      )}

      {/* ── Obra e gravação ─────────────────────────────────────────────────── */}
      {lido && (
        <section className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs text-[#6b6b6b]"><Building2 size={12} /> Obra</span>
              <select
                value={obraSiteId ?? ''}
                onChange={(e) => setObraSiteId(e.target.value || null)}
                className="w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-2 py-1.5 text-xs text-[#f5f5f5] focus:border-[#f97316]/50 focus:outline-none"
              >
                <option value="">— sem obra —</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-[#6b6b6b]">Responsável</span>
              <input
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder={lido.equipe ?? 'quem responde pelo dia'}
                className="w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-2 py-1.5 text-xs text-[#f5f5f5] placeholder:text-[#525252] focus:border-[#f97316]/50 focus:outline-none"
              />
            </label>
          </div>

          {!obraSiteId && (
            <p className="text-xs text-[#fbbf24]">
              Sem obra, este RDO não alimenta produção, custo nem o Fluxo de Caixa Projetado.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => salvar('finalizado')} className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-white">
              <Save size={14} /> Salvar RDO
            </button>
            <button onClick={() => salvar('rascunho')} className="flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5]">
              Salvar rascunho
            </button>
            <button onClick={imprimir} className="flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5]">
              <Printer size={14} /> Imprimir
            </button>
          </div>

          {aviso && (
            <p className="flex items-center gap-1.5 text-xs text-[#34d399]">
              <CheckCircle2 size={14} /> {aviso}
            </p>
          )}
        </section>
      )}
    </div>
  )
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-0.5 block text-[11px] text-[#6b6b6b]">{rotulo}</span>
      <div className="text-xs">{children}</div>
    </div>
  )
}

function Ausente() {
  return <span className="text-[#6b6b6b]">não informado</span>
}

/** Um apontamento — uma equipe. Com vários no dia, cada um aparece inteiro, e o total vem depois. */
function BlocoApontamento({ indice, total, lido, onRemover }: { indice: number; total: number; lido: ApontamentoWcr; onRemover: () => void }) {
  const resumo = resumirApontamento(lido)
  return (
    <div className={`space-y-3 ${total > 1 ? 'rounded-lg border border-[#3d3d3d] p-3' : ''}`}>
      {total > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[#f97316]">Apontamento {indice + 1} de {total}{lido.equipe ? ` — ${lido.equipe}` : ''}</p>
          <button type="button" onClick={onRemover} className="text-[11px] text-[#6b6b6b] hover:text-[#f5f5f5]">remover</button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo rotulo="Data">
          {lido.data ? (
            <span className="text-[#f5f5f5]">
              {lido.data.split('-').reverse().join('/')}
              {/* ⚠️ O apontamento escreve "31/08" sem ano. Quem confere precisa VER o ano que a
                  máquina escolheu — senão descobre meses depois, no relatório. */}
              {lido.anoInferido && <span className="ml-1 text-[#fbbf24]">· ano deduzido</span>}
            </span>
          ) : <span className="text-[#fbbf24]">não veio no texto</span>}
        </Campo>
        <Campo rotulo="Equipe">{lido.equipe ?? <Ausente />}</Campo>
        <Campo rotulo="Núcleo">{lido.nucleo ?? <Ausente />}</Campo>
        <Campo rotulo="Imóveis">{lido.imoveis.length ? `${lido.imoveis.length} endereço${lido.imoveis.length > 1 ? 's' : ''}` : <Ausente />}</Campo>
      </div>
      {lido.imoveis.length > 0 && (
        <ul className="space-y-0.5 text-xs text-[#a3a3a3]">{lido.imoveis.map((im, i) => <li key={i}>· {im}</li>)}</ul>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-[#525252] text-left text-[#6b6b6b]">
            <th className="py-1.5 pr-3 font-medium">Serviço</th><th className="py-1.5 pr-3 font-medium">Sigla</th>
            <th className="py-1.5 pr-3 text-right font-medium">Quantidade</th><th className="py-1.5 font-medium">Un.</th>
          </tr></thead>
          <tbody>
            {lido.linhas.map((l) => (
              <tr key={l.sigla} className="border-b border-[#3d3d3d]">
                <td className="py-1.5 pr-3 text-[#a3a3a3]">{l.rotulo}</td>
                <td className="py-1.5 pr-3 text-[#f5f5f5]">{l.sigla}</td>
                <td className="py-1.5 pr-3 text-right">
                  {l.quantidade === undefined
                    // ⚠️ "não informado" e "zero" são coisas diferentes, e a tela diz qual é.
                    ? <span className="text-[#6b6b6b]">não informado</span>
                    : <span className="font-medium text-[#f5f5f5]">{l.quantidade.toLocaleString('pt-BR')}</span>}
                </td>
                <td className="py-1.5 text-[#6b6b6b]">{l.unidade === 'M' ? 'm' : 'un'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#a3a3a3]">
        {/* ⚠️ Metro e unidade aparecem SEPARADOS. Somá-los daria um número que não significa nada. */}
        <strong className="text-[#f5f5f5]">{resumo.unidades.toLocaleString('pt-BR')}</strong> serviço(s)
        {resumo.metros > 0 && <> · <strong className="text-[#f5f5f5]">{resumo.metros.toLocaleString('pt-BR')}</strong> m de rede</>}
        {resumo.semMedida > 0 && <span className="text-[#6b6b6b]"> · {resumo.semMedida} sem medida</span>}
      </p>
      {lido.observacoes && <Campo rotulo="Observações"><span className="whitespace-pre-wrap text-[#a3a3a3]">{lido.observacoes}</span></Campo>}
      {lido.naoEntendidas.length > 0 && (
        <div className="rounded-lg border border-[#fbbf24]/40 bg-[#fbbf24]/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#fbbf24]"><AlertTriangle size={14} /> Não entendi {lido.naoEntendidas.length} linha(s)</p>
          <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-[#a3a3a3]">{lido.naoEntendidas.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

/** A soma do dia. Sigla que ninguém informou continua "não informado" — não vira zero. */
function TotalDoDia({ producao, imoveis }: { producao: RdoWcrData['producao']; imoveis: number }) {
  const com = producao.filter((l) => l.quantidade !== '')
  return (
    <div className="rounded-lg border border-[#f97316]/40 bg-[#f97316]/5 p-3 space-y-2">
      <p className="text-xs font-semibold text-[#f97316]">Total do dia — {imoveis} endereço(s) · {com.length} serviço(s) com medida</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {com.map((l) => (
          <span key={l.sigla} className="text-[#a3a3a3]">{l.sigla} <strong className="text-[#f5f5f5]">{Number(l.quantidade).toLocaleString('pt-BR')}</strong> {l.unidade === 'M' ? 'm' : 'un'}</span>
        ))}
        {com.length === 0 && <span className="text-[#6b6b6b]">nenhuma sigla com medida</span>}
      </div>
    </div>
  )
}

function BlocoPresenca({ lida, onRemover }: { lida: PresencaLida; onRemover: () => void }) {
  return (
    <div className="rounded-lg border border-[#3d3d3d] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#f5f5f5]">
          Lista de presença{lida.equipe ? ` — ${lida.equipe}` : ''}
          {lida.data && <span className="ml-2 font-normal text-[#6b6b6b]">{lida.data.split('-').reverse().join('/')}{lida.anoInferido ? ' · ano deduzido' : ''}</span>}
        </p>
        <button type="button" onClick={onRemover} className="text-[11px] text-[#6b6b6b] hover:text-[#f5f5f5]">remover</button>
      </div>
      <ul className="grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
        {lida.pessoas.map((p, i) => (
          <li key={i} className="text-[#a3a3a3]">
            <span className="text-[#f5f5f5]">{p.nome}</span>{p.funcao && <> — {p.funcao}</>}
            <span className="ml-1 text-[#6b6b6b]">({funcaoCanonica(p.funcao)})</span>
          </li>
        ))}
      </ul>
      {lida.naoEntendidas.length > 0 && (
        <p className="text-[11px] text-[#fbbf24]"><AlertTriangle size={12} className="mr-1 inline" />Não entendi: {lida.naoEntendidas.join(' · ')}</p>
      )}
    </div>
  )
}
