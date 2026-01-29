import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import yaml from 'js-yaml';
import JSZip from 'jszip';
import { SceneObject, TimelineKeyframe } from '../engine';
import { defaultTransition } from '../constants';
import { getFullKeyframeValuesAtTime, getInterpolatedValueAtTime } from '../utils/animation';
import { bakeScenePhysics, SimulationSettings } from '../utils/physics';

type SetObjectsFn = (updater: React.SetStateAction<SceneObject[]>, isDebounced?: boolean) => void;
type RequestManualPasteFn = (callback: (yaml: string) => void, title: string) => void;

// This hook encapsulates all state and logic related to scene objects and their properties.
export const useSceneObjects = (
    objects: SceneObject[],
    setObjects: SetObjectsFn,
    accentColor: string,
    setShowProperties: (show: boolean) => void,
    requestManualPaste: RequestManualPasteFn,
) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedKeyframe, setSelectedKeyframe] = useState<{ id: string, index: number } | null>(null);
    const [copiedKeyframeYaml, setCopiedKeyframeYaml] = useState<string | null>(null);
    const [isScaleLocked, setIsScaleLocked] = useState(false);
    const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);

    const selectedObject = objects.find(o => o.id === selectedId);

    // Dynamic Camera Duration effect
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
    }, [objects, setObjects]);
    
    // Handlers
    const handleAddObject = (type: SceneObject['type'], currentTime: number, url?: string, width?: number, height?: number) => {
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
          physics: { enabled: false, type: 'dynamic', mass: 1, friction: 0.3, restitution: 0.5, force: { preset: 'none', strength: 20 } },
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

    const handleAddKeyframe = (currentTime: number) => {
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

    const handleRemoveAllKeyframes = (trackId: string) => {
        setObjects(prev => prev.map(o => 
            o.id === trackId ? { ...o, animations: [] } : o
        ));
        if (selectedKeyframe?.id === trackId) {
            setSelectedKeyframe(null);
        }
    };
  
    const handleSelectKeyframe = (id: string, index: number, setCurrentTime: (time: number) => void) => {
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
        const keyframeToCopy = { time: kf.time, name: kf.name, easing: kf.easing, values: fullValues };
        const cleanedKeyframeToCopy = JSON.parse(JSON.stringify(keyframeToCopy));

        try {
            const yamlString = yaml.dump(cleanedKeyframeToCopy);
            await navigator.clipboard.writeText(yamlString);
            setCopiedKeyframeYaml(yamlString);
        } catch (error) {
            console.error('Failed to copy full keyframe values as YAML:', error);
        }
    };
  
    const handlePasteValuesToSelectedKeyframeFromYaml = async () => {
        if (!selectedKeyframe || !selectedObject) return;

        const applyYaml = (text: string) => {
            try {
                const parsedContent = yaml.load(text) as any;
                if (typeof parsedContent !== 'object' || parsedContent === null || Array.isArray(parsedContent)) {
                    throw new Error('Pasted content is not a valid keyframe object or values block.');
                }
    
                const pastedData: Partial<TimelineKeyframe> = {};
                if ('values' in parsedContent && typeof parsedContent.values === 'object') {
                    pastedData.values = parsedContent.values;
                    if ('name' in parsedContent) pastedData.name = parsedContent.name;
                    if ('easing' in parsedContent) pastedData.easing = parsedContent.easing;
                } else {
                    pastedData.values = parsedContent;
                }
    
                if (!pastedData.values) {
                    throw new Error("Pasted YAML does not contain a 'values' block or is not a values block itself.");
                }
                
                setObjects(prev => prev.map(o => {
                    if (o.id !== selectedObject.id) return o;
                    
                    const newAnims = [...o.animations];
                    const keyframeIndex = selectedKeyframe.index;
                    if (!newAnims[keyframeIndex]) return o;
    
                    const existingKeyframe = newAnims[keyframeIndex];
                    const newValues = { ...existingKeyframe.values, ...pastedData.values };
    
                    newAnims[keyframeIndex] = {
                        ...existingKeyframe,
                        name: pastedData.name ?? existingKeyframe.name,
                        easing: pastedData.easing ?? existingKeyframe.easing,
                        values: newValues,
                    };
                    
                    return { ...o, animations: newAnims };
                }));
            } catch (error) {
                console.error('Failed to paste YAML:', error);
                alert(`Error parsing YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        };

        try {
            const text = await navigator.clipboard.readText();
            applyYaml(text);
        } catch (error) {
            console.warn('Clipboard read failed, falling back to manual paste.', error);
            requestManualPaste(applyYaml, 'Paste Keyframe YAML');
        }
    };
  
    const handleCopyAllKeyframesAsYaml = async (trackId: string) => {
        const objectToCopy = objects.find(o => o.id === trackId);
        if (!objectToCopy || !objectToCopy.animations) return;
        try {
            const yamlString = yaml.dump(objectToCopy.animations);
            await navigator.clipboard.writeText(yamlString);
            setCopiedKeyframeYaml(yamlString);
        } catch (error) { console.error('Failed to copy all keyframes as YAML:', error); }
    };
  
    const handlePasteAllKeyframesFromYaml = async (trackId: string) => {
        const applyYaml = (text: string) => {
            try {
                const parsedKeyframes = yaml.load(text);
                if (!Array.isArray(parsedKeyframes)) { throw new Error('Pasted content is not a valid keyframe array.'); }
                
                const isValid = parsedKeyframes.every(kf => typeof kf === 'object' && kf !== null && typeof kf.time === 'number' && typeof kf.values === 'object');
                if (!isValid) { throw new Error('Pasted YAML is an array, but its items do not match the required keyframe structure.'); }
    
                setObjects(prev => prev.map(o => o.id !== trackId ? o : { ...o, animations: parsedKeyframes as TimelineKeyframe[] }));
            } catch (error) {
                console.error('Failed to paste all keyframes from YAML:', error);
                alert(`Error parsing YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        };

        try {
            const text = await navigator.clipboard.readText();
            applyYaml(text);
        } catch (error) {
            console.warn('Clipboard read failed, falling back to manual paste.', error);
            requestManualPaste(applyYaml, 'Paste All Keyframes YAML');
        }
    };
  
    const handleBakePhysics = (settings: SimulationSettings, currentTime: number) => {
        const newKeyframesMap = bakeScenePhysics({ objects, startTime: currentTime, getInterpolatedValueAtTime, simulationSettings: settings });
        setObjects(prevObjects => {
            return prevObjects.map(obj => {
                const newKeyframes = newKeyframesMap.get(obj.id);
                if (!newKeyframes || newKeyframes.length === 0) return obj;

                const bakeStartTime = currentTime;
                const bakeEndTime = currentTime + settings.duration;
                const existingKeyframes = obj.animations?.filter(kf => (obj.startTime + kf.time < bakeStartTime || obj.startTime + kf.time > bakeEndTime)) || [];
                const transformedNewKeyframes = newKeyframes.map(kf => ({ ...kf, time: (bakeStartTime + kf.time) - obj.startTime }));
                const finalAnimations = [...existingKeyframes, ...transformedNewKeyframes].sort((a,b) => a.time - b.time);
                return { ...obj, animations: finalAnimations };
            });
        });
    };
    
    const getControlValue = (property: string, currentTime: number, axis?: number) => {
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

        const updater = (prev: SceneObject[]) => {
            return prev.map(o => {
                if (o.id !== selectedId) return o;
                
                let finalValue = value;
                if (property === 'scale' && isScaleLocked && axis !== undefined) {
                    const baseScale = (selectedKeyframe && selectedKeyframe.id === selectedId) ? (o.animations[selectedKeyframe.index]?.values?.scale || o.scale) : o.scale;
                    const oldValueForAxis = baseScale[axis];
                    const ratio = (oldValueForAxis !== 0 && oldValueForAxis !== undefined) ? value / oldValueForAxis : 1;
                    const newScale: [number, number, number] = [ baseScale[0] * ratio, baseScale[1] * ratio, baseScale[2] * ratio ];
                    newScale[axis] = value;
                    finalValue = newScale;
                    axis = undefined;
                }

                if (selectedKeyframe && selectedKeyframe.id === selectedId) {
                    const newAnims = [...o.animations];
                    const kfToUpdate = newAnims[selectedKeyframe.index];
                    if (!kfToUpdate) return o;
                    let updatedValue = finalValue;
                    if (axis !== undefined) {
                        const currentValue = (kfToUpdate.values[property as keyof typeof kfToUpdate.values] as [number, number, number]) || (o[property as keyof SceneObject] as [number, number, number]) || (property.includes('scale') ? [1, 1, 1] : [0, 0, 0]);
                        const newTuple = [...currentValue] as [number, number, number];
                        newTuple[axis] = finalValue;
                        updatedValue = newTuple;
                    }
                    newAnims[selectedKeyframe.index] = { ...kfToUpdate, values: { ...kfToUpdate.values, [property]: updatedValue } };
                    return { ...o, animations: newAnims };
                } else {
                    let updatedValue = finalValue;
                    if (axis !== undefined) {
                        const currentValue = (o[property as keyof SceneObject] as [number, number, number]) || (property.includes('scale') ? [1, 1, 1] : [0, 0, 0]);
                        const newTuple = [...currentValue] as [number, number, number];
                        newTuple[axis] = finalValue;
                        updatedValue = newTuple;
                    }
                    return { ...o, [property]: updatedValue };
                }
            });
        };
        setObjects(updater, true);
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
    
    const processLottieFile = async (file: File, currentTime: number) => {
        const zip = new JSZip();
        try {
          const content = await zip.loadAsync(file);
          const manifestFile = content.file('manifest.json');
          if (!manifestFile) return;
          const manifest = JSON.parse(await manifestFile.async('string'));
          const animationId = manifest.animations[0]?.id;
          if (!animationId) return;
          const animationFile = content.file(`animations/${animationId}.json`);
          if (!animationFile) return;
          const animationStr = await animationFile.async('string');
          const animationData = JSON.parse(animationStr);
          const blob = new Blob([animationStr], { type: 'application/json' });
          handleAddObject('lottie', currentTime, URL.createObjectURL(blob), animationData.w, animationData.h);
        } catch (e) { console.error('Failed to process .lottie file', e); }
    };

    const processFile = (file: File, currentTime: number) => {
        const url = URL.createObjectURL(file);
        const type = file.type;
        const name = file.name.toLowerCase();
        
        if (name.endsWith('.svg')) handleAddObject('svg', currentTime, url);
        else if (name.endsWith('.lottie')) processLottieFile(file, currentTime);
        else if (type.startsWith('image/')) {
            const img = new Image();
            img.onload = () => handleAddObject('plane', currentTime, url, img.width, img.height);
            img.src = url;
        } else if (type.startsWith('video/') || name.endsWith('.mp4')) {
            const video = document.createElement('video');
            video.onloadedmetadata = () => handleAddObject('video', currentTime, url, video.videoWidth, video.videoHeight);
            video.src = url;
        } else if (type.startsWith('audio/') || name.endsWith('.wav') || name.endsWith('.mp3') || name.endsWith('.ogg')) handleAddObject('audio', currentTime, url);
        else if (name.endsWith('.glb') || name.endsWith('.gltf')) handleAddObject('glb', currentTime, url);
    };
    
    const handleDrop = (e: React.DragEvent, currentTime: number) => { e.preventDefault(); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0], currentTime); };
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, currentTime: number) => { if (e.target.files?.[0]) processFile(e.target.files[0], currentTime); };

    return {
        // State and setters that are still local to this hook
        selectedId, setSelectedId, selectedKeyframe, setSelectedKeyframe,
        copiedKeyframeYaml, isScaleLocked, setIsScaleLocked, isSnappingEnabled, setIsSnappingEnabled,
        
        // Derived state
        selectedObject,

        // Handlers
        handleAddObject, handleUpdateObject, handleRemoveObject, handleAddKeyframe, handleRemoveKeyframe,
        handleRemoveAllKeyframes, handleSelectKeyframe, handleCopySelectedKeyframeValuesAsYaml,
        handlePasteValuesToSelectedKeyframeFromYaml, handleCopyAllKeyframesAsYaml, handlePasteAllKeyframesFromYaml,
        handleBakePhysics, getControlValue, handleControlChange, handleKeyframePropertyChange,
        handleDrop, handleFileUpload
    };
};