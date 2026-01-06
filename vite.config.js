import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const placeholder = '<!-- __IMPORTMAP_PLACEHOLDER__ -->';
const importmapScriptTag = `<script data-vite-ignore type="importmap" src="./importmap.js"></script>`;

// Custom plugin to handle the importmap script.
// This removes the importmap from the final production build.
const handleImportmapPlugin = () => {
  return {
    name: 'vite-plugin-handle-importmap',
    
    // Before Vite processes the HTML, replace the script with a placeholder.
    transformIndexHtml(html, ctx) {
      // Only run for the build, not during development.
      if (ctx.server) {
        return html; 
      }
      return html.replace(importmapScriptTag, placeholder);
    },
    
    // After the bundle is generated, remove the placeholder from the final index.html.
    generateBundle(options, bundle) {
      const indexHtmlAsset = bundle['index.html'];
      if (indexHtmlAsset && indexHtmlAsset.type === 'asset') {
        let source = indexHtmlAsset.source.toString();
        if (source.includes(placeholder)) {
          // Replace the placeholder with an empty string to remove it entirely.
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