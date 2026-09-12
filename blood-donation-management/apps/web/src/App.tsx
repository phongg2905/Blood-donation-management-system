import { useEffect, useState } from 'react';
import { PublicLayout } from './layouts/PublicLayout';
import { getHealth } from './services/health.service';

export default function App() {
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
  return (
    <PublicLayout>
      <p className="eyebrow">BLOOD DONATION MANAGEMENT</p>
      <h1>Hệ thống quản lý hiến máu</h1>
      <p>Nền tảng quản lý đợt hiến máu, người hiến và quá trình tiếp nhận.</p>
      <section aria-labelledby="system-status">
        <h2 id="system-status">Trạng thái hệ thống</h2>
        <div role="status" aria-live="polite">
          <p>
            <strong>API Status: {status}</strong>
          </p>
          <p>PostgreSQL: {database}</p>
        </div>
        <button onClick={() => setAttempt((value) => value + 1)}>
          Kiểm tra lại
        </button>
      </section>
      <small>
        Giai đoạn khởi tạo — các chức năng nghiệp vụ sẽ được phát triển tiếp
        theo.
      </small>
    </PublicLayout>
  );
}
