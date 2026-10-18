/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#fbf7f2',
        cream: '#f3ebe3',
        sand: '#e6dacd',
        plum: {
          950: '#27111f',
          900: '#3b1f38',
          800: '#4a2745',
          700: '#5b2a50',
          600: '#703a63',
          500: '#8a4f7c',
        },
        berry: { DEFAULT: '#8c3b62', 100: '#f4dfe7' },
        rose: { DEFAULT: '#c98f97', 300: '#e3bcc1', 100: '#f6e5e7' },
        mauve: { DEFAULT: '#a67c9c', 300: '#cdb3c7', 100: '#efe4ec' },
        lavender: { DEFAULT: '#e5dcee', 200: '#d3c5e2', 50: '#f5f0fa' },
        champagne: { DEFAULT: '#c4a265', 600: '#9a7b43', 300: '#dcc59a', 100: '#f4ebd8' },
        sage: { DEFAULT: '#587a5f', 100: '#e4eee5' },
        ink: { DEFAULT: '#2b2430', soft: '#51475a', mute: '#6f6475' },
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"Hanken Grotesk Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        panel: '1.25rem',
      },
      boxShadow: {
        panel: '0 1px 0 rgba(59,31,56,0.04), 0 8px 24px -12px rgba(59,31,56,0.18)',
        pop: '0 18px 48px -16px rgba(39,17,31,0.35), 0 2px 6px rgba(39,17,31,0.08)',
        focus: '0 0 0 3px rgba(196,162,101,0.45)',
      },
      keyframes: {
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(-4px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'modal-in': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.985)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'pop-in': 'pop-in 140ms ease-out',
        'modal-in': 'modal-in 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-in': 'fade-in 160ms ease-out',
        'toast-in': 'toast-in 200ms ease-out',
      },
    },
  },
  plugins: [],
};
