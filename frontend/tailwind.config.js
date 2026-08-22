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
        security: {
          DEFAULT: '#0f172a',
          dark: '#090d16',
          light: '#1e293b'
        },
        teal: {
          500: '#0d9488',
          600: '#006a61',
          700: '#005049'
        },
        alert: {
          500: '#ef4444',
          600: '#ba1a1a'
        },
        surface: {
          DEFAULT: '#f8fafc',
          card: '#ffffff',
          dim: '#e2e8f0'
        },
        sbit: {
          blue: '#0f172a',
          navy: '#0f172a',
          teal: '#0d9488',
          gold: '#f59e0b',
          accent: '#0d9488',
          lightBg: '#f8fafc',
          cardLight: '#ffffff',
          cardDark: '#0f172a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        jakarta: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        full: '9999px'
      }
    },
  },
  plugins: [],
}
