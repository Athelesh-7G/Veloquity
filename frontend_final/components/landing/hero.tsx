"use client"

import React, { useRef } from "react"
import { motion, useScroll, useTransform, useSpring, useMotionTemplate, useMotionValue } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play, Sparkles, Activity } from "lucide-react"
import { AppMockup } from "./app-mockup" // Ensure this component exists or replace with placeholder
import { cn } from "@/lib/utils"

// --- UTILITY: MOUSE TRACKING SPOTLIGHT (UPDATED: RED GLOW) ---
function Spotlight({ className, size = 400 }: { className?: string; size?: number }) {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect()
    mouseX.set(clientX - left)
    mouseY.set(clientY - top)
  }

  return (
    <div
      className={cn("absolute inset-0 overflow-hidden", className)}
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              ${size}px circle at ${mouseX}px ${mouseY}px,
              rgba(220, 38, 38, 0.10), 
              transparent 80%
            )
          `, // Changed to Red-600 opacity
        }}
      />
    </div>
  )
}

export function Hero() {
  const ref = useRef<HTMLDivElement>(null)
  
  // Parallax Scroll Hooks
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const yBackground = useTransform(scrollYProgress, [0, 1], ["0%", "50%"])
  const yText = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])

  // Mouse Parallax for 3D Elements
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [7, -7]), { stiffness: 150, damping: 20 })
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-7, 7]), { stiffness: 150, damping: 20 })

  const handleMouseMove = (e: React.MouseEvent) => {
    const { width, height, left, top } = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - left) / width - 0.5
    const y = (e.clientY - top) / height - 0.5
    mouseX.set(x)
    mouseY.set(y)
  }

  return (
    <section 
      ref={ref}
      onMouseMove={handleMouseMove}
      // UPDATED: Deep Black/Red background, Red selection color
      className="relative min-h-[110vh] flex items-center justify-center overflow-hidden bg-[#050000] selection:bg-red-600/30"
    >
      {/* =========================================
          LAYER 0: DYNAMIC ATMOSPHERE (RED/BLACK/BLUE)
      ========================================= */}
      
      {/* 1. Cyber Grid Floor - Subtle Red Tint */}
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] bg-[length:50px_50px] opacity-[0.03] [mask-image:linear-gradient(to_bottom,transparent,black)] hue-rotate-[320deg] saturate-200" />

      {/* 2. Noise Texture */}
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} 
      />

      {/* 3. Animated Gradient Orbs (UPDATED COLORS) */}
      <motion.div style={{ y: yBackground }} className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Dominant Red Orb (Top Left) */}
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-red-700/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" />
        
        {/* Cold Blue Logic Orb (Top Right) - Provides the contrast */}
        <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] bg-blue-900/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow delay-1000" />
        
        {/* Deep Violet/Black Orb (Bottom) */}
        <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] bg-indigo-950/30 rounded-full blur-[150px] mix-blend-screen" />
      </motion.div>

      {/* =========================================
          LAYER 1: CONTENT CONTAINER
      ========================================= */}
      <div className="container relative z-10 max-w-7xl mx-auto px-6 py-20 lg:py-0">
        
        {/* Spotlights tracking mouse - RED Tinted */}
        <Spotlight className="z-0 pointer-events-none mix-blend-screen" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-8 items-center">
          
          {/* --- LEFT COLUMN: CONTENT --- */}
          <motion.div 
            style={{ y: yText }}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-start text-left space-y-8 relative z-20"
          >
            {/* Logo Badge - Red/Black Aesthetic */}
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center space-x-2 bg-white/5 border border-red-500/20 rounded-full px-4 py-1.5 backdrop-blur-md shadow-[0_0_15px_-5px_rgba(220,38,38,0.3)]"
            >
              <Sparkles className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-100/80"> Intelligence Engine v1.0</span>
            </motion.div>

            {/* Typography */}
            <div className="space-y-6 relative">
              <h1 className="text-6xl lg:text-8xl font-bold tracking-tighter text-white leading-[1] drop-shadow-2xl">
                Reason <br />
                <span className="relative">
                   over Chaos.
                   {/* Underline decorative - Red Gradient */}
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: "100%" }}
                     transition={{ delay: 1, duration: 1 }}
                     className="absolute bottom-1 left-0 h-2 bg-gradient-to-r from-red-600 via-red-500 to-transparent opacity-60"
                   />
                </span>
              </h1>
              
              {/* H2 Gradient - Red to White to faint Blue */}
              <h2 className="text-3xl lg:text-4xl font-light tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-white to-blue-200">
                Turn messy feedback into <br/> structured, evidence-backed insights.
              </h2>
              
              <p className="text-lg text-zinc-400 max-w-lg leading-relaxed">
                Stop guessing. Build with clarity using an intelligence engine that analyzes raw feedback, surfaces meaningful patterns, and presents transparent evidence behind every product signal with absolute traceability.
              </p>
            </div>

            {/* High-Fidelity Buttons - Red Primary */}
            <div className="flex flex-wrap gap-5 pt-4">
              <Link href="/app">
                <Button size="lg" className="group relative h-14 px-8 rounded-full bg-red-700 hover:bg-red-600 text-white overflow-hidden transition-all hover:scale-105 shadow-[0_0_40px_-10px_rgba(220,38,38,0.5)] border border-red-500/20">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-shimmer" />
                  <span className="relative font-bold text-lg flex items-center">
                    Launch Engine <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Button>
              </Link>
              
              <Button variant="outline" size="lg" className="h-14 px-8 rounded-full border-white/10 bg-white/5 hover:bg-white/10 hover:border-red-500/30 text-white backdrop-blur-md text-lg transition-all hover:scale-105">
                <Play className="mr-2 w-4 h-4 fill-white" />
                Watch Demo
              </Button>
            </div>
          </motion.div>

          {/* --- RIGHT COLUMN: 3D INTERACTIVE MOCKUP --- */}
          <div className="relative flex items-center justify-center lg:h-[800px] perspective-[2000px] z-10">
            
            {/* Giant Watermark Text */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 2 }}
              className="absolute -right-0 top-[10%] z-0 select-none pointer-events-none opacity-[0.03]"
            >
              <h2 className="text-[70px] font-black leading-none text-red-500 tracking-widest vertical-rl writing-mode-vertical mix-blend-difference">
                VELOQUITY
              </h2>
            </motion.div>

            {/* The 3D Container */}
            <motion.div
              style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
              initial={{ opacity: 0, scale: 0.8, y: 100 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1, type: "spring", bounce: 0.2 }}
              className="relative w-full max-w-[650px]"
            >
              {/* Floating Element 1: Top Right (Logic/Analysis) */}
              <motion.div 
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -right-12 -top-12 z-50 w-48 p-4 bg-black/60 backdrop-blur-xl border border-blue-500/30 rounded-2xl shadow-[0_0_30px_-10px_rgba(59,130,246,0.3)]"
                style={{ transform: "translateZ(50px)" }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                  <span className="text-xs font-mono text-blue-400">ANALYSIS COMPLETE</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                   <div className="h-full w-[85%] bg-blue-500 rounded-full" />
                </div>
              </motion.div>

              {/* Floating Element 2: Decorative Gradient Blur behind Mockup (Red/Blue Clash) */}
              <div className="absolute inset-0 bg-gradient-to-tr from-red-600/20 to-blue-600/20 blur-[60px] rounded-full -z-10 animate-pulse-slow" />

              {/* MAIN MOCKUP WRAPPER */}
              <div 
                className="group relative bg-[#050000]/90 rounded-xl border border-white/10 p-2 shadow-[0_0_60px_-15px_rgba(220,38,38,0.3)] ring-1 ring-white/5"
                style={{ transform: "translateZ(20px)" }}
              >
                {/* Reflection effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-xl pointer-events-none z-50" />
                
                <AppMockup />

                {/* Bottom Highlight - Red to Blue gradient */}
                <div className="absolute -bottom-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-70 blur-sm" />
              </div>

              {/* Floating Element 3: Bottom Left (Confidence Score) */}
              <motion.div 
                animate={{ y: [0, 20, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -left-8 -bottom-8 z-50 w-40 h-24 bg-gradient-to-br from-red-950/80 to-black/80 backdrop-blur-xl border border-red-500/20 rounded-2xl shadow-2xl flex flex-col items-center justify-center"
                style={{ transform: "translateZ(80px)" }}
              >
                 <span className="text-xs text-red-300 font-mono tracking-wider mb-1">CONFIDENCE</span>
                 <span className="text-4xl font-bold text-white drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]">98%</span>
              </motion.div>

            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
