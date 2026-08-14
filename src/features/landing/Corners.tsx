/**
 * Corners — cantoneiras de 8px nos 4 cantos de um card (motivo de frame técnico da landing).
 * O pai precisa ser `relative`.
 *
 * Vive em arquivo próprio porque é usado pela LandingPage e pelo TypeformPanel, que a
 * LandingPage importa: mantê-lo lá dentro criaria um ciclo de import entre os dois — e um
 * ciclo aqui é arriscado, porque a landing é pré-renderizada em Node no build.
 */
export function Corners() {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute left-0 top-0 size-2 border-l border-t border-black/30" />
      <span aria-hidden className="pointer-events-none absolute right-0 top-0 size-2 border-r border-t border-black/30" />
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-0 size-2 border-b border-l border-black/30" />
      <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 size-2 border-b border-r border-black/30" />
    </>
  )
}
