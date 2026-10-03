import { LandingHero } from './landing/LandingHero';
import { CampaignSection } from './landing/CampaignSection';
import { ImpactSection } from './landing/ImpactSection';
import { DonationJourneySection } from './landing/DonationJourneySection';
import { StoriesFaqSection } from './landing/StoriesFaqSection';
import { LandingFooter } from './landing/LandingFooter';

/**
 * Clean Modern Medical Portal - Landing Page
 *
 * Implements a high-trust, accessible, modern healthcare experience:
 * 1. Hero with interactive quick-booking widget and floating medical badges
 * 2. Active open campaigns with capacity progress indicators
 * 3. Real-time blood supply levels and verified impact metrics (Bento grid)
 * 4. 4-step digitalized donation journey
 * 5. Medical testimonials and interactive FAQ accordion
 * 6. Standard healthcare regulatory footer
 */
export function HomePage() {
  return (
    <div className="medical-landing">
      {/* 1. Hero Section */}
      <LandingHero />

      {/* 2. Active Campaigns Section */}
      <CampaignSection />

      {/* 3. Impact & Real-time Blood Needs (Bento Grid) */}
      <ImpactSection />

      {/* 4. 4-Step Digital Donation Journey */}
      <DonationJourneySection />

      {/* 5. Stories & Medical FAQ Accordion */}
      <StoriesFaqSection />

      {/* 6. Medical Portal Footer */}
      <LandingFooter />
    </div>
  );
}
