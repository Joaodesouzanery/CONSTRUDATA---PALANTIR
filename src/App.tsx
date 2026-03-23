import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell }          from '@/components/shared/AppShell'
import { Relatorio360Page }  from '@/features/relatorio360/index'
import { AgendaPage }        from '@/features/agenda/index'
import { EquipamentosPage }  from '@/features/equipamentos/index'
import { ProjetosPage }              from '@/features/projetos/index'
import { TorreDeControlePage }       from '@/features/torre-de-controle/index'
import { GestaoEquipamentosPage }    from '@/features/gestao-equipamentos/index'
import { PreConstrucaoPage }         from '@/features/pre-construcao/index'
import { SuprimentosPage }           from '@/features/suprimentos/index'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/relatorio360" replace />} />
          <Route path="/relatorio360"        element={<Relatorio360Page />} />
          <Route path="/agenda"              element={<AgendaPage />} />
          <Route path="/equipamentos"        element={<EquipamentosPage />} />
          <Route path="/gestao-equipamentos" element={<GestaoEquipamentosPage />} />
          <Route path="/projetos"            element={<ProjetosPage />} />
          <Route path="/torre-de-controle"   element={<TorreDeControlePage />} />
          <Route path="/pre-construcao"      element={<PreConstrucaoPage />} />
          <Route path="/suprimentos"         element={<SuprimentosPage />} />
          <Route path="*"                    element={<Navigate to="/relatorio360" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
