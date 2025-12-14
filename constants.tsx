import { DesignSystem } from './theme';
import { SceneObject, GlobalSettings, TransitionEffect } from './engine';

export const defaultTransition: TransitionEffect = {
  type: 'none', 
  duration: 0.5,
  delay: 0,
  fade: true,
  scale: 0.8,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  easing: 'none',
};

export const materialPresets: { [key: string]: Partial<SceneObject> } = {
    'default': { metalness: 0.2, roughness: 0.1, transmission: 0, ior: 1.5, thickness: 0.5, clearcoat: 0, clearcoatRoughness: 0, opacity: 1 },
    'clay': { metalness: 0, roughness: 1.0, transmission: 0, clearcoat: 0, ior: 1.4, opacity: 1 },
    'glass': { metalness: 0, roughness: 0.02, transmission: 1.0, ior: 1.5, thickness: 1.2, clearcoat: 1.0, clearcoatRoughness: 0.05, opacity: 1 },
    'frostedGlass': { metalness: 0, roughness: 0.45, transmission: 1.0, ior: 1.5, thickness: 1.2, clearcoat: 0.1, clearcoatRoughness: 0.1, opacity: 1 },
    'metal': { metalness: 1.0, roughness: 0.1, transmission: 0, clearcoat: 0.5, clearcoatRoughness: 0.1, ior: 2.5, opacity: 1 },
    'chrome': { metalness: 1.0, roughness: 0.0, transmission: 0, clearcoat: 1.0, clearcoatRoughness: 0.0, ior: 2.5, opacity: 1 },
    'plastic': { metalness: 0.1, roughness: 0.5, transmission: 0, clearcoat: 0.5, clearcoatRoughness: 0.1, ior: 1.5, opacity: 1 },
    'water': { metalness: 0.1, roughness: 0.1, transmission: 0.9, ior: 1.33, thickness: 1.0, clearcoat: 1.0, clearcoatRoughness: 0, opacity: 1 },
};

export const DEFAULT_ACCENT_COLOR = '#5B50FF';

export const INITIAL_OBJECTS: SceneObject[] = [
    {
      id: 'camera-main',
      type: 'camera',
      name: 'Main Camera',
      position: [0, 0, 6],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      startTime: 0,
      duration: 1,
      animations: [],
      introTransition: { ...defaultTransition },
      outroTransition: { ...defaultTransition },
      fov: 60,
      wireframe: false,
    },
    { 
      id: '1', 
      type: 'mesh', 
      name: 'Cube',
      position: [0, 0.5, 0], 
      rotation: [0, 0, 0], 
      scale: [1, 1, 1], 
      color: '#ffffff',
      ...materialPresets.default,
      startTime: 0,
      duration: 5,
      animations: [],
      introTransition: { ...defaultTransition },
      outroTransition: { ...defaultTransition },
      wireframe: false,
    },
    {
      id: 'main-light',
      type: 'light',
      lightType: 'directional',
      name: 'Main Light',
      position: [5, 10, 7],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#ffffff',
      intensity: 1.2,
      startTime: 0,
      duration: 5,
      animations: [],
      introTransition: { ...defaultTransition },
      outroTransition: { ...defaultTransition },
      wireframe: false,
    },
    {
      id: 'rim-light',
      type: 'light',
      lightType: 'spot',
      name: 'Rim Light',
      position: [0, 0, 1],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: DEFAULT_ACCENT_COLOR,
      intensity: 5.0,
      startTime: 0,
      duration: 5,
      animations: [],
      introTransition: { ...defaultTransition },
      outroTransition: { ...defaultTransition },
      wireframe: false,
    }
];

export const INITIAL_GLOBAL_SETTINGS: GlobalSettings = {
    backgroundColor: '#000000',
    bloom: { enabled: false, strength: 0.2, threshold: 0.85, radius: 0.5 },
    vignette: { enabled: false, offset: 1.0, darkness: 1.0 },
    accentColor: DEFAULT_ACCENT_COLOR,
    showGrid: true,
    showGround: true,
    showLightHelpers: false,
    groundColor: '#050505',
    ambientLight: { color: '#ffffff', intensity: 0.4 },
    mainLight: { color: '#ffffff', intensity: 1.2, position: [5, 10, 7] }, // Kept for type safety, but will be unused
    rimLight: { enabled: true, color: DEFAULT_ACCENT_COLOR, intensity: 5.0, position: [0, 0, 1] }, // Kept for type safety, but will be unused
    performance: {
        pixelRatio: Math.min(window.devicePixelRatio, 1.5),
        shadowMapSize: 2048,
    },
    aspectRatio: 'free',
};

export const ACCENT_COLORS = [DEFAULT_ACCENT_COLOR, '#FF4F1F', '#BEF264', '#5865F2'];

export const EASING_OPTIONS = [
  { label: 'Linear', value: 'none' },
  { label: 'Ease In (Sine)', value: 'power1.in' },
  { label: 'Ease Out (Sine)', value: 'power1.out' },
  { label: 'Ease In-Out (Sine)', value: 'power1.inOut' },
  { label: 'Ease In (Cubic)', value: 'power3.in' },
  { label: 'Ease Out (Cubic)', value: 'power3.out' },
  { label: 'Ease In-Out (Cubic)', value: 'power3.inOut' },
  { label: 'Anticipate (Back In)', value: 'back.in(1.7)' },
  { label: 'Overshoot (Back Out)', value: 'back.out(1.7)' },
  { label: 'Bounce In', value: 'bounce.in' },
  { label: 'Bounce Out', value: 'bounce.out' },
  { label: 'Elastic In', value: 'elastic.in(1, 0.75)' },
  { label: 'Elastic Out', value: 'elastic.out(1, 0.75)' },
  { label: 'Squash & Stretch', value: 'elastic.out(1, 0.4)' },
];