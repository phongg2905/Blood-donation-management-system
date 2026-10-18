import { Droplet } from 'lucide-react';

export interface PageLoaderProps {
  message?: string;
  variant?: 'page' | 'auth';
  fields?: number;
}

/**
 * Full-viewport or container branded loading state with smooth pulse and ring animation.
 */
export function PageLoader({
  message = 'Đang tải…',
  variant = 'page',
}: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-label={message}
      className={`page-loader page-loader--${variant}`}
    >
      <div className="page-loader__container">
        <div className="page-loader__graphic" aria-hidden="true">
          <div className="page-loader__spinner-ring" />
          <div className="page-loader__pulse-circle">
            <Droplet className="page-loader__brand-icon" size={24} fill="currentColor" />
          </div>
        </div>
        <div className="page-loader__content">
          <p className="page-loader__title">{message}</p>
          <p className="page-loader__subtitle">Vui lòng đợi trong giây lát</p>
        </div>
      </div>
    </div>
  );
}
