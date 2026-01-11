import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'three',
        'framer-motion',
        'gsap',
        '@phosphor-icons/react',
        'uuid',
        'js-yaml',
        'jszip',
        'webm-muxer',
        'cannon-es',
        /^three\//, // Match subpaths like three/examples/jsm/...
      ]
    }
  },
  define: {
    global: 'window',
  },
});