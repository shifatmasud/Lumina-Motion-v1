
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Group, Select, Divider, Input, Slider, Toggle } from '../Core/Primitives';
import { GlobalSettings } from '../../engine';
import { DesignSystem } from '../../theme';
import { Monitor, Sparkle, PaintBrush, CaretDown } from '@phosphor-icons/react';
import { ACCENT_COLORS } from '../../constants';

interface ProjectSettingsPanelProps {
    settings: GlobalSettings;
    setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
    accentColor: string;
    setAccentColor: (color: string) => void;
    handleLightSettingChange: (light: 'ambientLight', property: string, value: any) => void;
}

export const ProjectSettingsPanel: React.FC<ProjectSettingsPanelProps> = ({ settings, setSettings, accentColor, setAccentColor, handleLightSettingChange }) => {
    
    const getCurrentPreset = () => {
        const { pixelRatio, shadowMapSize } = settings.performance;
        if (pixelRatio <= 0.5 && shadowMapSize === 1024) return 'ultra';
        if (pixelRatio <= 1 && shadowMapSize === 1024) return 'performance';
        if (pixelRatio === Math.min(window.devicePixelRatio, 1.5) && shadowMapSize === 2048) return 'balanced';
        if (pixelRatio >= window.devicePixelRatio && shadowMapSize === 4096) return 'quality';
        return 'custom';
    };

    const handleQualityPresetChange = (preset: 'ultra' | 'performance' | 'balanced' | 'quality' | 'custom') => {
        if (preset === 'custom') return;

        let newPixelRatio = 1;
        let newShadowMapSize: 1024 | 2048 | 4096 = 2048;

        if (preset === 'ultra') {
            newPixelRatio = 0.5;
            newShadowMapSize = 1024;
        } else if (preset === 'performance') {
            newPixelRatio = 1.0;
            newShadowMapSize = 1024;
        } else if (preset === 'balanced') {
            newPixelRatio = Math.min(window.devicePixelRatio, 1.5);
            newShadowMapSize = 2048;
        } else if (preset === 'quality') {
            newPixelRatio = window.devicePixelRatio;
            newShadowMapSize = 4096;
        }
        
        setSettings(s => ({ ...s, performance: { pixelRatio: newPixelRatio, shadowMapSize: newShadowMapSize } }));
    };
    
    const handleAspectRatioChange = (value: string) => {
        setSettings(s => ({ ...s, aspectRatio: value }));
    };

    const handlePixelRatioChange = (value: string) => {
        setSettings(s => ({ ...s, performance: { ...s.performance, pixelRatio: parseFloat(value) } }));
    };

    const handleShadowMapChange = (value: string) => {
        const size = parseInt(value, 10) as 1024 | 2048 | 4096;
        setSettings(s => ({ ...s, performance: { ...s.performance, shadowMapSize: size } }));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(4), height: '100%' }}>
            <Group title="SCENE" icon={<PaintBrush weight="fill"/>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[2] }}>BACKGROUND COLOR</label>
                    <div style={{ display: 'flex', gap: DesignSystem.Space(2), alignItems: 'center' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${DesignSystem.Color.Base.Border[2]}`, flexShrink: 0 }}>
                            <input type="color" value={settings.backgroundColor} onChange={(e) => setSettings(g => ({ ...g, backgroundColor: e.target.value }))} style={{ width: '150%', height: '150%', margin: '-25%', padding: 0, border: 'none', cursor: 'pointer' }} />
                        </div>
                        <Input type="text" value={settings.backgroundColor} onChange={(e) => setSettings(g => ({ ...g, backgroundColor: e.target.value }))} style={{ flex: 1 }} />
                    </div>
                </div>
                
                <Toggle label="SHOW GRID" value={settings.showGrid} onChange={(v) => setSettings(g => ({ ...g, showGrid: v }))} />
                <Toggle label="SHOW LIGHT HELPERS" value={settings.showLightHelpers} onChange={(v) => setSettings(g => ({ ...g, showLightHelpers: v }))} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={DesignSystem.Type.Label.S}>ACCENT COLOR</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                         <div style={{ position: 'relative', width: '100%' }}>
                            <select value={accentColor} onChange={(e) => setAccentColor(e.target.value)} style={{ appearance: 'none', width: '100%', background: DesignSystem.Color.Base.Surface[3], border: 'none', padding: '8px 12px', color: DesignSystem.Color.Base.Content[1], borderRadius: DesignSystem.Effect.Radius.S, fontFamily: DesignSystem.Type.Label.S.fontFamily, fontSize: '12px', cursor: 'pointer' }}>
                                {ACCENT_COLORS.map(c => ( <option key={c} value={c}>{c}</option> ))}
                            </select>
                            <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', gap: '4px', alignItems: 'center' }}>
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
                        <Input label="COLOR" type="color" value={settings.ambientLight.color} onChange={e => handleLightSettingChange('ambientLight', 'color', e.target.value)} />
                        <Slider label="INTENSITY" value={settings.ambientLight.intensity} min={0} max={2} step={0.01} onChange={v => handleLightSettingChange('ambientLight', 'intensity', v)} />
                    </div>
                </div>
            </Group>
            
            <Group title="EFFECTS" icon={<Sparkle weight="fill"/>}>
                <Toggle label="BLOOM" value={settings.bloom.enabled} onChange={(v) => setSettings(g => ({ ...g, bloom: { ...g.bloom, enabled: v } }))} />
                 <AnimatePresence>
                    {settings.bloom.enabled && (
                         <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(2), overflow: 'hidden', marginTop: DesignSystem.Space(2) }}>
                             <Slider label="STRENGTH" value={settings.bloom.strength} min={0} max={2} step={0.01} onChange={v => setSettings(g => ({ ...g, bloom: { ...g.bloom, strength: v } }))}/>
                             <Slider label="THRESHOLD" value={settings.bloom.threshold} min={0} max={1} step={0.01} onChange={v => setSettings(g => ({ ...g, bloom: { ...g.bloom, threshold: v } }))}/>
                             <Slider label="RADIUS" value={settings.bloom.radius} min={0} max={2} step={0.01} onChange={v => setSettings(g => ({ ...g, bloom: { ...g.bloom, radius: v } }))}/>
                        </motion.div>
                    )}
                 </AnimatePresence>
                 <Divider />
                 <Toggle label="VIGNETTE" value={settings.vignette.enabled} onChange={(v) => setSettings(g => ({ ...g, vignette: { ...g.vignette, enabled: v } }))} />
                 <AnimatePresence>
                    {settings.vignette.enabled && (
                         <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(2), overflow: 'hidden', marginTop: DesignSystem.Space(2) }}>
                            <Slider label="OFFSET" value={settings.vignette.offset} min={0} max={2} step={0.01} onChange={v => setSettings(g => ({ ...g, vignette: { ...g.vignette, offset: v } }))}/>
                            <Slider label="DARKNESS" value={settings.vignette.darkness} min={0} max={2} step={0.01} onChange={v => setSettings(g => ({ ...g, vignette: { ...g.vignette, darkness: v } }))}/>
                        </motion.div>
                    )}
                 </AnimatePresence>
            </Group>

             <Group title="VIEWPORT" icon={<Monitor />}>
                <Select label="ASPECT RATIO" value={settings.aspectRatio} onChange={e => handleAspectRatioChange(e.target.value)}>
                    <option value="free">Free (Fill)</option>
                    <option value="16:9">16:9 Landscape</option>
                    <option value="9:16">9:16 Portrait</option>
                    <option value="1:1">1:1 Square</option>
                    <option value="4:3">4:3 Classic</option>
                </Select>
            </Group>
            <Group title="REAL-TIME RENDER" icon={<Monitor />}>
                <Select label="QUALITY PRESET" value={getCurrentPreset()} onChange={e => handleQualityPresetChange(e.target.value as any)}>
                    <option value="ultra">Ultra Performance</option>
                    <option value="performance">Performance</option>
                    <option value="balanced">Balanced</option>
                    <option value="quality">Quality</option>
                    <option value="custom" disabled>Custom</option>
                </Select>
                <Divider />
                <Select label="RESOLUTION SCALING" value={settings.performance.pixelRatio} onChange={e => handlePixelRatioChange(e.target.value)}>
                    <option value={0.5}>Low (0.5x)</option>
                    <option value={1}>Standard (1x)</option>
                    <option value={1.5}>Medium (1.5x)</option>
                    <option value={window.devicePixelRatio}>Native ({window.devicePixelRatio.toFixed(1)}x)</option>
                </Select>
                 <Select label="SHADOW MAP SIZE" value={settings.performance.shadowMapSize} onChange={e => handleShadowMapChange(e.target.value)}>
                    <option value={1024}>Low (1024px)</option>
                    <option value={2048}>Medium (2048px)</option>
                    <option value={4096}>High (4096px)</option>
                </Select>
                 <div style={{...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[3], padding: '8px', textAlign: 'center', background: DesignSystem.Color.Base.Surface[1], borderRadius: DesignSystem.Effect.Radius.S}}>
                    Higher settings may impact performance. Changes apply to the real-time viewport only.
                 </div>
            </Group>
        </div>
    );
};
