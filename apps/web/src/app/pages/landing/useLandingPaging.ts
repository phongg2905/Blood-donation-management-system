import { useLayoutEffect } from 'react';
import { prefersReducedMotion } from './landingScroll';

/** A chapter that is a hair taller than the screen still counts as fitting. */
const HEIGHT_SLACK = 4;

/**
 * Enables one-screen-per-chapter paging on the landing.
 *
 * Sets `data-landing-paging` on `<html>`, which `home.css` reads:
 * - `full` — every chapter fits one screen, so `<html>` snaps (`y mandatory`)
 *   and each gesture moves exactly one chapter;
 * - `soft` — `y proximity`: snapping only when a gesture ends near a chapter
 *   edge, used as soon as a chapter is taller than the viewport (short window,
 *   browser zoom, larger text) so no content is ever trapped between pages.
 *
 * Heights are only re-measured when the viewport *width* changes, because line
 * wrapping — not the window height — decides how tall a chapter is. The
 * attribute is removed on unmount, so other routes scroll normally.
 */
export function useLandingPaging(): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const chapters = Array.from(
      root.querySelectorAll<HTMLElement>(
        '.landing .landing-hero, .landing .landing-section',
      ),
    );
    if (chapters.length === 0) return undefined;

    let measuredAt = '';
    let naturalHeights: number[] = [];
    let frame = 0;
    let cancelled = false;

    const measure = (key: string): number[] => {
      if (key === measuredAt) return naturalHeights;
      const previous = root.dataset.landingPaging;
      // Measure the unpaged layout, then restore the current mode.
      if (previous === 'full') root.dataset.landingPaging = '';
      naturalHeights = chapters.map(
        (chapter) => chapter.getBoundingClientRect().height,
      );
      if (previous === 'full') root.dataset.landingPaging = previous;
      measuredAt = key;
      return naturalHeights;
    };

    const apply = () => {
      if (cancelled) return;
      // Both axes matter: the compact rhythm is height-based.
      const heights = measure(`${window.innerWidth}x${window.innerHeight}`);
      // A chapter is only fully readable if it fits the band under the masthead.
      const masthead = document.querySelector<HTMLElement>('.app-header');
      const mastheadHeight = masthead?.getBoundingClientRect().height ?? 0;
      // The masthead wraps on narrow screens, so its height is not a constant:
      // publish what it actually measured and let CSS anchor to that. Every
      // in-page jump then lands exactly below the bar.
      root.style.setProperty('--landing-header', `${mastheadHeight}px`);
      const band = window.innerHeight - mastheadHeight;
      root.dataset.landingPaging = prefersReducedMotion()
        ? // Paging replaces the reader's own scrolling, so a visitor who asked
          // for reduced motion keeps completely native behaviour: no snapping
          // and no page turns.
          'none'
        : heights.some((height) => height > band + HEIGHT_SLACK)
          ? 'soft'
          : 'full';
    };

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('resize', schedule);
    // A late web font changes wrapping, so re-measure once it settles.
    void document.fonts?.ready.then(() => {
      if (cancelled) return;
      measuredAt = '';
      apply();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      delete root.dataset.landingPaging;
      root.style.removeProperty('--landing-header');
    };
  }, []);
}
