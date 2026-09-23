import type { ReactNode } from 'react';
import { useRevealOnScroll } from './useRevealOnScroll';

export interface RevealProps {
  children: ReactNode;
  /** Layout class for the wrapper; the reveal itself is `landing-reveal`. */
  className?: string;
  /** Stagger, in milliseconds, for elements revealed as a group. */
  delay?: number;
}

/**
 * Fades its children up once they scroll into view.
 *
 * Only `opacity` and `transform` are animated, so the reveal never shifts
 * layout. Visitors with reduced motion (or without `IntersectionObserver`) see
 * the content immediately.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const { ref, isVisible } = useRevealOnScroll<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={[
        'landing-reveal',
        isVisible ? 'landing-reveal--visible' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
