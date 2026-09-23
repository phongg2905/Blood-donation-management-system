import { useEffect } from 'react';
import {
  GLIDE_ATTRIBUTE,
  GLIDE_END_EVENT,
  prefersReducedMotion,
} from './landingScroll';

/**
 * Page glide timings.
 *
 * The glide is deliberately unhurried: a wheel notch should read as turning one
 * page, not as jumping between anchors. A turn is eased over `GLIDE_MS`, longer
 * distances get a little extra so they do not feel like a teleport, and
 * `GLIDE_COOLDOWN_MS` absorbs the momentum tail of the gesture so a single
 * flick can never turn two pages.
 */
const GLIDE_MS = 880;
const GLIDE_PER_PIXEL_MS = 0.075;
const GLIDE_MAX_MS = 1300;
/** Wheel events in this tail are momentum from the gesture that just happened. */
const GLIDE_COOLDOWN_MS = 300;
/** Safety net: never hold the wheel for longer than a glide can possibly run. */
const GLIDE_HARD_LIMIT_MS = GLIDE_MAX_MS + 400;

/**
 * Quartic in/out. Softer at both ends than a cubic, so the page starts moving
 * without a jolt and settles without a bounce.
 */
const easeInOutQuart = (progress: number): number =>
  progress < 0.5 ? 8 * progress ** 4 : 1 - (-2 * progress + 2) ** 4 / 2;

/**
 * Turns one wheel gesture into one animated page turn on paged desktop.
 *
 * Only active while `useLandingPaging` reports `full`, so phones, tablets and
 * any viewport where a chapter does not fit keep completely native scrolling.
 * Keyboard, scrollbar, touch and anchor navigation are untouched — they use the
 * browser's own snapping — and visitors who asked for reduced motion get the
 * instant native behaviour too.
 *
 * While the glide runs, `data-landing-glide` is set on `<html>`, which pauses
 * snapping (the browser would otherwise fight the easing), and `GLIDE_END_EVENT`
 * is fired once the page has settled so the reveal animation can start its own
 * delay from a page that is standing still.
 */
export function usePagedScroll(): void {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let animating = false;
    let glideStartedAt = 0;
    let lockedUntil = 0;

    /**
     * Snap stops: every chapter, plus the end of the page for the footer.
     *
     * A chapter's own `scroll-margin-top` is read back from CSS — that is what
     * the browser snaps to, so the glide can never disagree with it. In paged
     * desktop the masthead floats over the chapters and that margin is `0`.
     */
    const stops = (): number[] => {
      const maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
      const positions = Array.from(
        root.querySelectorAll<HTMLElement>(
          '.landing .landing-hero, .landing .landing-section',
        ),
      ).map((chapter) => {
        const snapMargin =
          Number.parseFloat(
            window.getComputedStyle(chapter).scrollMarginTop,
          ) || 0;
        return Math.min(Math.round(chapter.offsetTop - snapMargin), maxScroll);
      });
      if (positions.at(-1) !== maxScroll) positions.push(maxScroll);
      return positions;
    };

    const glideTo = (target: number) => {
      const start = window.scrollY;
      const distance = target - start;
      if (Math.abs(distance) < 2) return;

      animating = true;
      glideStartedAt = performance.now();
      const duration = Math.min(
        GLIDE_MS + Math.abs(distance) * GLIDE_PER_PIXEL_MS,
        GLIDE_MAX_MS,
      );

      // Snapping off while easing, and instant scrolling inside the loop.
      root.setAttribute(GLIDE_ATTRIBUTE, 'true');
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';

      const settle = () => {
        root.style.scrollBehavior = previousScrollBehavior;
        root.removeAttribute(GLIDE_ATTRIBUTE);
        animating = false;
        lockedUntil = performance.now() + GLIDE_COOLDOWN_MS;
        document.dispatchEvent(new Event(GLIDE_END_EVENT));
      };

      const step = (now: number) => {
        const progress = Math.min((now - glideStartedAt) / duration, 1);
        window.scrollTo(0, start + distance * easeInOutQuart(progress));
        if (progress < 1) {
          frame = window.requestAnimationFrame(step);
          return;
        }
        window.scrollTo(0, target);
        settle();
      };

      frame = window.requestAnimationFrame(step);
    };

    const handleWheel = (event: WheelEvent) => {
      // Read the preference per gesture rather than once on mount, so changing
      // it mid-session takes effect immediately.
      if (prefersReducedMotion()) return;
      if (root.dataset.landingPaging !== 'full') return;
      // Touch zoom, horizontal gestures and modifier clicks stay native.
      if (event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      if (event.deltaY === 0) return;

      const now = performance.now();
      const busy =
        (animating && now - glideStartedAt < GLIDE_HARD_LIMIT_MS) ||
        now < lockedUntil;
      const forward = event.deltaY > 0;
      const positions = stops();
      const current = window.scrollY;
      const target = forward
        ? positions.find((position) => position > current + 2)
        : [...positions].reverse().find((position) => position < current - 2);
      if (target === undefined) return;

      // Swallow the rest of the gesture, then turn exactly one page.
      event.preventDefault();
      if (busy) return;
      glideTo(target);
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.cancelAnimationFrame(frame);
      root.removeAttribute(GLIDE_ATTRIBUTE);
      root.style.scrollBehavior = '';
    };
  }, []);
}
