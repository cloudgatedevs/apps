// Real Jobs workflows use an isolated database. Native SDK services are simulated or mocked.
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
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jobs-sdk-'));
const apiOrigin = 'http://127.0.0.1:3593', origin = 'http://127.0.0.1:3592';
const appId = '12345678-1234-4234-8234-123456789abc';
const metadata = JSON.parse(await fs.readFile(path.join(root, 'template.json'), 'utf8'));
const sdkVersion = JSON.parse(await fs.readFile(new URL(import.meta.resolve('@cloudgatedevs/cloudgate-client-react/package.json')), 'utf8')).version;
const python = spawn('python', ['-B', '-X', 'utf8', 'cloudgate/local_server.py', '--db', path.join(directory, 'jobs.sqlite'), '--port', '3593'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let pythonOutput = '';
python.stdout.on('data', chunk => { pythonOutput += chunk; });
python.stderr.on('data', chunk => { pythonOutput += chunk; });
const browser = await chromium.launch({ headless: true });
let server;
const errors = [];
const shot = async (page, name) => {
  if (!process.env.JOBS_TEST_OUTPUT_DIR) return;
  await fs.mkdir(process.env.JOBS_TEST_OUTPUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.JOBS_TEST_OUTPUT_DIR, name + '.png'), fullPage: true, animations: 'disabled' });
};
async function api(op, data = {}, role = '', action = 'workspace') {
  const response = await fetch(apiOrigin + '/api/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jobs-Preview': '1', 'X-Preview-Role': role }, body: JSON.stringify({ ...data, op }) });
  const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result)); return result;
}
async function pageFor(role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(role => { if (role) sessionStorage.setItem('jobs.preview.role', role); }, role);
  await context.routeWebSocket(/\/ws-idp-notifications/, socket => socket.send(JSON.stringify({ type: 'ready', environment: 'sbx' })));
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message)); return page;
}
async function start(connected = false) {
  const env = { VITE_CLOUDGATE_API_URL: 'https://gateway.example.invalid', VITE_CLOUDGATE_API_PROJECT: 'jobs', VITE_CLOUDGATE_API_ENV: 'sbx', VITE_API_KEY: '', VITE_API_SECRET: '', VITE_IDP_BASE_URL: 'https://hub.example.invalid', VITE_IDP_API_URL: 'https://api.example.invalid', VITE_IDP_TENANCY_NAME: 'jobs', VITE_CLOUDGATE_WEB_APP_ID: appId };
  server = await createServer({ root, configFile: false, envDir: false, mode: connected ? 'development' : 'preview', plugins: [react()], logLevel: 'warn',
    define: Object.fromEntries(Object.entries(env).map(([key, value]) => ['import.meta.env.' + key, JSON.stringify(value)])),
    server: { host: '127.0.0.1', port: 3592, strictPort: true, proxy: { '/api': apiOrigin } } });
  await server.listen();
}
try {
  for (let attempt = 0; ; attempt++) {
    try { await api('catalog'); break; }
    catch { if (attempt >= 80 || python.exitCode != null) throw new Error(pythonOutput || 'Local API failed to start'); await delay(100); }
  }
  await start();
  const guest = await pageFor(''); await guest.goto(origin);
  await guest.getByRole('heading', { name: 'Your next project, in good hands.' }).waitFor();
  assert.equal(await guest.locator('.service-card').count(), 4);
  assert.equal(await guest.locator('footer .cg-powered-version').innerText(), 'v' + sdkVersion);
  await shot(guest, 'jobs-public');

  const admin = await pageFor('admin'); await admin.goto(origin + '/admin');
  await admin.getByRole('heading', { name: 'A clear view of your day.' }).waitFor();
  const sidebar = admin.getByRole('complementary', { name: 'Sidebar' });
  await sidebar.getByText('Cloudgate SDK', { exact: true }).waitFor();
  for (const [route, label, title] of [
    ['requests','Requests','Every project starts here.'], ['quotes','Quotes','Make the next step clear.'],
    ['jobs','Jobs','Good work, in progress.'], ['calendar','Schedule','The right people. The right time.'],
    ['customers','Customers','Know your customers.'], ['invoices','Invoices & payments','Keep your cash flow moving.'],
    ['recurring','Recurring work','Good service, on repeat.'], ['reports','Job reports','See how business is doing.'],
    ['services','Services','What your business does best.'], ['team','Job team','The people behind the work.'],
    ['business','Business settings','Your business details.']
  ]) {
    await sidebar.getByRole('link', { name: label, exact: true }).click();
    await admin.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal(new URL(admin.url()).pathname, '/admin/' + route);
    assert.equal(await admin.locator('.jobs-ui .error').count(), 0);
  }
  await admin.getByLabel('Business name', { exact: true }).fill('SDK Jobs Studio');
  await admin.getByRole('button', { name: 'Save business settings' }).click();
  await admin.getByText('Saved successfully.', { exact: true }).waitFor();
  assert.equal((await api('workspace', {}, 'admin')).settings.name, 'SDK Jobs Studio');
  assert.equal(await admin.getByRole('button', { name: 'Branding', exact: true }).count(), 0);
  const png = await admin.evaluate(() => { const c = document.createElement('canvas'); c.width = 40; c.height = 40; c.getContext('2d').fillRect(0, 0, 40, 40); return c.toDataURL('image/png').split(',')[1]; });
  await sidebar.getByRole('link', { name: 'Services', exact: true }).click();
  await admin.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await admin.getByLabel('Upload photo', { exact: true }).setInputFiles({ name: 'sdk-service.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await admin.getByRole('button', { name: 'Use entire image' }).click();
  await admin.getByRole('dialog', { name: 'Prepare your image' }).waitFor({ state: 'hidden' });
  await admin.getByRole('button', { name: 'Save service', exact: true }).click();
  await admin.getByRole('dialog').waitFor({ state: 'hidden' });
  await admin.goto(origin + '/admin/media');
  await admin.getByRole('button', { name: 'Delete sdk-service.png', exact: true }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Delete image' }).click();
  await admin.getByText(/sdk-service.png is now in use/).waitFor();
  assert.equal(await admin.locator('.jobs-ui').count(), 0);

  const customer = await pageFor('customer');
  await customer.goto(origin + '/account/addresses');
  await customer.getByRole('button', { name: 'Add address', exact: true }).click();
  await customer.getByLabel('Address label', { exact: true }).fill('Workshop');
  await customer.getByLabel('Service address', { exact: true }).fill('24 Test Street, Sandbox');
  await customer.getByRole('button', { name: 'Save address', exact: true }).click();
  await customer.getByRole('dialog').waitFor({ state: 'hidden' });
  await customer.getByText('Workshop', { exact: true }).waitFor();
  await customer.getByRole('link', { name: 'My profile', exact: true }).click();
  await customer.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
  assert.equal(await customer.locator('.jobs-ui').count(), 0);
  await customer.goto(origin + '/admin');
  await customer.getByRole('heading', { name: 'Back office access required' }).waitFor();
  const title = 'SDK Test Job';
  await customer.goto(origin + '/request');
  await customer.getByLabel('Phone number', { exact: true }).fill('0825550100');
  await customer.getByLabel('What do you need help with?').fill(title);
  await customer.getByLabel('Service address', { exact: true }).fill('24 Test Street, Sandbox');
  await customer.getByRole('button', { name: 'Send request', exact: true }).click();
  await customer.waitForURL('**/account');
  await customer.locator('.portal-tabs').getByRole('button', { name: 'Requests', exact: true }).click();
  await customer.getByRole('button', { name: new RegExp(title) }).click();
  await customer.locator('.detail input[type=file]').setInputFiles({ name: 'private-work.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await customer.getByRole('button', { name: /private-work.png/ }).waitFor();
  const snapshot = await api('workspace', {}, 'customer');
  const attachment = snapshot.records.find(r => r.kind === 'attachment' && r.name === 'private-work.png');
  assert.ok(attachment);
  const denied = await fetch(apiOrigin + '/api/attachments', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jobs-Preview': '1', 'X-Preview-Role': 'other' }, body: JSON.stringify({ op: 'attachment-read', ref: attachment.ref }) });
  assert.equal(denied.status, 400, 'another customer cannot read private photos');
  await customer.getByRole('button', { name: /private-work.png/ }).click();
  await customer.getByRole('dialog', { name: 'private-work.png' }).waitFor();
  await customer.getByRole('button', { name: 'Close dialog' }).click();

  await admin.goto(origin + '/admin/requests');
  await admin.getByRole('button', { name: new RegExp(title) }).click();
  await admin.getByRole('button', { name: 'Create quote', exact: true }).click();
  await admin.getByRole('dialog').getByLabel('Description', { exact: true }).fill('Replace kitchen mixer');
  await admin.getByRole('dialog').getByLabel('Unit price', { exact: true }).fill('950');
  await admin.getByRole('button', { name: 'Save draft quote' }).click();
  await admin.getByRole('dialog').waitFor({ state: 'hidden' });
  await sidebar.getByRole('link', { name: 'Quotes', exact: true }).click();
  await admin.getByRole('button', { name: new RegExp(title) }).click();
  await admin.getByRole('button', { name: 'Send quote', exact: true }).click();
  await admin.getByText('Saved successfully.', { exact: true }).waitFor();
  await customer.goto(origin + '/account/quotes');
  await customer.getByRole('button', { name: new RegExp(title) }).click();
  await customer.getByRole('button', { name: 'Review & approve' }).click();
  await customer.getByRole('button', { name: 'Approve quote & create job' }).click();
  await customer.getByRole('dialog').waitFor({ state: 'hidden' });
  await customer.locator('.portal-tabs').getByRole('button', { name: 'Jobs', exact: true }).click();
  await customer.getByRole('button', { name: new RegExp(title) }).click();
  await customer.getByRole('button', { name: 'Pay securely' }).click();
  await customer.getByRole('button', { name: 'Confirm simulated payment' }).click();
  await customer.getByRole('dialog').waitFor({ state: 'hidden' });
  await admin.goto(origin + '/admin/jobs');
  await admin.getByRole('button', { name: new RegExp(title) }).click();
  await admin.getByRole('button', { name: 'Schedule visit', exact: true }).click();
  const localTime = hours => { const date = new Date(Date.now() + hours * 3600000); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  await admin.getByLabel('Start', { exact: true }).fill(localTime(24));
  await admin.getByLabel('End', { exact: true }).fill(localTime(25));
  await admin.getByLabel('Maya Daniels', { exact: true }).check();
  await admin.getByRole('button', { name: 'Save visit' }).click();
  await admin.getByRole('dialog').waitFor({ state: 'hidden' });
  const technician = await pageFor('technician'); await technician.goto(origin + '/admin/jobs');
  await technician.getByRole('button', { name: new RegExp(title) }).click();
  assert.equal(await technician.getByRole('button', { name: 'Pay securely' }).count(), 0);
  assert.equal(await technician.getByRole('button', { name: 'Issue final invoice', exact: true }).count(), 0);
  await technician.getByRole('button', { name: 'Start visit', exact: true }).click();
  await technician.getByRole('button', { name: 'Complete visit', exact: true }).click();
  await technician.getByRole('button', { name: 'Complete visit', exact: true }).waitFor({ state: 'hidden' });
  await technician.goto(origin + '/admin/business');
  await technician.getByRole('heading', { name: 'Section unavailable' }).waitFor();
  assert.equal(await technician.getByRole('button', { name: 'Save business settings' }).count(), 0);
  await admin.reload();
  await admin.getByRole('button', { name: new RegExp(title) }).click();
  await admin.getByRole('button', { name: 'Complete job', exact: true }).click();
  await admin.getByRole('button', { name: 'Issue final invoice', exact: true }).click();
  await admin.getByRole('button', { name: 'Download PDF' }).waitFor();
  const downloadPromise = admin.waitForEvent('download');
  await admin.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  await download.saveAs(path.join(directory, 'invoice.pdf'));
  assert.equal((await fs.readFile(path.join(directory, 'invoice.pdf'))).subarray(0, 4).toString(), '%PDF');
  await customer.goto(origin + '/account/jobs');
  await customer.getByRole('button', { name: new RegExp(title) }).click();
  await customer.getByRole('button', { name: 'Pay securely' }).click();
  await customer.getByRole('button', { name: 'Confirm simulated payment' }).click();
  await customer.getByRole('dialog').waitFor({ state: 'hidden' });
  const paid = await api('workspace', {}, 'customer');
  assert.equal(paid.records.find(r => r.kind === 'invoice').balance, 0);
  assert.equal(paid.records.filter(r => r.kind === 'payment' && r.status === 'succeeded').length, 2);
  await admin.goto(origin + '/admin/invoices');
  const payment = paid.records.find(r => r.kind === 'payment');
  await admin.getByRole('button', { name: new RegExp(payment.ref) }).click();
  await admin.getByRole('button', { name: 'Refund payment', exact: true }).click();
  await admin.getByRole('button', { name: 'Request refund', exact: true }).click();
  await admin.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal((await api('workspace', {}, 'admin')).records.find(r => r.kind === 'refund').status, 'succeeded');
  await admin.goto(origin + '/admin/theme');
  await admin.getByRole('heading', { name: 'Colour palette', exact: true }).waitFor();
  await shot(admin, 'jobs-sdk-theme');
  await admin.goto(origin + '/admin');
  await admin.getByRole('heading', { name: 'A clear view of your day.' }).waitFor();
  await shot(admin, 'jobs-backoffice');
  await admin.setViewportSize({ width: 390, height: 844 });
  assert.ok(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile workspace should not overflow');
  await admin.getByRole('button', { name: 'Open menu' }).click();
  await admin.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name: 'Jobs', exact: true }).click();
  await admin.getByRole('heading', { name: 'Good work, in progress.' }).waitFor();
  await shot(admin, 'jobs-mobile');
  await guest.setViewportSize({ width: 390, height: 844 });
  assert.ok(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile public site should not overflow');
  await shot(guest, 'jobs-public-mobile');
  assert.deepEqual(errors, []);
  console.log('Passed: all custom SDK routes, business settings, service image upload/deletion protection, customer addresses/profile, private photos and isolation, request/quote approval, simulated deposit and final payment, technician assignment/access, scheduling/completion, PDF, refund, theme and mobile shell.');

  for (const context of browser.contexts()) await context.close();
  await server.close(); server = null;
  await start(true);
  let grants = true, failWorkspace = true, refreshes = 0;
  const calls = [];
  const token = suffix => `e30.${Buffer.from(JSON.stringify({ sub: '1', exp: Math.floor(Date.now() / 1000) + 3600, jti: suffix })).toString('base64url')}.test`;
  const initialToken = token('initial'), refreshedToken = token('refreshed');
  let activeToken = initialToken;
  let values = { ...DEFAULT_SETTINGS, ...metadata.appSettings, app_name: 'SDK Test Jobs' };
  const connected = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await connected.route('**/cg-analytics.json', route => route.fulfill({ json: { webAppId: appId, isProduction: false } }));
  await connected.routeWebSocket('wss://api.example.invalid/**', socket => socket.send(JSON.stringify({ type: 'ready', environment: 'sbx' })));
  await connected.route('https://gateway.example.invalid/**', async route => {
    const request = route.request(), data = request.postDataJSON();
    calls.push(data.op);
    assert.match(new URL(request.url()).pathname, /^\/sbx\/jobs\//);
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
  await live.goto(origin + '/admin/jobs?' + new URLSearchParams({ access_token: initialToken, refresh_token: 'isolated-refresh', expires_in: '3600' }));
  await live.getByRole('heading', { name: 'Good work, in progress.', exact: true }).waitFor();
  assert.equal(refreshes, 1, 'a workflow 401 should refresh the SDK session once and retry');
  assert.equal(new URL(live.url()).search, '', 'SDK consumes and removes callback tokens');
  assert.equal(await live.evaluate(() => localStorage.getItem('idp_access_token')), refreshedToken);
  for (const [route, title] of [['profile', 'Profile'], ['media', 'Media server'], ['appearance', 'Appearance'], ['logs', 'Logs'], ['settings', 'Settings']]) {
    const before = calls.filter(call => call === 'workspace').length;
    await live.goto(origin + '/admin/' + route);
    await live.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal(await live.locator('.jobs-ui').count(), 0);
    assert.equal(calls.filter(call => call === 'workspace').length, before, 'SDK pages must not load the Jobs workspace');
  }
  await live.goto(origin + '/account/profile');
  await live.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
  grants = false;
  const before = calls.filter(call => call === 'workspace').length;
  await live.goto(origin + '/admin/jobs');
  await live.getByRole('heading', { name: 'Back office access required' }).waitFor();
  assert.equal(calls.filter(call => call === 'workspace').length, before);
  await live.goto(origin + '/account');
  await live.getByRole('button', { name: 'Sign out', exact: true }).click();
  await live.getByRole('heading', { name: 'Your next project, in good hands.' }).waitFor();
  assert.equal(await live.evaluate(() => localStorage.getItem('idp_access_token')), null);
  await live.getByRole('button', { name: 'Log in', exact: true }).click();
  await live.getByRole('heading', { name: 'Hosted sign in' }).waitFor();
  assert.equal(new URL(live.url()).pathname, '/idp/jobs/login');
  assert.equal(new URL(live.url()).searchParams.get('returnUrl'), origin + '/account');
  values = { ...values, require_public_website_login: 'true' };
  const catalogues = calls.filter(call => call === 'catalog').length;
  await live.goto(origin + '/request');
  await live.getByRole('heading', { name: 'Hosted sign in' }).waitFor();
  assert.equal(new URL(live.url()).searchParams.get('returnUrl'), origin + '/request');
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
  if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('jobs-sdk-')) await fs.rm(directory, { recursive: true, force: true });
}
