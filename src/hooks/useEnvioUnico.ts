import { useRef } from 'react'

/**
 * Trava o segundo envio de um formulário que só pode acontecer uma vez.
 *
 * POR QUE UM REF, E NÃO ESTADO. Os modais financeiros gravam e chamam `onClose()` no mesmo
 * handler, então parece que o duplo-clique já está resolvido pelo desmonte. Não está: o React
 * agrupa as atualizações, e dois cliques dentro do mesmo quadro disparam os dois handlers antes
 * de qualquer re-render. Um `useState` teria o mesmo problema — o valor lido no segundo clique
 * ainda seria o antigo. O ref muda na hora, no primeiro clique, e o segundo já lê travado.
 *
 * ISTO É A SEGUNDA LINHA DE DEFESA, não a primeira. A primeira é o id determinístico
 * (`src/lib/seededId.ts`), que resolve o caso de verdade — o mesmo fato lançado em dois
 * dispositivos. O ref só cobre o acidente local do duplo-clique, e some quando o componente
 * desmonta. Onde há dinheiro envolvido, os dois precisam existir.
 *
 * Uso:
 *   const travar = useEnvioUnico()
 *   function handleSubmit(e) { e.preventDefault(); if (!travar()) return; ... }
 */
export function useEnvioUnico(): () => boolean {
  const enviado = useRef(false)
  return () => {
    if (enviado.current) return false
    enviado.current = true
    return true
  }
}
