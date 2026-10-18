import { LandingHero } from './landing/LandingHero';
import { CampaignSection } from './landing/CampaignSection';
import { DonationJourneySection } from './landing/DonationJourneySection';
import { LandingFooter } from './landing/LandingFooter';

/**
 * Modern Clean Medical Portal — Landing Page
 *
 * Designed to match the visual-first mockup:
 * 1. Cinematic Hero with Floating Glass Interactive Blood Dock & 24/7 Dispatch Radar
 * 2. Current Hospital Demands (Deep Navy full-bleed band with 3 key hospital hubs)
 * 3. Your Journey: Easy 3-Step Process (Connected horizontal timeline)
 * 4. Minimal Regulatory Footer
 */
export function HomePage() {
  return (
    <div className="sketch-landing">
      {/* 1. Hero with Floating Interactive Blood Dock */}
      <LandingHero />

      {/* 2. Current Hospital Demands (Deep Navy Band) */}
      <CampaignSection />

      {/* 3. Your Journey: Easy 3-Step Process */}
      <DonationJourneySection />

      {/* 4. Minimal Modern Footer */}
      <LandingFooter />
    </div>
  );
}
