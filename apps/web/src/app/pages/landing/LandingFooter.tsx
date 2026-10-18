import { Link } from 'react-router-dom';
import { Droplet, Heart, PhoneCall, ShieldCheck } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="sketch-footer" role="contentinfo">
      <div className="sketch-container">
        <div className="sketch-footer__inner">
          <div className="sketch-footer__brand">
            <div className="sketch-footer__logo">
              <span className="sketch-footer__icon">
                <Droplet size={16} fill="#ffffff" color="#ffffff" />
              </span>
              <span className="sketch-footer__name">Cổng Quản Lý Hiến Máu Quốc Gia</span>
            </div>
            <p className="sketch-footer__desc">
              Hệ thống kết nối trực tiếp tình nguyện viên hiến máu với 24 bệnh viện tuyến đầu trên toàn quốc.
            </p>
          </div>

          <div className="sketch-footer__middle">
            <div className="sketch-footer__hotline">
              <PhoneCall size={15} />
              <span>Đường dây nóng cấp cứu: <strong>1900 1234 (24/7)</strong></span>
            </div>
          </div>

          <div className="sketch-footer__links">
            <Link to="/campaigns" className="sketch-footer__link">
              Điểm hiến máu
            </Link>
            <Link to="/donor/register" className="sketch-footer__link">
              Đăng ký trực tuyến
            </Link>
            <Link to="/donor/certificates" className="sketch-footer__link">
              Tra cứu chứng nhận
            </Link>
          </div>
        </div>

        <div className="sketch-footer__bottom">
          <div>
            © {new Date().getFullYear()} National Blood Portal Vietnam. Chuẩn an toàn truyền máu Bộ Y Tế.
          </div>
          <div className="sketch-footer__credits">
            <span>Phát triển vì sự sống cộng đồng</span>
            <Heart size={13} color="#dc2626" fill="#dc2626" />
          </div>
        </div>
      </div>
    </footer>
  );
}
