
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, Reorder, AnimatePresence, useDragControls } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Play, Pause, Diamond, DotsSixVertical, Plus, DotsThreeVertical, Scissors, Copy, Trash, Camera as CameraIcon, ArrowCounterClockwise, SpeakerHigh, Cube, PencilSimple } from '@phosphor-icons/react';
import { DesignSystem } from '../../theme';
import { SceneObject } from '../../engine';
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
}

const CONTEXT_MENU_Z_INDEX = 9999;
const SNAP_INTERVAL = 0.5; // Snap to 0.5s intervals

const TrackContextMenu: React.FC<{
  rect: DOMRect;
  isLocked?: boolean;
  onClose: () => void;
  onRemove: () => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onResetCamera?: () => void;
}> = ({ rect, isLocked, onClose, onRemove, onSplit, onDuplicate, onRename, onResetCamera }) => {
  const menuActions = [
      ...(onResetCamera ? [{ label: 'Reset Camera', icon: <ArrowCounterClockwise />, action: onResetCamera, danger: false, disabled: false }] : []),
      { label: 'Rename', icon: <PencilSimple />, action: onRename, disabled: false },
      { label: 'Split Clip', icon: <Scissors />, action: onSplit, disabled: isLocked },
      { label: 'Duplicate', icon: <Copy />, action: onDuplicate, disabled: isLocked },
      { label: 'Delete Track', icon: <Trash />, action: onRemove, danger: true, disabled: isLocked },
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
          width: '180px',
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
            <div key={i} 
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
}> = ({ obj, isSelected, pixelsPerSecond, onClick, onRemove, onSplit, onDuplicate, onUpdateObject, selectedKeyframe, onSelectKeyframe }) => {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const dragControls = useDragControls();
  const [isEditingName, setIsEditingName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLocked = obj.type === 'camera';

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
    const snappedTime = Math.round(rawNewTime / SNAP_INTERVAL) * SNAP_INTERVAL;
    onUpdateObject(obj.id, { startTime: Math.max(0, snappedTime) });
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
          default: return null;
      }
  };

  return (
    <Reorder.Item 
        value={obj} 
        id={obj.id}
        // Removed drag={!isLocked} - Reorder.Item should be solely controlled by dragControls when dragListener is false.
        style={{ listStyle: 'none', position: 'relative', height: '48px', width: '100%' }}
        dragListener={false}
        dragControls={dragControls}
    >
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, display: 'flex' }}>
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
                    // Explicitly prevent default browser scroll behavior and stop event propagation
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
                        touchAction: 'none' // Explicitly disable touch-scrolling on this element
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
                            {obj.id === 'camera-main' ? 'LOCKED' : `CH ${obj.id.slice(0, 3)}`}
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
                    background: isLocked ? 'rgba(255, 255, 255, 0.05)' : (isSelected ? DesignSystem.Color.Accent.Surface[2] : DesignSystem.Color.Base.Surface[3]),
                    borderRadius: '6px',
                    border: `1px solid ${isSelected ? DesignSystem.Color.Accent.Content[2] : DesignSystem.Color.Base.Border[2]}`,
                    cursor: isLocked ? 'default' : 'grab',
                    overflow: 'visible', // Allow handles to be visible
                    boxShadow: isSelected ? DesignSystem.Effect.Shadow.Glow : 'none',
                    zIndex: 1
                }}
                whileHover={{ filter: 'brightness(1.1)' }}
                whileDrag={{ cursor: 'grabbing', zIndex: 2, boxShadow: DesignSystem.Effect.Shadow.Depth }}
            >
                {/* Trim Handles */}
                {!isLocked && (
                    <>
                        <motion.div
                            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '8px', cursor: 'ew-resize', zIndex: 4, display: 'flex', alignItems: 'center' }}
                            drag="x" dragMomentum={false} dragElastic={0} onPointerDown={e => e.stopPropagation()}
                            onDragEnd={(_, info) => {
                                const offsetSeconds = info.offset.x / pixelsPerSecond;
                                const rawNewStartTime = obj.startTime + offsetSeconds;
                                const snappedStartTime = Math.max(0, Math.round(rawNewStartTime / SNAP_INTERVAL) * SNAP_INTERVAL);
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
                                const snappedDuration = Math.round(rawNewDuration / SNAP_INTERVAL) * SNAP_INTERVAL;

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
                        style={{
                            position: 'absolute',
                            left: `${kf.time * pixelsPerSecond}px`,
                            bottom: '4px',
                            transform: 'translateX(-50%) rotate(45deg)',
                            width: isKfSelected ? '10px' : '6px', 
                            height: isKfSelected ? '10px' : '6px',
                            background: isKfSelected ? DesignSystem.Color.Feedback.Warning : '#fff',
                            border: isKfSelected ? `2px solid ${DesignSystem.Color.Base.Surface[1]}` : 'none',
                            borderRadius: '1px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
                            zIndex: 10,
                            cursor: 'pointer',
                            transition: 'all 0.1s'
                        }} 
                    />
                  )
                })}
            </motion.div>
        </div>
      </div>
      <AnimatePresence>
          {showMenu && menuRect && (
              <TrackContextMenu 
                  rect={menuRect} 
                  isLocked={isLocked}
                  onClose={() => setShowMenu(false)} 
                  onRemove={() => onRemove(obj.id)} 
                  onSplit={() => onSplit(obj.id)} 
                  onDuplicate={() => onDuplicate(obj.id)}
                  onRename={startRenaming}
                  onResetCamera={obj.type === 'camera' ? handleResetCamera : undefined}
              />
          )}
      </AnimatePresence>
    </Reorder.Item>
  );
};

export const TimelineSequencer: React.FC<TimelineProps> = ({ 
    objects, setObjects, selectedId, onSelect, isPlaying, onTogglePlay,
    currentTime, setCurrentTime, totalDuration, onAddKeyframe, selectedKeyframe, onSelectKeyframe, onRemoveKeyframe
}) => {
  const pixelsPerSecond = 100;
  const trackHeaderWidth = 160;
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  
  const handleRemoveObject = (id: string) => {
    setObjects(prev => prev.filter(obj => obj.id !== id));
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
  
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (!timelineContainerRef.current) return;
      const clickX = e.clientX - rect.left; 
      const timeX = (clickX) - trackHeaderWidth; 
      const newTime = Math.max(0, timeX / pixelsPerSecond);
      setCurrentTime(newTime);
  };

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

  const rulerWidth = totalDuration * pixelsPerSecond;
  const totalWidth = rulerWidth + trackHeaderWidth;

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
            <div style={{ minWidth: `${totalWidth}px`, height: '100%', display: 'flex', flexDirection: 'column' }}>
                
                {/* Sticky Ruler */}
                <div 
                    onClick={handleRulerClick}
                    style={{ 
                        position: 'sticky', 
                        top: 0, 
                        height: '32px', 
                        background: DesignSystem.Color.Base.Surface[2], 
                        borderBottom: `1px solid ${DesignSystem.Color.Base.Border[1]}`, 
                        display: 'flex', 
                        zIndex: 20,
                        cursor: 'crosshair',
                        width: '100%' 
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
                        zIndex: 21,
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
                    <div style={{ flex: 1, position: 'relative' }}>
                         {Array.from({ length: totalDuration + 1 }).map((_, i) => (
                            <div key={i} style={{ 
                                position: 'absolute', 
                                left: `${i * pixelsPerSecond}px`, 
                                top: 0, 
                                bottom: 0, 
                                display: 'flex', 
                                flexDirection: 'column',
                                alignItems: 'flex-start'
                            }}>
                                <div style={{ height: '8px', width: '1px', background: 'rgba(255,255,255,0.3)' }} />
                                <span style={{ marginLeft: '4px', fontSize: '9px', fontFamily: 'monospace', color: DesignSystem.Color.Base.Content[3] }}>{i}s</span>
                            </div>
                        ))}
                         {Array.from({ length: totalDuration * 4 }).map((_, i) => (
                            <div key={`sub-${i}`} style={{ 
                                position: 'absolute', 
                                left: `${i * (pixelsPerSecond / 4)}px`, 
                                top: 0, 
                                height: '4px', 
                                width: '1px', 
                                background: 'rgba(255,255,255,0.1)' 
                            }} />
                        ))}
                    </div>
                </div>

                {/* Tracks Area */}
                <div style={{ position: 'relative', flex: 1 }}>
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

                    {/* Playhead Line */}
                    <motion.div 
                        style={{
                            position: 'absolute',
                            left: `${trackHeaderWidth}px`,
                            top: 0, 
                            bottom: 0,
                            width: '1px',
                            background: DesignSystem.Color.Accent.Surface[1],
                            zIndex: 15,
                            pointerEvents: 'none',
                            x: currentTime * pixelsPerSecond,
                            boxShadow: `0 0 8px ${DesignSystem.Color.Accent.Surface[1]}`
                        }}
                    >
                        <div style={{ 
                            position: 'absolute', 
                            top: '-5px', 
                            left: '-5px', 
                            width: '11px', 
                            height: '11px', 
                            background: DesignSystem.Color.Accent.Surface[1], 
                            transform: 'rotate(45deg)', 
                            borderRadius: '2px', 
                            boxShadow: '0 2px 4px rgba(0,0,0,0.5)' 
                        }} />
                    </motion.div>

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
