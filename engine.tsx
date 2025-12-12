
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import gsap from 'gsap';

export interface TimelineKeyframe {
  time: number; // in seconds, relative to the clip's start
  easing?: string; // for GSAP
  values: Partial<Pick<SceneObject, 'position' | 'rotation' | 'scale' | 'metalness' | 'roughness' | 'volume' | 'opacity'>>;
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

export interface SceneObject {
  id: string;
  type: 'mesh' | 'plane' | 'video' | 'glb' | 'audio' | 'camera';
  url?: string;
  width?: number;
  height?: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color?: string;
  metalness?: number;
  roughness?: number;
  opacity?: number;
  volume?: number; // For audio
  fov?: number; // For camera
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
}

export interface GlobalSettings {
  backgroundColor: string;
  bloom: { enabled: boolean; strength: number; threshold: number; radius: number; };
  vignette: { enabled: boolean; offset: number; darkness: number; };
  accentColor: string;
}

const chromaKeyVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const chromaKeyFragmentShader = `
uniform sampler2D map;
uniform vec3 keyColor;
uniform float similarity;
uniform float smoothness;
uniform float opacity;
varying vec2 vUv;

void main() {
  vec4 texColor = texture2D(map, vUv);
  float d = length(texColor.rgb - keyColor);
  float alpha = smoothstep(similarity, similarity + smoothness, d);
  gl_FragColor = vec4(texColor.rgb, texColor.a * alpha * opacity);
}
`;

export class Engine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  container: HTMLElement;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  objectsMap: Map<string, THREE.Object3D>;
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  vignettePass: ShaderPass;
  audioListener: THREE.AudioListener;
  gltfLoader: GLTFLoader;
  audioLoader: THREE.AudioLoader;
  rimLight: THREE.SpotLight;
  
  onSelect?: (id: string | null) => void;

  constructor(container: HTMLElement, onSelect?: (id: string | null) => void) {
    this.container = container;
    this.onSelect = onSelect;
    this.objectsMap = new Map();
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.gltfLoader = new GLTFLoader();
    this.audioLoader = new THREE.AudioLoader();

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#000000'); // Studio Black
    this.scene.fog = new THREE.FogExp2('#000000', 0.08);

    // Grid - Subtle dark grid
    const gridHelper = new THREE.GridHelper(30, 30, 0x222222, 0x111111);
    this.scene.add(gridHelper);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 0, 6);
    
    // Audio Listener
    this.audioListener = new THREE.AudioListener();
    this.camera.add(this.audioListener);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    this.bloomPass.enabled = false;
    this.composer.addPass(this.bloomPass);

    this.vignettePass = new ShaderPass(VignetteShader);
    this.vignettePass.uniforms['offset'].value = 1.0;
    this.vignettePass.uniforms['darkness'].value = 1.0;
    this.vignettePass.enabled = false;
    this.composer.addPass(this.vignettePass);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 10, 7);
    this.scene.add(mainLight);
    
    this.rimLight = new THREE.SpotLight(0x5B50FF, 5);
    this.rimLight.position.set(-5, 0, -5);
    this.rimLight.lookAt(0,0,0);
    this.scene.add(this.rimLight);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Events
    window.addEventListener('resize', this.onResize.bind(this));
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));
    
    this.animate();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  onPointerDown(event: PointerEvent) {
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(Array.from(this.objectsMap.values()), true); // Recursive for GLB/Groups

    if (intersects.length > 0) {
      // Find the top-level parent that exists in objectsMap
      let selected = intersects[0].object;
      let foundId: string | null = null;
      
      while(selected) {
         // Check if this specific object is in our map
         for (const [id, obj] of this.objectsMap.entries()) {
             if (obj === selected) {
                 foundId = id;
                 break;
             }
         }
         if (foundId) break;
         if (selected.parent) selected = selected.parent;
         else break;
      }

      if (this.onSelect && foundId) this.onSelect(foundId);
      else if (this.onSelect) this.onSelect(null);
    } else {
       if (this.onSelect) this.onSelect(null);
    }
  }

  createMesh(objData: SceneObject): THREE.Object3D {
    let mesh: THREE.Object3D;
    
    if (objData.type === 'mesh') {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshPhysicalMaterial({ 
        color: objData.color || '#ffffff',
        metalness: objData.metalness ?? 0.2,
        roughness: objData.roughness ?? 0.1,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: objData.opacity ?? 1.0,
      });
      mesh = new THREE.Mesh(geometry, material);
    } else if (objData.type === 'plane' || objData.type === 'video') {
       let planeWidth = 1.6;
       let planeHeight = 0.9;
       if (objData.width && objData.height && objData.width > 0 && objData.height > 0) {
           const aspectRatio = objData.width / objData.height;
           if (aspectRatio > 1) { // Landscape or square
               planeWidth = 1.6;
               planeHeight = 1.6 / aspectRatio;
           } else { // Portrait
               planeHeight = 1.6;
               planeWidth = 1.6 * aspectRatio;
           }
       }
       const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
       let material;
       
       if (objData.url) {
           let texture;
           if (objData.type === 'video') {
               const video = document.createElement('video');
               video.src = objData.url; video.loop = true; video.muted = true; video.crossOrigin = 'anonymous'; video.play();
               texture = new THREE.VideoTexture(video);
           } else {
               texture = new THREE.TextureLoader().load(objData.url);
           }
           texture.colorSpace = THREE.SRGBColorSpace;

           if (objData.chromaKey?.enabled) {
               material = new THREE.ShaderMaterial({
                   uniforms: {
                       map: { value: texture },
                       keyColor: { value: new THREE.Color(objData.chromaKey.color) },
                       similarity: { value: objData.chromaKey.similarity },
                       smoothness: { value: objData.chromaKey.smoothness },
                       opacity: { value: objData.opacity ?? 1.0 }
                   },
                   vertexShader: chromaKeyVertexShader,
                   fragmentShader: chromaKeyFragmentShader,
                   transparent: true,
                   side: THREE.DoubleSide
               });
           } else {
                material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, opacity: objData.opacity ?? 1.0 });
           }
       } else {
           material = new THREE.MeshBasicMaterial({ color: '#333', side: THREE.DoubleSide, transparent: true, opacity: objData.opacity ?? 1.0 });
       }
       mesh = new THREE.Mesh(geometry, material);
    } else if (objData.type === 'glb') {
        mesh = new THREE.Group();
        // Placeholder box while loading
        const placeholder = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ wireframe: true, color: '#555' }));
        mesh.add(placeholder);

        if (objData.url) {
            this.gltfLoader.load(objData.url, (gltf) => {
                mesh.remove(placeholder);
                mesh.add(gltf.scene);
                // Center and Scale
                const box = new THREE.Box3().setFromObject(gltf.scene);
                const center = box.getCenter(new THREE.Vector3());
                gltf.scene.position.sub(center);
            });
        }
    } else if (objData.type === 'audio') {
        mesh = new THREE.Group();
        // Helper Icon for Audio
        const iconGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const iconMat = new THREE.MeshBasicMaterial({ color: '#00ff00', wireframe: true });
        const helper = new THREE.Mesh(iconGeo, iconMat);
        mesh.add(helper);

        if (objData.url) {
            const sound = new THREE.PositionalAudio(this.audioListener);
            this.audioLoader.load(objData.url, (buffer) => {
                sound.setBuffer(buffer);
                sound.setRefDistance(2);
                sound.setLoop(true);
                sound.setVolume(objData.volume ?? 1);
                // sound.play(); // Auto-play logic handled in setTime ideally, but restricted by browser policy usually.
            });
            mesh.add(sound);
        }
    } else if (objData.type === 'camera') {
        mesh = new THREE.Group() as any;
    } else {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshBasicMaterial({ color: 'red' }));
    }
    
    return mesh;
  }

  setTime(time: number, objects: SceneObject[]) {
    if (!this.scene) return;
    
    objects.forEach(objData => {
      const obj3d = this.objectsMap.get(objData.id);
      if (!obj3d) return;

      const isVisible = time >= objData.startTime && time <= objData.startTime + objData.duration;
      obj3d.visible = isVisible;
      
      // Handle Audio Playback State (Simple version)
      if (objData.type === 'audio') {
          const sound = obj3d.children.find(c => c instanceof THREE.PositionalAudio) as THREE.PositionalAudio;
          if (sound && sound.buffer) {
             if (isVisible && !sound.isPlaying) {
                 // Calculate offset
                 const offset = (time - objData.startTime) % sound.buffer.duration;
                 sound.offset = offset;
                 try { sound.play(); } catch(e) {}
             } else if (!isVisible && sound.isPlaying) {
                 sound.stop();
             }
             if (sound.isPlaying) {
                 sound.setVolume(objData.volume ?? 1);
             }
          }
      }

      if (!isVisible) return;

      const localTime = time - objData.startTime;

      // 1. Reset transforms to base state
      obj3d.position.fromArray(objData.position);
      obj3d.rotation.fromArray(objData.rotation.map(d => THREE.MathUtils.degToRad(d)));
      obj3d.scale.fromArray(objData.scale);
      
      let mat: any = null;
      if (obj3d instanceof THREE.Mesh) mat = obj3d.material;
      
      if (mat) {
          if (mat instanceof THREE.MeshPhysicalMaterial) {
            mat.metalness = objData.metalness ?? 0.2;
            mat.roughness = objData.roughness ?? 0.1;
          }
          if (mat.opacity !== undefined) {
             mat.opacity = objData.opacity ?? 1.0;
          }
          if (mat.uniforms?.opacity) {
             mat.uniforms.opacity.value = objData.opacity ?? 1.0;
          }
      }
      
      // 2. Apply keyframe animations
      if (objData.animations && objData.animations.length > 0) {
        const keyframes = [...objData.animations];
        const baseState: TimelineKeyframe['values'] = {
            position: objData.position, rotation: objData.rotation, scale: objData.scale,
            metalness: objData.metalness, roughness: objData.roughness, opacity: objData.opacity, volume: objData.volume,
        };
        const baseKeyframe: TimelineKeyframe = { time: 0, values: {}, easing: keyframes[0].easing };
        
        let kf1: TimelineKeyframe = baseKeyframe;
        let kf2: TimelineKeyframe | null = null;
        for (const kf of keyframes) {
            if (kf.time <= localTime) kf1 = kf;
            else { kf2 = kf; break; }
        }
        if (!kf2) kf2 = kf1;

        const duration = kf2.time - kf1.time;
        const progress = duration > 0 ? (localTime - kf1.time) / duration : 1;
        const ease = gsap.parseEase(kf1.easing || 'power2.out');
        const easedProgress = ease(progress);

        const kf1Values = { ...baseState, ...kf1.values };
        const kf2Values = { ...baseState, ...kf2.values };

        const interpolatedValues: TimelineKeyframe['values'] = {};

        for (const key in kf1Values) {
            const prop = key as keyof TimelineKeyframe['values'];
            const startVal = kf1Values[prop];
            const endVal = kf2Values[prop];
            if (startVal !== undefined && endVal !== undefined) {
                 (interpolatedValues as any)[prop] = gsap.utils.interpolate(startVal, endVal, easedProgress);
            }
        }

        if (interpolatedValues.position) obj3d.position.fromArray(interpolatedValues.position);
        if (interpolatedValues.rotation) obj3d.rotation.fromArray(interpolatedValues.rotation.map(v => THREE.MathUtils.degToRad(v)));
        if (interpolatedValues.scale) obj3d.scale.fromArray(interpolatedValues.scale);
        
        if (mat) {
            if (interpolatedValues.metalness !== undefined && mat.metalness !== undefined) mat.metalness = interpolatedValues.metalness;
            if (interpolatedValues.roughness !== undefined && mat.roughness !== undefined) mat.roughness = interpolatedValues.roughness;
            const opacity = interpolatedValues.opacity ?? 1.0;
            if (mat.opacity !== undefined) mat.opacity = opacity;
            if (mat.uniforms?.opacity) mat.uniforms.opacity.value = opacity;
        }

        if (objData.type === 'audio') {
            const sound = obj3d.children.find(c => c instanceof THREE.PositionalAudio) as THREE.PositionalAudio;
            if (sound && interpolatedValues.volume !== undefined) sound.setVolume(interpolatedValues.volume);
        }
      }

      // 3. Apply Intro/Outro transitions
      const intro = objData.introTransition;
      if (intro && intro.type === 'custom') {
        const introTime = localTime - intro.delay;
        if (introTime >= 0 && introTime < intro.duration) {
            const progress = introTime / intro.duration;
            const eased = gsap.parseEase(intro.easing)(progress);
            const invEased = 1 - eased;
            
            if (intro.fade && mat) {
                if (mat.opacity !== undefined) mat.opacity *= eased;
                if (mat.uniforms?.opacity) mat.uniforms.opacity.value *= eased;
            }
            obj3d.scale.multiplyScalar(invEased * intro.scale + eased * 1);
            obj3d.position.add(new THREE.Vector3().fromArray(intro.position).multiplyScalar(invEased));
            obj3d.rotation.x += THREE.MathUtils.degToRad(intro.rotation[0]) * invEased;
            obj3d.rotation.y += THREE.MathUtils.degToRad(intro.rotation[1]) * invEased;
            obj3d.rotation.z += THREE.MathUtils.degToRad(intro.rotation[2]) * invEased;
        }
      }

      const outro = objData.outroTransition;
      if (outro && outro.type === 'custom') {
          const timeIntoOutro = localTime - (objData.duration - outro.duration - outro.delay);
          if (timeIntoOutro >= 0 && timeIntoOutro < outro.duration) {
              const progress = timeIntoOutro / outro.duration;
              const eased = gsap.parseEase(outro.easing)(progress);
              const invEased = 1- eased;

              if (outro.fade && mat) {
                if (mat.opacity !== undefined) mat.opacity *= invEased;
                if (mat.uniforms?.opacity) mat.uniforms.opacity.value *= invEased;
              }
              obj3d.scale.multiplyScalar(eased * outro.scale + invEased * 1);
              obj3d.position.add(new THREE.Vector3().fromArray(outro.position).multiplyScalar(eased));
              obj3d.rotation.x += THREE.MathUtils.degToRad(outro.rotation[0]) * eased;
              obj3d.rotation.y += THREE.MathUtils.degToRad(outro.rotation[1]) * eased;
              obj3d.rotation.z += THREE.MathUtils.degToRad(outro.rotation[2]) * eased;
          }
      }

      // Camera Override Logic
      if (objData.type === 'camera') {
        this.camera.position.copy(obj3d.position);
        this.camera.rotation.copy(obj3d.rotation);
        if (objData.fov && this.camera.fov !== objData.fov) {
             this.camera.fov = objData.fov;
             this.camera.updateProjectionMatrix();
        }
        const lookAtPoint = new THREE.Vector3(0, 0, -1);
        lookAtPoint.applyQuaternion(this.camera.quaternion);
        lookAtPoint.add(this.camera.position);
        this.controls.target.copy(lookAtPoint);
      }
    });
  }

  sync(objects: SceneObject[]) {
    const unseen = new Set(this.objectsMap.keys());

    objects.forEach(objData => {
        let obj3d = this.objectsMap.get(objData.id);

        if (!obj3d) {
            obj3d = this.createMesh(objData);
            if (objData.type !== 'camera') {
                this.scene.add(obj3d);
            }
            this.objectsMap.set(objData.id, obj3d);
        }

        unseen.delete(objData.id);

        // Update basic material props that don't need frame-by-frame update
        if (obj3d instanceof THREE.Mesh && obj3d.material instanceof THREE.MeshPhysicalMaterial) {
            obj3d.material.color.set(objData.color || '#ffffff');
        }
        
        if (obj3d instanceof THREE.Mesh && obj3d.material instanceof THREE.ShaderMaterial && objData.chromaKey) {
             obj3d.material.uniforms.keyColor.value.set(objData.chromaKey.color);
             obj3d.material.uniforms.similarity.value = objData.chromaKey.similarity;
             obj3d.material.uniforms.smoothness.value = objData.chromaKey.smoothness;
        }
    });

    unseen.forEach(id => {
        const obj = this.objectsMap.get(id);
        if (obj && obj.parent) { obj.parent.remove(obj); }
        this.objectsMap.delete(id);
    });
  }

  updatePostProcessing(settings: GlobalSettings) {
      this.scene.background = new THREE.Color(settings.backgroundColor);
      this.bloomPass.enabled = settings.bloom.enabled;
      this.bloomPass.strength = settings.bloom.strength;
      this.bloomPass.threshold = settings.bloom.threshold;
      this.bloomPass.radius = settings.bloom.radius;

      this.vignettePass.enabled = settings.vignette.enabled;
      this.vignettePass.uniforms['offset'].value = settings.vignette.offset;
      this.vignettePass.uniforms['darkness'].value = settings.vignette.darkness;
      
      this.rimLight.color.set(settings.accentColor);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.composer.render();
  }

  dispose() {
      this.renderer.dispose();
  }
}
