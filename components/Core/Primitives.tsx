import React from 'react';
import { motion } from 'framer-motion';
import { CaretDown } from '@phosphor-icons/react';
import { DesignSystem } from '../../theme';

// --- Types ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: 'button' | 'div';
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
  active?: boolean;
}

interface SliderProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  unit?: string;
}

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (val: boolean) => void;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

interface GroupProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

// --- Components ---

export const Button: React.FC<ButtonProps> = ({ children, as = 'button', variant = 'secondary', active, style, ...props }) => {
  const getStyles = () => {
    const base: React.CSSProperties = {
      position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      gap: DesignSystem.Space(2), padding: variant === 'icon' ? DesignSystem.Space(2) : `${DesignSystem.Space(2)} ${DesignSystem.Space(4)}`,
      borderRadius: DesignSystem.Effect.Radius.M, border: 'none', cursor: 'pointer', outline: 'none',
      fontFamily: variant === 'icon' ? 'inherit' : DesignSystem.Type.Label.S.fontFamily,
      fontSize: variant === 'icon' ? '18px' : DesignSystem.Type.Label.S.fontSize,
      fontWeight: variant === 'icon' ? 'normal' : 600, letterSpacing: variant === 'icon' ? '0' : '0.05em',
      textTransform: variant === 'icon' ? 'none' : 'uppercase', transition: DesignSystem.Effect.Transition.Fast, overflow: 'hidden',
    };
    if (props.disabled) {
      return { ...base, cursor: 'not-allowed', opacity: 0.5 };
    }
    if (variant === 'primary' || active) return { ...base, backgroundColor: DesignSystem.Color.Accent.Surface[1], color: DesignSystem.Color.Accent.Content[1], boxShadow: DesignSystem.Effect.Shadow.Glow };
    if (variant === 'secondary') return { ...base, backgroundColor: DesignSystem.Color.Base.Surface[3], color: DesignSystem.Color.Base.Content[1], border: `1px solid ${DesignSystem.Color.Base.Border[1]}` };
    if (variant === 'ghost') return { ...base, backgroundColor: 'transparent', color: active ? DesignSystem.Color.Accent.Surface[1] : DesignSystem.Color.Base.Content[2] };
    if (variant === 'icon') return { ...base, backgroundColor: active ? DesignSystem.Color.Base.Surface[3] : 'transparent', color: active ? DesignSystem.Color.Accent.Surface[1] : DesignSystem.Color.Base.Content[2], width: '36px', height: '36px', padding: 0, borderRadius: DesignSystem.Effect.Radius.S, border: active ? `1px solid ${DesignSystem.Color.Base.Border[2]}` : '1px solid transparent' };
    return base;
  };
  
  const Component = as === 'div' ? motion.div : motion.button;

  return ( 
    <Component 
      whileHover={!props.disabled ? { scale: 1.02, filter: 'brightness(1.1)' } : {}} 
      whileTap={!props.disabled ? { scale: 0.96 } : {}} 
      style={{ ...getStyles(), ...style }} 
      {...props as any}
    >
      {children}
    </Component> 
  );
};

export const Slider: React.FC<SliderProps> = ({ label, value, min = 0, max = 100, step = 1, onChange, unit }) => {
  const displayValue = value ?? 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[2] }}>
          <span>{label}</span>
          <span style={{ color: DesignSystem.Color.Base.Content[1] }}>{displayValue.toFixed(step < 0.1 ? 2 : 0)}{unit}</span>
        </div>
      )}
      <div style={{ position: 'relative', height: '16px', display: 'flex', alignItems: 'center' }}>
        <input type="range" min={min} max={max} step={step} value={displayValue} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: '100%', appearance: 'none', background: 'transparent', zIndex: 2, cursor: 'grab' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, height: '2px', background: DesignSystem.Color.Base.Surface[3], borderRadius: DesignSystem.Effect.Radius.Full }} />
        <div style={{ position: 'absolute', left: 0, width: `${((displayValue - min) / (max - min)) * 100}%`, height: '2px', background: DesignSystem.Color.Accent.Surface[1], borderRadius: DesignSystem.Effect.Radius.Full, boxShadow: `0 0 10px ${DesignSystem.Color.Accent.Surface[1]}` }} />
      </div>
      <style>{` input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #fff; margin-top: -5px; box-shadow: 0 0 0 4px ${DesignSystem.Color.Base.Surface[1]}; cursor: pointer; transition: transform 0.1s; } input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.2); } input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 2px; cursor: pointer; background: transparent; } `}</style>
    </div>
  );
};

export const Toggle: React.FC<ToggleProps> = ({ label, value, onChange }) => {
  return (
    <div onClick={() => onChange(!value)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '32px', cursor: 'pointer', padding: '0 4px' }}>
      <span style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[2] }}>{label}</span>
      <div style={{ width: '32px', height: '18px', background: value ? DesignSystem.Color.Accent.Surface[1] : DesignSystem.Color.Base.Surface[3], borderRadius: '99px', position: 'relative', transition: DesignSystem.Effect.Transition.Fast, boxShadow: value ? DesignSystem.Effect.Shadow.Glow : 'none' }}>
        <motion.div animate={{ x: value ? 16 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} style={{ width: '14px', height: '14px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
      </div>
    </div>
  );
};

export const Input: React.FC<InputProps> = ({ label, style, ...props }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
        {label && <label style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[2] }}>{label}</label>}
        <input style={{ background: DesignSystem.Color.Base.Surface[3], border: `1px solid transparent`, color: DesignSystem.Color.Base.Content[1], borderRadius: DesignSystem.Effect.Radius.S, padding: `${DesignSystem.Space(2)} ${DesignSystem.Space(3)}`, fontSize: '12px', fontFamily: DesignSystem.Type.Body.M.fontFamily, outline: 'none', width: '100%', transition: 'border-color 0.2s', ...style }} onFocus={(e) => e.target.style.borderColor = DesignSystem.Color.Base.Border[2]} onBlur={(e) => e.target.style.borderColor = 'transparent'} {...props} />
    </div>
  );
};

export const Select: React.FC<SelectProps> = ({ label, children, ...props }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
        <label style={{ ...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[2] }}>{label}</label>
        <div style={{ position: 'relative' }}>
             <select
                style={{
                    appearance: 'none', background: DesignSystem.Color.Base.Surface[3], border: `1px solid transparent`,
                    color: DesignSystem.Color.Base.Content[1], borderRadius: DesignSystem.Effect.Radius.S,
                    padding: `${DesignSystem.Space(2)} ${DesignSystem.Space(3)}`, fontSize: '12px',
                    fontFamily: DesignSystem.Type.Body.M.fontFamily, outline: 'none', width: '100%',
                    transition: 'border-color 0.2s', cursor: 'pointer'
                }}
                onFocus={(e) => e.target.style.borderColor = DesignSystem.Color.Base.Border[2]}
                onBlur={(e) => e.target.style.borderColor = 'transparent'}
                {...props}
            >
                {children}
            </select>
            <CaretDown size={14} weight="bold" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: DesignSystem.Color.Base.Content[3], pointerEvents: 'none' }} />
        </div>
    </div>
  )
}

export const Group: React.FC<GroupProps> = ({ title, icon, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(2) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: DesignSystem.Space(2), color: DesignSystem.Color.Base.Content[2], padding: `0 ${DesignSystem.Space(1)}`}}>
           {icon}
           <span style={{ ...DesignSystem.Type.Label.S }}>{title}</span>
        </div>
        <div style={{ background: DesignSystem.Color.Base.Surface[2], borderRadius: DesignSystem.Effect.Radius.M, padding: DesignSystem.Space(3), display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(3) }}>
            {children}
        </div>
    </div>
);

export const Divider = () => (
    <div style={{ width: '100%', height: '1px', background: DesignSystem.Color.Base.Border[1], margin: `${DesignSystem.Space(2)} 0` }} />
);