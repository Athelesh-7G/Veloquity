import { useEffect, useState } from 'react'
import {
  Bot,
  BookOpen,
  Database,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  Shield,
} from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { format } from 'date-fns'

const NAV = [
  { to: '/dashboard',       label: 'Dashboard',       Icon: LayoutDashboard },
  { to: '/agents',          label: 'Agents',           Icon: Bot },
  { to: '/evidence',        label: 'Evidence',         Icon: Database },
  { to: '/recommendations', label: 'Recommendations',  Icon: Lightbulb },
  { to: '/chat',            label: 'Chat',             Icon: MessageSquare },
  { to: '/governance',      label: 'Governance',       Icon: Shield },
  { to: '/docs',            label: 'Docs',             Icon: BookOpen },
]

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':       'Dashboard',
  '/agents':          'Agent Console',
  '/evidence':        'Evidence Clusters',
  '/recommendations': 'Recommendations',
  '/chat':            'AI Assistant',
  '/governance':      'Governance',
  '/docs':            'Documentation',
}

function LogoImg({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className="font-semibold text-sm tracking-widest text-slate-100" style={{ letterSpacing: '0.12em' }}>
        VELOQUITY
      </span>
    )
  }
  return (
    <img
      src="/logo.png"
      alt="Veloquity"
      className={className}
      onError={() => setFailed(true)}
    />
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const title = PAGE_TITLES[pathname] ?? 'Veloquity'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col flex-shrink-0 border-r"
        style={{ width: 240, background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <LogoImg className="h-8 w-auto" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, Icon }) => {
            const active = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
                style={{
                  color: active ? '#93C5FD' : '#94A3B8',
                  background: active ? 'rgba(59,130,246,0.1)' : 'transparent',
                  borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                  textDecoration: 'none',
                }}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>

      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <header
          className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <LogoImg className="h-6 w-auto" />
            <h1 className="text-base font-semibold text-slate-100">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-slate-500">
              {format(now, 'HH:mm:ss')} UTC
            </span>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full pulse-dot"
                style={{ background: 'var(--success)' }}
              />
              <span className="text-xs text-slate-400">System Active</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
