import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig } from 'vite';

// API started from the crm-batiment-api repository (override: API_PROXY_TARGET=http://… pnpm dev)
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

// The socket.io connection is cut each time the API restarts or a tab reloads; the browser
// reconnects on its own. Hide those harmless "ws proxy" traces, keep every other error.
const logger = createLogger();
const logError = logger.error.bind(logger);
logger.error = (msg, options) => {
  const harmless = /ws proxy/.test(msg) && /ECONNABORTED|ECONNRESET|EPIPE/.test(`${msg} ${options?.error?.message ?? ''}`);
  if (!harmless) logError(msg, options);
};

export default defineConfig({
  customLogger: logger,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // In dev, the browser calls /api/... on 5173 and Vite forwards to the API:
    // same origin, so no CORS issues and no hard-coded API URL in the code.
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      // Real-time notifications (socket.io)
      '/socket.io': {
        target: apiTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
