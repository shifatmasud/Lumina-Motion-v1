
import React from 'react';
import { motion } from 'framer-motion';
import { SquaresFour, FilmStrip, Faders } from '@phosphor-icons/react';
import { DesignSystem } from '../../theme';

const DockItem: React.FC<{ icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }> = ({ icon, label, isActive, onClick }) => (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <motion.button onClick={onClick} whileHover={{ scale: 1.1, y: -4 }} whileTap={{ scale: 0.96 }} style={{ width: '44px', height: '44px', borderRadius: '14px', border: isActive ? `1px solid ${DesignSystem.Color.Accent.Surface[1]}` : `1px solid transparent`, background: 'rgba(255,255,255,0.03)', color: isActive ? DesignSystem.Color.Accent.Content[1] : DesignSystem.Color.Base.Content[2], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer', boxShadow: isActive ? `0 0 24px ${DesignSystem.Color.Accent.Surface[1]}` : 'none', transition: 'border 0.2s, background 0.2s, box-shadow 0.2s' }}>
            {icon}
        </motion.button>
        {isActive && ( <motion.div layoutId="active-dot" style={{ position: 'absolute', bottom: '-8px', width: '3px', height: '3px', borderRadius: '50%', background: DesignSystem.Color.Accent.Surface[1], boxShadow: `0 0 8px ${DesignSystem.Color.Accent.Surface[1]}` }} /> )}
    </div>
);

interface DockProps {
    containerRef: React.RefObject<HTMLDivElement>;
    showAssets: boolean;
    setShowAssets: (show: boolean) => void;
    showTimeline: boolean;
    setShowTimeline: (show: boolean) => void;
    showProperties: boolean;
    setShowProperties: (show: boolean) => void;
}

export const Dock: React.FC<DockProps> = ({ containerRef, showAssets, setShowAssets, showTimeline, setShowTimeline, showProperties, setShowProperties }) => (
    <motion.div drag dragMomentum={false} dragConstraints={containerRef} initial={{ y: 0, x: '-50%' }} style={{ position: 'absolute', bottom: '40px', left: '50%', height: '72px', background: DesignSystem.Color.Base.Surface['3b'], backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', borderRadius: '999px', border: `1px solid ${DesignSystem.Color.Base.Border[2]}`, padding: '0 24px', display: 'flex', alignItems: 'center', gap: '24px', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.6)', zIndex: 200, touchAction: 'none' }} whileTap={{ cursor: 'grabbing' }}>
        <div style={{ position: 'absolute', top: '-10px', left: '0', right: '0', height: '20px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
        </div>
        <DockItem icon={<SquaresFour weight="fill" />} label="ASSETS" isActive={showAssets} onClick={() => setShowAssets(!showAssets)} />
        <DockItem icon={<FilmStrip weight="fill" />} label="TIMELINE" isActive={showTimeline} onClick={() => setShowTimeline(!showTimeline)} />
        <DockItem icon={<Faders weight="fill" />} label="PROPS" isActive={showProperties} onClick={() => setShowProperties(!showProperties)} />
    </motion.div>
);
