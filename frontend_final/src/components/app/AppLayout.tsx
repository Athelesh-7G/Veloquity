import { Outlet } from 'react-router-dom'
import LeftRail from './LeftRail'
import AppHeader from './AppHeader'
import { AppProvider } from '@/lib/app-context'

export default function AppLayout() {
  return (
    <AppProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <LeftRail />
        <div className="flex flex-col flex-1 overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </AppProvider>
  )
}
