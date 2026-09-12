import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const envDir = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  return {
    plugins: [react()],
    envDir,
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
