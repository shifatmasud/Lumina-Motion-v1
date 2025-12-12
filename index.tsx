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
  Diamond
} from '@phosphor-icons/react';
import gsap from 'gsap';

import { DesignSystem } from './theme';
import { Engine, SceneObject, AnimationTrack, GlobalSettings, TransitionEffect, Keyframe } from './engine';
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


const App = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const dockConstraintsRef = useRef(null);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>();

  // --- State ---
  const [accentColor, setAccentColor] = useState(ACCENT_COLORS[2]);
  const [objects, setObjects] = useState<SceneObject[]>([
    {
      id: 'camera-main',
      type: 'camera',
      position: [4, 3, 6],
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
      startTime: 0,
      duration: 5,
      animations: [],
      introTransition: { ...defaultTransition },
      outroTransition: { ...defaultTransition },
    }
  ]);
  const [selectedId, setSelectedId] = useState<string | null>('1');
  
  // Selected Keyframe State: { objectId, propertyName, keyframeIndex }
  const [selectedKeyframe, setSelectedKeyframe] = useState<{ id: string, property: string, index: number } | null>(null);

  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
      backgroundColor: '#000000',
      bloom: { enabled: false, strength: 0.2, threshold: 0.85, radius: 0.5 },
      vignette: { enabled: false, offset: 1.0, darkness: 1.0 },
      accentColor: ACCENT_COLORS[2]
  });
  
  // Timeline State
  const [totalDuration, setTotalDuration] = useState(10); // in seconds
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

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
    if (engineRef.current) engineRef.current.setTime(currentTime, objects);
  }, [currentTime, objects]);

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
  const handleAddObject = (type: SceneObject['type'], url?: string, width?: number, height?: number) => {
    const newObj: SceneObject = {
      id: uuidv4(), type,
      position: [(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0],
      rotation: [0, 0, 0], scale: [1, 1, 1], url,
      width, height,
      color: type === 'mesh' ? accentColor : undefined,
      metalness: type === 'mesh' ? 0.2 : undefined,
      roughness: type === 'mesh' ? 0.1 : undefined,
      opacity: 1.0,
      volume: type === 'audio' ? 1.0 : undefined,
      chromaKey: type === 'video' ? { enabled: false, color: '#00ff00', similarity: 0.1, smoothness: 0.1 } : undefined,
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
      const time = Math.max(0, currentTime - o.startTime);

      // Smart Keyframing: Detect properties based on type
      const keyableProps: { property: string, value: any }[] = [
        { property: 'position', value: [...o.position] },
        { property: 'rotation', value: [...o.rotation] },
      ];

      if (o.type !== 'camera') {
        keyableProps.push({ property: 'scale', value: [...o.scale] });
      }

      if (o.type === 'mesh') {
        keyableProps.push({ property: 'metalness', value: o.metalness ?? 0.2 });
        keyableProps.push({ property: 'roughness', value: o.roughness ?? 0.1 });
      }
      
      if (o.type === 'audio') {
         keyableProps.push({ property: 'volume', value: o.volume ?? 1.0 });
      }

      keyableProps.forEach(({ property, value }) => {
        let track = newAnimations.find(t => t.property === property);
        if (!track) {
          track = { property, keyframes: [] };
          newAnimations.push(track);
        }
        // Remove existing keyframe at same time (tolerance 0.01s)
        const existingIndex = track.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.01);
        if (existingIndex !== -1) {
             track.keyframes[existingIndex].value = value;
        } else {
             track.keyframes.push({ time, value, easing: 'power2.out' });
        }
        track.keyframes.sort((a, b) => a.time - b.time);
      });
      return { ...o, animations: newAnimations };
    }));
  };
  
  const handleRemoveKeyframe = () => {
      if (!selectedKeyframe) return;
      setObjects(prev => prev.map(o => {
          if (o.id !== selectedKeyframe.id) return o;
          const newAnims = o.animations.map(track => {
              if (track.property !== selectedKeyframe.property) return track;
              return { ...track, keyframes: track.keyframes.filter((_, i) => i !== selectedKeyframe.index) };
          });
          return { ...o, animations: newAnims };
      }));
      setSelectedKeyframe(null);
  };
  
  const handleSelectKeyframe = (id: string, property: string, index: number) => {
    if (selectedKeyframe?.id === id && selectedKeyframe.property === property && selectedKeyframe.index === index) {
      setSelectedKeyframe(null); // Deselect if same keyframe is clicked
    } else {
      setSelectedId(id); // Ensure the correct object is selected
      setSelectedKeyframe({ id, property, index });
      setShowProperties(true);

      // Seek timeline to the keyframe's time for intuitive editing
      const obj = objects.find(o => o.id === id);
      const track = obj?.animations.find(t => t.property === property);
      const kf = track?.keyframes[index];
      if (obj && kf) {
          setCurrentTime(obj.startTime + kf.time);
      }
    }
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

  // Helper to dim hex color
  const adjustColor = (color: string, amount: number) => {
      return '#' + color.replace(/^#/, '').match(/.{1,2}/g)!.map(c => Math.max(0, Math.min(255, parseInt(c, 16) + amount)).toString(16).padStart(2, '0')).join('');
  }
  
  // --- Prop Control Helpers ---

  // Calculates the value of a property at a specific time, including animations.
  const getInterpolatedValueAtTime = (objData: SceneObject, property: string, localTime: number) => {
    const track = objData.animations?.find(t => t.property === property);
    const getBaseValue = (prop: string) => objData[prop as keyof SceneObject];

    if (!track || track.keyframes.length === 0) return getBaseValue(property);

    const keyframes = [...track.keyframes];
    if (keyframes[0].time > 0) {
        keyframes.unshift({ time: 0, value: getBaseValue(property), easing: keyframes[0].easing });
    }

    let kf1: Keyframe = keyframes[0];
    let kf2: Keyframe | null = null;
    
    for (const kf of keyframes) {
        if (kf.time <= localTime) kf1 = kf;
        else { kf2 = kf; break; }
    }

    if (!kf2 || kf1 === kf2) return kf1.value;

    const duration = kf2.time - kf1.time;
    const progress = duration > 0 ? (localTime - kf1.time) / duration : 1;
    const ease = gsap.parseEase(kf1.easing || 'power2.out');
    const easedProgress = ease(progress);

    return gsap.utils.interpolate(kf1.value, kf2.value, easedProgress);
  }
  
  const getControlValue = (property: string, axis?: number) => {
    if (!selectedObject) return axis !== undefined ? 0 : (property.includes('scale') ? 1 : 0);

    // If a keyframe is selected for this object, all controls should show the interpolated value at the current time.
    if (selectedKeyframe && selectedKeyframe.id === selectedObject.id) {
        const localTime = currentTime - selectedObject.startTime;
        const value = getInterpolatedValueAtTime(selectedObject, property, localTime);
        if (axis !== undefined && Array.isArray(value)) return (value as any)[axis];
        return value;
    }
    
    // Otherwise, show the base property value.
    const val = selectedObject[property as keyof SceneObject];
    if (axis !== undefined && Array.isArray(val)) return (val as any)[axis];
    return val;
  }

  const handleControlChange = (property: string, value: any, axis?: number) => {
    // If a keyframe is selected, all edits should create/update keyframes at that keyframe's time.
    if (selectedKeyframe && selectedId) {
        const selectedObjectForKf = objects.find(o => o.id === selectedKeyframe.id);
        const selectedTrackForKf = selectedObjectForKf?.animations.find(t => t.property === selectedKeyframe.property);
        const keyframeInstance = selectedTrackForKf?.keyframes[selectedKeyframe.index];

        if (!keyframeInstance) {
            console.error("In keyframe edit mode but couldn't find selected keyframe instance.");
            return;
        }

        const keyframeTargetTime = keyframeInstance.time;

        setObjects(prev => prev.map(o => {
            if (o.id !== selectedId) return o;

            const newAnimations = o.animations ? o.animations.map(a => ({ ...a, keyframes: [...a.keyframes] })) : [];
            let track = newAnimations.find(t => t.property === property);

            if (!track) {
                track = { property, keyframes: [] };
                newAnimations.push(track);
            }

            const existingKfIndex = track.keyframes.findIndex(kf => Math.abs(kf.time - keyframeTargetTime) < 0.001);

            if (existingKfIndex !== -1) {
                // Update an existing keyframe for the property being edited at the target time.
                const keyframeToUpdate = track.keyframes[existingKfIndex];
                let updatedValue = value;
                if (axis !== undefined && Array.isArray(keyframeToUpdate.value)) {
                    updatedValue = [...keyframeToUpdate.value];
                    updatedValue[axis] = value;
                }
                track.keyframes[existingKfIndex] = { ...keyframeToUpdate, value: updatedValue };
            } else {
                // Create a new keyframe. Use interpolated value as base for vectors.
                const baseValue = getInterpolatedValueAtTime(o, property, keyframeTargetTime);
                let updatedValue = value;
                if (axis !== undefined && Array.isArray(baseValue)) {
                    updatedValue = [...baseValue];
                    updatedValue[axis] = value;
                }
                track.keyframes.push({ time: keyframeTargetTime, value: updatedValue, easing: 'power2.out' });
                track.keyframes.sort((a, b) => a.time - b.time);
            }
            
            return { ...o, animations: newAnimations };
        }));
    } else if (selectedId) {
        // No keyframe selected, update the base property.
        setObjects(prev => prev.map(o => {
            if (o.id !== selectedId) return o;
            let updatedValue = value;
            if (axis !== undefined) {
                const currentValue = (o[property as keyof SceneObject] as any[]) || [];
                updatedValue = [...currentValue];
                updatedValue[axis] = value;
            }
            return { ...o, [property]: updatedValue };
        }));
    }
  };
  
  const handleKeyframePropertyChange = (property: keyof Keyframe, value: any) => {
    if (!selectedKeyframe || !selectedObject) return;

    setObjects(prev => prev.map(o => {
        if (o.id !== selectedId) return o;
        const newAnims = o.animations.map(track => {
            if (track.property !== selectedKeyframe.property) return track;
            
            const newKeyframes = [...track.keyframes];
            const currentKf = newKeyframes[selectedKeyframe.index];
            
            newKeyframes[selectedKeyframe.index] = { ...currentKf, [property]: value };
            
            return { ...track, keyframes: newKeyframes };
        });
        return { ...o, animations: newAnims };
    }));
  };
  
  const getSelectedKeyframeEasing = () => {
    if (!selectedKeyframe || !selectedObject) return 'power2.out';
    const track = selectedObject.animations.find(t => t.property === selectedKeyframe.property);
    const kf = track?.keyframes[selectedKeyframe.index];
    return kf?.easing || 'power2.out';
  }

  const PropSlider = ({ label, property, axis, ...props }: any) => {
      const isMode = selectedKeyframe?.id === selectedId;
      const val = getControlValue(property, axis);
      return (
          <div style={{ position: 'relative', padding: isMode ? '4px' : '0', border: isMode ? `1px dashed ${DesignSystem.Color.Feedback.Warning}` : 'none', borderRadius: '8px', margin: isMode ? '-4px' : '0' }}>
               <Slider 
                    label={label} 
                    value={val} 
                    onChange={(v) => handleControlChange(property, v, axis)} 
                    {...props} 
               />
          </div>
      )
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
                        <span style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Accent.Content[2] }}>{selectedObject.type === 'camera' ? 'MAIN CAMERA' : selectedObject.type}</span>
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
                  <PropSlider label="POS X" property="position" axis={0} min={-10} max={10} step={0.1} />
                  <PropSlider label="POS Y" property="position" axis={1} min={-10} max={10} step={0.1} />
                  <PropSlider label="POS Z" property="position" axis={2} min={-10} max={10} step={0.1} />
                  
                  {selectedObject.type !== 'audio' && (
                    <>
                      <Divider />
                      <PropSlider label="ROT X" property="rotation" axis={0} min={-180} max={180} step={1} />
                      <PropSlider label="ROT Y" property="rotation" axis={1} min={-180} max={180} step={1} />
                      <PropSlider label="ROT Z" property="rotation" axis={2} min={-180} max={180} step={1} />
                    </>
                  )}

                  {selectedObject.type !== 'camera' && selectedObject.type !== 'audio' && (
                    <>
                      <Divider />
                      <PropSlider label="SCALE X" property="scale" axis={0} min={0} max={5} step={0.05} />
                      <PropSlider label="SCALE Y" property="scale" axis={1} min={0} max={5} step={0.05} />
                      <PropSlider label="SCALE Z" property="scale" axis={2} min={0} max={5} step={0.05} />
                    </>
                  )}
                  
                  {selectedObject.type === 'camera' && (
                     <div style={{ marginTop: '8px' }}>
                        <Slider label="FOV" value={selectedObject.fov || 60} min={10} max={120} step={1} onChange={(v) => handleUpdateObject(selectedObject.id, { fov: v })} />
                     </div>
                  )}
                </Group>
                
                {selectedObject.type === 'mesh' && (
                    <Group title="MATERIAL" icon={<Palette />}>
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
                      <PropSlider label="METALNESS" property="metalness" min={0} max={1} step={0.01} />
                      <PropSlider label="ROUGHNESS" property="roughness" min={0} max={1} step={0.01} />
                    </Group>
                )}
                
                {selectedObject.type === 'audio' && (
                    <Group title="AUDIO" icon={<SpeakerHigh />}>
                        <PropSlider label="VOLUME" property="volume" min={0} max={2} step={0.1} />
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

      <Window id="timeline" title="SEQUENCER" isOpen={showTimeline} onClose={() => setShowTimeline(false)} width={800} height={280}>
          <TimelineSequencer 
            objects={objects} 
            setObjects={setObjects} 
            selectedId={selectedId} 
            onSelect={(id) => { setSelectedId(id); setShowProperties(true); }} 
            isPlaying={isPlaying} 
            onTogglePlay={() => setIsPlaying(!isPlaying)} 
            currentTime={currentTime} 
            setCurrentTime={setCurrentTime} 
            totalDuration={totalDuration} 
            onAddKeyframe={handleAddKeyframe} 
            selectedKeyframe={selectedKeyframe}
            onSelectKeyframe={handleSelectKeyframe}
            onRemoveKeyframe={handleRemoveKeyframe}
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
        <motion.button onClick={onClick} whileHover={{ scale: 1.1, y: -4 }} whileTap={{ scale: 0.96 }} style={{ width: '44px', height: '44px', borderRadius: '14px', border: isActive ? `1px solid ${DesignSystem.Color.Accent.Surface[1]}` : `1px solid transparent`, background: isActive ? 'rgba(91, 80, 255, 0.15)' : 'rgba(255,255,255,0.03)', color: isActive ? DesignSystem.Color.Accent.Content[1] : DesignSystem.Color.Base.Content[2], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer', boxShadow: isActive ? `0 0 24px ${DesignSystem.Color.Accent.Surface[1]}` : 'none', transition: 'border 0.2s, background 0.2s, box-shadow 0.2s' }}>
            {icon}
        </motion.button>
        {isActive && ( <motion.div layoutId="active-dot" style={{ position: 'absolute', bottom: '-8px', width: '3px', height: '3px', borderRadius: '50%', background: DesignSystem.Color.Accent.Surface[1], boxShadow: `0 0 8px ${DesignSystem.Color.Accent.Surface[1]}` }} /> )}
    </div>
);

const root = createRoot(document.getElementById('root')!);
root.render(<App />);