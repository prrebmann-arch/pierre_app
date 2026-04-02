import Navbar from '@/components/layout/Navbar'
import Hero from '@/components/landing/Hero'
import Features from '@/components/landing/Features'
import HowItWorks from '@/components/landing/HowItWorks'
import Pricing from '@/components/landing/Pricing'
import SocialProof from '@/components/landing/SocialProof'
import FinalCTA from '@/components/landing/FinalCTA'
import Footer from '@/components/layout/Footer'

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <SocialProof />
      <FinalCTA />
      <Footer />
    </>
  )
}
