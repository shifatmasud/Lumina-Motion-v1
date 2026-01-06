import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Use a regex to robustly match the script tag, ignoring whitespace variations.
const importmapScriptTagRegex = /<script\s+data-vite-ignore\s+type="importmap"\s+src="\.\/importmap\.js"\s*><\/script>/;

/**
 * A custom Vite plugin to completely remove the importmap script tag from the final production build.
 * This is necessary because the importmap is only for development (using esm.sh) and is
 * redundant in production where Vite bundles all dependencies. Removing it prevents potential
 * build issues and cleans up the final HTML.
 *
 * How it works:
 * - The `transformIndexHtml` hook intercepts `index.html` before the build process.
 * - We use `enforce: 'pre'` to ensure this plugin runs before any others, guaranteeing
 *   the script tag is removed at the earliest possible moment.
 * - During production builds (`vite build`), it finds and removes the importmap script tag.
 * - During development (`vite dev`), it does nothing, leaving the importmap intact.
 */
const handleImportmapPlugin = () => {
  return {
    name: 'vite-plugin-remove-importmap-on-build',
    enforce: 'pre', // Run this plugin before Vite's core HTML processing.
    
    transformIndexHtml(html, ctx) {
      // Replace the script tag with an empty string to remove it during both dev and production.
      return html.replace(importmapScriptTagRegex, '');
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    handleImportmapPlugin()
  ],
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Keep this rule for the lottie-web eval warning, which is a separate issue.
        if (warning.code === 'EVAL' && warning.id?.includes('lottie-web')) {
          return;
        }
        warn(warning);
      },
    },
  },
});