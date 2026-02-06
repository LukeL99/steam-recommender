import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        steam: {
          dark: '#1b2838',
          darker: '#171a21',
          blue: '#1a9fff',
          'blue-hover': '#66c0f4',
          green: '#4c6b22',
          'green-hover': '#5c7e10',
          text: '#c7d5e0',
          'text-secondary': '#8f98a0',
        },
      },
    },
  },
  plugins: [],
};

export default config;
