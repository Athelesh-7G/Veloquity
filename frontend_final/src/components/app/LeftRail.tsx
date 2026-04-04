import type React from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Database,
  Shield,
  GitBranch,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileInput,
  Scale,
  LineChart,
  Layers,
  FlaskConical,
  Bot,
  MessageSquare,
  BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-context'

interface NavSection {
  title: string
  items: {
    icon: React.ElementType
    label: string
    href: string
    badge?: string
  }[]
}

const navSections: NavSection[] = [
  {
    title: 'Data Ingestion',
    items: [
      { icon: Database, label: 'Data Studio', href: '/app/data-studio', badge: '6' },
      { icon: FileInput, label: 'Import Sources', href: '/app/import' },
    ],
  },
  {
    title: 'Evidence & Uncertainty',
    items: [
      { icon: Shield, label: 'Evidence Grid', href: '/app/evidence' },
      { icon: Scale, label: 'Confidence Scores', href: '/app/confidence' },
    ],
  },
  {
    title: 'Decision Outcomes',
    items: [
      { icon: GitBranch, label: 'Decision Playground', href: '/app/decisions' },
      { icon: FlaskConical, label: 'Scenarios', href: '/app/scenarios' },
    ],
  },
  {
    title: 'Intelligence Engine',
    items: [
      { icon: Bot, label: 'Agents', href: '/app/agents' },
      { icon: MessageSquare, label: 'Chat', href: '/app/chat' },
      { icon: BarChart2, label: 'Metrics', href: '/app/metrics' },
    ],
  },
  {
    title: 'Visualizations',
    items: [
      { icon: BarChart3, label: 'Dashboard', href: '/app/dashboard' },
      { icon: LineChart, label: 'Trends', href: '/app/trends' },
      { icon: Layers, label: 'Themes', href: '/app/themes' },
    ],
  },
  {
    title: 'Settings',
    items: [{ icon: Settings, label: 'Preferences', href: '/app/settings' }],
  },
]

export default function LeftRail() {
  const location = useLocation()
  const { sidebarCollapsed, setSidebarCollapsed } = useApp()
  const [expandedSections, setExpandedSections] = useState<string[]>(navSections.map((s) => s.title))

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => (prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]))
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ duration: 0.2 }}
      className="h-[calc(100vh-64px)] border-r border-border bg-background flex flex-col"
    >
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
            {!sidebarCollapsed && (
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{section.title}</span>
                <motion.div
                  animate={{ rotate: expandedSections.includes(section.title) ? 0 : -90 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronLeft className="w-3 h-3" />
                </motion.div>
              </button>
            )}

            <AnimatePresence initial={false}>
              {(sidebarCollapsed || expandedSections.includes(section.title)) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative',
                          isActive
                            ? 'bg-gradient-to-r from-blue-500/10 via-violet-500/10 to-violet-500/5 text-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                        )}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeIndicator"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-blue-500 to-violet-500 rounded-full"
                          />
                        )}

                        <item.icon
                          className={cn(
                            'w-4 h-4 flex-shrink-0',
                            isActive ? 'text-violet-600 dark:text-violet-400' : '',
                          )}
                        />

                        {!sidebarCollapsed && (
                          <>
                            <span className="flex-1">{item.label}</span>
                            {item.badge && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}

                        {sidebarCollapsed && (
                          <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity whitespace-nowrap z-50">
                            {item.label}
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-border">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  )
}
