import cloudgate from '@cloudgatedevs/cloudgate-client-react/tailwind';
export default {
  presets: [cloudgate], content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {
    fontFamily: { display: ['Plus Jakarta Sans', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
    colors: { primary: 'rgb(var(--c-primary) / <alpha-value>)', 'primary-fg': 'rgb(var(--c-primary-fg) / <alpha-value>)',
      secondary: 'rgb(var(--secondary) / <alpha-value>)', 'secondary-fg': 'rgb(var(--secondary-fg) / <alpha-value>)',
      accent: { soft: 'rgb(var(--accent) / .1)' } },
    boxShadow: { soft: '0 1px 2px rgb(15 23 42 / .06), 0 8px 24px -12px rgb(15 23 42 / .18)', pop: '0 10px 40px -12px rgb(15 23 42 / .25)' },
  } }, plugins: [],
};
