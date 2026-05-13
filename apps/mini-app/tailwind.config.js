/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tg: {
          bg:          'var(--tg-theme-bg-color, #ffffff)',
          secondary:   'var(--tg-theme-secondary-bg-color, #f7f7f8)',
          text:        'var(--tg-theme-text-color, #1a1a1a)',
          hint:        'var(--tg-theme-hint-color, #8e8e93)',
          link:        'var(--tg-theme-link-color, #007aff)',
          button:      'var(--tg-theme-button-color, #007aff)',
          'button-text': 'var(--tg-theme-button-text-color, #ffffff)',
        },
        brand: {
          50:  '#f0f5ff',
          100: '#e0ebff',
          200: '#c2d6ff',
          300: '#94b8ff',
          400: '#6699ff',
          500: '#3d7aff',
          600: '#1a5cff',
          700: '#0044e6',
        },
        accent: {
          emerald: '#34c759',
          orange:  '#ff9500',
          red:     '#ff3b30',
          purple:  '#af52de',
          pink:    '#ff2d55',
          teal:    '#5ac8fa',
          indigo:  '#5856d6',
        },
        surface: {
          primary:   'var(--tg-theme-bg-color, #ffffff)',
          secondary: 'var(--tg-theme-secondary-bg-color, #f7f7f8)',
          elevated:  '#ffffff',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display',
          'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif',
        ],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      boxShadow: {
        'card':     '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-lg':  '0 4px 12px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
        'float':    '0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
        'tab-bar':  '0 -1px 12px rgba(0, 0, 0, 0.06)',
        'button':   '0 2px 8px rgba(0, 122, 255, 0.2)',
        'input':    '0 0 0 3px rgba(0, 122, 255, 0.12)',
      },
      animation: {
        'slide-up':     'slideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in':      'fadeIn 0.25s ease-out',
        'bounce-in':    'bounceIn 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in':     'scaleIn 0.2s ease-out',
        'slide-down':   'slideDown 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-soft':   'pulseSoft 2s ease-in-out infinite',
        'shimmer':      'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%':   { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        slideDown: {
          '0%':   { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.9)', opacity: '0' },
          '50%':  { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
        scaleIn: {
          '0%':   { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)',     opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
