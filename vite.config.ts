import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Ensures relative paths for assets
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Remove external exclusions to force bundling of all dependencies
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'three', 'framer-motion', 'gsap'],
        },
      },
    }
  },
  define: {
    // Polyfill global for some older libraries
    global: 'window',
  },
});