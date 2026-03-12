import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#how-it-works', label: 'How It Works' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#docs', label: 'Docs' },
  ]

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`fixed top-4 left-0 right-0 z-50 mx-auto w-[95%] max-w-4xl rounded-full border border-black/5 transition-all duration-300 dark:border-white/10 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-xl shadow-lg dark:bg-black/80'
          : 'bg-white/60 backdrop-blur-md dark:bg-black/60'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2.5 rounded-full p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10">
          <img
            src="/logo.png"
            alt="Veloquity"
            className="h-8 w-auto"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          <span className="text-sm font-semibold tracking-tight text-black dark:text-white">VELOQUITY</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="rounded-full px-4 py-2 text-sm font-medium text-black/70 transition-all hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white">
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className="hidden rounded-full p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10 md:flex" aria-label="Search">
            <Search className="h-4 w-4 text-black/70 dark:text-white/70" />
          </button>

          <Link to="/app">
            <Button className="rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-orange-500 px-5 py-2 font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-105">
              Launch Engine
            </Button>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="rounded-full p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10 md:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5 text-black dark:text-white" /> : <Menu className="h-5 w-5 text-black dark:text-white" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-black/5 bg-white/90 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/90 md:hidden"
          >
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="block rounded-lg px-4 py-3 text-sm font-medium text-black/70 transition-all hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white" onClick={() => setMobileMenuOpen(false)}>
                {link.label}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}