'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Navbar() {
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
      className={`fixed top-4 left-1/2 z-50 w-[95%] max-w-4xl -translate-x-1/2 rounded-full border border-black/5 transition-all duration-300 dark:border-white/10 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-xl shadow-lg dark:bg-black/80'
          : 'bg-white/60 backdrop-blur-md dark:bg-black/60'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-2.5">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-full p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        >
          <div className="relative h-9 w-9 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full">
              <defs>
                <linearGradient id="navLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="35%" stopColor="#7c3aed" />
                  <stop offset="65%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ea580c" />
                </linearGradient>

                <radialGradient id="navLogoCenterGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fb923c" />
                  <stop offset="50%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </radialGradient>

                <mask id="navLogoMask">
                  <image
                    href="D:\\VELOQUITY\\Finalised VELOQUITY\\Veloquity_Logo.png"
                    width="100"
                    height="100"
                    preserveAspectRatio="xMidYMid meet"
                  />
                </mask>
              </defs>

              <rect
                width="100"
                height="100"
                fill="url(#navLogoGradient)"
                mask="url(#navLogoMask)"
              />

              <circle
                cx="50"
                cy="50"
                r="25"
                fill="url(#navLogoCenterGradient)"
                mask="url(#navLogoMask)"
                opacity="0.8"
              />
            </svg>
          </div>

          <span className="text-sm font-semibold tracking-tight text-black dark:text-white">
            VELOQUITY
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-black/70 transition-all hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="hidden rounded-full p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10 md:flex"
            aria-label="Search"
          >
            <Search className="h-4 w-4 text-black/70 dark:text-white/70" />
          </button>

          <Link href="/app">
            <Button className="rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-orange-500 px-5 py-2 font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-violet-500/30 hover:from-blue-500 hover:via-violet-500 hover:to-orange-400 dark:from-blue-500 dark:via-violet-500 dark:to-orange-400 dark:shadow-violet-500/40 dark:hover:from-blue-400 dark:hover:via-violet-400 dark:hover:to-orange-300 dark:hover:shadow-violet-500/50">
              Launch Engine
            </Button>
          </Link>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="rounded-full p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5 text-black dark:text-white" />
            ) : (
              <Menu className="h-5 w-5 text-black dark:text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-black/5 bg-white/90 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/90 md:hidden"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-lg px-4 py-3 text-sm font-medium text-black/70 transition-all hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
