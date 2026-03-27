import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell }          from '@/components/shared/AppShell'
import { LandingPage }       from '@/features/landing/LandingPage'
import { Relatorio360Page }  from '@/features/relatorio360/index'
import { AgendaPage }        from '@/features/agenda/index'
import { ProjetosPage }              from '@/features/projetos/index'
import { TorreDeControlePage }       from '@/features/torre-de-controle/index'
import { GestaoEquipamentosPage }    from '@/features/gestao-equipamentos/index'
import { PreConstrucaoPage }         from '@/features/pre-construcao/index'
import { SuprimentosPage }           from '@/features/suprimentos/index'
import { MaoDeObraPage }             from '@/features/mao-de-obra/index'
import OtimizacaoFrotaPage           from '@/features/otimizacao-frota/index'
import { Gestao360Page }             from '@/features/gestao-360/index'
import { PlanejamentoPage }          from '@/features/planejamento/index'
import { LpsPage }                  from '@/features/lps-lean/index'
import { MapaInterativoPage }       from '@/features/mapa-interativo/index'
import { RdoPage }                  from '@/features/rdo/index'
import { QuantitativosPage }        from '@/features/quantitativos/index'
import { Rede360Page }              from '@/features/rede-360/index'
import { lazy, Suspense } from 'react'

const BimPage = lazy(() => import('@/features/bim/index').then((m) => ({ default: m.BimPage })))

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page — no AppShell */}
        <Route path="/" element={<LandingPage />} />

        {/* App shell with all dashboard routes prefixed by /app */}
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="/app/gestao-360" replace />} />
          <Route path="relatorio360"        element={<Relatorio360Page />} />
          <Route path="agenda"              element={<AgendaPage />} />
          <Route path="equipamentos"        element={<Navigate to="/app/gestao-equipamentos" replace />} />
          <Route path="gestao-equipamentos" element={<GestaoEquipamentosPage />} />
          <Route path="projetos"            element={<ProjetosPage />} />
          <Route path="torre-de-controle"   element={<TorreDeControlePage />} />
          <Route path="pre-construcao"      element={<PreConstrucaoPage />} />
          <Route path="suprimentos"         element={<SuprimentosPage />} />
          <Route path="mao-de-obra"         element={<MaoDeObraPage />} />
          <Route path="otimizacao-frota"    element={<OtimizacaoFrotaPage />} />
          <Route path="gestao-360"          element={<Gestao360Page />} />
          <Route path="planejamento"        element={<PlanejamentoPage />} />
          <Route path="lps-lean"            element={<LpsPage />} />
          <Route path="mapa-interativo"     element={<MapaInterativoPage />} />
          <Route path="rdo"                 element={<RdoPage />} />
          <Route path="quantitativos"       element={<QuantitativosPage />} />
          <Route path="rede-360"            element={<Rede360Page />} />
          <Route path="bim"                 element={
            <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">Carregando módulo 3D...</div>}>
              <BimPage />
            </Suspense>
          } />
          <Route path="*"                   element={<Navigate to="/app/gestao-360" replace />} />
        </Route>

        {/* Catch-all → landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
