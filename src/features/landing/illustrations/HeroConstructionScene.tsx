/**
 * HeroConstructionScene — ilustração isométrica line-art (releitura da referência
 * "Connected Workspaces" para o universo de obras): um canteiro em construção
 * conectado, via uma base operacional na nuvem, a um escritório de gestão.
 * Desenhada em SVG (escalável, leve, temável). Tema claro/creme.
 */

const U = 13
const STROKE = '#20251f'
const ACCENT = '#f97316'
const TOP = '#fbf9f4'
const RIGHT = '#efe9dd'
const LEFT = '#e5ddcc'

type P = [number, number]
const iso = (x: number, y: number, z: number): P => [(x - y) * 2 * U, (x + y) * U - z * 2 * U]
const pts = (arr: P[]) => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

function Box({
  x, y, z, w, d, h,
  top = TOP, right = RIGHT, left = LEFT, sw = 1.6,
}: { x: number; y: number; z: number; w: number; d: number; h: number; top?: string; right?: string; left?: string; sw?: number }) {
  const c = (X: number, Y: number, Z: number) => iso(x + X, y + Y, z + Z)
  const topF: P[] = [c(0, 0, h), c(w, 0, h), c(w, d, h), c(0, d, h)]
  const rightF: P[] = [c(w, 0, 0), c(w, d, 0), c(w, d, h), c(w, 0, h)]
  const leftF: P[] = [c(0, d, 0), c(w, d, 0), c(w, d, h), c(0, d, h)]
  return (
    <g stroke={STROKE} strokeWidth={sw} strokeLinejoin="round">
      <polygon points={pts(leftF)} fill={left} />
      <polygon points={pts(rightF)} fill={right} />
      <polygon points={pts(topF)} fill={top} />
    </g>
  )
}

/** Tile/plot (flat rhombus on the ground). */
function Plot({ x, y, w, d, fill = '#f3eee2' }: { x: number; y: number; w: number; d: number; fill?: string }) {
  const p: P[] = [iso(x, y, 0), iso(x + w, y, 0), iso(x + w, y + d, 0), iso(x, y + d, 0)]
  return <polygon points={pts(p)} fill={fill} stroke={STROKE} strokeWidth={1.2} strokeLinejoin="round" />
}

function Tree({ x, y }: { x: number; y: number }) {
  const base = iso(x, y, 0)
  const top = iso(x, y, 2.4)
  return (
    <g stroke={STROKE} strokeWidth={1.4} strokeLinejoin="round">
      <line x1={base[0]} y1={base[1]} x2={top[0]} y2={top[1]} />
      <circle cx={top[0]} cy={top[1] - 6} r={11} fill="#e7e0d0" />
    </g>
  )
}

function Person({ x, y, z = 0 }: { x: number; y: number; z?: number }) {
  const [cx, cy] = iso(x, y, z)
  return (
    <g stroke={STROKE} strokeWidth={1.4} strokeLinecap="round" fill="none">
      <circle cx={cx} cy={cy - 22} r={3.4} fill="#efe9dd" />
      <line x1={cx} y1={cy - 18} x2={cx} y2={cy - 7} />
      <line x1={cx} y1={cy - 7} x2={cx - 4} y2={cy} />
      <line x1={cx} y1={cy - 7} x2={cx + 4} y2={cy} />
      <line x1={cx} y1={cy - 15} x2={cx - 5} y2={cy - 11} />
      <line x1={cx} y1={cy - 15} x2={cx + 5} y2={cy - 11} />
    </g>
  )
}

export function HeroConstructionScene({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="-470 -210 940 470"
      className={className}
      role="img"
      aria-label="Canteiro de obra conectado a um escritório de gestão por uma base operacional na nuvem"
      style={{ width: '100%', height: 'auto', overflow: 'visible' }}
    >
      <style>{`
        .cd-pulse { animation: cdPulse 2.6s ease-in-out infinite; }
        .cd-pulse2 { animation: cdPulse 2.6s ease-in-out 0.9s infinite; }
        .cd-pulse3 { animation: cdPulse 2.6s ease-in-out 1.8s infinite; }
        @keyframes cdPulse { 0%,100% { opacity:.35 } 50% { opacity:1 } }
        @media (prefers-reduced-motion: reduce){ .cd-pulse,.cd-pulse2,.cd-pulse3{ animation:none; opacity:.85 } }
      `}</style>

      {/* ── LEFT: canteiro em construção ───────────────────────────── */}
      <g transform="translate(-300 40)">
        <Plot x={-1} y={-1} w={9} d={9} />
        {/* laje base */}
        <Box x={0} y={0} z={0} w={7} d={7} h={0.5} />
        {/* pilares */}
        {[[0.4, 0.4], [6, 0.4], [0.4, 6], [6, 6], [3.2, 0.4], [0.4, 3.2], [6, 3.2], [3.2, 6]].map(([px, py], i) => (
          <Box key={i} x={px} y={py} z={0.5} w={0.5} d={0.5} h={4.2} right="#e7e0d0" left="#ddd4c0" />
        ))}
        {/* laje intermediária + superior (em execução) */}
        <Box x={0} y={0} z={2.4} w={7} d={4.6} h={0.4} />
        <Box x={0} y={0} z={4.7} w={4.4} d={7} h={0.4} />
        {/* guindaste (line-art) */}
        <g stroke={STROKE} strokeWidth="1.8" fill="none" strokeLinejoin="round" strokeLinecap="round">
          {(() => {
            const baseB = iso(7.5, 7.5, 0); const mastT = iso(7.5, 7.5, 11)
            const jibA = iso(7.5, 7.5, 10.2); const jibEnd = iso(-2, 7.5, 10.2)
            const cnt = iso(7.5, 7.5, 10.2); const cntEnd = iso(12, 7.5, 10.2)
            const hookTop = iso(0.5, 7.5, 10.2); const hookBot = iso(0.5, 7.5, 6.2)
            return (
              <>
                <line x1={baseB[0]} y1={baseB[1]} x2={mastT[0]} y2={mastT[1]} />
                <line x1={baseB[0] + 6} y1={baseB[1]} x2={mastT[0] + 6} y2={mastT[1]} />
                <line x1={jibA[0]} y1={jibA[1]} x2={jibEnd[0]} y2={jibEnd[1]} />
                <line x1={cnt[0]} y1={cnt[1]} x2={cntEnd[0]} y2={cntEnd[1]} />
                <line x1={hookTop[0]} y1={hookTop[1]} x2={hookBot[0]} y2={hookBot[1]} strokeDasharray="2 3" />
                <circle cx={hookBot[0]} cy={hookBot[1]} r={3} fill={TOP} />
              </>
            )
          })()}
        </g>
        {/* manhole / saneamento */}
        <ellipse cx={iso(8.4, 4, 0)[0]} cy={iso(8.4, 4, 0)[1]} rx={9} ry={4.5} fill="#e7e0d0" stroke={STROKE} strokeWidth={1.3} />
        <Person x={3} y={9.2} />
        <Tree x={-1.5} y={8.5} />
      </g>

      {/* ── CENTER: base operacional / nuvem ───────────────────────── */}
      <g>
        {/* linha conectando (tracejada, ondulada) */}
        <path
          d="M -250 70 C -170 10, -120 110, -30 50 S 150 10, 250 78"
          fill="none" stroke={STROKE} strokeWidth={1.8} strokeDasharray="2 6" strokeLinecap="round" opacity={0.8}
        />
        <circle className="cd-pulse" cx={-150} cy={47} r={4.5} fill={ACCENT} />
        <circle className="cd-pulse2" cx={-30} cy={50} r={4.5} fill={ACCENT} />
        <circle className="cd-pulse3" cx={130} cy={47} r={4.5} fill={ACCENT} />
        {/* nuvem */}
        <g transform="translate(0 -30)">
          <g fill={TOP} stroke={STROKE} strokeWidth={1.8} strokeLinejoin="round">
            <path d="M -52 6 a 18 18 0 0 1 14 -30 a 24 24 0 0 1 46 4 a 17 17 0 0 1 16 26 z" />
          </g>
          <circle className="cd-pulse" cx={-14} cy={-4} r={3} fill={ACCENT} />
          <circle className="cd-pulse2" cx={2} cy={2} r={3} fill={ACCENT} />
          <circle className="cd-pulse3" cx={16} cy={-6} r={3} fill={ACCENT} />
          <text x={-2} y={34} textAnchor="middle" fontFamily="'Space Grotesk', sans-serif" fontSize="12" fontWeight="600" fill={STROKE}>Base Operacional</text>
        </g>
      </g>

      {/* ── RIGHT: escritório de gestão ────────────────────────────── */}
      <g transform="translate(210 30)">
        <Plot x={-1} y={-1} w={9} d={9} />
        <Box x={0} y={0} z={0} w={6.5} d={6.5} h={5.5} />
        {/* janelas: linhas na face direita (x = 6.5) */}
        <g stroke={STROKE} strokeWidth={0.9} opacity={0.5}>
          {[1.3, 2.9, 4.5].map((zz) => {
            const a = iso(6.5, 0.6, zz); const b = iso(6.5, 5.9, zz)
            return <line key={`h${zz}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
          })}
          {[1.6, 3.2, 4.8].map((yy) => {
            const a = iso(6.5, yy, 0.6); const b = iso(6.5, yy, 5.2)
            return <line key={`v${yy}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
          })}
        </g>
        {/* tela/billboard com gráfico de barras */}
        {(() => {
          const o = iso(3.2, -0.2, 6)
          return (
            <g transform={`translate(${o[0]} ${o[1]})`}>
              <rect x={-26} y={-34} width={52} height={30} rx={3} fill={TOP} stroke={STROKE} strokeWidth={1.5} />
              <line x1={-20} y1={-10} x2={20} y2={-10} stroke={STROKE} strokeWidth={1} />
              <rect x={-16} y={-18} width={6} height={8} fill={ACCENT} />
              <rect x={-6} y={-23} width={6} height={13} fill="#cbb89c" />
              <rect x={4} y={-15} width={6} height={5} fill="#cbb89c" />
              <rect x={14} y={-26} width={6} height={16} fill={ACCENT} />
            </g>
          )
        })()}
        {/* antena / wifi */}
        {(() => {
          const a = iso(0.6, 6, 5.5)
          return (
            <g transform={`translate(${a[0]} ${a[1]})`} stroke={STROKE} strokeWidth={1.6} fill="none" strokeLinecap="round">
              <line x1={0} y1={0} x2={0} y2={-20} />
              <circle cx={0} cy={-22} r={2.4} fill={ACCENT} stroke="none" />
              <path d="M 6 -28 a 9 9 0 0 1 0 12" className="cd-pulse" />
              <path d="M 11 -32 a 15 15 0 0 1 0 20" className="cd-pulse2" />
            </g>
          )
        })()}
        <Person x={2.5} y={8.4} />
        <Person x={4.6} y={8.9} />
        <Tree x={8.8} y={7} />
      </g>
    </svg>
  )
}
