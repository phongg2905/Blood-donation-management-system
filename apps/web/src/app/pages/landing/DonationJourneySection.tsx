import { motion } from 'framer-motion';
import { Award, CheckCircle2, Droplet, Heart, UserCheck, ArrowRight, Stethoscope } from 'lucide-react';
import { LANDING_ANCHORS } from './landing-content';

const THREE_STEPS = [
  {
    step: '1',
    title: 'Đăng Ký Trực Tuyến',
    subtitle: 'Nhanh chóng trong 1 phút',
    desc: 'Lựa chọn điểm hiến thuận tiện và hoàn thành phiếu khai báo y tế điện tử trước khi đến.',
    icon: <UserCheck size={26} color="#2563eb" />,
  },
  {
    step: '2',
    title: 'Khám & Tiếp Nhận',
    subtitle: 'Vô trùng tuyệt đối 100%',
    desc: 'Bác sĩ chuyên khoa khám sàng lọc và tiếp nhận máu bằng quy trình kim túi khép kín dùng 1 lần.',
    icon: <Droplet size={26} color="#dc2626" fill="#dc2626" />,
  },
  {
    step: '3',
    title: 'Chứng Nhận & Bồi Hoàn',
    subtitle: 'Quyền lợi trọn đời toàn quốc',
    desc: 'Cấp Giấy chứng nhận điện tử đồng bộ VNeID và bảo lưu quyền bồi hoàn máu miễn phí tại mọi viện công.',
    icon: <Heart size={26} color="#059669" fill="#059669" />,
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
          className="sketch-section-head sketch-section-head--light"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
        >
          <span className="sketch-section-pill sketch-section-pill--blue">
            <CheckCircle2 size={14} color="#2563eb" />
            Quy Trình Tinh Gọn 4.0
          </span>
          <h2 className="sketch-section-title sketch-section-title--dark" id="journey-title">
            Hành Trình Hiến Máu <span className="sketch-title-highlight">3 Bước Tiêu Chuẩn</span>
          </h2>
          <p className="sketch-section-sub sketch-section-sub--dark">
            Thủ tục số hóa, không giấy tờ phức tạp, tối ưu hóa thời gian và an toàn tuyệt đối.
          </p>
        </motion.div>

        {/* 3-Step Horizontal Connected Timeline */}
        <div className="sketch-timeline-container">
          <div className="sketch-timeline-track" />
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
            <div className="sketch-cta-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
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
        </motion.div>
      </div>
    </section>
  );
}
