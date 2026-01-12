


import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, Reorder, AnimatePresence, useDragControls, useMotionValue, useTransform } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import gsap from 'gsap';
import { Play, Pause, Diamond, DotsSixVertical, DotsThreeVertical, Scissors, Copy, Trash, Camera as CameraIcon, ArrowCounterClockwise, SpeakerHigh, Cube, PencilSimple, ClipboardText, MagicWand, Lightbulb, WaveSine, Eye, EyeSlash } from '@phosphor-icons/react';
import { DesignSystem } from '../../theme';
import { SceneObject, TimelineKeyframe } from '../../engine';
import { Button } from '../Core/Primitives';

interface TimelineProps {
  objects: SceneObject[];
  setObjects: React.Dispatch<React.SetStateAction<SceneObject[]>>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  totalDuration: number;
  onAddKeyframe: () => void;
  selectedKeyframe: { id: string, index: number } | null;
  onSelectKeyframe: (id: string, index: number) => void;
  onRemoveKeyframe: () => void;
  isSnappingEnabled: boolean;
  onCopyAllKeyframesAsYaml: (trackId: string) => void;
  onPasteAllKeyframesFromYaml: (trackId: string) => void;
  onRemoveAllKeyframes: (trackId: string) => void;
  copiedKeyframeYaml: string | null;
}

const CONTEXT_MENU_Z_INDEX = 9999;
const SNAP_INTERVAL = 0.5; // Snap to 0.5s intervals

const EasingGraph: React.FC<{
    animations: TimelineKeyframe[];
    pixelsPerSecond: number;
    height: number;
}> = ({ animations, pixelsPerSecond, height }) => {
    if (animations.length < 1) return null;
    const padding = 4;

    const generatePathData = (startTime: number, arrivalKf: TimelineKeyframe) => {
        const ease = gsap.parseEase(arrivalKf.easing || 'power2.out');
        const duration = arrivalKf.time - startTime;
        if (duration <= 0) return '';
        
        const width = duration * pixelsPerSecond;
        const graphHeight = height - padding * 2;
        const points: string[] = [];
        const samples = Math.max(2, Math.floor(width / 5));

        for (let i = 0; i <= samples; i++) {
            const progress = i / samples;
            const easedProgress = ease(progress);
            const x = progress * width;
            const y = (height - padding) - (easedProgress * graphHeight);
            points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
        }
        return `M ${points.join(' L ')}`;
    };

    const startTimes = [0, ...animations.map(kf => kf.time)];
    
    return (
        <div style={{ 
            position: 'absolute', 
            inset: '6px 0', 
            pointerEvents: 'none', 
            overflow: 'hidden',
            background: 'transparent',
            borderRadius: '4px'
        }}>
            {animations.map((kf, i) => {
                const startTime = startTimes[i];
                const pathData = generatePathData(startTime, kf);
                const left = startTime * pixelsPerSecond;
                const width = (kf.time - startTime) * pixelsPerSecond;
                if (width <= 0) return null;
                
                return (
                    <svg
                        key={i}
                        width={width}
                        height={height}
                        style={{ position: 'absolute', left, top: '-6px', overflow: 'visible' }}
                    >
                        <path
                            d={pathData}
                            fill="none"
                            stroke="var(--accent-surface)"
                            strokeWidth="2"
                            strokeOpacity={0.8}
                            strokeLinecap="round"
                        />
                    </svg>
                );
            })}
        </div>
    );
};

const TrackContextMenu: React.FC<{
  rect: DOMRect;
  trackObject: SceneObject;
  onClose: () => void;
  onRemove: () => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onResetCamera?: () => void;
  onUpdateObject: (id: string, updates: Partial<SceneObject>) => void;
  onCopyAllKeyframes: () => void;
  onPasteAllKeyframes: () => void;
  onRemoveAllKeyframes: () => void;
  copiedKeyframeYaml: string | null;
}> = ({ rect, trackObject, onClose, onRemove, onSplit, onDuplicate, onRename, onResetCamera, onUpdateObject, onCopyAllKeyframes, onPasteAllKeyframes, onRemoveAllKeyframes, copiedKeyframeYaml }) => {
  const isLocked = trackObject.locked || trackObject.type === 'camera' || trackObject.type === 'light';
  
  const menuActions = [
      { label: trackObject.visible !== false ? 'Hide Track' : 'Show Track', icon: trackObject.visible !== false ? <EyeSlash /> : <Eye />, action: () => onUpdateObject(trackObject.id, { visible: !(trackObject.visible !== false) }), disabled: false, danger: false },
      ...(onResetCamera ? [{ label: 'Reset Camera', icon: <ArrowCounterClockwise />, action: onResetCamera, danger: false, disabled: false }] : []),
      { label: 'Rename', icon: <PencilSimple />, action: onRename, disabled: false },
      { label: 'Split Clip', icon: <Scissors />, action: onSplit, disabled: isLocked },
      { label: 'Duplicate', icon: <Copy />, action: onDuplicate, disabled: isLocked },
      { label: 'Delete Track', icon: <Trash />, action: onRemove, danger: true, disabled: isLocked },
  ];
  
  const hasKeyframes = trackObject.animations && trackObject.animations.length > 0;
  const canPaste = copiedKeyframeYaml ? copiedKeyframeYaml.trim().startsWith('-') : false;

  const keyframeActions = [
      { label: 'Copy All Keyframes', icon: <Copy />, action: onCopyAllKeyframes, disabled: !hasKeyframes, danger: false },
      { label: 'Paste Keyframes', icon: <ClipboardText />, action: onPasteAllKeyframes, disabled: !canPaste, danger: false },
      { type: 'divider' },
      { label: 'Remove All Keyframes', icon: <Trash />, action: onRemoveAllKeyframes, disabled: !hasKeyframes, danger: true },
  ];

  return createPortal(
    <>
      <div 
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: CONTEXT_MENU_Z_INDEX - 1 }} 
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -5 }}
        transition={{ duration: 0.1 }}
        style={{
          position: 'fixed',
          top: rect.bottom + 4,
          left: rect.left,
          width: '200px',
          background: DesignSystem.Color.Base.Surface[3],
          border: `1px solid ${DesignSystem.Color.Base.Border[2]}`,
          borderRadius: DesignSystem.Effect.Radius.M,
          padding: '6px',
          zIndex: CONTEXT_MENU_Z_INDEX,
          boxShadow: DesignSystem.Effect.Shadow.Depth,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}
      >
        {menuActions.map((item, i) => (
            <React.Fragment key={i}>
            {i === 1 && <div style={{height: '1px', background: DesignSystem.Color.Base.Border[1], margin: '4px 6px'}} />}
            <div
                onClick={() => { if (!item.disabled) { item.action(); onClose(); } }}
                style={{ 
                    padding: '8px 12px', 
                    ...DesignSystem.Type.Label.S, 
                    color: item.disabled ? DesignSystem.Color.Base.Content[3] : (item.danger ? DesignSystem.Color.Feedback.Error : DesignSystem.Color.Base.Content[1]),
                    cursor: item.disabled ? 'not-allowed' : 'pointer',
                    borderRadius: DesignSystem.Effect.Radius.S,
                    transition: '0.1s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: item.disabled ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled) e.currentTarget.style.background = DesignSystem.Color.Base.Surface[2];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
            >
                {item.icon} {item.label}
            </div>
            </React.Fragment>
        ))}
        <div style={{height: '1px', background: DesignSystem.Color.Base.Border[1], margin: '4px 6px'}} />
        {keyframeActions.map((item: any, i) => (
            item.type === 'divider' ? (
                <div key={`kf-div-${i}`} style={{height: '1px', background: DesignSystem.Color.Base.Border[1], margin: '4px 6px'}} />
            ) : (
                <div key={`kf-${i}`} 
                    onClick={() => { if (!item.disabled && item.action) { item.action(); onClose(); } }}
                    style={{ 
                        padding: '8px 12px', 
                        ...DesignSystem.Type.Label.S, 
                        color: item.disabled ? DesignSystem.Color.Base.Content[3] : (item.danger ? DesignSystem.Color.Feedback.Error : DesignSystem.Color.Base.Content[1]),
                        cursor: item.disabled ? 'not-allowed' : 'pointer',
                        borderRadius: DesignSystem.Effect.Radius.S,
                        transition: '0.1s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        opacity: item.disabled ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!item.disabled) e.currentTarget.style.background = DesignSystem.Color.Base.Surface[2];
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                >
                    {item.icon} {item.label}
                </div>
            )
        ))}
      </motion.div>
    </>,
    document.body
  );
};

const TimelineItem: React.FC<{ 
    obj: SceneObject; 
    isSelected: boolean; 
    pixelsPerSecond: number;
    onClick: () => void;
    onRemove: (id: string) => void;
    onSplit: (id: string) => void;
    onDuplicate: (id: string) => void;
    onUpdateObject: (id: string, updates: Partial<SceneObject>) => void;
    selectedKeyframe: { id: string, index: number } | null;
    onSelectKeyframe: (id: string, index: number) => void;
    isSnappingEnabled: boolean;
    onCopyAllKeyframesAsYaml: (trackId: string) => void;
    onPasteAllKeyframesFromYaml: (trackId: string) => void;
    onRemoveAllKeyframes: (trackId: string) => void;
    copiedKeyframeYaml: string | null;
}> = ({ obj, isSelected, pixelsPerSecond, onClick, onRemove, onSplit, onDuplicate, onUpdateObject, selectedKeyframe, onSelectKeyframe, isSnappingEnabled, onCopyAllKeyframesAsYaml, onPasteAllKeyframesFromYaml, onRemoveAllKeyframes, copiedKeyframeYaml }) => {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const dragControls = useDragControls();
  const [isEditingName, setIsEditingName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLocked = obj.locked || obj.type === 'camera' || obj.type === 'light';

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuButtonRef.current) {
      setMenuRect(menuButtonRef.current.getBoundingClientRect());
      setShowMenu(!showMenu);
    }
  };

  const handleClipDragEnd = (_: any, info: any) => {
    if (isLocked) return;
    const offsetSeconds = info.offset.x / pixelsPerSecond;
    const rawNewTime = obj.startTime + offsetSeconds;
    const finalTime = isSnappingEnabled ? Math.round(rawNewTime / SNAP_INTERVAL) * SNAP_INTERVAL : rawNewTime;
    onUpdateObject(obj.id, { startTime: Math.max(0, finalTime) });
  };
  
  const handleResetCamera = () => {
    onUpdateObject(obj.id, {
        position: [0, 0, 6],
        rotation: [0, 0, 0],
        animations: [],
        fov: 60,
    });
  };

  const startRenaming = () => {
    setIsEditingName(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  
  const getIcon = () => {
      switch(obj.type) {
          case 'camera': return <CameraIcon weight="fill"/>;
          case 'audio': return <SpeakerHigh weight="fill"/>;
          case 'glb': return <Cube weight="fill"/>;
          case 'lottie': return <MagicWand weight="fill" />;
          case 'light': return <Lightbulb weight="fill" />;
          default: return null;
      }
  };

  return (
    <Reorder.Item 
        value={obj} 
        id={obj.id}
        style={{ listStyle: 'none', position: 'relative', width: '100%', height: '48px' }}
        dragListener={isLocked ? false : undefined}
        dragControls={dragControls}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%', display: 'flex' }}>
        {/* Track Header (Sticky) */}
        <div
          onClick={onClick}
          style={{
              position: 'sticky',
              left: 0,
              zIndex: 10,
              width: '160px', 
              height: '100%',
              flexShrink: 0, 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: DesignSystem.Space(2),
              paddingRight: DesignSystem.Space(1),
              borderRight: `1px solid ${DesignSystem.Color.Base.Border[1]}`,
              borderBottom: `1px solid ${DesignSystem.Color.Base.Border[1]}`,
              background: isSelected ? DesignSystem.Color.Base.Surface[3] : DesignSystem.Color.Base.Surface[2],
              transition: 'background 0.2s',
          }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: DesignSystem.Space(2), overflow: 'hidden', flex: 1 }}>
                <motion.div 
                    onPointerDown={(e) => { 
                        e.stopPropagation(); 
                        e.preventDefault();
                        if (!isLocked) dragControls.start(e); 
                    }}
                    style={{ 
                        cursor: isLocked ? 'default' : 'grab', 
                        color: DesignSystem.Color.Base.Content[3], 
                        padding: '4px', 
                        opacity: isLocked ? 0.3 : 1,
                        touchAction: 'none'
                    }}
                    className="drag-handle"
                    whileHover={{ color: DesignSystem.Color.Base.Content[1] }}
                >
                    <DotsSixVertical size={16} weight="bold" />
                </motion.div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', flex: 1 }}>
                     {isEditingName ? (
                         <input 
                            ref={inputRef}
                            defaultValue={obj.name || obj.type.toUpperCase()}
                            onBlur={(e) => { setIsEditingName(false); onUpdateObject(obj.id, { name: e.target.value }); }}
                            onKeyDown={(e) => { if(e.key === 'Enter') e.currentTarget.blur(); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            style={{
                                background: DesignSystem.Color.Base.Surface[1],
                                border: `1px solid ${DesignSystem.Color.Accent.Surface[1]}`,
                                color: DesignSystem.Color.Base.Content[1],
                                borderRadius: '4px',
                                padding: '2px 4px',
                                fontSize: '10px',
                                fontFamily: DesignSystem.Type.Label.S.fontFamily,
                                outline: 'none',
                                width: '100%'
                            }}
                         />
                     ) : (
                         <span 
                            onDoubleClick={startRenaming}
                            style={{ 
                                ...DesignSystem.Type.Label.S, 
                                color: isSelected ? DesignSystem.Color.Accent.Content[2] : DesignSystem.Color.Base.Content[1], 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                cursor: 'text'
                             }}
                         >
                            {getIcon()}
                            {obj.name || (obj.type === 'camera' ? 'MAIN CAMERA' : obj.type.toUpperCase())}
                         </span>
                     )}
                     {!isEditingName && (
                        <span style={{ fontSize: '9px', fontFamily: DesignSystem.Type.Label.S.fontFamily, color: DesignSystem.Color.Base.Content[3] }}>
                            {obj.locked ? 'LOCKED' : `CH ${obj.id.slice(0, 3)}`}
                        </span>
                     )}
                </div>
            </div>
            <button
                ref={menuButtonRef}
                onClick={handleMenuClick}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '4px', display: 'flex', color: DesignSystem.Color.Base.Content[3], transition: 'color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = DesignSystem.Color.Base.Content[1]}
                onMouseLeave={e => e.currentTarget.style.color = DesignSystem.Color.Base.Content[3]}
            ><DotsThreeVertical size={16} weight="bold" /></button>
        </div>

        {/* Track Lane */}
        <div 
            style={{ 
                flex: 1, 
                position: 'relative', 
                height: '100%', 
                background: isSelected ? 'rgba(91, 80, 255, 0.02)' : 'transparent',
                borderBottom: `1px solid ${DesignSystem.Color.Base.Border[1]}`,
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClick(); 
            }}
        >
            <motion.div 
                drag={!isLocked && "x"}
                dragMomentum={false}
                dragElastic={0}
                onDragEnd={handleClipDragEnd}
                onPointerDown={(e) => { e.stopPropagation(); onClick(); }}
                key={`${obj.id}-${obj.startTime}-${obj.duration}`}
                initial={{ x: 0 }}
                style={{
                    position: 'absolute',
                    left: `${obj.startTime * pixelsPerSecond}px`,
                    top: '6px',
                    bottom: '6px',
                    width: `${obj.duration * pixelsPerSecond}px`,
                    background: isLocked 
                        ? 'rgba(255, 255, 255, 0.04)' 
                        : (isSelected 
                            ? 'rgba(255, 255, 255, 0.1)' 
                            : 'rgba(255, 255, 255, 0.06)'),
                    borderRadius: '6px',
                    border: `1px solid ${isSelected ? DesignSystem.Color.Accent.Content[2] : DesignSystem.Color.Base.Border[2]}`,
                    cursor: isLocked ? 'default' : 'grab',
                    overflow: 'visible', // Allow handles to be visible
                    boxShadow: isSelected ? DesignSystem.Effect.Shadow.Glow : 'none',
                    zIndex: 1,
                    transition: 'background 0.2s ease-in-out'
                }}
                whileHover={{ filter: 'brightness(1.2)' }}
                whileDrag={{ cursor: 'grabbing', zIndex: 2, boxShadow: DesignSystem.Effect.Shadow.Depth }}
            >
                 <EasingGraph 
                    animations={obj.animations} 
                    pixelsPerSecond={pixelsPerSecond} 
                    height={34} 
                 />
                {/* Trim Handles */}
                {!isLocked && (
                    <>
                        <motion.div
                            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '8px', cursor: 'ew-resize', zIndex: 4, display: 'flex', alignItems: 'center' }}
                            drag="x" dragMomentum={false} dragElastic={0} onPointerDown={e => e.stopPropagation()}
                            onDragEnd={(_, info) => {
                                const offsetSeconds = info.offset.x / pixelsPerSecond;
                                const rawNewStartTime = obj.startTime + offsetSeconds;
                                const snappedStartTime = isSnappingEnabled
                                    ? Math.max(0, Math.round(rawNewStartTime / SNAP_INTERVAL) * SNAP_INTERVAL)
                                    : Math.max(0, rawNewStartTime);
                                const endTime = obj.startTime + obj.duration;
                                const newDuration = endTime - snappedStartTime;

                                if (newDuration >= SNAP_INTERVAL) {
                                    onUpdateObject(obj.id, { startTime: snappedStartTime, duration: newDuration });
                                }
                            }}
                        >
                            <div style={{ width: '4px', height: '60%', background: 'rgba(255,255,255,0.5)', borderRadius: '2px' }} />
                        </motion.div>

                        <motion.div
                            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '8px', cursor: 'ew-resize', zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
                            drag="x" dragMomentum={false} dragElastic={0} onPointerDown={e => e.stopPropagation()}
                            onDragEnd={(_, info) => {
                                const offsetSeconds = info.offset.x / pixelsPerSecond;
                                const rawNewDuration = obj.duration + offsetSeconds;
                                const snappedDuration = isSnappingEnabled
                                    ? Math.round(rawNewDuration / SNAP_INTERVAL) * SNAP_INTERVAL
                                    : rawNewDuration;

                                if (snappedDuration >= SNAP_INTERVAL) {
                                    onUpdateObject(obj.id, { duration: snappedDuration });
                                }
                            }}
                        >
                            <div style={{ width: '4px', height: '60%', background: 'rgba(255,255,255,0.5)', borderRadius: '2px' }} />
                        </motion.div>
                    </>
                )}

                <div style={{ padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center', pointerEvents: 'none', overflow: 'hidden' }}>
                    <span style={{ ...DesignSystem.Type.Label.S, fontSize: '10px', color: isSelected ? DesignSystem.Color.Accent.Content[1] : DesignSystem.Color.Base.Content[2], whiteSpace: 'nowrap' }}>
                        {obj.type === 'video' ? 'VIDEO CLIP' :