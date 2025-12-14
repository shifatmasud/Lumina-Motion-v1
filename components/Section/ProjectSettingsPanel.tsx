
import React from 'react';
import { Group, Select, Divider } from '../Core/Primitives';
import { GlobalSettings } from '../../engine';
import { DesignSystem } from '../../theme';
import { Monitor } from '@phosphor-icons/react';

interface ProjectSettingsPanelProps {
    settings: GlobalSettings;
    setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
}

export const ProjectSettingsPanel: React.FC<ProjectSettingsPanelProps> = ({ settings, setSettings }) => {
    
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
