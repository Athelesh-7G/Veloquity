"use client"

import Link from "next/link"
import Image from "next/image"

export function Footer() {
  return (
    <footer className="py-16 px-4 bg-gray-50 dark:bg-gray-950 border-t border-black/5 dark:border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <Image
                src="/images/veloquity-20logo.png"
                alt="Veloquity"
                width={32}
                height={32}
                className="dark:invert"
                style={{ mixBlendMode: "multiply" }}
              />
              <span className="font-bold text-black dark:text-white">Veloquity</span>
            </div>
            <p className="text-sm text-black/50 dark:text-white/50">
              Evidence-grounded decision support for product teams.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-black dark:text-white mb-4">Product</h4>
            <ul className="space-y-2">
              {["Features", "Pricing", "Integrations", "Changelog"].map((item) => (
                <li key={item}>
                  <Link
                    href="#"
                    className="text-sm text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-black dark:text-white mb-4">Resources</h4>
            <ul className="space-y-2">
              {["Documentation", "API Reference", "Guides", "Blog"].map((item) => (
                <li key={item}>
                  <Link
                    href="#"
                    className="text-sm text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-black dark:text-white mb-4">Company</h4>
            <ul className="space-y-2">
              {["About", "Careers", "Contact", "Legal"].map((item) => (
                <li key={item}>
                  <Link
                    href="#"
                    className="text-sm text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-black/5 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-black/40 dark:text-white/40">© 2026 Veloquity. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link
              href="#"
              className="text-sm text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="#"
              className="text-sm text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
