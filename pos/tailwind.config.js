import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './admin.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // --- back office (light) palette. The names date from the dark theme: "ink" is
        // the surface scale (950 = page, 850 = card, 700/600 = borders), "mist" the text scale.
        ink: {
          950: '#f5f6f8',
          900: '#fbfbfc',
          850: '#ffffff',
          800: '#f1f3f7',
          700: '#e5e8ee',
          600: '#d5dae3',
          500: '#b8c0cc',
        },
        mist: {
          DEFAULT: '#0f172a',
          muted: '#475569',
          dim: '#6b7280',
        },
        accent: {
          DEFAULT: '#4f46e5',
          600: '#4338ca',
          500: '#4f46e5',
          400: '#4f46e5',
          soft: '#eef2ff',
        },
        // --- storefront (light) palette. primary/secondary are set per store from Settings >
        // Storefront (CSS variables on :root, RGB channels so Tailwind's /alpha still works).
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        'primary-fg': 'rgb(var(--c-primary-fg) / <alpha-value>)',
        secondary: 'rgb(var(--c-secondary) / <alpha-value>)',
        'secondary-fg': 'rgb(var(--c-secondary-fg) / <alpha-value>)',
        brand: colors.indigo,
        paper: '#fafaf9',
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15,23,42,0.04), 0 1px 0 rgba(15,23,42,0.03)',
        glow: '0 1px 2px rgba(79,70,229,0.25), 0 6px 16px -8px rgba(79,70,229,0.45)',
        soft: '0 1px 2px rgba(15,23,42,0.06), 0 8px 24px -12px rgba(15,23,42,0.18)',
        pop: '0 10px 40px -12px rgba(15,23,42,0.25), 0 1px 3px rgba(15,23,42,0.08)',
      },
      backgroundImage: {
        'accent-grad': 'linear-gradient(135deg, #6366f1 0%, #4f46e5 60%, #4338ca 100%)',
      },
    },
  },
  plugins: [],
};
