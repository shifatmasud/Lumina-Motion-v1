
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import gsap from 'gsap';

export interface TimelineKeyframe {
  time: number; // in seconds, relative to the clip's start
  easing?: string; // for GSAP
  values: Partial<Pick<SceneObject, 'position' | 'rotation' | 'scale' | 'metalness' | 'roughness' | 'volume' | 'opacity' | 'curvature' | 'transmission' | 'ior' | 'thickness' | 'clearcoat' | 'clearcoatRoughness'>>;
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
  name?: string;
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
  transmission?: number;
  ior?: number;
  thickness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  curvature?: number; // Cylinder wrap distortion
  volume?: number; // For audio
  fov?: number; // For camera
  loop?: boolean; // For video/audio
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
  showGrid: boolean;
}

const chromaKeyVertexShader = `
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
  float finalAlpha = texColor.a * opacity;
  if (chromaKeyEnabled) {
    float d = length(texColor.rgb - keyColor);
    float alpha = smoothstep(similarity, similarity + smoothness, d);
    finalAlpha *= alpha;
  }
  gl_FragColor = vec4(texColor.rgb, finalAlpha);
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
  mediaElements: Map<string, HTMLVideoElement>;
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  vignettePass: ShaderPass;
  audioListener: THREE.AudioListener;
  gltfLoader: GLTFLoader;
  audioLoader: THREE.AudioLoader;
  rimLight: THREE.SpotLight;
  gridHelper: THREE.GridHelper;
  isUserControllingCamera: boolean = false;
  pmremGenerator: THREE.PMREMGenerator;
  
  onSelect?: (id: string | null) => void;

  constructor(container: HTMLElement, onSelect?: (id: string | null) => void) {
    this.container = container;
    this.onSelect = onSelect;
    this.objectsMap = new Map();
    this.mediaElements = new Map();
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.gltfLoader = new GLTFLoader();
    this.audioLoader = new THREE.AudioLoader();

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#000000'); // Studio Black
    this.scene.fog = new THREE.FogExp2('#000000', 0.08);

    // Grid - Subtle dark grid
    this.gridHelper = new THREE.GridHelper(30, 30, 0x222222, 0x111111);
    this.scene.add(this.gridHelper);

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
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    // Environment for High Quality Materials
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();
    const environment = new RoomEnvironment();
    this.scene.environment = this.pmremGenerator.fromScene(environment).texture;
    // this.scene.background = new THREE.Color('#111'); // optional visual background
    environment.dispose();

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
    this.controls.enableZoom = true;
    this.controls.enableRotate = true;
    this.controls.addEventListener('start', () => { this.isUserControllingCamera = true; });

    // Events
    window.addEventListener('resize', this.onResize.bind(this));
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));
    
    this.animate();
  }
  
  resumeAudioContext() {
      if (this.audioListener.context.state === 'suspended') {
          this.audioListener.context.resume();
      }
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
    const intersects = this.raycaster.intersectObjects(Array.from(this.objectsMap.values()), true); 

    if (intersects.length > 0) {
      let selected = intersects[0].object;
      let foundId: string | null = null;
      
      while(selected) {
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

      if (this.onSelect) this.onSelect(foundId);
    } else {
       if (this.onSelect) this.onSelect(null);
    }
  }

  createMesh(objData: SceneObject): THREE.Object3D {
    let mesh: THREE.Object3D;
    
    if (objData.type === 'mesh') {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      // High Quality MeshPhysicalMaterial
      const material = new THREE.MeshPhysicalMaterial({ 
        color: objData.color || '#ffffff',
        metalness: objData.metalness ?? 0.2,
        roughness: objData.roughness ?? 0.1,
        transmission: objData.transmission ?? 0,
        ior: objData.ior ?? 1.5,
        thickness: objData.thickness ?? 0.5,
        clearcoat: objData.clearcoat ?? 0,
        clearcoatRoughness: objData.clearcoatRoughness ?? 0,
        // Opacity vs Transmission logic:
        // If transmission > 0, transparent usually must be false for index-of-refraction effects to look correct in Three.js,
        // unless we want alpha fading. We will prioritize alpha fading if opacity < 1.
        transparent: (objData.opacity ?? 1.0) < 1.0,
        opacity: objData.opacity ?? 1.0,
        envMapIntensity: 1.0, 
      });
      mesh = new THREE.Mesh(geometry, material);
    } else if (objData.type === 'plane' || objData.type === 'video') {
       let planeWidth = 1.6;
       let planeHeight = 0.9;
       if (objData.width && objData.height && objData.width > 0 && objData.height > 0) {
           const aspectRatio = objData.width / objData.height;
           if (aspectRatio > 1) { 
               planeWidth = 1.6;
               planeHeight = 1.6 / aspectRatio;
           } else { 
               planeHeight = 1.6;
               planeWidth = 1.6 * aspectRatio;
           }
       }
       const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 32, 1);
       let material;
       let videoElement: HTMLVideoElement | null = null;
       
       if (objData.url) {
           let texture;
           if (objData.type === 'video') {
               const video = document.createElement('video');
               video.src = objData.url;
               video.loop = objData.loop ?? true;
               video.crossOrigin = 'anonymous';
               video.playsInline = true;
               video.muted = false; 
               videoElement = video;
               this.mediaElements.set(objData.id, video);
               texture = new THREE.VideoTexture(video);
           } else {
               texture = new THREE.TextureLoader().load(objData.url);
           }
           texture.colorSpace = THREE.SRGBColorSpace;
           
           material = new THREE.ShaderMaterial({
               uniforms: {
                   map: { value: texture },
                   keyColor: { value: new THREE.Color(objData.chromaKey?.color || '#00ff00') },
                   similarity: { value: objData.chromaKey?.similarity || 0.1 },
                   smoothness: { value: objData.chromaKey?.smoothness || 0.1 },
                   opacity: { value: objData.opacity ?? 1.0 },
                   curvature: { value: objData.curvature ?? 0.0 },
                   chromaKeyEnabled: { value: objData.chromaKey?.enabled || false }
               },
               vertexShader: chromaKeyVertexShader,
               fragmentShader: chromaKeyFragmentShader,
               transparent: true,
               side: THREE.DoubleSide
           });
       } else {
           material = new THREE.MeshBasicMaterial({ color: '#333', side: THREE.DoubleSide, transparent: true, opacity: objData.opacity ?? 1.0 });
       }
       mesh = new THREE.Mesh(geometry, material);

       if (videoElement) {
           const sound = new THREE.Audio(this.audioListener);
           sound.setMediaElementSource(videoElement);
           mesh.add(sound);
       }
    } else if (objData.type === 'glb') {
        mesh = new THREE.Group();
        const placeholder = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ wireframe: true, color: '#555' }));
        mesh.add(placeholder);

        if (objData.url) {
            this.gltfLoader.load(objData.url, (gltf) => {
                mesh.remove(placeholder);
                mesh.add(gltf.scene);
                const box = new THREE.Box3().setFromObject(gltf.scene);
                const center = box.getCenter(new THREE.Vector3());
                gltf.scene.position.sub(center);

                // Initial material setup for GLB to ensure transparency works if opacity < 1
                gltf.scene.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                         child.castShadow = true;
                         child.receiveShadow = true;
                         if (child.material) {
                             const materials = Array.isArray(child.material) ? child.material : [child.material];
                             materials.forEach(m => {
                                 // Default to standard material properties if not physical
                                 m.envMapIntensity = 1.0;
                                 if (objData.opacity !== undefined && objData.opacity < 1.0) {
                                     m.transparent = true;
                                     m.opacity = objData.opacity;
                                 }
                             });
                         }
                    }
                });
            });
        }
    } else if (objData.type === 'audio') {
        mesh = new THREE.Group();
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

  setTime(time: number, objects: SceneObject[], isPlaying: boolean, timeHasChanged: boolean) {
    if (!this.scene) return;
    
    objects.forEach(objData => {
      const obj3d = this.objectsMap.get(objData.id);
      if (!obj3d) return;

      const isVisible = time >= objData.startTime && time <= objData.startTime + objData.duration;
      obj3d.visible = isVisible;
      
      const sound = obj3d.children.find(c => c instanceof THREE.Audio || c instanceof THREE.PositionalAudio) as THREE.Audio | THREE.PositionalAudio;

      if (objData.type === 'video') {
        const video = this.mediaElements.get(objData.id);
        if (video) {
            if (!isVisible) {
                if (!video.paused) video.pause();
            } else {
                const localTime = time - objData.startTime;
                if (isPlaying) { 
                    if (video.paused) {
                        if (Math.abs(video.currentTime - localTime) > 0.2) video.currentTime = localTime;
                        video.play().catch(e => console.warn("Video autoplay failed.", e));
                    }
                } else { 
                    if (!video.paused) video.pause();
                    if (Math.abs(video.currentTime - localTime) > 0.15) video.currentTime = localTime;
                }
            }
        }
      } 
      else if (objData.type === 'audio' && sound instanceof THREE.PositionalAudio) {
        if (sound.buffer) {
          if (isVisible && isPlaying && !sound.isPlaying) {
            const offset = (time - objData.startTime) % sound.buffer.duration;
            sound.offset = offset;
            sound.play();
          } else if ((!isVisible || !isPlaying) && sound.isPlaying) {
            sound.pause();
          }
        }
      }
      
      if (!isVisible) return;

      const localTime = time - objData.startTime;

      // Update Transform
      obj3d.position.fromArray(objData.position);
      obj3d.rotation.fromArray(objData.rotation.map(d => THREE.MathUtils.degToRad(d)));
      obj3d.scale.fromArray(objData.scale);
      
      // Calculate Interpolated Values
      let finalMetalness = objData.metalness ?? 0.2;
      let finalRoughness = objData.roughness ?? 0.1;
      let finalTransmission = objData.transmission ?? 0;
      let finalIor = objData.ior ?? 1.5;
      let finalThickness = objData.thickness ?? 0.5;
      let finalClearcoat = objData.clearcoat ?? 0;
      let finalClearcoatRoughness = objData.clearcoatRoughness ?? 0;
      let finalOpacity = objData.opacity ?? 1.0;
      let finalCurvature = objData.curvature ?? 0.0;
      let finalVolume = objData.volume ?? 1.0;

      // Animation Interpolation
      if (objData.animations && objData.animations.length > 0) {
        const keyframes = [...objData.animations];
        // Use current object state as defaults for keys not present
        const baseState: TimelineKeyframe['values'] = {
            position: objData.position, rotation: objData.rotation, scale: objData.scale,
            metalness: finalMetalness, roughness: finalRoughness, opacity: finalOpacity, volume: finalVolume,
            curvature: finalCurvature, transmission: finalTransmission, ior: finalIor, thickness: finalThickness,
            clearcoat: finalClearcoat, clearcoatRoughness: finalClearcoatRoughness,
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
        
        // Helper to interpolate scalars
        const lerp = (a: any, b: any) => gsap.utils.interpolate(a, b, easedProgress);

        if (kf1Values.position && kf2Values.position) obj3d.position.fromArray(lerp(kf1Values.position, kf2Values.position));
        if (kf1Values.rotation && kf2Values.rotation) obj3d.rotation.fromArray(lerp(kf1Values.rotation, kf2Values.rotation).map((v: number) => THREE.MathUtils.degToRad(v)));
        if (kf1Values.scale && kf2Values.scale) obj3d.scale.fromArray(lerp(kf1Values.scale, kf2Values.scale));

        if (kf1Values.metalness !== undefined && kf2Values.metalness !== undefined) finalMetalness = lerp(kf1Values.metalness, kf2Values.metalness);
        if (kf1Values.roughness !== undefined && kf2Values.roughness !== undefined) finalRoughness = lerp(kf1Values.roughness, kf2Values.roughness);
        if (kf1Values.transmission !== undefined && kf2Values.transmission !== undefined) finalTransmission = lerp(kf1Values.transmission, kf2Values.transmission);
        if (kf1Values.ior !== undefined && kf2Values.ior !== undefined) finalIor = lerp(kf1Values.ior, kf2Values.ior);
        if (kf1Values.thickness !== undefined && kf2Values.thickness !== undefined) finalThickness = lerp(kf1Values.thickness, kf2Values.thickness);
        if (kf1Values.clearcoat !== undefined && kf2Values.clearcoat !== undefined) finalClearcoat = lerp(kf1Values.clearcoat, kf2Values.clearcoat);
        if (kf1Values.clearcoatRoughness !== undefined && kf2Values.clearcoatRoughness !== undefined) finalClearcoatRoughness = lerp(kf1Values.clearcoatRoughness, kf2Values.clearcoatRoughness);
        if (kf1Values.opacity !== undefined && kf2Values.opacity !== undefined) finalOpacity = lerp(kf1Values.opacity, kf2Values.opacity);
        if (kf1Values.curvature !== undefined && kf2Values.curvature !== undefined) finalCurvature = lerp(kf1Values.curvature, kf2Values.curvature);
        if (kf1Values.volume !== undefined && kf2Values.volume !== undefined) finalVolume = lerp(kf1Values.volume, kf2Values.volume);
      }

      // Apply Materials
      const updateMaterial = (mat: THREE.Material) => {
           if (mat instanceof THREE.MeshPhysicalMaterial) {
                mat.metalness = finalMetalness;
                mat.roughness = finalRoughness;
                mat.transmission = finalTransmission;
                mat.ior = finalIor;
                mat.thickness = finalThickness;
                mat.clearcoat = finalClearcoat;
                mat.clearcoatRoughness = finalClearcoatRoughness;
           }
           if (mat instanceof THREE.ShaderMaterial && mat.uniforms.curvature) {
               mat.uniforms.curvature.value = finalCurvature;
           }
           
           // Universal Opacity
           mat.opacity = finalOpacity;
           mat.transparent = finalOpacity < 1.0 || (mat instanceof THREE.MeshPhysicalMaterial && finalTransmission > 0.01);
           if (mat instanceof THREE.ShaderMaterial && mat.uniforms.opacity) {
                mat.uniforms.opacity.value = finalOpacity;
           }
      };

      if (obj3d instanceof THREE.Mesh) {
          if (Array.isArray(obj3d.material)) obj3d.material.forEach(updateMaterial);
          else updateMaterial(obj3d.material);
      } else {
          obj3d.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                  if (Array.isArray(child.material)) child.material.forEach(updateMaterial);
                  else if (child.material) updateMaterial(child.material);
              }
          });
      }

      // Apply Volume
      if ((objData.type === 'audio' || objData.type === 'video') && sound) {
          if (sound.getVolume() !== finalVolume) sound.setVolume(finalVolume);
      }

      // Apply Transitions (Intro/Outro)
      const intro = objData.introTransition;
      if (intro && intro.type === 'custom') {
        const introTime = localTime - intro.delay;
        if (introTime >= 0 && introTime < intro.duration) {
            const progress = introTime / intro.duration;
            const eased = gsap.parseEase(intro.easing)(progress);
            const invEased = 1 - eased;
            
            if (intro.fade) {
                // Approximate fading by multiplying existing opacity
                const fadeOpacity = finalOpacity * eased;
                if (obj3d instanceof THREE.Mesh && !Array.isArray(obj3d.material)) {
                     obj3d.material.opacity = fadeOpacity;
                     if(obj3d.material instanceof THREE.ShaderMaterial) obj3d.material.uniforms.opacity.value = fadeOpacity;
                }
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

              if (outro.fade) {
                 const fadeOpacity = finalOpacity * invEased;
                 if (obj3d instanceof THREE.Mesh && !Array.isArray(obj3d.material)) {
                     obj3d.material.opacity = fadeOpacity;
                     if(obj3d.material instanceof THREE.ShaderMaterial) obj3d.material.uniforms.opacity.value = fadeOpacity;
                 }
              }
              obj3d.scale.multiplyScalar(eased * outro.scale + invEased * 1);
              obj3d.position.add(new THREE.Vector3().fromArray(outro.position).multiplyScalar(eased));
              obj3d.rotation.x += THREE.MathUtils.degToRad(outro.rotation[0]) * eased;
              obj3d.rotation.y += THREE.MathUtils.degToRad(outro.rotation[1]) * eased;
              obj3d.rotation.z += THREE.MathUtils.degToRad(outro.rotation[2]) * eased;
          }
      }

      // Update Camera
      if (objData.type === 'camera') {
        if (!this.isUserControllingCamera || timeHasChanged) {
            if (timeHasChanged) this.isUserControllingCamera = false;
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

        if (obj3d instanceof THREE.Mesh && obj3d.material instanceof THREE.MeshPhysicalMaterial) {
            obj3d.material.color.set(objData.color || '#ffffff');
        }

        if (objData.type === 'video') {
            const video = this.mediaElements.get(objData.id);
            if (video && video.loop !== (objData.loop ?? true)) {
                video.loop = objData.loop ?? true;
            }
        }
        
        if (obj3d instanceof THREE.Mesh && obj3d.material instanceof THREE.ShaderMaterial && (objData.type === 'plane' || objData.type === 'video')) {
            const chromaKey = objData.chromaKey;
            const uniforms = obj3d.material.uniforms;

            uniforms.chromaKeyEnabled.value = chromaKey?.enabled || false;
            if (chromaKey) {
                uniforms.keyColor.value.set(chromaKey.color);
                uniforms.similarity.value = chromaKey.similarity;
                uniforms.smoothness.value = chromaKey.smoothness;
            }
        }
    });

    unseen.forEach(id => {
        const obj = this.objectsMap.get(id);
        if (obj && obj.parent) { obj.parent.remove(obj); }
        this.objectsMap.delete(id);

        if (this.mediaElements.has(id)) {
            const video = this.mediaElements.get(id);
            if(video) {
                video.pause();
                video.removeAttribute('src');
                video.load();
            }
            this.mediaElements.delete(id);
        }
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
      this.gridHelper.visible = settings.showGrid;
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.composer.render();
  }

  dispose() {
      this.renderer.dispose();
      this.pmremGenerator.dispose();
  }
}
