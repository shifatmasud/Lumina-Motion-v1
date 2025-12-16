
import React, { useState } from 'react';
import { Sparkle, Globe, Key } from '@phosphor-icons/react';
import { DesignSystem } from '../../theme';
import { Button, Input, Group, Slider, Select } from '../Core/Primitives';
import { SimulationSettings } from '../../utils/physics';

interface PhysicsPanelProps {
    onBake: (settings: SimulationSettings) => void;
}

export const PhysicsPanel: React.FC<PhysicsPanelProps> = ({ onBake }) => {
    const [settings, setSettings] = useState<SimulationSettings>({
        duration: 3.0,
        fps: 60,
        gravity: -9.81,
        timeScale: 1.0,
        simplificationTolerance: 0.01,
        easing: 'none',
    });

    const update = (key: keyof SimulationSettings, value: any) => {
        setSettings(s => ({ ...s, [key]: value }));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(4) }}>
            <Group title="SIMULATION" icon={<Globe />}>
                <Input label="DURATION (S)" type="number" step="0.5" min="0.5" value={settings.duration} onChange={e => update('duration', parseFloat(e.target.value))} />
                <Input label="GRAVITY (Y-AXIS)" type="number" step="0.1" value={settings.gravity} onChange={e => update('gravity', parseFloat(e.target.value))} />
                <Slider label="TIME SCALE" value={settings.timeScale} min={0.1} max={2} step={0.1} onChange={v => update('timeScale', v)} />
            </Group>
            
            <Group title="KEYFRAME OUTPUT" icon={<Key />}>
                 <Input label="CAPTURE FPS" type="number" step="10" min="10" value={settings.fps} onChange={e => update('fps', parseInt(e.target.value))} />
                 <Slider label="SIMPLIFY (TOLERANCE)" value={settings.simplificationTolerance} min={0} max={0.1} step={0.005} onChange={v => update('simplificationTolerance', v)} />
                 <Select label="APPLY EASING" value={settings.easing} onChange={e => update('easing', e.target.value as SimulationSettings['easing'])}>
                    <option value="none">None (Linear)</option>
                    <option value="ease-in">Ease In</option>
                    <option value="ease-out">Ease Out</option>
                    <option value="ease-in-out">Ease In-Out</option>
                 </Select>
            </Group>
            
            <div style={{...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[3], padding: '8px', textAlign: 'center', background: DesignSystem.Color.Base.Surface[1], borderRadius: DesignSystem.Effect.Radius.S}}>
                Baking generates keyframes for physics objects from the current playhead time.
            </div>

            <Button onClick={() => onBake(settings)} variant="primary" style={{ gap: DesignSystem.Space(2) }}>
                <Sparkle weight="fill" />
                BAKE PHYSICS
            </Button>
        </div>
    );
};
