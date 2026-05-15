/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tg: {
          bg:            'var(--tg-theme-bg-color, #ffffff)',
          secondary:     'var(--tg-theme-secondary-bg-color, #f4f4f5)',
          text:          'var(--tg-theme-text-color, #000000)',
          hint:          'var(--tg-theme-hint-color, #999999)',
          link:          'var(--tg-theme-link-color, #2481cc)',
          button:        'var(--tg-theme-button-color, #2481cc)',
          'button-text': 'var(--tg-theme-button-text-color, #ffffff)',
        },
        status: {
          success:  '#34C759',
          warning:  '#FF9500',
          danger:   '#FF3B30',
          info:     '#007AFF',
        },
        surface: {
          primary:   'var(--tg-theme-bg-color, #ffffff)',
          secondary: 'var(--tg-theme-secondary-bg-color, #f4f4f5)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont',
          'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif',
        ],
      },
      fontSize: {
        'micro':  ['11px', { lineHeight: '1.4', fontWeight: '500' }],
        'aux':    ['13px', { lineHeight: '1.4', fontWeight: '400' }],
        'body':   ['15px', { lineHeight: '1.4', fontWeight: '400' }],
        'h3':     ['15px', { lineHeight: '1.4', fontWeight: '600' }],
        'h2':     ['17px', { lineHeight: '1.4', fontWeight: '600' }],
        'h1':     ['20px', { lineHeight: '1.4', fontWeight: '700' }],
      },
      spacing: {
        'screen-x':  '16px',
        'section-y':  '24px',
        'card-inner': '14px',
        'card-gap':   '8px',
      },
      borderRadius: {
        'card':   '16px',
        'btn':    '12px',
        'chip':   '20px',
        'sheet':  '20px',
        'badge':  '6px',
      },
      animation: {
        'slide-up':   'slideUp 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'fade-slide': 'fadeSlide 200ms ease-out both',
        'fade-in':    'fadeIn 200ms ease-out',
        'slide-down': 'slideDown 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'spin-fast':  'spin 0.8s linear infinite',
        'pulse-skeleton': 'pulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          from: { transform: 'translateY(16px)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeSlide: {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to:   { transform: 'translateY(0)',   opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideDown: {
          from: { transform: 'translateY(-8px)', opacity: '0' },
          to:   { transform: 'translateY(0)',     opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
