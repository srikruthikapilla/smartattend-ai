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
        sbit: {
          blue: '#1e3a8a',
          navy: '#0f172a',
          gold: '#f59e0b',
          saffron: '#ea580c',
          accent: '#3b82f6',
          lightBg: '#f8fafc',
          cardLight: 'rgba(255, 255, 255, 0.85)',
          cardDark: 'rgba(15, 23, 42, 0.75)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        glassDark: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
