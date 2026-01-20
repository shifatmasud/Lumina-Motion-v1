
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import lottie from 'lottie-web';
import { SceneObject } from './types';
import type { Engine } from './core';
import { chromaKeyVertexShader, chromaKeyFragmentShader } from './shaders';

export function updateSVGGeometry(mesh: THREE.Group, objData: SceneObject) {
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
  
export function createMesh(engine: Engine, objData: SceneObject): THREE.Object3D {
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
            engine.svgLoader.load(objData.url, (data) => {
                mesh.userData.svgPaths = data.paths;
                mesh.userData.currentExtrusion = objData.extrusion ?? 0.1;
                mesh.userData.currentPathLength = objData.pathLength ?? 1.0;
                updateSVGGeometry(mesh as THREE.Group, objData);
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
               engine.mediaElements.set(objData.id, video);
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
           const sound = new THREE.Audio(engine.audioListener);
           sound.setMediaElementSource(videoElement);
           mesh.add(sound);
       }
    } else if (objData.type === 'lottie') {
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
        
        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
        const material = new THREE.MeshBasicMaterial({ color: '#333', transparent: true, opacity: objData.opacity ?? 1.0, side: THREE.DoubleSide, wireframe: !!objData.wireframe });
        mesh = new THREE.Mesh(geometry, material);

        if (objData.url) {
            const canvas = document.createElement('canvas');
            canvas.width = objData.width || 512;
            canvas.height = objData.height || 512;
            
            const anim = lottie.loadAnimation({
                container: document.createElement('div'), 
                renderer: 'canvas',
                loop: objData.loop ?? true,
                autoplay: false,
                path: objData.url,
                rendererSettings: {
                    context: canvas.getContext('2d')!,
                    clearCanvas: true,
                },
            });
            engine.lottieAnimations.set(objData.id, anim);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            
            (mesh.material as THREE.MeshBasicMaterial).map = texture;
            (mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
        }
    } else if (objData.type === 'glb') {
        mesh = new THREE.Group();
        const placeholder = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ wireframe: true, color: '#555' }));
        mesh.add(placeholder);

        if (objData.url) {
            engine.gltfLoader.load(objData.url, (gltf) => {
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
            const sound = new THREE.PositionalAudio(engine.audioListener);
            engine.audioLoader.load(objData.url, (buffer) => {
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
            dirLight.shadow.mapSize.width = 1024; 
            dirLight.shadow.mapSize.height = 1024;
            dirLight.shadow.camera.top = 15;
            dirLight.shadow.camera.bottom = -15;
            dirLight.shadow.camera.left = -15;
            dirLight.shadow.camera.right = 15;
            dirLight.shadow.camera.near = 0.5;
            dirLight.shadow.camera.far = 50;
            dirLight.shadow.bias = -0.0005; 
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
        
        // The target is essential for direction calculation. It must be in the scene.
        // We add it to the main scene and store a reference for cleanup.
        if (light instanceof THREE.DirectionalLight || light instanceof THREE.SpotLight) {
            light.target.position.set(0, 0, 0); // Default target is world origin
            engine.scene.add(light.target);
            lightGroup.userData.target = light.target;
        }

        if (helper) {
            helper.visible = false;
            lightGroup.userData.helper = helper;
            engine.scene.add(helper);
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
    
    mesh.userData.id = objData.id;
    return mesh;
  }