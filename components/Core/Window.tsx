


import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { DotsThree, ArrowCounterClockwise, ArrowClockwise, CornersOut, Minus, X, Gear, ToggleRight, MagicWand, Copy, ClipboardText } from '@phosphor-icons/react';
import { DesignSystem } from '../../theme';
import { Button } from './Primitives';
import { TimelineKeyframe } from '../../engine';

interface WindowProps {
  id: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  height?: number;
  onUndo?: () => void;
  onRedo?: () => void;
  isSnappingEnabled?: boolean;
  onToggleSnapping?: () => void;
  onResetScene?: () => void;
  onOpenProjectSettings?: () => void;
  easingMode?: 'arrival' | 'departure';
  onToggleEasingMode?: () => void;
  selectedKeyframe?: { id: string, index: number } | null;
  copiedKeyframeYaml?: string | null;
  onCopyKeyframeAsYaml?: () => void;
  onPasteKeyframeFromYaml?: () => void;
}

// Context Menu Portal
const ContextMenu: React.FC<{
  rect: DOMRect;
  onClose: () => void;
  windowId: string;
  isSnappingEnabled?: boolean;
  onToggleSnapping?: () => void;
  onResetScene?: () => void;
  onOpenProjectSettings?: () => void;
  easingMode?: 'arrival' | 'departure';
  onToggleEasingMode?: () => void;
  selectedKeyframe?: { id: string, index: number } | null;
  copiedKeyframeYaml?: string | null;
  onCopyKeyframeAsYaml?: () => void;
  onPasteKeyframeFromYaml?: () => void;
}> = ({ 
    rect, onClose, windowId, isSnappingEnabled, onToggleSnapping, onResetScene, onOpenProjectSettings, easingMode, onToggleEasingMode,
    selectedKeyframe, copiedKeyframeYaml, onCopyKeyframeAsYaml, onPasteKeyframeFromYaml
}) => {
  const handleItemClick = (action?: () => void) => {
    action?.();
    onClose();
  };
  
  const baseItems = ['Reset Position', 'Minimize', 'Help'];

  const menuItemStyle: React.CSSProperties = { 
      padding: '8px 12px', 
      ...DesignSystem.Type.Label.S, 
      color: DesignSystem.Color.Base.Content[2],
      cursor: 'pointer',
      borderRadius: DesignSystem.Effect.Radius.S,
      transition: '0.1s',
      display: 'flex',
      alignItems: 'center',
      gap: DesignSystem.Space(2)
  };

  const menuItemHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.currentTarget.style.cursor !== 'not-allowed') {
        e.currentTarget.style.background = DesignSystem.Color.Base.Surface[3];
        e.currentTarget.style.color = DesignSystem.Color.Base.Content[1];
    }
  };

  const menuItemLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = 'transparent';
    e.currentTarget.style.color = DesignSystem.Color.Base.Content[2];
  };

  const canPaste = !!(selectedKeyframe && copiedKeyframeYaml);

  return createPortal(
    <>
      <div 
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 10000 }} 
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -5 }}
        transition={{ duration: 0.1 }}
        style={{
          position: 'fixed',
          top: rect.bottom + 8,
          left: rect.left,
          width: '180px',
          background: DesignSystem.Color.Base.Surface[2],
          border: `1px solid ${DesignSystem.Color.Base.Border[2]}`,
          borderRadius: DesignSystem.Effect.Radius.M,
          padding: '6px',
          zIndex: 10001,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}
      >
        {windowId === 'assets' && onOpenProjectSettings && (
            <>
            <div 
                onClick={() => handleItemClick(onOpenProjectSettings)}
                style={menuItemStyle}
                onMouseEnter={menuItemHover} onMouseLeave={menuItemLeave}
            >
                <Gear size={14} /> Project Settings
            </div>
            <div style={{height: '1px', background: DesignSystem.Color.Base.Border[1], margin: '4px 6px'}} />
            </>
        )}
        {windowId === 'props' && (
            <>
                <div 
                    onClick={() => { if (selectedKeyframe) handleItemClick(onCopyKeyframeAsYaml); }}
                    style={{...menuItemStyle, opacity: selectedKeyframe ? 1 : 0.5, cursor: selectedKeyframe ? 'pointer' : 'not-allowed'}}
                    onMouseEnter={menuItemHover} onMouseLeave={menuItemLeave}
                >
                    <Copy size={14} /> Copy as YAML
                </div>
                 <div 
                    onClick={() => { if (selectedKeyframe) handleItemClick(onPasteKeyframeFromYaml); }}
                    style={{...menuItemStyle, opacity: selectedKeyframe ? 1 : 0.5, cursor: selectedKeyframe ? 'pointer' : 'not-allowed'}}
                    onMouseEnter={menuItemHover} onMouseLeave={menuItemLeave}
                >
                    <ClipboardText size={14} /> Paste from YAML
                </div>
                {onResetScene && <div style={{height: '1px', background: DesignSystem.Color.Base.Border[1], margin: '4px 6px'}} />}
            </>
        )}
        {windowId === 'props' && onResetScene && (
            <>
            <div 
                onClick={() => handleItemClick(onResetScene)}
                style={{ ...menuItemStyle, color: DesignSystem.Color.Feedback.Error }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 68, 68, 0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
                <ArrowCounterClockwise size={14} /> Reset Scene
            </div>
            <div style={{height: '1px', background: DesignSystem.Color.Base.Border[1], margin: '4px 6px'}} />
            </>
        )}
        {windowId === 'timeline' && (
            <>
                {onToggleSnapping && (
                    <div onClick={() => handleItemClick(onToggleSnapping)} style={menuItemStyle} onMouseEnter={menuItemHover} onMouseLeave={menuItemLeave}>
                        <ToggleRight size={14} /> {isSnappingEnabled ? 'Disable Snapping' : 'Enable Snapping'}
                    </div>
                )}
                {onToggleEasingMode && (
                    <div onClick={() => handleItemClick(onToggleEasingMode)} style={menuItemStyle} onMouseEnter={menuItemHover} onMouseLeave={menuItemLeave}>
                       <MagicWand size={14} /> Easing: {easingMode === 'arrival' ? 'On Arrival' : 'On Departure'}
                    </div>
                )}
                <div style={{height: '1px', background: DesignSystem.Color.Base.Border[1], margin: '4px 6px'}} />
            </>
        )}
        {baseItems.map(item => (
            <div key={item} 
                onClick={() => handleItemClick()}
                style={menuItemStyle}
                onMouseEnter={menuItemHover} onMouseLeave={menuItemLeave}
            >
                {item}
            </div>
        ))}
      </motion.div>
    </>,
    document.body
  );
};

export const Window: React.FC<WindowProps> = ({
  id,
  title,
  isOpen,
  onClose,
  children,
  width = 360,
  height = 500,
  onUndo,
  onRedo,
  isSnappingEnabled,
  onToggleSnapping,
  onResetScene,
  onOpenProjectSettings,
  easingMode,
  onToggleEasingMode,
  selectedKeyframe,
  copiedKeyframeYaml,
  onCopyKeyframeAsYaml,
  onPasteKeyframeFromYaml,
}) => {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const dragControls = useDragControls();

  const handleMenuClick = () => {
    if (menuButtonRef.current) {
      setMenuRect(menuButtonRef.current.getBoundingClientRect());
      setShowMenu(!showMenu);
    }
  };

  useEffect(() => {
    if (showMenu) setShowMenu(false);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key={id}
          initial={{ opacity: 0, scale: 0.95, y: 20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.95, y: 10, filter: 'blur(10px)' }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          drag
          dragListener={false}
          dragControls={dragControls}
          dragMomentum={false}
          style={{
            position: 'absolute',
            left: `calc(50vw - ${width / 2}px)`,
            top: `calc(50vh - ${height / 2}px)`,
            width: width,
            height: height,
            maxWidth: '90vw',
            maxHeight: '80vh',
            backgroundColor: DesignSystem.Color.Base.Surface['3b'],
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            borderRadius: DesignSystem.Effect.Radius.L,
            border: `1px solid ${DesignSystem.Color.Base.Border[1]}`,
            boxShadow: DesignSystem.Effect.Shadow.Depth,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 100,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="window-header"
            style={{
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `0 ${DesignSystem.Space(2)} 0 ${DesignSystem.Space(3)}`,
              borderBottom: `1px solid ${DesignSystem.Color.Base.Border[1]}`,
              cursor: 'grab',
              flexShrink: 0,
              background: 'rgba(255,255,255,0.01)',
              touchAction: 'none'
            }}
            onPointerDown={(e) => {
               if ((e.target as HTMLElement).closest('button')) return;
               dragControls.start(e);
            }}
          >
             <div style={{ display: 'flex', alignItems: 'center', gap: DesignSystem.Space(2) }}>
                 <button
                    ref={menuButtonRef}
                    onClick={handleMenuClick}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: DesignSystem.Color.Base.Content[3],
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                      borderRadius: '4px',
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = DesignSystem.Color.Base.Content[1]}
                    onMouseLeave={(e) => e.currentTarget.style.color = DesignSystem.Color.Base.Content[3]}
                 >
                    <DotsThree size={20} weight="bold" />
                 </button>
                 
                 <span style={{ 
                     ...DesignSystem.Type.Label.S, 
                     color: DesignSystem.Color.Base.Content[1],
                     opacity: 0.9
                 }}>
                     {title}
                 </span>
             </div>

             <button
                 onClick={onClose}
                 style={{
                     width: '24px',
                     height: '24px',
                     borderRadius: DesignSystem.Effect.Radius.S,
                     background: 'transparent',
                     border: 'none',
                     cursor: 'pointer',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     color: DesignSystem.Color.Base.Content[3],
                     transition: 'all 0.2s'
                 }}
                 onMouseEnter={(e) => {
                     e.currentTarget.style.background = DesignSystem.Color.Feedback.Error;
                     e.currentTarget.style.color = '#fff';
                 }}
                 onMouseLeave={(e) => {
                     e.currentTarget.style.background = 'transparent';
                     e.currentTarget.style.color = DesignSystem.Color.Base.Content[3];
                 }}
             >
                 <X size={14} weight="bold" />
             </button>
          </div>

          {/* Body */}
          <div style={{ 
              flex: 1, 
              overflow: 'auto', 
              padding: DesignSystem.Space(3),
              position: 'relative',
          }} onPointerDown={(e) => e.stopPropagation()}>
            {children}
          </div>

          {/* Footer */}
          <div style={{
             height: '40px',
             borderTop: `1px solid ${DesignSystem.Color.Base.Border[1]}`,
             background: 'rgba(0,0,0,0.2)',
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'flex-start',
             padding: `0 ${DesignSystem.Space(2)}`,
             gap: DesignSystem.Space(1),
             flexShrink: 0
          }} onPointerDown={(e) => e.stopPropagation()}>
             <Button 
                variant="ghost" 
                onClick={onUndo} 
                title="Undo"
                style={{ width: '28px', height: '28px', padding: 0 }}
                disabled={!onUndo}
             >
                <ArrowCounterClockwise size={14} />
             </Button>
             <Button 
                variant="ghost" 
                onClick={onRedo} 
                title="Redo"
                style={{ width: '28px', height: '28px', padding: 0 }}
                disabled={!onRedo}
             >
                <ArrowClockwise size={14} />
             </Button>
             
             <div style={{ flex: 1 }} />
             
             {/* Decorational Footer Elements */}
             <div style={{ display: 'flex', gap: '8px', opacity: 0.2 }}>
                 <Minus size={12} />
                 <CornersOut size={12} />
             </div>
          </div>
        </motion.div>
      )}

      {/* Portal Menu Render */}
      <AnimatePresence>
        {showMenu && menuRect && (
            <ContextMenu 
              rect={menuRect} 
              onClose={() => setShowMenu(false)}
              windowId={id}
              isSnappingEnabled={isSnappingEnabled}
              onToggleSnapping={onToggleSnapping}
              onResetScene={onResetScene}
              onOpenProjectSettings={onOpenProjectSettings}
              easingMode={easingMode}
              onToggleEasingMode={onToggleEasingMode}
              selectedKeyframe={selectedKeyframe}
              copiedKeyframeYaml={copiedKeyframeYaml}
              onCopyKeyframeAsYaml={onCopyKeyframeAsYaml}
              onPasteKeyframeFromYaml={onPasteKeyframeFromYaml}
            />
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
};