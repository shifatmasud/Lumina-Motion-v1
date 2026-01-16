
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
                        {obj.type === 'video' ? 'VIDEO CLIP' : (obj.type === 'camera' ? 'CAMERA SEQUENCE' : (obj.type === 'audio' ? 'AUDIO TRACK' : 'ANIMATION SEQUENCE'))}
                    </span>
                </div>

                {/* Keyframes visualization */}
                {obj.animations?.map((kf, index) => {
                  const isKfSelected = selectedKeyframe?.id === obj.id && selectedKeyframe.index === index;
                  return (
                    <div
                      key={`${obj.id}-${index}-${kf.time}`}
                      onClick={(e) => { e.stopPropagation(); onSelectKeyframe(obj.id, index); }}
                      title={kf.name || `Keyframe at ${kf.time.toFixed(2)}s`}
                      style={{
                        position: 'absolute',
                        left: `${kf.time * pixelsPerSecond}px`,
                        bottom: '-5px',
                        width: '24px',
                        height: '24px',
                        transform: 'translateX(-50%)',
                        cursor: 'pointer',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          transform: 'rotate(45deg)',
                          width: isKfSelected ? '10px' : '6px',
                          height: isKfSelected ? '10px' : '6px',
                          background: isKfSelected ? DesignSystem.Color.Feedback.Warning : '#fff',
                          border: isKfSelected ? `2px solid ${DesignSystem.Color.Base.Surface[1]}` : 'none',
                          borderRadius: '1px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
                          transition: 'all 0.1s',
                        }}
                      />
                    </div>
                  );
                })}
            </motion.div>
        </div>
      </div>
      <AnimatePresence>
          {showMenu && menuRect && (
              <TrackContextMenu 
                  rect={menuRect} 
                  trackObject={obj}
                  onClose={() => setShowMenu(false)} 
                  onRemove={() => onRemove(obj.id)} 
                  onSplit={() => onSplit(obj.id)} 
                  onDuplicate={() => onDuplicate(obj.id)}
                  onRename={startRenaming}
                  onResetCamera={obj.type === 'camera' ? handleResetCamera : undefined}
                  onUpdateObject={onUpdateObject}
                  onCopyAllKeyframes={() => onCopyAllKeyframesAsYaml(obj.id)}
                  onPasteAllKeyframes={() => onPasteAllKeyframesFromYaml(obj.id)}
                  onRemoveAllKeyframes={() => onRemoveAllKeyframes(obj.id)}
                  copiedKeyframeYaml={copiedKeyframeYaml}
              />
          )}
      </AnimatePresence>
    </Reorder.Item>
  );
};

export const TimelineSequencer: React.FC<TimelineProps> = ({ 
    objects, setObjects, selectedId, onSelect, isPlaying, onTogglePlay,
    currentTime, setCurrentTime, totalDuration, onAddKeyframe, selectedKeyframe, 
    onSelectKeyframe, onRemoveKeyframe, isSnappingEnabled,
    onCopyAllKeyframesAsYaml, onPasteAllKeyframesFromYaml, onRemoveAllKeyframes, copiedKeyframeYaml
}) => {
  const pixelsPerSecond = 100;
  const trackHeaderWidth = 160;
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const isDraggingPlayhead = useRef(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  
  // Use motion values for smooth, non-render-blocking playhead animation
  const motionCurrentTime = useMotionValue(currentTime);
  const playheadX = useTransform(motionCurrentTime, (time) => time * pixelsPerSecond);

  useEffect(() => {
    // Sync motion value when currentTime prop changes from state
    motionCurrentTime.set(currentTime);
  }, [currentTime, motionCurrentTime]);
  
  const handleRemoveObject = (id: string) => {
    setObjects(prev => prev.filter(obj => obj.id !== id && !obj.locked));
  };
  
  const handleUpdateObject = (id: string, updates: Partial<SceneObject>) => {
    setObjects(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const handleDuplicate = (id: string) => {
      const obj = objects.find(o => o.id === id);
      if (!obj) return;
      const newObj = { ...obj, id: uuidv4(), startTime: obj.startTime + 0.5, name: `${obj.name || obj.type} Copy` };
      setObjects(prev => [...prev, newObj]);
  };

  const handleSplit = (idToSplit: string) => {
      const objectToSplit = objects.find(o => o.id === idToSplit);
      if (!objectToSplit || currentTime <= objectToSplit.startTime || currentTime >= objectToSplit.startTime + objectToSplit.duration) {
          return;
      }
      const splitOffset = currentTime - objectToSplit.startTime;
      const newDuration1 = splitOffset;
      const newDuration2 = objectToSplit.duration - splitOffset;

      const newObject1 = { ...objectToSplit, duration: newDuration1 };
      const newObject2 = { ...objectToSplit, id: uuidv4(), startTime: currentTime, duration: newDuration2, animations: [], name: `${objectToSplit.name || objectToSplit.type} Split` }; 
      
      setObjects(prev => prev.map(o => o.id === idToSplit ? newObject1 : o).concat(newObject2));
  };

  const onScrubberPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!timelineContainerRef.current) return;
    const scrollContainer = timelineContainerRef.current;

    isDraggingPlayhead.current = true;
    setIsScrubbing(true);
    if (isPlaying) onTogglePlay();

    // FIX: Use a compatible event type for both React synthetic events and native events.
    const handleInteraction = (event: { clientX: number }) => {
        const scrollContainerRect = scrollContainer.getBoundingClientRect();
        const clickInContainer = event.clientX - scrollContainerRect.left;
        const contentX = scrollContainer.scrollLeft + clickInContainer;
        const timeAreaX = contentX - trackHeaderWidth;

        const newTime = Math.max(0, timeAreaX / pixelsPerSecond);
        
        const finalTime = isSnappingEnabled ? Math.round(newTime / SNAP_INTERVAL) * SNAP_INTERVAL : newTime;

        const clampedTime = Math.min(finalTime, totalDuration);
        setCurrentTime(clampedTime);
    };
    
    handleInteraction(e);

    const onPointerMove = (moveEvent: PointerEvent) => {
        if (isDraggingPlayhead.current) {
            handleInteraction(moveEvent);
        }
    };
    
    const onPointerUp = () => {
        isDraggingPlayhead.current = false;
        setIsScrubbing(false);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
    };
    
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [isPlaying, onTogglePlay, pixelsPerSecond, setCurrentTime, totalDuration, isSnappingEnabled]);
  

  useEffect(() => {
      if (isPlaying && timelineContainerRef.current) {
          const playheadX = currentTime * pixelsPerSecond;
          const container = timelineContainerRef.current;
          const center = container.clientWidth / 2;
          
          if (playheadX > container.scrollLeft + center || playheadX < container.scrollLeft) {
             container.scrollTo({ left: playheadX - center, behavior: 'auto' });
          }
      }
  }, [currentTime, isPlaying, pixelsPerSecond]);

  const totalWidth = totalDuration * pixelsPerSecond + trackHeaderWidth;

  const renderRulerTicks = () => {
    const ticks = [];
    for (let i = 0; i <= totalDuration; i++) {
        // Major Tick (Seconds)
        ticks.push(
            <div key={i} style={{ position: 'absolute', left: i * pixelsPerSecond, top: 0, height: '100%', pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderLeft: `1px solid ${DesignSystem.Color.Base.Content[3]}` }}>
                <span style={{ marginLeft: '4px', marginBottom: '2px', fontSize: '9px', fontFamily: DesignSystem.Type.Label.S.fontFamily, color: DesignSystem.Color.Base.Content[3], fontWeight: 500 }}>{i}s</span>
            </div>
        );
        // Half-second tick (Minimalist)
        if (i < totalDuration) {
             ticks.push(
                <div key={`${i}-half`} style={{ position: 'absolute', left: (i + 0.5) * pixelsPerSecond, bottom: 0, width: '1px', height: '6px', background: DesignSystem.Color.Base.Content[3], opacity: 0.3 }} />
            );
        }
    }
    return ticks;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: DesignSystem.Color.Base.Surface[1], userSelect: 'none' }}>
        {/* Toolbar */}
        <div style={{ height: '48px', borderBottom: `1px solid ${DesignSystem.Color.Base.Border[1]}`, display: 'flex', alignItems: 'center', padding: `0 ${DesignSystem.Space(2)}`, gap: DesignSystem.Space(2), background: DesignSystem.Color.Base.Surface['3b'], backdropFilter: 'blur(20px)', zIndex: 20 }}>
             <Button active={isPlaying} onClick={onTogglePlay} style={{ width: '36px', height: '36px', borderRadius: '50%' }}>
                 {isPlaying ? <Pause weight="fill" size={16} /> : <Play weight="fill" size={16} />}
             </Button>
             <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <span style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Accent.Content[2], fontSize: '16px' }}>
                    {Math.floor(currentTime / 60).toString().padStart(2, '0')}:{(currentTime % 60).toFixed(2).padStart(5, '0')}
                 </span>
                 <span style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[3], fontSize: '9px' }}>
                    {Math.floor(currentTime * 24)} FRAMES
                 </span>
             </div>
             
             <div style={{ flex: 1 }} />
             
             <div style={{ display: 'flex', gap: '8px' }}>
                <Button onClick={() => setCurrentTime(0)} variant="ghost" style={{ padding: '0 8px' }}>
                    <span style={DesignSystem.Type.Label.S}>RESET</span>
                </Button>
                <div style={{ width: '1px', height: '20px', background: DesignSystem.Color.Base.Border[1], alignSelf: 'center' }} />
                <Button onClick={onAddKeyframe} disabled={!selectedId} variant="primary" style={{ padding: '0 12px', height: '32px' }}>
                    <Diamond size={14} style={{ marginRight: '6px' }} weight="fill" /> 
                    KEYFRAME
                </Button>
             </div>
        </div>

        {/* Scrollable Timeline Area */}
        <div 
            ref={timelineContainerRef} 
            style={{ 
                flex: 1, 
                position: 'relative', 
                overflow: 'auto', 
                background: '#080808',
                overscrollBehavior: 'none' 
            }}
        >
            <div style={{ minWidth: `${totalWidth}px`, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                
                {/* Sticky Ruler Container */}
                <div 
                    ref={rulerRef}
                    onPointerDown={onScrubberPointerDown}
                    style={{ 
                        position: 'sticky', 
                        top: 0, 
                        height: '48px',
                        background: DesignSystem.Color.Base.Surface[2], 
                        borderBottom: `1px solid ${DesignSystem.Color.Base.Border[1]}`, 
                        display: 'flex', 
                        zIndex: 30,
                        width: '100%',
                        cursor: 'ew-resize',
                        touchAction: 'none' 
                    }}
                >
                    {/* Corner */}
                    <div style={{ 
                        width: `${trackHeaderWidth}px`, 
                        flexShrink: 0, 
                        borderRight: `1px solid ${DesignSystem.Color.Base.Border[1]}`, 
                        background: DesignSystem.Color.Base.Surface[2],
                        position: 'sticky',
                        left: 0,
                        zIndex: 31,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: DesignSystem.Color.Base.Content[3],
                        fontSize: '10px',
                        fontWeight: 600
                    }}>
                        TIMELINE
                    </div>

                    {/* Time Marks */}
                    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                         {renderRulerTicks()}
                    </div>
                </div>

                {/* PLAYHEAD */}
                <motion.div
                    style={{
                        position: 'absolute',
                        left: `calc(${trackHeaderWidth}px - 12px)`,
                        top: '48px', // Start below the ruler
                        bottom: 0,
                        x: playheadX,
                        width: '24px',
                        zIndex: 50,
                        pointerEvents: 'none',
                    }}
                >
                    {/* Line */}
                    <div style={{
                        position: 'absolute',
                        left: '12px',
                        top: 0,
                        width: '1px',
                        height: '100%', // Span the track area
                        background: DesignSystem.Color.Accent.Surface[1],
                        boxShadow: `0 0 4px ${DesignSystem.Color.Accent.Surface[1]}`,
                        opacity: 0.8
                    }} />

                    {/* Diamond Handle (Positioned relative to its parent, moving up into the ruler) */}
                    <div style={{
                        position: 'absolute',
                        top: '-29px',
                        left: '7px',
                        width: '10px',
                        height: '10px',
                        transform: 'rotate(45deg)',
                        background: DesignSystem.Color.Accent.Surface[1],
                        borderRadius: '2px',
                        border: `1px solid ${DesignSystem.Color.Base.Surface[1]}`,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }} />
                </motion.div>

                {/* Tracks Area */}
                <div style={{ position: 'relative', flex: 1, minHeight: '150px' }}>
                    {/* Background Grid */}
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', paddingLeft: `${trackHeaderWidth}px` }}>
                         {Array.from({ length: totalDuration + 1 }).map((_, i) => (
                            <div key={i} style={{ 
                                position: 'absolute', 
                                left: `${trackHeaderWidth + i * pixelsPerSecond}px`, 
                                top: 0, 
                                bottom: 0, 
                                width: '1px', 
                                background: 'rgba(255,255,255,0.03)' 
                            }} />
                        ))}
                    </div>

                    {/* Sortable Tracks */}
                    <Reorder.Group axis="y" values={objects} onReorder={setObjects} style={{ margin: 0, padding: 0, minHeight: '100px' }}>
                        {objects.map(obj => (
                            <TimelineItem 
                                key={obj.id} 
                                obj={obj} 
                                isSelected={selectedId === obj.id} 
                                pixelsPerSecond={pixelsPerSecond} 
                                onClick={() => onSelect(obj.id)} 
                                onRemove={handleRemoveObject} 
                                onSplit={handleSplit}
                                onDuplicate={handleDuplicate}
                                onUpdateObject={handleUpdateObject}
                                selectedKeyframe={selectedKeyframe}
                                onSelectKeyframe={onSelectKeyframe}
                                isSnappingEnabled={isSnappingEnabled}
                                onCopyAllKeyframesAsYaml={onCopyAllKeyframesAsYaml}
                                onPasteAllKeyframesFromYaml={onPasteAllKeyframesFromYaml}
                                onRemoveAllKeyframes={onRemoveAllKeyframes}
                                copiedKeyframeYaml={copiedKeyframeYaml}
                            />
                        ))}
                    </Reorder.Group>
                    
                    {/* Empty State */}
                    {objects.length === 0 && (
                        <div style={{ 
                            height: '200px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '12px',
                            color: DesignSystem.Color.Base.Content[3] 
                        }}>
                             <Diamond size={32} weight="duotone" />
                             <span style={DesignSystem.Type.Label.S}>NO OBJECTS IN SEQUENCE</span>
                             <Button variant="ghost" onClick={onAddKeyframe} style={{ fontSize: '10px' }}>+ ADD OBJECT FROM ASSETS</Button>
                        </div>
                    )}
                    
                    <div style={{ height: '100px' }} />
                </div>
            </div>
        </div>
    </div>
  );
};
