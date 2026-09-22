import type { ConfigEnv } from 'vite';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

/**
 * Test config.
 *
 * Reuses `vite.config.ts` so the `@/` alias and the React plugin are identical
 * to the app build — tests can never resolve modules differently from the app.
 */
export default mergeConfig(
  viteConfig({
    command: 'serve',
    mode: 'test',
    isSsrBuild: false,
    isPreview: false,
  } satisfies ConfigEnv),
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      restoreMocks: true,
      unstubEnvs: true,
      testTimeout: 20000,
      hookTimeout: 20000,
    },
  }),
);
