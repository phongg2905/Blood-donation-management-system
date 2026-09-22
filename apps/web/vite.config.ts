import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const envDir = fileURLToPath(new URL('../../', import.meta.url));
// `@/` points at the web app source root; `@blood/*` workspace packages are
// bare specifiers and are resolved separately, so they are not affected.
const srcDir = fileURLToPath(new URL('./src', import.meta.url));
// `@blood/shared-*` are linked workspace packages compiled to CommonJS (the API
// consumes them from Node). Vite only applies CJS interop to node_modules by
// default, so a linked package that exports runtime *values* fails to resolve
// named exports — these two options cover dev (pre-bundling) and build (Rollup).
const workspacePackage = /packages[\\/](shared-types|shared-validation)[\\/]/;
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  return {
    plugins: [react()],
    envDir,
    resolve: {
      alias: { '@': srcDir },
    },
    optimizeDeps: {
      include: ['@blood/shared-types', '@blood/shared-validation'],
    },
    build: {
      commonjsOptions: { include: [/node_modules/, workspacePackage] },
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
