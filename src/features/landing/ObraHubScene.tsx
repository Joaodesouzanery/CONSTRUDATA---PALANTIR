/**
 * ObraHubScene — ilustração animada da hero (hub-and-spoke claro, ref. LOQO),
 * com vinhetas de construção sobre cada tile: estrutura em execução com
 * grua (RDO), escritório de obra (Gestão 360), tripé de topografia (Medição),
 * grua de torre (Planejamento), capacete (Qualidade) e caminhão basculante
 * (Suprimentos) — todos conectados à base operacional central por fluxos
 * de dados. SVG puro; animações pausam em prefers-reduced-motion.
 */

const STROKE = '#c2c5bf'
const TILE_TOP = '#ffffff'
const TILE_SIDE = '#dddfd9'
const BOX_RIGHT = '#eef0ec'
const BOX_LEFT = '#e1e3de'
const ACCENT = '#f97316'
const ACCENT_SOFT = '#ffedd5'
const GREEN = '#22c55e'
const INK = '#3a3f38'
const MUTED = '#8a8f86'
const MONO = "'IBM Plex Mono', monospace"

const U = 12
type P = [number, number]
const iso = (x: number, y: number, z: number): P => [(x - y) * U, (x + y) * U * 0.55 - z * U]
const pts = (arr: P[]) => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

type Glyph = 'canteiro' | 'office' | 'survey' | 'crane' | 'helmet' | 'truck'

const NODES: Array<{ x: number; y: number; label: string; glyph: Glyph; dot: string; delay: string }> = [
  { x: 150, y: 112, label: 'RDO', glyph: 'canteiro', dot: ACCENT, delay: '-3.6s' },
  { x: 492, y: 112, label: 'Gestão 360', glyph: 'office', dot: GREEN, delay: '-2.9s' },
  { x: 84, y: 272, label: 'Medição', glyph: 'survey', dot: GREEN, delay: '-2.2s' },
  { x: 556, y: 272, label: 'Planejamento', glyph: 'crane', dot: ACCENT, delay: '-1.5s' },
  { x: 168, y: 422, label: 'Qualidade', glyph: 'helmet', dot: GREEN, delay: '-0.8s' },
  { x: 472, y: 422, label: 'Suprimentos', glyph: 'truck', dot: ACCENT, delay: '-0.1s' },
]

const HUB = { x: 320, y: 268 }

/** Caixa isométrica suave (estilo soft-3D claro). */
function SoftBox({
  x, y, z, w, d, h,
  top = TILE_TOP, right = BOX_RIGHT, left = BOX_LEFT, sw = 1.1,
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

/** Tile isométrico suave (diamante com extrusão). */
function Tile({ size = 60 }: { size?: number }) {
  return (
    <>
      <g transform="translate(0 12) scale(1 0.55) rotate(45)">
        <rect x={-size} y={-size} width={size * 2} height={size * 2} rx={16} fill={TILE_SIDE} />
      </g>
      <g transform="scale(1 0.55) rotate(45)">
        <rect x={-size} y={-size} width={size * 2} height={size * 2} rx={16} fill={TILE_TOP} stroke={STROKE} strokeWidth={1.2} />
      </g>
    </>
  )
}

/** Chip de dado flutuante (linhas + dot colorido). */
function DataChip({ x, y, dot }: { x: number; y: number; dot: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-19} y={-13} width={38} height={26} rx={6} fill="#ffffff" stroke={STROKE} strokeWidth={1} />
      <rect x={-12} y={-6} width={17} height={3.2} rx={1.6} fill="#e3e5e0" />
      <rect x={-12} y={1} width={23} height={3.2} rx={1.6} fill="#e3e5e0" />
      <circle cx={9} cy={-5} r={3.2} fill={dot} opacity={0.85} />
    </g>
  )
}

/** Vinhetas de construção por módulo, desenhadas sobre o tile. */
function Vignette({ glyph, dot }: { glyph: Glyph; dot: string }) {
  switch (glyph) {
    case 'canteiro': {
      // estrutura em execução: laje, pilares, laje superior e ferragem
      const cols: P[] = [[0.1, 0.1], [1.75, 0.1], [0.1, 1.75], [1.75, 1.75]]
      return (
        <g transform="translate(2 12)">
          <SoftBox x={-1.1} y={-1.1} z={0} w={2.2} d={2.2} h={0.18} />
          {cols.map(([px, py], i) => (
            <SoftBox key={i} x={px - 1.1} y={py - 1.1} z={0.18} w={0.22} d={0.22} h={1.15} sw={0.9} />
          ))}
          <SoftBox x={-1.1} y={-1.1} z={1.33} w={2.2} d={1.5} h={0.16} />
          <g stroke={STROKE} strokeWidth={0.9} strokeLinecap="round">
            {[[-0.9, -0.9], [0, -0.95], [0.9, -0.9]].map(([rx, ry], i) => {
              const a = iso(rx, ry, 1.49)
              const b = iso(rx, ry, 2.05)
              return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
            })}
          </g>
          <DataChip x={34} y={-46} dot={dot} />
        </g>
      )
    }
    case 'office': {
      // escritório de obra com janelas e antena de dados
      const ant = iso(-0.7, 0.8, 1.7)
      return (
        <g transform="translate(0 12)">
          <SoftBox x={-1} y={-0.9} z={0} w={1.9} d={1.7} h={1.7} />
          <g stroke={STROKE} strokeWidth={0.8} opacity={0.8}>
            {[0.35, 1.05].map((zz) => {
              const a = iso(0.9, -0.7, zz + 0.35)
              const b = iso(0.9, 0.5, zz + 0.35)
              const c = iso(0.9, 0.5, zz)
              const d = iso(0.9, -0.7, zz)
              return <polygon key={zz} points={pts([a, b, c, d])} fill="#f7f8f5" />
            })}
          </g>
          <g transform={`translate(${ant[0]} ${ant[1]})`} stroke={STROKE} strokeWidth={1.1} fill="none" strokeLinecap="round">
            <line x1={0} y1={0} x2={0} y2={-16} />
            <circle cx={0} cy={-18} r={2.2} fill={ACCENT} stroke="none" />
            <path d="M 5 -23 a 7 7 0 0 1 0 10" opacity={0.7} />
          </g>
          <DataChip x={36} y={-34} dot={dot} />
        </g>
      )
    }
    case 'survey': {
      // tripé de topografia + régua/trena sobre o tile
      return (
        <g transform="translate(0 14)">
          <g stroke={STROKE} strokeWidth={1.4} strokeLinecap="round" fill="none">
            <line x1={-2} y1={-26} x2={-15} y2={6} />
            <line x1={-2} y1={-26} x2={11} y2={4} />
            <line x1={-2} y1={-26} x2={-1} y2={9} />
          </g>
          <rect x={-9} y={-34} width={14} height={9} rx={2.5} fill={ACCENT_SOFT} stroke={STROKE} strokeWidth={1.1} />
          <circle cx={-11} cy={-29.5} r={2.6} fill="#ffffff" stroke={STROKE} strokeWidth={1.1} />
          {/* régua com marcações */}
          <g transform="translate(14 6)">
            <polygon points={pts([iso(0, 0, 0), iso(2.2, 0, 0), iso(2.2, 0.5, 0), iso(0, 0.5, 0)])} fill="#ffffff" stroke={STROKE} strokeWidth={1} />
            {[0.4, 0.9, 1.4, 1.9].map((tx) => {
              const a = iso(tx, 0, 0)
              const b = iso(tx, 0.28, 0)
              return <line key={tx} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ACCENT} strokeWidth={1.2} />
            })}
          </g>
          <DataChip x={-36} y={-42} dot={dot} />
        </g>
      )
    }
    case 'crane': {
      // grua de torre com carga
      return (
        <g transform="translate(-4 16)">
          <SoftBox x={-0.4} y={-0.4} z={0} w={0.8} d={0.8} h={0.3} sw={0.9} />
          <g stroke={STROKE} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <line x1={-4} y1={-2} x2={-4} y2={-52} />
            <line x1={4} y1={-2} x2={4} y2={-52} />
            {[-12, -24, -36, -48].map((yy) => (
              <g key={yy}>
                <line x1={-4} y1={yy + 10} x2={4} y2={yy} />
                <line x1={4} y1={yy + 10} x2={-4} y2={yy} />
              </g>
            ))}
            {/* lança e contra-lança */}
            <line x1={-4} y1={-52} x2={40} y2={-49} />
            <line x1={4} y1={-52} x2={-22} y2={-50} />
            <line x1={0} y1={-60} x2={28} y2={-50} strokeWidth={0.9} />
            <line x1={0} y1={-60} x2={-18} y2={-50} strokeWidth={0.9} />
            <line x1={0} y1={-60} x2={0} y2={-52} />
            <rect x={-20} y={-50} width={7} height={6} fill={BOX_RIGHT} strokeWidth={1} />
            {/* cabo + gancho com carga */}
            <line x1={30} y1={-49} x2={30} y2={-22} strokeDasharray="2 3" strokeWidth={1} />
          </g>
          <g transform="translate(30 -16)">
            <SoftBox x={-0.35} y={-0.35} z={0} w={0.7} d={0.7} h={0.5} sw={0.9} top={ACCENT_SOFT} />
          </g>
          <DataChip x={-34} y={-44} dot={dot} />
        </g>
      )
    }
    case 'helmet': {
      // capacete de obra laranja + check de conformidade
      return (
        <g transform="translate(0 6)">
          <ellipse cx={0} cy={8} rx={24} ry={7} fill="#eceee9" stroke={STROKE} strokeWidth={1} />
          <path
            d="M -17 6 C -17 -8 -9 -16 0 -16 C 9 -16 17 -8 17 6 Z"
            fill={ACCENT} stroke="#ea580c" strokeWidth={1}
          />
          <path d="M -5 -15.5 C -5 -18 5 -18 5 -15.5 L 5 -10 L -5 -10 Z" fill="#fb923c" stroke="#ea580c" strokeWidth={0.9} />
          <ellipse cx={0} cy={6} rx={21} ry={4.6} fill="#fb923c" stroke="#ea580c" strokeWidth={1} />
          <circle cx={22} cy={-14} r={8.5} fill="#ffffff" stroke={GREEN} strokeWidth={1.4} />
          <path d="M 18 -14 l 3 3 l 5.5 -6" stroke={GREEN} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <DataChip x={-34} y={-32} dot={dot} />
        </g>
      )
    }
    case 'truck': {
      // caminhão basculante + caixas de material
      return (
        <g transform="translate(-2 10)">
          <SoftBox x={-1.5} y={-0.5} z={0.34} w={1.7} d={1} h={0.62} top={ACCENT_SOFT} />
          <SoftBox x={0.3} y={-0.5} z={0.34} w={0.66} d={1} h={0.85} />
          {[[-1.05, 0.6], [-0.15, 0.62], [0.7, 0.64]].map(([wx, wy], i) => {
            const p = iso(wx, wy, 0.18)
            return <circle key={i} cx={p[0]} cy={p[1]} r={3.6} fill="#4a4f47" stroke="#3a3f38" strokeWidth={0.8} />
          })}
          <g transform="translate(26 4)">
            <SoftBox x={0} y={0} z={0} w={0.62} d={0.62} h={0.55} sw={0.9} />
            <SoftBox x={0.7} y={0.25} z={0} w={0.55} d={0.55} h={0.45} sw={0.9} top={ACCENT_SOFT} />
          </g>
          <DataChip x={-36} y={-38} dot={dot} />
        </g>
      )
    }
  }
}

export function ObraHubScene({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 530"
      className={className}
      role="img"
      aria-label="Base operacional central conectada às frentes da obra: RDO, Medição, Planejamento, Suprimentos, Qualidade e Gestão 360"
      style={{ width: '100%', height: 'auto' }}
    >
      <style>{`
        .oh-float { animation: ohFloat 6s ease-in-out infinite; }
        .oh-ring { animation: ohRing 3.2s ease-out infinite; transform-origin: center; transform-box: fill-box; }
        .oh-core { animation: ohCore 3.2s ease-in-out infinite; }
        @keyframes ohFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @keyframes ohRing { 0% { transform: scale(0.6); opacity: 0.55; } 100% { transform: scale(1.5); opacity: 0; } }
        @keyframes ohCore { 0%,100% { opacity: 0.85; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .oh-float, .oh-ring, .oh-core { animation: none !important; }
          .oh-dots { display: none; }
        }
      `}</style>

      <defs>
        <radialGradient id="ohCoreGrad" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="55%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ea580c" />
        </radialGradient>
      </defs>

      {/* conexões hub ↔ módulos (tracejadas) */}
      <g fill="none" stroke="#d8dad4" strokeWidth={1.6} strokeDasharray="1 7" strokeLinecap="round">
        {NODES.map((n) => (
          <path key={n.label} d={`M ${HUB.x} ${HUB.y} L ${n.x} ${n.y}`} />
        ))}
      </g>

      {/* pulsos de dado viajando nas conexões */}
      <g className="oh-dots">
        {NODES.map((n) => (
          <circle key={n.label} r={3.4} fill={n.dot}>
            <animateMotion dur="3.6s" begin={n.delay} repeatCount="indefinite" path={`M ${HUB.x} ${HUB.y} L ${n.x} ${n.y}`} />
          </circle>
        ))}
      </g>

      {/* módulos */}
      {NODES.map((n, i) => (
        <g key={n.label} transform={`translate(${n.x} ${n.y})`}>
          <g className="oh-float" style={{ animationDelay: `${i * 0.45}s` }}>
            <Tile />
            <Vignette glyph={n.glyph} dot={n.dot} />
          </g>
          <text y={56} textAnchor="middle" fontFamily={MONO} fontSize={10.5} fontWeight={600} letterSpacing={1.4} fill={MUTED}>
            {n.label.toUpperCase()}
          </text>
        </g>
      ))}

      {/* hub central — base operacional */}
      <g transform={`translate(${HUB.x} ${HUB.y})`}>
        <g className="oh-float" style={{ animationDelay: '0.2s' }}>
          <Tile size={70} />
          {/* pedestal */}
          <ellipse cx={0} cy={-6} rx={42} ry={17} fill={TILE_SIDE} />
          <ellipse cx={0} cy={-12} rx={42} ry={17} fill="#ffffff" stroke={STROKE} strokeWidth={1.2} />
          <ellipse cx={0} cy={-12} rx={28} ry={11} fill="#f4f4f2" stroke={STROKE} strokeWidth={1} />
          {/* núcleo */}
          <circle className="oh-ring" cx={0} cy={-40} r={26} fill="none" stroke={ACCENT} strokeWidth={1.5} />
          <circle className="oh-core" cx={0} cy={-40} r={20} fill="url(#ohCoreGrad)" />
          <path d="M 0 -50 c 5 7 8 11 8 15.5 a 8 8 0 1 1 -16 0 c 0 -4.5 3 -8.5 8 -15.5 z" fill="#ffffff" opacity={0.92} />
        </g>
        <text y={66} textAnchor="middle" fontFamily={MONO} fontSize={11} fontWeight={700} letterSpacing={1.6} fill={INK}>
          BASE OPERACIONAL
        </text>
      </g>
    </svg>
  )
}
