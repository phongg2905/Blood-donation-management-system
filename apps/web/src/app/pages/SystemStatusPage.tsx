import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, StatusMessage } from '@/components/ui';
import { Brand } from '@/components/common/Brand';
import { AUTH_ROUTES } from '@/features/auth/routing';
import { getHealth } from '@/services/health.service';

/**
 * System status (health check).
 *
 * This is the app's original bootstrap screen, kept as a dev/system check after
 * the router was introduced. It is public so it still works when the API or the
 * session is unavailable. It reports API reachability and database state via
 * `GET /api/health`.
 */
export function SystemStatusPage() {
  const [status, setStatus] = useState('Đang kiểm tra...');
  const [database, setDatabase] = useState('Đang kiểm tra...');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('Đang kiểm tra...');
    setDatabase('Đang kiểm tra...');
    void getHealth(
      AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
    )
      .then((result) => {
        if (!controller.signal.aborted && result.success) {
          setStatus('OK');
          setDatabase(result.data.database);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setStatus(
            error instanceof Error ? error.message : 'Không thể kết nối API',
          );
          setDatabase('Không xác nhận được kết nối');
        }
      });
    return () => controller.abort();
  }, [attempt]);

  const healthy = status === 'OK';

  return (
    <div className="public-page">
      <Brand to="/" tagline="Quản lý hiến máu" />

      <header className="public-page__hero">
        <p className="eyebrow" style={{ color: 'rgb(255 255 255 / 80%)' }}>
          System check
        </p>
        <h1>Hệ thống quản lý hiến máu</h1>
        <p>
          Nền tảng quản lý đợt hiến máu, người hiến và quá trình tiếp nhận.
          Trang này kiểm tra kết nối API và cơ sở dữ liệu.
        </p>
      </header>

      <section className="panel" aria-labelledby="system-status-heading">
        <h2 className="panel__title" id="system-status-heading">
          Trạng thái hệ thống
        </h2>

        <div className="system-status__rows" role="status" aria-live="polite">
          <div className="system-status__row">
            <span>API</span>
            <span className="system-status__value">{status}</span>
          </div>
          <div className="system-status__row">
            <span>PostgreSQL</span>
            <span className="system-status__value">{database}</span>
          </div>
        </div>

        {healthy ? (
          <StatusMessage tone="success">
            API và cơ sở dữ liệu đang hoạt động bình thường.
          </StatusMessage>
        ) : status === 'Đang kiểm tra...' ? (
          <StatusMessage tone="info">Đang kiểm tra kết nối…</StatusMessage>
        ) : (
          <StatusMessage tone="error" title="Không kết nối được API">
            {status}
          </StatusMessage>
        )}

        <div className="panel__actions">
          <Button onClick={() => setAttempt((value) => value + 1)}>
            Kiểm tra lại
          </Button>
          <Link className="btn btn--secondary" to={AUTH_ROUTES.login}>
            Đi tới đăng nhập
          </Link>
        </div>

        <p className="panel__hint">
          Giai đoạn khởi tạo — các chức năng nghiệp vụ sẽ được phát triển tiếp
          theo.
        </p>
      </section>
    </div>
  );
}
