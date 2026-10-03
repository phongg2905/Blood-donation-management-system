import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Calendar, Droplet, Heart, MapPin, Search } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { LANDING_ANCHORS } from './landing-content';
import { RegistrationAction } from './RegistrationAction';

const CITIES = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Huế',
];

const BLOOD_GROUPS = ['O', 'A', 'B', 'AB'] as const;

export function LandingHero() {
  const { currentUser, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [city, setCity] = useState('Hà Nội');
  const [selectedBlood, setSelectedBlood] = useState<string>('O');
  const [preferredDate, setPreferredDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const firstName = currentUser?.fullName?.trim().split(/\s+/).at(-1) || 'bạn';

  const handleQuickBooking = (e: FormEvent) => {
    e.preventDefault();
    if (hasPermission('registration.create')) {
      navigate('/donor/register');
    } else {
      navigate('/campaigns');
    }
  };

  return (
    <section
      className="portal-hero"
      id={LANDING_ANCHORS.hero}
      aria-labelledby="home-title"
    >
      <div className="medical-container">
        <div className="portal-hero__grid">
          {/* Left Column: Headlines, Trust badges & Information */}
          <motion.div
            className="portal-hero__content"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
          >
            <div className="portal-hero__welcome">
              <span className="portal-hero__welcome-dot" />
              <span>Chào {firstName} · Cổng thông tin Hiến Máu Quốc Gia</span>
            </div>

            <h1 className="portal-hero__title" id="home-title">
              <span style={{ display: 'block', fontSize: '1.15rem', color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Trao một phần máu · Thắp sáng hy vọng
              </span>
              Một Giọt Máu Cho Đi —{' '}
              <span className="portal-hero__title-red">Một Cuộc Đời</span> Ở Lại
            </h1>

            <p className="portal-hero__desc">
              Hệ thống quản lý và điều phối hiến máu số hóa y tế hiện đại. Kết nối
              người hiến máu tình nguyện với các bệnh viện tuyến đầu, mang lại cơ hội
              sống quý báu cho hàng ngàn người bệnh mỗi ngày.
            </p>

            {/* Quick-Booking Form Widget */}
            <div className="quick-booking-card" id={LANDING_ANCHORS.quickBooking}>
              <div className="quick-booking-card__header">
                <h2 className="quick-booking-card__title">
                  <Search size={20} color="#2563eb" />
                  Đặt lịch hiến máu nhanh
                </h2>
                <span className="quick-booking-card__status">
                  <Activity size={14} /> Điểm tiếp nhận mở
                </span>
              </div>

              <form className="quick-booking-form" onSubmit={handleQuickBooking}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                  <div className="quick-form-group">
                    <label className="quick-form-label" htmlFor="quick-city">
                      <MapPin size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#2563eb' }} />
                      Khu vực tiếp nhận
                    </label>
                    <select
                      id="quick-city"
                      className="quick-form-select"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    >
                      {CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="quick-form-group">
                    <label className="quick-form-label" htmlFor="quick-date">
                      <Calendar size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#2563eb' }} />
                      Ngày dự kiến
                    </label>
                    <input
                      id="quick-date"
                      type="date"
                      className="quick-form-input"
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>

                <div className="quick-form-group">
                  <label className="quick-form-label">
                    <Droplet size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#dc2626' }} />
                    Nhóm máu của bạn (hoặc chọn chưa rõ)
                  </label>
                  <div className="quick-blood-grid">
                    {BLOOD_GROUPS.map((group) => (
                      <button
                        key={group}
                        type="button"
                        className={`quick-blood-btn ${selectedBlood === group ? 'quick-blood-btn--active' : ''}`}
                        onClick={() => setSelectedBlood(group)}
                      >
                        Nhóm {group}
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" className="quick-submit-btn">
                  <Heart size={18} fill="currentColor" />
                  Tìm đợt hiến & Đặt lịch ngay
                </button>
              </form>

              <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid #f1f5f9' }}>
                <RegistrationAction />
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="portal-hero__metrics">
              <div className="portal-hero__metric-item">
                <span className="portal-hero__metric-val">4,850+</span>
                <span className="portal-hero__metric-lbl">Đơn vị máu đã tiếp nhận</span>
              </div>
              <div className="portal-hero__metric-item">
                <span className="portal-hero__metric-val">100%</span>
                <span className="portal-hero__metric-lbl">An toàn y tế khép kín</span>
              </div>
              <div className="portal-hero__metric-item">
                <span className="portal-hero__metric-val">24+</span>
                <span className="portal-hero__metric-lbl">Bệnh viện liên kết</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column: High Quality Medical Visual & Floating Motion Badges */}
          <div className="portal-hero__visual-wrap">
            {/* Floating Badge 1: Health & Safety Pulse */}
            <motion.div
              className="floating-badge floating-badge--top-left"
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            >
              <div className="floating-badge__icon-wrap floating-badge__icon-wrap--blue">
                <Activity size={24} />
              </div>
              <div>
                <div className="floating-badge__title">100% Vô Trùng Y Tế</div>
                <div className="floating-badge__desc">Quy trình chuẩn Bộ Y Tế</div>
              </div>
            </motion.div>

            {/* Main Doctor & Volunteer Image */}
            <div className="portal-hero__img-frame">
              <img
                src="/images/medical_hero_doctor.jpg"
                alt="Đội ngũ bác sĩ và tình nguyện viên hiến máu"
                className="portal-hero__img"
                width={800}
                height={600}
                loading="eager"
              />
            </div>

            {/* Floating Badge 2: Urgent Need Alert */}
            <motion.div
              className="floating-badge floating-badge--bottom-right"
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut', delay: 0.5 }}
            >
              <div className="floating-badge__icon-wrap floating-badge__icon-wrap--red">
                <Droplet size={24} fill="#dc2626" />
              </div>
              <div>
                <div className="floating-badge__title">Cần gấp nhóm máu O</div>
                <div className="floating-badge__desc">Dự trữ cấp cứu tuyến đầu</div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
