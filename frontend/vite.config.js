import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * `base` is set from the environment so one config serves both targets: the Cloud
 * Run build is served from the domain root, while the GitHub Pages build lives
 * under /TrueSafe/ and every asset URL has to carry that prefix.
 */
export default defineConfig({
  base: process.env.VITE_BASE || './',
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080' } },
  build: { sourcemap: false, chunkSizeWarningLimit: 1200 },
});
