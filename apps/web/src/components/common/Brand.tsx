import { Link } from 'react-router-dom';

export interface BrandProps {
  /** Wrap in a router link; omit for a non-interactive brand mark. */
  to?: string;
  /** Use on dark/tinted backgrounds. */
  inverse?: boolean;
  tagline?: string;
  className?: string;
}

/** Blood drop SVG icon for the brand mark. */
function BloodDropIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z" />
    </svg>
  );
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
        <BloodDropIcon />
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
