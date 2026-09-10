/**
 * rdosReportExport.ts — Relatório consolidado de RDOs em A4, para imprimir ou salvar em PDF.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ──────────────────────────────────────────────────────────────
 * O consolidado anterior (`printRdosBatchPDF` em rdoPdfExport.ts) não estava só feio — estava
 * **errado**. Ele lia `rdo.services`, `rdo.trechos` e os quatro contadores de `rdo.manpower`;
 * mas o RDO Compizzo grava esses campos VAZIOS de propósito (`RdoCompizzoPanel.tsx:388-392`) e
 * põe o dado real em `rdo.compizzo.*` e em `manpower.employeeNames`. Resultado: 29 RDOs
 * preenchidos saíam com "Nenhum serviço", "Nenhum trecho", "0 pessoas" e "0m".
 *
 * O resto do app já sabia disso — o card do histórico lê os campos certos, com comentário
 * explicando, e a impressão individual desvia por template. Só o consolidado ficou para trás.
 *
 * ─── O QUE MUDA AQUI ──────────────────────────────────────────────────────────────────────────
 *  - **Um corpo por template.** Compizzo lê `compizzo.*`; padrão lê os campos de topo. Um RDO
 *    nunca mais sai vazio por estar no template "errado".
 *  - **Fotos.** A função antiga era síncrona, então nunca resolvia as imagens do bucket (elas
 *    só têm `storagePath` depois de sincronizadas). Aqui elas são baixadas e embutidas em
 *    base64 — a URL assinada expira em 1h, e um PDF salvo tem de sobreviver a isso.
 *  - **Tudo o mais que faltava**: materiais, os 12 campos de identificação, nomes dos
 *    funcionários, paradas, checklist de qualidade, horários e assinaturas.
 *
 * ─── REGRAS DE IMPRESSÃO QUE ESTE ARQUIVO HERDA ───────────────────────────────────────────────
 * O padrão é o de `financeiro/utils/boletosReportExport.ts`, o melhor gerador do repositório:
 * `buildRdosReportHtml` é PURA (string entra, string sai), então dá para conferir o documento
 * sem imprimir; a janela é aberta SÍNCRONA no clique, antes de qualquer `await`, senão o
 * navegador bloqueia o pop-up; e há `printViaIframe` como plano B.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- o RDO Sabesp é tipado com `any` na origem */
import type { RDO, RdoPhoto, RdoWeatherCondition } from '@/types'
import { classificarUnidade as classificarUnidadeCanonica } from '@/lib/unidadesMedida'
import type { RdoSabespData } from '@/features/rdo-sabesp/lib/rdoSabespPdfGenerator'
import { getCriadouroLabel, getServiceDisplayLabel } from '@/features/rdo-sabesp/lib/rdoSabespUtils'
import { resolvePhotosForPdf, blobToDataUrl } from './rdoPhotoStorage'
import { supabase } from '@/lib/supabase'
import { brandMarkSvg } from '@/lib/brandMark'
import { pageFooterCss } from '@/lib/printPageFooter'
import { areaExecutada } from './producaoCompizzo'
import { motivosMarcados, ROTULO_MOTIVO } from './horasParadas'
import { isNonProductionDataMode } from '@/lib/runtimeMode'

/**
 * O histórico mistura dois formatos que não têm tipo em comum: o RDO da Torre (`RDO`, com os
 * templates padrão e Compizzo) e o RDO Sabesp, que é outro documento, com outra tabela e outro
 * bucket. A tela de histórico já os lista lado a lado — o relatório faz o mesmo, em vez de
 * ignorar metade do período como o gerador antigo fazia.
 */
export type ItemRelatorio =
  | { tipo: 'torre';  rdo: RDO }
  | { tipo: 'sabesp'; rdo: RdoSabespData }

const dataDoItem = (i: ItemRelatorio): string =>
  i.tipo === 'torre' ? i.rdo.date : (i.rdo.report_date ?? '')

const idDoItem = (i: ItemRelatorio): string =>
  i.tipo === 'torre' ? i.rdo.id : `sabesp-${i.rdo.id ?? dataDoItem(i)}`

// ─── Rótulos ──────────────────────────────────────────────────────────────────

/** Duas famílias no mesmo mapa: o RDO padrão usa `RdoWeatherCondition`, o Compizzo usa o seu. */
const CLIMA_LABEL: Record<string, string> = {
  good: 'Bom', rain: 'Chuva', cloudy: 'Nublado', storm: 'Tempestade',
  sol: 'Sol', nublado: 'Nublado', chuva: 'Chuva', outros: 'Outros',
}

const STATUS_TRECHO: Record<string, string> = {
  not_started: 'Não iniciado', in_progress: 'Em execução', completed: 'Concluído',
}

const SERVICOS_COMPIZZO: Record<string, string> = {
  limpezaArea: 'Limpeza da área', isolamentoArea: 'Isolamento da área',
  preparacaoPiso: 'Preparação do piso', tintaVermelha: 'Tinta vermelha',
  tintaAmarela: 'Tinta amarela', faixaBranca: 'Faixa branca', faixaAmarela: 'Faixa amarela',
  faixaVermelha: 'Faixa vermelha', vagasPCD: 'Vagas PCD', retoques: 'Retoques',
  limpezaFinal: 'Limpeza final',
}

const OCORRENCIAS_COMPIZZO: Record<string, string> = {
  semOcorrencias: 'Sem ocorrências', chuva: 'Chuva', areaNaoLiberada: 'Área não liberada',
  interferenciaTerceiros: 'Interferência de terceiros', faltaEnergia: 'Falta de energia',
  equipamentoDefeito: 'Equipamento com defeito', outros: 'Outros',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** `yyyy-MM-dd` → `dd/MM/aaaa`. Por split: passar por `Date` deslocaria um dia. */
const dataBR = (iso?: string): string => {
  if (!iso || iso.length < 10) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Dinheiro e medidas: casas fixas, para as colunas alinharem. */
const fmtNum = (n: number, casas = 2): string =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/** Quantidade contada: "3 un", não "3,00 un". Decimal só quando existe de verdade. */
const fmtQtd = (n: number): string => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

const ehCompizzo = (r: RDO): boolean => r.template === 'compizzo' && !!r.compizzo

/**
 * ⚠️ Todo template precisa do seu ramo AQUI e nos três lugares abaixo (`contarExecutado`,
 * `fichaRdo`, `modelo` do sumário). Sem isso o RDO cai no corpo padrão, que lê `services`,
 * `trechos` e `manpower` — campos que os templates novos deixam vazios de propósito. O resultado é
 * um PDF impresso com "Nenhum serviço" e "0 pessoas" a partir de um RDO cheio, sem erro nenhum.
 * Já aconteceu com o Compizzo, e é por isso que existe teste cobrindo os três templates.
 */
const ehWcr = (r: RDO): boolean => r.template === 'wcr' && !!r.wcr

/** Atendimento pontual: endereço, peças e vala. Ver o aviso acima — precisa dos 4 ramos. */
const ehOrdemServico = (r: RDO): boolean => r.template === 'ordem-servico' && !!r.ordemServico

/**
 * Classifica a unidade de uma linha de produção.
 *
 * Delega para `@/lib/unidadesMedida`, que é o único lugar do projeto que responde a esta pergunta
 * — antes eram quatro listas divergentes. Aqui só se estreita o resultado para os dois tipos que
 * este relatório sabe exibir; verba e unidades avulsas não entram em metragem.
 */
function classificarUnidade(unidade: string): 'linear' | 'area' | null {
  const t = classificarUnidadeCanonica(unidade)
  return t === 'linear' || t === 'area' ? t : null
}

/** Quanto o item executou, e em que unidade — para o rótulo não mentir. */
export type Executado = { valor: number; unidade: string }

const UNIDADE_DE: Record<string, string> = { linear: 'm', area: 'm²' }

function juntar(partes: { tipo: 'linear' | 'area'; valor: number }[], padrao = 'm'): Executado {
  const valor = partes.reduce((s, p) => s + p.valor, 0)
  const tipos = [...new Set(partes.filter((p) => p.valor !== 0).map((p) => p.tipo))]
  if (tipos.length === 0) return { valor: 0, unidade: padrao }
  return { valor, unidade: tipos.length === 1 ? UNIDADE_DE[tipos[0]] : 'm / m²' }
}

/** Serviços da Sabesp com quantidade lançada — água e esgoto na mesma lista, como no formulário. */
const servicosSabesp = (r: RdoSabespData): any[] =>
  [...(r.servicos_esgoto ?? []), ...(r.servicos_agua ?? [])].filter((s: any) => Number(s?.quantidade) > 0)

/**
 * Tudo que o item tem de gente. Cada formato conta de um jeito, e os três precisam somar no
 * mesmo KPI da capa: contadores por função (padrão), lista nominal (Compizzo), terceiros +
 * contratados por cargo (Sabesp).
 */
export function contarPessoas(item: ItemRelatorio): number {
  if (item.tipo === 'sabesp') {
    return (item.rdo.mao_de_obra ?? []).reduce(
      (s: number, i: any) => s + (Number(i?.terc) || 0) + (Number(i?.contrat) || 0), 0)
  }
  const m = item.rdo.manpower
  const contadores = m.foremanCount + m.officialCount + m.helperCount + m.operatorCount
  // Os dois nunca coexistem: o padrão usa contadores, o Compizzo usa a lista.
  return contadores > 0 ? contadores : (m.employeeNames?.length ?? 0)
}

/** O que o item executou: trechos no padrão, produção no Compizzo, serviços na Sabesp. */
export function contarExecutado(item: ItemRelatorio): Executado {
  if (item.tipo === 'sabesp') {
    return juntar(servicosSabesp(item.rdo).flatMap((s: any) => {
      const tipo = classificarUnidade(String(s?.unidade ?? ''))
      return tipo ? [{ tipo, valor: Number(s?.quantidade) || 0 }] : []
    }))
  }
  const r = item.rdo
  if (ehWcr(r)) {
    // Só a rede (PRA/PRE) tem metragem. Ligação, poço e caixa são contagem, e contagem não entra
    // em metragem — somar as duas daria um número que não quer dizer nada.
    // ⚠️ Só `producao` (a soma), nunca `apontamentos[].producao` (o detalhe que a compõe): iterar
    // os dois conta em dobro. Ver `docs/ARMADILHAS_CONHECIDAS.md`, item 1.
    return juntar((r.wcr!.producao ?? [])
      .filter((l) => l.unidade === 'M' && String(l.quantidade ?? '').trim() !== '')
      .map((l) => ({ tipo: 'linear' as const, valor: num(l.quantidade) })))
  }
  if (ehOrdemServico(r)) {
    // ⚠️ Ordem de serviço NÃO tem metragem executada. A vala é medida bruta em texto ("3m por 60")
    // e transformá-la em metro linear seria inventar: 3×0,60 é área de abertura, não rede assentada.
    return juntar([])
  }
  if (ehCompizzo(r)) {
    return juntar((r.compizzo!.producao ?? []).flatMap((p) => {
      const tipo = classificarUnidade(p.unidade ?? '')
      return tipo ? [{ tipo, valor: num(p.quantidade) }] : []
    }))
  }
  // Trechos são sempre lineares — a coluna do tipo se chama `executedMeters`.
  return juntar(r.trechos.map((t) => ({ tipo: 'linear' as const, valor: t.executedMeters })))
}

/** Soma de vários itens, preservando a unidade quando ela é a mesma em todos. */
function somarExecutado(itens: ItemRelatorio[]): Executado {
  const partes = itens.flatMap((i) => {
    const e = contarExecutado(i)
    if (e.valor === 0) return []
    // 'm / m²' já é mistura: entra como as duas, para o total herdar a mistura.
    return e.unidade === 'm / m²'
      ? [{ tipo: 'linear' as const, valor: e.valor }, { tipo: 'area' as const, valor: 0 }]
      : [{ tipo: (e.unidade === 'm²' ? 'area' : 'linear') as 'linear' | 'area', valor: e.valor }]
  })
  return juntar(partes)
}

function secao(titulo: string, corpo: string, contagem?: string): string {
  if (!corpo.trim()) return ''
  return `<section class="sec">
    <h2>${esc(titulo)}${contagem ? `<span class="cnt">${esc(contagem)}</span>` : ''}</h2>
    ${corpo}
  </section>`
}

function tabela(cabecalhos: string[], linhas: string[], vazio: string): string {
  if (linhas.length === 0) return `<p class="vazio">${esc(vazio)}</p>`
  return `<table>
    <thead><tr>${cabecalhos.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${linhas.join('')}</tbody>
  </table>`
}

/**
 * Blocos de texto corrido. Um mesmo texto guardado em dois campos vira uma seção só (o painel
 * Compizzo duplica observações), mas textos diferentes NUNCA se anulam — o `||` que estava aqui
 * antes fazia o segundo campo desaparecer do documento.
 */
function textosLivres(pares: [string, unknown][]): string {
  const vistos = new Set<string>()
  const blocos: string[] = []
  for (const [titulo, valor] of pares) {
    const texto = String(valor ?? '').trim()
    if (texto === '' || vistos.has(texto)) continue
    vistos.add(texto)
    blocos.push(secao(titulo, `<p class="texto">${esc(texto)}</p>`))
  }
  return blocos.join('')
}

/** Pares rótulo/valor. Só entra o que está preenchido — campo vazio é ruído no papel. */
function fichaDados(pares: [string, unknown][]): string {
  const preenchidos = pares.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== '0')
  if (preenchidos.length === 0) return ''
  return `<div class="ficha-meta">${preenchidos
    .map(([k, v]) => `<div><span class="t-label">${esc(k)}</span><div>${esc(v)}</div></div>`)
    .join('')}</div>`
}

// ─── Corpo por template ───────────────────────────────────────────────────────

function corpoCompizzo(r: RDO): string {
  const c = r.compizzo!

  const marcados = Object.entries(c.servicos ?? {})
    .filter(([, v]) => v)
    .map(([k]) => SERVICOS_COMPIZZO[k] ?? k)
  const extras = (c.servicosExtra ?? []).map((e) =>
    `${e.nome}${e.quantidade ? ` — ${e.quantidade}${e.unidade ? ' ' + e.unidade : ''}` : ''}`)

  const producao = (c.producao ?? []).filter((p) => String(p.quantidade ?? '').trim() !== '')
  const ocorr = Object.entries(c.ocorrencias ?? {})
    .filter(([, v]) => v)
    .map(([k]) => OCORRENCIAS_COMPIZZO[k] ?? k)

  return [
    secao('Serviços executados', [
      marcados.length ? `<div class="chips">${marcados.map((s) => `<span>✓ ${esc(s)}</span>`).join('')}</div>` : '',
      extras.length ? `<div class="chips extras">${extras.map((s) => `<span>+ ${esc(s)}</span>`).join('')}</div>` : '',
      c.descricaoServicos ? `<p class="texto">${esc(c.descricaoServicos)}</p>` : '',
      (!marcados.length && !extras.length && !c.descricaoServicos) ? '<p class="vazio">Nenhum serviço registrado.</p>' : '',
    ].join(''), marcados.length + extras.length ? `${marcados.length + extras.length}` : undefined),

    secao('Produção do dia', tabela(
      ['Serviço', 'Executado', 'Previsto', 'Unidade'],
      producao.map((p) => `<tr>
        <td>${esc(p.servico)}</td>
        <td class="r n">${esc(p.quantidade)}</td>
        <td class="r n">${p.quantidadePrevista != null ? fmtQtd(p.quantidadePrevista) : '—'}</td>
        <td class="c">${esc(p.unidade ?? '—')}</td>
      </tr>`),
      'Nenhuma produção lançada.',
    ) + (() => {
      if (!c.horasTrabalhadas) return ''
      // ⚠️ RUP é HH por metro QUADRADO. Num dia só de faixa linear ela não existe — dividir horas
      // por metro e chamar de RUP seria inventar produtividade de área onde não houve área.
      const area = areaExecutada(c.producao)
      const rup = area > 0 ? c.horasTrabalhadas / area : null
      return `<p class="rodape-sec">Homem-hora no dia: <strong>${fmtNum(c.horasTrabalhadas, 1)} HH</strong>`
        + (rup !== null ? ` · RUP <strong>${fmtNum(rup, 2)} HH/m²</strong>` : ' · RUP não se aplica (sem produção em m² no dia)')
        + '</p>'
    })(),
    producao.length ? `${producao.length}` : undefined),

    secao('Materiais', tabela(
      ['Material', 'Quantidade', 'Custo unit.', 'Origem'],
      (c.materiais ?? []).filter((m) => m.material?.trim()).map((m) => `<tr>
        <td>${esc(m.material)}</td>
        <td class="r n">${esc(m.quantidade)}</td>
        <td class="r n">${m.custoUnitario != null ? 'R$ ' + fmtNum(m.custoUnitario) : '—'}</td>
        <td class="c">${m.stockItemId ? 'estoque' : 'fora do estoque'}</td>
      </tr>`),
      'Nenhum material.',
    )),

    // ⚠️ Com a HORA ao lado de cada motivo. Sem ela o papel dizia só "teve ocorrência", e a folha
    // não sustentava conversa nenhuma sobre prazo. Motivo sem hora sai declarado como não medido —
    // ausente não é zero.
    ocorr.length ? secao('Ocorrências', `<div class="chips alerta">${
      motivosMarcados(c.ocorrencias).map((m) => {
        const h = c.horasOcorrencia?.[m]
        const medida = typeof h === 'number' && Number.isFinite(h) ? `${fmtNum(h, 1)} h` : 'sem medida'
        return `<span>${esc(ROTULO_MOTIVO[m])} — ${medida}</span>`
      }).join('')
    }</div>`, (() => {
      const total = motivosMarcados(c.ocorrencias)
        .reduce((sum, m) => sum + (Number(c.horasOcorrencia?.[m]) || 0), 0)
      return total > 0 ? `${fmtNum(total, 1)} h` : undefined
    })()) : '',
  ].join('')
}

/**
 * O corpo do RDO WCR.
 *
 * ⚠️ Imprime TODAS as siglas, inclusive as sem número, e escreve "não informado" nelas. Filtrar as
 * vazias — como o corpo do Compizzo faz — seria certo lá (lá a linha vazia é linha de grade em
 * branco) e errado aqui: no apontamento da WCR a lista das 13 siglas É o formulário, e uma sigla
 * que sumiu do papel é indistinguível de uma que ninguém executou. Quem assina precisa ver as duas
 * colunas: o que foi feito e o que ficou sem resposta.
 */
function tabelaProducaoWcr(linhas: NonNullable<RDO['wcr']>['producao']): string {
  return tabela(
    ['Serviço', 'Quantidade', 'Un.'],
    linhas.map((l) => {
      const bruto = String(l.quantidade ?? '').trim()
      return `<tr>
        <td>${esc(l.sigla)}</td>
        <td class="c n">${bruto === '' ? '<span class="vazio">não informado</span>' : esc(fmtQtd(num(bruto)))}</td>
        <td class="c">${l.unidade === 'M' ? 'm' : 'un'}</td>
      </tr>`
    }),
    'Nenhum serviço no apontamento.',
  )
}

function tabelaImoveisWcr(imoveis: string[]): string {
  return tabela(['#', 'Endereço'], imoveis.map((im, i) => `<tr><td class="c n">${i + 1}</td><td>${esc(im)}</td></tr>`), 'Nenhum imóvel informado.')
}

function corpoWcr(r: RDO): string {
  const w = r.wcr!
  const linhas = w.producao ?? []
  const comNumero = linhas.filter((l) => String(l.quantidade ?? '').trim() !== '')
  const varios = (w.apontamentos ?? []).length > 1
  const presencas = w.presencas ?? []

  // Vários apontamentos: cada equipe inteira, e depois o total. Quem assina precisa ver quem fez o
  // quê — a soma sozinha não diz.
  const porEquipe = varios
    ? (w.apontamentos ?? []).map((a, i) => secao(
        `Apontamento ${i + 1} — ${[a.equipe, a.nucleo].filter(Boolean).map(esc).join(' · ') || 'sem identificação'}`,
        tabelaImoveisWcr(a.imoveis ?? []) + tabelaProducaoWcr(a.producao ?? []) + (a.observacoes ? `<p class="texto">${esc(a.observacoes)}</p>` : ''),
        `${(a.imoveis ?? []).length} endereço(s) · ${(a.producao ?? []).filter((l) => String(l.quantidade ?? '').trim() !== '').length} com medida`,
      )).join('')
    : ''

  const presenca = presencas.length
    ? secao('Quem estava na obra', tabela(
        ['Equipe', 'Nome', 'Função'],
        presencas.flatMap((p) => p.pessoas.map((x) => `<tr><td>${esc(p.equipe ?? '—')}</td><td>${esc(x.nome)}</td><td>${esc(x.funcao ?? '—')}</td></tr>`)),
        'Nenhuma lista de presença.',
      ), `${presencas.reduce((a, p) => a + p.pessoas.length, 0)} pessoa(s) · ${r.manpower.foremanCount} encarregado(s), ${r.manpower.officialCount} oficial(is), ${r.manpower.helperCount} ajudante(s)`)
    : ''

  return [
    secao('Identificação do dia', tabela(
      ['Campo', 'Valor'],
      ([['Equipe', w.equipe], ['Núcleo', w.nucleo]] as [string, string | undefined][])
        .filter(([, v]) => !!v)
        .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`),
      'Sem identificação.',
    ) + (w.anoInferido
      ? '<p class="vazio">⚠️ O ano da data não veio no apontamento e foi deduzido pelo sistema.</p>'
      : '')),

    porEquipe,

    secao(varios ? 'Imóveis atendidos — todas as equipes' : 'Imóveis atendidos', tabelaImoveisWcr(w.imoveis ?? []), `${(w.imoveis ?? []).length} endereço(s)`),

    secao(varios ? 'Produção do dia — TOTAL das equipes' : 'Produção do dia', tabelaProducaoWcr(linhas), `${comNumero.length} de ${linhas.length} com medida`),

    presenca,

    w.observacoes ? secao('Observações', `<p class="texto">${esc(w.observacoes)}</p>`) : '',

    (w.naoEntendidas ?? []).length
      ? secao('Linhas não reconhecidas', tabela(
          ['Conteúdo'],
          (w.naoEntendidas ?? []).map((n) => `<tr><td>${esc(n)}</td></tr>`),
          '',
        ), `${(w.naoEntendidas ?? []).length}`)
      : '',
  ].join('')
}

function corpoOrdemServico(r: RDO): string {
  const o = r.ordemServico!
  return [
    secao('Atendimento', tabela(
      ['Campo', 'Valor'],
      ([['Endereço', o.endereco], ['Serviço executado', o.servico], ['Vala', o.vala]] as [string, string | undefined][])
        .filter(([, v]) => !!String(v ?? '').trim())
        .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`),
      'Sem identificação do atendimento.',
    )),

    secao('Peças usadas', tabela(
      ['Peça'],
      (o.pecas ?? []).map((x) => `<tr><td>${esc(x)}</td></tr>`),
      'Nenhuma peça registrada.',
    ), `${(o.pecas ?? []).length} item(ns)`),

    // ⚠️ A pendência que hoje só existe dentro do WhatsApp e some.
    o.reposicaoPendente
      ? secao('Reposição pendente',
          `<p class="texto">⚠️ Ficou reposição de pavimento/passeio para fazer neste endereço.${o.reposicaoObs ? ' ' + esc(o.reposicaoObs) : ''}</p>`)
      : '',

    o.observacoes ? secao('Observações', `<p class="texto">${esc(o.observacoes)}</p>`) : '',
  ].join('')
}

function corpoPadrao(r: RDO): string {
  return [
    secao('Mão de obra', tabela(
      ['Função', 'Quantidade'],
      ([['Encarregado', r.manpower.foremanCount], ['Oficial', r.manpower.officialCount],
        ['Ajudante', r.manpower.helperCount], ['Operador', r.manpower.operatorCount]] as [string, number][])
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r n">${v}</td></tr>`),
      'Nenhuma equipe lançada.',
    )),

    secao('Serviços executados', tabela(
      ['Descrição', 'Quantidade', 'Unidade'],
      r.services.map((s) => `<tr><td>${esc(s.description)}</td><td class="r n">${fmtQtd(s.quantity)}</td><td class="c">${esc(s.unit)}</td></tr>`),
      'Nenhum serviço.',
    ), r.services.length ? `${r.services.length}` : undefined),

    secao('Avanço por trecho', tabela(
      ['Código', 'Descrição', 'Previsto', 'Executado', 'Situação'],
      r.trechos.map((t) => `<tr>
        <td><code>${esc(t.trechoCode)}</code></td>
        <td>${esc(t.trechoDescription)}</td>
        <td class="r n">${fmtNum(t.plannedMeters, 0)} m</td>
        <td class="r n">${fmtNum(t.executedMeters, 0)} m</td>
        <td class="c">${esc(STATUS_TRECHO[t.status] ?? t.status)}</td>
      </tr>`),
      'Nenhum trecho.',
    ), r.trechos.length ? `${r.trechos.length}` : undefined),

    secao('Materiais', tabela(
      ['Material', 'Quantidade', 'Unidade', 'Custo total'],
      (r.materials ?? []).map((m) => `<tr>
        <td>${esc(m.material)}</td>
        <td class="r n">${fmtQtd(num(m.quantity))}</td>
        <td class="c">${esc(m.unit ?? '—')}</td>
        <td class="r n">${m.totalCostBRL != null ? 'R$ ' + fmtNum(m.totalCostBRL) : '—'}</td>
      </tr>`),
      'Nenhum material.',
    )),
  ].join('')
}

// ─── Sabesp ───────────────────────────────────────────────────────────────────

function fichaSabesp(r: RdoSabespData, fotos: RdoPhoto[]): string {
  const clima: any = r.condicoes_climaticas ?? {}
  const qual: any = r.qualidade ?? {}
  const hor: any = r.horarios ?? {}
  const paradas: any[] = r.paralisacoes ?? []
  const mdo = (r.mao_de_obra ?? []).filter((i: any) => i?.cargo)
  const equip = (r.equipamentos ?? []).filter((i: any) => i?.descricao)
  const servicos = servicosSabesp(r)

  const janela = (j: any) => (j?.inicio || j?.fim) ? `${j?.inicio ?? '—'} – ${j?.fim ?? '—'}` : ''

  return `<article class="rdo">
    <header class="rdo-h">
      <div>
        <div class="rdo-num">RDO Sabesp${r.status === 'draft' ? ' · rascunho' : ''}</div>
        <h3>${esc(r.rua_beco || 'Sem logradouro informado')}</h3>
      </div>
      <div class="rdo-h-right">
        <div>${dataBR(r.report_date)}</div>
        <div class="sub">${esc(r.encarregado || '—')}</div>
      </div>
    </header>

    ${fichaDados([
      ['Rua / beco', r.rua_beco],
      ['Encarregado', r.encarregado],
      ['Criadouro', getCriadouroLabel(r.criadouro, r.criadouro_outro)],
      ['EPI utilizado', r.epi_utilizado == null ? '' : r.epi_utilizado ? 'Sim' : 'Não'],
      ['Clima', [clima.manha && `Manhã: ${clima.manha}`, clima.tarde && `Tarde: ${clima.tarde}`,
                 clima.noite && `Noite: ${clima.noite}`].filter(Boolean).join(' · ')],
      ['Horário diurno', janela(hor.diurno)],
      ['Horário noturno', janela(hor.noturno)],
    ])}

    ${mdo.length ? secao('Mão de obra', tabela(
      ['Cargo', 'Terceiros', 'Contratados'],
      mdo.map((i: any) => `<tr><td>${esc(i.cargo)}</td><td class="c n">${Number(i.terc) || 0}</td><td class="c n">${Number(i.contrat) || 0}</td></tr>`),
      '',
    ), `${mdo.length}`) : ''}

    ${secao('Serviços executados', tabela(
      ['Serviço', 'Quantidade', 'Unidade'],
      servicos.map((s: any) => `<tr>
        <td>${esc(getServiceDisplayLabel(s) || s.descricao || s.codigo || '—')}</td>
        <td class="r n">${fmtQtd(Number(s.quantidade) || 0)}</td>
        <td class="c">${esc(s.unidade ?? '—')}</td>
      </tr>`),
      'Nenhum serviço com quantidade lançada.',
    ), servicos.length ? `${servicos.length}` : undefined)}

    ${equip.length ? secao('Equipamentos e veículos', tabela(
      ['Descrição', 'Terceiros', 'Contratados'],
      equip.map((i: any) => `<tr><td>${esc(i.descricao)}</td><td class="c n">${Number(i.terc) || 0}</td><td class="c n">${Number(i.contrat) || 0}</td></tr>`),
      '',
    ), `${equip.length}`) : ''}

    ${(paradas.length || r.paralisacao_outro) ? secao('Paralisações', tabela(
      ['Motivo', 'Início', 'Fim'],
      [
        ...paradas.map((p: any) => `<tr><td>${esc(p.motivo || '—')}</td><td class="c">${esc(p.inicio ?? '—')}</td><td class="c">${esc(p.fim ?? '—')}</td></tr>`),
        ...(r.paralisacao_outro ? [`<tr><td>${esc(r.paralisacao_outro)}</td><td class="c">—</td><td class="c">—</td></tr>`] : []),
      ],
      '',
    )) : ''}

    ${secao('Checklist de qualidade', `<div class="chips">
      <span>${qual.ordem_servico ? '✓' : '✗'} Ordem de serviço</span>
      <span>${qual.bandeirola ? '✓' : '✗'} Bandeirola</span>
      <span>${qual.projeto ? '✓' : '✗'} Projeto</span>
    </div>${qual.obs ? `<p class="texto">${esc(qual.obs)}</p>` : ''}`)}

    ${r.observacoes ? secao('Observações', `<p class="texto">${esc(r.observacoes)}</p>`) : ''}

    ${fotos.length ? `<section class="sec fotos">
      <h2>Registro fotográfico<span class="cnt">${fotos.length}</span></h2>
      <div class="fotos-grid">
        ${fotos.map((f) => `<figure class="foto">
          <img src="${f.base64}" alt="${esc(f.label)}" />
          <figcaption>${esc(f.label || 'Sem legenda')}</figcaption>
        </figure>`).join('')}
      </div>
    </section>` : ''}

    <div class="assinaturas">
      <div>${esc(r.responsavel_empreiteira || '')}<br><span class="t-label">Empreiteira</span></div>
      <div>${esc(r.responsavel_consorcio || '')}<br><span class="t-label">Consórcio</span></div>
      <div><br><span class="t-label">Fiscalização Sabesp</span></div>
    </div>
  </article>`
}

// ─── Um RDO ───────────────────────────────────────────────────────────────────

function fichaRdo(r: RDO, fotos: RdoPhoto[]): string {
  const compizzo = ehCompizzo(r)
  const wcr = ehWcr(r)
  const os = ehOrdemServico(r)
  const clima = compizzo
    ? (CLIMA_LABEL[r.compizzo!.condicaoClimatica] ?? r.compizzo!.condicaoClimatica)
      + (r.compizzo!.condicaoClimaticaOutros ? ` — ${r.compizzo!.condicaoClimaticaOutros}` : '')
    : ['Manhã', 'Tarde', 'Noite']
        .map((p, i) => `${p}: ${CLIMA_LABEL[[r.weather.morning, r.weather.afternoon, r.weather.night][i] as RdoWeatherCondition] ?? '—'}`)
        .join(' · ') + (r.weather.temperatureC ? ` · ${r.weather.temperatureC}°C` : '')

  const nomes = r.manpower.employeeNames ?? []
  const paradas = r.stoppages ?? []

  return `<article class="rdo">
    <header class="rdo-h">
      <div>
        <div class="rdo-num">RDO #${r.number}${compizzo ? ' · Compizzo' : ''}${
          // ⚠️ Um rascunho impresso era IDÊNTICO a um finalizado. O número ainda vai mudar, e
          // alguém pode levar a folha para uma reunião achando que é o documento fechado.
          r.status === 'rascunho' ? '<span class="selo-rascunho">RASCUNHO</span>' : ''
        }</div>
        <h3>${esc(r.title || `RDO de ${dataBR(r.date)}`)}</h3>
      </div>
      <div class="rdo-h-right">
        <div>${dataBR(r.date)}</div>
        <div class="sub">${esc(r.responsible || '—')}</div>
      </div>
    </header>

    ${fichaDados([
      ['Obra / local', r.local ?? r.compizzo?.obra],
      ['Empreiteira', r.nomeEmpreiteira],
      ['Nº da OS', r.numeroOS],
      ['Contrato', r.numeroContrato ?? r.compizzo?.numeroContrato],
      ['Gerente do contrato', r.gerenteContrato],
      ['Técnico de segurança', r.tecnicoSeguranca],
      ['Funcionários diretos', r.funcionariosDiretos],
      ['Funcionários indiretos', r.funcionariosIndiretos],
      ['Clima', clima],
      ['EPI utilizado', r.epiUtilizado === undefined ? '' : r.epiUtilizado ? 'Sim' : 'Não'],
      ['Jornada', r.activityHours?.dayStart ? `${r.activityHours.dayStart}–${r.activityHours.dayEnd ?? ''}` : ''],
      ['Geolocalização', r.geolocation ? `${r.geolocation.lat}, ${r.geolocation.lng}` : ''],
      // O snapshot de contrato que a TELA mostra e o papel não mostrava.
      ['Serviço contratado', r.compizzo?.servicoContratado],
      ['Faturamento previsto (BAC)', r.compizzo?.bacOrcamentoBRL ? 'R$ ' + fmtNum(r.compizzo.bacOrcamentoBRL) : ''],
      ['Preço por m²', r.compizzo?.precoM2 ? 'R$ ' + fmtNum(r.compizzo.precoM2) : ''],
      ['Período do contrato', r.compizzo?.periodoInicio || r.compizzo?.periodoFim
        ? `${r.compizzo?.periodoInicio ? dataBR(r.compizzo.periodoInicio) : '—'} a ${r.compizzo?.periodoFim ? dataBR(r.compizzo.periodoFim) : '—'}`
        : ''],
      ['Dia da obra', r.compizzo?.diaObra],
    ])}

    ${(() => {
      // ⚠️ A impressão antiga lia SÓ `employeeNames` e imprimia "Total de colaboradores: 0" para
      // qualquer RDO que contasse a equipe por função. Aqui as duas formas entram.
      const m = r.manpower
      const porFuncao = [
        ['Encarregados', m.foremanCount], ['Oficiais', m.officialCount],
        ['Ajudantes', m.helperCount], ['Operadores', m.operatorCount],
      ].filter(([, n]) => Number(n) > 0) as [string, number][]
      const total = contarPessoas({ tipo: 'torre', rdo: r })
      if (!nomes.length && !porFuncao.length) return ''
      return secao('Equipe presente', [
        porFuncao.length ? `<div class="chips">${porFuncao.map(([rot, n]) => `<span>${esc(rot)}: ${n}</span>`).join('')}</div>` : '',
        nomes.length ? `<div class="chips">${nomes.map((n) => `<span>${esc(n)}</span>`).join('')}</div>` : '',
      ].join(''), `${total} pessoa(s)`)
    })()}

    ${wcr ? corpoWcr(r) : compizzo ? corpoCompizzo(r) : os ? corpoOrdemServico(r) : corpoPadrao(r)}

    ${secao('Equipamentos', tabela(
      ['Equipamento', 'Qtd.', 'Horas', 'Operador'],
      r.equipment.map((e) => `<tr>
        <td>${esc(e.name)}</td><td class="c n">${e.quantity}</td>
        <td class="c n">${e.hours}h</td><td>${esc(e.operator ?? '—')}</td>
      </tr>`),
      'Nenhum equipamento.',
    ), r.equipment.length ? `${r.equipment.length}` : undefined)}

    ${paradas.length ? secao('Paralisações', tabela(
      ['Período', 'Motivo', 'Início', 'Fim'],
      paradas.map((p) => `<tr><td>${esc(p.period)}</td><td>${esc(p.reason)}</td><td class="c">${esc(p.start)}</td><td class="c">${esc(p.end)}</td></tr>`),
      '',
    )) : ''}

    ${r.qualityChecklist ? secao('Checklist de qualidade', `<div class="chips">
      <span>${r.qualityChecklist.ordemServico ? '✓' : '✗'} Ordem de serviço</span>
      <span>${r.qualityChecklist.bandeirola ? '✓' : '✗'} Bandeirola</span>
      <span>${r.qualityChecklist.projeto ? '✓' : '✗'} Projeto</span>
    </div>${r.qualityChecklist.obs ? `<p class="texto">${esc(r.qualityChecklist.obs)}</p>` : ''}`) : ''}

    ${textosLivres([
      // NÃO usar `a || b` aqui: são campos DIFERENTES que podem estar os dois preenchidos, e o
      // fallback descartaria um em silêncio. O painel Compizzo grava o mesmo texto em
      // `observations` e `compizzo.observacoes`, mas uma edição posterior altera só um deles —
      // por isso os dois entram, e a deduplicação por conteúdo evita o parágrafo repetido.
      ['Observações', r.observations],
      ['Observações', r.compizzo?.observacoes],
      ['Ocorrências', r.incidents],
      // Mesmo rótulo que `RdoDetalhe.tsx:466` usa para distinguir os dois campos na tela.
      ['Ocorrências (contrato)', r.ocorrencias],
      ['Planejamento para o próximo dia', r.compizzo?.planejamentoProximoDia],
    ])}

    ${fotos.length ? `<section class="sec fotos">
      <h2>Registro fotográfico<span class="cnt">${fotos.length}</span></h2>
      <div class="fotos-grid">
        ${fotos.map((f) => `<figure class="foto">
          <img src="${f.base64}" alt="${esc(f.label)}" />
          <figcaption>${esc(f.label || 'Sem legenda')}</figcaption>
        </figure>`).join('')}
      </div>
    </section>` : ''}

    <div class="assinaturas">
      <div>${esc(r.compizzo?.responsavelNome || r.responsible || '')}<br><span class="t-label">Responsável pelo RDO</span></div>
      <div><br><span class="t-label">Fiscalização</span></div>
      <div><br><span class="t-label">Contratada</span></div>
    </div>
  </article>`
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
// Herdado de boletosReportExport.ts. Cada bloco resolve um problema concreto de impressão;
// ver os comentários lá para o raciocínio completo de cada um.

const CSS = `
.selo-rascunho { margin-left: 6px; padding: 1px 6px; border: 1px solid #b45309; border-radius: 3px;
  font-size: 8pt; font-weight: 700; letter-spacing: .06em; color: #b45309; background: #fef3c7; }
:root { color-scheme: light only; forced-color-adjust: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
* { margin:0; padding:0; box-sizing:border-box; forced-color-adjust:none; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
html, body { background:#fff !important; color:#0f172a !important; }
@media (prefers-color-scheme: dark) { html, body { background:#fff !important; color:#0f172a !important; } }
@page { size: A4 portrait; margin: 12mm 12mm 16mm 12mm; }
body { font: 9.5pt/1.42 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; padding: 10mm 12mm; max-width: 210mm; margin: 0 auto; orphans:3; widows:3; }
@media print { body { padding: 0; max-width: none; } }

.n { font-variant-numeric: tabular-nums; }
.r { text-align:right } .c { text-align:center }
.sub { font-size:7.5pt; color:#64748b; }
.vazio { font-size:8.5pt; color:#64748b; font-style:italic; padding:5px 2px; }
.t-label { font-size:7pt; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#64748b; }
.texto { font-size:9pt; line-height:1.55; padding:6px 2px; white-space:pre-wrap; overflow-wrap:anywhere; }
.rodape-sec { font-size:8pt; color:#475569; padding:5px 2px 0; }

.head { display:grid; grid-template-columns:auto 1fr auto; gap:14px; align-items:center; border-bottom:3px solid #f97316; padding-bottom:10px; margin-bottom:12px; }
.head-mark { width:46px; height:46px; border-radius:10px; background:#0f172a; display:grid; place-items:center; overflow:hidden; }
.head h1 { font-size:17pt; font-weight:800; letter-spacing:-.01em; }
.head-sub { font-size:9pt; color:#475569; margin-top:1px; }
.head-right { text-align:right; font-size:7.5pt; color:#64748b; line-height:1.5; }
.chip-demo { display:inline-block; background:#fef3c7; color:#92400e; border:1px solid #fcd34d; border-radius:999px; padding:1px 8px; font-size:7.5pt; font-weight:800; letter-spacing:.06em; }

.kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; margin-bottom:14px; }
.kpi { border:1px solid #e2e8f0; border-left:3px solid #f97316; border-radius:8px; padding:7px 9px; background:#f8fafc; }
.kpi-value { font-size:13pt; font-weight:800; line-height:1.2; font-variant-numeric:tabular-nums; }
.kpi-sub { font-size:7pt; color:#64748b; text-transform:uppercase; letter-spacing:.06em; }

.sumario { margin-bottom:16px; }
.sumario table { font-size:8pt; }

/* Cada RDO começa em página nova: são documentos distintos, e misturar dois numa folha
   dificulta arquivar e conferir. O primeiro não quebra, para não abrir com folha em branco. */
.rdo { break-before: page; padding-top:2mm; }
.rdo:first-of-type { break-before: auto; }
.rdo-h { display:grid; grid-template-columns:1fr auto; gap:10px; align-items:baseline; border-bottom:2px solid #0f172a; padding-bottom:6px; margin-bottom:9px; break-after:avoid; }
.rdo-num { font-size:7.5pt; font-weight:800; text-transform:uppercase; letter-spacing:.1em; color:#b45309; }
.rdo-h h3 { font-size:13pt; font-weight:700; letter-spacing:-.01em; margin-top:2px; }
.rdo-h-right { text-align:right; font-size:9pt; font-weight:600; }

.ficha-meta { display:grid; grid-template-columns:repeat(3,1fr); gap:7px 12px; padding:8px 10px; margin-bottom:11px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-size:8.5pt; break-inside:avoid; }
.ficha-meta div { overflow-wrap:anywhere; }

.sec { margin-bottom:11px; break-inside:avoid; }
.sec.fotos { break-inside:auto; }
.sec > h2 { font-size:9.5pt; font-weight:700; color:#fff; background:#0f172a; padding:5px 10px; border-radius:6px 6px 0 0; break-after:avoid; display:flex; align-items:center; gap:8px; }
.sec > h2::before { content:''; width:7px; height:7px; border-radius:50%; background:#f97316; flex:none; }
.sec > h2 .cnt { margin-left:auto; font-size:8pt; font-weight:600; opacity:.75; }

table { width:100%; border-collapse:collapse; font-size:8.5pt; }
thead { display: table-header-group; }
th { background:#f1f5f9; color:#334155; padding:4px 8px; text-align:left; font-size:7.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid #cbd5e1; }
td { padding:4px 8px; border-bottom:1px solid #eef2f7; vertical-align:top; overflow-wrap:anywhere; }
tr { break-inside: avoid; }
code { font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace; font-size:8pt; }

.chips { display:flex; flex-wrap:wrap; gap:4px; padding:7px 2px; }
.chips span { border:1px solid #e2e8f0; background:#f8fafc; border-radius:999px; padding:2px 9px; font-size:8pt; color:#334155; }
.chips.extras span { border-color:#bfdbfe; background:#eff6ff; color:#1e40af; }
.chips.alerta span { border-color:#fecaca; background:#fef2f2; color:#b91c1c; font-weight:600; }

.fotos-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; padding-top:8px; }
.foto { border:1px solid #cbd5e1; border-radius:6px; overflow:hidden; break-inside:avoid; }
.foto img { display:block; width:100%; height:70mm; object-fit:contain; background:#fff; }
.foto figcaption { padding:4px 7px; font-size:7.5pt; color:#475569; border-top:1px solid #eef2f7; }

.assinaturas { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-top:20px; break-inside:avoid; }
.assinaturas div { border-top:1px solid #0f172a; padding-top:4px; text-align:center; font-size:8pt; color:#475569; }

.rodape { margin-top:16px; display:flex; flex-wrap:wrap; justify-content:space-between; gap:4px 12px; font-size:6.8pt; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:5px; }
.aviso { margin-top:10px; padding:6px 9px; background:#fffbeb; border-left:3px solid #b45309; font-size:8pt; color:#92400e; }
/* O aviso de peso é orientação de tela; no papel ele não faz sentido nenhum. */
.aviso-peso { margin:0 0 12px; font-size:9pt; }
@media print { .aviso-peso { display:none !important; } }

.demo-wm { position:fixed; inset:0; display:grid; place-items:center; pointer-events:none; z-index:0; }
.demo-wm span { transform:rotate(-32deg); font-size:64pt; font-weight:900; color:#0f172a; opacity:.038; letter-spacing:.15em; }
body > *:not(.demo-wm) { position:relative; z-index:1; }

.barra-acoes { position:sticky; top:0; display:flex; justify-content:flex-end; gap:8px; padding:8px 0 12px; background:#fff; z-index:2; }
.barra-acoes button { border:1px solid #0f172a; background:#0f172a; color:#fff; border-radius:6px; padding:7px 14px; font-size:9pt; font-weight:700; cursor:pointer; }
@media print { .barra-acoes { display:none !important; } }
`

// ─── O documento ──────────────────────────────────────────────────────────────

export type OpcoesRelatorioRdos = {
  periodo: string
  /** Nome da obra ativa, quando houver filtro. */
  obra?: string | null
  /** Fotos já resolvidas em base64, por id de item (ver `idDoItem`). */
  fotosPorRdo?: Record<string, RdoPhoto[]>
  /** Quantas fotos não puderam ser baixadas — declarado no rodapé em vez de sumir calado. */
  fotosFaltando?: number
  /** Documento grande demais para imprimir sozinho: o aviso vai no topo, junto ao botão. */
  avisoPeso?: string
  demo?: boolean
  geradoEm?: Date
}

/**
 * Função PURA: string entra, string sai. É o que permite conferir o documento sem imprimir —
 * e é como o teste garante que nenhum campo preenchido sai vazio.
 */
export function buildRdosReportHtml(itens: ItemRelatorio[], op: OpcoesRelatorioRdos): string {
  const ordenados = [...itens].sort((a, b) => {
    const d = dataDoItem(a).localeCompare(dataDoItem(b))
    if (d !== 0) return d
    // Mesma data: o número do RDO da Torre desempata; a Sabesp não tem número e vai depois.
    if (a.tipo === 'torre' && b.tipo === 'torre') return a.rdo.number - b.rdo.number
    return a.tipo === 'torre' ? -1 : 1
  })

  const fotosDe = (i: ItemRelatorio) => op.fotosPorRdo?.[idDoItem(i)] ?? []
  const totalPessoas = ordenados.reduce((s, i) => s + contarPessoas(i), 0)
  const totalExecutado = somarExecutado(ordenados)
  const totalFotos = ordenados.reduce((s, i) => s + fotosDe(i).length, 0)
  const geradoEm = op.geradoEm ?? new Date()

  const kpis = [
    { valor: String(ordenados.length), rotulo: 'RDOs no período' },
    { valor: `${fmtNum(totalExecutado.valor, 0)} ${totalExecutado.unidade}`, rotulo: 'Executado' },
    { valor: String(totalPessoas), rotulo: 'Trabalhadores-dia' },
    { valor: String(totalFotos), rotulo: 'Fotos anexadas' },
  ]

  const sumario = ordenados.map((i) => {
    const exec = contarExecutado(i)
    const modelo = i.tipo === 'sabesp' ? 'Sabesp' : ehWcr(i.rdo) ? 'WCR' : ehCompizzo(i.rdo) ? 'Compizzo' : ehOrdemServico(i.rdo) ? 'Ordem de serviço' : 'Padrão'
    return `<tr>
      <td class="c">${i.tipo === 'torre' ? i.rdo.number : '—'}</td>
      <td>${dataBR(dataDoItem(i))}</td>
      <td>${esc(i.tipo === 'torre' ? (i.rdo.title || '—') : (i.rdo.rua_beco || '—'))}</td>
      <td class="c">${modelo}</td>
      <td class="r n">${contarPessoas(i) || '—'}</td>
      <td class="r n">${exec.valor ? `${fmtNum(exec.valor, 0)} ${exec.unidade}` : '—'}</td>
      <td class="c n">${fotosDe(i).length || '—'}</td>
    </tr>`
  })

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório de RDOs — ${esc(op.periodo)}</title>
<style>${CSS}</style>
<!-- Depois do CSS principal: a @page daqui precisa vencer a margem declarada lá. -->
<style>${pageFooterCss(`Relatório de RDOs · ${op.obra ?? 'todas as obras'} · ${op.periodo}${op.demo ? ' · DEMONSTRAÇÃO' : ''}`)}</style></head><body>
${op.demo ? '<div class="demo-wm"><span>DEMONSTRAÇÃO</span></div>' : ''}
<div class="barra-acoes"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
${op.avisoPeso ? `<p class="aviso aviso-peso">${esc(op.avisoPeso)}</p>` : ''}

<header class="head">
  <div class="head-mark">${brandMarkSvg(30, '#fff')}</div>
  <div>
    <h1>Relatório de RDOs</h1>
    <div class="head-sub">${esc(op.periodo)}${op.obra ? ` · ${esc(op.obra)}` : ' · todas as obras'}</div>
  </div>
  <div class="head-right">
    ${op.demo ? '<div class="chip-demo">DEMONSTRAÇÃO</div>' : ''}
    <div>Gerado em ${geradoEm.toLocaleString('pt-BR')}</div>
  </div>
</header>

<div class="kpis">
  ${kpis.map((k) => `<div class="kpi"><div class="kpi-value">${esc(k.valor)}</div><div class="kpi-sub">${esc(k.rotulo)}</div></div>`).join('')}
</div>

<section class="sec sumario">
  <h2>Sumário<span class="cnt">${ordenados.length}</span></h2>
  ${tabela(['#', 'Data', 'Título', 'Modelo', 'Pessoas', 'Executado', 'Fotos'], sumario, 'Nenhum RDO no período.')}
</section>

${ordenados.map((i) => i.tipo === 'sabesp' ? fichaSabesp(i.rdo, fotosDe(i)) : fichaRdo(i.rdo, fotosDe(i))).join('')}

${op.fotosFaltando ? `<p class="aviso">${op.fotosFaltando} foto(s) não puderam ser incorporadas ao documento — provavelmente ainda não sincronizaram. Elas continuam visíveis no RDO dentro da plataforma.</p>` : ''}

<footer class="rodape">
  <span>ConstruData · Módulo RDO</span>
  <span>${ordenados.length} RDO(s) · ${esc(op.periodo)}</span>
</footer>
</body></html>`
}

// ─── Impressão ────────────────────────────────────────────────────────────────

/**
 * Abre a janela ANTES de qualquer `await`. Sem isso o navegador entende o `window.open` como
 * não solicitado pelo usuário e bloqueia — e resolver as fotos leva segundos.
 */
export function abrirJanelaRelatorio(): Window | null {
  const win = window.open('', '_blank', 'width=980,height=760')
  if (win) {
    win.document.write('<!doctype html><meta charset="utf-8"><title>Gerando o relatório…</title>'
      + '<body style="font:14px -apple-system,sans-serif;padding:40px;color:#334155">Gerando o relatório…'
      + '<br><small style="color:#94a3b8">Baixando as fotos dos RDOs. Isso pode levar alguns segundos.</small></body>')
  }
  return win
}

/** Espera as imagens decodificarem antes de imprimir — senão sai moldura vazia. */
async function aguardarImagens(doc: Document): Promise<void> {
  await Promise.all(Array.from(doc.images).map((img) =>
    img.complete ? Promise.resolve() : img.decode().catch(() => undefined)))
}

/** `imprimir = false` só entrega o documento; quem dispara a impressão é o botão da barra. */
export async function escreverEImprimir(win: Window, html: string, imprimir = true): Promise<void> {
  win.document.open()
  win.document.write(html)
  win.document.close()
  await aguardarImagens(win.document)
  win.focus()
  if (imprimir) win.print()
}

/** Plano B quando o pop-up é bloqueado: imprime de um iframe oculto, sem abrir aba. */
export async function imprimirPorIframe(html: string): Promise<void> {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc) { frame.remove(); return }
  doc.open(); doc.write(html); doc.close()
  await aguardarImagens(doc)
  const limpar = () => frame.remove()
  frame.contentWindow?.addEventListener('afterprint', limpar, { once: true })
  // Safari não emite `afterprint` de iframe de forma confiável — rede de segurança.
  setTimeout(limpar, 60_000)
  frame.contentWindow?.focus()
  frame.contentWindow?.print()
}

/** As fotos da Sabesp são caminhos crus em outro bucket — não passam por `resolvePhotosForPdf`. */
async function resolverFotosSabesp(caminhos: string[]): Promise<RdoPhoto[]> {
  const fotos = await Promise.all(caminhos.map(async (caminho, i): Promise<RdoPhoto | null> => {
    try {
      const url = /^(data:|https?:)/i.test(caminho)
        ? caminho
        : (await supabase.storage.from('rdo-sabesp-photos').createSignedUrl(caminho, 3600)).data?.signedUrl
      if (!url) return null
      const base64 = url.startsWith('data:') ? url : await blobToDataUrl(await (await fetch(url)).blob())
      return { id: `${caminho}-${i}`, base64, label: `Foto ${i + 1}`, uploadedAt: '' }
    } catch {
      return null
    }
  }))
  return fotos.filter((f): f is RdoPhoto => f !== null)
}

/**
 * Gera e imprime. Baixa as fotos de todos os RDOs e as embute em base64: a URL assinada do
 * bucket expira em 1 hora, então um PDF salvo com links ficaria com molduras vazias no dia
 * seguinte.
 *
 * As fotos são baixadas em paralelo — em série, 29 RDOs com meia dúzia de fotos cada davam
 * minutos de espera com a janela do relatório parada em "Gerando…".
 */
export async function imprimirRelatorioRdos(
  itens: ItemRelatorio[],
  periodo: string,
  obra?: string | null,
  janela?: Window | null,
): Promise<void> {
  const fotosPorRdo: Record<string, RdoPhoto[]> = {}
  let faltando = 0

  await Promise.all(itens.map(async (item) => {
    const pedidas = item.tipo === 'torre'
      ? (item.rdo.photos?.length ?? 0)
      : (item.rdo.photo_paths?.length ?? 0)
    if (pedidas === 0) return

    const resolvidas = item.tipo === 'torre'
      ? await resolvePhotosForPdf(item.rdo.photos)
      : await resolverFotosSabesp(item.rdo.photo_paths ?? [])

    faltando += pedidas - resolvidas.length
    if (resolvidas.length) fotosPorRdo[idDoItem(item)] = resolvidas
  }))

  // As fotos entram em tamanho original: 70mm de altura no papel a 300dpi já consomem quase os
  // 1400px que o app guarda, e reduzir viraria borrão na impressão. O preço é peso — medido no
  // Chrome, uma foto de canteiro (JPEG 1400px q=0.82) dá ~228 KB, que em base64 viram ~305 KB;
  // um mês com 29 RDOs e 4 fotos cada chega a ~35 MB.
  //
  // Acima de 25 MB o documento é gerado do mesmo jeito, mas a impressão NÃO dispara sozinha: um
  // aviso no topo explica o tamanho e o usuário aperta "Imprimir" quando quiser. Um `confirm()`
  // aqui seria pior — ele abre na janela do app, que já está atrás do pop-up do relatório, e o
  // usuário ficaria olhando um "Gerando…" parado sem entender o que trava.
  const primeiro = buildRdosReportHtml(itens, {
    periodo, obra, fotosPorRdo, fotosFaltando: faltando, demo: isNonProductionDataMode(),
  })
  const mb = primeiro.length / 1024 / 1024
  const pesado = mb > 25
  const totalFotos = Object.values(fotosPorRdo).reduce((s, f) => s + f.length, 0)

  const html = pesado
    ? buildRdosReportHtml(itens, {
        periodo, obra, fotosPorRdo, fotosFaltando: faltando, demo: isNonProductionDataMode(),
        avisoPeso: `Este relatório ficou com cerca de ${mb.toFixed(0)} MB por causa das ${totalFotos} fotos `
          + 'em tamanho original, então a impressão não foi aberta automaticamente — documentos desse tamanho '
          + 'travam a caixa de impressão de alguns navegadores. Use o botão acima quando estiver pronto, ou '
          + 'feche esta janela e exporte por semana em vez do mês inteiro.',
      })
    : primeiro

  if (janela && !janela.closed) await escreverEImprimir(janela, html, !pesado)
  else await imprimirPorIframe(html)   // pop-up bloqueado: imprimir daqui é a única saída
}
