import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#faf6f4',
        /* Card fill. Very slightly warm rather than pure white, so cards read
           as paper against the wash instead of as glossy panels. */
        paper: '#fffcfa',
        ink: '#3b2f3f',
        blush: {
          50: '#fdf5f8',
          100: '#f7e4ec',
          200: '#efc8d9',
          300: '#e3a5c0',
          400: '#cf7f9f',
          500: '#bd6b8c',
        },
        lilac: {
          50: '#f7f5fc',
          100: '#ebe6f7',
          200: '#d8cfef',
          300: '#bcaee2',
          400: '#9b88ce',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        /* Tight and low-opacity: grounded, not floating. */
        soft: '0 1px 2px rgba(75, 55, 75, 0.04), 0 2px 8px -4px rgba(75, 55, 75, 0.08)',
        lift: '0 2px 4px rgba(75, 55, 75, 0.05), 0 6px 16px -8px rgba(75, 55, 75, 0.12)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        /* Slow drift for the premium comment border. */
        shimmer: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.3s ease-out both',
        shimmer: 'shimmer 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
