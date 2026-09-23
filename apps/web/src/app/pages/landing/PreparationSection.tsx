import {
  LANDING_ANCHORS,
  LANDING_CHAPTERS,
  PREPARATION_STEPS,
  formatIndex,
} from './landing-content';
import { Reveal } from './Reveal';
import { SectionHead } from './SectionHead';

/**
 * Section 06 — before you donate.
 *
 * Four numbered editorial rows on hairline rules, replacing the old "four
 * identical cards" pattern.
 */
export function PreparationSection() {
  return (
    <section
      className="landing-section landing-section--paper"
      id={LANDING_ANCHORS.preparation}
      aria-labelledby="preparation-title"
    >
      <div className="landing-section__inner">
        <SectionHead
          index={LANDING_CHAPTERS.preparation}
          eyebrow="Trước khi hiến máu"
          titleId="preparation-title"
          title={['Chuẩn bị một buổi sáng', 'thật nhẹ nhàng.']}
          lead="Bốn điều nhỏ giúp buổi hiến máu của bạn diễn ra thuận lợi."
        />

        <Reveal className="landing-prep">
          <ol className="landing-prep__list">
            {PREPARATION_STEPS.map((step, position) => (
              <li className="landing-prep__row" key={step.title}>
                <span className="landing-prep__number" aria-hidden="true">
                  {formatIndex(position + 1)}
                </span>
                <h3 className="landing-prep__title">{step.title}</h3>
                <p className="landing-prep__text">{step.description}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
