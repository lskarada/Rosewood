import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['ui-serif', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
