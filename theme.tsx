export const DesignSystem = {
  Color: {
    Base: {
      Surface: {
        1: '#000000', // OLED Black
        2: '#0A0A0B', // Deep grey panels
        3: '#18181B', // Input backgrounds
        '3b': 'rgba(10, 10, 11, 0.65)', // High-end glass
      },
      Content: {
        1: '#EDEDED', // Primary white-ish
        2: '#A1A1AA', // Secondary grey
        3: '#52525B', // Tertiary / Borders
      },
      Border: {
        1: 'rgba(255, 255, 255, 0.08)',
        2: 'rgba(255, 255, 255, 0.12)',
        3: 'var(--accent-surface-dim, rgba(91, 80, 255, 0.3))', // Active Border
      }
    },
    Accent: {
      Surface: {
        1: 'var(--accent-surface, #5B50FF)', // Dynamic Accent
        2: 'var(--accent-surface-dim, #4038B5)', // Deep Accent
      },
      Content: {
        1: 'var(--accent-content, #FFFFFF)',
        2: '#E0E7FF',
      }
    },
    Feedback: {
      Success: '#10B981',
      Warning: '#F59E0B',
      Error: '#FF4444',
    }
  },
  Type: {
    Display: {
      L: { fontFamily: 'var(--font-display)', fontSize: '48px', lineHeight: '100%', letterSpacing: '0.02em' },
      M: { fontFamily: 'var(--font-display)', fontSize: '32px', lineHeight: '110%', letterSpacing: '0.02em' },
    },
    Label: {
      L: { fontFamily: 'var(--font-body)', fontSize: '16px', fontWeight: 600, lineHeight: '140%', letterSpacing: '-0.01em' },
      M: { fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 500, lineHeight: '140%', letterSpacing: '-0.01em' },
      S: { fontFamily: 'var(--font-code)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' },
    },
    Body: {
      M: { fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: '160%', letterSpacing: '0' },
    }
  },
  Effect: {
    Shadow: {
      Depth: '0 32px 64px -16px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.05)',
      Glass: 'backdrop-filter: blur(32px); -webkit-backdrop-filter: blur(32px);',
      Glow: '0 0 24px var(--accent-glow, rgba(91, 80, 255, 0.4))',
    },
    Radius: {
      S: '8px',
      M: '16px',
      L: '24px',
      XL: '32px',
      Full: '9999px',
    },
    Transition: {
      Fast: '0.2s cubic-bezier(0.2, 0, 0, 1)',
      Smooth: '0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      Elastic: '0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }
  },
  Space: (n: number) => `${n * 4}px`,
};