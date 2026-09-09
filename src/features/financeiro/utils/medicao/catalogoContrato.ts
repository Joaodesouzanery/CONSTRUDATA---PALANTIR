/**
 * O catálogo de preços do CONTRATO, e como ele desce para cada obra.
 *
 * ─── A PERGUNTA QUE ESTE ARQUIVO RESPONDE ─────────────────────────────────────
 * Qual é o catálogo canônico? Havia o risco real de criar um terceiro ao lado dos dois que já não
 * se falam (`PlanoFcp.precos`, que nunca vira dinheiro, e `ObraContrato.services`, que vira).
 * A resposta tem **uma direção só**:
 *
 *     CatalogoDoContrato  ──projeção pela região da obra──►  ObraContratoServico[]
 *
 * `ObraContratoServico` continua sendo o que vira dinheiro e não ganha irmão. O catálogo é a
 * FONTE de onde ele passa a ser gerado, para os contratos que têm catálogo. Contrato sem catálogo
 * (Bertioga/Santos, composição colada do Excel) não sente nada: aquelas linhas não têm
 * `servicoCatalogoId` e seguem editáveis à mão.
 *
 * ─── ⚠️ OS DOIS ERROS QUE ESTE ARQUIVO EXISTE PARA NÃO COMETER ────────────────
 * **1. Id aleatório quebraria o de-para todo mês.** `ObraContrato.deParaSiglas` mapeia sigla do
 * RDO WCR → `ObraContratoServico.id`. Se a reimportação do catálogo regerasse as linhas com
 * `crypto.randomUUID()`, todo o de-para apontaria para ids que não existem mais — em silêncio, e
 * a sigla voltaria a "não mapeada". Por isso `idDoServicoDaObra` é determinístico. É o mesmo
 * motivo pelo qual `rdoEntryId` usa semente em vez de sorteio.
 *
 * **2. O catálogo não sabe o que a obra já mediu.** `qtdAnterior`, `qtdMedidaOverride` e
 * `pctAplicado` são trabalho lançado na obra; o catálogo nunca os viu. Sobrescrevê-los na
 * reimportação apagaria medição. `mesclarProjecao` os traz de volta — é a mesma lição de
 * `camposNaoInformados` do Controle de Caixa: "a planilha não disse" ≠ "a planilha disse vazio".
 */
import type {
  CatalogoDoContrato,
  ObraContratoServico,
  PrecoRegional,
  ServicoDoCatalogo,
} from '@/types'
import { seededId } from '@/lib/seededId'
import { normalizarTexto } from '../controleDeCaixaPlanilha'

const r2 = (n: number) => Math.round(n * 100) / 100

/** A chave do documento em `app_state`. Um catálogo por contrato. */
export function chaveDoCatalogo(numeroContrato: string): string {
  const limpo = String(numeroContrato ?? '').replace(/[^0-9a-zA-Z]/g, '')
  return `catalogo-contrato:${limpo || 'sem-numero'}`
}

/**
 * O id de um serviço DENTRO do catálogo.
 *
 * ⚠️ Leva ocorrência (`#N`). A própria planilha avisa que a descrição vem truncada em 40
 * caracteres pelo SAP e que dois serviços diferentes podem cair no mesmo texto — sem o desempate,
 * o segundo sobrescreveria o primeiro e um preço sumiria sem erro nenhum.
 */
export function idDoServicoDoCatalogo(
  orgId: string | null | undefined,
  numeroContrato: string,
  servico: Pick<ServicoDoCatalogo, 'descricao' | 'unidade'>,
  ocorrencia = 0,
): string {
  return seededId(
    orgId, 'servico-catalogo',
    normalizarTexto(numeroContrato),
    normalizarTexto(servico.descricao),
    normalizarTexto(servico.unidade),
    String(ocorrencia),
  )
}

/** Numera as ocorrências de (descrição, unidade) na ordem original e devolve os ids. */
export function idsDoCatalogo(
  orgId: string | null | undefined,
  numeroContrato: string,
  servicos: Array<Pick<ServicoDoCatalogo, 'descricao' | 'unidade'>>,
): string[] {
  const vistos = new Map<string, number>()
  return servicos.map((s) => {
    const base = `${normalizarTexto(s.descricao)}|${normalizarTexto(s.unidade)}`
    const n = vistos.get(base) ?? 0
    vistos.set(base, n + 1)
    return idDoServicoDoCatalogo(orgId, numeroContrato, s, n)
  })
}

/**
 * O id da linha PROJETADA na obra. Determinístico — ver o erro nº 1 no topo do arquivo.
 * A região entra na semente porque o mesmo serviço em duas regiões é duas linhas diferentes,
 * com código e (às vezes) preço diferentes.
 */
export function idDoServicoDaObra(
  orgId: string | null | undefined,
  numeroContrato: string,
  regiao: string,
  servicoCatalogoId: string,
): string {
  return seededId(orgId, 'servico-obra', normalizarTexto(numeroContrato), regiao, servicoCatalogoId)
}

export interface PrecoResolvido {
  /** `false` quando o serviço não existe naquela região (a planilha marca com "—"). */
  disponivel: boolean
  codigo?: string
  /** Preço do contrato antes do repasse. */
  precoCheio: number
  /** O repasse aplicado (o da região, se houver; senão o do contrato). */
  fator: number
  /** `ROUND(precoCheio × fator, 2)` — a mesma conta da planilha. */
  precoComFator: number
  /** O preço veio da região, e não do serviço. É o caso de Mairiporã. */
  precoDaRegiao: boolean
}

/** Resolve código, preço e repasse de um serviço numa região. */
export function precoDoServico(
  catalogo: Pick<CatalogoDoContrato, 'fatorPadrao' | 'regioes'>,
  servico: Pick<ServicoDoCatalogo, 'precoZn' | 'porRegiao'>,
  regiao: string,
): PrecoResolvido {
  const naRegiao: PrecoRegional | undefined = servico.porRegiao?.[regiao]
  const fatorDaRegiao = catalogo.regioes.find((r) => r.codigo === regiao)?.fator
  const fator = fatorDaRegiao ?? catalogo.fatorPadrao
  if (!naRegiao) {
    return { disponivel: false, precoCheio: 0, fator, precoComFator: 0, precoDaRegiao: false }
  }
  const precoDaRegiao = naRegiao.precoOverride != null
  const precoCheio = precoDaRegiao ? naRegiao.precoOverride! : servico.precoZn
  return {
    disponivel: true,
    codigo: naRegiao.codigo,
    precoCheio,
    fator,
    precoComFator: r2(precoCheio * fator),
    precoDaRegiao,
  }
}

/**
 * O catálogo, projetado para uma obra.
 *
 * Serviço indisponível na região fica de fora — não vira linha com preço zero, que a tela leria
 * como "de graça". `valorUnitario` recebe o preço JÁ COM O REPASSE: é o que a executora recebe, e
 * é o número que a medição desta obra tem de usar.
 */
export function projetarParaObra(
  catalogo: CatalogoDoContrato,
  regiao: string,
  orgId: string | null | undefined,
): ObraContratoServico[] {
  const out: ObraContratoServico[] = []
  catalogo.servicos.forEach((s, i) => {
    const p = precoDoServico(catalogo, s, regiao)
    if (!p.disponivel) return
    out.push({
      id: idDoServicoDaObra(orgId, catalogo.numeroContrato, regiao, s.id),
      descricao: s.descricao,
      unidade: s.unidade,
      // ⚠️ `null` (não sei) vira 0 aqui porque o campo é `number`. Quem precisa distinguir
      // "não contratado" de "contratado zero" olha o catálogo, que preserva o `null`.
      qtdContrato: s.qtdContratada ?? 0,
      valorUnitario: p.precoComFator,
      ordem: i + 1,
      categoria: 'servico',
      nPreco: p.codigo,
      servicoCatalogoId: s.id,
      codigoRegional: p.codigo,
    })
  })
  return out
}

/** O que a projeção NÃO conhece e por isso nunca sobrescreve — é trabalho lançado na obra. */
const CAMPOS_DA_OBRA = ['qtdAnterior', 'qtdMedidaOverride', 'pctAplicado'] as const

export interface ResultadoDaMesclagem {
  servicos: ObraContratoServico[]
  /** Linhas cadastradas à mão, preservadas intactas. */
  manuais: number
  novas: number
  atualizadas: number
  /** Projeções que sumiram do catálogo (serviço saiu, ou a região deixou de tê-lo). */
  removidas: number
}

/**
 * Junta a projeção do catálogo com o que já está na obra.
 *
 * Regras, nesta ordem:
 *  1. linha SEM `servicoCatalogoId` é humana — passa intacta, sempre;
 *  2. linha projetada que já existia recupera os campos medidos na obra;
 *  3. projeção que sumiu do catálogo é removida (mas contada, para a tela dizer).
 */
export function mesclarProjecao(
  existentes: ObraContratoServico[],
  projetados: ObraContratoServico[],
): ResultadoDaMesclagem {
  const manuais = existentes.filter((s) => !s.servicoCatalogoId)
  const antigas = new Map(existentes.filter((s) => s.servicoCatalogoId).map((s) => [s.id, s]))

  let novas = 0
  let atualizadas = 0
  const daProjecao = projetados.map((novo) => {
    const antigo = antigas.get(novo.id)
    if (!antigo) { novas++; return novo }
    atualizadas++
    const preservado: Partial<ObraContratoServico> = {}
    for (const campo of CAMPOS_DA_OBRA) {
      if (antigo[campo] !== undefined) preservado[campo] = antigo[campo] as never
    }
    return { ...novo, ...preservado }
  })

  const idsNovos = new Set(projetados.map((s) => s.id))
  const removidas = [...antigas.keys()].filter((id) => !idsNovos.has(id)).length

  return { servicos: [...manuais, ...daProjecao], manuais: manuais.length, novas, atualizadas, removidas }
}

/** Quantos serviços do catálogo estão barrados para medição, e por quê. */
export function pendenciasDoCatalogo(catalogo: Pick<CatalogoDoContrato, 'servicos'>): {
  bloqueados: ServicoDoCatalogo[]
  porFlag: Record<string, number>
} {
  const bloqueados = catalogo.servicos.filter((s) => s.bloqueadoParaMedicao)
  const porFlag: Record<string, number> = {}
  for (const s of catalogo.servicos) {
    if (s.flag === 'ok') continue
    porFlag[s.flag] = (porFlag[s.flag] ?? 0) + 1
  }
  return { bloqueados, porFlag }
}
