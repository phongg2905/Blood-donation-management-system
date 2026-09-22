import { Spinner } from '@/components/ui';

export interface PageLoaderProps {
  message?: string;
}

/** Full-viewport loading state (auth bootstrap, route-level suspense). */
export function PageLoader({ message = 'Đang tải…' }: PageLoaderProps) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <Spinner />
      <span>{message}</span>
    </div>
  );
}
