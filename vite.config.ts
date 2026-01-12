import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    modulePreload: {
      polyfill: false
    }
  },
  // Ensure the dev server properly handles .tsx MIME types
  optimizeDeps: {
    include: ['react', 'react-dom', 'three', 'gsap', 'framer-motion']
  }
});