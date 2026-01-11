import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import gsap from 'gsap';

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
  type: 'mesh' | 'plane' | 'video' | 'glb' | 'audio' | 'camera' | 'svg' | 'light';
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
  svgLoader: SVGLoader;
  audioLoader: THREE.AudioLoader;
  ambientLight: THREE.AmbientLight;
  gridHelper: THREE.GridHelper;
  isUserControllingCamera: boolean = false;
  
  onSelect?: (id: string | null) => void;

  constructor(container: HTMLElement, onSelect?: (id: string | null) => void) {
    this.container = container;
    this.onSelect = onSelect;
    this.objectsMap = new Map();
    this.mediaElements = new Map();
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.gltfLoader = new GLTFLoader();
    this.svgLoader = new SVGLoader();
    this.audioLoader = new THREE.AudioLoader();

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#000000'); // Studio Black
    this.scene.fog = new THREE.FogExp2('#000000', 0.08);

    // Grid - Subtle dark grid
    this.gridHelper = new THREE.GridHelper(30, 30, 0x222222, 0x111111);
    this.scene.add(this.gridHelper);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 0, 6);
    
    // Audio Listener
    this.audioListener = new THREE.AudioListener();
    // Fix: Provide required sampleRate argument to AudioContext constructor
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    (this.audioListener as any).context = new AudioContextClass({ sampleRate: 24000 });
    this.camera.add(this.audioListener);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; // CRITICAL for PBR
    this.renderer.shadowMap.enabled = true; // Enable shadows
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 1.5, 0.4, 0.85);
    this.bloomPass.enabled = false;
    this.composer.addPass(this.bloomPass);

    this.vignettePass = new ShaderPass(VignetteShader);
    this.vignettePass.uniforms['offset'].value = 1.0;
    this.vignettePass.uniforms['darkness'].value = 1.0;
    this.vignettePass.enabled = false;
    this.composer.addPass(this.vignettePass);

    // Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

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
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  onPointerDown(event: PointerEvent) {
    this.pointer.x = (event.clientX / this.container.clientWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / this.container.clientHeight) * 2 + 1;

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

  updateSVGGeometry(mesh: THREE.Group, objData: SceneObject) {
    const { svgPaths } = mesh.userData;
    if (!svgPaths) return;

    // 1. Clean up old geometry
    mesh.traverse((child: any) => {
        if (child.isMesh) {
            child.geometry?.dispose();
            if(Array.isArray(child.material)) {
                child.material.forEach((m: THREE.Material) => m.dispose());
            } else {
                child.material?.dispose();
            }
        }
    });
    mesh.clear();

    // 2. Prepare for new geometry
    const material = new THREE.MeshPhysicalMaterial({
        color: objData.color || '#ffffff',
        metalness: objData.metalness ?? 0.1,
        roughness: objData.roughness ?? 0.4,
        transmission: objData.transmission ?? 0,
        ior: objData.ior ?? 1.5,
        thickness: objData.thickness ?? 0.5,
        clearcoat: objData.clearcoat ?? 0,
        clearcoatRoughness: objData.clearcoatRoughness ?? 0,
        transparent: (objData.opacity ?? 1.0) < 1.0 || (objData.transmission ?? 0) > 0,
        opacity: objData.opacity ?? 1.0,
        envMapIntensity: 1.0,
        side: THREE.DoubleSide,
        wireframe: !!objData.wireframe
    });

    const extrudeSettings = {
        depth: objData.extrusion ?? 0.1,
        bevelEnabled: false,
        curveSegments: 32 // Increase for smoother curves
    };
    
    const pathLength = objData.pathLength ?? 1.0;
    const group = new THREE.Group();

    for (const path of svgPaths) {
        const shapes = SVGLoader.createShapes(path);

        for (const shape of shapes) {
            let shapeToExtrude = shape;

            if (pathLength < 1.0) {
                const points = shape.getPoints(50); // Use a fixed resolution for consistency
                if (points.length < 2) continue;

                const numPointsToShow = Math.floor(points.length * pathLength);

                if (numPointsToShow < 2) continue; // Don't render a single point or nothing

                const trimmedPoints = points.slice(0, numPointsToShow);
                
                // Create a "pie slice" wipe effect from the shape's center
                const boundingBox = new THREE.Box2().setFromPoints(points);
                const center = new THREE.Vector2();
                boundingBox.getCenter(center);
                
                const finalPoints = [center, ...trimmedPoints];
                shapeToExtrude = new THREE.Shape(finalPoints);
            }
            
            const geometry = new THREE.ExtrudeGeometry(shapeToExtrude, extrudeSettings);
            const svgMesh = new THREE.Mesh(geometry, material);
            svgMesh.castShadow = true;
            svgMesh.receiveShadow = true;
            group.add(svgMesh);
        }
    }
    
    // 3. Normalize and center the entire group
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = 1.0 / Math.max(size.x, size.y, size.z);
    if (isFinite(scale)) { // Avoid issues with empty geometry
        group.scale.setScalar(scale);
        const center = new THREE.Vector3();
        box.getCenter(center);
        group.position.sub(center.multiplyScalar(scale));
    }

    mesh.add(group);
  }

  createMesh(objData: SceneObject): THREE.Object3D {
    let mesh: THREE.Object3D;
    
    if (objData.type === 'mesh') {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshPhysicalMaterial({ 
            color: objData.color || '#ffffff',
            metalness: objData.metalness ?? 0.2,
            roughness: objData.roughness ?? 0.1,
            transmission: objData.transmission ?? 0,
            ior: objData.ior ?? 1.5,
            thickness: objData.thickness ?? 0.5,
            clearcoat: objData.clearcoat ?? 0,
            clearcoatRoughness: objData.clearcoatRoughness ?? 0,
            transparent: (objData.opacity ?? 1.0) < 1.0,
            opacity: objData.opacity ?? 1.0,
            envMapIntensity: 1.0, 
            side: THREE.DoubleSide,
            wireframe: !!objData.wireframe
        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    } else if (objData.type === 'svg') {
        mesh = new THREE.Group();
        if (objData.url) {
            this.svgLoader.load(objData.url, (data) => {
                mesh.userData.svgPaths = data.paths;
                mesh.userData.currentExtrusion = objData.extrusion ?? 0.1;
                mesh.userData.currentPathLength = objData.pathLength ?? 1.0;
                this.updateSVGGeometry(mesh as THREE.Group, objData);
            });
        }
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
       let material: THREE.Material;
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
           
           const useShader = objData.type === 'video' || (objData.chromaKey?.enabled) || (objData.curvature && Math.abs(objData.curvature) > 0.001);

           if (useShader) {
               material = new THREE.ShaderMaterial({
                   uniforms: {
                       map: { value: texture },
                       keyColor: { value: new THREE.Color(objData.chromaKey?.color || '#00ff00') },
                       similarity: { value: objData.chromaKey?.similarity || 0.1 },
                       smoothness: { value: objData.chromaKey?.smoothness || 0.1 },
                       opacity: { value: objData.opacity ?? 1.0 },
                       curvature: { value: objData.curvature ?? 0.0 },
                       chromaKeyEnabled: { value: objData.chromaKey?.enabled || false },
                   },
                   vertexShader: chromaKeyVertexShader,
                   fragmentShader: chromaKeyFragmentShader,
                   transparent: true,
                   side: THREE.DoubleSide,
                   wireframe: !!objData.wireframe
               });
           } else {
               material = new THREE.MeshBasicMaterial({
                   map: texture,
                   transparent: true,
                   opacity: objData.opacity ?? 1.0,
                   side: THREE.DoubleSide,
                   wireframe: !!objData.wireframe
               });
           }
       } else {
           material = new THREE.MeshBasicMaterial({ color: '#333', side: THREE.DoubleSide, transparent: true, opacity: objData.opacity ?? 1.0, wireframe: !!objData.wireframe });
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

                gltf.scene.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                         child.castShadow = true;
                         child.receiveShadow = true;
                         if (child.material) {
                             const materials = Array.isArray(child.material) ? child.material : [child.material];
                             materials.forEach(m => {
                                 m.envMapIntensity = 1.0;
                                 if (objData.opacity !== undefined && objData.opacity < 1.0) {
                                     m.transparent = true;
                                     m.opacity = objData.opacity;
                                 }
                                 if ('wireframe' in m) {
                                     m.wireframe = !!objData.wireframe;
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
    } else if (objData.type === 'light') {
        const lightGroup = new THREE.Group();
        let light: THREE.Light;
        let helper: THREE.Object3D | undefined;
  
        if (objData.lightType === 'directional') {
            const dirLight = new THREE.DirectionalLight(objData.color, objData.intensity);
            dirLight.castShadow = true;
            dirLight.shadow.mapSize.width = 2048; 
            dirLight.shadow.mapSize.height = 2048;
            dirLight.shadow.camera.top = 10;
            dirLight.shadow.camera.bottom = -10;
            dirLight.shadow.camera.left = -10;
            dirLight.shadow.camera.right = 10;
            dirLight.shadow.camera.near = 0.5;
            dirLight.shadow.camera.far = 50;
            dirLight.shadow.bias = -0.0005; 
            dirLight.shadow.blurSamples = 16;
            light = dirLight;
            helper = new THREE.DirectionalLightHelper(dirLight, 1);
        } else { // 'spot'
            const spotLight = new THREE.SpotLight(objData.color, objData.intensity);
            spotLight.angle = Math.PI / 4;
            spotLight.penumbra = 1;
            spotLight.decay = 2;
            spotLight.distance = 20;
            spotLight.castShadow = false;
            light = spotLight;
            helper = new THREE.SpotLightHelper(spotLight);
        }
        
        lightGroup.add(light);
        if (helper) {
            helper.visible = false;
            lightGroup.userData.helper = helper;
            this.scene.add(helper);
        }
  
        const geo = new THREE.SphereGeometry(0.1);
        const mat = new THREE.MeshBasicMaterial({ color: objData.color, transparent: true, opacity: 0.5 });
        const raycastTarget = new THREE.Mesh(geo, mat);
        raycastTarget.name = 'light_handle';
        raycastTarget.visible = false;
        lightGroup.add(raycastTarget);
  
        mesh = lightGroup;
    } else {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshBasicMaterial({ color: 'red' }));
    }
    
    return mesh;
  }

  setTime(time: number, objects: SceneObject[], isPlaying: boolean, timeHasChanged: boolean, mode?: 'departure' | 'arrival') {
    if (!this.scene) return;
    
    objects.forEach(objData => {
      const obj3d = this.objectsMap.get(objData.id);
      if (!obj3d) return;

      const isVisible = time >= objData.startTime && time <= objData.startTime + objData.duration;
      obj3d.visible = isVisible && objData.visible !== false;
      
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
      
      if (!obj3d.visible) return;

      const localTime = time - objData.startTime;

      // Update Transform
      obj3d.position.fromArray(objData.position);
      obj3d.rotation.fromArray(objData.rotation.map(d => THREE.MathUtils.degToRad(d)) as [number, number, number]);
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
      let finalExtrusion = objData.extrusion ?? 0.1;
      let finalPathLength = objData.pathLength ?? 1.0;
      let finalColor = objData.color;
      let finalIntensity = objData.intensity;

      // Animation Interpolation
      if (objData.animations && objData.animations.length > 0) {
        const keyframes = [...objData.animations];
        // Use current object state as defaults for keys not present
        const baseState: TimelineKeyframe['values'] = {
            position: objData.position, rotation: objData.rotation, scale: objData.scale,
            metalness: finalMetalness, roughness: finalRoughness, opacity: finalOpacity, volume: finalVolume,
            curvature: finalCurvature, transmission: finalTransmission, ior: finalIor, thickness: finalThickness,
            clearcoat: finalClearcoat, clearcoatRoughness: finalClearcoatRoughness, extrusion: finalExtrusion, pathLength: finalPathLength,
            color: finalColor, intensity: finalIntensity,
        };
        const baseKeyframe: TimelineKeyframe = { time: 0, values: {}, easing: 'none' };
        
        let departureKf: TimelineKeyframe = baseKeyframe;
        let arrivalKf: TimelineKeyframe | null = null;
        for (const kf of keyframes) {
            if (kf.time <= localTime) departureKf = kf;
            else { arrivalKf = kf; break; }
        }
        if (!arrivalKf) arrivalKf = departureKf;

        const duration = arrivalKf.time - departureKf.time;
        const progress = duration > 0 ? (localTime - departureKf.time) / duration : 1;
        
        const ease = gsap.parseEase(arrivalKf.easing || 'none');
        const easedProgress = ease(progress);

        const departureValues = { ...baseState, ...departureKf.values };
        const arrivalValues = { ...baseState, ...arrivalKf.values };
        
        // Helper to interpolate scalars
        const lerp = (a: any, b: any) => gsap.utils.interpolate(a, b, easedProgress);

        if (departureValues.position && arrivalValues.position) obj3d.position.fromArray(lerp(departureValues.position, arrivalValues.position));
        if (departureValues.rotation && arrivalValues.rotation) obj3d.rotation.fromArray(lerp(departureValues.rotation, arrivalValues.rotation).map((v: number) => THREE.MathUtils.degToRad(v)) as [number, number, number]);
        if (departureValues.scale && arrivalValues.scale) obj3d.scale.fromArray(lerp(departureValues.scale, arrivalValues.scale));

        if (departureValues.metalness !== undefined && arrivalValues.metalness !== undefined) finalMetalness = lerp(departureValues.metalness, arrivalValues.metalness);
        if (departureValues.roughness !== undefined && arrivalValues.roughness !== undefined) finalRoughness = lerp(departureValues.roughness, arrivalValues.roughness);
        if (departureValues.transmission !== undefined && arrivalValues.transmission !== undefined) finalTransmission = lerp(departureValues.transmission, arrivalValues.transmission);
        if (departureValues.ior !== undefined && arrivalValues.ior !== undefined) finalIor = lerp(departureValues.ior, arrivalValues.ior);
        if (departureValues.thickness !== undefined && arrivalValues.thickness !== undefined) finalThickness = lerp(departureValues.thickness, arrivalValues.thickness);
        if (departureValues.clearcoat !== undefined && arrivalValues.clearcoat !== undefined) finalClearcoat = lerp(departureValues.clearcoat, arrivalValues.clearcoat);
        if (departureValues.clearcoatRoughness !== undefined && arrivalValues.clearcoatRoughness !== undefined) finalClearcoatRoughness = lerp(departureValues.clearcoatRoughness, arrivalValues.clearcoatRoughness);
        if (departureValues.opacity !== undefined && arrivalValues.opacity !== undefined) finalOpacity = lerp(departureValues.opacity, arrivalValues.opacity);
        if (departureValues.curvature !== undefined && arrivalValues.curvature !== undefined) finalCurvature = lerp(departureValues.curvature, arrivalValues.curvature);
        if (departureValues.volume !== undefined && arrivalValues.volume !== undefined) finalVolume = lerp(departureValues.volume, arrivalValues.volume);
        if (departureValues.extrusion !== undefined && arrivalValues.extrusion !== undefined) finalExtrusion = lerp(departureValues.extrusion, arrivalValues.extrusion);
        if (departureValues.pathLength !== undefined && arrivalValues.pathLength !== undefined) finalPathLength = lerp(departureValues.pathLength, arrivalValues.pathLength);
        if (departureValues.color !== undefined && arrivalValues.color !== undefined) finalColor = lerp(departureValues.color, arrivalValues.color);
        if (departureValues.intensity !== undefined && arrivalValues.intensity !== undefined) finalIntensity = lerp(departureValues.intensity, arrivalValues.intensity);
      }

      // Geometry Update for SVG (if needed)
      if (objData.type === 'svg' && obj3d.userData.svgPaths) {
        const needsUpdate = obj3d.userData.currentExtrusion !== finalExtrusion || obj3d.userData.currentPathLength !== finalPathLength;
        if(needsUpdate) {
          this.updateSVGGeometry(obj3d as THREE.Group, { ...objData, extrusion: finalExtrusion, pathLength: finalPathLength });
          obj3d.userData.currentExtrusion = finalExtrusion;
          obj3d.userData.currentPathLength = finalPathLength;
        }
      }

      // Apply Materials
      const updateMaterial = (mat: THREE.Material) => {
           if (mat instanceof THREE.MeshPhysicalMaterial || mat instanceof THREE.MeshStandardMaterial) {
                mat.metalness = finalMetalness;
                mat.roughness = finalRoughness;
           }
           if (mat instanceof THREE.MeshPhysicalMaterial) {
                mat.transmission = finalTransmission;
                mat.ior = finalIor;
                mat.thickness = finalThickness;
                mat.clearcoat = finalClearcoat;
                mat.clearcoatRoughness = finalClearcoatRoughness;
           }
           if (mat instanceof THREE.ShaderMaterial) {
               if (mat.uniforms.curvature) mat.uniforms.curvature.value = finalCurvature;
           }
           
           // Universal Opacity
           mat.opacity = finalOpacity;
           mat.transparent = finalOpacity < 1.0 || (mat instanceof THREE.MeshPhysicalMaterial && finalTransmission > 0.01);
           if (mat instanceof THREE.ShaderMaterial && mat.uniforms.opacity) {
                mat.uniforms.opacity.value = finalOpacity;
           }
      };

      if (objData.type === 'light') {
        const light = obj3d.children.find(c => c instanceof THREE.Light) as THREE.Light & { intensity: number; color: THREE.Color };
        if (light) {
            if (finalColor) light.color.set(finalColor);
            if (finalIntensity !== undefined) light.intensity = finalIntensity;
        }
        if (obj3d.userData.helper) {
            obj3d.userData.helper.update();
        }
      } else if (obj3d instanceof THREE.Mesh) {
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
        
        obj3d.traverse(child => {
            if (child instanceof THREE.Mesh) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    if ('wireframe' in mat) {
                        mat.wireframe = !!objData.wireframe;
                    }
                    if (mat instanceof THREE.MeshPhysicalMaterial) {
                        mat.color.set(objData.color || '#ffffff');
                    }
                });
            }
        });

        if (objData.type === 'light') {
            const light = obj3d.children.find(c => c instanceof THREE.Light) as THREE.Light & { color: THREE.Color };
            const raycastTarget = obj3d.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh;
            if (light && objData.color) {
                light.color.set(objData.color);
            }
            if (raycastTarget && raycastTarget.material instanceof THREE.MeshBasicMaterial) {
                if (objData.color) raycastTarget.material.color.set(objData.color);
            }
        }
        
        if (objData.type === 'video') {
            const mediaObject = this.mediaElements.get(objData.id);
            if (mediaObject && mediaObject.loop !== (objData.loop ?? true)) {
                mediaObject.loop = objData.loop ?? true;
            }
        }
        
        if (obj3d instanceof THREE.Mesh && obj3d.material instanceof THREE.ShaderMaterial && (objData.type === 'plane' || objData.type === 'video')) {
            const material = obj3d.material;
            const chromaKey = objData.chromaKey;
            
            material.uniforms.chromaKeyEnabled.value = chromaKey?.enabled || false;
            if (chromaKey) {
                material.uniforms.keyColor.value.set(chromaKey.color);
                material.uniforms.similarity.value = chromaKey.similarity;
                material.uniforms.smoothness.value = chromaKey.smoothness;
            }
        }
    });

    unseen.forEach(id => {
        const obj = this.objectsMap.get(id);
        if (obj) {
            if (obj.userData.helper) {
                this.scene.remove(obj.userData.helper);
            }
            obj.traverse((child: any) => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat: THREE.Material) => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            if (obj.parent) { obj.parent.remove(obj); }
        }
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

  updateGlobalSettings(settings: GlobalSettings) {
      this.scene.background = new THREE.Color(settings.backgroundColor);
      
      this.bloomPass.enabled = settings.bloom.enabled;
      this.bloomPass.strength = settings.bloom.strength;
      this.bloomPass.threshold = settings.bloom.threshold;
      this.bloomPass.radius = settings.bloom.radius;

      this.vignettePass.enabled = settings.vignette.enabled;
      this.vignettePass.uniforms['offset'].value = settings.vignette.offset;
      this.vignettePass.uniforms['darkness'].value = settings.vignette.darkness;
      
      this.ambientLight.color.set(settings.ambientLight.color);
      this.ambientLight.intensity = settings.ambientLight.intensity;

      this.gridHelper.visible = settings.showGrid;
      
      this.objectsMap.forEach(obj => {
        if (obj.userData.helper) {
          obj.userData.helper.visible = settings.showLightHelpers;
        }
        const handle = obj.getObjectByName('light_handle');
        if (handle) {
          handle.visible = settings.showLightHelpers;
        }
      });
      
      // Performance Settings
      this.renderer.setPixelRatio(settings.performance.pixelRatio);
      
      const lightObjectGroup = Array.from(this.objectsMap.values()).find(obj => 
        obj.children.some(c => c instanceof THREE.DirectionalLight && (c as any).castShadow)
      );

      if (lightObjectGroup) {
          const lightWithShadow = lightObjectGroup.children.find(c => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight | undefined;
    
          if (lightWithShadow && lightWithShadow.shadow && lightWithShadow.shadow.mapSize.width !== settings.performance.shadowMapSize) {
              lightWithShadow.shadow.mapSize.width = settings.performance.shadowMapSize;
              lightWithShadow.shadow.mapSize.height = settings.performance.shadowMapSize;
              if (lightWithShadow.shadow.map) {
                  lightWithShadow.shadow.map.dispose();
                  (lightWithShadow.shadow.map as any) = null;
              }
          }
      }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.composer.render();
  }

  dispose() {
      this.renderer.dispose();
  }
}