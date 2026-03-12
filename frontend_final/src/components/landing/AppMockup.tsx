import { motion } from 'framer-motion'
import { Database, GitBranch, BarChart3, Settings, MessageSquare, TrendingUp } from 'lucide-react'

export default function AppMockup() {
  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-violet-500/20 to-orange-500/20 rounded-3xl blur-2xl" />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-black/5 dark:border-white/5">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-4 py-1 bg-white dark:bg-gray-700 rounded-md text-xs text-black/50 dark:text-white/50 font-mono">
              app.veloquity.io/workspace
            </div>
          </div>
        </div>
        <div className="flex min-h-[400px]">
          <div className="w-14 bg-gray-50 dark:bg-gray-800/30 border-r border-black/5 dark:border-white/5 p-2 flex flex-col gap-2">
            {[Database, GitBranch, BarChart3, MessageSquare, Settings].map((Icon, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 + i * 0.1 }}
                className={`p-2.5 rounded-lg ${i === 0 ? 'bg-gradient-to-br from-blue-500 to-violet-500 text-white' : 'text-black/40 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5'} transition-colors`}>
                <Icon className="w-4 h-4" />
              </motion.div>
            ))}
          </div>
          <div className="flex-1 p-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { title: 'Mobile crashes', tag: 'bug', color: 'red' },
                { title: 'Dark mode request', tag: 'feature', color: 'blue' },
                { title: 'Slow dashboard', tag: 'perf', color: 'orange' },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 + i * 0.15 }}
                  className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-black/5 dark:border-white/5">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-medium text-black/80 dark:text-white/80">{item.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      item.color === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      item.color === 'blue' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>{item.tag}</span>
                  </div>
                  <div className="h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${70 + i * 10}%` }} transition={{ delay: 1.5 + i * 0.1, duration: 0.6 }}
                      className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full" />
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="relative mt-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2 }}
                className="relative mt-16 mx-auto max-w-sm p-5 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/80 dark:to-gray-800/40 rounded-xl border border-black/10 dark:border-white/10 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-violet-600" />
                    <span className="text-sm font-semibold text-black dark:text-white">Q1 Priority: Performance</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-black/50 dark:text-white/50">Confidence</span>
                    <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">84%</span>
                  </div>
                  <div className="h-3 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden relative">
                    <div className="absolute inset-y-0 left-[75%] right-[8%] bg-violet-200/50 dark:bg-violet-500/20" />
                    <motion.div initial={{ width: 0 }} animate={{ width: '84%' }} transition={{ delay: 2.5, duration: 0.8 }}
                      className="h-full bg-gradient-to-r from-blue-500 via-violet-500 to-violet-600 rounded-full relative" />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
