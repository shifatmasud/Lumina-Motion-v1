import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const placeholder = '<!-- __IMPORTMAP_PLACEHOLDER__ -->';
// Use a regex to robustly match the script tag, ignoring whitespace variations.
const importmapScriptTagRegex = /<script\s+data-vite-ignore\s+type="importmap"\s+src="\.\/importmap\.js"\s*><\/script>/;

/**
 * A custom Vite plugin to completely remove the importmap script tag during the production build.
 * This is necessary because:
 * 1. The importmap is only needed for development to resolve modules from esm.sh.
 * 2. In production, Vite bundles all dependencies, so the importmap is redundant.
 * 3. Leaving the script tag can cause build warnings and is unnecessary clutter.
 *
 * How it works:
 * - `transformIndexHtml`: Before the build starts, this hook replaces the real script tag with a simple HTML comment placeholder.
 *   Vite's bundler never sees the original script, so it doesn't try to process it. We use `enforce: 'pre'` to ensure this runs first.
 * - `generateBundle`: After the build is complete, this hook finds the placeholder in the final index.html and removes it,
 *   ensuring no trace of the importmap script is left in the production output.
 */
const handleImportmapPlugin = () => {
  return {
    name: 'vite-plugin-remove-importmap-on-build',
    enforce: 'pre', // Run this plugin before Vite's core HTML processing.
    
    // This hook runs before Vite's build process touches the index.html.
    transformIndexHtml(html, ctx) {
      // We only want to modify the HTML for production builds, not during `vite dev`.
      if (ctx.server) {
        return html; // In dev mode, leave the importmap as is.
      }
      // For production builds, replace the script with our placeholder.
      return html.replace(importmapScriptTagRegex, placeholder);
    },
    
    // This hook runs after the entire bundle has been generated and is ready to be written to disk.
    generateBundle(options, bundle) {
      const indexHtmlAsset = bundle['index.html'];
      
      // Ensure we are modifying the correct file.
      if (indexHtmlAsset && indexHtmlAsset.type === 'asset') {
        let source = indexHtmlAsset.source.toString();
        if (source.includes(placeholder)) {
          // Replace the placeholder with an empty string to completely remove it.
          source = source.replace(placeholder, '');
          indexHtmlAsset.source = source;
        }
      }
    }
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