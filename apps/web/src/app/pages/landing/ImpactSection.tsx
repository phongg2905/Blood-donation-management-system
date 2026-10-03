import { motion } from 'framer-motion';
import { Activity, AlertCircle, CheckCircle2, Droplet, ShieldCheck } from 'lucide-react';
import {
  BLOOD_GROUP_NEEDS,
  IMPACT_METRICS,
  LANDING_ANCHORS,
} from './landing-content';

export function ImpactSection() {
  return (
    <section
      className="medical-section"
      id={LANDING_ANCHORS.impact}
      aria-labelledby="impact-title"
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
          <div className="medical-badge medical-badge--red">
            <Activity size={14} /> Dữ liệu y tế thời gian thực
          </div>
          <h2 className="medical-title" id="impact-title">
            Nhu Cầu Nhóm Máu & <span className="medical-title__highlight medical-title__highlight--red">Tác Động Tiếp Nhận</span>
          </h2>
          <p className="medical-subtitle">
            Theo dõi chính xác mức dự trữ máu thực tế tại các bệnh viện tuyến đầu để tham gia hiến
            máu đúng thời điểm bệnh nhân cần bạn nhất.
          </p>
        </motion.div>

        {/* Bento Grid Layout */}
        <div className="bento-grid">
          {/* Bento Card 1: Blood Group Needs (Real-time supply indicators) */}
          <motion.div
            className="bento-card"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5 }}
          >
            <div className="bento-card__header">
              <div>
                <h3 className="bento-card__title">
                  <Droplet size={22} color="#dc2626" fill="#dc2626" />
                  Mức độ dự trữ theo nhóm máu
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: 4 }}>
                  Cập nhật tự động từ ngân hàng máu và hệ thống điều phối bệnh viện
                </p>
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#dc2626',
                  backgroundColor: '#fef2f2',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  border: '1px solid #fecaca',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#dc2626',
                    animation: 'pulse-dot 1.5s infinite',
                  }}
                />
                Kho cấp cứu 24/7
              </span>
            </div>

            <div className="blood-need-list">
              {BLOOD_GROUP_NEEDS.map((item) => {
                const isCritical = item.level === 'CRITICAL';
                const isHigh = item.level === 'HIGH';

                return (
                  <div className="blood-need-row" key={item.group}>
                    {/* Blood Group Circle */}
                    <div
                      className="blood-need-row__circle"
                      style={{
                        background: isCritical
                          ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                          : isHigh
                            ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)'
                            : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      }}
                    >
                      {item.group}
                    </div>

                    {/* Progress & Details */}
                    <div className="blood-need-row__info">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="blood-need-row__name">
                          Nhóm máu {item.group} (Rh{item.rh})
                        </span>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#475569' }}>
                          Dự trữ: {item.reservePercent}%
                        </span>
                      </div>

                      <div className="blood-need-row__track">
                        <div
                          className={`blood-need-row__bar ${
                            isCritical
                              ? 'blood-need-row__bar--critical'
                              : isHigh
                                ? 'blood-need-row__bar--warning'
                                : 'blood-need-row__bar--good'
                          }`}
                          style={{ width: `${item.reservePercent}%` }}
                        />
                      </div>

                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {item.description}
                      </span>
                    </div>

                    {/* Status Tag */}
                    <div>
                      {isCritical ? (
                        <span className="blood-need-row__tag blood-need-row__tag--critical">
                          <AlertCircle size={12} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                          {item.levelText}
                        </span>
                      ) : isHigh ? (
                        <span
                          className="blood-need-row__tag"
                          style={{
                            backgroundColor: '#fff7ed',
                            color: '#ea580c',
                            border: '1px solid #fed7aa',
                          }}
                        >
                          {item.levelText}
                        </span>
                      ) : (
                        <span className="blood-need-row__tag blood-need-row__tag--good">
                          <CheckCircle2 size={12} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                          {item.levelText}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Bento Card 2: Actual Delivered Impact & Numbers */}
          <motion.div
            className="bento-card"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5 }}
          >
            <div className="bento-card__header">
              <div>
                <h3 className="bento-card__title">
                  <ShieldCheck size={22} color="#2563eb" />
                  Hiệu quả tiếp nhận số hóa
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: 4 }}>
                  Minh bạch số liệu thực tế qua quy trình khép kín
                </p>
              </div>
            </div>

            {/* 4 Stat Boxes */}
            <div className="impact-stats-grid">
              {IMPACT_METRICS.map((metric) => (
                <div className="impact-stat-box" key={metric.label}>
                  <div className="impact-stat-box__value">{metric.value}</div>
                  <div className="impact-stat-box__label">{metric.label}</div>
                  <div className="impact-stat-box__sub">{metric.subtext}</div>
                </div>
              ))}
            </div>

            {/* Medical Trust Commitment Banner */}
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1.2rem',
                borderRadius: '1rem',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.85rem',
              }}
            >
              <ShieldCheck size={22} color="#2563eb" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e3a8a', marginBottom: 2 }}>
                  Cam kết quy trình vô trùng & quyền lợi người hiến
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#3b82f6', lineHeight: 1.5 }}>
                  100% người hiến máu được khám sàng lọc miễn phí, kiểm tra 5 xét nghiệm máu cơ bản
                  và nhận chứng nhận điện tử có giá trị bồi hoàn máu toàn quốc.
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
