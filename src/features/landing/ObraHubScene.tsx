/**
 * ObraHubScene — ilustração animada da hero (estilo hub-and-spoke claro):
 * uma base operacional central conectada a seis frentes da obra (RDO,
 * Medição, Planejamento, Suprimentos, Qualidade e Gestão 360) sobre tiles
 * isométricos suaves, com fluxos de dados percorrendo as conexões.
 * SVG puro (leve, escalável); animações pausam em prefers-reduced-motion.
 */

const STROKE = '#c9ccc6'
const TILE_TOP = '#ffffff'
const TILE_SIDE = '#dddfd9'
const ACCENT = '#f97316'
const GREEN = '#22c55e'
const INK = '#3a3f38'
const MUTED = '#8a8f86'
const MONO = "'IBM Plex Mono', monospace"

type Glyph = 'doc' | 'bars' | 'gantt' | 'cubes' | 'shield' | 'chart'

const NODES: Array<{ x: number; y: number; label: string; glyph: Glyph; dot: string; delay: string }> = [
  { x: 150, y: 112, label: 'RDO', glyph: 'doc', dot: ACCENT, delay: '-3.6s' },
  { x: 490, y: 112, label: 'Gestão 360', glyph: 'chart', dot: GREEN, delay: '-2.9s' },
  { x: 84, y: 268, label: 'Medição', glyph: 'bars', dot: GREEN, delay: '-2.2s' },
  { x: 556, y: 268, label: 'Planejamento', glyph: 'gantt', dot: ACCENT, delay: '-1.5s' },
  { x: 168, y: 412, label: 'Qualidade', glyph: 'shield', dot: GREEN, delay: '-0.8s' },
  { x: 472, y: 412, label: 'Suprimentos', glyph: 'cubes', dot: ACCENT, delay: '-0.1s' },
]

const HUB = { x: 320, y: 262 }

/** Tile isométrico suave (diamante com extrusão). */
function Tile({ size = 56 }: { size?: number }) {
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

/** Mini-painel em pé sobre o tile, com conteúdo por módulo. */
function Panel({ glyph }: { glyph: Glyph }) {
  return (
    <g transform="translate(0 -46)">
      <rect x={-34} y={-26} width={68} height={52} rx={8} fill="#ffffff" stroke={STROKE} strokeWidth={1.2} />
      {glyph === 'doc' && (
        <g>
          <rect x={-24} y={-16} width={32} height={4} rx={2} fill="#e3e5e0" />
          <rect x={-24} y={-7} width={44} height={4} rx={2} fill="#e3e5e0" />
          <rect x={-24} y={2} width={38} height={4} rx={2} fill="#e3e5e0" />
          <circle cx={20} cy={-14} r={7} fill={ACCENT} opacity={0.15} />
          <path d="M 16.5 -14 l 2.4 2.4 l 4.6 -4.8" stroke={ACCENT} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x={-24} y={11} width={20} height={4} rx={2} fill={ACCENT} opacity={0.5} />
        </g>
      )}
      {glyph === 'bars' && (
        <g>
          <rect x={-22} y={2} width={9} height={14} rx={2} fill="#e3e5e0" />
          <rect x={-8} y={-8} width={9} height={24} rx={2} fill={GREEN} opacity={0.65} />
          <rect x={6} y={-16} width={9} height={32} rx={2} fill={ACCENT} opacity={0.75} />
          <line x1={-26} y1={18} x2={24} y2={18} stroke="#d4d6d0" strokeWidth={1.5} strokeLinecap="round" />
        </g>
      )}
      {glyph === 'gantt' && (
        <g>
          <rect x={-26} y={-16} width={26} height={6} rx={3} fill={ACCENT} opacity={0.7} />
          <rect x={-16} y={-6} width={34} height={6} rx={3} fill="#e3e5e0" />
          <rect x={-6} y={4} width={30} height={6} rx={3} fill={GREEN} opacity={0.65} />
          <line x1={-10} y1={-20} x2={-10} y2={16} stroke="#d4d6d0" strokeWidth={1.2} strokeDasharray="3 3" />
        </g>
      )}
      {glyph === 'shield' && (
        <g>
          <path d="M 0 -17 l 13 5 v 9 c 0 8 -6 14 -13 17 c -7 -3 -13 -9 -13 -17 v -9 z" fill={GREEN} opacity={0.14} stroke={GREEN} strokeWidth={1.6} strokeLinejoin="round" />
          <path d="M -5.5 -1 l 4 4 l 8 -8.5" stroke={GREEN} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {glyph === 'chart' && (
        <g>
          <polyline points="-24,12 -10,2 2,7 22,-12" fill="none" stroke={ACCENT} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={22} cy={-12} r={3.4} fill={ACCENT} />
          <line x1={-26} y1={16} x2={24} y2={16} stroke="#d4d6d0" strokeWidth={1.5} strokeLinecap="round" />
        </g>
      )}
      {glyph === 'cubes' && (
        <g transform="translate(0 2)">
          {[[-10, 0], [10, 0], [0, -12]].map(([cx, cy], i) => (
            <g key={i} transform={`translate(${cx} ${cy})`}>
              <polygon points="0,-6 9,-1.5 9,7 0,11.5 -9,7 -9,-1.5" fill="#ffffff" stroke={STROKE} strokeWidth={1.2} strokeLinejoin="round" />
              <polyline points="-9,-1.5 0,3 9,-1.5 M 0,3 0,11.5" fill="none" stroke={STROKE} strokeWidth={1.2} strokeLinejoin="round" />
              <polygon points="0,-6 9,-1.5 0,3 -9,-1.5" fill={i === 2 ? '#ffedd5' : '#f4f4f2'} stroke={STROKE} strokeWidth={1.2} strokeLinejoin="round" />
            </g>
          ))}
        </g>
      )}
    </g>
  )
}

export function ObraHubScene({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 520"
      className={className}
      role="img"
      aria-label="Base operacional central conectada aos módulos da obra: RDO, Medição, Planejamento, Suprimentos, Qualidade e Gestão 360"
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
            <Panel glyph={n.glyph} />
            <circle cx={30} cy={14} r={4} fill={n.dot} stroke="#ffffff" strokeWidth={1.5} />
          </g>
          <text y={52} textAnchor="middle" fontFamily={MONO} fontSize={10.5} fontWeight={600} letterSpacing={1.4} fill={MUTED}>
            {n.label.toUpperCase()}
          </text>
        </g>
      ))}

      {/* hub central — base operacional */}
      <g transform={`translate(${HUB.x} ${HUB.y})`}>
        <g className="oh-float" style={{ animationDelay: '0.2s' }}>
          <Tile size={68} />
          {/* pedestal */}
          <ellipse cx={0} cy={-8} rx={42} ry={17} fill={TILE_SIDE} />
          <ellipse cx={0} cy={-14} rx={42} ry={17} fill="#ffffff" stroke={STROKE} strokeWidth={1.2} />
          <ellipse cx={0} cy={-14} rx={28} ry={11} fill="#f4f4f2" stroke={STROKE} strokeWidth={1} />
          {/* núcleo */}
          <circle className="oh-ring" cx={0} cy={-42} r={26} fill="none" stroke={ACCENT} strokeWidth={1.5} />
          <circle className="oh-core" cx={0} cy={-42} r={20} fill="url(#ohCoreGrad)" />
          <path d="M 0 -52 c 5 7 8 11 8 15.5 a 8 8 0 1 1 -16 0 c 0 -4.5 3 -8.5 8 -15.5 z" fill="#ffffff" opacity={0.92} />
        </g>
        <text y={64} textAnchor="middle" fontFamily={MONO} fontSize={11} fontWeight={700} letterSpacing={1.6} fill={INK}>
          BASE OPERACIONAL
        </text>
      </g>
    </svg>
  )
}
