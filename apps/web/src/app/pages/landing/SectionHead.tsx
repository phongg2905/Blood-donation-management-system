import type { ReactNode } from 'react';
import { Reveal } from './Reveal';

export interface SectionHeadProps {
  /** Two-digit chapter number, e.g. `03`. */
  index: string;
  eyebrow: string;
  /** Heading id so the section can point at it with `aria-labelledby`. */
  titleId: string;
  /** Heading lines; each entry is rendered on its own editorial line. */
  title: readonly ReactNode[];
  lead?: ReactNode;
}

/**
 * Shared editorial chapter head: a large index, an eyebrow, an oversized
 * statement and an optional standfirst.
 */
export function SectionHead({
  index,
  eyebrow,
  titleId,
  title,
  lead,
}: SectionHeadProps) {
  return (
    <Reveal className="landing-head">
      <p className="landing-head__index" aria-hidden="true">
        {index}
      </p>
      <div className="landing-head__text">
        <p className="landing-eyebrow">{eyebrow}</p>
        <h2 className="landing-head__title" id={titleId}>
          {title.map((line, position) => (
            <span className="landing-head__line" key={position}>
              {line}
            </span>
          ))}
        </h2>
        {lead ? <p className="landing-head__lead">{lead}</p> : null}
      </div>
    </Reveal>
  );
}
