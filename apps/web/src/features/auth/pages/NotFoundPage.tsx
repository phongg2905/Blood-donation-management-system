import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { ErrorPage } from '../components/ErrorPage';
import { useAuth } from '../hooks/useAuth';
import { AUTH_ROUTES, resolveLandingPath } from '../routing';

/**
 * 404 — unknown route.
 *
 * Visual direction from `design-references/auth/404-reference-01.jpg`; the
 * attempted path is surfaced so the mistake is obvious.
 */
export function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  return (
    <ErrorPage
      code="404"
      title="Không tìm thấy trang"
      message="Đường dẫn bạn truy cập không tồn tại hoặc đã bị thay đổi. Hãy kiểm tra lại địa chỉ hoặc quay về trang chính."
      meta={location.pathname}
    >
      <Button variant="secondary" onClick={() => navigate(-1)}>
        ← Quay lại
      </Button>
      {currentUser ? (
        <Link className="btn btn--primary" to={resolveLandingPath(currentUser)}>
          Về trang của tôi
        </Link>
      ) : (
        <Link className="btn btn--primary" to={AUTH_ROUTES.login}>
          Về trang đăng nhập
        </Link>
      )}
    </ErrorPage>
  );
}
