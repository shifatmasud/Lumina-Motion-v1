
export const chromaKeyVertexShader = `
uniform float curvature;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 pos = position;
  
  if (abs(curvature) > 0.001) {
     float radius = 1.0 / curvature;
     // theta = x * curvature (approximation of x / radius)
     float theta = pos.x * curvature;
     pos.x = radius * sin(theta);
     pos.z = radius * (1.0 - cos(theta));
  }
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const chromaKeyFragmentShader = `
uniform sampler2D map;
uniform vec3 keyColor;
uniform float similarity;
uniform float smoothness;
uniform float opacity;
uniform bool chromaKeyEnabled;
varying vec2 vUv;

void main() {
  vec4 texColor = texture2D(map, vUv);
  vec3 finalColor = texColor.rgb;
  float finalAlpha = texColor.a * opacity;

  if (chromaKeyEnabled) {
    float d = length(texColor.rgb - keyColor);
    float alpha = smoothstep(similarity, similarity + smoothness, d);
    finalAlpha *= alpha;
  }

  gl_FragColor = vec4(finalColor, finalAlpha);
}
`;
