
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      // Mark these as external so Rollup doesn't try to bundle them.
      // This is crucial for environments using browser-native import maps.
      external: [
        'react',
        'react-dom/client',
        'three',
        'three/examples/jsm/controls/OrbitControls',
        'three/examples/jsm/loaders/GLTFLoader',
        'three/examples/jsm/loaders/SVGLoader',
        'three/examples/jsm/postprocessing/EffectComposer',
        'three/examples/jsm/postprocessing/RenderPass',
        'three/examples/jsm/postprocessing/ShaderPass',
        'three/examples/jsm/postprocessing/UnrealBloomPass',
        'three/examples/jsm/shaders/VignetteShader',
        'framer-motion',
        'gsap',
        '@phosphor-icons/react',
        'cannon-es',
        '@google/genai',
        'js-yaml',
        'jszip',
        'uuid',
        'lottie-web',
        'webm-writer'
      ],
    },
  },
});
