/**
 * sugestaoHoraExtraRdo.ts — o RDO de fim de semana SUGERE hora extra. Nunca lança.
 *
 * ─── A REGRA, E POR QUE ELA É ASSIM ───────────────────────────────────────────
 * Quando um RDO registra presença num dia que `ehDiaUtil` recusa — domingo, sábado fora da
 * jornada, feriado cadastrado — a empresa quase sempre vai pagar hora extra àquelas pessoas. Mas
 * "quase sempre" não é "sempre": tem reposição de dia, tem banco de horas, tem quem só passou na
 * obra. Lançar sozinho criaria despesa que ninguém autorizou, e o projeto já decidiu duas vezes
 * que dinheiro só entra por gesto explícito ("custo automático só pelo RDO; o resto é botão").
 *
 * Então isto aqui devolve uma LISTA DE SUGESTÕES, e quem confere decide. O id de cada sugestão é o
 * id determinístico que a hora extra teria (`idDaHoraExtra`) — três consequências de graça:
 * reabrir e re-finalizar o RDO não gera sugestão nova, o que já foi lançado some da lista sozinho,
 * e confirmar duas vezes escreve a mesma linha.
 *
 * ⚠️ `valorSugerido` pode ser `null` — cargo sem diária cadastrada e pessoa sem override. `null`
 * significa "não sei", e a tela pede o número. Nunca vira 0, que significaria "não paga".
 */
import type { Cargo, HoraExtra, PlanHoliday, RDO, WorkWeekMode, Worker } from '@/types'
import { ehDiaUtil } from '@/lib/diasUteis'
import { diariaSugerida } from './cargosPadrao'
import { chaveDaPessoa, idDaHoraExtra } from './horaExtraCalculo'
import { matchWorkerByName } from './custoMaoObra'

export interface SugestaoDeHoraExtra {
  /** O id que a hora extra terá se for confirmada — determinístico. */
  id: string
  rdoId: string
  rdoNumero: number
  data: string
  /** 'domingo' | 'sábado fora da jornada' | 'feriado' — o motivo vindo de `ehDiaUtil`. */
  razao: string
  obraId?: string
  workerId?: string
  workerNome: string
  cargo?: string
  /** `null` = nada configurado. A tela pede o número; não assume zero. */
  valorSugerido: number | null
  /** De onde veio o número: ajuda quem confere a saber se pode confiar. */
  base: 'override do funcionário' | 'cargo cadastrado' | 'sem valor configurado'
  /** `true` quando o nome do RDO não casou com nenhum cadastro — a linha entra sem vínculo. */
  semCadastro: boolean
}

interface Entrada {
  rdos: RDO[]
  workers: Worker[]
  cargos: Cargo[]
  horasExtras: HoraExtra[]
  feriados: PlanHoliday[]
  jornada: WorkWeekMode
  /** Limita a varredura: 'yyyy-MM'. Sem isso a lista cresceria para sempre. */
  mes?: string
}

export function sugestoesDeHoraExtra(e: Entrada): SugestaoDeHoraExtra[] {
  const datasFeriado = new Set(e.feriados.map((f) => f.date))
  const jaLancadas = new Set(e.horasExtras.map((h) => h.id))
  const out: SugestaoDeHoraExtra[] = []

  for (const rdo of e.rdos) {
    // Rascunho não sugere nada: o dia ainda pode mudar, e a lista de presença também.
    if (rdo.status === 'rascunho') continue
    if (e.mes && !rdo.date.startsWith(e.mes)) continue

    const dia = ehDiaUtil(rdo.date, datasFeriado, e.jornada)
    if (dia.util) continue

    const pagaComoDomingo = dia.razao !== 'sábado fora da jornada'
    const presentes = pessoasDoRdo(rdo)

    for (const p of presentes) {
      const worker = p.workerId
        ? e.workers.find((w) => w.id === p.workerId)
        : matchWorkerByName(p.nome, e.workers) ?? undefined
      const id = idDaHoraExtra(
        chaveDaPessoa({ workerId: worker?.id ?? p.workerId, workerNome: p.nome }),
        rdo.date,
        'fim-de-semana',
      )
      if (jaLancadas.has(id)) continue

      const override = pagaComoDomingo ? worker?.heDomingoOverride : worker?.heSabadoOverride
      const valorSugerido = diariaSugerida(worker, e.cargos, pagaComoDomingo)
      out.push({
        id,
        rdoId: rdo.id,
        rdoNumero: rdo.number,
        data: rdo.date,
        razao: dia.razao ?? 'fora da jornada',
        obraId: rdo.siteId ?? undefined,
        workerId: worker?.id ?? p.workerId,
        workerNome: worker?.name ?? p.nome,
        cargo: worker?.role ?? p.funcao,
        valorSugerido,
        base: typeof override === 'number'
          ? 'override do funcionário'
          : valorSugerido === null ? 'sem valor configurado' : 'cargo cadastrado',
        semCadastro: !worker,
      })
    }
  }

  return out.sort((a, b) => a.data.localeCompare(b.data) || a.workerNome.localeCompare(b.workerNome, 'pt-BR'))
}

/**
 * Quem estava na obra, de qualquer template.
 *
 * A presença do WCR é a mais rica (traz `workerId` desde este ciclo); os outros templates só têm
 * `manpower.employeeNames`, e aí o vínculo sai do casamento por nome — que pode não achar, e por
 * isso a sugestão diz `semCadastro`.
 */
function pessoasDoRdo(rdo: RDO): Array<{ nome: string; funcao?: string; workerId?: string }> {
  const daPresenca = (rdo.wcr?.presencas ?? []).flatMap((p) => p.pessoas)
  if (daPresenca.length) {
    // A mesma pessoa em duas listas conta uma vez — mesma regra de `manpowerDaPresenca`.
    const vistos = new Set<string>()
    return daPresenca.flatMap((p) => {
      const k = (p.workerId ?? p.nome).toLowerCase().trim()
      if (vistos.has(k)) return []
      vistos.add(k)
      return [{ nome: p.nome, funcao: p.funcao, workerId: p.workerId }]
    })
  }
  return (rdo.manpower?.employeeNames ?? []).map((nome) => ({ nome }))
}

/** A sugestão confirmada vira hora extra — ainda NÃO paga. Pagar é outro gesto. */
export function horaExtraDaSugestao(s: SugestaoDeHoraExtra, valor: number, agora: string): HoraExtra {
  return {
    id: s.id,
    workerId: s.workerId,
    workerNome: s.workerNome,
    cargo: s.cargo,
    data: s.data,
    tipo: 'fim-de-semana',
    valor,
    obraId: s.obraId,
    pago: false,
    origem: 'rdo',
    createdAt: agora,
  }
}
