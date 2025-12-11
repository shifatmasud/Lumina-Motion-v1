
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CaretDown, CaretUp, Check, ArrowsLeftRight } from '@phosphor-icons/react';
import { Theme } from '../../theme.tsx';

// --- TYPES ---
interface ButtonProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger';
  onClick?: (e: React.MouseEvent) => void;
  icon?: any;
  style?: React.CSSProperties;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  size?: 'S' | 'M';
}

interface InputFieldProps {
  label?: string;
  value: any;
  onChange: (val: any) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  type?: string;
}

interface NumberFieldProps {
  label?: string;
  value: number;
  onChange: (val: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

interface SliderProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
}

interface SegmentedControlProps {
    options: { label: string; value: any; icon?: any }[];
    value: any;
    onChange: (val: any) => void;
    label?: string;
}

interface DropdownMenuProps {
    trigger: React.ReactNode;
    items: { 
        label: string; 
        onClick: () => void; 
        icon?: any;
        danger?: boolean;
        disabled?: boolean;
        shortcut?: string;
        separator?: boolean;
    }[];
    align?: 'left' | 'right' | 'center';
}

// --- COMPONENTS ---

// 0. DROPDOWN MENU (Portal)
export const DropdownMenu = ({ trigger, items, align = 'left' }: DropdownMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            let left = rect.left;
            if (align === 'right') left = rect.right - 200;
            if (align === 'center') left = rect.left + rect.width / 2 - 100;

            // Boundary check
            if (left + 200 > window.innerWidth) left = window.innerWidth - 210;
            if (left < 10) left = 10;

            setCoords({
                top: rect.bottom + 8,
                left: left
            });
        }
    }, [isOpen, align]);

    useEffect(() => {
        const close = () => setIsOpen(false);
        if (isOpen) window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [isOpen]);

    return (
        <>
            <div 
                ref={triggerRef} 
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
                style={{ cursor: 'pointer', display: 'flex' }}
            >
                {trigger}
            </div>
            {isOpen && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        style={{
                            position: 'fixed',
                            top: coords.top,
                            left: coords.left,
                            minWidth: '200px',
                            background: '#0F0F0F', // Solid dark for menu
                            border: `1px solid ${Theme.Color.Effect.Border}`,
                            borderRadius: Theme.Effect.Radius.M,
                            padding: '6px',
                            boxShadow: Theme.Effect.Shadow.Window,
                            zIndex: Theme.Layout.Z.Menu,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {items.map((item, idx) => (
                            item.separator ? (
                                <div key={idx} style={{ height: 1, background: Theme.Color.Effect.Border, margin: '4px 0' }} />
                            ) : (
                                <div 
                                    key={idx}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if(!item.disabled) {
                                            item.onClick();
                                            setIsOpen(false);
                                        }
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: Theme.Space.S,
                                        padding: '8px 12px',
                                        ...Theme.Type.Readable.Body.S,
                                        color: item.disabled ? Theme.Color.Base.Content[3] : (item.danger ? Theme.Color.Feedback.Error : Theme.Color.Base.Content[1]),
                                        cursor: item.disabled ? 'not-allowed' : 'pointer',
                                        borderRadius: Theme.Effect.Radius.S,
                                        transition: 'all 0.1s',
                                        opacity: item.disabled ? 0.4 : 1
                                    }}
                                    onMouseEnter={e => !item.disabled && (e.currentTarget.style.background = Theme.Color.Base.Surface[3])}
                                    onMouseLeave={e => !item.disabled && (e.currentTarget.style.background = 'transparent')}
                                >
                                    {item.icon && <item.icon size={16} />}
                                    <span style={{ flex: 1 }}>{item.label}</span>
                                    {item.shortcut && <span style={{ ...Theme.Type.Expressive.Label.XS, opacity: 0.5 }}>{item.shortcut}</span>}
                                </div>
                            )
                        ))}
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};

// 1. BUTTON
export const Button = ({ 
  children, 
  variant = 'primary', 
  onClick, 
  icon: Icon, 
  style = {}, 
  disabled = false,
  active = false,
  title,
  size = 'M'
}: ButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const getStyles = () => {
    const base: React.CSSProperties = {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Theme.Space.S,
      padding: variant === 'icon' ? (size === 'S' ? '4px' : '8px') : `0 ${Theme.Space.M}px`,
      borderRadius: Theme.Effect.Radius.S,
      border: '1px solid transparent',
      cursor: disabled ? 'not-allowed' : 'pointer',
      overflow: 'hidden',
      transition: Theme.Effect.Transition.Fast,
      ...Theme.Type.Readable.Code.M,
      fontWeight: 500,
      opacity: disabled ? 0.4 : 1,
      minWidth: variant === 'icon' ? (size === 'S' ? '28px' : '36px') : 'auto',
      height: size === 'S' ? '28px' : '36px',
      fontSize: size === 'S' ? '0.75rem' : '0.8rem'
    };

    const variants = {
      primary: {
        background: Theme.Color.Action.Surface[1],
        color: Theme.Color.Action.Content[1],
        boxShadow: isHovered && !disabled ? Theme.Effect.Shadow.Glow : 'none',
      },
      secondary: {
        background: Theme.Color.Base.Surface[3],
        color: Theme.Color.Base.Content[1],
        border: `1px solid ${Theme.Color.Effect.Border}`,
      },
      ghost: {
        background: 'transparent',
        color: active ? Theme.Color.Action.Content[3] : Theme.Color.Base.Content[2],
      },
      icon: {
        background: active ? Theme.Color.Base.Surface[3] : 'transparent',
        color: active ? Theme.Color.Action.Content[3] : Theme.Color.Base.Content[2],
        border: active ? `1px solid ${Theme.Color.Effect.Border}` : '1px solid transparent',
      },
      danger: {
        background: 'rgba(255, 59, 48, 0.1)',
        color: Theme.Color.Feedback.Error,
        border: `1px solid rgba(255, 59, 48, 0.2)`,
      }
    };

    return { ...base, ...variants[variant], ...style };
  };

  return (
    <motion.button
      style={getStyles()}
      onClick={onClick}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileTap={{ scale: 0.96 }}
      disabled={disabled}
      title={title}
    >
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
        {Icon && <Icon size={size === 'S' ? 14 : 16} weight={active || variant === 'primary' ? "bold" : "regular"} />}
        {children}
      </div>
    </motion.button>
  );
};

// 2. INPUT FIELD
export const InputField = ({ label, value, onChange, placeholder, onKeyDown, type = 'text' }: InputFieldProps) => {
  return (
    <div style={{ marginBottom: Theme.Space.M }}>
      {label && <label style={{ ...Theme.Type.Expressive.Label.S, color: Theme.Color.Base.Content[2], marginBottom: '6px', display: 'block' }}>{label}</label>}
      <input
        type={type}
        style={fieldStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
    </div>
  );
};

// 3. NUMBER FIELD (Draggable)
export const NumberField = ({ label, value, onChange, step = 0.1, min, max }: NumberFieldProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef({ x: 0, val: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      startRef.current = { x: e.clientX, val: value };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startRef.current.x;
      const change = deltaX * step * 0.5;
      let newValue = Number((startRef.current.val + change).toFixed(2));
      if (max !== undefined) newValue = Math.min(max, newValue);
      if (min !== undefined) newValue = Math.max(min, newValue);
      onChange(newValue);
  };

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {label && (
          <div 
            style={{ 
                ...Theme.Type.Expressive.Label.XS, 
                color: isDragging ? Theme.Color.Action.Content[3] : Theme.Color.Base.Content[3], 
                marginBottom: '6px',
                cursor: 'ew-resize',
                display: 'flex', alignItems: 'center', gap: '4px',
                userSelect: 'none'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => setIsDragging(false)}
          >
              {label} {isDragging && <ArrowsLeftRight size={8} />}
          </div>
      )}
      <div style={{ ...fieldStyle, padding: '0 4px', display: 'flex', alignItems: 'center' }}>
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            ...Theme.Type.Readable.Code.M,
            flex: 1,
            width: '100%',
            background: 'transparent',
            color: Theme.Color.Base.Content[1],
            border: 'none',
            outline: 'none',
            fontSize: '0.8rem',
            padding: '6px',
            appearance: 'textfield',
          }}
        />
      </div>
    </div>
  );
};

// 4. SLIDER
export const Slider = ({ label, value, min = 0, max = 100, step = 1, onChange }: SliderProps) => {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div style={{ marginBottom: Theme.Space.M }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
        <label style={{ ...Theme.Type.Expressive.Label.S, color: Theme.Color.Base.Content[2] }}>{label}</label>
        <span style={{ ...Theme.Type.Readable.Code.M, color: Theme.Color.Base.Content[2], fontSize: '0.7rem' }}>{value.toFixed(2)}</span>
      </div>
      
      <div style={{ position: 'relative', height: '16px', display: 'flex', alignItems: 'center', cursor: 'grab' }}>
        {/* Track Bg */}
        <div style={{ position: 'absolute', left: 0, right: 0, height: '2px', background: Theme.Color.Base.Surface[3], borderRadius: '2px' }} />
        {/* Fill */}
        <div style={{ position: 'absolute', left: 0, height: '2px', width: `${percentage}%`, background: Theme.Color.Action.Surface[1], borderRadius: '2px' }} />
        {/* Input (Invisible interaction layer) */}
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'grab', margin: 0, zIndex: 2 }}
        />
        {/* Thumb */}
        <motion.div 
           animate={{ left: `${percentage}%` }}
           transition={{ type: "spring", stiffness: 500, damping: 30 }}
           style={{
             position: 'absolute',
             width: '10px', height: '10px',
             background: Theme.Color.Action.Surface[1],
             borderRadius: '50%',
             marginLeft: '-5px',
             pointerEvents: 'none',
             boxShadow: '0 0 10px rgba(212, 255, 0, 0.5)',
             zIndex: 1
          }} 
        />
      </div>
    </div>
  );
};

// 5. SEGMENTED CONTROL
export const SegmentedControl = ({ options, value, onChange, label }: SegmentedControlProps) => (
    <div style={{ marginBottom: Theme.Space.M }}>
        {label && <div style={{ ...Theme.Type.Expressive.Label.S, color: Theme.Color.Base.Content[2], marginBottom: '6px' }}>{label}</div>}
        <div style={{ 
            display: 'flex', 
            background: Theme.Color.Base.Surface[3], 
            padding: '3px', 
            borderRadius: Theme.Effect.Radius.S,
            border: `1px solid ${Theme.Color.Effect.Border}`
        }}>
            {options.map(opt => {
                const isActive = opt.value === value;
                return (
                    <motion.div
                        key={String(opt.value)}
                        onClick={() => onChange(opt.value)}
                        style={{
                            flex: 1,
                            padding: '4px 0',
                            textAlign: 'center',
                            cursor: 'pointer',
                            position: 'relative',
                            zIndex: 1,
                            ...Theme.Type.Expressive.Label.XS,
                            color: isActive ? Theme.Color.Action.Content[1] : Theme.Color.Base.Content[2],
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                            transition: 'color 0.2s'
                        }}
                    >
                        {isActive && (
                            <motion.div
                                layoutId={`seg-${label}`}
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                    background: Theme.Color.Action.Surface[1],
                                    borderRadius: '4px',
                                    zIndex: -1,
                                    boxShadow: Theme.Effect.Shadow.Glow
                                }}
                            />
                        )}
                        {opt.icon && <opt.icon size={12} weight={isActive ? "bold" : "regular"} />}
                        {opt.label}
                    </motion.div>
                );
            })}
        </div>
    </div>
);

// 6. CONTROL GROUP
export const ControlGroup = ({ children, label }: { children?: React.ReactNode, label?: string }) => (
    <div style={{ marginBottom: Theme.Space.L }}>
        {label && (
            <div style={{ 
                ...Theme.Type.Expressive.Label.XS, 
                color: Theme.Color.Action.Content[3], 
                marginBottom: '12px', 
                borderBottom: `1px solid ${Theme.Color.Effect.Border}`,
                paddingBottom: '4px',
                letterSpacing: '0.1em'
            }}>
                {label}
            </div>
        )}
        <div style={{ display: 'flex', gap: Theme.Space.S, alignItems: 'center' }}>
            {children}
        </div>
    </div>
);

// STYLES
const fieldStyle: React.CSSProperties = {
    ...Theme.Type.Readable.Code.M,
    width: '100%',
    background: Theme.Color.Base.Surface[3],
    color: Theme.Color.Base.Content[1],
    border: `1px solid ${Theme.Color.Effect.Border}`,
    borderRadius: Theme.Effect.Radius.S,
    padding: '8px 12px',
    outline: 'none',
    transition: Theme.Effect.Transition.Fast,
};
