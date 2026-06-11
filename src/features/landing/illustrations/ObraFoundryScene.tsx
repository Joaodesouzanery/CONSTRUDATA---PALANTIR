/**
 * ObraFoundryScene — cena isométrica line-art fiel ao estilo "value chain"
 * da Palantir Foundry, redesenhada para o universo de obras da ConstruData:
 * traço fino quase monocromático, faces brancas, elipses planas sob cada
 * elemento, placas de grade isométrica sob os clusters e fluxos pontilhados.
 *
 * variant="status"  → chips de status de campo (hero, ref. imagem 1)
 * variant="modules" → rótulos de módulo soltos estilo Foundry (ontologia)
 */

const U = 9
const STROKE = '#1b1f26'
const ACCENT = '#f97316'
const TOP = '#ffffff'
const RIGHT = '#f1f2f4'
const LEFT = '#e2e4e8'
const PAD = '#ffffff'
const GRID = 'rgba(27,31,38,0.12)'
const CONN = '#9db4c4'
const GREEN = '#22c55e'

type P = [number, number]
const iso = (x: number, y: number, z: number): P => [(x - y) * 2 * U, (x + y) * U - z * 2 * U]
const pts = (arr: P[]) => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

function Box({
  x, y, z, w, d, h,
  top = TOP, right = RIGHT, left = LEFT, sw = 1.1,
}: { x: number; y: number; z: number; w: number; d: number; h: number; top?: string; right?: string; left?: string; sw?: number }) {
  const c = (X: number, Y: number, Z: number) => iso(x + X, y + Y, z + Z)
  return (
    <g stroke={STROKE} strokeWidth={sw} strokeLinejoin="round">
      <polygon points={pts([c(0, d, 0), c(w, d, 0), c(w, d, h), c(0, d, h)])} fill={left} />
      <polygon points={pts([c(w, 0, 0), c(w, d, 0), c(w, d, h), c(w, 0, h)])} fill={right} />
      <polygon points={pts([c(0, 0, h), c(w, 0, h), c(w, d, h), c(0, d, h)])} fill={top} />
    </g>
  )
}

/** Elipse plana sob um elemento (estilo Foundry). */
function Pad({ cx, cy, rx, fill = PAD }: { cx: number; cy: number; rx: number; fill?: string }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.48} fill={fill} stroke={STROKE} strokeWidth={1} />
}

/** Placa de grade isométrica (diamante) sob um cluster. */
function GridPlate({ tx, ty, w = 13, d = 13 }: { tx: number; ty: number; w?: number; d?: number }) {
  return (
    <g transform={`translate(${tx} ${ty})`} stroke={GRID} strokeWidth={0.9}>
      {Array.from({ length: w + 1 }, (_, i) => i).map((i) => {
        const a = iso(i, 0, 0)
        const b = iso(i, d, 0)
        return <line key={`x${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      })}
      {Array.from({ length: d + 1 }, (_, j) => j).map((j) => {
        const a = iso(0, j, 0)
        const b = iso(w, j, 0)
        return <line key={`y${j}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      })}
    </g>
  )
}

/** Tanque cilíndrico em coordenadas iso (centro x,y no chão). */
function Tank({ x, y, r = 1.4, h = 1.2, open = false }: { x: number; y: number; r?: number; h?: number; open?: boolean }) {
  const top = iso(x, y, h)
  const bot = iso(x, y, 0)
  const rx = r * 2 * U
  const ry = r * U
  return (
    <g stroke={STROKE} strokeWidth={1.1}>
      <path d={`M ${bot[0] - rx} ${bot[1]} A ${rx} ${ry} 0 0 0 ${bot[0] + rx} ${bot[1]} L ${top[0] + rx} ${top[1]} L ${top[0] - rx} ${top[1]} Z`} fill={RIGHT} />
      <ellipse cx={top[0]} cy={top[1]} rx={rx} ry={ry} fill={TOP} />
      {open && <ellipse cx={top[0]} cy={top[1]} rx={rx * 0.72} ry={ry * 0.72} fill={LEFT} strokeWidth={0.9} />}
    </g>
  )
}

function Person({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={STROKE} strokeWidth={1.3} strokeLinecap="round" fill="none">
      <circle cx={0} cy={-17} r={2.9} fill={TOP} />
      <line x1={0} y1={-14} x2={0} y2={-5.5} />
      <line x1={0} y1={-5.5} x2={-3.4} y2={0} />
      <line x1={0} y1={-5.5} x2={3.4} y2={0} />
      <line x1={0} y1={-11.5} x2={-4.2} y2={-8} />
      <line x1={0} y1={-11.5} x2={4.2} y2={-8} />
    </g>
  )
}

function PeoplePad({ cx, cy, rx = 34, n = 4 }: { cx: number; cy: number; rx?: number; n?: number }) {
  const spots: P[] = [[-14, 2], [0, -4], [13, 3], [-2, 8], [18, -5], [-22, -3]]
  return (
    <g>
      <Pad cx={cx} cy={cy} rx={rx} />
      {spots.slice(0, n).map(([dx, dy], i) => (
        <Person key={i} x={cx + dx} y={cy + dy} s={0.92} />
      ))}
    </g>
  )
}

/** Tambores/insumos espalhados (adereço estilo Foundry). */
function Barrels({ tx, ty }: { tx: number; ty: number }) {
  return (
    <g transform={`translate(${tx} ${ty})`}>
      <Tank x={0} y={0} r={0.32} h={0.55} />
      <Tank x={0.75} y={0.25} r={0.32} h={0.55} />
      <Tank x={0.3} y={0.85} r={0.32} h={0.55} />
    </g>
  )
}

/* ── Elementos da cena ─────────────────────────────────────────────── */

/** Edifício em estrutura (lajes, pilares e ferragem de espera). */
function StructureBuilding() {
  const cols: P[] = []
  for (const px of [0.3, 2.3, 4.3, 6.2]) for (const py of [0.3, 2.3, 4.3, 6.2]) cols.push([px, py])
  const center = iso(3.5, 3.5, 0)
  return (
    <g>
      <Pad cx={center[0]} cy={center[1]} rx={158} />
      <Box x={0} y={0} z={0} w={7} d={7} h={0.45} />
      {cols.map(([px, py], i) => (
        <Box key={`c1-${i}`} x={px} y={py} z={0.45} w={0.42} d={0.42} h={2.1} sw={0.9} />
      ))}
      <Box x={0} y={0} z={2.55} w={7} d={7} h={0.4} />
      {cols.slice(0, 12).map(([px, py], i) => (
        <Box key={`c2-${i}`} x={px} y={py} z={2.95} w={0.42} d={0.42} h={2.1} sw={0.9} />
      ))}
      <Box x={0} y={0} z={5.05} w={7} d={4.6} h={0.4} />
      {/* ferragem de espera na laje superior */}
      <g stroke={STROKE} strokeWidth={0.9} strokeLinecap="round">
        {[[0.5, 0.5], [2.4, 0.6], [4.4, 0.5], [6.3, 0.6], [0.5, 2.4], [2.4, 2.5], [4.4, 2.4], [6.3, 2.5], [0.5, 4.2], [3.4, 4.2], [6.3, 4.2]].map(([rx2, ry2], i) => {
          const a = iso(rx2, ry2, 5.45)
          const b = iso(rx2, ry2, 6.5)
          return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
        })}
      </g>
      {/* escoramento na fachada frontal */}
      <g stroke={STROKE} strokeWidth={0.8} opacity={0.5}>
        {[1.2, 3, 4.8].map((yy) => {
          const a = iso(7, yy, 0.45)
          const b = iso(7, yy, 2.55)
          return <line key={yy} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
        })}
      </g>
      <Person x={iso(3.4, 8.6, 0)[0]} y={iso(3.4, 8.6, 0)[1]} />
      <Person x={iso(5.6, 8.9, 0)[0]} y={iso(5.6, 8.9, 0)[1]} />
    </g>
  )
}

/** Grua de torre line-art, base em (0,0). */
function TowerCrane() {
  const H = 250
  const W = 12
  const JY = -H
  const braces = [] as Array<[number, number]>
  for (let yy = -8; yy > JY + 10; yy -= 13) braces.push([yy, yy - 13])
  return (
    <g stroke={STROKE} strokeWidth={1.2} fill="none" strokeLinejoin="round" strokeLinecap="round">
      <Pad cx={0} cy={6} rx={28} />
      <Box x={-0.55} y={-0.55} z={0} w={1.1} d={1.1} h={0.5} />
      {/* mastro treliçado */}
      <line x1={-W / 2} y1={-4} x2={-W / 2} y2={JY} />
      <line x1={W / 2} y1={-4} x2={W / 2} y2={JY} />
      {braces.map(([a, b], i) => (
        <g key={i}>
          <line x1={-W / 2} y1={a} x2={W / 2} y2={b} />
          <line x1={W / 2} y1={a} x2={-W / 2} y2={b} />
        </g>
      ))}
      {/* cabine */}
      <rect x={-9} y={JY - 13} width={18} height={13} fill={TOP} />
      {/* lança (treliça triangular) e contra-lança */}
      <line x1={0} y1={JY - 13} x2={-152} y2={JY - 4} />
      <line x1={-8} y1={JY - 2} x2={-152} y2={JY - 2} />
      {[-26, -50, -74, -98, -122].map((jx) => (
        <line key={jx} x1={jx} y1={JY - 2} x2={jx - 12} y2={JY - 10.5} />
      ))}
      <line x1={8} y1={JY - 2} x2={58} y2={JY - 2} />
      <line x1={0} y1={JY - 13} x2={58} y2={JY - 8} />
      <rect x={46} y={JY - 8} width={14} height={12} fill={RIGHT} />
      {/* tirantes */}
      <line x1={0} y1={JY - 30} x2={-90} y2={JY - 4} strokeWidth={0.9} />
      <line x1={0} y1={JY - 30} x2={52} y2={JY - 8} strokeWidth={0.9} />
      <line x1={0} y1={JY - 30} x2={0} y2={JY - 13} />
      {/* carrinho + gancho + carga descendo sobre a laje */}
      <line x1={-80} y1={JY - 2} x2={-80} y2={JY + 32} strokeDasharray="2 3" strokeWidth={1} />
      <circle cx={-80} cy={JY + 35} r={2.6} fill={TOP} />
      <g transform={`translate(-80 ${JY + 38})`}>
        <Box x={-0.45} y={-0.45} z={-0.4} w={0.9} d={0.9} h={0.55} sw={0.9} />
      </g>
    </g>
  )
}

/** Estação de tratamento (galpão industrial + tanque circular). */
function TreatmentPlant() {
  const pipeA = iso(5.2, 2.2, 0.5)
  const pipeB = iso(7.6, 2.2, 0.5)
  const center = iso(3.2, 2.6, 0)
  return (
    <g>
      <Pad cx={center[0]} cy={center[1]} rx={128} />
      <Box x={0} y={0} z={0} w={5.2} d={3.1} h={2.2} />
      <Box x={0.6} y={0.85} z={2.2} w={4} d={1.4} h={0.7} />
      {/* janelas e porta na face direita */}
      <g stroke={STROKE} strokeWidth={0.8} opacity={0.7}>
        {[0.5, 1.3, 2.1].map((yy) => {
          const a = iso(5.2, yy, 1.1)
          const b = iso(5.2, yy + 0.5, 1.1)
          const c = iso(5.2, yy + 0.5, 1.7)
          const d = iso(5.2, yy, 1.7)
          return <polygon key={yy} points={pts([a, b, c, d])} fill={TOP} />
        })}
        {(() => {
          const a = iso(5.2, 2.55, 0)
          const b = iso(5.2, 2.95, 0)
          const c = iso(5.2, 2.95, 0.9)
          const d = iso(5.2, 2.55, 0.9)
          return <polygon points={pts([a, b, c, d])} fill={LEFT} />
        })()}
      </g>
      {/* chaminé/vent + tanque de processo redondo */}
      <Box x={0.4} y={0.3} z={2.9} w={0.45} d={0.45} h={0.9} sw={0.9} />
      <Tank x={2.5} y={4.8} r={1.15} h={0.85} open />
      <Tank x={6.6} y={2.2} r={0.85} h={1.5} />
      <g stroke={STROKE} strokeWidth={1.2} fill="none">
        <polyline points={`${pipeA[0]},${pipeA[1]} ${pipeB[0]},${pipeB[1]}`} strokeDasharray="1 4" strokeLinecap="round" />
      </g>
      <Person x={iso(0.6, 4.6, 0)[0]} y={iso(0.6, 4.6, 0)[1]} />
    </g>
  )
}

/** Escavadeira sobre elipse com leira de solo (terraplenagem). */
function Excavator() {
  const pivot = iso(1.9, 0.75, 1.2)
  const elbow = iso(3.2, 0.75, 2.45)
  const wrist = iso(4.35, 0.75, 0.95)
  const tip = iso(4.7, 0.75, 0.1)
  return (
    <g>
      <Pad cx={0} cy={34} rx={88} />
      <g transform="translate(-66 -12)">
        {/* esteiras */}
        <Box x={0} y={0} z={0} w={2.8} d={1.4} h={0.55} top={RIGHT} right={LEFT} left="#d3d6db" />
        <g stroke={STROKE} strokeWidth={0.8} opacity={0.55}>
          {[0.5, 1.1, 1.7, 2.3].map((tx) => {
            const a = iso(tx, 1.4, 0)
            const b = iso(tx, 1.4, 0.55)
            return <line key={tx} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
          })}
        </g>
        {/* corpo + cabine com janela */}
        <Box x={0.05} y={0.12} z={0.55} w={2.05} d={1.25} h={0.8} />
        <Box x={0.15} y={0.2} z={1.35} w={0.95} d={1.05} h={0.85} />
        <polygon
          points={pts([iso(1.1, 0.35, 1.55), iso(1.1, 1.1, 1.55), iso(1.1, 1.1, 2.05), iso(1.1, 0.35, 2.05)])}
          fill={TOP} stroke={STROKE} strokeWidth={0.8}
        />
        {/* braço articulado + caçamba */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polyline points={`${pivot[0]},${pivot[1]} ${elbow[0]},${elbow[1]} ${wrist[0]},${wrist[1]}`} stroke={RIGHT} strokeWidth={6} />
          <polyline points={`${pivot[0]},${pivot[1]} ${elbow[0]},${elbow[1]} ${wrist[0]},${wrist[1]}`} stroke={STROKE} strokeWidth={1.2} />
          <circle cx={pivot[0]} cy={pivot[1]} r={2.4} fill={TOP} stroke={STROKE} strokeWidth={1.1} />
          <circle cx={elbow[0]} cy={elbow[1]} r={2.2} fill={TOP} stroke={STROKE} strokeWidth={1.1} />
        </g>
        <polygon
          points={pts([[wrist[0] - 4, wrist[1]], [tip[0] - 2, tip[1]], [tip[0] + 12, tip[1] - 2], [wrist[0] + 8, wrist[1] - 5]])}
          fill={LEFT} stroke={STROKE} strokeWidth={1.1} strokeLinejoin="round"
        />
      </g>
      {/* leira de solo escavado */}
      <g transform="translate(34 24)">
        <path d="M -26 8 Q -16 -14 4 -12 Q 26 -9 22 6 Q 12 15 -10 13 Q -23 13 -26 8 Z" fill={RIGHT} stroke={STROKE} strokeWidth={1} />
        <path d="M -12 -6 q 6 -4 12 -1 M -2 6 q 8 -3 14 -6" fill="none" stroke={STROKE} strokeWidth={0.8} opacity={0.5} />
      </g>
      <Person x={66} y={14} s={0.9} />
    </g>
  )
}

/** Decantador circular (estação) com braço radial. */
function ClarifierTank() {
  const top = iso(0, 0, 0.75)
  const rx = 2.3 * 2 * U
  const ry = 2.3 * U
  return (
    <g>
      <Pad cx={0} cy={20} rx={76} />
      <Tank x={0} y={0} r={2.3} h={0.75} open />
      <g stroke={STROKE} strokeWidth={1.1}>
        <line x1={top[0]} y1={top[1]} x2={top[0] + rx * 0.92} y2={top[1] + ry * 0.35} />
        <circle cx={top[0]} cy={top[1]} r={3.2} fill={TOP} />
      </g>
      <Person x={-48} y={34} s={0.9} />
    </g>
  )
}

/** Caminhão basculante + estoque de tubos (suprimentos). */
function SupplyYard() {
  const wheelAt = (x: number, y: number) => iso(x, y, 0.28)
  return (
    <g>
      {/* via */}
      <polygon points={pts([iso(-1.5, 2.4, 0), iso(7.5, 2.4, 0), iso(7.5, 4.4, 0), iso(-1.5, 4.4, 0)])} fill="#f6f7f8" stroke={STROKE} strokeWidth={1} strokeLinejoin="round" />
      <polyline
        points={pts([iso(-1.1, 3.4, 0), iso(7.1, 3.4, 0)])}
        fill="none" stroke={STROKE} strokeWidth={0.9} strokeDasharray="7 7" opacity={0.4}
      />
      {/* caminhão */}
      <g transform="translate(8 -6)">
        <Box x={0.1} y={2.55} z={0.28} w={3.3} d={1.25} h={0.28} top={RIGHT} right={LEFT} left="#d3d6db" sw={0.9} />
        <Box x={0.15} y={2.55} z={0.56} w={2.3} d={1.25} h={0.85} />
        <Box x={2.55} y={2.55} z={0.56} w={0.85} d={1.25} h={1.05} />
        {[0.7, 1.8, 2.95].map((wx) => {
          const p = wheelAt(wx, 3.8)
          return <circle key={wx} cx={p[0]} cy={p[1]} r={4.6} fill="#2c313a" stroke={STROKE} strokeWidth={0.9} />
        })}
      </g>
      {/* tubos empilhados */}
      <g transform="translate(-44 16)">
        <Box x={0} y={0} z={0} w={3} d={0.4} h={0.4} sw={0.9} />
        <Box x={0} y={0.5} z={0} w={3} d={0.4} h={0.4} sw={0.9} />
        <Box x={0} y={0.25} z={0.4} w={3} d={0.4} h={0.4} sw={0.9} />
      </g>
      <Person x={-78} y={6} s={0.9} />
      <Person x={-64} y={12} s={0.9} />
    </g>
  )
}

/** Estoque de materiais (pallets) sobre elipse. */
function MaterialPallets() {
  return (
    <g>
      <Pad cx={0} cy={16} rx={58} />
      <g transform="translate(-26 -4)">
        <Box x={0} y={0} z={0} w={1.25} d={1.25} h={0.16} sw={0.9} top={RIGHT} />
        <Box x={0.06} y={0.06} z={0.16} w={1.12} d={1.12} h={0.95} sw={0.9} />
        <Box x={1.6} y={0.3} z={0} w={1.25} d={1.25} h={0.16} sw={0.9} top={RIGHT} />
        <Box x={1.66} y={0.36} z={0.16} w={1.12} d={1.12} h={0.6} sw={0.9} />
        <Box x={0.7} y={1.7} z={0} w={1.1} d={1.1} h={0.7} sw={0.9} />
      </g>
      <Person x={32} y={22} s={0.9} />
    </g>
  )
}

/** Escritório de obra (gestão) com antena de dados. */
function SiteOffice() {
  const ant = iso(0.5, 2.6, 2)
  const center = iso(1.7, 1.4, 0)
  return (
    <g>
      <Pad cx={center[0]} cy={center[1]} rx={92} />
      <Box x={0} y={0} z={0} w={3.4} d={2.8} h={2} />
      <Box x={0.5} y={0.45} z={2} w={0.75} d={0.75} h={0.4} sw={0.9} />
      <g stroke={STROKE} strokeWidth={0.8} opacity={0.7}>
        {[0.4, 1.5].map((yy) => {
          const a = iso(3.4, yy, 0.9)
          const b = iso(3.4, yy + 0.75, 0.9)
          const c = iso(3.4, yy + 0.75, 1.55)
          const d = iso(3.4, yy, 1.55)
          return <polygon key={yy} points={pts([a, b, c, d])} fill={TOP} />
        })}
      </g>
      {/* antena de dados */}
      <g transform={`translate(${ant[0]} ${ant[1]})`} stroke={STROKE} strokeWidth={1.2} fill="none" strokeLinecap="round">
        <line x1={0} y1={0} x2={0} y2={-22} />
        <circle cx={0} cy={-24} r={2.2} fill={ACCENT} stroke="none" />
        <path d="M 6 -30 a 9 9 0 0 1 0 12" className="fs-pulse" />
        <path d="M 11 -34 a 15 15 0 0 1 0 20" className="fs-pulse2" />
      </g>
    </g>
  )
}

/* ── Rótulos ───────────────────────────────────────────────────────── */

function StatusChip({ x, y, dot, text }: { x: number; y: number; dot: string; text: string }) {
  const w = text.length * 6.6 + 36
  return (
    <g transform={`translate(${x} ${y})`} style={{ pointerEvents: 'none' }}>
      <rect x={0} y={-14} width={w} height={28} rx={14} fill="#ffffff" stroke="rgba(27,31,38,0.18)" strokeWidth={1} />
      <circle cx={16} cy={0} r={4} fill={dot} />
      <text x={28} y={4} fontFamily="'Space Grotesk', sans-serif" fontSize={12} fontWeight={600} fill={STROKE}>
        {text}
      </text>
    </g>
  )
}

/** Rótulo solto estilo Foundry: título em caixa alta + tag laranja, sem caixa. */
function ModuleLabel({ x, y, title, tag, anchor = 'start' }: { x: number; y: number; title: string; tag: string; anchor?: 'start' | 'end' }) {
  return (
    <g transform={`translate(${x} ${y})`} style={{ pointerEvents: 'none' }}>
      <text
        x={0} y={0} textAnchor={anchor}
        fontFamily="'Space Grotesk', sans-serif" fontSize={11.5} fontWeight={700} letterSpacing={1.1} fill={STROKE}
        paintOrder="stroke" stroke="#ffffff" strokeWidth={4} strokeLinejoin="round"
      >
        {title.toUpperCase()}
      </text>
      <text
        x={0} y={14} textAnchor={anchor}
        fontFamily="'JetBrains Mono', monospace" fontSize={9} fontWeight={700} letterSpacing={1.2} fill={ACCENT}
        paintOrder="stroke" stroke="#ffffff" strokeWidth={3.5} strokeLinejoin="round"
      >
        {tag.toUpperCase()} ↘
      </text>
    </g>
  )
}

const statusChips: Array<{ x: number; y: number; dot: string; text: string }> = [
  { x: -240, y: -196, dot: GREEN, text: 'Estrutura · 50% executada' },
  { x: -262, y: -252, dot: ACCENT, text: 'Grua · revisão em 2 dias' },
  { x: -148, y: 6, dot: GREEN, text: 'ETE · em operação' },
  { x: 196, y: -188, dot: GREEN, text: 'Terraplenagem · 80%' },
  { x: -16, y: 232, dot: ACCENT, text: 'Suprimentos · estoque 3 dias' },
  { x: -212, y: 232, dot: '#1b1f26', text: 'Equipe · 24 em campo' },
]

const moduleLabels: Array<{ x: number; y: number; title: string; tag: string; anchor?: 'start' | 'end' }> = [
  { x: -492, y: -208, title: 'Levantamento', tag: 'BIM' },
  { x: -496, y: -82, title: 'Canteiro / Execução', tag: 'RDO' },
  { x: 56, y: -248, title: 'Gestão / Diretoria', tag: 'Gestão 360' },
  { x: 318, y: -192, title: 'Terraplenagem', tag: 'Equipamentos' },
  { x: -158, y: 10, title: 'Rede de Esgoto — ETE', tag: 'Qualidade' },
  { x: 344, y: -52, title: 'Rede de Água — ETA', tag: 'Mapa' },
  { x: 306, y: 188, title: 'Suprimentos', tag: 'Compras' },
  { x: -186, y: 236, title: 'Medição', tag: 'Avanço' },
]

/* ── Cena ──────────────────────────────────────────────────────────── */

export function ObraFoundryScene({
  className = '',
  variant = 'status',
}: {
  className?: string
  variant?: 'status' | 'modules'
}) {
  return (
    <svg
      viewBox="-520 -285 1040 580"
      className={className}
      role="img"
      aria-label="Cena isométrica de uma obra conectada: estrutura em execução, grua, estação de tratamento, terraplenagem, suprimentos e equipe ligados por fluxos de dados"
      style={{ width: '100%', height: 'auto', overflow: 'visible' }}
    >
      <style>{`
        .fs-pulse { animation: fsPulse 2.6s ease-in-out infinite; }
        .fs-pulse2 { animation: fsPulse 2.6s ease-in-out 0.9s infinite; }
        .fs-pulse3 { animation: fsPulse 2.6s ease-in-out 1.8s infinite; }
        @keyframes fsPulse { 0%,100% { opacity:.3 } 50% { opacity:1 } }
        @media (prefers-reduced-motion: reduce){ .fs-pulse,.fs-pulse2,.fs-pulse3{ animation:none; opacity:.8 } }
      `}</style>

      {/* placas de grade isométrica sob os clusters (estilo Foundry) */}
      <GridPlate tx={-300} ty={-10} w={14} d={13} />
      <GridPlate tx={250} ty={-72} w={12} d={13} />

      {/* fluxos de dados entre ilhas (pontilhados finos) */}
      <g fill="none" stroke={CONN} strokeWidth={1.6} strokeDasharray="0.1 6" strokeLinecap="round">
        <path d="M -250 86 C -190 116, -140 60, -64 36" />
        <path d="M 56 -34 C 120 -70, 168 -86, 212 -76" />
        <path d="M 96 14 C 188 48, 286 38, 344 28" />
        <path d="M -16 52 C -40 86, -70 106, -96 122" />
        <path d="M -168 158 C -224 176, -268 172, -306 166" />
        <path d="M 74 56 C 140 96, 186 116, 222 132" />
        <path d="M -210 96 C -200 70, -190 52, -182 40" />
      </g>
      <circle className="fs-pulse" cx={-117} cy={58} r={3.4} fill={ACCENT} />
      <circle className="fs-pulse2" cx={140} cy={-76} r={3.4} fill={ACCENT} />
      <circle className="fs-pulse3" cx={222} cy={40} r={3.4} fill={ACCENT} />
      <circle className="fs-pulse" cx={152} cy={102} r={3.4} fill={ACCENT} />

      {/* ilhas (ordem de profundidade: fundo → frente) */}
      <g transform="translate(252 -98)"><Excavator /></g>
      <g transform="translate(396 -10)"><ClarifierTank /></g>
      <g transform="translate(-178 116)"><TowerCrane /></g>
      <g transform="translate(-330 -42)"><StructureBuilding /></g>
      <g transform="translate(-22 -54)"><TreatmentPlant /></g>
      <g transform="translate(-352 138)"><MaterialPallets /></g>
      <g transform="translate(252 128)"><SupplyYard /></g>
      <g transform="translate(-120 116)"><SiteOffice /></g>
      <Barrels tx={66} ty={66} />
      <PeoplePad cx={-188} cy={196} n={5} />
      <PeoplePad cx={36} cy={196} rx={28} n={3} />

      {/* rótulos */}
      {variant === 'status'
        ? statusChips.map((chip) => <StatusChip key={chip.text} {...chip} />)
        : moduleLabels.map((label) => <ModuleLabel key={label.title} {...label} />)}
    </svg>
  )
}
