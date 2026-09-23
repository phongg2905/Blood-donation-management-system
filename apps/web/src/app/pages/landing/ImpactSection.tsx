import { LANDING_ANCHORS, LANDING_CHAPTERS } from './landing-content';
import { Reveal } from './Reveal';

/**
 * Section 04 — the impact scene.
 *
 * Deliberately numberless: the system has no verified donation statistics yet,
 * so the section tells a qualitative story, states that plainly, and carries
 * the page's strongest visual contrast (crimson display type on blush).
 */
export function ImpactSection() {
  return (
    <section
      className="landing-section landing-section--blush landing-impact"
      id={LANDING_ANCHORS.impact}
      aria-labelledby="impact-title"
    >
      <div className="landing-impact__art" aria-hidden="true">
        <svg className="landing-impact__flow" viewBox="0 0 1200 220">
          <path d="M-20 150C160 60 300 210 470 150s310 -90 470 -30 150 60 300 40" />
        </svg>
        <span className="landing-impact__ripple" />
        <span className="landing-impact__ripple landing-impact__ripple--wide" />
      </div>

      <div className="landing-section__inner">
        <Reveal className="landing-impact__scene">
          <p
            className="landing-head__index landing-impact__index"
            aria-hidden="true"
          >
            {LANDING_CHAPTERS.impact}
          </p>
          <p className="landing-eyebrow">Điều bạn trao đi còn ở lại</p>
          <h2 className="landing-impact__title" id="impact-title">
            <span className="landing-impact__line">Một hành động.</span>
            <span className="landing-impact__line">Một cơ hội mới.</span>
          </h2>
          <p className="landing-impact__story">
            Một lần hiến máu có thể góp phần cho một ca cấp cứu, một ca phẫu
            thuật, một ca sinh — những khoảnh khắc mà phía sau là một gia đình
            đang chờ.
          </p>
          <p className="landing-impact__note">
            Số liệu cộng đồng sẽ được cập nhật khi hệ thống kết nối dữ liệu hiến
            máu thật.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
