import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, Database, Shield, GitBranch, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface OnboardingTourProps {
  isOpen: boolean
  onClose: () => void
}

const tourSteps = [
  { icon: Sparkles, title: 'Welcome to Veloquity', description: "Your evidence-grounded decision support system. Let's take a quick tour of the key features that will help you reason over messy feedback.", gradient: 'from-blue-500 to-violet-500' },
  { icon: Database, title: 'Data Studio', description: 'Import and manage feedback from any source. Search, filter, and organize signals while maintaining full traceability to their origins.', gradient: 'from-blue-500 to-cyan-500' },
  { icon: Shield, title: 'Evidence Grid', description: 'See how feedback clusters into evidence with explicit confidence scores and uncertainty ranges. Never hide complexity behind a single number.', gradient: 'from-violet-500 to-purple-500' },
  { icon: GitBranch, title: 'Decision Playground', description: 'Explore scenarios by adjusting thresholds. Understand how different confidence levels affect your roadmap priorities.', gradient: 'from-orange-500 to-rose-500' },
]

export default function OnboardingTour({ isOpen, onClose }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onClose()
      setCurrentStep(0)
    }
  }

  const handleSkip = () => {
    onClose()
    setCurrentStep(0)
  }

  const step = tourSteps[currentStep]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-background rounded-2xl shadow-2xl overflow-hidden"
          >
            <button onClick={handleSkip} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors z-10">
              <X className="w-4 h-4" />
            </button>
            <div className={`h-2 bg-gradient-to-r ${step.gradient}`} />
            <div className="p-8">
              <AnimatePresence mode="wait">
                <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                  <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${step.gradient} mb-6`}>
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-3">{step.title}</h2>
                  <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                </motion.div>
              </AnimatePresence>
              <div className="flex items-center justify-between mt-8">
                <div className="flex gap-2">
                  {tourSteps.map((_, i) => (
                    <button key={i} onClick={() => setCurrentStep(i)} className={`w-2 h-2 rounded-full transition-all ${i === currentStep ? `bg-gradient-to-r ${step.gradient} w-6` : 'bg-muted hover:bg-muted-foreground/30'}`} />
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">Skip tour</Button>
                  <Button onClick={handleNext} className={`bg-gradient-to-r ${step.gradient} text-white hover:opacity-90`}>
                    {currentStep === tourSteps.length - 1 ? 'Get Started' : 'Next'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
