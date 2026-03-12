"use client"

import { motion } from "framer-motion"
import { Database, Brain, Map, ArrowRight, Layers, Sparkles, Target } from "lucide-react"

const features = [
  {
    icon: Database,
    title: "Input",
    subtitle: "Ingest Any Signal",
    description:
      "Connect feedback from Zendesk, Intercom, surveys, interviews, and more. Our engine normalizes messy, unstructured data into analyzable signals.",
    gradient: "from-blue-500 to-cyan-500",
    bgGradient: "from-blue-500/10 to-cyan-500/10",
  },
  {
    icon: Brain,
    title: "Logic",
    subtitle: "Evidence Synthesis",
    description:
      "Transparent reasoning chains that surface patterns with explicit uncertainty. Never hide complexity behind a single number.",
    gradient: "from-violet-500 to-purple-500",
    bgGradient: "from-violet-500/10 to-purple-500/10",
  },
  {
    icon: Map,
    title: "Output",
    subtitle: "Confident Roadmaps",
    description:
      "Generate prioritized roadmap items with confidence bounds. Know what you know, and more importantly, what you do not.",
    gradient: "from-orange-500 to-rose-500",
    bgGradient: "from-orange-500/10 to-rose-500/10",
  },
]

const secondaryFeatures = [
  {
    icon: Layers,
    title: "Multi-source correlation",
    description: "Automatically link related feedback across channels",
  },
  {
    icon: Sparkles,
    title: "Uncertainty visualization",
    description: "See confidence intervals, not just point estimates",
  },
  {
    icon: Target,
    title: "Decision support",
    description: "Interactive scenarios to test different thresholds",
  },
]

export function BentoGrid() {
  return (
    <section id="product" className="py-24 px-4 bg-white dark:bg-gray-950">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-black dark:text-white mb-4 text-balance">
            From chaos to clarity in{" "}
            <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-orange-500 bg-clip-text text-transparent">
              three stages
            </span>
          </h2>
          <p className="text-lg text-black/60 dark:text-white/60 max-w-2xl mx-auto text-pretty">
            A transparent pipeline that never hides complexity behind false certainty.
          </p>
        </motion.div>

        {/* Main bento cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              className="group relative"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${feature.bgGradient} rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
              />
              <div className="relative h-full p-8 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-black/5 dark:border-white/5 overflow-hidden">
                {/* Gradient accent */}
                <div
                  className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${feature.gradient} opacity-10 blur-2xl`}
                />

                {/* Content */}
                <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${feature.gradient} mb-6`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>

                <div className="mb-2">
                  <span
                    className={`text-sm font-medium bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}
                  >
                    {feature.title}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-black dark:text-white mb-3">{feature.subtitle}</h3>

                <p className="text-black/60 dark:text-white/60 text-sm leading-relaxed">{feature.description}</p>

                {/* Hover arrow */}
                <div className="mt-6 flex items-center gap-2 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className={`bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>
                    Learn more
                  </span>
                  <ArrowRight className={`w-4 h-4 text-violet-600 group-hover:translate-x-1 transition-transform`} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Secondary features */}
        <div className="grid md:grid-cols-3 gap-4">
          {secondaryFeatures.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="p-5 bg-gray-50/50 dark:bg-gray-900/50 rounded-2xl border border-black/5 dark:border-white/5 flex items-start gap-4"
            >
              <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5">
                <feature.icon className="w-4 h-4 text-black/60 dark:text-white/60" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-black dark:text-white mb-1">{feature.title}</h4>
                <p className="text-xs text-black/50 dark:text-white/50">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
