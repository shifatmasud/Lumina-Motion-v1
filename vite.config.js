import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'EVAL' && warning.id?.includes('lottie-web')) {
          return;
        }
        // Suppress the warning about the importmap script tag.
        // `data-vite-ignore` should handle this, but this is an extra layer of protection.
        if (warning.message.includes(`can't be bundled without type="module" attribute`)) {
          return;
        }
        warn(warning);
      },
    },
  },
});