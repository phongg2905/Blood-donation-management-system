import { motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  Building2,
  Droplet,
  FileText,
  HeartHandshake,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import {
  BLOOD_GROUP_NEEDS,
  CAMPUS_BATTLES,
  GENZ_PERKS,
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
            <Activity size={14} /> Dữ liệu điều phối y tế
          </div>
          <h2 className="medical-title" id="impact-title">
            Kho Dự Trữ & <span className="medical-title__highlight medical-title__highlight--red">Điều Phối Máu</span>
          </h2>
          <p className="medical-subtitle">
            Hệ thống giám sát chỉ số dự trữ máu quốc gia và điều phối liên viện theo thời gian thực.
          </p>
        </motion.div>

        {/* 3-Tile Clinical Bento Grid */}
        <div className="bento-grid--genz">
          {/* Bento Tile 1: Real-time Blood Supply Status */}
          <motion.div
            className="bento-card--genz"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.45 }}
          >
            <div className="bento-card__header">
              <div>
                <h3 className="bento-card__title">
                  <Droplet size={20} color="#dc2626" fill="#dc2626" />
                  Chỉ Số Dự Trữ Kho Máu
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 4 }}>
                  Cập nhật trực tiếp từ kho máu điều phối
                </p>
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#dc2626',
                  backgroundColor: '#fef2f2',
                  padding: '0.25rem 0.6rem',
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
                Live 24/7
              </span>
            </div>

            <div className="blood-pill-grid" style={{ flexGrow: 1 }}>
              {BLOOD_GROUP_NEEDS.map((item) => {
                const isCritical = item.level === 'CRITICAL';
                const isHigh = item.level === 'HIGH';

                return (
                  <div key={item.group} className="blood-pill-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="blood-pill-type">{item.group}</span>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>
                          Dự trữ: {item.reservePercent}%
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {item.description}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`blood-pill-tag ${
                        isCritical
                          ? 'blood-pill-tag--critical'
                          : isHigh
                            ? 'blood-pill-tag--warning'
                            : 'blood-pill-tag--good'
                      }`}
                    >
                      {item.levelText}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: '1rem',
                fontSize: '0.75rem',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 600,
              }}
            >
              <AlertCircle size={14} />
              <span>Nhóm O và A đang thiếu hụt cấp bách cho các ca phẫu thuật cấp cứu!</span>
            </div>
          </motion.div>

          {/* Bento Tile 2: Key Receiving Hospital Hubs */}
          <motion.div
            className="bento-card--genz"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            <div className="bento-card__header">
              <div>
                <h3 className="bento-card__title">
                  <Building2 size={20} color="#2563eb" />
                  Bệnh Viện Tiếp Nhận Tuyến Đầu
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 4 }}>
                  Mạng lưới điều phối máu ngoại viện
                </p>
              </div>
              <span className="campus-battle-badge" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                Liên viện
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', flexGrow: 1 }}>
              {CAMPUS_BATTLES.map((hub) => (
                <div key={hub.id} className="campus-battle-item">
                  <div className="campus-battle-head">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Building2 size={15} color={hub.color} />
                      <span>{hub.school}</span>
                    </span>
                    <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                      <strong style={{ color: '#0f172a' }}>{hub.donors}</strong>/{hub.target} ĐV
                    </span>
                  </div>

                  <div className="campus-battle-track">
                    <div
                      className="campus-battle-bar"
                      style={{
                        width: `${hub.progress}%`,
                        background: hub.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: '1.25rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.85rem',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                fontSize: '0.8125rem',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <ShieldCheck size={16} color="#16a34a" />
              <span>Mọi đơn vị máu đều được xét nghiệm sàng lọc 5 tác nhân lây nhiễm trước khi xuất viện.</span>
            </div>
          </motion.div>

          {/* Bento Tile 3: Statutory Donor Rights & Health Benefits */}
          <motion.div
            className="bento-card--genz"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.45, delay: 0.2 }}
          >
            <div className="bento-card__header">
              <div>
                <h3 className="bento-card__title">
                  <FileText size={20} color="#059669" />
                  Quyền Lợi Người Hiến Máu
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 4 }}>
                  Quy định Thông tư 26/2013 & 15/2023 TT-BYT
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '0.25rem 0.6rem',
                  borderRadius: '9999px',
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                }}
              >
                Chuẩn Bộ Y Tế
              </span>
            </div>

            <div className="perks-list" style={{ flexGrow: 1 }}>
              {GENZ_PERKS.map((perk) => (
                <div key={perk.id} className="perk-item">
                  <div className="perk-icon-wrap" style={{ background: perk.tagTone === 'teal' ? '#ecfdf5' : perk.tagTone === 'red' ? '#fef2f2' : '#fffbeb' }}>
                    {perk.iconName === 'stethoscope' && <Stethoscope size={20} color="#0f766e" />}
                    {perk.iconName === 'certificate' && <FileText size={20} color="#e11d48" />}
                    {perk.iconName === 'nutrition' && <HeartHandshake size={20} color="#b45309" />}
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="perk-info__title">{perk.title}</span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          background: perk.tagTone === 'red' ? '#ffe4e6' : perk.tagTone === 'teal' ? '#ccfbf1' : '#fef3c7',
                          color: perk.tagTone === 'red' ? '#e11d48' : perk.tagTone === 'teal' ? '#0f766e' : '#b45309',
                        }}
                      >
                        {perk.badge}
                      </span>
                    </div>
                    <p className="perk-info__desc">{perk.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: '1rem',
                fontSize: '0.75rem',
                color: '#64748b',
                lineHeight: 1.4,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <FileText size={14} style={{ flexShrink: 0 }} />
              <span>Giấy chứng nhận hiến máu tình nguyện có giá trị bồi hoàn máu miễn phí tại mọi cơ sở y tế công lập trên toàn quốc.</span>
            </div>
          </motion.div>
        </div>

        {/* 4 Stat Boxes preserving verified medical credibility */}
        <div style={{ marginTop: '3.5rem' }}>
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
              padding: '1.25rem',
              borderRadius: '1.25rem',
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
                Cam kết vô trùng 100% & quyền lợi bồi hoàn trọn đời
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#3b82f6', lineHeight: 1.5 }}>
                Mỗi túi máu và kim lấy máu đều dùng một lần duy nhất, tuyệt đối vô trùng. Người tham gia được cấp Giấy chứng nhận điện tử và bảo lưu quyền lợi bồi hoàn máu toàn quốc.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
