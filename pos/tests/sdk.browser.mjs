// SDK integration against real POS workflow scripts and an isolated SQLite database.
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
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pos-sdk-'));
const origin = 'http://127.0.0.1:3594', apiOrigin = 'http://127.0.0.1:3595';
const appId = '12345678-1234-4234-8234-123456789abc';
const metadata = JSON.parse(await fs.readFile(path.join(root, 'template.json'), 'utf8'));
const python = spawn('python', ['-B', '-X', 'utf8', 'tests/workflow_fixture.py', '--db', path.join(directory, 'pos.sqlite'), '--port', '3595'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let pythonOutput = '';
python.stdout.on('data', chunk => { pythonOutput += chunk; });
python.stderr.on('data', chunk => { pythonOutput += chunk; });
let browser, server;
const errors = [], calls = [];
async function api(route, body, role = 'Admin') {
  const response = await fetch(apiOrigin + '/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-POS-Test': '1' }, body: JSON.stringify({ role, body }) });
  const result = await response.json(); assert.equal(response.status, 200, route + ': ' + JSON.stringify(result)); return result;
}
const shot = async (page, name) => {
  if (!process.env.POS_TEST_OUTPUT_DIR) return;
  await fs.mkdir(process.env.POS_TEST_OUTPUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.POS_TEST_OUTPUT_DIR, name + '.png'), fullPage: true, animations: 'disabled' });
};
try {
  for (let attempt = 0; ; attempt++) {
    try { await api('pos-catalog', { op: 'settings' }); break; }
    catch { if (attempt >= 80 || python.exitCode != null) throw new Error(pythonOutput || 'Fixture failed to start'); await delay(100); }
  }
  const env = { VITE_CLOUDGATE_API_URL: 'https://gateway.example.invalid', VITE_CLOUDGATE_API_PROJECT: 'pos', VITE_CLOUDGATE_API_ENV: 'sbx', VITE_API_KEY: '', VITE_API_SECRET: '', VITE_IDP_BASE_URL: 'https://hub.example.invalid', VITE_IDP_API_URL: 'https://api.example.invalid', VITE_IDP_TENANCY_NAME: 'pos', VITE_CLOUDGATE_WEB_APP_ID: appId, VITE_CLOUDGATE_WS_USER: 'test', VITE_CLOUDGATE_WS_PASSWORD: 'test' };
  server = await createServer({ root, configFile: false, envDir: false, plugins: [react()], logLevel: 'warn',
    resolve: { alias: { '@': path.join(root, 'src') } },
    define: Object.fromEntries(Object.entries(env).map(([key, value]) => ['import.meta.env.' + key, JSON.stringify(value)])),
    server: { host: '127.0.0.1', port: 3594, strictPort: true } });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  let role = 'Admin', grants = true, failOnce = true, refreshes = 0;
  const token = suffix => `e30.${Buffer.from(JSON.stringify({ sub: '1', exp: Math.floor(Date.now() / 1000) + 3600, jti: suffix })).toString('base64url')}.test`;
  const initialToken = token('initial'), refreshedToken = token('refreshed');
  let activeToken = initialToken, values = { ...DEFAULT_SETTINGS, ...metadata.appSettings, app_name: 'SDK Test POS' };
  const sockets = new Set(), files = [];
  await context.route('**/cg-analytics.json', route => route.fulfill({ json: { webAppId: appId, isProduction: false } }));
  await context.routeWebSocket('wss://api.example.invalid/**', socket => socket.send(JSON.stringify({ type: 'ready', environment: 'sbx' })));
  await context.routeWebSocket('wss://gateway.example.invalid/**', socket => { sockets.add(socket); socket.onClose(() => sockets.delete(socket)); });
  await context.route('https://gateway.example.invalid/**', async route => {
    const request = route.request(), data = request.postDataJSON();
    const endpoint = new URL(request.url()).pathname.split('/').pop();
    assert.match(new URL(request.url()).pathname, /^\/sbx\/pos\//);
    calls.push({ endpoint, ...data });
    assert.equal(request.headers().authorization, 'Bearer ' + activeToken);
    if (failOnce) { failOnce = false; return route.fulfill({ status: 401, json: { message: 'Session expired' } }); }
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
    assert.equal(request.headers().authorization, 'Bearer ' + activeToken);
    if (pathname.endsWith('/profile')) return reply({ id: role === 'Admin' ? 1 : 2, name: 'SDK', surname: 'Cashier', email: 'cashier@example.invalid', role, isEmailConfirmed: true,
      rolePermissions: grants ? BACKOFFICE_PERMISSION_KEYS.map(key => ({ key, value: 'true' })) : [] });
    if (pathname.includes('/notifications/')) return reply(pathname.endsWith('/unread-count') ? { unreadCount: 0 } : { items: [], totalCount: 0 });
    if (pathname.endsWith('/profile/cloudgate-link')) return reply({ linked: false, available: true });
    if (pathname.endsWith('/files')) return reply({ items: files.filter(file => file.path === url.searchParams.get('path')), total: files.filter(file => file.path === url.searchParams.get('path')).length });
    if (pathname.endsWith('/files/upload')) {
      assert.equal(url.searchParams.get('path'), 'pos/media');
      const file = { id: '98765432-1234-4234-8234-123456789abc', name: 'sdk-product.jpg', path: 'pos/media', url: 'https://images.example.invalid/product.png' };
      files.push(file); return reply(file);
    }
    if (pathname.endsWith('/admin/appearance/details')) return reply({ values, revision: appId });
    if (pathname.includes('/admin/workflow-logs/')) return reply({ items: [], totalCount: 0, endpoints: [], stats: {} });
    throw new Error('Unexpected native endpoint: ' + pathname);
  });
  await context.route('https://hub.example.invalid/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Hosted sign in</h1>' }));
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/admin/products?' + new URLSearchParams({ access_token: initialToken, refresh_token: 'isolated-refresh', expires_in: '3600' }));
  await page.getByRole('heading', { name: 'Products', exact: true }).waitFor();
  await page.locator('.pos-ui table tbody tr').first().waitFor();
  assert.equal(refreshes, 1); assert.equal(new URL(page.url()).search, '');
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  await sidebar.getByText('Cloudgate SDK', { exact: true }).waitFor();
  for (const [route, label, title] of [
    ['', 'Dashboard', 'Dashboard'], ['sales', 'Sales', 'Sales'], ['shifts', 'Shifts', 'Shifts'],
    ['reports', 'Retail reports', 'Reports'], ['categories', 'Categories', 'Categories'],
    ['inventory', 'Inventory', 'Inventory'], ['suppliers', 'Suppliers', 'Suppliers'],
    ['customers', 'Customers', 'Customers'], ['tellers', 'Teller activity', 'Tellers'],
    ['registers', 'Registers', 'Registers'], ['business', 'POS settings', 'POS settings']
  ]) {
    await sidebar.getByRole('link', { name: label, exact: true }).click();
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname.replace(/\/$/, ''), '/admin' + (route ? '/' + route : ''));
  }
  await page.getByLabel('Store name', { exact: true }).fill('SDK Test Receipt Store');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByText('Settings saved.', { exact: true }).waitFor();
  const payload = calls.findLast(call => call.endpoint === 'admin-settings' && call.op === 'set').values;
  assert.equal(payload.store_name, 'SDK Test Receipt Store');
  assert.ok(!Object.keys(payload).some(key => /^(theme_|smtp_|store_logo|store_icon|app_)/.test(key)));
  await shot(page, 'pos-business-settings');
  await page.goto(origin + '/admin/products');
  await page.getByRole('link', { name: 'Edit', exact: true }).first().click();
  await page.getByRole('button', { name: 'Upload…', exact: true }).click();
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 80; canvas.getContext('2d').fillRect(0, 0, 80, 80); return canvas.toDataURL('image/png').split(',')[1]; });
  await context.route('https://images.example.invalid/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }));
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'sdk-product.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.getByRole('button', { name: 'Use original', exact: true }).click();
  await page.getByRole('button', { name: /Upload 1 file/ }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Saved.', { exact: true }).waitFor();
  await page.goto(origin + '/admin/media');
  await page.getByRole('button', { name: 'Delete sdk-product.jpg', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete image', exact: true }).click();
  await page.getByText(/sdk-product.jpg is in use/).waitFor();
  assert.ok((await api('admin-products', { op: 'image-refs' })).fileIds.includes(files[0].id));
  for (const [route, title] of [['profile','Profile'], ['media','Media server'], ['appearance','Appearance'], ['logs','Logs'], ['settings','Settings']]) {
    const count = calls.length; await page.goto(origin + '/admin/' + route);
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal(await page.locator('.pos-ui').count(), 0); assert.equal(calls.length, count, 'SDK page must not query retail workflows');
  }
  await page.goto(origin + '/shift');
  await page.getByRole('heading', { name: 'Open a shift', exact: true }).waitFor();
  await page.getByRole('button', { name: /Main till|Till 1|Register 1/ }).first().click();
  await page.getByRole('button', { name: 'Open shift', exact: true }).click();
  await page.getByText('Shift opened', { exact: true }).waitFor();
  await page.locator('nav').getByRole('link', { name: 'Register', exact: true }).click();
  await page.locator('.pos-tile').first().waitFor();
  assert.equal(await page.locator('.pos-header nav a span').first().isVisible(), true, 'desktop till labels are visible');
  assert.ok((await page.locator('.pos-ui aside').boundingBox()).width < 500, 'desktop cart sits beside the catalogue');
  await shot(page, 'pos-desktop-till');
  const nextCatalog = page.waitForResponse(response => response.url().endsWith('/pos-catalog') && response.request().postDataJSON()?.op === 'products');
  assert.ok(sockets.size, 'retail websocket is connected');
  for (const socket of sockets) socket.send(JSON.stringify({ type: 'stock.adjusted' }));
  await nextCatalog;
  await page.getByText('SDK Test POS', { exact: true }).waitFor();
  const catalogue = await api('pos-catalog', { op: 'products' });
  const product = catalogue.items.find(item => !item.IsWeighed && item.StockQty > 0);
  await page.locator('.pos-tile').filter({ hasText: product.Name }).click();
  await page.getByRole('button', { name: /^Pay / }).click();
  const tender = page.getByRole('dialog', { name: 'Take payment' });
  await tender.locator('.grid.grid-cols-3 > button').first().click();
  await page.locator('.pos-receipt').waitFor();
  await page.locator('.pos-receipt').getByText('SDK Test Receipt Store', { exact: true }).waitFor();
  await shot(page, 'pos-cash-receipt');
  const cash = (await api('pos-sale', { op: 'recent' })).items[0];
  assert.equal(cash.Status, 'completed');
  assert.equal((await api('pos-catalog', { op: 'lookup', code: product.Barcode || product.Sku })).product.StockQty, product.StockQty - 1);
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.pos-receipt').evaluate(el => getComputedStyle(el).visibility), 'visible');
  assert.equal(await page.locator('.pos-header').evaluate(el => getComputedStyle(el).visibility), 'hidden');
  await page.emulateMedia({ media: 'screen' });
  await page.goto(origin);
  await page.locator('.pos-tile').filter({ hasText: product.Name }).click();
  await page.getByRole('button', { name: /^Pay / }).click();
  await page.getByRole('button', { name: 'Card', exact: true }).click();
  await page.getByRole('button', { name: 'Start card payment', exact: true }).click();
  await page.getByRole('img', { name: 'Payment QR code' }).waitFor();
  await page.locator('.pos-receipt').waitFor();
  assert.equal((await api('pos-sale', { op: 'recent' })).items[0].Status, 'completed');
  await page.goto(origin + '/sales');
  await page.getByPlaceholder('Find a receipt by number (R-100001) or scan it').waitFor();
  assert.equal(new URL(page.url()).pathname, '/sales', 'till Sales must not redirect to admin Sales');
  await page.goto(origin + '/returns');
  await page.getByPlaceholder('Scan the receipt barcode or type its number (R-100001)').fill(cash.Reference);
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await page.getByRole('button', { name: 'all', exact: true }).click();
  await page.getByRole('button', { name: 'Refund cash', exact: true }).click();
  await page.getByRole('dialog', { name: 'Confirm refund' }).getByRole('button', { name: 'Refund', exact: true }).click();
  await page.getByRole('button', { name: 'Another return', exact: true }).waitFor();
  assert.equal((await api('pos-sale', { op: 'get', saleId: cash.Id })).Status, 'refunded');
  await page.goto(origin + '/admin/sales');
  await page.locator('.pos-ui table tbody tr').first().getByRole('link').click();
  await page.waitForURL(/\/admin\/sales\/\d+$/);
  await page.locator('.pos-receipt').waitFor();
  await shot(page, 'pos-admin-sale');
  values = { ...values, theme_mode: 'dark' };
  await page.goto(origin + '/admin/products');
  await page.getByRole('heading', { name: 'Products', exact: true }).waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.notEqual(await page.locator('.pos-ui .card').last().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)', 'retail cards must use the SDK dark surface');
  assert.notEqual(await page.locator('.pos-ui .input').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)', 'retail inputs must use the SDK dark surface');
  await shot(page, 'pos-dark-products');
  values = { ...values, theme_mode: 'light' };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  await page.locator('.pos-tile').first().waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile till must fit viewport');
  await shot(page, 'pos-mobile-till');
  await page.setViewportSize({ width: 1440, height: 1000 });
  role = 'User';
  const count = calls.length;
  await page.goto(origin + '/admin/products');
  await page.getByRole('heading', { name: 'Retail administrator access required' }).waitFor();
  assert.equal(calls.length, count);
  await page.goto(origin + '/account/profile');
  await page.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
  grants = false; role = 'Admin';
  await page.goto(origin + '/admin/products');
  await page.getByRole('heading', { name: 'Back office access required' }).waitFor();
  assert.equal(calls.length, count);
  await page.evaluate(() => localStorage.clear());
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Hosted sign in' }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('returnUrl'), origin + '/');
  values = { ...values, enable_public_website: 'false' };
  for (const [route, heading] of [['done', 'Payment received'], ['cancel', 'Payment cancelled']]) {
    await page.goto(origin + '/pay/' + route + '?ref=TEST');
    await page.getByRole('heading', { name: heading, exact: true }).waitFor();
  }
  assert.deepEqual(errors, []);
  console.log('Passed: SDK callback and refresh, native and retail access gates, shared pages, POS settings, SDK photo upload/deletion guard, real SQLite cash/card sales and cash returns, live refresh, receipts/printing, independent till routes, responsive layouts, dark theme and public payment returns. Wallet responses were simulated.');
} catch (error) {
  console.error('Fixture output:', pythonOutput);
  console.error('Browser errors:', errors);
  for (const context of browser?.contexts() || []) for (const page of context.pages()) {
    console.error('Page:', page.url(), await page.locator('body').innerText().catch(() => 'unavailable'));
    await shot(page, 'pos-failure').catch(() => {});
  }
  throw error;
} finally {
  await browser?.close(); await server?.close();
  python.kill(); await new Promise(resolve => python.exitCode !== null ? resolve() : python.once('exit', resolve));
  // All fixture files live in this newly created, verified temporary directory.
  if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('pos-sdk-')) await fs.rm(directory, { recursive: true, force: true });
}
