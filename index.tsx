

import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { v4 as uuidv4 } from 'uuid';
import gsap from 'gsap';
import yaml from 'js-yaml';

import { DesignSystem } from './theme';
import { Engine, SceneObject, GlobalSettings, TimelineKeyframe } from './engine';
import { Window } from './components/Core/Window';
import { TimelineSequencer } from './components/Section/Timeline';
import { Dock } from './components/Section/Dock';
import { AssetsPanel } from './components/Section/AssetsPanel';
import { PropertiesPanel } from './components/Section/PropertiesPanel';
import { ProjectSettingsPanel } from './components/Section/ProjectSettingsPanel';
import { createYamlString } from './utils/yamlExporter';
import { INITIAL_OBJECTS, INITIAL_GLOBAL_SETTINGS, defaultTransition } from './constants';

import './index.css';

const App = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const prevTimeRef = useRef(0);

  // --- State ---
  const [accentColor, setAccentColor] = useState(DesignSystem.Color.Accent.Surface[1] as string);
  const [objects, setObjects] = useState<SceneObject[]>(JSON.parse(JSON.stringify(INITIAL_OBJECTS)));
  const [selectedId, setSelectedId] = useState<string | null>('1');
  
  // Keyframe State
  const [selectedKeyframe, setSelectedKeyframe] = useState<{ id: string, index: number } | null>(null);
  const [copiedKeyframeYaml, setCopiedKeyframeYaml] = useState<string | null>(null);


  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(JSON.parse(JSON.stringify(INITIAL_GLOBAL_SETTINGS)));
  
  // Timeline State
  const [totalDuration, setTotalDuration] = useState(10); // in seconds
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
  const [easingMode, setEasingMode] = useState<'arrival' | 'departure'>('arrival');

  // Window Visibility States
  const [showAssets, setShowAssets] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [showProjectSettings, setShowProjectSettings] = useState(false);

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
    setGlobalSettings(prev => ({ 
      ...prev, 
      accentColor,
      rimLight: { ...prev.rimLight, color: accentColor } 
    }));
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
      engineRef.current.setTime(currentTime, objects, isPlaying, timeHasChanged, easingMode);
      prevTimeRef.current = currentTime;
    }
  }, [currentTime, objects, isPlaying, easingMode]);

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
  
  const selectedObject = objects.find(o => o.id === selectedId);

  // --- Actions ---
  const handleTogglePlay = () => {
      engineRef.current?.resumeAudioContext();
      setIsPlaying(!isPlaying);
  };
    
  const handleAddObject = (type: SceneObject['type'], url?: string, width?: number, height?: number) => {
    const defaultNameMap = {
        mesh: 'Cube', camera: 'Camera', audio: 'Audio', video: 'Video',
        glb: 'Model', plane: 'Image', svg: 'SVG Shape'
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
      loop: type === 'video' ? true : undefined,
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
      if (id === 'camera-main') return;
      setObjects(prev => prev.filter(o => o.id !== id));
      if (selectedId === id) setSelectedId(null);
  };

  const handleAddKeyframe = () => {
    if (!selectedId) return;
    setObjects(prev => prev.map(o => {
      if (o.id !== selectedId) return o;
      
      const newAnimations = o.animations ? [...o.animations] : [];
      // Explicitly round to prevent floating point misalignment
      const time = parseFloat((Math.max(0, currentTime - o.startTime)).toFixed(3)); 

      const newValues: TimelineKeyframe['values'] = {
        position: [...o.position] as [number, number, number],
        rotation: [...o.rotation] as [number, number, number],
      };
      
      if (o.type !== 'camera') newValues.scale = [...o.scale] as [number, number, number];
      if (o.type === 'mesh' || o.type === 'svg') {
        newValues.metalness = o.metalness;
        newValues.roughness = o.roughness;
        newValues.transmission = o.transmission;
        newValues.ior = o.ior;
        newValues.thickness = o.thickness;
        newValues.clearcoat = o.clearcoat;
        newValues.clearcoatRoughness = o.clearcoatRoughness;
        newValues.extrusion = o.extrusion;
        if (o.type === 'svg') {
          newValues.pathLength = o.pathLength;
        }
      }
      if (o.type === 'audio' || o.type === 'video') newValues.volume = o.volume;

      newValues.opacity = o.opacity;
      newValues.curvature = o.curvature;

      const existingIndex = newAnimations.findIndex(kf => Math.abs(kf.time - time) < 0.01);
      if (existingIndex !== -1) {
        newAnimations[existingIndex].values = { ...newAnimations[existingIndex].values, ...newValues };
      } else {
        newAnimations.push({ time, values: newValues, easing: 'power2.out' });
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
  
  const handleCopyKeyframeAsYaml = async () => {
    if (!selectedKeyframe || !selectedObject) return;
    const kf = selectedObject.animations[selectedKeyframe.index];
    if (kf && kf.values) {
        try {
            const yamlString = yaml.dump(kf.values);
            await navigator.clipboard.writeText(yamlString);
            setCopiedKeyframeYaml(yamlString);
        } catch (error) {
            console.error('Failed to copy YAML:', error);
            alert('Failed to copy keyframe as YAML.');
        }
    }
  };
  
  const handlePasteKeyframeFromYaml = async () => {
    if (!selectedKeyframe || !selectedObject) return;
    try {
        const text = await navigator.clipboard.readText();
        const parsedValues = yaml.load(text);

        if (typeof parsedValues !== 'object' || parsedValues === null) {
            throw new Error('Pasted content is not a valid object.');
        }

        setObjects(prev => prev.map(o => {
            if (o.id !== selectedObject.id) return o;
            const newAnims = [...o.animations];
            if (!newAnims[selectedKeyframe.index]) return o;
            
            newAnims[selectedKeyframe.index] = {
                ...newAnims[selectedKeyframe.index],
                values: { ...newAnims[selectedKeyframe.index].values, ...parsedValues }
            };
            
            return { ...o, animations: newAnims };
        }));
    } catch (error) {
        console.error('Failed to paste YAML:', error);
        alert('Failed to paste keyframe. Please ensure valid YAML is in your clipboard.');
    }
  };
  
  const handleResetScene = () => {
      setAccentColor(DesignSystem.Color.Accent.Surface[1] as string);
      setObjects(JSON.parse(JSON.stringify(INITIAL_OBJECTS)));
      setGlobalSettings(JSON.parse(JSON.stringify(INITIAL_GLOBAL_SETTINGS)));
      setSelectedId('1');
      setCurrentTime(0);
      setIsPlaying(false);
      setSelectedKeyframe(null);
  };

  const handleExportVideo = () => {
      alert("Video Export initiated... (Simulation)");
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

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) processFile(e.target.files[0]); };
  
  const processFile = (file: File) => {
      const url = URL.createObjectURL(file);
      const type = file.type;
      const name = file.name.toLowerCase();
      
      if (name.endsWith('.svg')) {
          handleAddObject('svg', url);
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
  
  // --- Prop Control Helpers ---

  const getInterpolatedValueAtTime = (objData: SceneObject, property: string, localTime: number, mode: 'arrival' | 'departure') => {
    const baseValue = objData[property as keyof SceneObject];
    if (!objData.animations || objData.animations.length === 0) return baseValue;

    const keyframes = [...objData.animations];
    const baseState: TimelineKeyframe['values'] = {
        position: objData.position, rotation: objData.rotation, scale: objData.scale,
        metalness: objData.metalness, roughness: objData.roughness, opacity: objData.opacity, volume: objData.volume,
        curvature: objData.curvature, transmission: objData.transmission, ior: objData.ior, thickness: objData.thickness,
        clearcoat: objData.clearcoat, clearcoatRoughness: objData.clearcoatRoughness, extrusion: objData.extrusion,
        pathLength: objData.pathLength,
    };
    const baseKeyframe: TimelineKeyframe = { time: 0, values: {}, easing: 'power2.out' };

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
    
    const easingSource = mode === 'arrival' ? arrivalKf : departureKf;
    const ease = gsap.parseEase(easingSource.easing || 'power2.out');
    const easedProgress = ease(progress);

    return gsap.utils.interpolate(startVal, endVal, easedProgress);
  }
  
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
    const value = getInterpolatedValueAtTime(selectedObject, property, localTime, easingMode);
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
  
  const handleLightSettingChange = (light: 'ambientLight' | 'mainLight' | 'rimLight', property: string, value: any, axis?: number) => {
    setGlobalSettings(g => {
        const newLightSettings = { ...g[light] } as any;
        if (axis !== undefined) {
            const newPosition = [...newLightSettings[property]] as [number,number,number];
            newPosition[axis] = value;
            newLightSettings[property] = newPosition;
        } else {
            newLightSettings[property] = value;
        }
        return { ...g, [light]: newLightSettings };
    });
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: DesignSystem.Color.Base.Surface[1] }}>
      <div ref={containerRef} style={{ zIndex: 0 }} />

      <Window 
        id="assets" 
        title="ASSETS" 
        isOpen={showAssets} 
        onClose={() => setShowAssets(false)} 
        width={300} 
        height={420}
        onOpenProjectSettings={() => setShowProjectSettings(true)}
      >
         <AssetsPanel 
            onAddObject={handleAddObject} 
            onExportVideo={handleExportVideo} 
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
        onCopyKeyframeAsYaml={handleCopyKeyframeAsYaml}
        onPasteKeyframeFromYaml={handlePasteKeyframeFromYaml}
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
        easingMode={easingMode}
        onToggleEasingMode={() => setEasingMode(p => p === 'arrival' ? 'departure' : 'arrival')}
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