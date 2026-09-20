/**
 * As fases padrão do piso industrial — o catálogo de onde toda obra nasce.
 *
 * ─── DE ONDE VEIO ─────────────────────────────────────────────────────────────
 * Oito destas já existiam no projeto, como `ACTIVITY_STAGES` dentro de `NovoRdoPanel.tsx` — com
 * unidade e peso de medição somando 100%, prontas e usadas só no template "padrão" do RDO. Foram
 * trazidas para cá e reconciliadas com a lista que o cliente passou em 20/09/2026:
 *
 *  · **entrou** "Tratamento de Juntas, Trincas e Checklist para Primer", que a lista antiga não
 *    tinha e que na prática antecede o primer;
 *  · **saiu do padrão** o Polimento — continua disponível em `FASE_POLIMENTO` para a obra que o
 *    faça, porque tirá-lo de vez obrigaria a recadastrar.
 *
 * ⚠️ **As fases NÃO são todas do mesmo dia, nem todo dia.** Elas são a produção inteira, em ordem,
 * ao longo de semanas ou meses: um metro quadrado entra no lixamento e sai na pintura. O RDO do dia
 * mostra só as que andaram naquele dia — não oito linhas com zero.
 *
 * ⚠️ **E não são todas da mesma unidade.** Do lixamento à pintura é m² de piso; a demarcação é
 * METRO LINEAR; números, sinalização de incêndio e afins são unidade. Somar as três dá um número
 * que não é área, nem comprimento, nem contagem — é o 25.567,02 que `lib/unidadesMedida.ts`
 * existe para impedir.
 */

/** Uma fase do processo, como ela nasce no catálogo da obra. */
export interface FasePadrao {
  nome: string
  unidade: 'm²' | 'm' | 'un'
  /** Fatia do preço do piso pronto que esta fase representa. As do padrão somam 100. */
  pesoPct: number
  /** Materiais típicos — usados para sugerir consumo, nunca para lançar sozinho. */
  materiais: string[]
}

/**
 * As oito da Compizzo, na ordem de execução.
 *
 * Os pesos saíram do `ACTIVITY_STAGES` original e foram redistribuídos com a entrada das juntas e
 * a saída do polimento. Somam 100 — e há teste garantindo isso, porque peso que não fecha faz o
 * avanço financeiro mentir sem avisar.
 */
export const FASES_PADRAO: readonly FasePadrao[] = [
  { nome: 'Lixamento de Piso de Concreto',                     unidade: 'm²', pesoPct: 15.5, materiais: ['Disco diamantado', 'Disco fibra', 'Lixa ferro'] },
  { nome: 'Tratamento de Juntas, Trincas e Checklist p/ Primer', unidade: 'm²', pesoPct: 8,    materiais: ['Selante de junta', 'Massa epóxi', 'Disco de corte'] },
  { nome: 'Primer 1ª demão',                                   unidade: 'm²', pesoPct: 10,   materiais: ['Primer', 'Rolo 9cm', 'Pincel'] },
  { nome: 'Primer 2ª demão',                                   unidade: 'm²', pesoPct: 10,   materiais: ['Primer', 'Rolo 9cm', 'Pincel'] },
  { nome: 'Raspadinha',                                        unidade: 'm²', pesoPct: 10,   materiais: ['Disco fibra', 'Lixa ferro'] },
  { nome: 'Pintura',                                           unidade: 'm²', pesoPct: 15.5, materiais: ['Epóxi', 'Concrecor', 'Rolo 9cm'] },
  { nome: 'Demarcação — Fita Crepe',                           unidade: 'm',  pesoPct: 15.5, materiais: ['Fita crepe', 'Trena'] },
  { nome: 'Pintura de Demarcações, Números e Incêndio',        unidade: 'un', pesoPct: 15.5, materiais: ['Tinta de demarcação', 'Pincel', 'Estêncil'] },
]

/**
 * O Polimento, que saiu do padrão mas continua à mão.
 *
 * ⚠️ Acrescentá-lo **não** reequilibra os pesos sozinho: quem o incluir precisa redistribuir, e a
 * tela acusa enquanto a soma não fechar 100%. Isso é deliberado — decidir por conta própria de
 * quem tirar o peso seria inventar um número que muda quanto a obra fatura.
 */
export const FASE_POLIMENTO: FasePadrao = {
  nome: 'Polimento', unidade: 'm²', pesoPct: 8, materiais: ['Disco fibra', 'Panos'],
}

export const TOTAL_DOS_PESOS = 100
