/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // CAD-style dark theme colors
        'cad-bg': '#1a1a2e',
        'cad-surface': '#16213e',
        'cad-border': '#0f3460',
        'cad-accent': '#e94560',
        'cad-text': '#eaeaea',
        'cad-text-dim': '#8b8b8b',
        'cad-grid': '#2a2a4a',
        'cad-grid-major': '#3a3a5a',
      },
    },
  },
  plugins: [],
};
