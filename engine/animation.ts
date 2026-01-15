

import * as THREE from 'three';
import gsap from 'gsap';
import { SceneObject, TimelineKeyframe } from './types';
import type { Engine } from '../core';
import { updateSVGGeometry } from './object';

export function setTime(engine: Engine, time: number, objects: SceneObject[], isPlaying: boolean, timeHasChanged: boolean) {
    if (!engine.scene) return;
    
    objects.forEach(objData => {
      const obj3d = engine.objectsMap.get(objData.id);
      if (!obj3d) return;

      const isVisible = time >= objData.startTime && time <= objData.startTime + objData.duration;
      obj3d.visible = isVisible && objData.visible !== false;
      
      const sound = obj3d.children.find(c => c instanceof THREE.Audio || c instanceof THREE.PositionalAudio) as THREE.Audio | THREE.PositionalAudio;

      if (objData.type === 'video') {
        const video = engine.mediaElements.get(objData.id);
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
      else if (objData.type === 'lottie') {
          const anim = engine.lottieAnimations.get(objData.id);
          if (anim) {
              if (isVisible) {
                  const localTime = time - objData.startTime;
                  const frame = localTime * anim.frameRate;
                  
                  anim.goToAndStop(frame, true);
                  
                  const material = (obj3d as THREE.Mesh).material as THREE.MeshBasicMaterial;
                  if (material.map) {
                      material.map.needsUpdate = true;
                  }
              }
          }
      }
      
      if (!obj3d.visible) return;

      const localTime = time - objData.startTime;

      // Update Transform
      obj3d.position.fromArray(objData.position);
      // FIX: Cast mapped array to a tuple to satisfy Euler.fromArray's type requirement.
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
        if (departureValues.rotation && arrivalValues.rotation) obj3d.rotation.fromArray(lerp(departureValues.rotation, arrivalValues.rotation).map((v: number) => THREE.MathUtils.degToRad(v)));
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
          updateSVGGeometry(obj3d as THREE.Group, { ...objData, extrusion: finalExtrusion, pathLength: finalPathLength });
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
        if (!engine.isUserControllingCamera || timeHasChanged) {
            if (timeHasChanged) engine.isUserControllingCamera = false;
            engine.camera.position.copy(obj3d.position);
            engine.camera.rotation.copy(obj3d.rotation);
            if (objData.fov && engine.camera.fov !== objData.fov) {
                 engine.camera.fov = objData.fov;
                 engine.camera.updateProjectionMatrix();
            }
            const lookAtPoint = new THREE.Vector3(0, 0, -1);
            lookAtPoint.applyQuaternion(engine.camera.quaternion);
            lookAtPoint.add(engine.camera.position);
            engine.controls.target.copy(lookAtPoint);
        }
      }
    });
  }