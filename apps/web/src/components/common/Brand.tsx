import { Link } from 'react-router-dom';
import { Droplet } from 'lucide-react';

export interface BrandProps {
  /** Wrap in a router link; omit for a non-interactive brand mark. */
  to?: string;
  /** Use on dark/tinted backgrounds. */
  inverse?: boolean;
  tagline?: string;
  className?: string;
}

/** Product mark with blood-drop icon. Text-only branding, no binary assets. */
export function Brand({
  to,
  inverse = false,
  tagline = 'Quản lý hiến máu',
  className,
}: BrandProps) {
  const classes = ['brand', inverse ? 'brand--inverse' : null, className]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className="brand__mark" aria-hidden="true">
        <Droplet size={18} fill="currentColor" />
      </span>
      <span className="brand__text">
        <span className="brand__name">Blood Donation</span>
        <span className="brand__tagline">{tagline}</span>
      </span>
    </>
  );

  if (!to) {
    return <span className={classes}>{content}</span>;
  }
  return (
    <Link className={classes} to={to}>
      {content}
    </Link>
  );
}
