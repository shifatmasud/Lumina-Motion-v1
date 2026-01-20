
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { SceneObject, GlobalSettings } from './types';
import { createMesh } from './object';
import { setTime as applyTime } from './animation';

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
  lottieAnimations: Map<string, any>;
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

  private boundOnResize: () => void;
  private boundOnPointerDown: (event: PointerEvent) => void;

  constructor(container: HTMLElement, onSelect?: (id: string | null) => void) {
    this.container = container;
    this.onSelect = onSelect;
    this.objectsMap = new Map();
    this.mediaElements = new Map();
    this.lottieAnimations = new Map();
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
    this.camera.add(this.audioListener);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; // CRITICAL for PBR
    this.renderer.shadowMap.enabled = true; // Enable shadows
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    this.boundOnResize = this.onResize.bind(this);
    this.boundOnPointerDown = this.onPointerDown.bind(this);
    window.addEventListener('resize', this.boundOnResize);
    this.renderer.domElement.addEventListener('pointerdown', this.boundOnPointerDown);
    
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
         if (selected.userData.id && this.objectsMap.has(selected.userData.id)) {
            foundId = selected.userData.id;
            break;
         }
         if (selected.parent) {
             selected = selected.parent;
         } else {
             break;
         }
      }

      if (this.onSelect) this.onSelect(foundId);
    } else {
       if (this.onSelect) this.onSelect(null);
    }
  }

  setTime(time: number, objects: SceneObject[], isPlaying: boolean, timeHasChanged: boolean) {
    applyTime(this, time, objects, isPlaying, timeHasChanged);
  }

  sync(objects: SceneObject[]) {
    const unseen = new Set(this.objectsMap.keys());

    objects.forEach(objData => {
        let obj3d = this.objectsMap.get(objData.id);

        if (!obj3d) {
            obj3d = createMesh(this, objData);
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
        
        if (objData.type === 'video' || objData.type === 'lottie') {
            const mediaObject = this.mediaElements.get(objData.id);
            if (mediaObject && mediaObject.loop !== (objData.loop ?? true)) {
                mediaObject.loop = objData.loop ?? true;
            }
            const lottieAnim = this.lottieAnimations.get(objData.id);
            if (lottieAnim && lottieAnim.loop !== (objData.loop ?? true)) {
                lottieAnim.loop = objData.loop ?? true;
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
        if (this.lottieAnimations.has(id)) {
            const anim = this.lottieAnimations.get(id);
            anim.destroy();
            this.lottieAnimations.delete(id);
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
        obj.children.some(c => c instanceof THREE.DirectionalLight && c.castShadow)
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
      window.removeEventListener('resize', this.boundOnResize);
      this.renderer.domElement.removeEventListener('pointerdown', this.boundOnPointerDown);

      this.scene.traverse(object => {
          if (object instanceof THREE.Mesh) {
              if (object.geometry) object.geometry.dispose();
              if (Array.isArray(object.material)) {
                  object.material.forEach(material => material.dispose());
              } else if (object.material) {
                  object.material.dispose();
              }
          }
      });
      
      this.renderer.dispose();

      if (this.container && this.renderer.domElement.parentNode === this.container) {
          this.container.removeChild(this.renderer.domElement);
      }
  }
}