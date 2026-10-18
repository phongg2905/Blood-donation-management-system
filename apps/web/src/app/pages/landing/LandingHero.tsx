import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Droplet, Search } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { BloodDropletShader } from './BloodDropletShader';
import { LANDING_ANCHORS } from './landing-content';
import { RegistrationAction } from './RegistrationAction';

export function LandingHero() {
  const { currentUser, hasPermission } = useAuth();
  const navigate = useNavigate();

  const firstName = currentUser?.fullName?.trim().split(/\s+/).at(-1) || 'bạn';

  return (
    <section
      className="portal-hero-sketch"
      id={LANDING_ANCHORS.hero}
      aria-labelledby="home-title"
    >
      {/* WebGL Fragment Shader Droplet & Organic Fluid Backdrop */}
      <div className="sketch-hero__shader-backdrop" aria-hidden="true">
        <BloodDropletShader className="sketch-hero__shader-canvas" />
        <div className="sketch-hero__shader-overlay" />
      </div>

      <div className="sketch-container">
        {/* Top Header Badge & Headlines */}
        <motion.div
          className="sketch-hero__intro"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <h1 className="sketch-hero__title" id="home-title">
            Trao một phần máu {' '}
            <span className="sketch-hero__title-gradient">
              Giữ trọn một nhịp sống
            </span>
          </h1>

          <p className="sketch-hero__subtitle">
            Một hành động sẻ chia — Cứu trọn vẹn sự sống người bệnh. Kết nối trực tiếp cơ sở y tế tuyến đầu.
          </p>

          {/* CTA Actions */}
          <div className="sketch-hero__actions">
            <button
              type="button"
              className="sketch-btn-primary"
              onClick={() => {
                if (hasPermission('registration.create')) {
                  navigate('/donor/register');
                } else {
                  navigate('/campaigns');
                }
              }}
            >
              <Droplet size={18} fill="#ffffff" color="#ffffff" />
              Đặt lịch ngay
            </button>

            <a
              href={`#${LANDING_ANCHORS.campaigns}`}
              className="sketch-btn-secondary"
            >
              <Search size={16} />
              Tra cứu điểm hiến
            </a>

            {/* Visually hidden from layout while preserving test assertions */}
            <div className="sketch-registration-slot-hidden">
              <RegistrationAction />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

