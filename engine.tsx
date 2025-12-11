
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

type LogCallback = (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
type SelectCallback = (id: string | null) => void;

export interface EngineState {
  type: 'mesh' | 'video' | 'image' | 'glb';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  opacity: number;
  material: {
    color: string;
    wireframe: boolean;
    metalness: number;
    roughness: number;
    emissiveIntensity: number;
  };
  video: {
      playbackRate: number;
      volume: number;
      isPlaying: boolean;
      loop: boolean;
      chromaKey: boolean;
      keyColor: string;
      threshold: number;
      smoothing: number;
  }
}

// GLSL Chroma Key Shader
const chromaVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const chromaFragmentShader = `
uniform sampler2D map;
uniform vec3 keyColor;
uniform float threshold;
uniform float smoothing;
uniform float opacity;
varying vec2 vUv;

void main() {
  vec4 tex = texture2D(map, vUv);
  float dist = distance(tex.rgb, keyColor);
  float alpha = smoothstep(threshold, threshold + smoothing, dist);
  // Invert alpha because we want to remove the key color
  alpha = 1.0 - alpha; 
  
  gl_FragColor = vec4(tex.rgb, tex.a * alpha * opacity);
}
`;

export class Engine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  container: HTMLElement;
  rafId: number;
  onLog: LogCallback;
  onSelect: SelectCallback;

  objects: Map<string, THREE.Object3D> = new Map();
  textures: Map<string, THREE.Texture> = new Map(); 
  videoElements: Map<string, HTMLVideoElement> = new Map();
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  isInteracting: boolean = false;
  gltfLoader: GLTFLoader;

  constructor(container: HTMLElement, onLog: LogCallback = () => {}, onSelect: SelectCallback = () => {}) {
    this.container = container;
    this.onLog = onLog;
    this.onSelect = onSelect;
    
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050505);
    this.scene.fog = new THREE.FogExp2(0x050505, 0.015);

    // Camera
    const { clientWidth: w, clientHeight: h } = container;
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    this.camera.position.set(0, 2, 8);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.2);
    const mainLight = new THREE.DirectionalLight(0xffffff, 2);
    mainLight.position.set(5, 10, 7);
    const fillLight = new THREE.PointLight(0xD4FF00, 0.8, 20); // Acid Fill
    fillLight.position.set(-5, 0, -5);
    const rimLight = new THREE.SpotLight(0x2D6BFF, 5);
    rimLight.position.set(0, 10, -10);
    this.scene.add(ambient, mainLight, fillLight, rimLight);

    // Raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Loaders
    this.gltfLoader = new GLTFLoader();

    // Events
    this.renderer.domElement.addEventListener('pointerdown', () => { this.isInteracting = false; });
    this.renderer.domElement.addEventListener('pointermove', () => { this.isInteracting = true; });
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp.bind(this));
    window.addEventListener('resize', this.onResize.bind(this));

    this.animate = this.animate.bind(this);
    this.animate();
  }

  onPointerUp(event: PointerEvent) {
      if (this.isInteracting) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      const interactables: THREE.Object3D[] = [];
      this.objects.forEach(obj => interactables.push(obj));
      
      const intersects = this.raycaster.intersectObjects(interactables, true); // Recursive for groups/GLB
      
      if (intersects.length > 0) {
          // Find root object
          let target = intersects[0].object;
          while(target.parent && !target.userData.id) {
              target = target.parent;
          }
          if(target.userData.id) this.onSelect(target.userData.id);
      } else {
          this.onSelect(null);
      }
  }

  onResize() {
    if (!this.container) return;
    const { clientWidth: w, clientHeight: h } = this.container;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  animate() {
    this.rafId = requestAnimationFrame(this.animate);
    this.controls.update();
    // Update video textures
    this.videoElements.forEach((video, id) => {
        if (video.readyState >= video.HAVE_CURRENT_DATA) {
            const tex = this.textures.get(id);
            if (tex) tex.needsUpdate = true;
        }
    });
    this.renderer.render(this.scene, this.camera);
  }

  async sync(objects: { [id: string]: { type: string, properties: EngineState } }) {
      const activeIds = new Set(Object.keys(objects));
      
      // Cleanup
      for (const [id, obj] of this.objects) {
          if (!activeIds.has(id)) {
              this.scene.remove(obj);
              this.videoElements.get(id)?.pause();
              this.videoElements.delete(id);
              this.objects.delete(id);
          }
      }

      // Update
      for (const id of activeIds) {
          const state = objects[id];
          let obj = this.objects.get(id);
          
          if (!obj || obj.userData.type !== state.type) {
              await this.createObject(id, state.type as any, state.properties);
              obj = this.objects.get(id);
          }
          
          if (obj) {
              this.updateTransform(obj, state.properties);
              if (state.type === 'mesh') this.updateMaterial(obj as THREE.Mesh, state.properties.material);
              if (state.type === 'video') this.updateVideo(id, state.properties.video);
          }
      }
  }

  async createObject(id: string, type: 'mesh' | 'video' | 'image' | 'glb', props: EngineState) {
      if (this.objects.has(id)) this.scene.remove(this.objects.get(id)!);

      let object: THREE.Object3D;

      if (type === 'mesh') {
          const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
          const material = new THREE.MeshPhysicalMaterial({ color: props.material.color });
          object = new THREE.Mesh(geometry, material);
      } else if (type === 'glb') {
         // Placeholder box until GLB loads, but in a real app we'd load the GLB here
         const geometry = new THREE.IcosahedronGeometry(1, 0);
         const material = new THREE.MeshStandardMaterial({ color: 0x888888, wireframe: true });
         object = new THREE.Mesh(geometry, material);
         // Simulate Async Load
         this.gltfLoader.load('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf', (gltf) => {
             const model = gltf.scene;
             model.userData = { id, type };
             // Replace placeholder
             if(this.objects.get(id)) {
                 this.scene.remove(this.objects.get(id)!);
                 this.scene.add(model);
                 this.objects.set(id, model);
             }
         });
      } else {
          // Plane for Video/Image
          const geometry = new THREE.PlaneGeometry(1.6 * 2, 0.9 * 2);
          const tex = this.textures.get(id);
          let material;
          
          if (type === 'video' && props.video.chromaKey) {
             material = new THREE.ShaderMaterial({
                 uniforms: {
                     map: { value: tex || null },
                     keyColor: { value: new THREE.Color(props.video.keyColor) },
                     threshold: { value: props.video.threshold },
                     smoothing: { value: props.video.smoothing },
                     opacity: { value: props.opacity }
                 },
                 vertexShader: chromaVertexShader,
                 fragmentShader: chromaFragmentShader,
                 transparent: true,
                 side: THREE.DoubleSide
             });
          } else {
             material = new THREE.MeshBasicMaterial({ map: tex || null, transparent: true, side: THREE.DoubleSide });
          }
          object = new THREE.Mesh(geometry, material);
      }

      object.userData = { id, type };
      this.scene.add(object);
      this.objects.set(id, object);
  }

  async loadMedia(id: string, type: 'video' | 'image', url: string) {
      if (type === 'video') {
          const video = document.createElement('video');
          video.src = url;
          video.crossOrigin = 'anonymous';
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          await new Promise<void>(resolve => { video.onloadedmetadata = () => resolve(); });
          const texture = new THREE.VideoTexture(video);
          texture.colorSpace = THREE.SRGBColorSpace;
          this.textures.set(id, texture);
          this.videoElements.set(id, video);
          video.play();
      } else {
          const texture = await new THREE.TextureLoader().loadAsync(url);
          texture.colorSpace = THREE.SRGBColorSpace;
          this.textures.set(id, texture);
      }
  }

  updateTransform(obj: THREE.Object3D, props: EngineState) {
      obj.position.set(props.position.x, props.position.y, props.position.z);
      obj.rotation.set(props.rotation.x, props.rotation.y, props.rotation.z);
      obj.scale.set(props.scale.x, props.scale.y, props.scale.z);
      
      // Update opacity for meshes with transparency support
      if (obj instanceof THREE.Mesh) {
          if((obj.material as any).uniforms) {
              (obj.material as any).uniforms.opacity.value = props.opacity;
          } else if ((obj.material as THREE.Material).opacity !== undefined) {
              (obj.material as THREE.Material).opacity = props.opacity;
              (obj.material as THREE.Material).transparent = props.opacity < 1;
          }
      }
  }

  updateMaterial(mesh: THREE.Mesh, props: EngineState['material']) {
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      if (!mat.isMeshPhysicalMaterial) return;
      mat.color.set(props.color);
      mat.emissive.set(props.color);
      mat.emissiveIntensity = props.emissiveIntensity;
      mat.metalness = props.metalness;
      mat.roughness = props.roughness;
      mat.wireframe = props.wireframe;
  }

  updateVideo(id: string, props: EngineState['video']) {
      const video = this.videoElements.get(id);
      if (video) {
          video.volume = props.volume;
          video.muted = props.volume === 0;
          if(props.isPlaying && video.paused) video.play();
          if(!props.isPlaying && !video.paused) video.pause();
      }
      const obj = this.objects.get(id) as THREE.Mesh;
      if (obj && (obj.material as THREE.ShaderMaterial).uniforms) {
          const uniforms = (obj.material as THREE.ShaderMaterial).uniforms;
          uniforms.keyColor.value.set(props.keyColor);
          uniforms.threshold.value = props.threshold;
          uniforms.smoothing.value = props.smoothing;
      }
  }

  dispose() {
      this.renderer.dispose();
      this.videoElements.forEach(v => v.pause());
  }
}
