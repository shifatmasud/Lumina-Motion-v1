import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'fix-mime-types',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && (req.url.endsWith('.tsx') || req.url.endsWith('.ts'))) {
            res.setHeader('Content-Type', 'application/javascript');
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
  },
  server: {
    strictPort: true,
    hmr: {
      overlay: true
    }
  }
});