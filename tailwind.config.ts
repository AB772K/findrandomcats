import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#fdf9f3',
        ink: '#1f1b16',
      },
    },
  },
  plugins: [],
};

export default config;
