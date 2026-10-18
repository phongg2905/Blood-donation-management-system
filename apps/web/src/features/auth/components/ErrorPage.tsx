import type { ReactNode } from 'react';
import { ShieldAlert, Compass } from 'lucide-react';

export interface ErrorPageProps {
  code: '403' | '404';
  title: string;
  message: string;
  children?: ReactNode;
}

function ErrorArtwork({ code }: Pick<ErrorPageProps, 'code'>) {
  return (
    <div
      className="error-illustration"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        backgroundColor: code === '403' ? '#fee2e2' : '#e0f2fe',
      }}
      aria-hidden="true"
    >
      {code === '403' ? (
        <ShieldAlert size={64} color="#e11d48" strokeWidth={1.5} />
      ) : (
        <Compass size={64} color="#0284c7" strokeWidth={1.5} />
      )}
    </div>
  );
}

export function ErrorPage({ code, title, message, children }: ErrorPageProps) {
  return (
    <main
      className={`error-page error-page--${code}`}
      aria-labelledby="error-page-title"
    >
      <ErrorArtwork code={code} />
      <section className="error-page__content">
        {code === '404' ? <p className="error-page__numeral">404</p> : null}
        <h1 id="error-page-title" className="error-page__title">
          {title}
        </h1>
        <p className="error-page__message">{message}</p>
        {children ? (
          <div className="error-page__actions">{children}</div>
        ) : null}
      </section>
    </main>
  );
}
