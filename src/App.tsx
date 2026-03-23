import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell }          from '@/components/shared/AppShell'
import { Relatorio360Page }  from '@/features/relatorio360/index'
import { AgendaPage }        from '@/features/agenda/index'
import { EquipamentosPage }  from '@/features/equipamentos/index'
import { ProjetosPage }      from '@/features/projetos/index'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/relatorio360" replace />} />
          <Route path="/relatorio360"  element={<Relatorio360Page />} />
          <Route path="/agenda"        element={<AgendaPage />} />
          <Route path="/equipamentos"  element={<EquipamentosPage />} />
          <Route path="/projetos"      element={<ProjetosPage />} />
          <Route path="*"              element={<Navigate to="/relatorio360" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
