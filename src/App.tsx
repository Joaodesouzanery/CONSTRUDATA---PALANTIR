import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell }          from '@/components/shared/AppShell'
import { LandingPage }       from '@/features/landing/LandingPage'
import { LoginPage }         from '@/features/auth/LoginPage'
import { SignupPage }        from '@/features/auth/SignupPage'
import { MfaSetupPage }      from '@/features/auth/MfaSetupPage'
import { MfaChallengePage }  from '@/features/auth/MfaChallengePage'
import { AuthGuard }         from '@/lib/AuthGuard'
import { lazy, Suspense } from 'react'

// ─── Lazy-loaded modules (code-split per route) ──────────────────────────────

const Relatorio360Page      = lazy(() => import('@/features/relatorio360/index').then((m) => ({ default: m.Relatorio360Page })))
const AgendaPage            = lazy(() => import('@/features/agenda/index').then((m) => ({ default: m.AgendaPage })))
const TorreDeControlePage   = lazy(() => import('@/features/torre-de-controle/index').then((m) => ({ default: m.TorreDeControlePage })))
const GestaoEquipamentosPage = lazy(() => import('@/features/gestao-equipamentos/index').then((m) => ({ default: m.GestaoEquipamentosPage })))
const SuprimentosPage       = lazy(() => import('@/features/suprimentos/index').then((m) => ({ default: m.SuprimentosPage })))
const MaoDeObraPage         = lazy(() => import('@/features/mao-de-obra/index').then((m) => ({ default: m.MaoDeObraPage })))
const OtimizacaoFrotaPage   = lazy(() => import('@/features/otimizacao-frota/index').then((m) => ({ default: m.default })))
const Gestao360Page         = lazy(() => import('@/features/gestao-360/index').then((m) => ({ default: m.Gestao360Page })))
const PlanejamentoMestrePage = lazy(() => import('@/features/planejamento-mestre/index').then((m) => ({ default: m.PlanejamentoMestrePage })))
const PlanejamentoPage      = lazy(() => import('@/features/planejamento/index').then((m) => ({ default: m.PlanejamentoPage })))
const LpsPage               = lazy(() => import('@/features/lps-lean/index').then((m) => ({ default: m.LpsPage })))
const MapaInterativoPage    = lazy(() => import('@/features/mapa-interativo/index').then((m) => ({ default: m.MapaInterativoPage })))
const RdoPage               = lazy(() => import('@/features/rdo/index').then((m) => ({ default: m.RdoPage })))
const RdoSabespPage         = lazy(() => import('@/features/rdo-sabesp/index').then((m) => ({ default: m.RdoSabespPage })))
const QualidadePage         = lazy(() => import('@/features/qualidade/index').then((m) => ({ default: m.QualidadePage })))
const QuantitativosPage     = lazy(() => import('@/features/quantitativos/index').then((m) => ({ default: m.QuantitativosPage })))
const BimPage               = lazy(() => import('@/features/bim/index').then((m) => ({ default: m.BimPage })))
const EvmPage               = lazy(() => import('@/features/evm/index').then((m) => ({ default: m.EvmPage })))
const MinhaRotinaPage       = lazy(() => import('@/features/minha-rotina/index').then((m) => ({ default: m.MinhaRotinaPage })))
const ComandoCentralPage    = lazy(() => import('@/features/comando-central/index').then((m) => ({ default: m.ComandoCentralPage })))
const MedicaoPage           = lazy(() => import('@/features/medicao/index').then((m) => ({ default: m.MedicaoPage })))

// Admin pages (Sprint 1: aprovações, auditoria, export, matriz)
const AprovacoesPage        = lazy(() => import('@/features/admin/AprovacoesPage').then((m) => ({ default: m.AprovacoesPage })))
const ExportarDadosPage     = lazy(() => import('@/features/admin/ExportarDadosPage').then((m) => ({ default: m.ExportarDadosPage })))
const AuditoriaPage         = lazy(() => import('@/features/admin/AuditoriaPage').then((m) => ({ default: m.AuditoriaPage })))
const MatrizAprovacaoPage   = lazy(() => import('@/features/admin/MatrizAprovacaoPage').then((m) => ({ default: m.MatrizAprovacaoPage })))

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

        {/* Auth routes — no AppShell */}
        <Route path="/login"        element={<LoginPage />} />
        <Route path="/login/mfa"    element={<MfaChallengePage />} />
        <Route path="/signup"       element={<SignupPage />} />
        <Route path="/signup/organizacao" element={<SignupPage />} />
        <Route path="/mfa/ativar"   element={<AuthGuard><MfaSetupPage /></AuthGuard>} />

        {/* App shell with all dashboard routes prefixed by /app — protegido por AuthGuard */}
        <Route path="/app" element={<AuthGuard><AppShell /></AuthGuard>}>
          <Route index element={<Navigate to="/app/minha-rotina" replace />} />
          <Route path="aprovacoes"   element={<LazyRoute><AprovacoesPage /></LazyRoute>} />
          <Route path="auditoria"    element={<LazyRoute><AuditoriaPage /></LazyRoute>} />
          <Route path="exportar-dados" element={<LazyRoute><ExportarDadosPage /></LazyRoute>} />
          <Route path="configuracoes/aprovacoes" element={<LazyRoute><MatrizAprovacaoPage /></LazyRoute>} />
          <Route path="minha-rotina"        element={<LazyRoute><MinhaRotinaPage /></LazyRoute>} />
          <Route path="comando-central"     element={<LazyRoute><ComandoCentralPage /></LazyRoute>} />
          <Route path="relatorio360"        element={<LazyRoute><Relatorio360Page /></LazyRoute>} />
          <Route path="agenda"              element={<LazyRoute><AgendaPage /></LazyRoute>} />
          <Route path="equipamentos"        element={<Navigate to="/app/gestao-equipamentos" replace />} />
          <Route path="gestao-equipamentos" element={<LazyRoute><GestaoEquipamentosPage /></LazyRoute>} />
          <Route path="projetos"            element={<Navigate to="/app/torre-de-controle?aba=projetos" replace />} />
          <Route path="torre-de-controle"   element={<LazyRoute><TorreDeControlePage /></LazyRoute>} />
          <Route path="pre-construcao"      element={<Navigate to="/app/torre-de-controle?aba=projetos" replace />} />
          <Route path="suprimentos"         element={<LazyRoute><SuprimentosPage /></LazyRoute>} />
          <Route path="mao-de-obra"         element={<LazyRoute><MaoDeObraPage /></LazyRoute>} />
          <Route path="otimizacao-frota"    element={<LazyRoute><OtimizacaoFrotaPage /></LazyRoute>} />
          <Route path="gestao-360"          element={<LazyRoute><Gestao360Page /></LazyRoute>} />
          <Route path="planejamento-mestre"  element={<LazyRoute><PlanejamentoMestrePage /></LazyRoute>} />
          <Route path="planejamento"        element={<LazyRoute><PlanejamentoPage /></LazyRoute>} />
          <Route path="lps-lean"            element={<LazyRoute><LpsPage /></LazyRoute>} />
          <Route path="mapa-interativo"     element={<LazyRoute><MapaInterativoPage /></LazyRoute>} />
          <Route path="rdo"                 element={<LazyRoute><RdoPage /></LazyRoute>} />
          <Route path="rdo-sabesp"          element={<LazyRoute><RdoSabespPage /></LazyRoute>} />
          <Route path="qualidade"           element={<LazyRoute><QualidadePage /></LazyRoute>} />
          <Route path="quantitativos"       element={<LazyRoute><QuantitativosPage /></LazyRoute>} />
          <Route path="bim"                 element={<LazyRoute><BimPage /></LazyRoute>} />
          <Route path="evm"                 element={<LazyRoute><EvmPage /></LazyRoute>} />
          <Route path="medicao"             element={<LazyRoute><MedicaoPage /></LazyRoute>} />
          <Route path="financeiro"          element={<Navigate to="/app/evm" replace />} />
          <Route path="*"                   element={<Navigate to="/app/minha-rotina" replace />} />
        </Route>

        {/* Catch-all → landing */}
        <Route path="/rdo-sabesp" element={<Navigate to="/app/rdo-sabesp" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
