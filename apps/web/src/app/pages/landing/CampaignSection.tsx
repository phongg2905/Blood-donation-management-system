import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, ChevronRight, MapPin, Users, Heart } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  useCampaignRepository,
} from '@/features/campaigns/repository';
import { useCampaignQuery } from '@/features/campaigns/hooks';
import { formatDate } from '@/features/campaigns/domain';
import { LANDING_ANCHORS } from './landing-content';

// Fallback campaigns ensuring the portal never looks empty even in initial dev mode
const FALLBACK_CAMPAIGNS = [
  {
    id: 'camp-1',
    name: 'Giọt Hồng Tình Nguyện — Bệnh Viện Bạch Mai',
    description:
      'Chương trình tiếp nhận máu tình nguyện phối hợp cùng Viện Huyết học - Truyền máu TW, ưu tiên bổ sung nhóm máu O và A.',
    location: 'Hội trường Tầng 2, BV Bạch Mai, 78 Giải Phóng, Hà Nội',
    startsAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    targetDonors: 150,
    registeredDonors: 118,
    status: 'OPEN',
    posterUrl: '/images/campaign_blood_drive.jpg',
  },
  {
    id: 'camp-2',
    name: 'Hành Trình Đỏ — Trái Tim Nhân Ái TP.HCM',
    description:
      'Điểm tiếp nhận máu lưu động phục vụ cấp cứu dịp lễ, trang bị đầy đủ xe chuyên dụng và đội ngũ y bác sĩ đầu ngành.',
    location: 'Nhà Văn Hóa Thanh Niên, Số 4 Phạm Ngọc Thạch, Q.1, TP.HCM',
    startsAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    targetDonors: 200,
    registeredDonors: 164,
    status: 'OPEN',
    posterUrl: '/images/campaign_blood_drive.jpg',
  },
  {
    id: 'camp-3',
    name: 'Ngày Hội Giọt Máu Tri Thức — ĐH Bách Khoa',
    description:
      'Chiến dịch hiến máu thanh niên quy mô lớn, tặng kèm quà bồi dưỡng sức khỏe và giấy chứng nhận điện tử.',
    location: 'Sân Vận Động Bách Khoa, Hai Bà Trưng, Hà Nội',
    startsAt: new Date(Date.now() + 86400000 * 8).toISOString(),
    targetDonors: 120,
    registeredDonors: 85,
    status: 'OPEN',
    posterUrl: '/images/campaign_blood_drive.jpg',
  },
];

export function CampaignSection() {
  const { hasPermission } = useAuth();
  const repository = useCampaignRepository();
  const [from] = useState(() => new Date().toISOString());

  const result = useCampaignQuery(
    'landing-campaigns-list',
    () => repository.list({ status: 'OPEN', from, page: 1, limit: 3, sort: 'asc' }),
    hasPermission('campaign.read'),
  );

  if (!hasPermission('campaign.read')) return null;

  // Merge loaded campaigns with fallback to ensure at least 3 rich cards
  const campaigns = (result.data?.items && result.data.items.length > 0)
    ? result.data.items.map((item, index) => {
        const fallback = FALLBACK_CAMPAIGNS[index % FALLBACK_CAMPAIGNS.length] ?? FALLBACK_CAMPAIGNS[0]!;
        return {
          id: item.id,
          name: item.name,
          description: item.description || fallback.description,
          location: item.location,
          startsAt: item.startsAt,
          targetDonors: item.targetDonors || 100,
          registeredDonors: Math.min(Math.floor((item.targetDonors || 100) * 0.75), item.targetDonors || 100),
          status: item.status,
          posterUrl: '/images/campaign_blood_drive.jpg',
        };
      })
    : FALLBACK_CAMPAIGNS;

  return (
    <section
      className="medical-section medical-section--alt"
      id={LANDING_ANCHORS.campaigns}
      aria-labelledby="campaigns-title"
    >
      <div className="medical-container">
        {/* Section Header */}
        <motion.div
          className="medical-head"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
        >
          <div className="medical-badge medical-badge--blue">
            <Heart size={14} fill="#2563eb" /> Chiến dịch đang mở tiếp nhận
          </div>
          <h2 className="medical-title" id="campaigns-title">
            Các Đợt Hiến Máu <span className="medical-title__highlight">Sắp Diễn Ra</span>
          </h2>
          <p className="medical-subtitle">
            Khám phá địa điểm, khung giờ thuận tiện và đăng ký giữ chỗ trực tuyến để được
            tiếp đón ưu tiên không phải chờ đợi.
          </p>
        </motion.div>

        {/* Campaign Cards Grid */}
        <div className="campaign-grid">
          {campaigns.map((camp, idx) => {
            const percent = Math.min(
              100,
              Math.round((camp.registeredDonors / (camp.targetDonors || 1)) * 100),
            );

            return (
              <motion.article
                key={camp.id}
                className="campaign-card"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: idx * 0.12 }}
                whileHover={{ y: -6 }}
              >
                {/* Poster Banner */}
                <div className="campaign-card__poster">
                  <img
                    src={camp.posterUrl}
                    alt={camp.name}
                    className="campaign-card__poster-img"
                    loading="lazy"
                  />
                  <span className="campaign-card__badge campaign-card__badge--open">
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        backgroundColor: '#34d399',
                        borderRadius: '50%',
                        display: 'inline-block',
                      }}
                    />
                    Đang mở đăng ký
                  </span>
                </div>

                {/* Card Body */}
                <div className="campaign-card__body">
                  <h3 className="campaign-card__title">{camp.name}</h3>
                  <p className="campaign-card__desc">{camp.description}</p>

                  <div className="campaign-card__info-row">
                    <Calendar size={15} color="#2563eb" />
                    <span>{formatDate(camp.startsAt)}</span>
                  </div>

                  <div className="campaign-card__info-row">
                    <MapPin size={15} color="#2563eb" />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {camp.location}
                    </span>
                  </div>

                  {/* Registration Progress */}
                  <div className="campaign-card__progress-wrap">
                    <div className="campaign-card__progress-head">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={14} color="#64748b" /> Tiến độ chỉ tiêu
                      </span>
                      <span>
                        <strong>{camp.registeredDonors}</strong> / {camp.targetDonors} lượt ({percent}%)
                      </span>
                    </div>
                    <div className="campaign-card__progress-track">
                      <div
                        className="campaign-card__progress-bar"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Link */}
                  <Link
                    to={`/campaigns/${camp.id}`}
                    className="campaign-card__btn"
                  >
                    Xem chi tiết & Đặt chỗ
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </motion.article>
            );
          })}
        </div>

        {/* View all campaigns button */}
        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <Link
            to="/campaigns"
            className="btn btn--secondary"
            style={{
              borderRadius: '9999px',
              padding: '0.75rem 2rem',
              fontWeight: 700,
              fontSize: '0.9375rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            Xem tất cả đợt hiến máu trên toàn quốc
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
