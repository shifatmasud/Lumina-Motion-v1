
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CaretDown } from '@phosphor-icons/react';
import { DesignSystem } from '../../theme';
import { TransitionEffect } from '../../engine';
import { Input, Select, Toggle, Divider, Slider } from '../Core/Primitives';
import { EASING_OPTIONS } from '../../constants';

export const TransitionControls: React.FC<{
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
                            {EASING_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
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
