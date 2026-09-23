import { LANDING_ANCHORS, LANDING_CHAPTERS } from './landing-content';
import { Reveal } from './Reveal';
import { SectionHead } from './SectionHead';

/** Points that explain what a donor can expect, shown as editorial rows. */
const STORY_POINTS = [
  {
    title: 'An toàn',
    text: 'Quy trình lấy máu khép kín, dụng cụ dùng một lần cho mỗi người hiến.',
  },
  {
    title: 'Được tư vấn',
    text: 'Bạn được nhân viên y tế khám và giải thích trước khi hiến.',
  },
  {
    title: 'Minh bạch',
    text: 'Bạn nắm rõ kết quả sàng lọc và các bước tiếp theo sau khi hiến.',
  },
];

/**
 * Section 02 — the human story.
 *
 * Replaces the old three feature cards: an oversized statement, a duotone
 * image, a pull quote and hairline detail rows.
 */
export function HumanStorySection() {
  return (
    <section
      className="landing-section landing-section--ivory"
      id={LANDING_ANCHORS.humanStory}
      aria-labelledby="story-title"
    >
      <div className="landing-section__inner">
        <SectionHead
          index={LANDING_CHAPTERS.humanStory}
          eyebrow="Vì sao chúng tôi bắt đầu"
          titleId="story-title"
          title={['Một quyết định nhỏ.', 'Một hy vọng rất lớn.']}
          lead="Hiến máu không đòi hỏi điều gì phi thường. Nó chỉ cần một người dành một buổi sáng của mình cho một người mình chưa từng gặp."
        />

        <div className="landing-story">
          <Reveal className="landing-story__media">
            <figure className="landing-story__figure">
              <span className="landing-story__frame">
                <img
                  src="/images/auth-blood-donation.png"
                  alt=""
                  width={1672}
                  height={941}
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <figcaption className="landing-story__caption">
                Một đợt hiến máu — nơi những hành trình gặp nhau.
              </figcaption>
            </figure>
            <p className="landing-story__quote">
              Một hành động có thể mở ra hy vọng cho một người khác.
            </p>
          </Reveal>

          <Reveal className="landing-story__points" delay={120}>
            <h3 className="landing-story__points-title">
              Điều bạn có thể yên tâm
            </h3>
            <ul className="landing-story__list">
              {STORY_POINTS.map((point) => (
                <li className="landing-story__item" key={point.title}>
                  <h4 className="landing-story__item-title">{point.title}</h4>
                  <p className="landing-story__item-text">{point.text}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
