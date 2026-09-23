import { useAuth } from '@/features/auth/hooks/useAuth';
import { Link } from 'react-router-dom';
import { LANDING_ANCHORS } from './landing-content';
import { Reveal } from './Reveal';

/**
 * Section 08 — the closing scene.
 *
 * The primary action returns to the cover, which carries the page's single
 * registration control and states that online registration is not open yet.
 * Visitors without the registration capability get the journey instead of a
 * dead end.
 */
export function FinalCtaSection() {
  const { hasPermission } = useAuth();
  const canRegister = hasPermission('registration.create');

  return (
    <section
      className="landing-section landing-section--closing"
      aria-labelledby="closing-title"
    >
      <div className="landing-closing__glow" aria-hidden="true" />
      <div className="landing-section__inner">
        <Reveal className="landing-closing">
          <p className="landing-eyebrow">Bắt đầu từ sự sẵn lòng</p>
          <h2 className="landing-closing__title" id="closing-title">
            Sẵn sàng bắt đầu hành trình của bạn?
          </h2>
          <p className="landing-closing__lead">
            Một hành động nhỏ hôm nay có thể là một khởi đầu rất lớn cho một
            người khác.
          </p>

          <div className="landing-closing__actions">
            {hasPermission('campaign.read') && (
              <Link className="btn btn--primary landing-cta" to="/campaigns">
                Khám phá đợt hiến
              </Link>
            )}
            {canRegister ? (
              <>
                <a
                  className="btn btn--primary landing-cta"
                  href={`#${LANDING_ANCHORS.hero}`}
                >
                  Đăng ký hiến máu
                </a>
                <p className="landing-closing__note">
                  Đăng ký trực tuyến sắp ra mắt — chúng tôi sẽ mở khi đợt hiến
                  đầu tiên được công bố.
                </p>
              </>
            ) : (
              <a
                className="btn btn--secondary landing-cta"
                href={`#${LANDING_ANCHORS.journey}`}
              >
                Tìm hiểu hành trình hiến máu
              </a>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
