import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LandingPage }       from '@/features/landing/LandingPage'
import { Component, lazy, Suspense, type ReactNode } from 'react'

/* O SHELL DO APP É LAZY DE PROPÓSITO. `AppShell` puxa Sidebar → useAlertCounts → 22 stores
   (incl. xlsx via economiaStore e o client Supabase). Importado estaticamente, tudo isso
   entrava no bundle de ENTRADA e era baixado/avaliado por quem só abre a landing pública
   (~267 KB gzip + hidratação de 42 stores do localStorage). A LandingPage segue estática:
   é a rota `/` e deve pintar sem esperar chunk nenhum. */
const importAppShell = () => import('@/components/shared/AppShell')
const AppShell   = lazy(() => importAppShell().then((m) => ({ default: m.AppShell })))
const AuthPage   = lazy(() => import('@/features/auth/AuthPage').then((m) => ({ default: m.AuthPage })))
const AuthGuard  = lazy(() => import('@/lib/AuthGuard').then((m) => ({ default: m.AuthGuard })))

// Lazy-loaded modules (code-split per route)

const AgendaPage            = lazy(() => import('@/features/agenda/index').then((m) => ({ default: m.AgendaPage })))
const TorreDeControlePage   = lazy(() => import('@/features/torre-de-controle/index').then((m) => ({ default: m.TorreDeControlePage })))
const PredialPage           = lazy(() => import('@/features/predial/index').then((m) => ({ default: m.PredialPage })))
const ZeladorChamadosPage   = lazy(() => import('@/features/predial/ZeladorChamadosPage').then((m) => ({ default: m.ZeladorChamadosPage })))
const ChamadoPublicoPage    = lazy(() => import('@/features/predial/ChamadoPublicoPage').then((m) => ({ default: m.ChamadoPublicoPage })))
const GestaoEquipamentosPage = lazy(() => import('@/features/gestao-equipamentos/index').then((m) => ({ default: m.GestaoEquipamentosPage })))
const SuprimentosPage       = lazy(() => import('@/features/suprimentos/index').then((m) => ({ default: m.SuprimentosPage })))
const MaoDeObraPage         = lazy(() => import('@/features/mao-de-obra/index').then((m) => ({ default: m.MaoDeObraPage })))
const OtimizacaoFrotaPage   = lazy(() => import('@/features/otimizacao-frota/index').then((m) => ({ default: m.default })))
const Gestao360Page         = lazy(() => import('@/features/gestao-360/index').then((m) => ({ default: m.Gestao360Page })))
const PlanejamentoMestrePage = lazy(() => import('@/features/planejamento-mestre/index').then((m) => ({ default: m.PlanejamentoMestrePage })))
const PlanejamentoPage      = lazy(() => import('@/features/planejamento/index').then((m) => ({ default: m.PlanejamentoPage })))
const RdoPage               = lazy(() => import('@/features/rdo/index').then((m) => ({ default: m.RdoPage })))
const RdoSabespPage         = lazy(() => import('@/features/rdo-sabesp/index').then((m) => ({ default: m.RdoSabespPage })))
const QualidadePage         = lazy(() => import('@/features/qualidade/index').then((m) => ({ default: m.QualidadePage })))
const QuantitativosPage     = lazy(() => import('@/features/quantitativos/index').then((m) => ({ default: m.QuantitativosPage })))
const EvmPage               = lazy(() => import('@/features/evm/index').then((m) => ({ default: m.EvmPage })))
const MinhaRotinaPage       = lazy(() => import('@/features/minha-rotina/index').then((m) => ({ default: m.MinhaRotinaPage })))
const ComandoCentralPage    = lazy(() => import('@/features/comando-central/index').then((m) => ({ default: m.ComandoCentralPage })))
const MedicaoPage           = lazy(() => import('@/features/medicao/index').then((m) => ({ default: m.MedicaoPage })))
const EconomiaPage          = lazy(() => import('@/features/economia/index').then((m) => ({ default: m.EconomiaPage })))
const ProcessosPage         = lazy(() => import('@/features/processos/index').then((m) => ({ default: m.ProcessosPage })))

// Admin pages (Sprint 1: aprovações, auditoria, export, matriz)
const AprovacoesPage        = lazy(() => import('@/features/admin/AprovacoesPage').then((m) => ({ default: m.AprovacoesPage })))
const ExportarDadosPage     = lazy(() => import('@/features/admin/ExportarDadosPage').then((m) => ({ default: m.ExportarDadosPage })))
const DireitosTitularPage   = lazy(() => import('@/features/admin/DireitosTitularPage').then((m) => ({ default: m.DireitosTitularPage })))
const MembrosPage           = lazy(() => import('@/features/admin/MembrosPage').then((m) => ({ default: m.MembrosPage })))
const AuditoriaPage         = lazy(() => import('@/features/admin/AuditoriaPage').then((m) => ({ default: m.AuditoriaPage })))
const MatrizAprovacaoPage   = lazy(() => import('@/features/admin/MatrizAprovacaoPage').then((m) => ({ default: m.MatrizAprovacaoPage })))
const HomologacaoPage       = lazy(() => import('@/features/admin/HomologacaoPage').then((m) => ({ default: m.HomologacaoPage })))
const AdaptacaoRapidaPage   = lazy(() => import('@/features/admin/AdaptacaoRapidaPage').then((m) => ({ default: m.AdaptacaoRapidaPage })))

// Route loading fallback

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

class ModuleErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Erro ao carregar modulo', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-xl border border-[#525252] bg-[#2c2c2c] p-5">
          <p className="text-sm font-semibold text-[#f5f5f5]">Nao foi possivel abrir este modulo.</p>
          <p className="mt-2 text-xs text-[#a3a3a3]">
            A tela encontrou um erro local. Voce pode tentar recarregar a pagina ou trocar de modulo pelo menu lateral.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 rounded-lg border border-[#525252] px-3 py-1.5 text-xs font-semibold text-[#f97316] hover:border-[#f97316]/40"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }
}

/* O AuthGuard segura os children enquanto o auth inicializa, então o chunk do AppShell só
   começaria a baixar DEPOIS do round-trip do Supabase. Disparar o import aqui (no render, não
   em efeito — a subárvore suspende e os efeitos não commitam) paraleliza os dois downloads.
   O import é deduplicado pelo registry de módulos. */
function AppShellRoute() {
  void importAppShell()
  return (
    <AuthGuard>
      <AppShell />
    </AuthGuard>
  )
}

function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <ModuleErrorBoundary>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </ModuleErrorBoundary>
  )
}

// App

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page - no AppShell */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/noticias" element={<Navigate to="/" replace />} />

        {/* Auth routes - no AppShell (lazy: AuthPage/AuthGuard ficam fora do bundle da landing) */}
        <Route path="/login"        element={<LazyRoute><AuthPage mode="login" /></LazyRoute>} />
        <Route path="/login/mfa"    element={<LazyRoute><AuthPage mode="mfa-challenge" /></LazyRoute>} />
        <Route path="/signup"       element={<Navigate to="/login" replace />} />
        <Route path="/signup/organizacao" element={<Navigate to="/login" replace />} />
        <Route path="/aceitar-convite" element={<LazyRoute><AuthPage mode="invite" /></LazyRoute>} />
        {/* QR público de chamado — SEM AuthGuard/AppShell (rota anônima, morador abre chamado). */}
        <Route path="/chamado/:slug" element={<LazyRoute><ChamadoPublicoPage /></LazyRoute>} />
        <Route path="/mfa/ativar"   element={<LazyRoute><AuthGuard><AuthPage mode="mfa-setup" /></AuthGuard></LazyRoute>} />

        {/* App shell with all dashboard routes prefixed by /app - protegido por AuthGuard */}
        <Route path="/app" element={<LazyRoute><AppShellRoute /></LazyRoute>}>
          <Route index element={<Navigate to="/app/minha-rotina" replace />} />
          <Route path="aprovacoes"   element={<LazyRoute><AprovacoesPage /></LazyRoute>} />
          <Route path="auditoria"    element={<LazyRoute><AuditoriaPage /></LazyRoute>} />
          <Route path="exportar-dados" element={<LazyRoute><ExportarDadosPage /></LazyRoute>} />
          <Route path="direitos-titular" element={<LazyRoute><DireitosTitularPage /></LazyRoute>} />
          <Route path="membros" element={<LazyRoute><MembrosPage /></LazyRoute>} />
          <Route path="configuracoes/aprovacoes" element={<LazyRoute><MatrizAprovacaoPage /></LazyRoute>} />
          <Route path="homologacao"   element={<LazyRoute><HomologacaoPage /></LazyRoute>} />
          <Route path="adaptacao-rapida" element={<LazyRoute><AdaptacaoRapidaPage /></LazyRoute>} />
          <Route path="minha-rotina"        element={<LazyRoute><MinhaRotinaPage /></LazyRoute>} />
          <Route path="comando-central"     element={<LazyRoute><ComandoCentralPage /></LazyRoute>} />
          {/* Relatório 360 virou aba do Gestão 360. Redireciona links antigos. */}
          <Route path="relatorio360"        element={<Navigate to="/app/gestao-360" replace />} />
          <Route path="agenda"              element={<LazyRoute><AgendaPage /></LazyRoute>} />
          {/* Manutenções e Gestão de Equipamentos viraram abas do módulo Predial. */}
          <Route path="predial"             element={<LazyRoute><PredialPage /></LazyRoute>} />
          {/* View enxuta mobile do zelador: lista de chamados + abrir chamado. */}
          <Route path="chamados"            element={<LazyRoute><ZeladorChamadosPage /></LazyRoute>} />
          {/* Equipamentos voltou a ser módulo standalone; o Predial mantém a aba (mesmo store, dados compartilhados). */}
          <Route path="equipamentos"        element={<LazyRoute><GestaoEquipamentosPage /></LazyRoute>} />
          <Route path="gestao-equipamentos" element={<Navigate to="/app/equipamentos" replace />} />
          <Route path="projetos"            element={<Navigate to="/app/torre-de-controle?aba=projetos" replace />} />
          <Route path="torre-de-controle"   element={<LazyRoute><TorreDeControlePage /></LazyRoute>} />
          {/* Módulo "Levantamento" removido. Redireciona links antigos. */}
          <Route path="levantamento-obra"   element={<Navigate to="/app/minha-rotina" replace />} />
          <Route path="economia"            element={<LazyRoute><EconomiaPage /></LazyRoute>} />
          <Route path="pre-construcao"      element={<Navigate to="/app/torre-de-controle?aba=projetos" replace />} />
          <Route path="suprimentos"         element={<LazyRoute><SuprimentosPage /></LazyRoute>} />
          <Route path="manutencoes"         element={<Navigate to="/app/predial?tab=manutencoes" replace />} />
          <Route path="mao-de-obra"         element={<LazyRoute><MaoDeObraPage /></LazyRoute>} />
          <Route path="otimizacao-frota"    element={<LazyRoute><OtimizacaoFrotaPage /></LazyRoute>} />
          <Route path="gestao-360"          element={<LazyRoute><Gestao360Page /></LazyRoute>} />
          <Route path="planejamento-mestre"  element={<LazyRoute><PlanejamentoMestrePage /></LazyRoute>} />
          <Route path="planejamento"        element={<LazyRoute><PlanejamentoPage /></LazyRoute>} />
          {/* LPS/Lean foi absorvido pelo Planejamento (sub-abas). Redireciona links antigos. */}
          <Route path="lps-lean"            element={<Navigate to="/app/planejamento-mestre" replace />} />
          <Route path="mapa-interativo"     element={<Navigate to="/app/torre-de-controle?aba=mapa-interativo" replace />} />
          <Route path="rdo"                 element={<LazyRoute><RdoPage /></LazyRoute>} />
          <Route path="rdo-sabesp"          element={<LazyRoute><RdoSabespPage /></LazyRoute>} />
          <Route path="qualidade"           element={<LazyRoute><QualidadePage /></LazyRoute>} />
          <Route path="quantitativos"       element={<LazyRoute><QuantitativosPage /></LazyRoute>} />
          <Route path="bim"                 element={<Navigate to="/app/torre-de-controle?aba=bim" replace />} />
          <Route path="evm"                 element={<LazyRoute><EvmPage /></LazyRoute>} />
          <Route path="medicao"             element={<LazyRoute><MedicaoPage /></LazyRoute>} />
          <Route path="processos"            element={<LazyRoute><ProcessosPage /></LazyRoute>} />
          <Route path="financeiro"          element={<Navigate to="/app/evm" replace />} />
          <Route path="*"                   element={<Navigate to="/app/minha-rotina" replace />} />
        </Route>

        {/* Catch-all -> landing */}
        <Route path="/rdo-sabesp" element={<Navigate to="/app/rdo-sabesp" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
