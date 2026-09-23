import { useEffect } from 'react';

/** Attribute on `<html>` while the masthead is out of the way. */
export const HEADER_HIDDEN_ATTRIBUTE = 'data-header-hidden';

/** Net travel, in px, before a new direction is trusted. Absorbs jitter. */
const DIRECTION_THRESHOLD = 8;

/** The masthead never hides this close to the top of the page. */
const PIN_TOP_PX = 24;

/** Travel before hiding is allowed at all, so a nudge does not move it. */
const HIDE_AFTER_PX = 96;

const reduceMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Masthead that gets out of the way: it slides out while the visitor scrolls
 * down and slides straight back on the first upward movement (or at the top of
 * the page).
 *
 * Only `transform` is animated — the bar keeps its place and height, so no
 * chapter moves and no scroll position is invalidated. The hook stays out of
 * the way entirely for visitors who asked for reduced motion, and it pins the
 * bar in `soft` paging mode, where a chapter may be taller than the screen and
 * the freed strip would uncover content mid-chapter.
 *
 * `routeKey` re-runs the effect on navigation, so every new screen starts with
 * a visible masthead.
 */
export function useHeaderAutoHide(routeKey: string): void {
  useEffect(() => {
    const root = document.documentElement;
    const header = document.querySelector<HTMLElement>('.app-header');
    if (!header) return undefined;

    let hidden = false;
    let anchor = window.scrollY;
    let frame = 0;

    const show = () => {
      if (!hidden) return;
      hidden = false;
      root.removeAttribute(HEADER_HIDDEN_ATTRIBUTE);
    };

    const hide = () => {
      if (hidden || header.contains(document.activeElement)) return;
      hidden = true;
      root.setAttribute(HEADER_HIDDEN_ATTRIBUTE, 'true');
    };

    // A new screen starts settled, whatever the previous one was doing.
    show();
    anchor = window.scrollY;

    const update = () => {
      frame = 0;
      const y = window.scrollY;

      if (reduceMotion() || root.dataset.landingPaging === 'soft') {
        show();
        anchor = y;
        return;
      }

      if (y <= PIN_TOP_PX) {
        show();
        anchor = y;
        return;
      }

      const travelled = y - anchor;
      if (Math.abs(travelled) < DIRECTION_THRESHOLD) return;
      anchor = y;

      if (travelled > 0) {
        if (y > HIDE_AFTER_PX) hide();
        return;
      }

      show();
    };

    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    // The keyboard can reach the bar while it is out of sight: bring it back.
    const handleFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && header.contains(event.target)) show();
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('focusin', handleFocus);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      document.removeEventListener('focusin', handleFocus);
      root.removeAttribute(HEADER_HIDDEN_ATTRIBUTE);
    };
  }, [routeKey]);
}
