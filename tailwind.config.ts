import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#fdf7f2',
        ink: '#3b2f3f',
        // Dusky pink / lavender palette the whole UI is tinted from.
        blush: { 50: '#fdf3f6', 100: '#fbe6ee', 200: '#f6cddc', 300: '#eeaac3', 400: '#e0839f' },
        lilac: { 50: '#f6f4fd', 100: '#ece7fb', 200: '#dbd2f7', 300: '#c2b2ef', 400: '#a68ce4' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(90, 60, 90, 0.25)',
        lift: '0 18px 40px -14px rgba(90, 60, 90, 0.35)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
