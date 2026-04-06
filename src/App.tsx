import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell }          from '@/components/shared/AppShell'
import { LandingPage }       from '@/features/landing/LandingPage'
import { lazy, Suspense } from 'react'

// ─── Lazy-loaded modules (code-split per route) ──────────────────────────────

const Relatorio360Page      = lazy(() => import('@/features/relatorio360/index').then((m) => ({ default: m.Relatorio360Page })))
const AgendaPage            = lazy(() => import('@/features/agenda/index').then((m) => ({ default: m.AgendaPage })))
const ProjetosPage          = lazy(() => import('@/features/projetos/index').then((m) => ({ default: m.ProjetosPage })))
const TorreDeControlePage   = lazy(() => import('@/features/torre-de-controle/index').then((m) => ({ default: m.TorreDeControlePage })))
const GestaoEquipamentosPage = lazy(() => import('@/features/gestao-equipamentos/index').then((m) => ({ default: m.GestaoEquipamentosPage })))
const PreConstrucaoPage     = lazy(() => import('@/features/pre-construcao/index').then((m) => ({ default: m.PreConstrucaoPage })))
const SuprimentosPage       = lazy(() => import('@/features/suprimentos/index').then((m) => ({ default: m.SuprimentosPage })))
const MaoDeObraPage         = lazy(() => import('@/features/mao-de-obra/index').then((m) => ({ default: m.MaoDeObraPage })))
const OtimizacaoFrotaPage   = lazy(() => import('@/features/otimizacao-frota/index').then((m) => ({ default: m.default })))
const Gestao360Page         = lazy(() => import('@/features/gestao-360/index').then((m) => ({ default: m.Gestao360Page })))
const PlanejamentoMestrePage = lazy(() => import('@/features/planejamento-mestre/index').then((m) => ({ default: m.PlanejamentoMestrePage })))
const PlanejamentoPage      = lazy(() => import('@/features/planejamento/index').then((m) => ({ default: m.PlanejamentoPage })))
const LpsPage               = lazy(() => import('@/features/lps-lean/index').then((m) => ({ default: m.LpsPage })))
const MapaInterativoPage    = lazy(() => import('@/features/mapa-interativo/index').then((m) => ({ default: m.MapaInterativoPage })))
const RdoPage               = lazy(() => import('@/features/rdo/index').then((m) => ({ default: m.RdoPage })))
const QualidadePage         = lazy(() => import('@/features/qualidade/index').then((m) => ({ default: m.QualidadePage })))
const QuantitativosPage     = lazy(() => import('@/features/quantitativos/index').then((m) => ({ default: m.QuantitativosPage })))
const Rede360Page           = lazy(() => import('@/features/rede-360/index').then((m) => ({ default: m.Rede360Page })))
const BimPage               = lazy(() => import('@/features/bim/index').then((m) => ({ default: m.BimPage })))
const EvmPage               = lazy(() => import('@/features/evm/index').then((m) => ({ default: m.EvmPage })))
const MinhaRotinaPage       = lazy(() => import('@/features/minha-rotina/index').then((m) => ({ default: m.MinhaRotinaPage })))

// ─── Route loading fallback ──────────────────────────────────────────────────

function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-full text-[#a3a3a3]">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-[#5e5e5e] border-t-cyan-500 rounded-full animate-spin" />
        <span className="text-sm">Carregando módulo...</span>
      </div>
    </div>
  )
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page — no AppShell */}
        <Route path="/" element={<LandingPage />} />

        {/* App shell with all dashboard routes prefixed by /app */}
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="/app/minha-rotina" replace />} />
          <Route path="minha-rotina"        element={<LazyRoute><MinhaRotinaPage /></LazyRoute>} />
          <Route path="relatorio360"        element={<LazyRoute><Relatorio360Page /></LazyRoute>} />
          <Route path="agenda"              element={<LazyRoute><AgendaPage /></LazyRoute>} />
          <Route path="equipamentos"        element={<Navigate to="/app/gestao-equipamentos" replace />} />
          <Route path="gestao-equipamentos" element={<LazyRoute><GestaoEquipamentosPage /></LazyRoute>} />
          <Route path="projetos"            element={<LazyRoute><ProjetosPage /></LazyRoute>} />
          <Route path="torre-de-controle"   element={<LazyRoute><TorreDeControlePage /></LazyRoute>} />
          <Route path="pre-construcao"      element={<LazyRoute><PreConstrucaoPage /></LazyRoute>} />
          <Route path="suprimentos"         element={<LazyRoute><SuprimentosPage /></LazyRoute>} />
          <Route path="mao-de-obra"         element={<LazyRoute><MaoDeObraPage /></LazyRoute>} />
          <Route path="otimizacao-frota"    element={<LazyRoute><OtimizacaoFrotaPage /></LazyRoute>} />
          <Route path="gestao-360"          element={<LazyRoute><Gestao360Page /></LazyRoute>} />
          <Route path="planejamento-mestre"  element={<LazyRoute><PlanejamentoMestrePage /></LazyRoute>} />
          <Route path="planejamento"        element={<LazyRoute><PlanejamentoPage /></LazyRoute>} />
          <Route path="lps-lean"            element={<LazyRoute><LpsPage /></LazyRoute>} />
          <Route path="mapa-interativo"     element={<LazyRoute><MapaInterativoPage /></LazyRoute>} />
          <Route path="rdo"                 element={<LazyRoute><RdoPage /></LazyRoute>} />
          <Route path="qualidade"           element={<LazyRoute><QualidadePage /></LazyRoute>} />
          <Route path="quantitativos"       element={<LazyRoute><QuantitativosPage /></LazyRoute>} />
          <Route path="rede-360"            element={<LazyRoute><Rede360Page /></LazyRoute>} />
          <Route path="bim"                 element={<LazyRoute><BimPage /></LazyRoute>} />
          <Route path="evm"                 element={<LazyRoute><EvmPage /></LazyRoute>} />
          <Route path="*"                   element={<Navigate to="/app/minha-rotina" replace />} />
        </Route>

        {/* Catch-all → landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
