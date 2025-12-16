
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { v4 as uuidv4 } from 'uuid';
import gsap from 'gsap';
import yaml from 'js-yaml';
import JSZip from 'jszip';

import { DesignSystem } from './theme';
import { Engine, SceneObject, GlobalSettings, TimelineKeyframe } from './engine';
import { Window } from './components/Core/Window';
import { TimelineSequencer } from './components/Section/Timeline';
import { Dock } from './components/Section/Dock';
import { AssetsPanel } from './components/Section/AssetsPanel';
import { PropertiesPanel } from './components/Section/PropertiesPanel';
import { ProjectSettingsPanel } from './components/Section/ProjectSettingsPanel';
import { ExportModal } from './components/Package/ExportModal';
import { createYamlString } from './utils/yamlExporter';
import { INITIAL_OBJECTS, INITIAL_GLOBAL_SETTINGS, defaultTransition, DEFAULT_ACCENT_COLOR } from './constants';

import './index.css';

const App = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const prevTimeRef = useRef(0);

  // --- State ---
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT_COLOR);
  const [objects, setObjects] = useState<SceneObject[]>(JSON.parse(JSON.stringify(INITIAL_OBJECTS)));
  const [selectedId, setSelectedId] = useState<string | null>('1');
  
  // Keyframe State
  const [selectedKeyframe, setSelectedKeyframe] = useState<{ id: string, index: number } | null>(null);
  const [copiedKeyframeYaml, setCopiedKeyframeYaml] = useState<string | null>(null);


  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(JSON.parse(JSON.stringify(INITIAL_GLOBAL_SETTINGS)));
  
  // Timeline State
  const [totalDuration, setTotalDuration] = useState(5); // in seconds
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
  
  // Window Visibility States
  const [showAssets, setShowAssets] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Control State
  const [isScaleLocked, setIsScaleLocked] = useState(false);

  // --- Effects ---

  // Aspect Ratio and Resize Handler
  useEffect(() => {
    const applyAspectRatio = () => {
        if (!containerRef.current) return;
        const canvasContainer = containerRef.current;
        const parent = canvasContainer.parentElement;
        if (!parent) return;
        
        const parentWidth = parent.clientWidth;
        const parentHeight = parent.clientHeight;

        if (globalSettings.aspectRatio === 'free' || !globalSettings.aspectRatio) {
            canvasContainer.style.width = '100%';
            canvasContainer.style.height = '100%';
            canvasContainer.style.position = 'absolute';
            canvasContainer.style.top = '0';
            canvasContainer.style.left = '0';
            canvasContainer.style.transform = 'none';
        } else {
            const [w, h] = globalSettings.aspectRatio.split(':').map(Number);
            const targetRatio = w / h;
            const parentRatio = parentWidth / parentHeight;

            let newWidth, newHeight;
            if (parentRatio > targetRatio) { // Pillarbox
                newHeight = parentHeight;
                newWidth = newHeight * targetRatio;
            } else { // Letterbox
                newWidth = parentWidth;
                newHeight = newWidth / targetRatio;
            }

            canvasContainer.style.width = `${newWidth}px`;
            canvasContainer.style.height = `${newHeight}px`;
            canvasContainer.style.position = 'absolute';
            canvasContainer.style.top = '50%';
            canvasContainer.style.left = '50%';
            canvasContainer.style.transform = 'translate(-50%, -50%)';
        }

        if (engineRef.current) {
            engineRef.current.onResize();
        }
    };

    applyAspectRatio();
    const resizeObserver = new ResizeObserver(applyAspectRatio);
    if (containerRef.current?.parentElement) {
        resizeObserver.observe(containerRef.current.parentElement);
    }
    
    return () => {
        resizeObserver.disconnect();
    };
  }, [globalSettings.aspectRatio]);

  const adjustColor = (color: string, amount: number) => {
      return '#' + color.replace(/^#/, '').match(/.{1,2}/g)!.map(c => Math.max(0, Math.min(255, parseInt(c, 16) + amount)).toString(16).padStart(2, '0')).join('');
  }
  
  // Theme Update
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-surface', accentColor);
    document.documentElement.style.setProperty('--accent-surface-dim', adjustColor(accentColor, -40));
    document.documentElement.style.setProperty('--accent-glow', `${accentColor}66`); // 40% opacity
    setGlobalSettings(prev => ({ ...prev, accentColor }));
    setObjects(prev => prev.map(o => 
      o.id === 'rim-light' ? { ...o, color: accentColor } : o
    ));
  }, [accentColor]);

  // Engine Init & Sync
  useEffect(() => {
    if (containerRef.current && !engineRef.current) {
      engineRef.current = new Engine(containerRef.current, (id) => {
        setSelectedId(id);
      });
    }
  }, []);

  useEffect(() => {
    if (engineRef.current) engineRef.current.sync(objects);
  }, [objects]);
  
  useEffect(() => {
    if (engineRef.current) {
      const timeHasChanged = prevTimeRef.current !== currentTime;
      engineRef.current.setTime(currentTime, objects, isPlaying, timeHasChanged);
      prevTimeRef.current = currentTime;
    }
  }, [currentTime, objects, isPlaying]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.updateGlobalSettings(globalSettings);
  }, [globalSettings]);

  // Playback Loop
  useEffect(() => {
      if (isPlaying) {
          lastTimeRef.current = performance.now();
          const loop = (now: number) => {
              const delta = (now - (lastTimeRef.current ?? now)) / 1000;
              lastTimeRef.current = now;
              setCurrentTime(prev => {
                  const newTime = prev + delta;
                  if (newTime >= totalDuration) {
                      setIsPlaying(false);
                      return 0;
                  }
                  return newTime;
              });
              animationFrameRef.current = requestAnimationFrame(loop);
          };
          animationFrameRef.current = requestAnimationFrame(loop);
      } else {
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      }
      return () => {
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
  }, [isPlaying, totalDuration]);

  // Dynamic Camera Duration
  useEffect(() => {
    const camera = objects.find(o => o.id === 'camera-main');
    if (!camera) return;

    const otherObjects = objects.filter(o => o.id !== 'camera-main');
    const endTimes = otherObjects.map(o => o.startTime + o.duration);
    const maxEndTime = Math.max(0, ...endTimes); 

    const newCameraDuration = Math.max(1, maxEndTime);

    if (camera.duration !== newCameraDuration) {
      setObjects(prev => prev.map(o => 
        o.id === 'camera-main' 
          ? { ...o, duration: newCameraDuration } 
          : o
      ));
    }
  }, [objects]);
  
  // Dynamic Total Duration
  useEffect(() => {
    const endTimes = objects.map(o => o.startTime + o.duration);
    const maxEndTime = Math.max(0, ...endTimes);
    setTotalDuration(Math.max(5, maxEndTime));
  }, [objects]);

  const selectedObject = objects.find(o => o.id === selectedId);

  // --- Prop Control Helpers ---

  const getInterpolatedValueAtTime = (objData: SceneObject, property: string, localTime: number) => {
    const baseValue = objData[property as keyof SceneObject];
    if (!objData.animations || objData.animations.length === 0) return baseValue;

    const keyframes = [...objData.animations];
    const baseState: TimelineKeyframe['values'] = {
        position: objData.position, rotation: objData.rotation, scale: objData.scale,
        metalness: objData.metalness, roughness: objData.roughness, opacity: objData.opacity, volume: objData.volume,
        curvature: objData.curvature, transmission: objData.transmission, ior: objData.ior, thickness: objData.thickness,
        clearcoat: objData.clearcoat, clearcoatRoughness: objData.clearcoatRoughness, extrusion: objData.extrusion,
        pathLength: objData.pathLength, color: objData.color, intensity: objData.intensity,
    };
    const baseKeyframe: TimelineKeyframe = { time: 0, values: {}, easing: 'none' };

    let departureKf = baseKeyframe;
    let arrivalKf: TimelineKeyframe | null = null;
    for (const kf of keyframes) {
        if (kf.time <= localTime) departureKf = kf;
        else { arrivalKf = kf; break; }
    }
    if (!arrivalKf) arrivalKf = departureKf;

    const departureValues = { ...baseState, ...departureKf.values };
    const arrivalValues = { ...baseState, ...arrivalKf.values };
    
    const startVal = departureValues[property as keyof typeof departureValues];
    const endVal = arrivalValues[property as keyof typeof arrivalValues];

    if (startVal === undefined || endVal === undefined) return baseValue;

    const duration = arrivalKf.time - departureKf.time;
    const progress = duration > 0 ? (localTime - departureKf.time) / duration : 1;
    
    const ease = gsap.parseEase(arrivalKf.easing || 'none');
    const easedProgress = ease(progress);

    // Color interpolation needs special handling in GSAP
    if (property === 'color' && typeof startVal === 'string' && typeof endVal === 'string') {
        return gsap.utils.interpolate(startVal, endVal)(easedProgress);
    }

    return gsap.utils.interpolate(startVal, endVal, easedProgress);
  }
  
  const getFullKeyframeValuesAtTime = (object: SceneObject, time: number): TimelineKeyframe['values'] => {
    const values: Partial<TimelineKeyframe['values']> = {};
    
    // Define animatable properties per type for robust copying
    const animatableProps: { [key in SceneObject['type']]?: (keyof TimelineKeyframe['values'])[] } = {
        'mesh': ['position', 'rotation', 'scale', 'opacity', 'metalness', 'roughness', 'transmission', 'ior', 'thickness', 'clearcoat', 'clearcoatRoughness', 'color'],
        'svg': ['position', 'rotation', 'scale', 'opacity', 'metalness', 'roughness', 'transmission', 'ior', 'thickness', 'clearcoat', 'clearcoatRoughness', 'extrusion', 'pathLength', 'color'],
        'plane': ['position', 'rotation', 'scale', 'opacity', 'curvature'],
        'lottie': ['position', 'rotation', 'scale', 'opacity'],
        'video': ['position', 'rotation', 'scale', 'opacity', 'curvature', 'volume'],
        'glb': ['position', 'rotation', 'scale', 'opacity'],
        'audio': ['position', 'volume'],
        'camera': ['position', 'rotation'],
        'light': ['position', 'rotation', 'color', 'intensity']
    };

    const propsForType = animatableProps[object.type] || [];
    
    propsForType.forEach(prop => {
        const value = getInterpolatedValueAtTime(object, prop, time);
        if (value !== undefined) {
            (values as any)[prop] = value;
        }
    });
    
    return values;
  };

  // --- Actions ---
  const handleTogglePlay = () => {
      engineRef.current?.resumeAudioContext();
      setIsPlaying(!isPlaying);
  };
    
  const handleAddObject = (type: SceneObject['type'], url?: string, width?: number, height?: number) => {
    const defaultNameMap = {
        mesh: 'Cube', camera: 'Camera', audio: 'Audio', video: 'Video',
        glb: 'Model', plane: 'Image', svg: 'SVG Shape', lottie: 'Animation', light: 'Light'
    };
    const defaultName = defaultNameMap[type] || 'Object';
    
    const newObj: SceneObject = {
      id: uuidv4(), type,
      name: defaultName,
      position: [(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0],
      rotation: [0, 0, 0], scale: [1, 1, 1], url,
      width, height,
      color: (type === 'mesh' || type === 'svg') ? accentColor : undefined,
      extrusion: type === 'svg' ? 0.1 : undefined,
      pathLength: type === 'svg' ? 1.0 : undefined,
      metalness: 0.2, roughness: 0.1, transmission: 0, ior: 1.5, thickness: 0.5, clearcoat: 0, clearcoatRoughness: 0,
      opacity: 1.0,
      curvature: 0,
      volume: type === 'audio' || type === 'video' ? 1.0 : undefined,
      chromaKey: type === 'video' ? { enabled: false, color: '#00ff00', similarity: 0.1, smoothness: 0.1 } : undefined,
      loop: (type === 'video' || type === 'lottie') ? true : undefined,
      startTime: Math.floor(currentTime), duration: 5, animations: [],
      introTransition: { ...defaultTransition },
      outroTransition: { ...defaultTransition },
    };
    setObjects(prev => [...prev, newObj]);
    setSelectedId(newObj.id);
    setShowProperties(true);
  };

  const handleUpdateObject = (id: string, updates: Partial<SceneObject>) => {
    setObjects(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const handleRemoveObject = (id: string) => {
      if (id === 'camera-main' || id === 'main-light' || id === 'rim-light' || id === 'ground-plane') return;
      setObjects(prev => prev.filter(o => o.id !== id));
      if (selectedId === id) setSelectedId(null);
  };

  const handleAddKeyframe = () => {
    if (!selectedId) return;

    const objectToAddKf = objects.find(o => o.id === selectedId);
    if (!objectToAddKf) return;
    
    const localTime = parseFloat((Math.max(0, currentTime - objectToAddKf.startTime)).toFixed(3));
    const newValues = getFullKeyframeValuesAtTime(objectToAddKf, localTime);

    setObjects(prev => prev.map(o => {
      if (o.id !== selectedId) return o;
      
      const newAnimations = o.animations ? [...o.animations] : [];
      const existingIndex = newAnimations.findIndex(kf => Math.abs(kf.time - localTime) < 0.01);
      
      if (existingIndex !== -1) {
        newAnimations[existingIndex].values = { ...newAnimations[existingIndex].values, ...newValues };
      } else {
        newAnimations.push({ time: localTime, values: newValues, easing: 'none' });
      }
      
      newAnimations.sort((a, b) => a.time - b.time);
      return { ...o, animations: newAnimations };
    }));
  };
  
  const handleRemoveKeyframe = () => {
      if (!selectedKeyframe) return;
      setObjects(prev => prev.map(o => {
          if (o.id !== selectedKeyframe.id) return o;
          const newAnims = o.animations.filter((_, i) => i !== selectedKeyframe.index);
          return { ...o, animations: newAnims };
      }));
      setSelectedKeyframe(null);
  };
  
  const handleSelectKeyframe = (id: string, index: number) => {
    if (selectedKeyframe?.id === id && selectedKeyframe.index === index) {
      setSelectedKeyframe(null); 
    } else {
      setSelectedId(id); 
      setSelectedKeyframe({ id, index });
      setShowProperties(true);

      const obj = objects.find(o => o.id === id);
      const kf = obj?.animations[index];
      if (obj && kf) {
          setCurrentTime(obj.startTime + kf.time);
      }
    }
  };

  const handleCopySelectedKeyframeValuesAsYaml = async () => {
    if (!selectedKeyframe || !selectedObject) return;
    
    const kf = selectedObject.animations[selectedKeyframe.index];
    if (!kf) return;
    
    const localTime = kf.time;
    const fullValues = getFullKeyframeValuesAtTime(selectedObject, localTime);

    // Construct the full keyframe object for copying
    const keyframeToCopy = {
        time: kf.time,
        name: kf.name,
        easing: kf.easing,
        values: fullValues,
    };

    // Clean object to remove undefined keys before dumping
    const cleanedKeyframeToCopy = JSON.parse(JSON.stringify(keyframeToCopy));

    try {
        const yamlString = yaml.dump(cleanedKeyframeToCopy);
        await navigator.clipboard.writeText(yamlString);
        setCopiedKeyframeYaml(yamlString);
    } catch (error) {
        console.error('Failed to copy full keyframe values as YAML:', error);
        alert('Failed to copy keyframe as YAML.');
    }
  };
  
  const handlePasteValuesToSelectedKeyframeFromYaml = async () => {
    if (!selectedKeyframe || !selectedObject) return;
    try {
        const text = await navigator.clipboard.readText();
        const parsedKeyframe = yaml.load(text) as any;

        if (typeof parsedKeyframe !== 'object' || parsedKeyframe === null || Array.isArray(parsedKeyframe)) {
            throw new Error('Pasted content is not a valid keyframe object.');
        }
        
        // Prepare updates, preserving the keyframe's original time.
        const updates: Partial<TimelineKeyframe> = {};

        // The pasted content could be a full keyframe object or just a values object.
        // We prioritize pasting a full keyframe structure if it's present.
        if ('values' in parsedKeyframe && typeof parsedKeyframe.values === 'object') {
            // It's a full keyframe object.
            updates.values = parsedKeyframe.values as TimelineKeyframe['values'];
            if ('name' in parsedKeyframe) updates.name = parsedKeyframe.name as string;
            if ('easing' in parsedKeyframe) updates.easing = parsedKeyframe.easing as string;
        } else {
            // Assume the entire pasted object is the 'values' block for backward compatibility.
            updates.values = parsedKeyframe as TimelineKeyframe['values'];
        }

        setObjects(prev => prev.map(o => {
            if (o.id !== selectedObject.id) return o;
            const newAnims = [...o.animations];
            if (!newAnims[selectedKeyframe.index]) return o;
            
            newAnims[selectedKeyframe.index] = {
                ...newAnims[selectedKeyframe.index],
                ...updates
            };
            
            return { ...o, animations: newAnims };
        }));
    } catch (error) {
        console.error('Failed to paste YAML:', error);
        alert('Failed to paste keyframe. Clipboard must contain a valid YAML keyframe or values object.');
    }
  };
  
  const handleCopyAllKeyframesAsYaml = async (trackId: string) => {
    const objectToCopy = objects.find(o => o.id === trackId);
    if (!objectToCopy || !objectToCopy.animations) return;
    
    try {
        const yamlString = yaml.dump(objectToCopy.animations);
        await navigator.clipboard.writeText(yamlString);
        setCopiedKeyframeYaml(yamlString);
    } catch (error) {
        console.error('Failed to copy all keyframes as YAML:', error);
        alert('Failed to copy keyframes.');
    }
  };
  
  const handlePasteAllKeyframesFromYaml = async (trackId: string) => {
    try {
        const text = await navigator.clipboard.readText();
        const parsedKeyframes = yaml.load(text);

        if (!Array.isArray(parsedKeyframes)) {
             throw new Error('Pasted content is not a valid keyframe array.');
        }
        
        // Robust validation of the pasted structure
        const isValidKeyframeArray = parsedKeyframes.every(kf => 
            typeof kf === 'object' && kf !== null &&
            typeof kf.time === 'number' &&
            typeof kf.values === 'object' && kf.values !== null &&
            (kf.name === undefined || kf.name === null || typeof kf.name === 'string') &&
            (kf.easing === undefined || typeof kf.easing === 'string')
        );

        if (!isValidKeyframeArray) {
            throw new Error('Pasted YAML is an array, but its items do not match the required keyframe structure.');
        }

        setObjects(prev => prev.map(o => {
            if (o.id !== trackId) return o;
            return { ...o, animations: parsedKeyframes as TimelineKeyframe[] };
        }));

    } catch (error) {
        console.error('Failed to paste all keyframes from YAML:', error);
        alert('Failed to paste keyframes. Clipboard must contain a valid YAML array of keyframes.');
    }
  };
  
  const handleResetScene = () => {
      setAccentColor(DEFAULT_ACCENT_COLOR);
      setObjects(JSON.parse(JSON.stringify(INITIAL_OBJECTS)));
      setGlobalSettings(JSON.parse(JSON.stringify(INITIAL_GLOBAL_SETTINGS)));
      setSelectedId('1');
      setCurrentTime(0);
      setIsPlaying(false);
      setSelectedKeyframe(null);
  };

  const handleExportYaml = () => {
    try {
        const yamlString = createYamlString(globalSettings, objects);
        const blob = new Blob([yamlString], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'lumina-scene.yaml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Failed to generate YAML:", e);
        alert("Sorry, there was an error exporting the YAML file.");
    }
  };

  const processLottieFile = async (file: File) => {
    const zip = new JSZip();
    try {
      const content = await zip.loadAsync(file);
      const manifestFile = content.file('manifest.json');
      if (!manifestFile) {
          console.error('manifest.json not found in .lottie file');
          return;
      }
      const manifestStr = await manifestFile.async('string');
      const manifest = JSON.parse(manifestStr);
      const animationId = manifest.animations[0]?.id;
      if (!animationId) {
          console.error('No animation found in manifest.json');
          return;
      }

      const animationFile = content.file(`animations/${animationId}.json`);
      if (!animationFile) {
          console.error(`Animation file animations/${animationId}.json not found`);
          return;
      }

      const animationStr = await animationFile.async('string');
      const animationData = JSON.parse(animationStr);
      
      const blob = new Blob([animationStr], { type: 'application/json' });
      const animationUrl = URL.createObjectURL(blob);
      
      const width = animationData.w;
      const height = animationData.h;

      handleAddObject('lottie', animationUrl, width, height);

    } catch (e) {
      console.error('Failed to process .lottie file', e);
    }
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) processFile(e.target.files[0]); };
  
  const processFile = (file: File) => {
      const url = URL.createObjectURL(file);
      const type = file.type;
      const name = file.name.toLowerCase();
      
      if (name.endsWith('.svg')) {
          handleAddObject('svg', url);
      }
      else if (name.endsWith('.lottie')) {
          processLottieFile(file);
      }
      else if (type.startsWith('image/')) {
          const img = new Image();
          img.onload = () => {
            handleAddObject('plane', url, img.width, img.height);
          };
          img.src = url;
      }
      else if (type.startsWith('video/') || name.endsWith('.mp4')) {
          const video = document.createElement('video');
          video.onloadedmetadata = () => {
              handleAddObject('video', url, video.videoWidth, video.videoHeight);
          };
          video.src = url;
      }
      else if (type.startsWith('audio/') || name.endsWith('.wav') || name.endsWith('.mp3') || name.endsWith('.ogg')) handleAddObject('audio', url);
      else if (name.endsWith('.glb') || name.endsWith('.gltf')) handleAddObject('glb', url);
  };
  
  const getControlValue = (property: string, axis?: number) => {
    if (!selectedObject) return axis !== undefined ? 0 : (property.includes('scale') ? 1 : 0);

    if (selectedKeyframe && selectedKeyframe.id === selectedObject.id) {
        const kf = selectedObject.animations[selectedKeyframe.index];
        const val = kf?.values[property as keyof typeof kf.values];
        const fallback = selectedObject[property as keyof SceneObject];
        const finalVal = val !== undefined ? val : fallback;
        if (axis !== undefined && Array.isArray(finalVal)) return (finalVal as any)[axis];
        return finalVal;
    }
    
    const localTime = currentTime - selectedObject.startTime;
    const value = getInterpolatedValueAtTime(selectedObject, property, localTime);
    if (axis !== undefined && Array.isArray(value)) return (value as any)[axis];
    return value;
  }

  const handleControlChange = (property: string, value: any, axis?: number) => {
    if (!selectedId) return;

    let finalValue = value;
    
    if (property === 'scale' && isScaleLocked && axis !== undefined && selectedObject) {
        const baseScale = (selectedKeyframe && selectedKeyframe.id === selectedId)
            ? (selectedObject.animations[selectedKeyframe.index]?.values?.scale || selectedObject.scale)
            : selectedObject.scale;
        
        const oldValueForAxis = baseScale[axis];
        const ratio = (oldValueForAxis !== 0 && oldValueForAxis !== undefined) ? value / oldValueForAxis : 1;
        
        const newScale: [number, number, number] = [
            baseScale[0] * ratio,
            baseScale[1] * ratio,
            baseScale[2] * ratio
        ];
        newScale[axis] = value;
        
        finalValue = newScale;
        axis = undefined; // Unset axis since we are now passing the full array
    }

    if (selectedKeyframe && selectedKeyframe.id === selectedId) {
        setObjects(prev => prev.map(o => {
            if (o.id !== selectedId) return o;
            
            const newAnims = [...o.animations];
            const kfToUpdate = newAnims[selectedKeyframe.index];
            if (!kfToUpdate) return o;

            let updatedValue = finalValue;
            if (axis !== undefined) {
                const currentValue = (kfToUpdate.values[property as keyof typeof kfToUpdate.values] as [number, number, number]) || 
                                     (o[property as keyof SceneObject] as [number, number, number]) || 
                                     (property.includes('scale') ? [1, 1, 1] : [0, 0, 0]);
                const newTuple = [...currentValue] as [number, number, number];
                newTuple[axis] = finalValue;
                updatedValue = newTuple;
            }

            newAnims[selectedKeyframe.index] = {
                ...kfToUpdate,
                values: { ...kfToUpdate.values, [property]: updatedValue }
            };
            return { ...o, animations: newAnims };
        }));
    } else {
        setObjects(prev => prev.map(o => {
            if (o.id !== selectedId) return o;
            let updatedValue = finalValue;
            if (axis !== undefined) {
                const currentValue = (o[property as keyof SceneObject] as [number, number, number]) || (property.includes('scale') ? [1, 1, 1] : [0, 0, 0]);
                const newTuple = [...currentValue] as [number, number, number];
                newTuple[axis] = finalValue;
                updatedValue = newTuple;
            }
            return { ...o, [property]: updatedValue };
        }));
    }
  };
  
  const handleKeyframePropertyChange = (property: keyof TimelineKeyframe, value: any) => {
    if (!selectedKeyframe || !selectedObject) return;

    setObjects(prev => prev.map(o => {
        if (o.id !== selectedId) return o;
        const newAnims = [...o.animations];
        if (!newAnims[selectedKeyframe.index]) return o;
        
        newAnims[selectedKeyframe.index] = { ...newAnims[selectedKeyframe.index], [property]: value };
        
        return { ...o, animations: newAnims };
    }));
  };
  
  const handleLightSettingChange = (light: 'ambientLight', property: string, value: any) => {
    setGlobalSettings(g => {
        const newLightSettings = { ...g[light] } as any;
        newLightSettings[property] = value;
        return { ...g, [light]: newLightSettings };
    });
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: DesignSystem.Color.Base.Surface[1] }}>
      <div ref={containerRef} style={{ zIndex: 0 }} />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        engine={engineRef.current}
        objects={objects}
        totalDuration={totalDuration}
      />

      <Window 
        id="assets" 
        title="ASSETS" 
        isOpen={showAssets} 
        onClose={() => setShowAssets(false)} 
        width={300} 
        height={420}
      >
         <AssetsPanel 
            onAddObject={handleAddObject} 
            onExportVideo={() => setShowExportModal(true)} 
            onExportYaml={handleExportYaml} 
            onFileDrop={handleDrop} 
            onFileUpload={handleFileUpload} 
        />
      </Window>

      <Window
        id="project-settings"
        title="PROJECT SETTINGS"
        isOpen={showProjectSettings}
        onClose={() => setShowProjectSettings(false)}
        width={320}
        height={480}
      >
          <ProjectSettingsPanel settings={globalSettings} setSettings={setGlobalSettings} />
      </Window>

      <Window 
        id="props" 
        title="CONTROLS" 
        isOpen={showProperties} 
        onClose={() => setShowProperties(false)} 
        width={280} 
        onResetScene={handleResetScene}
        selectedKeyframe={selectedKeyframe}
        copiedKeyframeYaml={copiedKeyframeYaml}
        onCopyKeyframeAsYaml={handleCopySelectedKeyframeValuesAsYaml}
        onPasteKeyframeFromYaml={handlePasteValuesToSelectedKeyframeFromYaml}
        onOpenProjectSettings={() => setShowProjectSettings(true)}
      >
        <PropertiesPanel
            selectedObject={selectedObject}
            selectedKeyframe={selectedKeyframe}
            globalSettings={globalSettings}
            accentColor={accentColor}
            isScaleLocked={isScaleLocked}
            getControlValue={getControlValue}
            handleControlChange={handleControlChange}
            handleUpdateObject={handleUpdateObject}
            handleRemoveObject={handleRemoveObject}
            handleKeyframePropertyChange={handleKeyframePropertyChange}
            handleRemoveKeyframe={handleRemoveKeyframe}
            handleLightSettingChange={handleLightSettingChange}
            setGlobalSettings={setGlobalSettings}
            setAccentColor={setAccentColor}
            setIsScaleLocked={setIsScaleLocked}
        />
      </Window>

      <Window 
        id="timeline" 
        title="SEQUENCER" 
        isOpen={showTimeline} 
        onClose={() => setShowTimeline(false)} 
        width={800} 
        height={450}
        isSnappingEnabled={isSnappingEnabled}
        onToggleSnapping={() => setIsSnappingEnabled(!isSnappingEnabled)}
      >
          <TimelineSequencer 
            objects={objects} 
            setObjects={setObjects} 
            selectedId={selectedId} 
            onSelect={(id) => { setSelectedId(id); setShowProperties(true); }} 
            isPlaying={isPlaying} 
            onTogglePlay={handleTogglePlay} 
            currentTime={currentTime} 
            setCurrentTime={setCurrentTime} 
            totalDuration={totalDuration} 
            onAddKeyframe={handleAddKeyframe} 
            selectedKeyframe={selectedKeyframe}
            onSelectKeyframe={handleSelectKeyframe}
            onRemoveKeyframe={handleRemoveKeyframe}
            isSnappingEnabled={isSnappingEnabled}
            onCopyAllKeyframesAsYaml={handleCopyAllKeyframesAsYaml}
            onPasteAllKeyframesFromYaml={handlePasteAllKeyframesFromYaml}
            copiedKeyframeYaml={copiedKeyframeYaml}
          />
      </Window>

      <Dock 
        containerRef={containerRef}
        showAssets={showAssets}
        setShowAssets={setShowAssets}
        showTimeline={showTimeline}
        setShowTimeline={setShowTimeline}
        showProperties={showProperties}
        setShowProperties={setShowProperties}
      />
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
