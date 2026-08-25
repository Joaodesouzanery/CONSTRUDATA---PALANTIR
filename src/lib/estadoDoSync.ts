/**
 * Em que estado o indicador de sincronização deve estar.
 *
 * Função pura, separada da tela, por dois motivos: dá para testar, e a regra é sutil demais para
 * ficar num ternário aninhado dentro do JSX — que foi exatamente como ela nasceu errada.
 *
 * ─── O QUE ESTAVA ERRADO ──────────────────────────────────────────────────────
 * A regra inteira era `syncing || pending > 0` → "Enviando para a nuvem…". Isso colapsava três
 * situações muito diferentes num único estado, e o cliente viu o resultado: o ícone girando
 * indefinidamente, com o texto dizendo "não precisa fazer nada".
 *
 *  - **em voo**: há requisição acontecendo agora — girar faz sentido;
 *  - **esperando**: a última tentativa não passou e a próxima está agendada (pode ser em 30
 *    minutos) — girar mente sobre o que está acontecendo;
 *  - **estacionada**: a alteração foi feita com OUTRA empresa ativa e só sobe quando você voltar
 *    para ela. Não vai a lugar nenhum enquanto isso — girar mente duas vezes.
 */
export interface ResumoParaIndicador {
  pending: number
  syncing: boolean
  esperando: number
  estacionadas: number
}

export type EstadoDoSync =
  | 'tudo-salvo'
  | 'enviando'
  | 'esperando'
  | 'estacionado'
  | 'precisa-atencao'

export function estadoDoSync(r: ResumoParaIndicador, bloqueadas: number): EstadoDoSync {
  // O que pede decisão humana vem primeiro: é a única coisa que não se resolve sozinha.
  if (bloqueadas > 0) return 'precisa-atencao'

  // Op estacionada não conta como coisa a caminho — ela está deliberadamente parada.
  const emMovimento = Math.max(0, r.pending - r.estacionadas)

  if (emMovimento === 0) return r.estacionadas > 0 ? 'estacionado' : 'tudo-salvo'
  if (r.syncing) return 'enviando'
  // Tudo que sobrou está aguardando horário: dizer "enviando" seria mentira.
  return r.esperando >= emMovimento ? 'esperando' : 'enviando'
}

/** O ícone deve girar? Só quando há de fato requisição em voo. */
export function deveGirar(estado: EstadoDoSync): boolean {
  return estado === 'enviando'
}
