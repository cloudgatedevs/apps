// SDK integration against real Shop workflow scripts and an isolated SQLite database.
// Native Cloudgate services, identity and Wallet are simulated; no real payments or email.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { DEFAULT_SETTINGS, BACKOFFICE_PERMISSION_KEYS } from '@cloudgatedevs/cloudgate-client-react/platform';

const root = fileURLToPath(new URL('..', import.meta.url));
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shop-sdk-'));
const origin = 'http://127.0.0.1:3596', apiOrigin = 'http://127.0.0.1:3597';
const appId = '12345678-1234-4234-8234-123456789abc';
const metadata = JSON.parse(await fs.readFile(path.join(root, 'template.json'), 'utf8'));
const python = spawn('python', ['-B', '-X', 'utf8', 'tests/workflow_fixture.py', '--db', path.join(directory, 'shop.sqlite'), '--port', '3597'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let pythonOutput = '';
python.stdout.on('data', chunk => { pythonOutput += chunk; });
python.stderr.on('data', chunk => { pythonOutput += chunk; });
let browser, server;
const errors = [], calls = [];
async function api(route, body, role = 'Admin') {
  const response = await fetch(apiOrigin + '/' + route, { method: 'ShopT', headers: { 'Content-Type': 'application/json', 'X-Shop-Test': '1' }, body: JSON.stringify({ role, body }) });
  const result = await response.json(); assert.equal(response.status, 200, route + ': ' + JSON.stringify(result)); return result;
}
const shot = async (page, name) => {
  if (!process.env.SHOP_TEST_OUTPUT_DIR) return;
  await fs.mkdir(process.env.SHOP_TEST_OUTPUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.SHOP_TEST_OUTPUT_DIR, name + '.png'), fullPage: true, animations: 'disabled' });
};
try {
  for (let attempt = 0; ; attempt++) {
    try { await api('catalog', { op: 'settings' }); break; }
    catch { if (attempt >= 80 || python.exitCode != null) throw new Error(pythonOutput || 'Fixture failed to start'); await delay(100); }
  }
  const env = { VITE_CLOUDGATE_API_URL: 'https://gateway.example.invalid', VITE_CLOUDGATE_API_PROJECT: 'shop', VITE_CLOUDGATE_API_ENV: 'sbx', VITE_API_KEY: '', VITE_API_SECRET: '', VITE_IDP_BASE_URL: 'https://hub.example.invalid', VITE_IDP_API_URL: 'https://api.example.invalid', VITE_IDP_TENANCY_NAME: 'shop', VITE_CLOUDGATE_WEB_APP_ID: appId, VITE_CLOUDGATE_WS_USER: 'test', VITE_CLOUDGATE_WS_PASSWORD: 'test' };
  server = await createServer({ root, configFile: false, envDir: false, plugins: [react()], logLevel: 'warn',
    resolve: { alias: { '@': path.join(root, 'src') } },
    define: Object.fromEntries(Object.entries(env).map(([key, value]) => ['import.meta.env.' + key, JSON.stringify(value)])),
    server: { host: '127.0.0.1', port: 3596, strictPort: true } });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  let role = 'Admin', grants = true, failOnce = true, refreshes = 0;
  const token = suffix => `e30.${Buffer.from(JSON.stringify({ sub: '1', exp: Math.floor(Date.now() / 1000) + 3600, jti: suffix })).toString('base64url')}.test`;
  const initialToken = token('initial'), refreshedToken = token('refreshed');
  let activeToken = initialToken, values = { ...DEFAULT_SETTINGS, ...metadata.appSettings, app_name: 'SDK Test Shop' };
  const sockets = new Set(), files = [];
  await context.route('**/cg-analytics.json', route => route.fulfill({ json: { webAppId: appId, isProduction: false } }));
  await context.routeWebSocket('wss://api.example.invalid/**', socket => socket.send(JSON.stringify({ type: 'ready', environment: 'sbx' })));
  await context.routeWebSocket('wss://gateway.example.invalid/**', socket => { sockets.add(socket); socket.onClose(() => sockets.delete(socket)); });
  await context.route('https://gateway.example.invalid/**', async route => {
    const request = route.request(), data = request.postDataJSON();
    const endpoint = new URL(request.url()).pathname.split('/').pop();
    assert.match(new URL(request.url()).pathname, /^\/sbx\/shop\//);
    calls.push({ endpoint, ...data });
    assert.equal(request.headers().authorization, role ? 'Bearer ' + activeToken : undefined);
    if (role && failOnce) { failOnce = false; return route.fulfill({ status: 401, json: { message: 'Session expired' } }); }
    try { return await route.fulfill({ json: await api(endpoint, data, role) }); }
    catch (error) { errors.push(endpoint + ': ' + error.message + ' ' + (error.cause?.message || '')); return route.fulfill({ status: 500, json: { message: error.message } }).catch(() => {}); }
  });
  await context.route('https://api.example.invalid/**', async route => {
    const request = route.request(), url = new URL(request.url()), pathname = url.pathname;
    const reply = json => route.fulfill({ json });
    if (pathname.endsWith('/website')) return reply({ values, revision: appId, allowSelfRegistration: false });
    if (pathname.endsWith('/Refresh')) {
      assert.equal(request.postDataJSON().refreshToken, 'isolated-refresh'); refreshes++; activeToken = refreshedToken;
      return reply({ accessToken: activeToken, refreshToken: 'isolated-refresh', expiresIn: 3600 });
    }
    assert.equal(request.headers().authorization, role ? 'Bearer ' + activeToken : undefined);
    if (pathname.endsWith('/profile')) return reply({ id: role === 'Admin' ? 1 : 2, name: 'SDK', surname: 'Cashier', email: 'customer@example.invalid', role, isEmailConfirmed: true,
      rolePermissions: grants ? BACKOFFICE_PERMISSION_KEYS.map(key => ({ key, value: 'true' })) : [] });
    if (pathname.includes('/notifications/')) return reply(pathname.endsWith('/unread-count') ? { unreadCount: 0 } : { items: [], totalCount: 0 });
    if (pathname.endsWith('/profile/cloudgate-link')) return reply({ linked: false, available: true });
    if (pathname.endsWith('/files')) return reply({ items: files.filter(file => file.path === url.searchParams.get('path')), total: files.filter(file => file.path === url.searchParams.get('path')).length });
    if (pathname.endsWith('/files/upload')) {
      assert.equal(url.searchParams.get('path'), 'shop/media');
      const file = { id: '98765432-1234-4234-8234-123456789abc', name: 'sdk-product.jpg', path: 'shop/media', url: 'https://images.example.invalid/product.png' };
      files.push(file); return reply(file);
    }
    if (pathname.endsWith('/admin/appearance/details')) return reply({ values, revision: appId });
    if (pathname.startsWith('/File/')) return reply({});
    if (pathname.includes('/admin/workflow-logs/')) return reply({ items: [], totalCount: 0, endpoints: [], stats: {} });
    throw new Error('Unexpected native endpoint: ' + pathname);
  });
  await context.route('https://hub.example.invalid/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Hosted sign in</h1>' }));
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/admin/products?' + new URLSearchParams({ access_token: initialToken, refresh_token: 'isolated-refresh', expires_in: '3600' }));
  await page.getByRole('heading', { name: 'Products', exact: true }).waitFor();
  await page.locator('.shop-ui table tbody tr').first().waitFor();
  assert.equal(refreshes, 1); assert.equal(new URL(page.url()).search, '');
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  await sidebar.getByText('Cloudgate SDK', { exact: true }).waitFor();

  for (const [route, label, title] of [
    ['', 'Dashboard', 'Dashboard'], ['orders', 'Orders', 'Orders'], ['categories', 'Categories', 'Categories'],
    ['inventory', 'Inventory', 'Inventory'], ['customers', 'Customers', 'Customers'],
    ['pages', 'Store pages', 'Pages'], ['messages', 'Customer messages', 'Messages'], ['business', 'Shop settings', 'Shop settings'],
  ]) {
    await sidebar.getByRole('link', { name: label, exact: true }).click();
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname.replace(/\/$/, ''), '/admin' + (route ? '/' + route : ''));
  }
  await page.getByLabel('Store name', { exact: true }).fill('SDK Test Business');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByText('Settings saved.', { exact: true }).waitFor();
  const payload = calls.findLast(call => call.endpoint === 'admin-settings' && call.op === 'set').values;
  assert.equal(payload.store_name, 'SDK Test Business');
  assert.ok(!Object.keys(payload).some(key => /^(theme_|smtp_|store_logo|store_icon|app_)/.test(key)));
  await shot(page, 'shop-business-settings');
  await page.goto(origin + '/admin/products');
  await page.locator('.shop-ui table tbody tr').first().getByRole('link').first().click();
  await page.getByRole('button', { name: 'Upload…', exact: true }).click();
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 80; canvas.getContext('2d').fillRect(0, 0, 80, 80); return canvas.toDataURL('image/png').split(',')[1]; });
  await context.route('https://images.example.invalid/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }));
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'sdk-product.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.getByRole('button', { name: 'Use original', exact: true }).click();
  await page.getByRole('button', { name: /Upload 1 file/ }).click();
  await page.getByText('1 image added.', { exact: true }).waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByText('Saved.', { exact: true }).waitFor();
  await page.goto(origin + '/admin/media');
  await page.getByRole('button', { name: 'Delete sdk-product.jpg', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete image', exact: true }).click();
  await page.getByText(/sdk-product.jpg is in use/).waitFor();
  assert.ok((await api('admin-products', { op: 'image-refs' })).fileIds.includes(files[0].id));
  for (const [route, title] of [['profile','Profile'], ['media','Media server'], ['appearance','Appearance'], ['logs','Logs'], ['settings','Settings']]) {
    const count = calls.length; await page.goto(origin + '/admin/' + route);
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal(await page.locator('.shop-ui').count(), 0); assert.equal(calls.length, count, 'SDK pages must not query Shop workflows');
  }
  await page.goto(origin + '/admin/pages/new');
  await page.getByLabel('Title', { exact: true }).fill('SDK delivery guide');
  await page.getByLabel('Slug', { exact: true }).fill('sdk-delivery-guide');
  await page.locator('#body-md').fill('## Delivery\n\nYour order is on its way.');
  await page.getByRole('button', { name: /Create page/ }).click();
  await page.waitForURL(/\/admin\/pages\/\d+$/);
  await page.goto(origin + '/pages/sdk-delivery-guide');
  await page.getByRole('heading', { name: 'SDK delivery guide', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Delivery', exact: true }).waitFor();
  await page.goto(origin + '/admin/orders');
  await page.getByRole('heading', { name: 'Orders', exact: true }).waitFor();
  await page.getByText('No orders yet', { exact: true }).filter({ visible: true }).waitFor();
  const nextOrders = page.waitForResponse(response => response.url().endsWith('/admin-orders'));
  assert.ok(sockets.size, 'Shop websocket connected');
  for (const socket of sockets) socket.send(JSON.stringify({ type: 'order.paid' }));
  await nextOrders;
  // Guest checkout uses the real cart, stock reservation and payment-finalisation scripts.
  role = ''; await page.evaluate(() => localStorage.clear());
  await page.goto(origin);
  await page.getByRole('link', { name: 'SDK Test Shop home', exact: true }).waitFor();
  await shot(page, 'shop-storefront');
  const catalog = await api('catalog', { op: 'products', take: 100 }, '');
  const product = catalog.items.find(item => item.AvailableQty > 0);
  assert.ok(product);
  const detail = await api('catalog', { op: 'product', slug: product.Slug }, '');
  const variant = detail.Variants.find(item => item.IsDefault) || detail.Variants[0];
  await page.goto(origin + '/p/' + product.Slug);
  await page.getByRole('heading', { name: product.Name, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).first().click();
  await page.getByRole('button', { name: 'Cart, 1 item', exact: true }).waitFor();
  await page.goto(origin + '/checkout');
  await page.getByLabel('Email (order confirmation and receipt)', { exact: true }).fill('guest@example.invalid');
  await page.getByLabel('First name', { exact: true }).fill('Test');
  await page.getByLabel('Last name', { exact: true }).fill('Shopper');
  await page.getByRole('button', { name: 'Continue to delivery', exact: true }).click();
  await page.getByLabel('Street address', { exact: true }).fill('1 Test Street');
  await page.getByLabel('City', { exact: true }).fill('Cape Town');
  await page.getByLabel('Postal code', { exact: true }).fill('8001');
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  await shot(page, 'shop-checkout');
  await context.route('https://checkout.example.invalid/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Simulated Wallet checkout</h1>' }));
  await page.getByRole('button', { name: /^Pay / }).first().click();
  await page.getByRole('heading', { name: 'Simulated Wallet checkout' }).waitFor();
  const created = (await api('admin-orders', { op: 'list' })).items[0];
  await page.goto(origin + '/checkout/return?ref=' + created.Reference);
  await page.getByRole('heading', { name: 'Thank you, your order is confirmed', exact: true }).waitFor();
  const paid = await api('admin-orders', { op: 'get', id: created.Id });
  assert.equal(paid.PaymentStatus, 'paid');
  const after = await api('catalog', { op: 'product', slug: product.Slug }, '');
  assert.equal(after.Variants.find(item => item.Id === variant.Id).AvailableQty, variant.AvailableQty - 1);
  await shot(page, 'shop-payment-return');
  // Customer order history remains custom; profile is supplied by the SDK.
  role = 'User';
  await page.goto(origin + '/account?' + new URLSearchParams({ access_token: activeToken, refresh_token: 'isolated-refresh', expires_in: '3600' }));
  await page.getByRole('heading', { name: 'Your orders', exact: true }).waitFor();
  const cart = await api('cart', { op: 'add', variantId: variant.Id, qty: 1 }, 'User');
  const customerOrder = await api('checkout', { token: cart.token, email: 'customer@example.invalid', name: 'SDK', surname: 'Customer', shippingAddress: { line1: '1 Test', city: 'Cape Town', postalCode: '8001', country: 'ZA' }, returnBase: origin }, 'User');
  await api('payment-status', { reference: customerOrder.reference, token: cart.token }, 'User');
  await page.goto(origin + '/account/orders/' + customerOrder.reference);
  await page.getByRole('heading', { name: 'Order ' + customerOrder.reference, exact: true }).waitFor();
  await page.goto(origin + '/account/profile');
  await page.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
  const count = calls.length;
  await page.goto(origin + '/admin/products');
  await page.getByRole('heading', { name: 'Shop administrator access required' }).waitFor();
  assert.equal(calls.length, count);
  grants = false; role = 'Admin';
  await page.goto(origin + '/admin/products');
  await page.getByRole('heading', { name: 'Back office access required' }).waitFor();
  assert.equal(calls.length, count);
  grants = true; values = { ...values, theme_mode: 'dark' };
  await page.goto(origin + '/admin/products');
  await page.getByRole('heading', { name: 'Products', exact: true }).waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.notEqual(await page.locator('.shop-ui .card').last().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
  await shot(page, 'shop-dark-products');
  await page.goto(origin + '/shop');
  await page.getByRole('heading', { name: 'All products', exact: true }).waitFor();
  assert.notEqual(await page.locator('.shop-store header').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(255, 255, 255, 0.9)');
  await shot(page, 'shop-dark-catalog');
  values = { ...values, theme_mode: 'light' };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/shop');
  await page.getByRole('heading', { name: 'All products', exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile catalogue must fit viewport');
  await shot(page, 'shop-mobile-catalog');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Menu', exact: true }).waitFor();
  await shot(page, 'shop-mobile-menu');
  values = { ...values, enable_public_website: 'false' };
  role = ''; await page.evaluate(() => localStorage.clear());
  const beforeGate = calls.length;
  await page.goto(origin + '/shop');
  await page.getByRole('heading', { name: 'Hosted sign in' }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('returnUrl'), origin + '/admin');
  assert.equal(calls.length, beforeGate);
  values = { ...values, enable_public_website: 'true', require_public_website_login: 'true' };
  await page.goto(origin + '/shop');
  await page.getByRole('heading', { name: 'Hosted sign in' }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('returnUrl'), origin + '/shop');
  assert.deepEqual(errors, []);
  console.log('Passed: SDK session/refresh, native and commerce permissions, shared pages, business settings, SDK media upload and reference guard, content pages, live orders, guest cart/checkout/payment return, stock decrement, customer order history/profile, light/dark/mobile and public website settings. Native services and Wallet were simulated.');
} catch (error) {
  console.error('Fixture output:', pythonOutput);
  console.error('Browser errors:', errors);
  for (const context of browser?.contexts() || []) for (const page of context.pages()) {
    console.error('Page:', page.url(), await page.locator('body').innerText().catch(() => 'unavailable'));
    await shot(page, 'shop-failure').catch(() => {});
  }
  throw error;
} finally {
  await browser?.close(); await server?.close();
  python.kill(); await new Promise(resolve => python.exitCode !== null ? resolve() : python.once('exit', resolve));
  // All fixture files live in this newly created, verified temporary directory.
  if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('shop-sdk-')) await fs.rm(directory, { recursive: true, force: true });
}
