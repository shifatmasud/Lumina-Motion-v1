
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Standard threshold for Three.js / PBR heavy applications
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Splitting vendors into logical groups to optimize browser caching and reduce individual file sizes
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) return 'vendor-three';
            if (id.includes('framer-motion') || id.includes('gsap')) return 'vendor-animation';
            if (id.includes('js-yaml') || id.includes('jszip')) return 'vendor-utils';
            return 'vendor';
          }
        },
      },
    },
  },
});
