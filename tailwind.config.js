/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Theme-aware CAD colors using CSS variables
        'cad-bg': 'var(--theme-bg)',
        'cad-surface': 'var(--theme-surface)',
        'cad-surface-elevated': 'var(--theme-surface-elevated)',
        'cad-border': 'var(--theme-border)',
        'cad-border-light': 'var(--theme-border-light)',
        'cad-accent': 'var(--theme-accent)',
        'cad-text': 'var(--theme-text)',
        'cad-text-dim': 'var(--theme-text-dim)',
        'cad-text-muted': 'var(--theme-text-muted)',
        'cad-grid': 'var(--theme-grid)',
        'cad-grid-major': 'var(--theme-grid-major)',
        'cad-hover': 'var(--theme-hover)',
        'cad-input': 'var(--theme-input-bg)',
        'cad-dropdown': 'var(--theme-dropdown-bg)',
      },
    },
  },
  plugins: [],
};
