import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2,
  Calendar,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCampaignRepository } from '@/features/campaigns/repository';
import { useCampaignQuery } from '@/features/campaigns/hooks';
import { formatDate } from '@/features/campaigns/domain';
import { LANDING_ANCHORS } from './landing-content';

interface HospitalDemandCard {
  id: string;
  name: string;
  location: string;
  startsAt: string;
  targetDonors: number;
  registeredDonors: number;
  needDescription: string;
  statusBadge: 'Critical' | 'High Priority' | 'Active';
}

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

  // Use real backend items only
  const displayItems = useMemo(() => {
    if (result.data?.items && result.data.items.length > 0) {
      return result.data.items.map((item) => ({
        id: item.id,
        name: item.name,
        location: item.location,
        startsAt: item.startsAt,
        targetDonors: item.targetDonors || 100,
        registeredDonors: 0,
        needDescription: 'Tiếp nhận hiến máu tình nguyện',
        statusBadge: 'Active' as const,
      }));
    }
    return [];
  }, [result.data]);

  return (
    <section
      className="sketch-demands-section"
      id={LANDING_ANCHORS.campaigns}
      aria-labelledby="campaigns-title"
    >
      <div className="sketch-container">
        {/* Section Header */}
        <motion.div
          className="sketch-section-head"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
        >
          <span className="sketch-section-pill">
            <Building2 size={14} color="#60a5fa" />
            ĐIỂM HIẾN MÁU MỞ
          </span>
          <h2 className="sketch-section-title" id="campaigns-title">
            Điểm Tiếp Nhận & <span className="sketch-title-highlight">Lịch Hiến Máu</span>
          </h2>
          <p className="sketch-section-sub">
            Theo dõi nhu cầu cấp thiết và đặt lịch tại các điểm tiếp nhận đang mở.
          </p>
        </motion.div>

        {displayItems.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 1.5rem',
              color: 'rgba(255, 255, 255, 0.7)',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginTop: '1.5rem',
            }}
          >
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>
              Hiện chưa có đợt hiến máu nào đang mở tiếp nhận. Vui lòng theo dõi các thông báo mới nhất.
            </p>
          </div>
        ) : (
          <div className="sketch-demands-grid">
          {displayItems.slice(0, 3).map((item, idx) => {
            const percent = Math.min(
              100,
              Math.round((item.registeredDonors / (item.targetDonors || 1)) * 100),
            );

            return (
              <motion.article
                key={item.id}
                className="sketch-demand-card"
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <div className="sketch-demand-card__head">
                  <div className="sketch-demand-card__hospital-name">
                    <span className="sketch-demand-card__num">{idx + 1}.</span>
                    <h3>{item.name}</h3>
                  </div>
                  <span
                    className={`sketch-status-badge sketch-status-badge--${item.statusBadge.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {item.statusBadge}
                  </span>
                </div>

                <div className="sketch-demand-card__need-row">
                  <span className="sketch-demand-card__need-label">{item.needDescription}</span>
                  <span className="sketch-demand-card__need-percent">{percent}%</span>
                </div>

                <div className="sketch-demand-progress-track">
                  <div
                    className={`sketch-demand-progress-bar sketch-demand-progress-bar--${item.statusBadge.toLowerCase().replace(/\s+/g, '-')}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="sketch-demand-card__meta">
                  <div className="sketch-meta-line">
                    <Calendar size={14} color="#94a3b8" />
                    <span>{formatDate(item.startsAt)}</span>
                  </div>
                  <div className="sketch-meta-line">
                    <MapPin size={14} color="#94a3b8" />
                    <span title={item.location}>{item.location}</span>
                  </div>
                </div>

                <Link
                  to={`/campaigns/${item.id}`}
                  className="sketch-demand-card__link"
                >
                  <span>Xem chi tiết & Đặt chỗ</span>
                  <ChevronRight size={16} />
                </Link>
              </motion.article>
            );
          })}
        </div>
      )}

        {/* View All Button */}
        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <Link
            to="/campaigns"
            className="sketch-btn-outline-glow"
          >
            Tra cứu tất cả điểm hiến máu trên toàn quốc
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
