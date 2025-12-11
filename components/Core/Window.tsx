
import React from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { DotsThree, ArrowUUpLeft, ArrowUUpRight } from '@phosphor-icons/react';
import { Theme } from '../../theme.tsx';
import { Button, DropdownMenu } from './Primitives.tsx';

interface WindowProps {
  id: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  initialPos?: { x: number; y: number };
  size?: { w: number | string; h: number | string };
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const Window = ({ 
  id, 
  title, 
  isOpen, 
  onClose, 
  children, 
  initialPos = { x: 20, y: 20 }, 
  size = { w: 360, h: 500 },
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false
}: WindowProps) => {

  const dragControls = useDragControls();
  const constrainedWidth = typeof size.w === 'number' ? Math.min(size.w, 400) : size.w;
  const constrainedHeight = typeof size.h === 'number' ? Math.min(size.h, 600) : size.h;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key={id}
          initial={{ opacity: 0, scale: 0.95, y: 15, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          drag
          dragListener={false}
          dragControls={dragControls}
          dragMomentum={false}
          style={{
            position: 'absolute',
            left: initialPos.x,
            top: initialPos.y,
            width: constrainedWidth,
            height: constrainedHeight,
            maxWidth: '400px',
            maxHeight: '600px',
            background: Theme.Color.Effect.Glass,
            backdropFilter: Theme.Effect.Blur.Panel,
            borderRadius: Theme.Effect.Radius.L,
            boxShadow: Theme.Effect.Shadow.Window,
            border: `1px solid ${Theme.Color.Effect.Border}`,
            display: 'flex',
            flexDirection: 'column',
            zIndex: Theme.Layout.Z.Window,
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div 
            onPointerDown={(e) => dragControls.start(e)}
            style={{
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `0 ${Theme.Space.M}px`,
              borderBottom: `1px solid ${Theme.Color.Effect.Border}`,
              cursor: 'grab',
              userSelect: 'none',
              background: 'rgba(255,255,255,0.02)',
              flexShrink: 0
            }}
          >
            {/* Left: Menu & Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: Theme.Space.S }}>
                 <DropdownMenu 
                    trigger={<Button variant="ghost" icon={DotsThree} size="S" style={{ padding: 4, height: 28, width: 28, minWidth: 28 }} />}
                    align="left"
                    items={[
                        { label: 'Reset View', onClick: () => {} },
                        { label: 'Dock Window', onClick: () => {} },
                        { label: 'Help', onClick: () => {} }
                    ]}
                />
                <span style={{ 
                    ...Theme.Type.Expressive.Label.S, 
                    color: Theme.Color.Base.Content[1], 
                    letterSpacing: '0.05em', 
                    fontWeight: 700,
                    fontSize: '0.75rem'
                }}>
                  {title}
                </span>
            </div>

            {/* Right: Close Button */}
            <motion.div 
                whileHover={{ scale: 1.1 }} 
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                style={{
                    width: '14px', height: '14px',
                    borderRadius: '50%',
                    background: '#FF5F57', // macOS Red
                    border: '1px solid #E0443E',
                    cursor: 'pointer',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.1)'
                }}
            />
          </div>

          {/* Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: Theme.Space.M,
            position: 'relative'
          }}>
            {children}
          </div>

          {/* Footer (Undo/Redo) */}
          <div style={{
              height: '48px',
              borderTop: `1px solid ${Theme.Color.Effect.Border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `0 ${Theme.Space.M}px`,
              background: 'rgba(0,0,0,0.2)',
              flexShrink: 0
          }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="ghost" icon={ArrowUUpLeft} onClick={onUndo} disabled={!canUndo} size="S" title="Undo" style={{ padding: '4px 8px' }} />
                <Button variant="ghost" icon={ArrowUUpRight} onClick={onRedo} disabled={!canRedo} size="S" title="Redo" style={{ padding: '4px 8px' }} />
              </div>
              <div style={{ ...Theme.Type.Expressive.Label.XS, color: Theme.Color.Base.Content[3], opacity: 0.5 }}>
                  READY
              </div>
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  );
};
