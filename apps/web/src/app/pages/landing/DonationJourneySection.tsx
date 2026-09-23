import {
  DONATION_JOURNEY,
  LANDING_ANCHORS,
  LANDING_CHAPTERS,
  formatIndex,
} from './landing-content';
import { Reveal } from './Reveal';
import { SectionHead } from './SectionHead';

/**
 * Section 03 — the donation journey.
 *
 * A horizontal editorial timeline on wide screens (one continuous hairline
 * carrying five numbered steps) that becomes a vertical timeline on smaller
 * screens. No cards.
 */
export function DonationJourneySection() {
  return (
    <section
      className="landing-section landing-section--dark"
      id={LANDING_ANCHORS.journey}
      aria-labelledby="journey-title"
    >
      <div className="landing-section__inner">
        <SectionHead
          index={LANDING_CHAPTERS.journey}
          eyebrow="Hành trình hiến máu"
          titleId="journey-title"
          title={['Năm bước,', 'một sự đồng hành.']}
          lead="Từ khi bạn sẵn lòng đến lúc món quà được trao đi."
        />

        <Reveal className="landing-journey">
          <ol className="landing-journey__list">
            {DONATION_JOURNEY.map((step, position) => (
              <li className="landing-journey__step" key={step.title}>
                <span className="landing-journey__number" aria-hidden="true">
                  {formatIndex(position + 1)}
                </span>
                <h3 className="landing-journey__title">{step.title}</h3>
                <p className="landing-journey__text">{step.description}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
