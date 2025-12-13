

import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cube, 
  FilmStrip, 
  Faders, 
  SquaresFour, 
  Plus, 
  Trash,
  Image as ImageIcon,
  VideoCamera,
  Monitor,
  Sparkle,
  PaintBrush,
  ToggleLeft,
  CaretDown,
  Export,
  Camera as CameraIcon,
  MusicNotes,
  SpeakerHigh,
  Palette,
  Diamond,
  Cylinder,
  Eye
} from '@phosphor-icons/react';
import gsap from 'gsap';

import { DesignSystem } from './theme';
import { Engine, SceneObject, GlobalSettings, TransitionEffect, TimelineKeyframe } from './engine';
import { Window } from './components/Core/Window';
import { Button, Input, Slider, Toggle, Divider, Group, Select } from './components/Core/Primitives';
import { TimelineSequencer } from './components/Section/Timeline';

import './index.css';

const defaultTransition: TransitionEffect = {
  type: 'none', 
  duration: 0.5,
  delay: 0,
  fade: true,
  scale: 0.8,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  easing: 'power2.out',
};

const ACCENT_COLORS = ['#FF4F1F', '#BEF264', '#5865F2'];

const EASING_OPTIONS = [
  { label: 'Default (Ease Out)', value: 'power2.out' },
  { label: 'Linear', value: 'none' },
  { label: 'Ease In', value: 'power2.in' },
  { label: 'Ease In-Out', value: 'power2.inOut' },
  { label: 'Bounce Out', value: 'bounce.out' },
  { label: 'Elastic Out', value: 'elastic.out(1, 0.75)' },
  { label: 'Anticipate (Back In)', value: 'back.in(1.7)' },
  { label: 'Overshoot (Back Out)', value: 'back.out(1.7)' },
];

const materialPresets: { [key: string]: Partial<SceneObject> } = {
    'default': { metalness: 0.2, roughness: 0.1, transmission: 0, ior: 1.5, thickness: 0.5, clearcoat: 0, clearcoatRoughness: 0, opacity: 1 },
    'clay': { metalness: 0, roughness: 1.0, transmission: 0, clearcoat: 0, ior: 1.4, opacity: 1 },
    'glass': { metalness: 0, roughness: 0.02, transmission: 1.0, ior: 1.5, thickness: 1.2, clearcoat: 1.0, clearcoatRoughness: 0.05, opacity: 1 },
    'frostedGlass': { metalness: 0, roughness: 0.45, transmission: 1.0, ior: 1.5, thickness: 1.2, clearcoat: 0.1, clearcoatRoughness: 0.1, opacity: 1 },
    'metal': { metalness: 1.0, roughness: 0.1, transmission: 0, clearcoat: 0.5, clearcoatRoughness: 0.1, ior: 2.5, opacity: 1 },
    'chrome': { metalness: 1.0, roughness: 0.0, transmission: 0, clearcoat: 1.0, clearcoatRoughness: 0.0, ior: 2.5, opacity: 1 },
    'plastic': { metalness: 0.1, roughness: 0.5, transmission: 0, clearcoat: 0.5, clearcoatRoughness: 0.1, ior: 1.5, opacity: 1 },
    'water': { metalness: 0.1, roughness: 0.1, transmission: 0.9, ior: 1.33, thickness: 1.0, clearcoat: 1.0, clearcoatRoughness: 0, opacity: 1 },
};

const PropSlider = ({ label, value, onChange, isMode, ...props }: any) => {
    return (
        <div style={{ position: 'relative', padding: isMode ? '4px' : '0', border: isMode ? `1px dashed ${DesignSystem.Color.Feedback.Warning}` : 'none', borderRadius: '8px', margin: isMode ? '-4px' : '0' }}>
             <Slider 
                  label={label} 
                  value={value} 
                  onChange={onChange} 
                  {...props} 
             />
        </div>
    )
}

const App = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const dockConstraintsRef = useRef(null);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const prevTimeRef = useRef(0);

  // --- State ---
  const [accentColor, setAccentColor] = useState(DesignSystem.Color.Accent.Surface[1] as string); // Using DesignSystem for default
  const [objects, setObjects] = useState<SceneObject[]>([
    {
      id: 'camera-main',
      type: 'camera',
      position: [0, 0, 6],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      startTime: 0,
      duration: 300,
      animations: [],
      introTransition: { ...defaultTransition },
      outroTransition: { ...defaultTransition },
      fov: 60
    },
    { 
      id: '1', 
      type: 'mesh', 
      position: [0, 0, 0], 
      rotation: [0, 0, 0], 
      scale: [1, 1, 1], 
      color: '#ffffff',
      metalness: 0.2,
      roughness: 0.1,
      opacity: 1,
      transmission: 0, ior: 1.5, thickness: 0.5, clearcoat: 0, clearcoatRoughness: 0,
      startTime: 0,
      duration: 5,
      animations: [],
      introTransition: { ...defaultTransition },
      outroTransition: { ...defaultTransition },
    }
  ]);
  const [selectedId, setSelectedId] = useState<string | null>('1');
  
  // Selected Keyframe State: { objectId, keyframeIndex }
  const [selectedKeyframe, setSelectedKeyframe] = useState<{ id: string, index: number } | null>(null);

  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
      backgroundColor: '#000000',
      bloom: { enabled: false, strength: 0.2, threshold: 0.85, radius: 0.5 },
      vignette: { enabled: false, offset: 1.0, darkness: 1.0 },
      accentColor: DesignSystem.Color.Accent.Surface[1] as string, // Using DesignSystem for default
      showGrid: true,
  });
  
  // Timeline State
  const [totalDuration, setTotalDuration] = useState(10); // in seconds
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);

  // Window Visibility States
  const [showAssets, setShowAssets] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showProperties, setShowProperties] = useState(true);

  // --- Effects ---
  // Theme Update
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-surface', accentColor);
    document.documentElement.style.setProperty('--accent-surface-dim', adjustColor(accentColor, -40));
    document.documentElement.style.setProperty('--accent-glow', `${accentColor}66`); // 40% opacity
    setGlobalSettings(prev => ({ ...prev, accentColor }));
  }, [accentColor]);

  // Engine Init & Sync
  useEffect(() => {
    if (containerRef.current && !engineRef.current) {
      engineRef.current = new Engine(containerRef.current, (id) => {
        setSelectedId(id);
        if (id) setShowProperties(true);
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
    if (engineRef.current) engineRef.current.updatePostProcessing(globalSettings);
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

  // --- Actions ---
  const handleTogglePlay = () => {
      engineRef.current?.resumeAudioContext();
      setIsPlaying(!isPlaying);
  };
    
  const handleAddObject = (type: SceneObject['type'], url?: string, width?: number, height?: number) => {
    const defaultName = type === 'mesh' ? 'Cube' : type === 'camera' ? 'Camera' : type === 'audio' ? 'Audio' : type === 'video' ? 'Video' : type === 'glb' ? 'Model' : 'Object';
    
    const newObj: SceneObject = {
      id: uuidv4(), type,
      name: defaultName,
      position: [(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0],
      rotation: [0, 0, 0], scale: [1, 1, 1], url,
      width, height,
      color: type === 'mesh' ? accentColor : undefined,
      ...materialPresets.default,
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
      if (o.type === 'mesh') {
        newValues.metalness = o.metalness;
        newValues.roughness = o.roughness;
        newValues.transmission = o.transmission;
        newValues.ior = o.ior;
        newValues.thickness = o.thickness;
        newValues.clearcoat = o.clearcoat;
        newValues.clearcoatRoughness = o.clearcoatRoughness;
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
  
  const handlePresetChange = (presetKey: string) => {
    if (!selectedId || !materialPresets[presetKey]) return;
    handleUpdateObject(selectedId, materialPresets[presetKey]);
  };

  const handleExportVideo = () => {
      alert("Video Export initiated... (Simulation)");
  };

  const selectedObject = objects.find(o => o.id === selectedId);

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) processFile(e.target.files[0]); };
  
  const processFile = (file: File) => {
      const url = URL.createObjectURL(file);
      const type = file.type;
      const name = file.name.toLowerCase();
      
      if (type.startsWith('image/') || name.endsWith('.svg')) {
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

  const adjustColor = (color: string, amount: number) => {
      return '#' + color.replace(/^#/, '').match(/.{1,2}/g)!.map(c => Math.max(0, Math.min(255, parseInt(c, 16) + amount)).toString(16).padStart(2, '0')).join('');
  }
  
  // --- Prop Control Helpers ---

  const getInterpolatedValueAtTime = (objData: SceneObject, property: string, localTime: number) => {
    const baseValue = objData[property as keyof SceneObject];
    if (!objData.animations || objData.animations.length === 0) return baseValue;

    const keyframes = [...objData.animations];
    const baseState: TimelineKeyframe['values'] = {
        position: objData.position, rotation: objData.rotation, scale: objData.scale,
        metalness: objData.metalness, roughness: objData.roughness, opacity: objData.opacity, volume: objData.volume,
        curvature: objData.curvature, transmission: objData.transmission, ior: objData.ior, thickness: objData.thickness,
        clearcoat: objData.clearcoat, clearcoatRoughness: objData.clearcoatRoughness,
    };
    const baseKeyframe: TimelineKeyframe = { time: 0, values: {}, easing: 'power2.out' };

    let kf1 = baseKeyframe;
    let kf2: TimelineKeyframe | null = null;
    for (const kf of keyframes) {
        if (kf.time <= localTime) kf1 = kf;
        else { kf2 = kf; break; }
    }
    if (!kf2) kf2 = kf1;

    const kf1Values = { ...baseState, ...kf1.values };
    const kf2Values = { ...baseState, ...kf2.values };
    
    const startVal = kf1Values[property as keyof typeof kf1Values];
    const endVal = kf2Values[property as keyof typeof kf2Values];

    if (startVal === undefined || endVal === undefined) return baseValue;

    const duration = kf2.time - kf1.time;
    const progress = duration > 0 ? (localTime - kf1.time) / duration : 1;
    const ease = gsap.parseEase(kf2.easing || 'power2.out');
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
    const value = getInterpolatedValueAtTime(selectedObject, property, localTime);
    if (axis !== undefined && Array.isArray(value)) return (value as any)[axis];
    return value;
  }

  const handleControlChange = (property: string, value: any, axis?: number) => {
    if (!selectedId) return;

    if (selectedKeyframe && selectedKeyframe.id === selectedId) {
        setObjects(prev => prev.map(o => {
            if (o.id !== selectedId) return o;
            
            const newAnims = [...o.animations];
            const kfToUpdate = newAnims[selectedKeyframe.index];
            if (!kfToUpdate) return o;

            let updatedValue = value;
            if (axis !== undefined) {
                const currentValue = (kfToUpdate.values[property as keyof typeof kfToUpdate.values] as [number, number, number]) || 
                                     (o[property as keyof SceneObject] as [number, number, number]) || 
                                     (property.includes('scale') ? [1, 1, 1] : [0, 0, 0]);
                const newTuple = [...currentValue] as [number, number, number];
                newTuple[axis] = value;
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
            let updatedValue = value;
            if (axis !== undefined) {
                const currentValue = (o[property as keyof SceneObject] as [number, number, number]) || (property.includes('scale') ? [1, 1, 1] : [0, 0, 0]);
                const newTuple = [...currentValue] as [number, number, number];
                newTuple[axis] = value;
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
  
  const getSelectedKeyframeEasing = () => {
    if (!selectedKeyframe || !selectedObject) return 'power2.out';
    const kf = selectedObject.animations[selectedKeyframe.index];
    return kf?.easing || 'power2.out';
  }

  return (
    <div ref={dockConstraintsRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: DesignSystem.Color.Base.Surface[1] }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', zIndex: 0 }} />

      <Window id="assets" title="ASSETS" isOpen={showAssets} onClose={() => setShowAssets(false)} width={300} height={420}>
         <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(3) }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DesignSystem.Space(2) }}>
                <Button onClick={() => handleAddObject('mesh')} style={{ flexDirection: 'column', height: '90px', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', background: DesignSystem.Color.Base.Surface[2], borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DesignSystem.Color.Accent.Surface[1] }}>
                        <Cube size={18} weight="fill" />
                    </div> <span style={DesignSystem.Type.Label.S}>Cube</span>
                </Button>
                <label style={{ display: 'contents' }}>
                    <input type="file" accept=".png,.jpg,.jpeg,.webp,.mp4,.svg,.wav,.mp3,.ogg,.glb,.gltf" hidden onChange={handleFileUpload} />
                    <Button as="div" style={{ flexDirection: 'column', height: '90px', gap: '8px' }}>
                        <div style={{ width: '32px', height: '32px', background: DesignSystem.Color.Base.Surface[2], borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                             <Plus size={18} />
                        </div> <span style={DesignSystem.Type.Label.S}>Import</span>
                    </Button>
                </label>
            </div>
            
            <Button onClick={handleExportVideo} variant="primary" style={{ width: '100%', gap: '8px' }}>
                <Export size={16} weight="bold" /> EXPORT VIDEO
            </Button>

            <Divider />
            <div style={{ flex: 1, border: `1px dashed ${DesignSystem.Color.Base.Border[2]}`, borderRadius: DesignSystem.Effect.Radius.M, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: DesignSystem.Color.Base.Content[3], background: 'rgba(255,255,255,0.01)', textAlign: 'center', padding: '12px' }}>
                <ImageIcon size={24} /> <span style={DesignSystem.Type.Label.S}>Drag PNG, JPG, MP4, WAV, GLB...</span>
            </div>
         </div>
      </Window>

      <Window id="props" title="CONTROLS" isOpen={showProperties} onClose={() => setShowProperties(false)} width={280}>
        {selectedObject ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(3) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: DesignSystem.Color.Base.Surface[2], padding: DesignSystem.Space(2), borderRadius: DesignSystem.Effect.Radius.M }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Accent.Content[2] }}>{selectedObject.name || (selectedObject.type === 'camera' ? 'MAIN CAMERA' : selectedObject.type)}</span>
                        <span style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[3] }}>#{selectedObject.id.slice(0,4)}</span>
                    </div>
                    {selectedKeyframe?.id === selectedObject.id && (
                        <div style={{ background: DesignSystem.Color.Feedback.Warning, color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold' }}>KEYFRAME EDIT</div>
                    )}
                </div>

                <AnimatePresence>
                {selectedKeyframe?.id === selectedId && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                       <Group title="KEYFRAME" icon={<Diamond weight="fill" />}>
                           <Select
                               label="EASING"
                               value={getSelectedKeyframeEasing()}
                               onChange={(e) => handleKeyframePropertyChange('easing', e.target.value)}
                           >
                              {EASING_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                           </Select>
                           <Button 
                                variant="secondary" 
                                onClick={handleRemoveKeyframe} 
                                style={{ width: '100%', color: DesignSystem.Color.Feedback.Error, borderColor: 'rgba(255, 68, 68, 0.2)' }}
                           >
                                <Trash size={14} weight="bold" /> REMOVE KEYFRAME
                           </Button>
                       </Group>
                    </motion.div>
                )}
                </AnimatePresence>
                
                <Group title="TRANSFORM">
                  <PropSlider 
                    label="POS X" 
                    value={getControlValue('position', 0)}
                    onChange={(v: number) => handleControlChange('position', v, 0)}
                    isMode={selectedKeyframe?.id === selectedId}
                    min={-10} max={10} step={0.1} 
                  />
                  <PropSlider 
                    label="POS Y" 
                    value={getControlValue('position', 1)}
                    onChange={(v: number) => handleControlChange('position', v, 1)}
                    isMode={selectedKeyframe?.id === selectedId}
                    min={-10} max={10} step={0.1} 
                  />
                  <PropSlider 
                    label="POS Z" 
                    value={getControlValue('position', 2)}
                    onChange={(v: number) => handleControlChange('position', v, 2)}
                    isMode={selectedKeyframe?.id === selectedId}
                    min={-10} max={10} step={0.1} 
                  />
                  
                  {selectedObject.type !== 'audio' && (
                    <>
                      <Divider />
                      <PropSlider 
                        label="ROT X" 
                        value={getControlValue('rotation', 0)}
                        onChange={(v: number) => handleControlChange('rotation', v, 0)}
                        isMode={selectedKeyframe?.id === selectedId}
                        min={-180} max={180} step={1} 
                      />
                      <PropSlider 
                        label="ROT Y" 
                        value={getControlValue('rotation', 1)}
                        onChange={(v: number) => handleControlChange('rotation', v, 1)}
                        isMode={selectedKeyframe?.id === selectedId}
                        min={-180} max={180} step={1} 
                      />
                      <PropSlider 
                        label="ROT Z" 
                        value={getControlValue('rotation', 2)}
                        onChange={(v: number) => handleControlChange('rotation', v, 2)}
                        isMode={selectedKeyframe?.id === selectedId}
                        min={-180} max={180} step={1} 
                      />
                    </>
                  )}

                  {selectedObject.type !== 'camera' && selectedObject.type !== 'audio' && (
                    <>
                      <Divider />
                      <PropSlider 
                        label="SCALE X" 
                        value={getControlValue('scale', 0)}
                        onChange={(v: number) => handleControlChange('scale', v, 0)}
                        isMode={selectedKeyframe?.id === selectedId}
                        min={0} max={5} step={0.05} 
                      />
                      <PropSlider 
                        label="SCALE Y" 
                        value={getControlValue('scale', 1)}
                        onChange={(v: number) => handleControlChange('scale', v, 1)}
                        isMode={selectedKeyframe?.id === selectedId}
                        min={0} max={5} step={0.05} 
                      />
                      <PropSlider 
                        label="SCALE Z" 
                        value={getControlValue('scale', 2)}
                        onChange={(v: number) => handleControlChange('scale', v, 2)}
                        isMode={selectedKeyframe?.id === selectedId}
                        min={0} max={5} step={0.05} 
                      />
                    </>
                  )}
                  
                  {selectedObject.type === 'camera' && (
                     <div style={{ marginTop: '8px' }}>
                        <Slider label="FOV" value={selectedObject.fov || 60} min={10} max={120} step={1} onChange={(v) => handleUpdateObject(selectedObject.id, { fov: v })} />
                     </div>
                  )}
                </Group>
                
                {selectedObject.type !== 'camera' && selectedObject.type !== 'audio' && (
                  <Group title="APPEARANCE" icon={<Eye weight="fill"/>}>
                      <PropSlider 
                        label="OPACITY" 
                        value={getControlValue('opacity')}
                        onChange={(v: number) => handleControlChange('opacity', v)}
                        isMode={selectedKeyframe?.id === selectedId}
                        min={0} max={1} step={0.01} 
                      />
                  </Group>
                )}
                
                {selectedObject.type === 'mesh' && (
                    <Group title="MATERIAL" icon={<Palette />}>
                       <Select label="PRESET" onChange={e => handlePresetChange(e.target.value)} value="">
                          <option value="" disabled>Select a Preset...</option>
                          {Object.entries(materialPresets).map(([key, value]) => (
                            <option key={key} value={key}>{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim()}</option>
                          ))}
                       </Select>

                       <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                           <label style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[2] }}>COLOR</label>
                           <div style={{ display: 'flex', gap: DesignSystem.Space(2), alignItems: 'center' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${DesignSystem.Color.Base.Border[2]}`, flexShrink: 0 }}>
                                    <input 
                                        type="color" 
                                        value={getControlValue('color')} 
                                        onChange={(e) => handleControlChange('color', e.target.value)} 
                                        style={{ width: '150%', height: '150%', margin: '-25%', padding: 0, border: 'none', cursor: 'pointer' }} 
                                    />
                                </div>
                                <Input type="text" value={getControlValue('color')} onChange={(e) => handleControlChange('color', e.target.value)} style={{ flex: 1 }} />
                           </div>
                       </div>
                      <PropSlider 
                        label="METALNESS" 
                        value={getControlValue('metalness')}
                        onChange={(v: number) => handleControlChange('metalness', v)}
                        isMode={selectedKeyframe?.id === selectedId}
                        min={0} max={1} step={0.01} 
                      />
                      <PropSlider 
                        label="ROUGHNESS" 
                        value={getControlValue('roughness')}
                        onChange={(v: number) => handleControlChange('roughness', v)}
                        isMode={selectedKeyframe?.id === selectedId}
                        min={0} max={1} step={0.01} 
                      />
                      <Divider />
                      <PropSlider label="TRANSMISSION" value={getControlValue('transmission')} onChange={v => handleControlChange('transmission', v)} min={0} max={1} step={0.01} isMode={selectedKeyframe?.id === selectedId} />
                      <AnimatePresence>
                      {getControlValue('transmission') > 0 && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(3) }}>
                            <PropSlider label="IOR" value={getControlValue('ior')} onChange={v => handleControlChange('ior', v)} min={1} max={2.5} step={0.01} isMode={selectedKeyframe?.id === selectedId} />
                            <PropSlider label="THICKNESS" value={getControlValue('thickness')} onChange={v => handleControlChange('thickness', v)} min={0} max={5} step={0.1} isMode={selectedKeyframe?.id === selectedId} />
                        </motion.div>
                      )}
                      </AnimatePresence>
                      <Divider />
                      <PropSlider label="CLEARCOAT" value={getControlValue('clearcoat')} onChange={v => handleControlChange('clearcoat', v)} min={0} max={1} step={0.01} isMode={selectedKeyframe?.id === selectedId} />
                      <AnimatePresence>
                      {getControlValue('clearcoat') > 0 && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                            <PropSlider label="ROUGHNESS" value={getControlValue('clearcoatRoughness')} onChange={v => handleControlChange('clearcoatRoughness', v)} min={0} max={1} step={0.01} isMode={selectedKeyframe?.id === selectedId} />
                          </motion.div>
                      )}
                      </AnimatePresence>
                    </Group>
                )}

                {(selectedObject.type === 'audio' || selectedObject.type === 'video') && (
                    <Group title="AUDIO" icon={<SpeakerHigh />}>
                        <PropSlider 
                            label="VOLUME" 
                            value={getControlValue('volume')}
                            onChange={(v: number) => handleControlChange('volume', v)}
                            isMode={selectedKeyframe?.id === selectedId}
                            min={0} max={1} step={0.05} 
                        />
                    </Group>
                )}

                {(selectedObject.type === 'video' || selectedObject.type === 'plane') && (
                    <Group title="DISTORTION" icon={<Cylinder />}>
                        <PropSlider 
                            label="CYLINDER WRAP" 
                            value={getControlValue('curvature')}
                            onChange={(v: number) => handleControlChange('curvature', v)}
                            isMode={selectedKeyframe?.id === selectedId}
                            min={-0.5} max={0.5} step={0.01} 
                        />
                    </Group>
                )}

                {selectedObject.type === 'video' && (
                    <Group title="PLAYBACK" icon={<FilmStrip />}>
                        <Toggle label="LOOP" value={selectedObject.loop ?? true} onChange={(v) => handleUpdateObject(selectedObject.id, { loop: v })} />
                        <div style={{ ...DesignSystem.Type.Label.S, fontSize: '10px', color: DesignSystem.Color.Base.Content[3], padding: '4px', textAlign: 'center', background: DesignSystem.Color.Base.Surface[2], borderRadius: DesignSystem.Effect.Radius.S }}>
                            Playback is controlled by the main timeline. Audio requires user interaction to start.
                        </div>
                    </Group>
                )}

                {(selectedObject.type === 'video' || selectedObject.type === 'plane') && (
                    <Group title="EFFECTS">
                      {selectedObject.type === 'video' && <div style={{ padding: DesignSystem.Space(2), background: 'rgba(91, 80, 255, 0.05)', borderRadius: DesignSystem.Effect.Radius.S, ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Accent.Surface[1], display: 'flex', alignItems: 'center', gap: '6px' }}><VideoCamera weight="fill" /> Video Active</div>}
                      <Toggle label="CHROMA KEY" value={selectedObject.chromaKey?.enabled || false} onChange={(v) => {
                          const currentChromaKey = selectedObject.chromaKey || { enabled: false, color: '#00ff00', similarity: 0.1, smoothness: 0.1 };
                          handleUpdateObject(selectedObject.id, { chromaKey: { ...currentChromaKey, enabled: v } });
                      }} />
                      <AnimatePresence>
                        {selectedObject.chromaKey?.enabled && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(2), overflow: 'hidden' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[2] }}>KEY COLOR</label>
                                    <div style={{ display: 'flex', gap: DesignSystem.Space(2), alignItems: 'center' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${DesignSystem.Color.Base.Border[2]}`, flexShrink: 0 }}>
                                                <input 
                                                    type="color" 
                                                    value={selectedObject.chromaKey.color} 
                                                    onChange={(e) => handleUpdateObject(selectedObject.id, { chromaKey: { ...selectedObject.chromaKey!, color: e.target.value } })}
                                                    style={{ width: '150%', height: '150%', margin: '-25%', padding: 0, border: 'none', cursor: 'pointer' }} 
                                                />
                                            </div>
                                            <Input type="text" value={selectedObject.chromaKey.color} onChange={(e) => handleUpdateObject(selectedObject.id, { chromaKey: { ...selectedObject.chromaKey!, color: e.target.value } })} style={{ flex: 1 }} />
                                    </div>
                                </div>
                                <Slider label="THRESHOLD" value={selectedObject.chromaKey.similarity} min={0} max={1} step={0.01} onChange={(v) => handleUpdateObject(selectedObject.id, { chromaKey: { ...selectedObject.chromaKey!, similarity: v } })} />
                                <Slider label="SMOOTH" value={selectedObject.chromaKey.smoothness} min={0} max={1} step={0.01} onChange={(v) => handleUpdateObject(selectedObject.id, { chromaKey: { ...selectedObject.chromaKey!, smoothness: v } })} />
                            </motion.div>
                        )}
                      </AnimatePresence>
                    </Group>
                )}
                
                {selectedObject.type !== 'camera' && (
                  <Group title="TRANSITIONS" icon={<ToggleLeft weight="fill"/>}>
                      <TransitionControls title="INTRO" transition={selectedObject.introTransition} onUpdate={(t) => handleUpdateObject(selectedObject.id, { introTransition: t })} />
                      <Divider />
                      <TransitionControls title="OUTRO" transition={selectedObject.outroTransition} onUpdate={(t) => handleUpdateObject(selectedObject.id, { outroTransition: t })} />
                  </Group>
                )}
                
                <Divider />
                <Button variant="ghost" onClick={() => handleRemoveObject(selectedObject.id)} disabled={selectedObject.type === 'camera'} style={{ color: selectedObject.type === 'camera' ? DesignSystem.Color.Base.Content[3] : DesignSystem.Color.Feedback.Error, width: '100%', opacity: selectedObject.type === 'camera' ? 0.5 : 0.7 }}>
                    <Trash size={16} weight="bold" /> {selectedObject.type === 'camera' ? 'LOCKED' : 'DELETE'}
                </Button>
            </div>
        ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(4) }}>
                <Group title="SCENE" icon={<PaintBrush weight="fill"/>}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[2] }}>BACKGROUND</label>
                        <div style={{ display: 'flex', gap: DesignSystem.Space(2), alignItems: 'center' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${DesignSystem.Color.Base.Border[2]}`, flexShrink: 0 }}>
                                <input 
                                    type="color" 
                                    value={globalSettings.backgroundColor} 
                                    onChange={(e) => setGlobalSettings(g => ({ ...g, backgroundColor: e.target.value }))}
                                    style={{ width: '150%', height: '150%', margin: '-25%', padding: 0, border: 'none', cursor: 'pointer' }} 
                                />
                            </div>
                            <Input type="text" value={globalSettings.backgroundColor} onChange={(e) => setGlobalSettings(g => ({ ...g, backgroundColor: e.target.value }))} style={{ flex: 1 }} />
                        </div>
                    </div>
                    
                    <Toggle label="SHOW GRID" value={globalSettings.showGrid} onChange={(v) => setGlobalSettings(g => ({ ...g, showGrid: v }))} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={DesignSystem.Type.Label.S}>ACCENT COLOR</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                             <div style={{ position: 'relative', width: '100%' }}>
                                <select 
                                    value={accentColor} 
                                    onChange={(e) => setAccentColor(e.target.value)} 
                                    style={{ 
                                        appearance: 'none', 
                                        width: '100%', 
                                        background: DesignSystem.Color.Base.Surface[3], 
                                        border: 'none', 
                                        padding: '8px 12px', 
                                        color: DesignSystem.Color.Base.Content[1],
                                        borderRadius: DesignSystem.Effect.Radius.S,
                                        fontFamily: DesignSystem.Type.Label.S.fontFamily,
                                        fontSize: '12px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {ACCENT_COLORS.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', gap: '4px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: accentColor }} />
                                    <CaretDown size={14} color={DesignSystem.Color.Base.Content[3]} />
                                </div>
                             </div>
                        </div>
                    </div>
                </Group>
                <Group title="EFFECTS" icon={<Sparkle weight="fill"/>}>
                    <Toggle label="BLOOM" value={globalSettings.bloom.enabled} onChange={(v) => setGlobalSettings(g => ({ ...g, bloom: { ...g.bloom, enabled: v } }))} />
                     <AnimatePresence>
                        {globalSettings.bloom.enabled && (
                             <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(2), overflow: 'hidden', marginTop: DesignSystem.Space(2) }}>
                                 <Slider label="STRENGTH" value={globalSettings.bloom.strength} min={0} max={2} step={0.01} onChange={v => setGlobalSettings(g => ({ ...g, bloom: { ...g.bloom, strength: v } }))}/>
                                 <Slider label="THRESHOLD" value={globalSettings.bloom.threshold} min={0} max={1} step={0.01} onChange={v => setGlobalSettings(g => ({ ...g, bloom: { ...g.bloom, threshold: v } }))}/>
                                 <Slider label="RADIUS" value={globalSettings.bloom.radius} min={0} max={2} step={0.01} onChange={v => setGlobalSettings(g => ({ ...g, bloom: { ...g.bloom, radius: v } }))}/>
                            </motion.div>
                        )}
                     </AnimatePresence>
                     <Divider />
                     <Toggle label="VIGNETTE" value={globalSettings.vignette.enabled} onChange={(v) => setGlobalSettings(g => ({ ...g, vignette: { ...g.vignette, enabled: v } }))} />
                     <AnimatePresence>
                        {globalSettings.vignette.enabled && (
                             <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(2), overflow: 'hidden', marginTop: DesignSystem.Space(2) }}>
                                <Slider label="OFFSET" value={globalSettings.vignette.offset} min={0} max={2} step={0.01} onChange={v => setGlobalSettings(g => ({ ...g, vignette: { ...g.vignette, offset: v } }))}/>
                                <Slider label="DARKNESS" value={globalSettings.vignette.darkness} min={0} max={2} step={0.01} onChange={v => setGlobalSettings(g => ({ ...g, vignette: { ...g.vignette, darkness: v } }))}/>
                            </motion.div>
                        )}
                     </AnimatePresence>
                </Group>
            </div>
        )}
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
          />
      </Window>

      <motion.div drag dragMomentum={false} dragConstraints={containerRef} initial={{ y: 0, x: '-50%' }} style={{ position: 'absolute', bottom: '40px', left: '50%', height: '72px', background: DesignSystem.Color.Base.Surface['3b'], backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', borderRadius: '999px', border: `1px solid ${DesignSystem.Color.Base.Border[2]}`, padding: '0 24px', display: 'flex', alignItems: 'center', gap: '24px', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.6)', zIndex: 200, touchAction: 'none' }} whileTap={{ cursor: 'grabbing' }}>
         <div style={{ position: 'absolute', top: '-10px', left: '0', right: '0', height: '20px', display: 'flex', justifyContent: 'center' }}>
             <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
         </div>
         <DockItem icon={<SquaresFour weight="fill" />} label="ASSETS" isActive={showAssets} onClick={() => setShowAssets(!showAssets)} />
         <DockItem icon={<FilmStrip weight="fill" />} label="TIMELINE" isActive={showTimeline} onClick={() => setShowTimeline(!showTimeline)} />
         <DockItem icon={<Faders weight="fill" />} label="PROPS" isActive={showProperties} onClick={() => setShowProperties(!showProperties)} />
      </motion.div>
    </div>
  );
};

const TransitionControls: React.FC<{
    title: string;
    transition: TransitionEffect;
    onUpdate: (t: TransitionEffect) => void;
}> = ({ title, transition, onUpdate }) => {
    const isEnabled = transition.type === 'custom';
    const [isOpen, setIsOpen] = useState(isEnabled);
    
    useEffect(() => {
        if (isEnabled && !isOpen) setIsOpen(true);
    }, [isEnabled]);

    const update = (key: keyof TransitionEffect, value: any) => onUpdate({ ...transition, [key]: value });
    const updateVec3 = (key: 'position' | 'rotation', index: number, value: number) => {
        const vec = [...transition[key]] as [number, number, number];
        vec[index] = value;
        onUpdate({ ...transition, [key]: vec });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(2), background: isEnabled ? DesignSystem.Color.Base.Surface[2] : 'transparent', borderRadius: DesignSystem.Effect.Radius.S, padding: isEnabled ? '8px' : '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `0 ${DesignSystem.Space(1)}` }}>
                <Toggle 
                    label={title} 
                    value={isEnabled} 
                    onChange={(v) => onUpdate({ ...transition, type: v ? 'custom' : 'none' })} 
                />
                 {isEnabled && (
                    <motion.div 
                        onClick={() => setIsOpen(!isOpen)}
                        animate={{ rotate: isOpen ? 0 : -90 }}
                        style={{ cursor: 'pointer', color: DesignSystem.Color.Base.Content[3] }}
                    >
                        <CaretDown size={14} weight="bold" />
                    </motion.div>
                )}
            </div>
            <AnimatePresence>
                {isEnabled && isOpen && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(3), overflow: 'hidden', paddingTop: '4px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DesignSystem.Space(2) }}>
                            <Input label="DELAY" type="number" step="0.1" min="0" value={transition.delay} onChange={e => update('delay', parseFloat(e.target.value))} />
                            <Input label="DURATION" type="number" step="0.1" min="0.1" value={transition.duration} onChange={e => update('duration', parseFloat(e.target.value))} />
                        </div>
                        <Select label="EASING" value={transition.easing} onChange={e => update('easing', e.target.value)}>
                            <option value="power2.out">Default</option>
                            <option value="back.in(1.7)">Pre-Bounce</option>
                            <option value="back.out(1.7)">Post-Bounce</option>
                            <option value="elastic.out(1, 0.75)">Elastic</option>
                            <option value="power2.in">Ease In</option>
                        </Select>
                        <Divider />
                        <Toggle label="FADE" value={transition.fade} onChange={v => update('fade', v)} />
                        <Slider label="SCALE" value={transition.scale} min={0} max={2} step={0.1} onChange={v => update('scale', v)} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: DesignSystem.Space(2) }}>
                            <Input label="POS X" type="number" step="0.1" value={transition.position[0]} onChange={e => updateVec3('position', 0, parseFloat(e.target.value))} />
                            <Input label="POS Y" type="number" step="0.1" value={transition.position[1]} onChange={e => updateVec3('position', 1, parseFloat(e.target.value))} />
                            <Input label="POS Z" type="number" step="0.1" value={transition.position[2]} onChange={e => updateVec3('position', 2, parseFloat(e.target.value))} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: DesignSystem.Space(2) }}>
                            <Input label="ROT X" type="number" step="1" value={transition.rotation[0]} onChange={e => updateVec3('rotation', 0, parseFloat(e.target.value))} />
                            <Input label="ROT Y" type="number" step="1" value={transition.rotation[1]} onChange={e => updateVec3('rotation', 1, parseFloat(e.target.value))} />
                            <Input label="ROT Z" type="number" step="1" value={transition.rotation[2]} onChange={e => updateVec3('rotation', 2, parseFloat(e.target.value))} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const DockItem = ({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) => (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <motion.button onClick={onClick} whileHover={{ scale: 1.1, y: -4 }} whileTap={{ scale: 0.96 }} style={{ width: '44px', height: '44px', borderRadius: '14px', border: isActive ? `1px solid ${DesignSystem.Color.Accent.Surface[1]}` : `1px solid transparent`, background: 'rgba(255,255,255,0.03)', color: isActive ? DesignSystem.Color.Accent.Content[1] : DesignSystem.Color.Base.Content[2], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer', boxShadow: isActive ? `0 0 24px ${DesignSystem.Color.Accent.Surface[1]}` : 'none', transition: 'border 0.2s, background 0.2s, box-shadow 0.2s' }}>
            {icon}
        </motion.button>
        {isActive && ( <motion.div layoutId="active-dot" style={{ position: 'absolute', bottom: '-8px', width: '3px', height: '3px', borderRadius: '50%', background: DesignSystem.Color.Accent.Surface[1], boxShadow: `0 0 8px ${DesignSystem.Color.Accent.Surface[1]}` }} /> )}
    </div>
);

const root = createRoot(document.getElementById('root')!);
root.render(<App />);