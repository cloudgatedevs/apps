// Real Booking workflows run against an isolated SQLite simulator. Native SDK calls are mocked.
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
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'booking-sdk-'));
const apiOrigin = 'http://127.0.0.1:3293', origin = 'http://127.0.0.1:3292';
const appId = '12345678-1234-4234-8234-123456789abc';
const python = spawn('python', ['-B', '-X', 'utf8', 'cloudgate/local_server.py', '--db', path.join(directory, 'booking.sqlite'), '--port', '3293'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let pythonOutput = '';
python.stdout.on('data', chunk => { pythonOutput += chunk; });
python.stderr.on('data', chunk => { pythonOutput += chunk; });
const browser = await chromium.launch({ headless: true });
let server;
const errors = [];
const shot = async (page, name) => {
  if (!process.env.BOOKING_TEST_OUTPUT_DIR) return;
  await fs.mkdir(process.env.BOOKING_TEST_OUTPUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.BOOKING_TEST_OUTPUT_DIR, name + '.png'), fullPage: true, animations: 'disabled' });
};
async function api(action, data, admin = false) {
  const response = await fetch(apiOrigin + '/api/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Studio-Preview': '1', ...(admin ? { 'X-Preview-Role': 'admin' } : {}) }, body: JSON.stringify(data) });
  return { status: response.status, body: await response.text() };
}
async function start(connected) {
  const env = { VITE_CLOUDGATE_API_URL: connected ? 'https://gateway.example.invalid' : '', VITE_CLOUDGATE_API_PROJECT: 'booking', VITE_CLOUDGATE_API_ENV: 'sbx', VITE_API_KEY: '', VITE_API_SECRET: '', VITE_IDP_BASE_URL: 'https://hub.example.invalid', VITE_IDP_API_URL: 'https://api.example.invalid', VITE_IDP_TENANCY_NAME: 'booking', VITE_CLOUDGATE_WEB_APP_ID: appId, VITE_IDP_RETURN_URL: '' };
  server = await createServer({ root, configFile: false, envDir: false, mode: connected ? 'development' : 'preview', plugins: [react()], logLevel: 'warn',
    define: Object.fromEntries(Object.entries(env).map(([key, value]) => ['import.meta.env.' + key, JSON.stringify(value)])),
    server: { host: '127.0.0.1', port: 3292, strictPort: true, proxy: { '/api': apiOrigin } } });
  await server.listen();
}
try {
  for (let attempt = 0; ; attempt++) {
    try { await api('booking', { op: 'catalog' }); break; }
    catch { if (attempt >= 80 || python.exitCode != null) throw new Error(pythonOutput || 'Local API failed to start'); await delay(100); }
  }
  await start(false);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await context.routeWebSocket(/\/ws-idp-notifications/, socket => socket.send(JSON.stringify({ type: 'ready', environment: 'sbx' })));
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/book?service=1');
  await page.getByRole('heading', { name: 'What would you like to book?' }).waitFor();
  await page.getByRole('button', { name: 'Find a time' }).click();
  await page.locator('.slots button').first().click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('SDK Booking Test');
  await page.getByLabel('Email address', { exact: true }).fill('booking-test@example.invalid');
  await page.getByLabel('Phone number', { exact: true }).fill('+27 82 555 0101');
  await page.getByRole('button', { name: 'Review & pay' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue to secure payment' }).click();
  await page.waitForURL('**/test-checkout?*');
  await page.getByRole('button', { name: 'Simulate successful payment' }).click();
  await page.waitForURL('**/checkout/return?*');
  await page.locator('.appointment-card .badge.confirmed').waitFor();
  const reference = new URL(page.url()).searchParams.get('ref');
  await page.getByRole('button', { name: 'Reschedule', exact: true }).click();
  await page.getByRole('dialog').locator('.slots button').last().click();
  await page.getByRole('button', { name: 'Confirm new time' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });

  await page.goto(origin + '/admin');
  await page.getByRole('heading', { name: 'Your day, at a glance.' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/admin');
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  await sidebar.getByText('Cloudgate SDK', { exact: true }).waitFor();
  await sidebar.getByRole('link', { name: 'Appointments', exact: true }).click();
  await page.getByPlaceholder('Search name, email, or reference…').fill(reference);
  await page.getByRole('button', { name: 'SDK Booking Test', exact: true }).click();
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'SDK Booking Test', exact: true }).click();
  await page.getByRole('button', { name: 'Complete visit', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.locator('td .badge.completed').waitFor();
  await page.getByRole('button', { name: 'SDK Booking Test', exact: true }).click();
  await page.getByRole('button', { name: 'Refund', exact: true }).click();
  await page.getByLabel('Amount (ZAR)', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Confirm refund', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByText('Refund confirmed.', { exact: true }).waitFor();
  for (const name of ['Calendar', 'Clients', 'Services', 'Team & hours', 'Rooms & resources', 'Waitlist', 'Promotions', 'Booking reports', 'Booking emails', 'Business settings']) {
    await sidebar.getByRole('link', { name, exact: true }).click();
    await page.locator('.admin-title h1').filter({ hasText: name }).waitFor();
  }
  assert.equal(await page.getByRole('heading', { name: 'Theme colours', exact: true }).count(), 0);
  await page.getByLabel('Business name', { exact: true }).fill('SDK Booking Studio');
  await page.getByRole('button', { name: 'Save business settings', exact: true }).click();
  await page.getByText('Saved. Your business is up to date.').waitFor();
  await sidebar.getByRole('link', { name: 'Services', exact: true }).click();
  await page.getByRole('button', { name: 'Add service', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Service name', { exact: true }).fill('SDK custom service');
  await page.getByRole('dialog').getByLabel(/^Category/).selectOption('category:Massage');
  await page.getByRole('dialog').getByLabel(/^Price \(ZAR\)/).fill('450');
  await page.getByRole('dialog').getByLabel('Maya Daniels', { exact: true }).check();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#6655dd'; ctx.fillRect(0, 0, 64, 64);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Upload service photo', { exact: true }).setInputFiles({ name: 'service-test.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.getByRole('button', { name: 'Use entire image' }).click();
  await page.getByRole('dialog', { name: 'Prepare your image' }).waitFor({ state: 'hidden' });
  await page.getByRole('dialog').getByRole('button', { name: 'Save service', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('heading', { name: 'SDK custom service', exact: true }).waitFor();
  await page.goto(origin + '/admin/media');
  await page.getByRole('heading', { name: 'Media server', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Delete service-test.png', exact: true }).click();
  await page.getByRole('button', { name: 'Delete image', exact: true }).click();
  await page.getByText(/service-test.png is now in use/).waitFor();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto(origin + '/admin/overview');
  await page.getByRole('heading', { name: 'Your day, at a glance.' }).waitFor();
  await shot(page, 'booking-sdk-overview');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name: 'Calendar', exact: true }).click();
  await page.getByRole('heading', { name: 'Calendar', exact: true }).waitFor();
  await shot(page, 'booking-sdk-mobile');
  await page.goto(origin + '/');
  await page.locator('.customer-app').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await shot(page, 'booking-sdk-storefront');
  await page.getByRole('link', { name: 'My appointments', exact: true }).click();
  await page.getByRole('heading', { name: 'Your appointment.', exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/appointments');
  // A pending refund uses its original request key for status checks and retries.
  const snapshot = JSON.parse((await api('booking', { op: 'admin-data' }, true)).body);
  const paid = snapshot.bookings.find(booking => booking.reference === reference);
  snapshot.bookings = [{ ...paid, reference: 'UI-REFUND-TEST', refunded: 0, customer: { ...paid.customer, name: 'Refund UI Test' } }];
  const key = 'ui-refund-stable-request-key';
  snapshot.refund_requests = [{ Id: 999999, booking_ref: 'UI-REFUND-TEST', request_key: key, amount: 10000, status: 'pending', provider_id: 're_ui' }];
  const requests = [];
  await page.route('**/api/booking', route => route.fulfill({ json: snapshot }));
  await page.route('**/api/refund', route => { requests.push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true, status: 'pending' } }); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/admin/appointments');
  await page.getByRole('button', { name: 'Refund UI Test', exact: true }).click();
  await page.getByRole('heading', { name: 'Refund history', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Refund', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Check refund status' }).click();
  await page.getByText('Refund submitted. Waiting for confirmation.').waitFor();
  assert.equal(requests[0].op, 'refund-status'); assert.equal(requests[0].request_key, key);
  await page.getByRole('button', { name: 'Refund UI Test', exact: true }).click();
  await page.getByRole('button', { name: 'Retry this request' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(requests[1].op, 'refund'); assert.equal(requests[1].request_key, key); assert.equal(requests[1].amount, 10000);
  await context.close(); await server.close(); server = null;
  console.log('PASS Booking checkout, confirmation, reschedule, check-in, completion, refunds, custom modules, media protection, service creation, business settings and responsive SDK shell.');

  await start(true);
  let grants = true, role = 'Admin';
  const calls = [];
  const token = `e30.${Buffer.from(JSON.stringify({ sub: '1', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`;
  const connected = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await connected.addInitScript(token => localStorage.setItem('idp_access_token', token), token);
  await connected.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
  await connected.route('**/cg-analytics.json', route => route.fulfill({ json: { webAppId: appId, isProduction: false } }));
  await connected.routeWebSocket('wss://api.example.invalid/**', socket => socket.send(JSON.stringify({ type: 'ready', environment: 'sbx' })));
  await connected.route('https://gateway.example.invalid/**', async route => {
    const data = route.request().postDataJSON(); calls.push(data.op);
    if (data.op === 'account') return route.fulfill({ json: { profile: { name: 'Alex', email: 'alex@example.invalid', phone: '' }, bookings: [] } });
    const result = await api(new URL(route.request().url()).pathname.split('/').at(-1), data, role === 'Admin');
    await route.fulfill({ status: result.status, contentType: 'application/json', body: result.body });
  });
  await connected.route('https://api.example.invalid/**', async route => {
    const url = new URL(route.request().url()), pathname = url.pathname;
    calls.push(pathname);
    const reply = json => route.fulfill({ json });
    if (pathname.endsWith('/website')) return reply({ values: { ...DEFAULT_SETTINGS, app_name: 'SDK Booking Studio', theme_density: 'flex' }, revision: appId, allowSelfRegistration: false });
    assert.equal(route.request().headers().authorization, 'Bearer ' + token);
    if (pathname.endsWith('/profile')) return reply({ id: 1, name: 'Alex', surname: 'Builder', email: 'alex@example.invalid', role, isEmailConfirmed: true, rolePermissions: grants ? BACKOFFICE_PERMISSION_KEYS.map(key => ({ key, value: 'true' })) : [] });
    if (pathname.includes('/notifications/')) return reply(pathname.endsWith('/unread-count') ? { unreadCount: 0 } : { items: [], totalCount: 0 });
    if (pathname.endsWith('/profile/cloudgate-link')) return reply({ linked: false, available: true });
    if (pathname.endsWith('/files')) return reply({ items: [], total: 0 });
    if (pathname.endsWith('/admin/appearance/details')) return reply({ values: { ...DEFAULT_SETTINGS, app_name: 'SDK Booking Studio' }, revision: appId });
    if (pathname.includes('/admin/workflow-logs/')) return reply({ items: [], totalCount: 0, endpoints: [], stats: {} });
    return reply({ items: [], totalCount: 0 });
  });
  const admin = await connected.newPage(); admin.setDefaultTimeout(20000);
  admin.on('pageerror', error => errors.push(error.message));
  await admin.goto(origin + '/admin/overview');
  await admin.getByRole('heading', { name: 'Your day, at a glance.' }).waitFor();
  for (const [route, heading] of [['profile', 'Profile'], ['media', 'Media server'], ['appearance', 'Appearance'], ['logs', 'Logs']]) {
    const count = calls.filter(call => call === 'admin-data').length;
    await admin.goto(origin + '/admin/' + route);
    await admin.getByRole('heading', { name: heading, exact: true }).waitFor();
    assert.equal(await admin.locator('.booking-workspace').count(), 0);
    assert.equal(calls.filter(call => call === 'admin-data').length, count, 'SDK pages must not load the Booking admin snapshot');
  }
  await admin.goto(origin + '/account/profile');
  await admin.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
  await admin.goto(origin + '/account');
  await admin.getByRole('button', { name: 'Log out', exact: true }).click();
  await admin.locator('.customer-app').waitFor();
  assert.equal(await admin.evaluate(() => localStorage.getItem('idp_access_token')), null);
  assert.equal(new URL(admin.url()).pathname, '/');
  await admin.evaluate(token => localStorage.setItem('idp_access_token', token), token);
  grants = false;
  const count = calls.filter(call => call === 'admin-data').length;
  await admin.goto(origin + '/admin/appointments');
  await admin.getByRole('heading', { name: 'Back office access required' }).waitFor();
  assert.equal(calls.filter(call => call === 'admin-data').length, count);
  await connected.close();
  assert.deepEqual(errors, []);
  console.log('PASS native SDK profile/media/appearance/logs, SDK customer profile, shared logout and permission gate without loading domain data.');
} catch (error) {
  console.error('Browser errors:', errors);
  for (const context of browser.contexts()) for (const page of context.pages()) {
    console.error('Page:', page.url(), await page.locator('body').innerText().catch(() => 'unavailable'));
    await shot(page, 'booking-sdk-failure');
  }
  throw error;
} finally {
  await browser.close(); await server?.close();
  python.kill();
  await new Promise(resolve => python.exitCode == null ? python.once('exit', resolve) : resolve());
  if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('booking-sdk-')) await fs.rm(directory, { recursive: true, force: true });
}
