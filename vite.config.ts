
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'strip-importmap',
      transformIndexHtml(html) {
        // Only strip the importmap script tag in production to let Vite handle modules
        if (process.env.NODE_ENV === 'production') {
          return html.replace(/<script src=".\/importmap.js" type="importmap"><\/script>/, '');
        }
        return html;
      }
    }
  ],
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    port: 3000
  }
});
