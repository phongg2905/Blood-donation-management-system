import { CampaignSection } from './landing/CampaignSection';
import { DonationJourneySection } from './landing/DonationJourneySection';
import { FinalCtaSection } from './landing/FinalCtaSection';
import { HumanStorySection } from './landing/HumanStorySection';
import { ImpactSection } from './landing/ImpactSection';
import { LandingHero } from './landing/LandingHero';
import { PersonalActionsSection } from './landing/PersonalActionsSection';
import { PreparationSection } from './landing/PreparationSection';
import { useLandingPaging } from './landing/useLandingPaging';
import { usePagedScroll } from './landing/usePagedScroll';

/**
 * Authenticated landing page.
 *
 * Read top to bottom as a story: a cover, why we show up, the donor's journey,
 * what a donation leaves behind, the next campaigns, how to prepare, where to
 * continue, and a closing invitation. Each section owns its own composition and
 * rhythm; this module only sets the order.
 *
 * On desktop every chapter fills one screen and one gesture turns one page;
 * `useLandingPaging` decides when that is safe and degrades to gentle snapping
 * when a chapter no longer fits the viewport, and `usePagedScroll` animates the
 * page turn itself.
 */
export function HomePage() {
  useLandingPaging();
  usePagedScroll();

  return (
    <div className="landing">
      <LandingHero />
      <HumanStorySection />
      <DonationJourneySection />
      <ImpactSection />
      <CampaignSection />
      <PreparationSection />
      <PersonalActionsSection />
      <FinalCtaSection />
    </div>
  );
}
