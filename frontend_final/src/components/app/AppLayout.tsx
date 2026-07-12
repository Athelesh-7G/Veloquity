import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import LeftRail from './LeftRail'
import AppHeader from './AppHeader'
import { AppProvider } from '@/lib/app-context'
import { checkHealth } from '@/api/client'

export default function AppLayout() {
  // App-wide keep-alive: ping GET /health every 10 minutes while any in-app tab
  // is open so Render's free tier doesn't spin the backend down after 15 min of
  // inactivity (which is what forces the 30-60s cold start on the next request).
  // Lives here rather than on a single page so it runs no matter where the user
  // lands within /app.
  useEffect(() => {
    const KEEP_ALIVE_MS = 10 * 60 * 1000
    const id = setInterval(() => { void checkHealth(2500) }, KEEP_ALIVE_MS)
    return () => clearInterval(id)
  }, [])

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
