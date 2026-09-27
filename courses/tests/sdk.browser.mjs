// Real Academy workflows in an isolated SQLite database; native platform calls use the development adapter.
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
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'courses-sdk-'));
const apiOrigin = 'http://127.0.0.1:3393', origin = 'http://127.0.0.1:3392';
const appId = '12345678-1234-4234-8234-123456789abc';
const metadata = JSON.parse(await fs.readFile(path.join(root, 'template.json'), 'utf8'));
const sdkVersion = JSON.parse(await fs.readFile(new URL(import.meta.resolve('@cloudgatedevs/cloudgate-client-react/package.json')), 'utf8')).version;
const python = spawn('python', ['-B', '-X', 'utf8', 'cloudgate/local_server.py', '--db', path.join(directory, 'academy.sqlite'), '--port', '3393'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let pythonOutput = '';
python.stdout.on('data', chunk => { pythonOutput += chunk; });
python.stderr.on('data', chunk => { pythonOutput += chunk; });
const browser = await chromium.launch({ headless: true });
let server;
const errors = [];
const shot = async (page, name) => {
  if (!process.env.COURSES_TEST_OUTPUT_DIR) return;
  await fs.mkdir(process.env.COURSES_TEST_OUTPUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.COURSES_TEST_OUTPUT_DIR, name + '.png'), fullPage: true, animations: 'disabled' });
};
async function api(op, data = {}, role = '') {
  const response = await fetch(apiOrigin + '/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Academy-Preview': '1', 'X-Preview-Role': role }, body: JSON.stringify({ ...data, op }) });
  const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result)); return result;
}
async function pageFor(role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(role => { if (role) sessionStorage.setItem('courses.preview.role', role); }, role);
  await context.routeWebSocket(/\/ws-idp-notifications/, socket => socket.send(JSON.stringify({ type: 'ready', environment: 'sbx' })));
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message)); return page;
}
async function start(connected = false) {
  const env = { VITE_CLOUDGATE_API_URL: 'https://gateway.example.invalid', VITE_CLOUDGATE_API_PROJECT: 'courses', VITE_CLOUDGATE_API_ENV: 'sbx', VITE_API_KEY: '', VITE_API_SECRET: '', VITE_IDP_BASE_URL: 'https://hub.example.invalid', VITE_IDP_API_URL: 'https://api.example.invalid', VITE_IDP_TENANCY_NAME: 'learner', VITE_CLOUDGATE_WEB_APP_ID: appId };
  server = await createServer({ root, configFile: false, envDir: false, mode: connected ? 'development' : 'preview', plugins: [react()], logLevel: 'warn',
    define: Object.fromEntries(Object.entries(env).map(([key, value]) => ['import.meta.env.' + key, JSON.stringify(value)])),
    server: { host: '127.0.0.1', port: 3392, strictPort: true, proxy: { '/api': apiOrigin } } });
  await server.listen();
}
try {
  for (let attempt = 0; ; attempt++) {
    try { await api('catalog'); break; }
    catch { if (attempt >= 80 || python.exitCode != null) throw new Error(pythonOutput || 'Local API failed to start'); await delay(100); }
  }
  await start();
  const catalogue = await api('catalog'), free = catalogue.courses.find(c => c.price === 0), paid = catalogue.courses.find(c => c.price > 0);
  const guest = await pageFor(''); await guest.goto(origin);
  await guest.getByRole('heading', { name: 'Your next advantage.' }).waitFor();
  assert.equal(await guest.locator('.academy-course-card').count(), 3);
  assert.equal(await guest.locator('.academy-footer .cg-powered-version').innerText(), 'v' + sdkVersion);
  await shot(guest, 'academy-public');
  await guest.goto(origin + '/course?id=' + free.ref);
  await guest.getByRole('button', { name: 'Preview', exact: false }).first().click();
  await guest.getByRole('dialog').waitFor();
  await guest.getByRole('button', { name: 'Close dialog' }).click();
  assert.equal(await guest.locator('.academy-ui').count(), 1);

  const learner = await pageFor('learner');
  await learner.goto(origin + '/course?id=' + free.ref);
  await learner.getByRole('button', { name: 'Enrol in this course' }).click();
  await learner.waitForURL('**/learn');
  await learner.getByRole('button', { name: 'Continue learning', exact: false }).click();
  const adminData = await api('workspace', {}, 'admin');
  for (const lesson of free.lessons) {
    await learner.locator('.lesson-sidebar nav button').filter({ hasText: lesson.title }).click();
    if (lesson.type === 'quiz') {
      // The isolated seed's published curriculum matches its draft. Answers never reach learner APIs.
      const questions = adminData.records.find(r => r.ref === lesson.ref).questions;
      for (const [index, question] of questions.entries())
        await learner.locator('.quiz-question').nth(index).getByRole('radio').nth(question.answer).check();
      await learner.getByRole('button', { name: 'Submit assessment' }).click();
      await learner.getByRole('button', { name: 'Assessment passed' }).waitFor();
    } else {
      await learner.getByRole('button', { name: 'Mark lesson complete' }).click();
      await learner.getByRole('button', { name: 'Lesson completed' }).waitFor();
    }
  }
  await learner.getByRole('button', { name: 'certificate', exact: true }).click();
  await learner.getByRole('heading', { name: 'You made it.' }).waitFor();
  const download = learner.waitForEvent('download');
  await learner.getByRole('button', { name: 'Download certificate' }).click();
  assert.match((await download).suggestedFilename(), /^certificate-.*\.pdf$/);
  const learnerData = await api('workspace', {}, 'learner'), cert = learnerData.records.find(r => r.kind === 'certificate');
  await guest.goto(origin + '/certificate?code=' + cert.code);
  await guest.getByRole('heading', { name: 'Learning, recognised.' }).waitFor();
  await learner.goto(origin + '/learn/profile');
  await learner.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
  assert.equal(await learner.locator('.academy-ui').count(), 0, 'SDK profile is outside Academy CSS');
  await learner.goto(origin + '/admin');
  await learner.getByRole('heading', { name: 'Back office access required' }).waitFor();

  await learner.goto(origin + '/course?id=' + paid.ref);
  await learner.getByRole('button', { name: 'Enrol in this course' }).click();
  await learner.waitForURL('**/learn');
  await learner.getByRole('button', { name: 'Complete enrolment' }).click();
  await learner.getByRole('button', { name: 'Confirm simulated payment' }).click();
  await learner.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal((await api('workspace', {}, 'learner')).records.find(r => r.kind === 'enrollment' && r.course === paid.ref).status, 'active');

  const admin = await pageFor('admin'); await admin.goto(origin + '/admin');
  await admin.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
  const sidebar = admin.getByRole('complementary', { name: 'Sidebar' });
  await sidebar.getByText('Cloudgate SDK', { exact: true }).waitFor();
  for (const [route, title] of [['courses','Courses'],['enrollments','Enrolments'],['sessions','Live sessions'],['discussions','Discussions'],['reports','Learning reports'],['instructors','Instructors'],['course-payments','Course payments'],['certificates','Certificates'],['messages','Academy emails'],['business','Academy settings']]) {
    await sidebar.getByRole('link', { name: title, exact: true }).click();
    await admin.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal(new URL(admin.url()).pathname, '/admin/' + route);
  }
  assert.equal(await admin.getByRole('button', { name: 'Theme & branding' }).count(), 0);
  await admin.getByLabel('Academy name', { exact: true }).fill('SDK Test Academy');
  await admin.getByRole('button', { name: 'Save academy settings' }).click();
  await admin.getByText('Saved successfully.', { exact: true }).waitFor();
  await admin.goto(origin + '/admin/course-payments');
  await admin.getByRole('button', { name: 'Refund', exact: true }).click();
  await admin.getByRole('button', { name: 'Confirm refund' }).click();
  await admin.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal((await api('workspace', {}, 'learner')).records.find(r => r.kind === 'enrollment' && r.course === paid.ref).status, 'refunded');

  await admin.goto(origin + '/admin/courses');
  await admin.getByRole('button', { name: 'Create course', exact: true }).click();
  await admin.getByLabel('Course title', { exact: true }).fill('SDK Test Course');
  await admin.getByLabel('Category', { exact: true }).fill('Development');
  await admin.getByLabel('Short summary', { exact: true }).fill('Testing the SDK integration.');
  await admin.getByLabel('Course description', { exact: true }).fill('A test course created through the retained Academy editor.');
  await admin.getByLabel('Instructor display name', { exact: true }).fill('Alex Morgan');
  const png = await admin.evaluate(() => { const c = document.createElement('canvas'); c.width = 40; c.height = 40; c.getContext('2d').fillRect(0, 0, 40, 40); return c.toDataURL('image/png').split(',')[1]; });
  await admin.getByLabel('Upload course cover', { exact: true }).setInputFiles({ name: 'sdk-course.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await admin.getByRole('button', { name: 'Use entire image' }).click();
  await admin.getByRole('dialog', { name: 'Prepare your image' }).waitFor({ state: 'hidden' });
  await admin.getByRole('button', { name: 'Save course', exact: true }).click();
  await admin.getByRole('dialog').waitFor({ state: 'hidden' });
  await admin.getByRole('heading', { name: 'SDK Test Course' }).waitFor();
  await admin.goto(origin + '/admin/media');
  await admin.getByRole('button', { name: 'Delete sdk-course.png', exact: true }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Delete image' }).click();
  await admin.getByText(/sdk-course.png is now in use/).waitFor();
  assert.equal(await admin.locator('.academy-ui').count(), 0);
  await admin.goto(origin + '/admin/settings');
  await admin.getByRole('checkbox', { name: 'Enable public website' }).waitFor();
  await admin.goto(origin + '/admin/theme');
  await admin.getByRole('heading', { name: 'Colour palette', exact: true }).waitFor();
  await shot(admin, 'academy-sdk-theme');
  await admin.goto(origin + '/admin/courses');
  await admin.getByRole('heading', { name: 'SDK Test Course', exact: true }).waitFor();
  await shot(admin, 'academy-backoffice');
  await admin.setViewportSize({ width: 390, height: 844 });
  await admin.getByRole('heading', { name: 'Courses', exact: true }).waitFor();
  assert.ok(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile workspace should not overflow');
  await shot(admin, 'academy-mobile');

  const instructor = await pageFor('instructor'); await instructor.goto(origin + '/admin/courses');
  await instructor.getByRole('heading', { name: 'Courses', exact: true }).waitFor();
  assert.equal(await instructor.locator('.academy-course-card').count(), 3, 'instructor sees only assigned courses');
  assert.equal(await instructor.getByRole('button', { name: 'Create course' }).count(), 0);
  await instructor.locator('.academy-course-card').first().getByRole('button', { name: 'Manage course' }).click();
  await instructor.getByRole('button', { name: 'Add lesson' }).waitFor();
  await instructor.goto(origin + '/admin/business');
  await instructor.getByRole('heading', { name: 'Section unavailable' }).waitFor();
  assert.equal(await instructor.getByRole('button', { name: 'Save academy settings' }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('Passed: public catalogue, preview lesson, enrolment, learning, assessment, certificate PDF/verification, payment/refund, SDK profile/permissions, custom pages, settings, course creation/upload, media protection, mobile and instructor restrictions.');

  for (const context of browser.contexts()) await context.close();
  await server.close(); server = null;
  await start(true);
  let grants = true, failWorkspace = true, refreshes = 0;
  const calls = [];
  const token = suffix => `e30.${Buffer.from(JSON.stringify({ sub: '1', exp: Math.floor(Date.now() / 1000) + 3600, jti: suffix })).toString('base64url')}.test`;
  const initialToken = token('initial'), refreshedToken = token('refreshed');
  let activeToken = initialToken;
  let values = { ...DEFAULT_SETTINGS, ...metadata.appSettings, app_name: 'SDK Test Academy' };
  const connected = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await connected.route('**/cg-analytics.json', route => route.fulfill({ json: { webAppId: appId, isProduction: false } }));
  await connected.routeWebSocket('wss://api.example.invalid/**', socket => socket.send(JSON.stringify({ type: 'ready', environment: 'sbx' })));
  await connected.route('https://gateway.example.invalid/**', async route => {
    const request = route.request(), data = request.postDataJSON();
    calls.push(data.op);
    assert.match(new URL(request.url()).pathname, /^\/sbx\/courses\//);
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
  await live.goto(origin + '/admin/courses?' + new URLSearchParams({ access_token: initialToken, refresh_token: 'isolated-refresh', expires_in: '3600' }));
  await live.getByRole('heading', { name: 'SDK Test Course', exact: true }).waitFor();
  assert.equal(refreshes, 1, 'a workflow 401 should refresh the SDK session once and retry');
  assert.equal(new URL(live.url()).search, '', 'SDK consumes and removes callback tokens');
  assert.equal(await live.evaluate(() => localStorage.getItem('idp_access_token')), refreshedToken);
  for (const [route, title] of [['profile', 'Profile'], ['media', 'Media server'], ['appearance', 'Appearance'], ['logs', 'Logs'], ['settings', 'Settings']]) {
    const before = calls.filter(call => call === 'workspace').length;
    await live.goto(origin + '/admin/' + route);
    await live.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal(await live.locator('.academy-ui').count(), 0);
    assert.equal(calls.filter(call => call === 'workspace').length, before, 'SDK pages must not load the Academy workspace');
  }
  await live.goto(origin + '/learn/profile');
  await live.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
  grants = false;
  const before = calls.filter(call => call === 'workspace').length;
  await live.goto(origin + '/admin/courses');
  await live.getByRole('heading', { name: 'Back office access required' }).waitFor();
  assert.equal(calls.filter(call => call === 'workspace').length, before);
  await live.goto(origin + '/learn');
  await live.getByRole('button', { name: 'Sign out', exact: true }).click();
  await live.getByRole('heading', { name: 'Your next advantage.' }).waitFor();
  assert.equal(await live.evaluate(() => localStorage.getItem('idp_access_token')), null);
  await live.getByRole('button', { name: 'Sign in', exact: true }).click();
  await live.getByRole('heading', { name: 'Hosted sign in' }).waitFor();
  assert.equal(new URL(live.url()).pathname, '/idp/learner/login');
  assert.equal(new URL(live.url()).searchParams.get('returnUrl'), origin + '/learn');
  values = { ...values, require_public_website_login: 'true' };
  const catalogues = calls.filter(call => call === 'catalog').length;
  await live.goto(origin + '/course?id=' + free.ref);
  await live.getByRole('heading', { name: 'Hosted sign in' }).waitFor();
  assert.equal(new URL(live.url()).searchParams.get('returnUrl'), origin + '/course?id=' + free.ref);
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
  if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('courses-sdk-')) await fs.rm(directory, { recursive: true, force: true });
}
