/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0f1117',
          secondary: '#1a1d29',
          card: '#1e2235',
          elevated: '#252a3a',
        },
        accent: {
          green: '#22c55e',
          red: '#ef4444',
          amber: '#f59e0b',
          blue: '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out both',
        'slide-up': 'slide-up 0.4s ease-out both',
        'pulse-slow': 'pulse-slow 2.5s ease-in-out infinite',
      },
      boxShadow: {
        'glow-blue': '0 0 24px rgba(59, 130, 246, 0.22)',
        'glow-green': '0 0 24px rgba(34, 197, 94, 0.22)',
        'glow-amber': '0 0 24px rgba(245, 158, 11, 0.22)',
        'glow-red': '0 0 24px rgba(239, 68, 68, 0.22)',
      },
    },
  },
  plugins: [],
}
