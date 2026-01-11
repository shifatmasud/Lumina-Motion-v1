
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // webm-writer imports 'fs' which doesn't exist in browser. 
      // We alias it to an empty mock to prevent build errors.
      fs: '/utils/fsMock.ts',
    },
  },
  define: {
    // Ensure global is defined for older libraries
    global: 'window',
  },
});
