import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <main
          role="alert"
          style={{
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            textAlign: 'center',
            maxWidth: '600px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              marginBottom: '16px',
              fontWeight: 'bold',
            }}
          >
            !
          </div>
          <h1
            style={{
              fontSize: '1.4rem',
              fontWeight: 700,
              color: '#1e293b',
              margin: '0 0 8px',
            }}
          >
            Đã xảy ra lỗi không mong muốn
          </h1>
          <p
            style={{
              fontSize: '0.95rem',
              color: '#64748b',
              lineHeight: 1.6,
              margin: '0 0 24px',
            }}
          >
            Hệ thống gặp sự cố khi hiển thị trang này. Bạn có thể thử tải lại
            trang hoặc quay về trang chủ.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={this.handleReset}>
              Tải lại trang
            </Button>
            <Button variant="secondary" onClick={this.handleGoHome}>
              Về trang chủ
            </Button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
