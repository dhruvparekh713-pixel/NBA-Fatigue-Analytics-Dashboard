/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // COURTSIDE — warm hardwood & ember palette
        court: {
          black: '#0d0a08',
          bg: '#100c0a',
          surface: '#1a1410',
          elevated: '#241c16',
          line: '#3a2f28',
        },
        ember: {
          DEFAULT: '#ff6b35',
          bright: '#ff8c42',
          deep: '#e8551f',
        },
        gold: {
          DEFAULT: '#fbbf24',
          bright: '#fcd34d',
        },
        // Legacy aliases → mapped to court tones so any stray bg-bg-* keeps working
        bg: {
          primary: '#100c0a',
          secondary: '#1a1410',
          card: '#1a1410',
          elevated: '#241c16',
        },
        accent: {
          green: '#34d399',
          red: '#ff5630',
          amber: '#fbbf24',
          blue: '#ff6b35',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        display: ['Bricolage Grotesque', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
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
        'ember-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 107, 53, 0.45)' },
          '50%': { boxShadow: '0 0 14px 2px rgba(255, 107, 53, 0.65)' },
        },
        // Organic liquid-blob morph
        'blob-morph': {
          '0%, 100%': { borderRadius: '42% 58% 63% 37% / 41% 44% 56% 59%' },
          '33%': { borderRadius: '67% 33% 47% 53% / 37% 62% 38% 63%' },
          '66%': { borderRadius: '38% 62% 56% 44% / 64% 39% 61% 36%' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out both',
        'slide-up': 'slide-up 0.4s ease-out both',
        'pulse-slow': 'pulse-slow 2.5s ease-in-out infinite',
        'ember-pulse': 'ember-pulse 1.8s ease-in-out infinite',
        'blob-morph': 'blob-morph 18s ease-in-out infinite',
      },
      boxShadow: {
        'glow-ember': '0 0 24px rgba(255, 107, 53, 0.28)',
        'glow-gold': '0 0 24px rgba(251, 191, 36, 0.24)',
        'glow-green': '0 0 24px rgba(52, 211, 153, 0.22)',
      },
      backgroundImage: {
        // Subtle hardwood court-line texture
        hardwood:
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 64px)',
        'ember-gold': 'linear-gradient(135deg, #ff6b35, #fbbf24)',
      },
    },
  },
  plugins: [],
}
