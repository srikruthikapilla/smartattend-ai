/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* ── Brand: Single accent = teal ── */
        accent: {
          DEFAULT: '#0d9488',
          light: '#14b8a6',
          dark: '#0f766e',
          muted: 'rgba(13,148,136,0.12)',
          glow: 'rgba(13,148,136,0.25)',
        },
        security: {
          DEFAULT: '#0f172a',
          dark: '#090d16',
          light: '#1e293b',
        },
        alert: {
          500: '#ef4444',
          600: '#ba1a1a',
        },
        /* ── Tinted surfaces (not pure Tailwind defaults) ── */
        surface: {
          DEFAULT: '#fafafa',
          card: '#ffffff',
          dim: '#f1f3f5',
          dark: '#0a0a0f',
          'card-dark': '#111118',
          'elevated-dark': '#16161f',
        },
        sbit: {
          blue: '#0f172a',
          navy: '#0f172a',
          teal: '#0d9488',
          gold: '#f59e0b',
          accent: '#0d9488',
          lightBg: '#fafafa',
          cardLight: '#ffffff',
          cardDark: '#111118',
        },
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'Geist', 'sans-serif'],
        jakarta: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.375rem',
        md: '0.625rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        full: '9999px',
      },
      boxShadow: {
        /* Tinted shadows — not pure black */
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        'card-hover': '0 8px 25px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.04)',
        'card-dark': '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        'card-dark-hover': '0 8px 25px rgba(0,0,0,0.4), 0 4px 10px rgba(0,0,0,0.3)',
        'glow-accent': '0 0 20px rgba(13,148,136,0.15), 0 0 6px rgba(13,148,136,0.1)',
        'glow-accent-strong': '0 0 30px rgba(13,148,136,0.25), 0 0 10px rgba(13,148,136,0.15)',
        'inner-highlight': 'inset 0 1px 0 rgba(255,255,255,0.06)',
        'elevated': '0 4px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.03)',
        'elevated-dark': '0 4px 12px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)',
      },
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.32, 0.72, 0, 1)',
        'bounce-out': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-left': 'slideInLeft 0.4s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}
