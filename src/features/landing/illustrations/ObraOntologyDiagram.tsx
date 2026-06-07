/**
 * ObraOntologyDiagram — diagrama isométrico de "cadeia de valor" da obra
 * (releitura do estilo Palantir Foundry para construção/saneamento): nós da
 * operação (canteiro, água, esgoto, suprimentos, medição, gestão) conectados a
 * uma Base Operacional central. Line-art SVG, fundo claro com grade tênue.
 */

const U = 12
const STROKE = '#20251f'
const ACCENT = '#f97316'
const TOP = '#fbf9f4'
const RIGHT = '#efe9dd'
const LEFT = '#e5ddcc'
const GRID = 'rgba(32,37,31,0.10)'

type P = [number, number]
const iso = (x: number, y: number, z: number): P => [(x - y) * 2 * U, (x + y) * U - z * 2 * U]
const pts = (arr: P[]) => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

function Box({ x, y, z, w, d, h, top = TOP, right = RIGHT, left = LEFT }: { x: number; y: number; z: number; w: number; d: number; h: number; top?: string; right?: string; left?: string }) {
  const c = (X: number, Y: number, Z: number) => iso(x + X, y + Y, z + Z)
  return (
    <g stroke={STROKE} strokeWidth={1.5} strokeLinejoin="round">
      <polygon points={pts([c(0, d, 0), c(w, d, 0), c(w, d, h), c(0, d, h)])} fill={left} />
      <polygon points={pts([c(w, 0, 0), c(w, d, 0), c(w, d, h), c(w, 0, h)])} fill={right} />
      <polygon points={pts([c(0, 0, h), c(w, 0, h), c(w, d, h), c(0, d, h)])} fill={top} />
    </g>
  )
}

function Tank({ x, y, r = 2, h = 3 }: { x: number; y: number; r?: number; h?: number }) {
  const top = iso(x, y, h); const bot = iso(x, y, 0)
  const rx = r * 2 * U, ry = r * U
  return (
    <g stroke={STROKE} strokeWidth={1.5} fill={TOP}>
      <line x1={top[0] - rx} y1={top[1]} x2={bot[0] - rx} y2={bot[1]} />
      <line x1={top[0] + rx} y1={top[1]} x2={bot[0] + rx} y2={bot[1]} />
      <path d={`M ${top[0] - rx} ${top[1]} A ${rx} ${ry} 0 0 0 ${top[0] + rx} ${top[1]} A ${rx} ${ry} 0 0 0 ${top[0] - rx} ${top[1]}`} fill={RIGHT} />
      <ellipse cx={top[0]} cy={top[1]} rx={rx} ry={ry} fill={TOP} />
    </g>
  )
}

const NODES: Array<{ x: number; y: number; label: string; tag: string; kind: 'building' | 'water' | 'sewer' | 'supply' | 'measure' | 'office' }> = [
  { x: -8, y: -8, label: 'Canteiro / Obra', tag: 'RDO', kind: 'building' },
  { x: -11, y: 1, label: 'Rede de Água', tag: 'Mapa', kind: 'water' },
  { x: -6, y: 8, label: 'Rede de Esgoto', tag: 'Qualidade', kind: 'sewer' },
  { x: 3, y: 10, label: 'Suprimentos', tag: 'Compras', kind: 'supply' },
  { x: 10, y: 2, label: 'Medição', tag: 'Avanço', kind: 'measure' },
  { x: 7, y: -7, label: 'Gestão / Diretoria', tag: 'Gestão 360', kind: 'office' },
]

function NodeShape({ x, y, kind }: { x: number; y: number; kind: string }) {
  switch (kind) {
    case 'water':
      return <Tank x={x + 1.5} y={y + 1.5} r={1.6} h={3.4} />
    case 'sewer':
      return (
        <>
          <Tank x={x + 1} y={y + 1.6} r={1.3} h={1.6} />
          <Tank x={x + 2.6} y={y + 0.6} r={1.3} h={1.6} />
        </>
      )
    case 'supply':
      return (
        <>
          <Box x={x} y={y} z={0} w={3.4} d={3} h={2.2} />
          <Box x={x + 3.6} y={y + 1.4} z={0} w={1.1} d={1.1} h={1.1} right="#e7e0d0" left="#ddd4c0" />
        </>
      )
    case 'measure':
      return (
        <>
          <Box x={x} y={y} z={0} w={0.6} d={3} h={0.3} />
          <Box x={x} y={y} z={0.3} w={2.6} d={3} h={2.4} />
        </>
      )
    case 'office':
      return <Box x={x} y={y} z={0} w={3.4} d={3.4} h={3} />
    default: // building (under construction)
      return (
        <>
          <Box x={x} y={y} z={0} w={3.4} d={3.4} h={0.4} />
          {[[0.2, 0.2], [2.9, 0.2], [0.2, 2.9], [2.9, 2.9]].map(([px, py], i) => (
            <Box key={i} x={x + px} y={y + py} z={0.4} w={0.4} d={0.4} h={2.6} right="#e7e0d0" left="#ddd4c0" />
          ))}
          <Box x={x} y={y} z={1.6} w={3.4} d={2} h={0.3} />
        </>
      )
  }
}

export function ObraOntologyDiagram({ className = '' }: { className?: string }) {
  const hub = iso(0, 0, 2)
  return (
    <svg
      viewBox="-440 -250 880 500"
      className={className}
      role="img"
      aria-label="Diagrama: canteiro, água, esgoto, suprimentos, medição e gestão conectados a uma base operacional central"
      style={{ width: '100%', height: 'auto', overflow: 'visible' }}
    >
      <style>{`
        .od-pulse{animation:odp 2.8s ease-in-out infinite}
        @keyframes odp{0%,100%{opacity:.4}50%{opacity:1}}
        @media (prefers-reduced-motion: reduce){.od-pulse{animation:none;opacity:.85}}
      `}</style>

      {/* grade isométrica tênue */}
      <g stroke={GRID} strokeWidth={1}>
        {Array.from({ length: 19 }, (_, i) => i - 9).map((g) => {
          const a = iso(g, -9, 0); const b = iso(g, 9, 0)
          const c = iso(-9, g, 0); const d = iso(9, g, 0)
          return (
            <g key={g}>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
              <line x1={c[0]} y1={c[1]} x2={d[0]} y2={d[1]} />
            </g>
          )
        })}
      </g>

      {/* conexões hub ↔ nós (tracejadas) com nó de dado laranja no meio */}
      <g>
        {NODES.map((n) => {
          const np = iso(n.x + 1.5, n.y + 1.5, 1)
          const mid: P = [(hub[0] + np[0]) / 2, (hub[1] + np[1]) / 2]
          return (
            <g key={`l-${n.label}`}>
              <line x1={hub[0]} y1={hub[1]} x2={np[0]} y2={np[1]} stroke={STROKE} strokeWidth={1.5} strokeDasharray="2 6" opacity={0.7} />
              <circle className="od-pulse" cx={mid[0]} cy={mid[1]} r={3.4} fill={ACCENT} />
            </g>
          )
        })}
      </g>

      {/* nós */}
      {NODES.map((n) => {
        const lbl = iso(n.x + 1.5, n.y + 1.5, 0)
        return (
          <g key={n.label}>
            <NodeShape x={n.x} y={n.y} kind={n.kind} />
            <text x={lbl[0]} y={lbl[1] + 26} textAnchor="middle" fontFamily="'Space Grotesk', sans-serif" fontSize="12.5" fontWeight="600" fill={STROKE}>{n.label}</text>
            <text x={lbl[0]} y={lbl[1] + 40} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="9.5" fontWeight="700" letterSpacing="1" fill={ACCENT}>{n.tag.toUpperCase()} ↘</text>
          </g>
        )
      })}

      {/* HUB central — Base Operacional */}
      <g>
        <Box x={-2} y={-2} z={0} w={4} d={4} h={2} top="#ffffff" right="#f0c79a" left="#e9b682" />
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy], i) => {
          const p = iso(dx, dy, 2)
          return <circle key={i} className="od-pulse" cx={p[0]} cy={p[1]} r={2.6} fill={ACCENT} />
        })}
        <text x={hub[0]} y={hub[1] - 26} textAnchor="middle" fontFamily="'Space Grotesk', sans-serif" fontSize="14" fontWeight="700" fill={STROKE}>Base Operacional</text>
        <text x={hub[0]} y={hub[1] - 12} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="9" fontWeight="700" letterSpacing="1.5" fill={ACCENT}>ONTOLOGIA DA CONSTRUÇÃO</text>
      </g>
    </svg>
  )
}
