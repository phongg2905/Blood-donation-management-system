export interface AuthHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}

/** Card heading block shared by login / register / forgot / reset. */
export function AuthHeader({ title, subtitle, eyebrow }: AuthHeaderProps) {
  return (
    <header className="auth-card__header">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1 className="auth-card__title">{title}</h1>
      {subtitle ? <p className="auth-card__subtitle">{subtitle}</p> : null}
    </header>
  );
}
