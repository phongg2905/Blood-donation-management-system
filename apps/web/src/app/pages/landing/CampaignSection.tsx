import { useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Link } from 'react-router-dom';
import {
  useCampaignRepository,
  mockCampaignsEnabled,
} from '@/features/campaigns/repository';
import { useCampaignQuery } from '@/features/campaigns/hooks';
import { formatDate } from '@/features/campaigns/domain';
import { LANDING_ANCHORS, LANDING_CHAPTERS } from './landing-content';
import { Reveal } from './Reveal';
import { SectionHead } from './SectionHead';

/**
 * Section 05 — upcoming campaigns.
 *
 * Uses the same repository as the campaign pages, with development fixtures
 * explicitly labelled. Rendered only for users who may read campaigns.
 */
export function CampaignSection() {
  const { hasPermission } = useAuth();
  const repository = useCampaignRepository();
  const [from] = useState(() => new Date().toISOString());
  const result = useCampaignQuery(
    'landing-upcoming',
    () =>
      repository.list({ status: 'OPEN', from, page: 1, limit: 1, sort: 'asc' }),
    hasPermission('campaign.read'),
  );
  const campaign = result.data?.items[0];
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
          lead="Tìm thời gian và địa điểm phù hợp để cùng cộng đồng sẻ chia sự sống."
        />

        <Reveal className="landing-campaign">
          <p className="landing-campaign__status">
            <span className="landing-campaign__dot" aria-hidden="true" />
            {mockCampaignsEnabled
              ? 'Dữ liệu minh họa · Phát triển'
              : 'Cơ hội sẻ chia'}
          </p>
          <h3 className="landing-campaign__title">
            {result.loading
              ? 'Đang tìm đợt hiến sắp tới…'
              : result.error
                ? 'Chưa thể tải lịch hiến máu.'
                : (campaign?.name ?? 'Chưa có đợt hiến máu nào được công bố.')}
          </h3>
          <p className="landing-campaign__text">
            {campaign?.description ??
              'Khám phá danh sách đợt hiến để xem lịch và thông tin chi tiết. Đăng ký trực tuyến sắp ra mắt.'}
          </p>
          <dl className="landing-campaign__slots">
            <div className="landing-campaign__slot">
              <dt>Thời gian</dt>
              <dd>
                {campaign ? formatDate(campaign.startsAt) : 'Chưa công bố'}
              </dd>
            </div>
            <div className="landing-campaign__slot">
              <dt>Địa điểm</dt>
              <dd>{campaign?.location ?? 'Chưa công bố'}</dd>
            </div>
            <div className="landing-campaign__slot">
              <dt>Chỉ tiêu người hiến</dt>
              <dd>
                {campaign?.targetDonors?.toLocaleString('vi-VN') ??
                  'Chưa công bố'}
              </dd>
            </div>
          </dl>
          <Link
            className="btn btn--primary"
            to={campaign ? `/campaigns/${campaign.id}` : '/campaigns'}
          >
            {campaign ? 'Xem chi tiết đợt hiến' : 'Khám phá đợt hiến'}
          </Link>
          {result.error ? (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={result.retry}
            >
              Thử lại
            </button>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}
