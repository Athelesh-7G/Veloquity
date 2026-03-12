import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="py-16 px-4 bg-gray-50 dark:bg-gray-950 border-t border-black/5 dark:border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src="/logo.png" alt="Veloquity" className="h-8 w-auto" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              <span className="font-bold text-black dark:text-white">Veloquity</span>
            </div>
            <p className="text-sm text-black/50 dark:text-white/50">Evidence-grounded decision support for product teams.</p>
          </div>

          {[
            { title: 'Product', items: ['Features', 'Pricing', 'Integrations', 'Changelog'] },
            { title: 'Resources', items: ['Documentation', 'API Reference', 'Guides', 'Blog'] },
            { title: 'Company', items: ['About', 'Careers', 'Contact', 'Legal'] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="font-semibold text-black dark:text-white mb-4">{col.title}</h4>
              <ul className="space-y-2">
                {col.items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-black/5 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-black/40 dark:text-white/40">© 2026 Veloquity. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors">Privacy</a>
            <a href="#" className="text-sm text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
