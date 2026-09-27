// Real Events workflows use an isolated database. Native SDK services are simulated or mocked.
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
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'events-sdk-'));
const apiOrigin = 'http://127.0.0.1:3493', origin = 'http://127.0.0.1:3492';
const appId = '12345678-1234-4234-8234-123456789abc';
const metadata = JSON.parse(await fs.readFile(path.join(root, 'template.json'), 'utf8'));
const sdkVersion = JSON.parse(await fs.readFile(new URL(import.meta.resolve('@cloudgatedevs/cloudgate-client-react/package.json')), 'utf8')).version;
const python = spawn('python', ['-B', '-X', 'utf8', 'cloudgate/local_server.py', '--db', path.join(directory, 'events.sqlite'), '--port', '3493'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let pythonOutput = '';
python.stdout.on('data', chunk => { pythonOutput += chunk; });
python.stderr.on('data', chunk => { pythonOutput += chunk; });
const browser = await chromium.launch({ headless: true });
let server;
const errors = [];
const shot = async (page, name) => {
  if (!process.env.EVENTS_TEST_OUTPUT_DIR) return;
  await fs.mkdir(process.env.EVENTS_TEST_OUTPUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.EVENTS_TEST_OUTPUT_DIR, name + '.png'), fullPage: true, animations: 'disabled' });
};
async function api(op, data = {}, role = '', action = 'workspace') {
  const response = await fetch(apiOrigin + '/api/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Events-Preview': '1', 'X-Preview-Role': role }, body: JSON.stringify({ ...data, op }) });
  const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result)); return result;
}
async function pageFor(role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(role => { if (role) sessionStorage.setItem('events.preview.role', role); }, role);
  await context.routeWebSocket(/\/ws-idp-notifications/, socket => socket.send(JSON.stringify({ type: 'ready', environment: 'sbx' })));
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message)); return page;
}
async function start(connected = false) {
  const env = { VITE_CLOUDGATE_API_URL: 'https://gateway.example.invalid', VITE_CLOUDGATE_API_PROJECT: 'events', VITE_CLOUDGATE_API_ENV: 'sbx', VITE_API_KEY: '', VITE_API_SECRET: '', VITE_IDP_BASE_URL: 'https://hub.example.invalid', VITE_IDP_API_URL: 'https://api.example.invalid', VITE_IDP_TENANCY_NAME: 'events', VITE_CLOUDGATE_WEB_APP_ID: appId };
  server = await createServer({ root, configFile: false, envDir: false, mode: connected ? 'development' : 'preview', plugins: [react()], logLevel: 'warn',
    define: Object.fromEntries(Object.entries(env).map(([key, value]) => ['import.meta.env.' + key, JSON.stringify(value)])),
    server: { host: '127.0.0.1', port: 3492, strictPort: true, proxy: { '/api': apiOrigin } } });
  await server.listen();
}
try {
  for (let attempt = 0; ; attempt++) {
    try { await api('catalog'); break; }
    catch { if (attempt >= 80 || python.exitCode != null) throw new Error(pythonOutput || 'Local API failed to start'); await delay(100); }
  }
  await start();
  const guest = await pageFor(''); await guest.goto(origin);
  await guest.getByRole('heading', { name: 'Make room for something good.' }).waitFor();
  assert.equal(await guest.locator('.discovery-card').count(), 3);
  assert.equal(await guest.locator('.event-footer .cg-powered-version').innerText(), 'v' + sdkVersion);
  await shot(guest, 'events-public');
  await guest.getByRole('textbox', { name: 'Search events' }).fill('Sunday');
  assert.equal(await guest.locator('.discovery-card').count(), 1);

  const admin = await pageFor('admin'); await admin.goto(origin + '/admin');
  await admin.getByRole('heading', { name: 'Set the stage.' }).waitFor();
  const sidebar = admin.getByRole('complementary', { name: 'Sidebar' });
  await sidebar.getByText('Cloudgate SDK', { exact: true }).waitFor();
  for (const [route, title] of [['events','Events'],['orders','Bookings'],['attendees','Attendees'],['checkin','Check-in'],['waitlist','Waitlist'],['reports','Event reports'],['staff','Event staff'],['refunds','Event refunds'],['messages','Event emails'],['business','Event settings']]) {
    await sidebar.getByRole('link', { name: title, exact: true }).click();
    await admin.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal(new URL(admin.url()).pathname, '/admin/' + route);
  }
  assert.equal(await admin.getByRole('button', { name: 'Theme & branding' }).count(), 0);
  await admin.getByLabel('Business name', { exact: true }).fill('SDK Events Studio');
  await admin.getByRole('button', { name: 'Save event settings' }).click();
  await admin.getByText('Saved successfully.', { exact: true }).waitFor();
  await sidebar.getByRole('link', { name: 'Events', exact: true }).click();
  await admin.getByRole('button', { name: 'Add event', exact: true }).click();
  await admin.getByLabel('Title', { exact: true }).fill('SDK Test Event');
  await admin.getByLabel('Venue', { exact: true }).fill('Test theatre');
  await admin.getByLabel('Organiser', { exact: true }).fill('SDK Events Studio');
  const localTime = hours => { const date = new Date(Date.now() + hours * 3600000); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  await admin.getByLabel('Starts (your local time)', { exact: true }).fill(localTime(1));
  await admin.getByLabel('Ends (your local time)', { exact: true }).fill(localTime(3));
  await admin.getByLabel('Summary', { exact: true }).fill('An event created through the SDK workspace.');
  await admin.getByLabel('Description', { exact: true }).fill('Testing reservations, tickets and online admission.');
  const png = await admin.evaluate(() => { const c = document.createElement('canvas'); c.width = 40; c.height = 40; c.getContext('2d').fillRect(0, 0, 40, 40); return c.toDataURL('image/png').split(',')[1]; });
  await admin.getByLabel('Upload event artwork', { exact: true }).setInputFiles({ name: 'sdk-event.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await admin.getByRole('button', { name: 'Use entire image' }).click();
  await admin.getByRole('dialog', { name: 'Prepare your image' }).waitFor({ state: 'hidden' });
  await admin.getByRole('button', { name: 'Save event', exact: true }).click();
  await admin.getByRole('dialog').waitFor({ state: 'hidden' });
  await admin.locator('.event-admin-card').filter({ hasText: 'SDK Test Event' }).click();
  for (const [name, price] of [['Standard', '25'], ['Community', '0']]) {
    await admin.getByRole('button', { name: 'Add tier', exact: true }).click();
    await admin.getByRole('dialog').getByLabel('Name', { exact: true }).fill(name);
    await admin.getByLabel('Price (USD)', { exact: true }).fill(price);
    await admin.getByRole('button', { name: 'Save tier', exact: true }).click();
    await admin.getByRole('dialog').waitFor({ state: 'hidden' });
  }
  await admin.getByRole('button', { name: 'Publish event', exact: true }).click();
  await admin.getByText('published', { exact: true }).waitFor();
  const event = (await api('catalog')).events.find(e => e.title === 'SDK Test Event');
  assert.ok(event);

  const attendee = await pageFor('attendee');
  const reserve = async (tier, paid) => {
    await attendee.goto(origin + '/event?id=' + event.ref);
    await attendee.locator('.ticket-tier').filter({ hasText: tier }).getByRole('button', { name: 'Choose tickets' }).click();
    await attendee.getByRole('button', { name: paid ? 'Reserve tickets' : 'Confirm free tickets', exact: true }).click();
    await attendee.waitForURL('**/account');
    if (paid) {
      await attendee.getByRole('button', { name: 'Continue payment', exact: true }).click();
      await attendee.getByRole('button', { name: 'Simulate successful payment', exact: true }).click();
      await attendee.getByRole('dialog').waitFor({ state: 'hidden' });
    }
  };
  await reserve('Community', false);
  await attendee.getByRole('img', { name: 'Admission QR code' }).waitFor();
  const download = attendee.waitForEvent('download');
  await attendee.getByRole('link', { name: 'Save QR', exact: true }).click();
  assert.match((await download).suggestedFilename(), /^TIC-.*\.png$/);
  await reserve('Standard', true);
  assert.equal(await attendee.locator('.admission-ticket').count(), 2);
  await attendee.goto(origin + '/event?id=' + event.ref);
  await attendee.getByRole('button', { name: 'Join the waitlist', exact: true }).click();
  await attendee.getByText('Saved successfully.', { exact: true }).waitFor();
  await attendee.goto(origin + '/account/profile');
  await attendee.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
  assert.equal(await attendee.locator('.events-ui').count(), 0);
  await attendee.goto(origin + '/admin');
  await attendee.getByRole('heading', { name: 'Back office access required' }).waitFor();
  let snapshot = await api('workspace', {}, 'admin');
  const paidOrder = snapshot.records.find(r => r.kind === 'order' && r.amount > 0);
  const ticket = snapshot.records.find(r => r.kind === 'ticket' && r.order === paidOrder.ref);
  const staffRecord = snapshot.records.find(r => r.kind === 'staff');
  await api('staff-save', { ...staffRecord, events: [event.ref] }, 'admin');
  const staff = await pageFor('staff'); await staff.goto(origin + '/admin/events');
  await staff.getByRole('heading', { name: 'SDK Test Event', exact: true }).waitFor();
  assert.equal(await staff.locator('.event-admin-card').count(), 1, 'staff sees assigned events only');
  assert.equal(await staff.getByRole('button', { name: 'Add event' }).count(), 0);
  await staff.goto(origin + '/admin/checkin');
  for (const result of ['Welcome in!', 'Already checked in']) {
    await staff.getByLabel('Ticket QR value or ticket reference').fill(ticket.code);
    await staff.getByRole('button', { name: 'Check in guest' }).click();
    await staff.getByText(result, { exact: true }).waitFor();
  }
  await staff.goto(origin + '/admin/business');
  await staff.getByRole('heading', { name: 'Section unavailable' }).waitFor();
  assert.equal(await staff.getByRole('button', { name: 'Save event settings' }).count(), 0);
  await admin.goto(origin + '/admin/orders');
  await admin.getByRole('row').filter({ hasText: paidOrder.ref }).getByRole('button', { name: 'Refund', exact: true }).click();
  await admin.getByRole('button', { name: 'Confirm full refund' }).click();
  await admin.getByRole('dialog').getByRole('alert').waitFor();
  await admin.getByRole('button', { name: 'Close dialog' }).click();
  await admin.goto(origin + '/admin/attendees');
  await admin.getByRole('button', { name: 'Undo check-in', exact: true }).click();
  await admin.getByRole('button', { name: 'Undo check-in', exact: true }).waitFor({ state: 'hidden' });
  await admin.goto(origin + '/admin/orders');
  await admin.getByRole('row').filter({ hasText: paidOrder.ref }).getByRole('button', { name: 'Refund', exact: true }).click();
  await admin.getByRole('button', { name: 'Confirm full refund' }).click();
  await admin.getByRole('dialog').waitFor({ state: 'hidden' });
  snapshot = await api('workspace', {}, 'attendee');
  assert.equal(snapshot.records.find(r => r.ref === paidOrder.ref).status, 'refunded');
  assert.equal(snapshot.records.find(r => r.ref === ticket.ref).status, 'refunded');
  await admin.goto(origin + '/admin/waitlist');
  await admin.getByRole('button', { name: 'Notify availability' }).click();
  await admin.getByRole('button', { name: 'Notify availability' }).waitFor();
  assert.equal((await api('workspace', {}, 'admin')).records.find(r => r.kind === 'waitlist').status, 'notified');
  await admin.goto(origin + '/admin/media');
  await admin.getByRole('button', { name: 'Delete sdk-event.png', exact: true }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Delete image' }).click();
  await admin.getByText(/sdk-event.png is now in use/).waitFor();
  assert.equal(await admin.locator('.events-ui').count(), 0);
  await admin.goto(origin + '/admin/theme');
  await admin.getByRole('heading', { name: 'Colour palette', exact: true }).waitFor();
  await shot(admin, 'events-sdk-theme');
  await admin.goto(origin + '/admin');
  await admin.getByRole('heading', { name: 'Set the stage.' }).waitFor();
  await shot(admin, 'events-backoffice');
  await admin.setViewportSize({ width: 390, height: 844 });
  assert.ok(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile workspace should not overflow');
  await admin.getByRole('button', { name: 'Open menu' }).click();
  await admin.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name: 'Check-in', exact: true }).click();
  await admin.getByRole('heading', { name: 'A warm welcome. One quick scan.' }).waitFor();
  await shot(admin, 'events-mobile');
  assert.deepEqual(errors, []);
  console.log('Passed: public discovery, event/tier creation, image upload, publishing, free/paid reservations, QR download, duplicate admission, admission reversal, refunds, staff restrictions, waitlist, SDK profile/media/theme and responsive shell.');

  for (const context of browser.contexts()) await context.close();
  await server.close(); server = null;
  await start(true);
  let grants = true, failWorkspace = true, refreshes = 0;
  const calls = [];
  const token = suffix => `e30.${Buffer.from(JSON.stringify({ sub: '1', exp: Math.floor(Date.now() / 1000) + 3600, jti: suffix })).toString('base64url')}.test`;
  const initialToken = token('initial'), refreshedToken = token('refreshed');
  let activeToken = initialToken;
  let values = { ...DEFAULT_SETTINGS, ...metadata.appSettings, app_name: 'SDK Test Events' };
  const connected = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await connected.route('**/cg-analytics.json', route => route.fulfill({ json: { webAppId: appId, isProduction: false } }));
  await connected.routeWebSocket('wss://api.example.invalid/**', socket => socket.send(JSON.stringify({ type: 'ready', environment: 'sbx' })));
  await connected.route('https://gateway.example.invalid/**', async route => {
    const request = route.request(), data = request.postDataJSON();
    calls.push(data.op);
    assert.match(new URL(request.url()).pathname, /^\/sbx\/events\//);
    if (request.headers().authorization) assert.equal(request.headers().authorization, 'Bearer ' + activeToken);
    if (data.op === 'workspace') {
      assert.equal(request.headers().authorization, 'Bearer ' + activeToken);
      if (failWorkspace) { failWorkspace = false; return route.fulfill({ status: 401, json: { message: 'Session expired' } }); }
    }
    return route.fulfill({ json: await api(data.op, data, request.headers().authorization ? 'admin' : '') });
  });
  await connected.route('https://api.example.invalid/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    calls.push(pathname);
    const reply = json => route.fulfill({ json });
    if (pathname.endsWith('/website')) return reply({ values, revision: appId, allowSelfRegistration: false });
    if (pathname.endsWith('/Refresh')) {
      assert.equal(route.request().postDataJSON().refreshToken, 'isolated-refresh');
      refreshes++; activeToken = refreshedToken;
      return reply({ accessToken: activeToken, refreshToken: 'isolated-refresh', expiresIn: 3600 });
    }
    assert.equal(route.request().headers().authorization, 'Bearer ' + activeToken);
    if (pathname.endsWith('/profile')) return reply({ id: 1, name: 'Alex', surname: 'Morgan', email: 'alex@example.invalid', role: 'Admin', isEmailConfirmed: true,
      rolePermissions: grants ? BACKOFFICE_PERMISSION_KEYS.map(key => ({ key, value: 'true' })) : [] });
    if (pathname.includes('/notifications/')) return reply(pathname.endsWith('/unread-count') ? { unreadCount: 0 } : { items: [], totalCount: 0 });
    if (pathname.endsWith('/profile/cloudgate-link')) return reply({ linked: false, available: true });
    if (pathname.endsWith('/files')) return reply({ items: [], total: 0 });
    if (pathname.endsWith('/admin/appearance/details')) return reply({ values, revision: appId });
    if (pathname.includes('/admin/workflow-logs/')) return reply({ items: [], totalCount: 0, endpoints: [], stats: {} });
    throw new Error('Unexpected platform endpoint: ' + pathname);
  });
  await connected.route('https://hub.example.invalid/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Hosted sign in</h1>' }));
  const live = await connected.newPage(); live.setDefaultTimeout(15000);
  live.on('pageerror', error => errors.push(error.message));
  await live.goto(origin + '/admin/events?' + new URLSearchParams({ access_token: initialToken, refresh_token: 'isolated-refresh', expires_in: '3600' }));
  await live.getByRole('heading', { name: 'SDK Test Event', exact: true }).waitFor();
  assert.equal(refreshes, 1, 'a workflow 401 should refresh the SDK session once and retry');
  assert.equal(new URL(live.url()).search, '', 'SDK consumes and removes callback tokens');
  assert.equal(await live.evaluate(() => localStorage.getItem('idp_access_token')), refreshedToken);
  for (const [route, title] of [['profile', 'Profile'], ['media', 'Media server'], ['appearance', 'Appearance'], ['logs', 'Logs'], ['settings', 'Settings']]) {
    const before = calls.filter(call => call === 'workspace').length;
    await live.goto(origin + '/admin/' + route);
    await live.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal(await live.locator('.events-ui').count(), 0);
    assert.equal(calls.filter(call => call === 'workspace').length, before, 'SDK pages must not load the Events workspace');
  }
  await live.goto(origin + '/account/profile');
  await live.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
  grants = false;
  const before = calls.filter(call => call === 'workspace').length;
  await live.goto(origin + '/admin/events');
  await live.getByRole('heading', { name: 'Back office access required' }).waitFor();
  assert.equal(calls.filter(call => call === 'workspace').length, before);
  await live.goto(origin + '/account');
  await live.getByRole('button', { name: 'Sign out', exact: true }).click();
  await live.getByRole('heading', { name: 'Make room for something good.' }).waitFor();
  assert.equal(await live.evaluate(() => localStorage.getItem('idp_access_token')), null);
  await live.getByRole('button', { name: 'Sign in', exact: true }).click();
  await live.getByRole('heading', { name: 'Hosted sign in' }).waitFor();
  assert.equal(new URL(live.url()).pathname, '/idp/events/login');
  assert.equal(new URL(live.url()).searchParams.get('returnUrl'), origin + '/account');
  values = { ...values, require_public_website_login: 'true' };
  const catalogues = calls.filter(call => call === 'catalog').length;
  await live.goto(origin + '/event?id=' + event.ref);
  await live.getByRole('heading', { name: 'Hosted sign in' }).waitFor();
  assert.equal(new URL(live.url()).searchParams.get('returnUrl'), origin + '/event?id=' + event.ref);
  assert.equal(calls.filter(call => call === 'catalog').length, catalogues, 'private website must not render the catalogue');
  values = { ...values, enable_public_website: 'false', require_public_website_login: 'false' };
  await live.goto(origin);
  await live.getByRole('heading', { name: 'Hosted sign in' }).waitFor();
  assert.match(new URL(live.url()).searchParams.get('returnUrl'), /\/admin\/?$/);
  assert.equal(calls.filter(call => call === 'catalog').length, catalogues, 'disabled website must not render the catalogue');
  assert.deepEqual(errors, []);
  console.log('Passed: connected SDK composition with mocked native APIs, callback, session refresh/retry, shared pages without domain queries, permission denial, logout, sign-in destination and public website access policies.');
} catch (error) {
  console.error('Browser errors:', errors);
  for (const context of browser.contexts()) for (const page of context.pages()) {
    console.error('Page:', page.url(), await page.locator('body').innerText().catch(() => 'unavailable'));
  }
  throw error;
} finally {
  await browser.close(); await server?.close();
  python.kill(); await new Promise(resolve => python.exitCode !== null ? resolve() : python.once('exit', resolve));
  if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('events-sdk-')) await fs.rm(directory, { recursive: true, force: true });
}
