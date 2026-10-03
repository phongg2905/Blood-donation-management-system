import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// jsdom environments start slowly on some machines; the default 1s window for
// `findBy*` queries is too tight when several suites run in parallel.
configure({ asyncUtilTimeout: 5000 });

// The mock auth adapter persists its session in localStorage, so every test
// must start from a clean storage state.
beforeEach(() => {
  window.localStorage.clear();
});

// React Testing Library only auto-cleans when globals are enabled; we import
// from 'vitest' explicitly, so unmount manually.
afterEach(() => {
  cleanup();
});

// Mock IntersectionObserver & ResizeObserver for Framer Motion and scroll reveals in jsdom
if (typeof window !== 'undefined') {
  if (!window.IntersectionObserver) {
    class MockIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null = null;
      readonly rootMargin: string = '';
      readonly thresholds: ReadonlyArray<number> = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
    (global as unknown as { IntersectionObserver: typeof MockIntersectionObserver }).IntersectionObserver = MockIntersectionObserver;
  }

  if (!window.ResizeObserver) {
    class MockResizeObserver implements ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    (global as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver;
  }
}

