import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './', // Ensure relative paths for deployment
  plugins: [
    react(),
    {
      name: 'fix-mime-types',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url) {
            const path = req.url.split('?')[0];
            if (path.endsWith('.tsx') || path.endsWith('.ts')) {
              res.setHeader('Content-Type', 'application/javascript');
            }
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url) {
            const path = req.url.split('?')[0];
            if (path.endsWith('.tsx') || path.endsWith('.ts')) {
              res.setHeader('Content-Type', 'application/javascript');
            }
          }
          next();
        });
      }
    }
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    modulePreload: {
      polyfill: false
    }
  }
});