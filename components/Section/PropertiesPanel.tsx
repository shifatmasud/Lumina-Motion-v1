
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash,
  FilmStrip, 
  VideoCamera,
  Sparkle,
  PaintBrush,
  ToggleLeft,
  CaretDown,
  Diamond,
  Cylinder,
  Eye,
  Lightbulb,
  Lock,
  LockOpen,
  Palette,
  SpeakerHigh
} from '@phosphor-icons/react';
import { DesignSystem } from '../../theme';
import { GlobalSettings, SceneObject, TimelineKeyframe } from '../../engine';
import { Button, Input, Slider, Toggle, Divider, Group, Select, PropSlider } from '../Core/Primitives';
import { TransitionControls } from '../Package/TransitionControls';
import { materialPresets, ACCENT_COLORS, EASING_OPTIONS } from '../../constants';

interface PropertiesPanelProps {
    selectedObject: SceneObject | undefined;
    selectedKeyframe: { id: string, index: number } | null;
    globalSettings: GlobalSettings;
    accentColor: string;
    isScaleLocked: boolean;
    getControlValue: (property: string, axis?: number) => any;
    handleControlChange: (property: string, value: any, axis?: number) => void;
    handleUpdateObject: (id: string, updates: Partial<SceneObject>) => void;
    handleRemoveObject: (id: string) => void;
    handleKeyframePropertyChange: (property: keyof TimelineKeyframe, value: any) => void;
    handleRemoveKeyframe: () => void;
    handleLightSettingChange: (light: 'ambientLight', property: string, value: any) => void;
    setGlobalSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
    setAccentColor: React.Dispatch<React.SetStateAction<string>>;
    setIsScaleLocked: React.Dispatch<React.SetStateAction<boolean>>;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    selectedObject, selectedKeyframe, globalSettings, accentColor, isScaleLocked,
    getControlValue, handleControlChange, handleUpdateObject, handleRemoveObject,
    handleKeyframePropertyChange, handleRemoveKeyframe, handleLightSettingChange,
    setGlobalSettings, setAccentColor, setIsScaleLocked,
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

    if (selectedObject) {
        const isLocked = selectedObject.type === 'camera' || selectedObject.type === 'light';
        return (
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
                {selectedKeyframe?.id === selectedObject.id && selectedKeyframeData && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
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
                        {(selectedObject.type === 'mesh' || selectedObject.type === 'svg' || selectedObject.type === 'glb' || selectedObject.type === 'plane' || selectedObject.type === 'video' || selectedObject.type === 'lottie') && (
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
                      <AnimatePresence> {getControlValue('transmission') > 0 && ( <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(3) }}> <PropSlider label="IOR" value={getControlValue('ior')} onChange={v => handleControlChange('ior', v)} min={1} max={2.5} step={0.01} isMode={selectedKeyframe?.id === selectedObject.id} /> <PropSlider label="THICKNESS" value={getControlValue('thickness')} onChange={v => handleControlChange('thickness', v)} min={0} max={5} step={0.1} isMode={selectedKeyframe?.id === selectedObject.id} /> </motion.div> )} </AnimatePresence>
                      <Divider />
                      <PropSlider label="CLEARCOAT" value={getControlValue('clearcoat')} onChange={v => handleControlChange('clearcoat', v)} min={0} max={1} step={0.01} isMode={selectedKeyframe?.id === selectedObject.id} />
                      <AnimatePresence> {getControlValue('clearcoat') > 0 && ( <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}> <PropSlider label="ROUGHNESS" value={getControlValue('clearcoatRoughness')} onChange={v => handleControlChange('clearcoatRoughness', v)} min={0} max={1} step={0.01} isMode={selectedKeyframe?.id === selectedObject.id} /> </motion.div> )} </AnimatePresence>
                    </Group>
                )}

                {(selectedObject.type === 'audio' || selectedObject.type === 'video') && ( <Group title="AUDIO" icon={<SpeakerHigh />}> <PropSlider label="VOLUME" value={getControlValue('volume')} onChange={(v: number) => handleControlChange('volume', v)} isMode={selectedKeyframe?.id === selectedObject.id} min={0} max={1} step={0.05} /> </Group> )}

                {(selectedObject.type === 'video' || selectedObject.type === 'plane') && ( <Group title="DISTORTION" icon={<Cylinder />}> <PropSlider label="CYLINDER WRAP" value={getControlValue('curvature')} onChange={(v: number) => handleControlChange('curvature', v)} isMode={selectedKeyframe?.id === selectedObject.id} min={-0.5} max={0.5} step={0.01} /> </Group> )}

                {(selectedObject.type === 'video' || selectedObject.type === 'lottie') && ( <Group title="PLAYBACK" icon={<FilmStrip />}> <Toggle label="LOOP" value={selectedObject.loop ?? true} onChange={(v) => handleUpdateObject(selectedObject.id, { loop: v })} /> <div style={{ ...DesignSystem.Type.Label.S, fontSize: '10px', color: DesignSystem.Color.Base.Content[3], padding: '4px', textAlign: 'center', background: DesignSystem.Color.Base.Surface[2], borderRadius: DesignSystem.Effect.Radius.S }}> Playback is controlled by the main timeline.</div> </Group> )}

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
                
                <Divider />
                <Button variant="ghost" onClick={() => handleRemoveObject(selectedObject.id)} disabled={isLocked} style={{ color: isLocked ? DesignSystem.Color.Base.Content[3] : DesignSystem.Color.Feedback.Error, width: '100%', opacity: isLocked ? 0.5 : 0.7 }}>
                    <Trash size={16} weight="bold" /> {isLocked ? 'LOCKED' : 'DELETE'}
                </Button>
            </div>
        );
    }
    
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(4) }}>
            <Group title="SCENE" icon={<PaintBrush weight="fill"/>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[2] }}>BACKGROUND COLOR</label>
                    <div style={{ display: 'flex', gap: DesignSystem.Space(2), alignItems: 'center' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${DesignSystem.Color.Base.Border[2]}`, flexShrink: 0 }}>
                            <input type="color" value={globalSettings.backgroundColor} onChange={(e) => setGlobalSettings(g => ({ ...g, backgroundColor: e.target.value }))} style={{ width: '150%', height: '150%', margin: '-25%', padding: 0, border: 'none', cursor: 'pointer' }} />
                        </div>
                        <Input type="text" value={globalSettings.backgroundColor} onChange={(e) => setGlobalSettings(g => ({ ...g, backgroundColor: e.target.value }))} style={{ flex: 1 }} />
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[2] }}>GROUND COLOR</label>
                    <div style={{ display: 'flex', gap: DesignSystem.Space(2), alignItems: 'center' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${DesignSystem.Color.Base.Border[2]}`, flexShrink: 0 }}>
                            <input type="color" value={globalSettings.groundColor} onChange={(e) => setGlobalSettings(g => ({ ...g, groundColor: e.target.value }))} style={{ width: '150%', height: '150%', margin: '-25%', padding: 0, border: 'none', cursor: 'pointer' }} />
                        </div>
                        <Input type="text" value={globalSettings.groundColor} onChange={(e) => setGlobalSettings(g => ({ ...g, groundColor: e.target.value }))} style={{ flex: 1 }} />
                    </div>
                </div>
                
                <Toggle label="SHOW GRID" value={globalSettings.showGrid} onChange={(v) => setGlobalSettings(g => ({ ...g, showGrid: v }))} />
                <Toggle label="SHOW GROUND" value={globalSettings.showGround} onChange={(v) => setGlobalSettings(g => ({ ...g, showGround: v }))} />
                <Toggle label="SHOW LIGHT HELPERS" value={globalSettings.showLightHelpers} onChange={(v) => setGlobalSettings(g => ({ ...g, showLightHelpers: v }))} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={DesignSystem.Type.Label.S}>ACCENT COLOR</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                         <div style={{ position: 'relative', width: '100%' }}>
                            <select value={accentColor} onChange={(e) => setAccentColor(e.target.value)} style={{ appearance: 'none', width: '100%', background: DesignSystem.Color.Base.Surface[3], border: 'none', padding: '8px 12px', color: DesignSystem.Color.Base.Content[1], borderRadius: DesignSystem.Effect.Radius.S, fontFamily: DesignSystem.Type.Label.S.fontFamily, fontSize: '12px', cursor: 'pointer' }}>
                                {ACCENT_COLORS.map(c => ( <option key={c} value={c}>{c}</option> ))}
                            </select>
                            <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', gap: '4px' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: accentColor }} />
                                <CaretDown size={14} color={DesignSystem.Color.Base.Content[3]} />
                            </div>
                         </div>
                    </div>
                </div>
                <Divider />
                <div>
                    <span style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[2], display: 'block', marginBottom: DesignSystem.Space(2) }}>AMBIENT LIGHT</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(2)}}>
                        <Input label="COLOR" type="color" value={globalSettings.ambientLight.color} onChange={e => handleLightSettingChange('ambientLight', 'color', e.target.value)} />
                        <Slider label="INTENSITY" value={globalSettings.ambientLight.intensity} min={0} max={2} step={0.01} onChange={v => handleLightSettingChange('ambientLight', 'intensity', v)} />
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
    );
};
