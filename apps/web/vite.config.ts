import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const envDir = fileURLToPath(new URL('../../', import.meta.url));
// `@/` points at the web app source root; `@blood/*` workspace packages are
// bare specifiers and are resolved separately, so they are not affected.
const srcDir = fileURLToPath(new URL('./src', import.meta.url));
const sharedTypesDir = fileURLToPath(new URL('../../packages/shared-types/src/index.ts', import.meta.url));
const sharedValidationDir = fileURLToPath(new URL('../../packages/shared-validation/src/index.ts', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  return {
    plugins: [react()],
    envDir,
    resolve: {
      alias: {
        '@': srcDir,
        '@blood/shared-types': sharedTypesDir,
        '@blood/shared-validation': sharedValidationDir,
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://localhost:${env.API_PORT || '3000'}`,
          changeOrigin: true,
        },
      },
    },
  };
});
