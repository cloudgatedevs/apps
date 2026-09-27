import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { minify: mode !== 'development', sourcemap: mode === 'development' },
  server: { host: '127.0.0.1', port: 3010, strictPort: true, allowedHosts: ['.api.cloudgate.dev'],
    proxy: { '/api': 'http://127.0.0.1:3011' } },
}));
