import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer, mergeConfig } from 'vite';
import tailwind from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import viteConfig from '../vite.config.js';
import shopTailwind from '../tailwind.config.js';

export async function startLocalSdk(extraConfig = {}) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  function option(name) {
    const index = args.indexOf(name);
    if (index < 0) return undefined;
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Provide a value for ${name}.`);
    return value;
  }
  const sdk = path.resolve(root, option('--sdk') || process.env.CLOUDGATE_SDK_PATH || '../../client-react');
  const manifest = JSON.parse(await readFile(path.join(sdk, 'package.json'), 'utf8').catch(() => {
    throw new Error(`No SDK checkout at ${sdk}. Set CLOUDGATE_SDK_PATH or run npm run dev:sdk -- --sdk "path/to/client-react".`);
  }));
  if (manifest.name !== '@cloudgatedevs/cloudgate-client-react') throw new Error(`Not a Cloudgate React SDK checkout: ${sdk}`);
  const { default: preset } = await import(pathToFileURL(path.join(sdk, 'tailwind.preset.js')).href);
  const config = typeof viteConfig === 'function' ? viteConfig({ command: 'serve', mode: 'development' }) : viteConfig;
  const source = name => path.join(sdk, name).replaceAll('\\', '/');
  const app = name => path.join(root, name).replaceAll('\\', '/');
  const port = Number(option('--port') || config.server.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Choose a port between 1 and 65535.');
  const server = await createServer(mergeConfig(mergeConfig(config, {
    configFile: false,
    root,
    mode: 'development', // Keep .env.development and its local overrides.
    cacheDir: path.join(root, 'node_modules/.vite-sdk'),
    define: { 'import.meta.env.VITE_CLOUDGATE_SDK_SOURCE': JSON.stringify('local') },
    resolve: {
      alias: [
        { find: /^@cloudgatedevs\/cloudgate-client-react\/react\/widgets$/, replacement: source('src/react/widgets/index.jsx') },
        { find: /^@cloudgatedevs\/cloudgate-client-react\/widgets\/catalog$/, replacement: source('src/widgets/catalog.js') },
        { find: /^@cloudgatedevs\/cloudgate-client-react\/widgets\/manifest$/, replacement: source('src/widgets/picker-manifest.json') },
        { find: /^@cloudgatedevs\/cloudgate-client-react\/react\/styles\.css$/, replacement: source('src/react/styles.css') },
        { find: /^@cloudgatedevs\/cloudgate-client-react\/react$/, replacement: source('src/react/index.jsx') },
        { find: /^@cloudgatedevs\/cloudgate-client-react\/platform$/, replacement: source('src/platform/index.js') },
        { find: /^@cloudgatedevs\/cloudgate-client-react$/, replacement: source('src/index.js') },
      ],
      // Both checkouts must share React and the portaled UI's focus/layer contexts.
      dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom', 'lucide-react', '@radix-ui/react-dialog',
        '@radix-ui/react-dismissable-layer', '@radix-ui/react-focus-scope', '@radix-ui/react-focus-guards'],
    },
    optimizeDeps: {
      // Scan lazy SDK features before opening them so first use does not invalidate the dependency cache.
      entries: [app('index.html'), source('src/index.js'), source('src/react/index.jsx'), source('src/react/widgets/index.jsx')],
      exclude: ['@cloudgatedevs/cloudgate-client-react'],
      include: ['@uppy/core', '@uppy/react/lib/Dashboard.js', '@uppy/webcam', 'react-easy-crop'],
    },
    css: { postcss: { plugins: [tailwind({
      ...shopTailwind,
      presets: [preset],
      content: [app('index.html'), app('src/**/*.{js,jsx}'), source('src/**/*.{js,jsx}')],
    }), autoprefixer()] } },
    // Preserve Shop's strict port handling so sign-in keeps using its configured origin.
    server: { host: option('--host') || config.server.host, port, fs: { allow: [root, sdk] } },
  }), extraConfig));
  console.log(`Using local Cloudgate SDK source: ${sdk}`);
  try {
    await server.listen();
    server.printUrls();
    return server;
  } catch (error) {
    await server.close();
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await startLocalSdk();
  const stop = async () => { await server.close(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
