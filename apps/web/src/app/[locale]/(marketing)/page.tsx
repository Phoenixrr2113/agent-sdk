import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { LandingHero } from '@/features/landing/components/hero'
import { ProblemSection } from '@/features/landing/components/problem-section'
import { SolutionSection } from '@/features/landing/components/solution-section'
import { HowItWorks } from '@/features/landing/components/how-it-works'
import { PlatformCapabilities } from '@/features/landing/components/platform-capabilities'
import { UseCases } from '@/features/landing/components/use-cases'
import { Pricing } from '@/features/landing/components/pricing'
import { CtaSection } from '@/features/landing/components/cta-section'
import { LandingFooter } from '@/features/landing/components/footer'
import { LandingNav } from '@/features/landing/components/nav'

type IIndexProps = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'ControlAI - Device Control Reimagined',
    description: 'The only platform that controls Android, Desktop, and iOS from any browser—with AI-enhanced automation that\'s 8x faster than current solutions.',
  }
}

export default async function Index(props: IIndexProps) {
  const { locale } = await props.params
  setRequestLocale(locale)

  return (
    <main className="min-h-screen bg-background">
      <LandingNav />
      <LandingHero />
      <ProblemSection />
      <SolutionSection />
      <HowItWorks />
      <UseCases />
      <PlatformCapabilities />
      <Pricing />
      <CtaSection />
      <LandingFooter />
    </main>
  )
}
