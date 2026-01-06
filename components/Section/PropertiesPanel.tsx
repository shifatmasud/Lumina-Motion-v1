
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash,
  FilmStrip, 
  VideoCamera,
  PaintBrush,
  ToggleLeft,
  Diamond,
  Cylinder,
  Eye,
  Lightbulb,
  Lock,
  LockOpen,
  Palette,
  SpeakerHigh,
  Atom,
} from '@phosphor-icons/react';
import { DesignSystem } from '../../theme';
import { SceneObject, TimelineKeyframe } from '../../engine';
import { Button, Input, Slider, Toggle, Divider, Group, Select, PropSlider } from '../Core/Primitives';
import { TransitionControls } from '../Package/TransitionControls';
import { materialPresets, EASING_OPTIONS } from '../../constants';

interface PropertiesPanelProps {
    selectedObject: SceneObject | undefined;
    selectedKeyframe: { id: string, index: number } | null;
    isScaleLocked: boolean;
    getControlValue: (property: string, axis?: number) => any;
    handleControlChange: (property: string, value: any, axis?: number) => void;
    handleUpdateObject: (id: string, updates: Partial<SceneObject>) => void;
    handleRemoveObject: (id: string) => void;
    handleKeyframePropertyChange: (property: keyof TimelineKeyframe, value: any) => void;
    handleRemoveKeyframe: () => void;
    setIsScaleLocked: React.Dispatch<React.SetStateAction<boolean>>;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    selectedObject, selectedKeyframe, isScaleLocked,
    getControlValue, handleControlChange, handleUpdateObject, handleRemoveObject,
    handleKeyframePropertyChange, handleRemoveKeyframe,
    setIsScaleLocked
}) => {
    const handlePresetChange = (presetKey: string) => {
      if (!selectedObject?.id || !materialPresets[presetKey]) return;
      handleUpdateObject(selectedObject.id, materialPresets[presetKey]);
    };

    const getSelectedKeyframeData = () => {
        if (!selectedKeyframe || !selectedObject) return null;
        return selectedObject.animations[selectedKeyframe.index];
    };
    
    const selectedKeyframeData = getSelectedKeyframeData();

    const canHavePhysics = selectedObject && ['mesh', 'plane', 'video', 'glb', 'svg'].includes(selectedObject.type);
    const physicsProps = selectedObject?.physics || { enabled: false, type: 'dynamic', mass: 1, friction: 0.3, restitution: 0.5, force: { preset: 'none', strength: 20 } };
    const forceProps = physicsProps.force || { preset: 'none', strength: 20 };

    const handlePhysicsPropChange = (prop: string, value: any) => {
        if (!selectedObject) return;
        handleUpdateObject(selectedObject.id, {
            physics: {
                ...physicsProps,
                [prop]: value,
            },
        });
    };
    
    const handlePhysicsForcePropChange = (prop: string, value: any) => {
        if (!selectedObject) return;
        handleUpdateObject(selectedObject.id, {
            physics: {
                ...physicsProps,
                force: {
                    ...forceProps,
                    [prop]: value,
                }
            },
        });
    };

    if (selectedObject) {
        const isCoreObject = selectedObject.type === 'camera' || selectedObject.type === 'light';
        const isDeletable = !isCoreObject && selectedObject.id !== 'ground-plane';

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(3) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: DesignSystem.Color.Base.Surface[2], padding: DesignSystem.Space(2), borderRadius: DesignSystem.Effect.Radius.M }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                        <span style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Accent.Content[2] }}>{selectedObject.name || (selectedObject.type === 'camera' ? 'MAIN CAMERA' : selectedObject.type)}</span>
                        <span style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[3] }}>#{selectedObject.id.slice(0,4)}</span>
                    </div>
                    
                    {(isCoreObject || selectedObject.id === 'ground-plane') && (
                        <Toggle 
                            label="EDITABLE"
                            value={!selectedObject.locked}
                            onChange={(v) => handleUpdateObject(selectedObject.id, { locked: !v })}
                            style={{ width: 'auto', height: 'auto', gap: DesignSystem.Space(2), padding: 0 }}
                        />
                    )}

                    {selectedKeyframe?.id === selectedObject.id && (
                        <div style={{ background: DesignSystem.Color.Feedback.Warning, color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', marginLeft: '8px', flexShrink: 0 }}>KEYFRAME</div>
                    )}
                </div>

                <fieldset disabled={selectedObject.locked} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(3), opacity: selectedObject.locked ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                    <AnimatePresence>
                    {selectedKeyframe?.id === selectedObject.id && selectedKeyframeData && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(3) }}>
                           <Group title="KEYFRAME" icon={<Diamond weight="fill" />}>
                               <Input
                                    label="KEYFRAME NAME"
                                    placeholder="e.g. Start, Mid-point"
                                    value={selectedKeyframeData.name || ''}
                                    onChange={(e) => handleKeyframePropertyChange('name', e.target.value)}
                               />
                               <Select
                                   label="EASING"
                                   value={selectedKeyframeData.easing || 'power2.out'}
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
                      <PropSlider label="POS X" value={getControlValue('position', 0)} onChange={(v: number) => handleControlChange('position', v, 0)} isMode={selectedKeyframe?.id === selectedObject.id} min={-10} max={10} step={0.1} />
                      <PropSlider label="POS Y" value={getControlValue('position', 1)} onChange={(v: number) => handleControlChange('position', v, 1)} isMode={selectedKeyframe?.id === selectedObject.id} min={-10} max={10} step={0.1} />
                      <PropSlider label="POS Z" value={getControlValue('position', 2)} onChange={(v: number) => handleControlChange('position', v, 2)} isMode={selectedKeyframe?.id === selectedObject.id} min={-10} max={10} step={0.1} />
                      
                      {selectedObject.type !== 'audio' && (
                        <>
                          <Divider />
                          <PropSlider label="ROT X" value={getControlValue('rotation', 0)} onChange={(v: number) => handleControlChange('rotation', v, 0)} isMode={selectedKeyframe?.id === selectedObject.id} min={-180} max={180} step={1} />
                          <PropSlider label="ROT Y" value={getControlValue('rotation', 1)} onChange={(v: number) => handleControlChange('rotation', v, 1)} isMode={selectedKeyframe?.id === selectedObject.id} min={-180} max={180} step={1} />
                          <PropSlider label="ROT Z" value={getControlValue('rotation', 2)} onChange={(v: number) => handleControlChange('rotation', v, 2)} isMode={selectedKeyframe?.id === selectedObject.id} min={-180} max={180} step={1} />
                        </>
                      )}
    
                      {selectedObject.type !== 'camera' && selectedObject.type !== 'audio' && selectedObject.type !== 'light' && (
                        <>
                          <Divider />
                           <div style={{ display: 'flex', alignItems: 'center', gap: DesignSystem.Space(2), padding: `0 ${DesignSystem.Space(1)}`, height: '16px' }}>
                               <span style={{ ...DesignSystem.Type.Label.S, flex: 1, color: DesignSystem.Color.Base.Content[2] }}>SCALE</span>
                               <button onClick={() => setIsScaleLocked(!isScaleLocked)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isScaleLocked ? DesignSystem.Color.Accent.Surface[1] : DesignSystem.Color.Base.Content[3], padding: '4px' }} title={isScaleLocked ? "Unlock Scale Ratio" : "Lock Scale Ratio"}>
                                   {isScaleLocked ? <Lock size={14} weight="fill" /> : <LockOpen size={14} />}
                               </button>
                            </div>
                          <PropSlider label="SCALE X" value={getControlValue('scale', 0)} onChange={(v: number) => handleControlChange('scale', v, 0)} isMode={selectedKeyframe?.id === selectedObject.id} min={0} max={5} step={0.05} />
                          <PropSlider label="SCALE Y" value={getControlValue('scale', 1)} onChange={(v: number) => handleControlChange('scale', v, 1)} isMode={selectedKeyframe?.id === selectedObject.id} min={0} max={5} step={0.05} />
                          <PropSlider label="SCALE Z" value={getControlValue('scale', 2)} onChange={(v: number) => handleControlChange('scale', v, 2)} isMode={selectedKeyframe?.id === selectedObject.id} min={0} max={5} step={0.05} />
                        </>
                      )}
                      
                      {selectedObject.type === 'camera' && ( <div style={{ marginTop: '8px' }}> <Slider label="FOV" value={selectedObject.fov || 60} min={10} max={120} step={1} onChange={(v) => handleUpdateObject(selectedObject.id, { fov: v })} /> </div> )}
                    </Group>
                    
                    {selectedObject.type === 'light' && (
                        <Group title="LIGHT" icon={<Lightbulb weight="fill" />}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[2] }}>COLOR</label>
                                <div style={{ display: 'flex', gap: DesignSystem.Space(2), alignItems: 'center' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${DesignSystem.Color.Base.Border[2]}`, flexShrink: 0 }}>
                                        <input type="color" value={getControlValue('color')} onChange={(e) => handleControlChange('color', e.target.value)} style={{ width: '150%', height: '150%', margin: '-25%', padding: 0, border: 'none', cursor: 'pointer' }} />
                                    </div>
                                    <Input type="text" value={getControlValue('color')} onChange={(e) => handleControlChange('color', e.target.value)} style={{ flex: 1 }} />
                                </div>
                            </div>
                            <PropSlider label="INTENSITY" value={getControlValue('intensity')} onChange={(v: number) => handleControlChange('intensity', v)} isMode={selectedKeyframe?.id === selectedObject.id} min={0} max={20} step={0.1} />
                        </Group>
                    )}
    
                    {selectedObject.type !== 'camera' && selectedObject.type !== 'audio' && selectedObject.type !== 'light' && (
                        <Group title="APPEARANCE" icon={<Eye weight="fill"/>}>
                            <PropSlider label="OPACITY" value={getControlValue('opacity')} onChange={(v: number) => handleControlChange('opacity', v)} isMode={selectedKeyframe?.id === selectedObject.id} min={0} max={1} step={0.01} />
                            {(selectedObject.type === 'mesh' || selectedObject.type === 'svg' || selectedObject.type === 'glb' || selectedObject.type === 'plane' || selectedObject.type === 'video') && (
                                <Toggle 
                                    label="WIREFRAME" 
                                    value={selectedObject.wireframe || false} 
                                    onChange={(v) => handleUpdateObject(selectedObject.id, { wireframe: v })} 
                                />
                            )}
                        </Group>
                    )}
                    
                    {(selectedObject.type === 'mesh' || selectedObject.type === 'svg') && (
                        <Group title="MATERIAL" icon={<Palette />}>
                           <Select label="PRESET" onChange={e => handlePresetChange(e.target.value)} value="">
                              <option value="" disabled>Select a Preset...</option>
                              {Object.entries(materialPresets).map(([key]) => ( <option key={key} value={key}>{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim()}</option> ))}
                           </Select>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                               <label style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[2] }}>COLOR</label>
                               <div style={{ display: 'flex', gap: DesignSystem.Space(2), alignItems: 'center' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${DesignSystem.Color.Base.Border[2]}`, flexShrink: 0 }}>
                                        <input type="color" value={getControlValue('color')} onChange={(e) => handleControlChange('color', e.target.value)} style={{ width: '150%', height: '150%', margin: '-25%', padding: 0, border: 'none', cursor: 'pointer' }} />
                                    </div>
                                    <Input type="text" value={getControlValue('color')} onChange={(e) => handleControlChange('color', e.target.value)} style={{ flex: 1 }} />
                               </div>
                           </div>
                          <PropSlider label="METALNESS" value={getControlValue('metalness')} onChange={(v: number) => handleControlChange('metalness', v)} isMode={selectedKeyframe?.id === selectedObject.id} min={0} max={1} step={0.01} />
                          <PropSlider label="ROUGHNESS" value={getControlValue('roughness')} onChange={(v: number) => handleControlChange('roughness', v)} isMode={selectedKeyframe?.id === selectedObject.id} min={0} max={1} step={0.01} />
                           {selectedObject.type === 'svg' && ( <> <PropSlider label="EXTRUSION" value={getControlValue('extrusion')} onChange={v => handleControlChange('extrusion', v)} min={0} max={10} step={0.01} isMode={selectedKeyframe?.id === selectedObject.id} /> <PropSlider label="PATH LENGTH" value={getControlValue('pathLength')} onChange={v => handleControlChange('pathLength', v)} min={0} max={1} step={0.01} isMode={selectedKeyframe?.id === selectedObject.id} /> </> )}
                          <Divider />
                          <PropSlider label="TRANSMISSION" value={getControlValue('transmission')} onChange={v => handleControlChange('transmission', v)} min={0} max={1} step={0.01} isMode={selectedKeyframe?.id === selectedObject.id} />
                          <AnimatePresence> {getControlValue('transmission') > 0 && ( <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(3) }}> <PropSlider label="IOR" value={getControlValue('ior')} onChange={v => handleControlChange('ior', v)} min={1} max={2.5} step={0.01} isMode={selectedKeyframe?.id === selectedObject.id} /> <PropSlider label="THICKNESS" value={getControlValue('thickness')} onChange={v => handleControlChange('ior', v)} min={0} max={5} step={0.1} isMode={selectedKeyframe?.id === selectedObject.id} /> </motion.div> )} </AnimatePresence>
                          <Divider />
                          <PropSlider label="CLEARCOAT" value={getControlValue('clearcoat')} onChange={v => handleControlChange('clearcoat', v)} min={0} max={1} step={0.01} isMode={selectedKeyframe?.id === selectedObject.id} />
                          <AnimatePresence> {getControlValue('clearcoat') > 0 && ( <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}> <PropSlider label="ROUGHNESS" value={getControlValue('clearcoatRoughness')} onChange={v => handleControlChange('clearcoatRoughness', v)} min={0} max={1} step={0.01} isMode={selectedKeyframe?.id === selectedObject.id} /> </motion.div> )} </AnimatePresence>
                        </Group>
                    )}

                    {canHavePhysics && (
                        <Group title="PHYSICS PROPERTIES" icon={<Atom weight="fill" />}>
                            <Toggle label="ENABLE PHYSICS" value={physicsProps.enabled} onChange={v => handlePhysicsPropChange('enabled', v)} />
                            <AnimatePresence>
                                {physicsProps.enabled && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(3), paddingTop: DesignSystem.Space(2) }}>
                                    <Select label="TYPE" value={physicsProps.type} onChange={e => handlePhysicsPropChange('type', e.target.value)}>
                                        <option value="dynamic">Dynamic</option>
                                        <option value="static">Static</option>
                                    </Select>
                                    <Slider label="MASS (KG)" value={physicsProps.mass} onChange={v => handlePhysicsPropChange('mass', v)} min={0} max={10} step={0.1} />
                                    <Slider label="FRICTION" value={physicsProps.friction} onChange={v => handlePhysicsPropChange('friction', v)} min={0} max={1} step={0.05} />
                                    <Slider label="BOUNCINESS" value={physicsProps.restitution} onChange={v => handlePhysicsPropChange('restitution', v)} min={0} max={1} step={0.05} />
                                    <Divider />
                                    <Select label="FORCE PRESET" value={forceProps.preset} onChange={e => handlePhysicsForcePropChange('preset', e.target.value)}>
                                        <option value="none">None</option>
                                        <option value="push_up">Push Up</option>
                                        <option value="push_down">Push Down</option>
                                        <option value="push_forward">Push Forward</option>
                                        <option value="push_backward">Push Backward</option>
                                        <option value="pull_center">Pull to Center</option>
                                        <option value="push_from_center">Push from Center</option>
                                        <option value="pull_in_source">Pull In (Source)</option>
                                        <option value="push_out_source">Push Out (Source)</option>
                                    </Select>
                                    <AnimatePresence>
                                        {forceProps.preset !== 'none' && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', paddingTop: DesignSystem.Space(2) }}>
                                                <Slider label="FORCE STRENGTH" value={forceProps.strength} onChange={v => handlePhysicsForcePropChange('strength', v)} min={0} max={100} step={1} />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                                )}
                            </AnimatePresence>
                        </Group>
                    )}
    
                    {(selectedObject.type === 'audio' || selectedObject.type === 'video') && ( <Group title="AUDIO" icon={<SpeakerHigh />}> <PropSlider label="VOLUME" value={getControlValue('volume')} onChange={(v: number) => handleControlChange('volume', v)} isMode={selectedKeyframe?.id === selectedObject.id} min={0} max={1} step={0.05} /> </Group> )}
    
                    {(selectedObject.type === 'video' || selectedObject.type === 'plane') && ( <Group title="DISTORTION" icon={<Cylinder />}> <PropSlider label="CYLINDER WRAP" value={getControlValue('curvature')} onChange={(v: number) => handleControlChange('curvature', v)} isMode={selectedKeyframe?.id === selectedObject.id} min={-0.5} max={0.5} step={0.01} /> </Group> )}
    
                    {(selectedObject.type === 'video') && ( <Group title="PLAYBACK" icon={<FilmStrip />}> <Toggle label="LOOP" value={selectedObject.loop ?? true} onChange={(v) => handleUpdateObject(selectedObject.id, { loop: v })} /> <div style={{ ...DesignSystem.Type.Label.S, fontSize: '10px', color: DesignSystem.Color.Base.Content[3], padding: '4px', textAlign: 'center', background: DesignSystem.Color.Base.Surface[2], borderRadius: DesignSystem.Effect.Radius.S }}> Playback is controlled by the main timeline.</div> </Group> )}
    
                    {(selectedObject.type === 'video' || selectedObject.type === 'plane') && (
                        <Group title="EFFECTS">
                          {selectedObject.type === 'video' && <div style={{ padding: DesignSystem.Space(2), background: 'rgba(91, 80, 255, 0.05)', borderRadius: DesignSystem.Effect.Radius.S, ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Accent.Surface[1], display: 'flex', alignItems: 'center', gap: '6px' }}><VideoCamera weight="fill" /> Video Active</div>}
                          <Toggle label="CHROMA KEY" value={selectedObject.chromaKey?.enabled || false} onChange={(v) => { const currentChromaKey = selectedObject.chromaKey || { enabled: false, color: '#00ff00', similarity: 0.1, smoothness: 0.1 }; handleUpdateObject(selectedObject.id, { chromaKey: { ...currentChromaKey, enabled: v } }); }} />
                          <AnimatePresence>
                            {selectedObject.chromaKey?.enabled && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(2), overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[2] }}>KEY COLOR</label>
                                        <div style={{ display: 'flex', gap: DesignSystem.Space(2), alignItems: 'center' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${DesignSystem.Color.Base.Border[2]}`, flexShrink: 0 }}>
                                                    <input type="color" value={selectedObject.chromaKey.color} onChange={(e) => handleUpdateObject(selectedObject.id, { chromaKey: { ...selectedObject.chromaKey!, color: e.target.value } })} style={{ width: '150%', height: '150%', margin: '-25%', padding: 0, border: 'none', cursor: 'pointer' }} />
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
                    
                    {selectedObject.type !== 'camera' && selectedObject.type !== 'light' && ( <Group title="TRANSITIONS" icon={<ToggleLeft weight="fill"/>}> <TransitionControls title="INTRO" transition={selectedObject.introTransition} onUpdate={(t) => handleUpdateObject(selectedObject.id, { introTransition: t })} /> <Divider /> <TransitionControls title="OUTRO" transition={selectedObject.outroTransition} onUpdate={(t) => handleUpdateObject(selectedObject.id, { outroTransition: t })} /> </Group> )}
                </fieldset>
                
                <Divider />
                <Button variant="ghost" onClick={() => handleRemoveObject(selectedObject.id)} disabled={!isDeletable} style={{ color: !isDeletable ? DesignSystem.Color.Base.Content[3] : DesignSystem.Color.Feedback.Error, width: '100%', opacity: !isDeletable ? 0.5 : 0.7 }}>
                    <Trash size={16} weight="bold" /> {!isDeletable ? 'CANNOT DELETE' : 'DELETE'}
                </Button>
            </div>
        );
    }
    
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: DesignSystem.Color.Base.Content[3], textAlign: 'center', padding: DesignSystem.Space(4), gap: DesignSystem.Space(3) }}>
            <PaintBrush size={32} weight="duotone" style={{ color: DesignSystem.Color.Base.Content[2] }} />
            <span style={{...DesignSystem.Type.Label.M, color: DesignSystem.Color.Base.Content[1]}}>No Object Selected</span>
            <p style={{...DesignSystem.Type.Body.M, maxWidth: '200px', lineHeight: '140%'}}>Select an object on the timeline or in the 3D view to edit its properties.</p>
        </div>
    );
};
