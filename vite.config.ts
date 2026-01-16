
export default {
  build: {
    // Increase the limit to 2000KB to suppress the warning for the large 3D/Animation bundles
    chunkSizeWarningLimit: 2000,
    // We omit plugins here to rely on the environment's default React/TSX handling
  }
};
