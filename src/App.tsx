import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/shared/AppShell'
import { Relatorio360Page } from '@/features/relatorio360/index'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/relatorio360" replace />} />
          <Route path="/relatorio360" element={<Relatorio360Page />} />
          <Route path="*" element={<Navigate to="/relatorio360" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
