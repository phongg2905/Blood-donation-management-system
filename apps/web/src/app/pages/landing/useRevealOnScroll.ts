import { useEffect, useRef, useState } from 'react';
import { GLIDE_END_EVENT, isGliding, prefersReducedMotion } from './landingScroll';

/**
 * How long to wait after a page turn has settled before bringing a chapter's
 * content in. Just enough for the eye to register that the page has stopped: a
 * longer pause reads as lag, a shorter one lets the fade start while the view
 * is still moving and the text looks soft.
 */
const SETTLE_MS = 200;

type RevealHandler = () => void;

/**
 * One shared coordinator for every reveal on the page.
 *
 * A single rAF-throttled scroll/resize listener replaces one
 * `IntersectionObserver` per element, and — more importantly — it cannot lose
 * an element: a fast jump (anchor, scrollbar, keyboard) that skips past a
 * chapter still reveals it on the next check, so no text can be left at
 * `opacity: 0`.
 */
const waiting = new Map<HTMLElement, RevealHandler>();
let frame = 0;
let settleTimer = 0;
/** Content stays hidden until this timestamp, i.e. until a page turn settles. */
let revealAfter = 0;
let listening = false;

const flush = (): void => {
  frame = 0;
  if (isGliding() || performance.now() < revealAfter) return;
  const limit = window.innerHeight * 0.94;
  for (const [node, reveal] of Array.from(waiting)) {
    // Anything level with or above the viewport counts: an element a gesture
    // has already passed must never stay invisible.
    if (node.getBoundingClientRect().top < limit) {
      waiting.delete(node);
      reveal();
    }
  }
  if (waiting.size === 0) stopListening();
};

const schedule = (): void => {
  if (frame === 0) frame = window.requestAnimationFrame(flush);
};

const handleGlideEnd = (): void => {
  window.clearTimeout(settleTimer);
  revealAfter = performance.now() + SETTLE_MS;
  settleTimer = window.setTimeout(schedule, SETTLE_MS);
};

const startListening = (): void => {
  if (listening) return;
  listening = true;
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  document.addEventListener(GLIDE_END_EVENT, handleGlideEnd);
};

function stopListening(): void {
  if (!listening) return;
  listening = false;
  window.removeEventListener('scroll', schedule);
  window.removeEventListener('resize', schedule);
  document.removeEventListener(GLIDE_END_EVENT, handleGlideEnd);
  window.clearTimeout(settleTimer);
  settleTimer = 0;
  revealAfter = 0;
}

/**
 * Reports whether the element has scrolled into view, once.
 *
 * Content is visible immediately when the visitor asked for reduced motion or
 * the browser has no animation frames, so the reveal can never hide content
 * permanently.
 */
export function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (
      prefersReducedMotion() ||
      typeof window.requestAnimationFrame !== 'function'
    ) {
      setIsVisible(true);
      return undefined;
    }

    waiting.set(node, () => setIsVisible(true));
    startListening();
    schedule();
    return () => {
      waiting.delete(node);
      if (waiting.size === 0) {
        stopListening();
        return;
      }
      schedule();
    };
  }, []);

  return { ref, isVisible };
}
