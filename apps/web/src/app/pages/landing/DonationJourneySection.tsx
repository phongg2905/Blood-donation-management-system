import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Droplet, Heart, Stethoscope, UserCheck } from 'lucide-react';
import { LANDING_ANCHORS } from './landing-content';

const THREE_STEPS = [
  {
    step: '1',
    title: 'Đăng Ký Trực Tuyến',
    subtitle: 'Nhanh chóng trong 1 phút',
    desc: 'Lựa chọn điểm hiến thuận tiện và hoàn thành phiếu khai báo y tế điện tử trước khi đến.',
    icon: <UserCheck size={28} className="sketch-step-icon--blue" />,
  },
  {
    step: '2',
    title: 'Khám & Tiếp Nhận',
    subtitle: 'Vô trùng tuyệt đối 100%',
    desc: 'Bác sĩ chuyên khoa khám sàng lọc và tiếp nhận máu bằng quy trình kim túi khép kín dùng 1 lần.',
    icon: <Droplet size={28} className="sketch-step-icon--ruby" />,
  },
  {
    step: '3',
    title: 'Chứng Nhận & Bồi Hoàn',
    subtitle: 'Quyền lợi trọn đời toàn quốc',
    desc: 'Cấp Giấy chứng nhận điện tử đồng bộ VNeID và bảo lưu quyền bồi hoàn máu miễn phí tại mọi viện công.',
    icon: <Heart size={28} className="sketch-step-icon--emerald" />,
  },
];

export function DonationJourneySection() {
  return (
    <section
      className="sketch-journey-section"
      id={LANDING_ANCHORS.journey}
      aria-labelledby="journey-title"
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
          <span className="sketch-section-pill sketch-section-pill--ruby">
            <CheckCircle2 size={14} color="#fb7185" />
            Quy Trình Tinh Gọn 4.0
          </span>
          <h2 className="sketch-section-title" id="journey-title">
            Hành Trình Hiến Máu <span className="sketch-title-highlight-ruby">3 Bước Tiêu Chuẩn</span>
          </h2>
          <p className="sketch-section-sub">
            Thủ tục số hóa, không giấy tờ phức tạp, tối ưu hóa thời gian và an toàn tuyệt đối.
          </p>
        </motion.div>

        {/* 3-Step Horizontal Connected Timeline */}
        <div className="sketch-timeline-container">
          <div className="sketch-timeline-track" aria-hidden="true" />
          <div className="sketch-timeline-grid">
            {THREE_STEPS.map((item, idx) => (
              <motion.div
                key={item.step}
                className="sketch-step-card"
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                whileHover={{ y: -6 }}
              >
                <div className="sketch-step-node">
                  <div className="sketch-step-node__icon">
                    {item.icon}
                  </div>
                  <span className="sketch-step-node__num">{item.step}</span>
                </div>

                <div className="sketch-step-content">
                  <span className="sketch-step-tag">Bước {item.step}</span>
                  <h3 className="sketch-step-title">{item.title}</h3>
                  <div className="sketch-step-sub">{item.subtitle}</div>
                  <p className="sketch-step-desc">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Clinical Safe Commitment Callout */}
        <motion.div
          className="sketch-cta-banner"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="sketch-cta-banner__left">
            <div className="sketch-cta-badge">
              <Stethoscope size={16} />
              <span>Cam kết chuẩn y tế quốc gia</span>
            </div>
            <h4 className="sketch-cta-title">
              Sẵn sàng trao gửi giọt máu cứu người hôm nay?
            </h4>
            <p className="sketch-cta-desc">
              15 phút sẻ chia giọt máu đào có thể cứu sống đến 3 cuộc đời bệnh nhân.
            </p>
          </div>
          <div className="sketch-cta-banner__right">
            <Link to="/donor/register" className="btn sketch-cta-btn">
              <span>Đăng ký hiến máu</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
