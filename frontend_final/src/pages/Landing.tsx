import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import BentoGrid from '@/components/landing/BentoGrid'
import Footer from '@/components/landing/Footer'

export default function Landing() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <BentoGrid />
      <Footer />
    </main>
  )
}
