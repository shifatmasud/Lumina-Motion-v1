
export const Theme = {
  Color: {
    Base: {
      Surface: {
        1: '#050505', // Void (Background)
        2: 'rgba(20, 20, 20, 0.7)', // Glass Panel
        3: 'rgba(30, 30, 30, 0.5)', // Inputs/Fields
      },
      Content: {
        1: '#EDEDED', // Primary Text
        2: '#9CA3AF', // Secondary Text
        3: '#4B5563', // Disabled/Placeholder
      }
    },
    Action: {
      Surface: {
        1: '#D4FF00', // Acid Green (Primary Action)
        2: 'rgba(255, 255, 255, 0.1)', // Secondary Action
        3: 'rgba(212, 255, 0, 0.1)', // Ghost/Active State
      },
      Content: {
        1: '#050505', // Text on Primary
        2: '#FFFFFF', // Text on Secondary
        3: '#D4FF00', // Acid Text
      }
    },
    Feedback: {
      Success: '#00FF94',
      Warning: '#FFBD00',
      Error: '#FF3B30',
      Signal: '#D4FF00',
      Focus: '#2D6BFF',
    },
    Effect: {
      Glass: 'rgba(10, 10, 10, 0.75)',
      Border: 'rgba(255, 255, 255, 0.08)',
      BorderHighlight: 'rgba(212, 255, 0, 0.4)',
      Overlay: 'rgba(0, 0, 0, 0.8)',
    }
  },
  Type: {
    Expressive: {
      Display: {
        L: { fontFamily: '"Bebas Neue", sans-serif', fontSize: '3rem', lineHeight: '0.9', letterSpacing: '0.02em' },
        M: { fontFamily: '"Bebas Neue", sans-serif', fontSize: '1.75rem', lineHeight: '1', letterSpacing: '0.03em' },
      },
      Label: {
        S: { fontFamily: '"Victor Mono", monospace', fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase' as const, fontWeight: 500 },
        XS: { fontFamily: '"Victor Mono", monospace', fontSize: '0.6rem', letterSpacing: '0.05em', textTransform: 'uppercase' as const },
      }
    },
    Readable: {
      Body: {
        M: { fontFamily: '"Inter", sans-serif', fontSize: '0.9rem', lineHeight: '1.5', letterSpacing: '-0.01em' },
        S: { fontFamily: '"Inter", sans-serif', fontSize: '0.8rem', lineHeight: '1.4', letterSpacing: '-0.01em' },
      },
      Code: {
        M: { fontFamily: '"Victor Mono", monospace', fontSize: '0.8rem' },
      }
    }
  },
  Space: {
    Base: 4,
    S: 8,
    M: 16,
    L: 24,
    XL: 32,
  },
  Effect: {
    Radius: {
      S: '6px',
      M: '12px',
      L: '24px',
      Full: '999px',
    },
    Shadow: {
      Dock: '0 20px 40px -10px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)',
      Window: '0 40px 80px -20px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.08)',
      Glow: '0 0 20px rgba(212, 255, 0, 0.2)',
      Keyframe: '0 0 0 2px #D4FF00',
    },
    Blur: {
      Panel: 'blur(24px)',
      Dock: 'blur(32px)',
    },
    Transition: {
      Fast: 'all 0.15s cubic-bezier(0.2, 0, 0, 1)',
      Smooth: 'all 0.4s cubic-bezier(0.2, 0, 0, 1)',
      Spring: { type: "spring", stiffness: 300, damping: 30 }
    }
  },
  Layout: {
    Z: {
      Canvas: 0,
      Window: 50,
      Dock: 100,
      Menu: 2000,
      Tooltip: 2100,
      Overlay: 9999,
    }
  }
};
