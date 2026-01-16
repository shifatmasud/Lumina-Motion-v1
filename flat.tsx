
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'https://esm.sh/three@0.180.0';
import { OrbitControls } from 'https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls?deps=three@0.180.0';
import { GLTFLoader } from 'https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader?deps=three@0.180.0';
import { SVGLoader } from 'https://esm.sh/three@0.180.0/examples/jsm/loaders/SVGLoader?deps=three@0.180.0';
import { EffectComposer } from 'https://esm.sh/three@0.180.0/examples/jsm/postprocessing/EffectComposer?deps=three@0.180.0';
import { RenderPass } from 'https://esm.sh/three@0.180.0/examples/jsm/postprocessing/RenderPass?deps=three@0.180.0';
import { ShaderPass } from 'https://esm.sh/three@0.180.0/examples/jsm/postprocessing/ShaderPass?deps=three@0.180.0';
import { UnrealBloomPass } from 'https://esm.sh/three@0.180.0/examples/jsm/postprocessing/UnrealBloomPass?deps=three@0.180.0';
import { VignetteShader } from 'https://esm.sh/three@0.180.0/examples/jsm/shaders/VignetteShader?deps=three@0.180.0';
import { motion, AnimatePresence, useDragControls, useMotionValue, useTransform, Reorder } from 'https://esm.sh/framer-motion@12.23.24?deps=react@18.2.0';
import gsap from 'https://esm.sh/gsap@3.13.0';
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9.0.1';
import yaml from 'https://esm.sh/js-yaml@4.1.0';
import JSZip from 'https://esm.sh/jszip@3.10.1';
import WebMWriter from 'https://esm.sh/webm-writer@0.3.0';
import lottie from 'https://esm.sh/lottie-web@5.12.2';
import * as CANNON from 'https://esm.sh/cannon-es@0.20.0';
import { 
    Play, Pause, Diamond, DotsSixVertical, DotsThreeVertical, Scissors, Copy, Trash, Camera as CameraIcon, 
    ArrowCounterClockwise, ArrowClockwise, SpeakerHigh, Cube, PencilSimple, ClipboardText, MagicWand, 
    Lightbulb, Eye, EyeSlash, SquaresFour, FilmStrip, Faders, DotsThree, CornersOut, Minus, X, Gear, 
    ToggleRight, Palette, Atom, Sparkle, Globe, Key, Monitor, VideoCamera, PaintBrush, CaretDown, Plus, Export, 
    Image as ImageIcon, Lock, LockOpen, CheckCircle, CircleNotch, FileVideo, FileArchive 
} from 'https://esm.sh/@phosphor-icons/react@2.1.0?deps=react@18.2.0';

// --- STYLES ---

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Comic+Neue:wght@400;700&family=Inter:wght@400;500;600&family=Victor+Mono:wght@400;500&display=swap');

:root {
  --font-display: 'Bebas Neue', cursive;
  --font-expressive: 'Comic Neue', cursive;
  --font-code: 'Victor Mono', monospace;
  --font-body: 'Inter', sans-serif;
  --accent-surface: #5B50FF;
  --accent-surface-dim: #4038B5;
  --accent-content: #FFFFFF;
  --accent-glow: rgba(91, 80, 255, 0.4);
}

.lumina-editor-root * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.lumina-editor-root {
  font-family: var(--font-body);
  background-color: #050505;
  color: #e0e0e0;
  overflow: hidden;
  width: 100%;
  height: 100%;
  position: relative;
}

.lumina-editor-root ::-webkit-scrollbar { width: 4px; height: 4px; }
.lumina-editor-root ::-webkit-scrollbar-track { background: transparent; }
.lumina-editor-root ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
.lumina-editor-root ::-webkit-scrollbar-thumb:hover { background: #555; }
.lumina-editor-root canvas { display: block; outline: none; }
`;

// --- THEME ---

const DesignSystem = {
  Color: {
    Base: {
      Surface: { 1: '#000000', 2: '#0A0A0B', 3: '#18181B', '3b': 'rgba(10, 10, 11, 0.65)' },
      Content: { 1: '#EDEDED', 2: '#A1A1AA', 3: '#52525B' },
      Border: { 1: 'rgba(255, 255, 255, 0.08)', 2: 'rgba(255, 255, 255, 0.12)', 3: 'var(--accent-surface-dim, rgba(91, 80, 255, 0.3))' }
    },
    Accent: {
      Surface: { 1: 'var(--accent-surface, #5B50FF)', 2: 'var(--accent-surface-dim, #4038B5)' },
      Content: { 1: 'var(--accent-content, #FFFFFF)', 2: '#E0E7FF' }
    },
    Feedback: { Success: '#10B981', Warning: '#F59E0B', Error: '#FF4444' }
  },
  Type: {
    Display: {
      L: { fontFamily: 'var(--font-display)', fontSize: '48px', lineHeight: '100%', letterSpacing: '0.02em' },
      M: { fontFamily: 'var(--font-display)', fontSize: '32px', lineHeight: '110%', letterSpacing: '0.02em' },
    },
    Label: {
      L: { fontFamily: 'var(--font-body)', fontSize: '16px', fontWeight: 600, lineHeight: '140%', letterSpacing: '-0.01em' },
      M: { fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 500, lineHeight: '140%', letterSpacing: '-0.01em' },
      S: { fontFamily: 'var(--font-code)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' },
    },
    Body: { M: { fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: '160%', letterSpacing: '0' } }
  },
  Effect: {
    Shadow: {
      Depth: '0 32px 64px -16px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.05)',
      Glow: '0 0 24px var(--accent-glow, rgba(91, 80, 255, 0.4))',
    },
    Radius: { S: '8px', M: '16px', L: '24px', XL: '32px', Full: '9999px' },
    Transition: { Fast: '0.2s cubic-bezier(0.2, 0, 0, 1)', Smooth: '0.5s cubic-bezier(0.16, 1, 0.3, 1)' }
  },
  Space: (n: number) => `${n * 4}px`,
};

// --- TYPES & SHADERS ---

const chromaKeyVertexShader = `
uniform float curvature;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 pos = position;
  if (abs(curvature) > 0.001) {
     float radius = 1.0 / curvature;
     float theta = pos.x * curvature;
     pos.x = radius * sin(theta);
     pos.z = radius * (1.0 - cos(theta));
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const chromaKeyFragmentShader = `
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

// --- CONSTANTS ---

const DEFAULT_ACCENT_COLOR = '#5B50FF';
const EASING_OPTIONS = [
  { label: 'Linear', value: 'none' },
  { label: 'Ease In (Sine)', value: 'power1.in' },
  { label: 'Ease Out (Sine)', value: 'power1.out' },
  { label: 'Ease In-Out (Sine)', value: 'power1.inOut' },
  { label: 'Overshoot (Back Out)', value: 'back.out(1.7)' },
  { label: 'Bounce Out', value: 'bounce.out' },
  { label: 'Elastic Out', value: 'elastic.out(1, 0.75)' },
];

const defaultTransition = { type: 'none', duration: 0.5, delay: 0, fade: true, scale: 0.8, position: [0, 0, 0], rotation: [0, 0, 0], easing: 'none' };

const materialPresets = {
    'default': { metalness: 0.2, roughness: 0.1, transmission: 0, opacity: 1 },
    'glass': { metalness: 0, roughness: 0.02, transmission: 1.0, ior: 1.5, thickness: 1.2, clearcoat: 1.0, opacity: 1 },
    'metal': { metalness: 1.0, roughness: 0.1, transmission: 0, clearcoat: 0.5, opacity: 1 },
};

const INITIAL_OBJECTS = [
    { id: 'camera-main', type: 'camera', name: 'Main Camera', position: [0, 0, 6], rotation: [0, 0, 0], scale: [1, 1, 1], startTime: 0, duration: 5, animations: [], fov: 60 },
    { id: 'ground-plane', type: 'mesh', name: 'Ground', locked: true, position: [0, -0.05, 0], rotation: [0, 0, 0], scale: [30, 0.1, 30], color: '#050505', metalness: 0, roughness: 0.8, startTime: 0, duration: 5, animations: [], physics: { enabled: true, type: 'static', mass: 0, friction: 0.5, restitution: 0.3 } },
    { id: '1', type: 'mesh', name: 'Cube', position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ffffff', ...materialPresets.default, startTime: 0, duration: 5, animations: [], physics: { enabled: true, type: 'dynamic', mass: 1, friction: 0.3, restitution: 0.5 } },
    { id: 'main-light', type: 'light', lightType: 'directional', name: 'Main Light', position: [5, 10, 7], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ffffff', intensity: 1.2, startTime: 0, duration: 5, animations: [] }
];

const INITIAL_GLOBAL_SETTINGS = {
    backgroundColor: '#000000',
    bloom: { enabled: false, strength: 0.2, threshold: 0.85, radius: 0.5 },
    vignette: { enabled: false, offset: 1.0, darkness: 1.0 },
    accentColor: DEFAULT_ACCENT_COLOR,
    showGrid: true,
    showLightHelpers: false,
    ambientLight: { color: '#ffffff', intensity: 0.4 },
    performance: { pixelRatio: Math.min(window.devicePixelRatio, 1.5), shadowMapSize: 2048 },
    aspectRatio: 'free',
};

// --- ENGINE LOGIC ---

function updateSVGGeometry(mesh: THREE.Group, objData: any) {
    const { svgPaths } = mesh.userData;
    if (!svgPaths) return;
    mesh.clear();
    const material = new THREE.MeshPhysicalMaterial({ color: objData.color || '#ffffff', metalness: objData.metalness ?? 0.1, roughness: objData.roughness ?? 0.4, transparent: (objData.opacity ?? 1.0) < 1.0, opacity: objData.opacity ?? 1.0, side: THREE.DoubleSide });
    const group = new THREE.Group();
    for (const path of svgPaths) {
        const shapes = SVGLoader.createShapes(path);
        for (const shape of shapes) {
            const geometry = new THREE.ExtrudeGeometry(shape, { depth: objData.extrusion ?? 0.1, bevelEnabled: false });
            const svgMesh = new THREE.Mesh(geometry, material);
            group.add(svgMesh);
        }
    }
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = 1.0 / Math.max(size.x, size.y, size.z);
    if (isFinite(scale)) { group.scale.setScalar(scale); const center = box.getCenter(new THREE.Vector3()); group.position.sub(center.multiplyScalar(scale)); }
    mesh.add(group);
}

function createMesh(engine: any, objData: any): THREE.Object3D {
    let mesh: THREE.Object3D;
    if (objData.type === 'mesh') {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshPhysicalMaterial({ color: objData.color || '#ffffff', metalness: objData.metalness ?? 0.2, roughness: objData.roughness ?? 0.1, transparent: (objData.opacity ?? 1.0) < 1.0, opacity: objData.opacity ?? 1.0, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true; mesh.receiveShadow = true;
    } else if (objData.type === 'svg') {
        mesh = new THREE.Group();
        if (objData.url) engine.svgLoader.load(objData.url, (data) => { mesh.userData.svgPaths = data.paths; updateSVGGeometry(mesh as THREE.Group, objData); });
    } else if (objData.type === 'plane' || objData.type === 'video') {
        const geometry = new THREE.PlaneGeometry(1.6, 0.9, 32, 1);
        let material: THREE.Material;
        if (objData.url) {
            let texture;
            if (objData.type === 'video') {
                const video = document.createElement('video');
                video.src = objData.url; video.loop = true; video.crossOrigin = 'anonymous'; video.playsInline = true;
                engine.mediaElements.set(objData.id, video);
                texture = new THREE.VideoTexture(video);
            } else texture = new THREE.TextureLoader().load(objData.url);
            texture.colorSpace = THREE.SRGBColorSpace;
            material = new THREE.ShaderMaterial({
                uniforms: { map: { value: texture }, keyColor: { value: new THREE.Color(objData.chromaKey?.color || '#00ff00') }, similarity: { value: objData.chromaKey?.similarity || 0.1 }, smoothness: { value: objData.chromaKey?.smoothness || 0.1 }, opacity: { value: objData.opacity ?? 1.0 }, curvature: { value: objData.curvature ?? 0.0 }, chromaKeyEnabled: { value: objData.chromaKey?.enabled || false } },
                vertexShader: chromaKeyVertexShader, fragmentShader: chromaKeyFragmentShader, transparent: true, side: THREE.DoubleSide
            });
        } else material = new THREE.MeshBasicMaterial({ color: '#333', transparent: true, opacity: objData.opacity ?? 1.0, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(geometry, material);
    } else if (objData.type === 'light') {
        const lightGroup = new THREE.Group();
        const light = objData.lightType === 'directional' ? new THREE.DirectionalLight(objData.color, objData.intensity) : new THREE.SpotLight(objData.color, objData.intensity);
        light.castShadow = true;
        lightGroup.add(light);
        const raycastTarget = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({ color: objData.color, transparent: true, opacity: 0.5 }));
        raycastTarget.name = 'light_handle'; raycastTarget.visible = false;
        lightGroup.add(raycastTarget);
        mesh = lightGroup;
    } else mesh = new THREE.Group();
    return mesh;
}

class EngineCore {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; controls: OrbitControls; container: HTMLElement;
  raycaster: THREE.Raycaster; pointer: THREE.Vector2; objectsMap: Map<string, THREE.Object3D>; mediaElements: Map<string, HTMLVideoElement>;
  composer: EffectComposer; bloomPass: UnrealBloomPass; vignettePass: ShaderPass; audioListener: THREE.AudioListener;
  svgLoader: SVGLoader; gltfLoader: GLTFLoader; ambientLight: THREE.AmbientLight; gridHelper: THREE.GridHelper;
  isUserControllingCamera = false; onSelect?: (id: string | null) => void;

  constructor(container: HTMLElement, onSelect?: (id: string | null) => void) {
    this.container = container; this.onSelect = onSelect; this.objectsMap = new Map(); this.mediaElements = new Map();
    this.pointer = new THREE.Vector2(); this.raycaster = new THREE.Raycaster(); this.svgLoader = new SVGLoader(); this.gltfLoader = new GLTFLoader();
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#000000');
    this.gridHelper = new THREE.GridHelper(30, 30, 0x222222, 0x111111); this.scene.add(this.gridHelper);
    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000); this.camera.position.set(0, 0, 6);
    this.audioListener = new THREE.AudioListener(); this.camera.add(this.audioListener);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight); this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);
    this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 1.5, 0.4, 0.85); this.bloomPass.enabled = false; this.composer.addPass(this.bloomPass);
    this.vignettePass = new ShaderPass(VignetteShader); this.vignettePass.enabled = false; this.composer.addPass(this.vignettePass);
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4); this.scene.add(this.ambientLight);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement); this.controls.enableDamping = true;
    this.controls.addEventListener('start', () => { this.isUserControllingCamera = true; });
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));
    this.animate();
  }

  onPointerDown(event: PointerEvent) {
    this.pointer.x = (event.clientX / this.container.clientWidth) * 2 - 1; this.pointer.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(Array.from(this.objectsMap.values()), true);
    if (intersects.length > 0) {
      let selected = intersects[0].object; let foundId: string | null = null;
      while(selected) { for (const [id, obj] of this.objectsMap.entries()) { if (obj === selected) { foundId = id; break; } } if (foundId || !selected.parent) break; selected = selected.parent; }
      if (this.onSelect) this.onSelect(foundId);
    } else if (this.onSelect) this.onSelect(null);
  }

  sync(objects: any[]) {
    const unseen = new Set(this.objectsMap.keys());
    objects.forEach(objData => {
        let obj3d = this.objectsMap.get(objData.id);
        if (!obj3d) { obj3d = createMesh(this, objData); if (objData.type !== 'camera') this.scene.add(obj3d); this.objectsMap.set(objData.id, obj3d); }
        unseen.delete(objData.id);
    });
    unseen.forEach(id => { const obj = this.objectsMap.get(id); if (obj) { obj.traverse((c: any) => { if (c.isMesh) { c.geometry.dispose(); if (Array.isArray(c.material)) c.material.forEach((m: any) => m.dispose()); else c.material.dispose(); } }); if (obj.parent) obj.parent.remove(obj); } this.objectsMap.delete(id); });
  }

  updateGlobalSettings(settings: any) {
      this.scene.background = new THREE.Color(settings.backgroundColor); this.bloomPass.enabled = settings.bloom.enabled;
      this.vignettePass.enabled = settings.vignette.enabled; this.ambientLight.intensity = settings.ambientLight.intensity;
      this.gridHelper.visible = settings.showGrid;
  }

  animate() { requestAnimationFrame(() => this.animate()); this.controls.update(); this.composer.render(); }
  onResize() { const w = this.container.clientWidth; const h = this.container.clientHeight; if (h === 0) return; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h); this.composer.setSize(w, h); }
}

// --- HELPERS ---

const getInterpolatedValueAtTime = (objData: any, property: string, localTime: number) => {
    const baseValue = objData[property]; if (!objData.animations || objData.animations.length === 0) return baseValue;
    const keyframes = [...objData.animations].sort((a,b) => a.time - b.time);
    let departureKf = { time: 0, values: {} }; let arrivalKf: any = null;
    for (const kf of keyframes) { if (kf.time <= localTime) departureKf = kf; else { arrivalKf = kf; break; } }
    if (!arrivalKf) arrivalKf = departureKf;
    const startVal = departureKf.values[property] ?? objData[property];
    const endVal = arrivalKf.values[property] ?? objData[property];
    const duration = arrivalKf.time - departureKf.time; const progress = duration > 0 ? (localTime - departureKf.time) / duration : 1;
    const ease = gsap.parseEase(arrivalKf.easing || 'none'); const easedProgress = ease(progress);
    if (property === 'color') return gsap.utils.interpolate(startVal, endVal)(easedProgress);
    return gsap.utils.interpolate(startVal, endVal, easedProgress);
};

// --- CORE COMPONENTS ---

const Button: React.FC<any> = ({ children, variant = 'secondary', active, style, ...props }) => {
  const getStyles = () => {
    const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 16px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', transition: '0.2s' };
    if (variant === 'primary' || active) return { ...base, backgroundColor: '#5B50FF', color: '#fff' };
    return { ...base, backgroundColor: '#18181B', color: '#EDEDED', border: '1px solid rgba(255,255,255,0.08)' };
  };
  return <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }} style={{ ...getStyles(), ...style }} {...props}>{children}</motion.button>;
};

const Window: React.FC<any> = ({ id, title, isOpen, onClose, children, width = 360, height = 400 }) => {
  const controls = useDragControls();
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} drag dragControls={controls} dragListener={false}
          style={{ position: 'absolute', left: '50px', top: '50px', width, height, backgroundColor: 'rgba(10, 10, 11, 0.85)', backdropFilter: 'blur(32px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 100 }}
        >
          <div onPointerDown={(e) => controls.start(e)} style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', cursor: 'grab' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em' }}>{title}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#52525B', cursor: 'pointer' }}><X size={16} /></button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// --- MAIN APP ---

const LuminaEditor = () => {
    const [globalSettings, setGlobalSettings] = useState(INITIAL_GLOBAL_SETTINGS);
    const [objects, setObjects] = useState<any[]>(INITIAL_OBJECTS);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showTimeline, setShowTimeline] = useState(true);
    const [showProps, setShowProps] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<EngineCore | null>(null);

    useEffect(() => {
        const style = document.createElement('style'); style.innerHTML = GLOBAL_CSS; document.head.appendChild(style);
        if (containerRef.current && !engineRef.current) { engineRef.current = new EngineCore(containerRef.current, setSelectedId); }
    }, []);

    useEffect(() => { if (engineRef.current) engineRef.current.sync(objects); }, [objects]);
    useEffect(() => { if (engineRef.current) engineRef.current.updateGlobalSettings(globalSettings); }, [globalSettings]);

    useEffect(() => {
        if (isPlaying) {
            let last = performance.now();
            const frame = (now: number) => {
                const delta = (now - last) / 1000; last = now;
                setCurrentTime(t => { const nt = t + delta; return nt >= 5 ? 0 : nt; });
                if (isPlaying) requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
        }
    }, [isPlaying]);

    return (
        <div className="lumina-editor-root">
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            <Window title="PROPERTIES" isOpen={showProps} onClose={() => setShowProps(false)} width={300}>
                {selectedId ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>Editing: {objects.find(o => o.id === selectedId)?.name}</span>
                        <Button variant="primary" onClick={() => setSelectedId(null)}>Deselect</Button>
                    </div>
                ) : <span style={{ color: '#52525B' }}>Select an object to edit</span>}
            </Window>

            <Window title="TIMELINE" isOpen={showTimeline} onClose={() => setShowTimeline(false)} width={600} height={200}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Button onClick={() => setIsPlaying(!isPlaying)}>{isPlaying ? <Pause /> : <Play />}</Button>
                    <input type="range" min="0" max="5" step="0.01" value={currentTime} onChange={e => setCurrentTime(parseFloat(e.target.value))} style={{ flex: 1 }} />
                    <span style={{ fontFamily: 'monospace' }}>{currentTime.toFixed(2)}s</span>
                </div>
            </Window>

            <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '12px', backgroundColor: 'rgba(10,10,11,0.8)', padding: '12px 24px', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.08)', zIndex: 200 }}>
                <Button onClick={() => setShowTimeline(!showTimeline)} active={showTimeline}><FilmStrip /></Button>
                <Button onClick={() => setShowProps(!showProps)} active={showProps}><Faders /></Button>
            </div>
        </div>
    );
};

export default LuminaEditor;

// Mount
const root = createRoot(document.getElementById('root')!);
root.render(<LuminaEditor />);
