import { useAuth } from '@/features/auth/hooks/useAuth';
import { LANDING_ANCHORS } from './landing-content';
import { RegistrationAction } from './RegistrationAction';

/**
 * Section 01 — the cover.
 *
 * Left: a personal greeting, an eyebrow, an oversized statement and the two
 * calls to action. Right: an art-directed blood drop — rings of circulation, a
 * flowing line and the drop itself — built from CSS and inline SVG, so the
 * cover ships no extra image weight.
 */
export function LandingHero() {
  const { currentUser, hasPermission } = useAuth();
  const firstName = currentUser?.fullName.trim().split(/\s+/).at(-1);

  return (
    <section
      className="landing-hero"
      id={LANDING_ANCHORS.hero}
      aria-labelledby="home-title"
    >
      <div className="landing-hero__grid">
        <div className="landing-hero__copy">
          <p className="landing-hero__greeting">
            Chào {firstName || 'bạn'}, sẵn sàng tạo nên một điều ý nghĩa hôm
            nay?
          </p>
          {/* The cover is deliberately unnumbered: the numbered story starts
              with the section below it. */}
          <p className="landing-eyebrow">
            Hệ thống quản lý hiến máu · Cộng đồng sẻ chia
          </p>
          <h1 className="landing-hero__title" id="home-title">
            <span className="landing-hero__line">Trao một phần máu.</span>
            <span className="landing-hero__line landing-hero__line--accent">
              Thắp lên một hành trình.
            </span>
          </h1>
          <p className="landing-hero__lead">
            Mỗi sự sẵn lòng đều mở ra một cơ hội sống. Hành trình hiến máu của
            bạn bắt đầu từ một bước rất nhỏ — và chúng tôi đồng hành cùng bạn
            trên từng bước.
          </p>{' '}
          <div className="landing-hero__actions">
            <RegistrationAction />
            {hasPermission('campaign.read') ? (
              <a
                className="landing-link landing-link--inverse"
                href={`#${LANDING_ANCHORS.campaigns}`}
              >
                Khám phá đợt hiến
                <span className="landing-link__mark" aria-hidden="true">
                  ↗
                </span>
              </a>
            ) : null}
          </div>
        </div>

        <figure className="landing-hero__visual">
          <div className="landing-hero__art" aria-hidden="true">
            <svg className="landing-hero__rings" viewBox="0 0 480 480">
              <circle cx="240" cy="240" r="142" />
              <circle cx="240" cy="240" r="192" />
              <circle cx="240" cy="240" r="236" />
            </svg>
            <svg className="landing-hero__flow" viewBox="0 0 24 440">
              <path d="M12 -12C46 74 -22 150 12 224s34 152 0 228" />
            </svg>
            <span className="landing-hero__drop" />
          </div>
          <figcaption className="landing-hero__caption">
            Mỗi giọt máu trao đi là một nhịp sống được nối dài.
          </figcaption>
        </figure>
      </div>

      <a
        className="landing-hero__scroll"
        href={`#${LANDING_ANCHORS.humanStory}`}
      >
        <span className="landing-hero__scroll-label">Cuộn để bắt đầu</span>
        <span className="landing-hero__scroll-line" aria-hidden="true" />
      </a>
    </section>
  );
}
