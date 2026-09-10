/**
 * De que item do contrato cada sigla do apontamento WCR fala.
 *
 * ─── POR QUE ISTO EXISTE, DEPOIS DE TANTO TEMPO ───────────────────────────────
 * `ObraContrato.deParaSiglas` (sigla → `ObraContratoServico.id`) é escrito e lido **num arquivo
 * só** — `AbaDeParaWcr.tsx` — para pintar a própria tela. Não havia nenhuma função no repositório
 * que respondesse "sigla + obra → serviço". O mapa era um cadastro que ninguém consultava: a tela
 * avisava "faltam N siglas" para um efeito que não existia.
 *
 * ⚠️ **Resolve na LEITURA, e nada é gravado no RDO.** `RdoWcrProducaoRow.contractServiceId` segue
 * vazio de propósito: gravar o vínculo congelaria o mapeamento do dia da gravação, e corrigir o
 * de-para depois não consertaria o passado. Resolvendo na hora, trocar o mapa corrige o histórico
 * inteiro sozinho.
 *
 * ⚠️ **E isto NÃO liga a produção do WCR à medição.** `obraMedicao.ts` continua filtrando
 * `template === 'compizzo'`. Ligar exige decidir antes quem é a fonte da verdade da medição da WCR
 * — a planilha do contrato ou o RDO —, porque as duas descrevem a mesma execução física e a
 * planilha já grava Entrada no Financeiro. Ver `docs/ARMADILHAS_CONHECIDAS.md`.
 */
import type { ObraContrato, ObraContratoServico, RDO } from '@/types'
import { classificarUnidade } from '@/lib/unidadesMedida'
import { SIGLAS_WCR, type SiglaWcr } from './apontamentoWcr'

/** O item de contrato de uma sigla, ou `undefined` quando ninguém mapeou. */
export function servicoDaSigla(
  sigla: string,
  contrato: Pick<ObraContrato, 'deParaSiglas' | 'services'> | null | undefined,
): ObraContratoServico | undefined {
  const id = contrato?.deParaSiglas?.[sigla]
  if (!id) return undefined
  return (contrato?.services ?? []).find((s) => s.id === id)
}

// ─── A validação de unidade ───────────────────────────────────────────────────

export type MotivoDaDivergencia = 'metro-em-unidade' | 'unidade-em-metro' | 'item-em-verba'

export interface DivergenciaDeUnidade {
  sigla: string
  /** 'M' | 'UN' — a unidade que a sigla mede. */
  unidadeDaSigla: SiglaWcr['unidade']
  servico: ObraContratoServico
  motivo: MotivoDaDivergencia
  /** O texto que a tela mostra. Explica a consequência, não só o fato. */
  explicacao: string
}

/**
 * ⚠️ A ARMADILHA QUE ISTO FECHA, e ela é cara.
 *
 * O `<select>` do de-para lista **todos** os itens do contrato, sem filtro, e imprime a unidade da
 * sigla e a do item lado a lado na mesma linha — sem nada comparar as duas. E `precoEfetivo ×
 * quantidade` multiplica sem olhar unidade (`obraMedicao.ts:68`, `:100`).
 *
 * Consequência medida com item real deste cliente: `PRA` (rede de água, METRO) mapeada no item
 * "Poço de visita pré-moldado D=1000mm", que é R$ 3.250,00 por UNIDADE. Um dia de 120 m de rede
 * vira **R$ 390.000**. Nada no código impede, e nada avisa.
 *
 * Isto **reporta, não bloqueia**: pode haver caso legítimo (item cadastrado com unidade solta), e
 * travar a tela por causa de texto livre de unidade seria pior que avisar.
 */
export function conferirDeParaSiglas(
  contrato: Pick<ObraContrato, 'deParaSiglas' | 'services'> | null | undefined,
): DivergenciaDeUnidade[] {
  const out: DivergenciaDeUnidade[] = []
  for (const s of SIGLAS_WCR) {
    const servico = servicoDaSigla(s.sigla, contrato)
    if (!servico) continue
    const tipo = classificarUnidade(servico.unidade)

    if (tipo === 'verba') {
      out.push({
        sigla: s.sigla, unidadeDaSigla: s.unidade, servico, motivo: 'item-em-verba',
        explicacao: `"${servico.descricao}" é cobrado por verba, e verba não se mede por quantidade. Multiplicar ${s.sigla} por ele daria um valor sem significado.`,
      })
      continue
    }
    if (s.unidade === 'M' && tipo !== 'linear') {
      out.push({
        sigla: s.sigla, unidadeDaSigla: s.unidade, servico, motivo: 'metro-em-unidade',
        explicacao: `${s.sigla} é medida em METRO e "${servico.descricao}" é cobrado por ${servico.unidade || 'unidade'}. Um dia de 120 m viraria 120 × o preço unitário — ordens de grandeza acima do real.`,
      })
      continue
    }
    if (s.unidade === 'UN' && tipo === 'linear') {
      out.push({
        sigla: s.sigla, unidadeDaSigla: s.unidade, servico, motivo: 'unidade-em-metro',
        explicacao: `${s.sigla} é contagem (unidade) e "${servico.descricao}" é cobrado por metro. O valor sairia subestimado, e ninguém perceberia.`,
      })
    }
  }
  return out
}

// ─── A prévia, só leitura ─────────────────────────────────────────────────────

export interface LinhaDaPrevia {
  sigla: string
  rotulo: string
  unidade: SiglaWcr['unidade']
  quantidade: number
  servico?: ObraContratoServico
  /** `quantidade × precoEfetivo`. Zero quando a sigla não está mapeada. */
  valor: number
  /** `true` quando há quantidade lançada e ninguém mapeou a sigla — é o que falta fazer. */
  semMapa: boolean
  /** `true` quando a unidade do item não combina com a da sigla. Ver `conferirDeParaSiglas`. */
  divergente: boolean
}

export interface PreviaDoDePara {
  linhas: LinhaDaPrevia[]
  /** Só o que está mapeado E sem divergência de unidade. */
  valorTotal: number
  /** Quantas siglas têm produção lançada e continuam sem item de contrato. */
  siglasSemMapa: number
  /** Quantos RDOs entraram na conta. */
  rdos: number
}

const precoEfetivoDoServico = (s: ObraContratoServico): number =>
  (s.valorUnitario || 0) * ((s.pctAplicado ?? 100) / 100)

/**
 * O que o de-para de hoje produziria sobre a produção WCR já lançada nesta obra.
 *
 * ⚠️ **Não lança nada, em lugar nenhum.** É prova de que o mapeamento funciona, para quem está
 * preenchendo a tela ver o efeito antes de o efeito existir. O número não vai para medição, nem
 * para o Financeiro, nem para o FCP.
 *
 * ⚠️ Lê **só** `wcr.producao`, nunca `wcr.apontamentos[].producao`: as duas guardam a MESMA
 * produção (a segunda é o detalhe por equipe da primeira), e iterar as duas conta em dobro dentro
 * de um único RDO. Ver `docs/ARMADILHAS_CONHECIDAS.md`.
 */
export function previaDoDePara(
  rdos: RDO[],
  siteId: string,
  contrato: Pick<ObraContrato, 'deParaSiglas' | 'services'> | null | undefined,
): PreviaDoDePara {
  const divergentes = new Set(conferirDeParaSiglas(contrato).map((d) => d.sigla))
  const doWcr = rdos.filter(
    (r) => r.siteId === siteId && r.template === 'wcr' && !!r.wcr && r.status !== 'rascunho',
  )

  const somado = new Map<string, number>()
  for (const r of doWcr) {
    for (const p of r.wcr?.producao ?? []) {
      const q = Number(String(p.quantidade ?? '').trim().replace(',', '.'))
      if (!Number.isFinite(q) || q <= 0) continue      // vazio é não informado, não zero
      somado.set(p.sigla, (somado.get(p.sigla) ?? 0) + q)
    }
  }

  const linhas: LinhaDaPrevia[] = SIGLAS_WCR
    .map((s) => {
      const quantidade = somado.get(s.sigla) ?? 0
      const servico = servicoDaSigla(s.sigla, contrato)
      const divergente = divergentes.has(s.sigla)
      return {
        sigla: s.sigla, rotulo: s.rotulo, unidade: s.unidade, quantidade, servico,
        // Divergência de unidade NÃO vira dinheiro nem na prévia — mostrar o número seria
        // convidar a pessoa a confiar nele.
        valor: servico && !divergente ? Math.round(quantidade * precoEfetivoDoServico(servico) * 100) / 100 : 0,
        semMapa: quantidade > 0 && !servico,
        divergente,
      }
    })
    .filter((l) => l.quantidade > 0)

  return {
    linhas: linhas.sort((a, b) => b.valor - a.valor),
    valorTotal: Math.round(linhas.reduce((s, l) => s + l.valor, 0) * 100) / 100,
    siglasSemMapa: linhas.filter((l) => l.semMapa).length,
    rdos: doWcr.length,
  }
}
