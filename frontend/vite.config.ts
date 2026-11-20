import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Target host can be configured via environment variable (default: WSL2 VM IP)
const BACKEND_HOST = process.env.VITE_BACKEND_HOST || '172.17.68.210';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api/v1/work-orders': {
        target: `http://${BACKEND_HOST}:8001`,
        changeOrigin: true,
      },
      '/api/v1/providers': {
        target: `http://${BACKEND_HOST}:8002`,
        changeOrigin: true,
      },
      '/api/v1/assignments': {
        target: `http://${BACKEND_HOST}:8003`,
        changeOrigin: true,
      },
      '/api/v1/notifications': {
        target: `http://${BACKEND_HOST}:8004`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
    host: '0.0.0.0',
  },
});
