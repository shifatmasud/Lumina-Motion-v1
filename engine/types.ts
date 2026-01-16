
import { SceneObject } from ".";

export interface TimelineKeyframe {
  time: number; // in seconds, relative to the clip's start
  name?: string; // Optional user-defined name
  easing?: string; // for GSAP
  values: Partial<Pick<SceneObject, 'position' | 'rotation' | 'scale' | 'metalness' | 'roughness' | 'volume' | 'opacity' | 'curvature' | 'transmission' | 'ior' | 'thickness' | 'clearcoat' | 'clearcoatRoughness' | 'extrusion' | 'pathLength' | 'color' | 'intensity'>>;
}

export interface TransitionEffect {
  type: 'none' | 'custom';
  duration: number;
  delay: number;
  fade: boolean;
  scale: number;
  position: [number, number, number];
  rotation: [number, number, number];
  easing: string;
}

export interface PhysicsSettings {
  enabled: boolean;
  type: 'dynamic' | 'static';
  mass: number;
  friction: number;
  restitution: number; // bounciness
  force?: {
    preset: 'none' | 'push_up' | 'push_down' | 'push_forward' | 'push_backward' | 'pull_center' | 'push_from_center' | 'pull_in_source' | 'push_out_source';
    strength: number;
  };
}

export interface SceneObject {
  id: string;
  name?: string;
  type: 'mesh' | 'plane' | 'video' | 'glb' | 'audio' | 'camera' | 'svg' | 'lottie' | 'light';
  url?: string;
  width?: number;
  height?: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color?: string;
  intensity?: number;
  lightType?: 'directional' | 'spot';
  extrusion?: number;
  pathLength?: number;
  metalness?: number;
  roughness?: number;
  opacity?: number;
  transmission?: number;
  ior?: number;
  thickness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  curvature?: number; // Cylinder wrap distortion
  volume?: number; // For audio
  fov?: number; // For camera
  loop?: boolean; // For video/audio
  wireframe?: boolean; // For debug view
  locked?: boolean;
  visible?: boolean;
  chromaKey?: {
    enabled: boolean;
    color: string;
    similarity: number;
    smoothness: number;
  };
  startTime: number;
  duration: number;
  animations: TimelineKeyframe[];
  introTransition: TransitionEffect;
  outroTransition: TransitionEffect;
  physics?: PhysicsSettings;
}

export interface GlobalSettings {
  backgroundColor: string;
  bloom: { enabled: boolean; strength: number; threshold: number; radius: number; };
  vignette: { enabled: boolean; offset: number; darkness: number; };
  accentColor: string;
  showGrid: boolean;
  showLightHelpers: boolean;
  ambientLight: { color: string; intensity: number; };
  mainLight: { color: string; intensity: number; position: [number, number, number]; }; // Unused but kept for type safety
  rimLight: { enabled: boolean; color: string; intensity: number; position: [number, number, number]; }; // Unused but kept for type safety
  performance: {
    pixelRatio: number;
    shadowMapSize: 1024 | 2048 | 4096;
  };
  aspectRatio: string;
}
