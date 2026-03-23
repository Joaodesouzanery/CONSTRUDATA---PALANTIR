import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { DemoBanner } from './DemoBanner'

export function AppShell() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <DemoBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
