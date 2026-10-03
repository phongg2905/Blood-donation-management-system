import { Link } from 'react-router-dom';
import { Droplet, Heart, PhoneCall, ShieldCheck, Mail, MapPin } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="portal-footer" role="contentinfo">
      <div className="medical-container">
        <div className="portal-footer__grid">
          {/* Column 1: Organization & Mission */}
          <div>
            <div className="portal-footer__brand-title">
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
              >
                <Droplet size={18} fill="#ffffff" />
              </span>
              <span>Blood Donation Portal</span>
            </div>

            <p className="portal-footer__brand-desc">
              Cổng quản lý và điều phối hiến máu số hóa y tế quốc gia. Kết nối trực tiếp
              người hiến máu tình nguyện với các trung tâm huyết học và bệnh viện tuyến đầu.
            </p>

            <div className="portal-footer__hotline">
              <PhoneCall size={18} />
              <span>Đường dây nóng cấp cứu: 1900 1234 (24/7)</span>
            </div>

            <div style={{ marginTop: '1.25rem', fontSize: '0.8125rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={15} color="#60a5fa" />
                <span>Trụ sở: Số 78 Giải Phóng, Phương Mai, Đống Đa, Hà Nội</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={15} color="#60a5fa" />
                <span>Email tiếp nhận: lienhe@hienmau.gov.vn</span>
              </div>
            </div>
          </div>

          {/* Column 2: Partner Hospital Network */}
          <div>
            <h4 className="portal-footer__col-title">Mạng lưới bệnh viện liên kết</h4>
            <ul className="portal-footer__links">
              <li className="portal-footer__link">
                Viện Huyết học - Truyền máu TW
              </li>
              <li className="portal-footer__link">
                Bệnh viện Bạch Mai Hà Nội
              </li>
              <li className="portal-footer__link">
                Bệnh viện Chợ Rẫy TP.HCM
              </li>
              <li className="portal-footer__link">
                Bệnh viện Trung ương Huế
              </li>
              <li className="portal-footer__link">
                Bệnh viện Đa khoa Đà Nẵng
              </li>
              <li className="portal-footer__link">
                Bệnh viện Huyết học - Truyền máu Cần Thơ
              </li>
            </ul>
          </div>

          {/* Column 3: Quick Links & Medical Guidelines */}
          <div>
            <h4 className="portal-footer__col-title">Thông tin & Tra cứu</h4>
            <ul className="portal-footer__links">
              <li>
                <Link to="/donor/register" className="portal-footer__link">
                  Đăng ký hiến máu trực tuyến
                </Link>
              </li>
              <li>
                <Link to="/campaigns" className="portal-footer__link">
                  Danh sách các đợt hiến đang mở
                </Link>
              </li>
              <li>
                <Link to="/donor/certificates" className="portal-footer__link">
                  Tra cứu giấy chứng nhận điện tử
                </Link>
              </li>
              <li>
                <Link to="/donor/history" className="portal-footer__link">
                  Lịch sử hiến máu cá nhân
                </Link>
              </li>
              <li>
                <a href="#stories-faq" className="portal-footer__link">
                  Tiêu chuẩn & Điều kiện tham gia
                </a>
              </li>
              <li>
                <a href="#stories-faq" className="portal-footer__link">
                  Quyền lợi bồi hoàn máu toàn quốc
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Medical Regulatory & Privacy Disclaimer */}
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid #1e293b',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
          }}
        >
          <ShieldCheck size={24} color="#60a5fa" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: 1.5 }}>
            Hệ thống vận hành theo quy chuẩn an toàn truyền máu của Bộ Y Tế. Mọi dữ liệu cá nhân
            và thông tin sức khỏe của người hiến máu được mã hóa và bảo mật nghiêm ngặt theo tiêu chuẩn y tế số.
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="portal-footer__bottom">
          <div>
            © {new Date().getFullYear()} Cổng Thông Tin & Quản Lý Hiến Máu. Tất cả các quyền được bảo lưu.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
            <span>Phát triển vì sức khỏe cộng đồng</span>
            <Heart size={14} color="#dc2626" fill="#dc2626" />
          </div>
        </div>
      </div>
    </footer>
  );
}
