import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { ErrorPage } from '../components/ErrorPage';
import { useAuth } from '../hooks/useAuth';
import { AUTH_ROUTES, resolveLandingPath } from '../routing';

/**
 * 403 — authenticated but not authorized.
 *
 * Reached by `PermissionGuard` when the current user lacks the required
 * permission. Visual direction from `design-references/auth/403-reference-01.jpg`.
 */
export function ForbiddenPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  return (
    <ErrorPage
      code="403"
      title="Bạn không có quyền truy cập"
      message="Tài khoản của bạn đã đăng nhập nhưng không được cấp quyền cho chức năng này. Nếu bạn cho rằng đây là nhầm lẫn, hãy liên hệ quản trị viên để được cấp quyền phù hợp."
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
          Đăng nhập
        </Link>
      )}
    </ErrorPage>
  );
}
