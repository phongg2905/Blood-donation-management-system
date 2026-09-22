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
