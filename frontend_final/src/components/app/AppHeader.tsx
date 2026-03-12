import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Plus, Upload, Settings, Moon, Sun, Command, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApp } from '@/lib/app-context'

export default function AppHeader() {
  const { resolvedTheme, setTheme, searchQuery, setSearchQuery } = useApp()
  const [searchFocused, setSearchFocused] = useState(false)

  const handleToggleTheme = () => {
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light')
  }

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left: Logo and brand */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img
              src="/logo.png"
              alt="Veloquity"
              className="h-7 w-auto"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <span className="font-semibold text-foreground hidden sm:block">VELOQUITY</span>
          </Link>

          <div className="h-6 w-px bg-border hidden md:block" />
          <span className="text-sm text-muted-foreground hidden md:block">Workspace</span>
        </div>

        {/* Center: Search */}
        <motion.div
          className={`relative flex-1 max-w-md mx-4`}
          animate={{ scale: searchFocused ? 1.02 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search feedback, evidence, decisions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="pl-10 pr-20 bg-secondary/50 border-transparent focus:border-primary/20 focus:bg-background transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
              <Command className="inline w-2.5 h-2.5" />
            </kbd>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">K</kbd>
          </div>
        </motion.div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hidden sm:flex gap-2 text-muted-foreground hover:text-foreground">
            <Plus className="w-4 h-4" />
            <span className="text-sm">New Feedback</span>
          </Button>

          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Upload className="w-4 h-4" />
            <span className="sr-only">Import</span>
          </Button>

          <div className="h-6 w-px bg-border hidden sm:block" />

          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full" />
            <span className="sr-only">Notifications</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleTheme}
            className="text-muted-foreground hover:text-foreground"
          >
            {resolvedTheme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span className="sr-only">Toggle theme</span>
          </Button>

          <Link to="/app/settings">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Settings className="w-4 h-4" />
              <span className="sr-only">Settings</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
