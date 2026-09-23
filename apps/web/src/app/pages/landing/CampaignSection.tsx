import { useAuth } from '@/features/auth/hooks/useAuth';
import { LANDING_ANCHORS, LANDING_CHAPTERS } from './landing-content';
import { Reveal } from './Reveal';
import { SectionHead } from './SectionHead';

/**
 * Section 05 — upcoming campaigns.
 *
 * Campaigns arrive in Phase 3. Until the API exists the section renders an
 * empty state that names the fields a real campaign will fill in, instead of
 * inventing a schedule. Rendered only for users who may read campaigns.
 */
export function CampaignSection() {
  const { hasPermission } = useAuth();
  if (!hasPermission('campaign.read')) return null;

  return (
    <section
      className="landing-section landing-section--dark"
      id={LANDING_ANCHORS.campaigns}
      aria-labelledby="campaigns-title"
    >
      <div className="landing-section__inner">
        <SectionHead
          index={LANDING_CHAPTERS.campaigns}
          eyebrow="Cơ hội sẻ chia tiếp theo"
          titleId="campaigns-title"
          title={['Đợt hiến máu', 'sắp tới.']}
          lead="Khi một đợt hiến được công bố, bạn sẽ thấy đầy đủ thời gian, địa điểm và số chỗ còn lại ngay tại đây."
        />

        <Reveal className="landing-campaign">
          <p className="landing-campaign__status">
            <span className="landing-campaign__dot" aria-hidden="true" />
            Sắp ra mắt
          </p>
          <h3 className="landing-campaign__title">
            Chưa có đợt hiến máu nào được công bố.
          </h3>
          <p className="landing-campaign__text">
            Chức năng xem đợt hiến và đăng ký trực tuyến đang được chuẩn bị.
            Chúng tôi sẽ hiển thị đúng dữ liệu của đợt hiến thật khi tính năng
            này được mở.
          </p>
          <dl className="landing-campaign__slots">
            <div className="landing-campaign__slot">
              <dt>Thời gian</dt>
              <dd>Chưa công bố</dd>
            </div>
            <div className="landing-campaign__slot">
              <dt>Địa điểm</dt>
              <dd>Chưa công bố</dd>
            </div>
            <div className="landing-campaign__slot">
              <dt>Số chỗ còn lại</dt>
              <dd>Chưa công bố</dd>
            </div>
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
