import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Two entry points, two bundles:
//   /            -> index.html  -> src/storefront  (public shop, light theme)
//   /admin/*     -> admin.html  -> src/admin       (back office, dark theme)
// Admin code never ships in the public bundle. Any static host must rewrite
// /admin and /admin/* to /admin.html (see README "Hosting").
//
// `npm run build` -> optimized production bundle.
// `npm run build:dev` (--mode development) -> unminified bundle with
// sourcemaps, for debugging what actually ships.

/** Dev-server + preview: serve admin.html for /admin and /admin/... (history fallback). */
const adminHistoryFallback = () => ({
  name: 'admin-history-fallback',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const url = req.url || '';
      if (url === '/admin' || (url.startsWith('/admin/') && !url.startsWith('/admin/@') && !/\.[a-z0-9]+(\?|$)/i.test(url))) {
        req.url = '/admin.html';
      }
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, _res, next) => {
      const url = req.url || '';
      if (url === '/admin' || (url.startsWith('/admin/') && !/\.[a-z0-9]+(\?|$)/i.test(url))) {
        req.url = '/admin.html';
      }
      next();
    });
  },
});

export default defineConfig(({ mode }) => ({
  plugins: [react(), adminHistoryFallback()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    minify: mode === 'development' ? false : 'esbuild',
    sourcemap: mode === 'development',
    rollupOptions: {
      input: {
        storefront: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
  server: {
    host: true,
    port: 3000,
  },
}));
