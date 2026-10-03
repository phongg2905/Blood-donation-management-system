import { motion } from 'framer-motion';
import { Award, Calendar, QrCode, Stethoscope, ArrowRight } from 'lucide-react';
import { DIGITAL_JOURNEY_STEPS, LANDING_ANCHORS } from './landing-content';

const ICONS = {
  calendar: Calendar,
  qr: QrCode,
  stethoscope: Stethoscope,
  award: Award,
};

export function DonationJourneySection() {
  return (
    <section
      className="medical-section medical-section--alt"
      id={LANDING_ANCHORS.journey}
      aria-labelledby="journey-title"
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
            <QrCode size={14} /> Quy trình số hóa y tế 4.0
          </div>
          <h2 className="medical-title" id="journey-title">
            Hành Trình Hiến Máu <span className="medical-title__highlight">4 Bước Tinh Gọn</span>
          </h2>
          <p className="medical-subtitle">
            Trải nghiệm hiến máu hiện đại không còn thủ tục giấy tờ rườm rà. Mọi thông tin được
            số hóa an toàn, minh bạch từ khi bạn đăng ký đến lúc nhận chứng nhận.
          </p>
        </motion.div>

        {/* 4 Connected Step Cards */}
        <div className="journey-timeline">
          {DIGITAL_JOURNEY_STEPS.map((step, idx) => {
            const IconComponent = ICONS[step.iconName] || Calendar;

            return (
              <motion.div
                key={step.step}
                className="journey-step-card"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.5, delay: idx * 0.12 }}
                whileHover={{ y: -6 }}
              >
                <div className="journey-step-card__top">
                  <span className="journey-step-card__num">{step.step}</span>
                  <div className="journey-step-card__icon-box">
                    <IconComponent size={24} />
                  </div>
                </div>

                <span className="journey-step-card__badge">{step.badge}</span>
                <h3 className="journey-step-card__title">{step.title}</h3>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#2563eb', marginBottom: '0.4rem' }}>
                  {step.subtitle}
                </div>
                <p className="journey-step-card__desc">{step.description}</p>
              </motion.div>
            );
          })}
        </div>

        {/* CTA banner below journey */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{
            marginTop: '3.5rem',
            background: 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)',
            borderRadius: '1.25rem',
            padding: '2rem 2.5rem',
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.5rem',
            boxShadow: '0 12px 30px -5px rgba(37, 99, 235, 0.25)',
          }}
        >
          <div>
            <h4 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.35rem' }}>
              Bạn đã sẵn sàng tham gia đợt hiến máu gần nhất?
            </h4>
            <p style={{ fontSize: '0.9375rem', color: '#bfdbfe', margin: 0 }}>
              Chỉ mất 20 phút của bạn để tiếp thêm sự sống cho một người bệnh đang chờ.
            </p>
          </div>
          <a
            href={`#${LANDING_ANCHORS.quickBooking}`}
            className="btn btn--primary"
            style={{
              backgroundColor: '#ffffff',
              color: '#1e3a8a',
              fontWeight: 700,
              borderRadius: '9999px',
              padding: '0.75rem 1.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: 'none',
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
            }}
          >
            Đăng ký ngay bây giờ
            <ArrowRight size={16} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
