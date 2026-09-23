/**
 * Shared scroll vocabulary for the landing page.
 *
 * `usePagedScroll` animates the page turn; the reveal coordinator waits for it
 * to stop before bringing a chapter's content in. Both need the same three
 * facts, declared once here so they cannot disagree.
 */

/** Attribute on `<html>` while a page turn is easing; CSS pauses snapping. */
export const GLIDE_ATTRIBUTE = 'data-landing-glide';

/** Dispatched on `document` once a page turn has settled. */
export const GLIDE_END_EVENT = 'landing:glide-end';

/** True while a page turn is easing. */
export const isGliding = (): boolean =>
  typeof document !== 'undefined' &&
  document.documentElement.hasAttribute(GLIDE_ATTRIBUTE);

/** Whether the visitor asked the system to reduce motion. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
