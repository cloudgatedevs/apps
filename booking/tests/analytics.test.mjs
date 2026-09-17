import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppAnalyticsClient, AppAnalyticsError } from '../src/shared/services/appAnalyticsClient.js';
import { createPublishedAnalyticsResolver } from '../src/shared/services/publishedAnalytics.js';
import { analyticsDateRange, comparison, duration, percent, visitorName } from '../src/shared/lib/analytics.js';

const webAppId = 'bed11948-557e-4d53-8f43-e944bef73caf';
function fixture(options = {}) {
  const requests = [];
  let token = 'old', refreshes = 0;
  const auth = { tenancyName: 'jobs tenant', authHeader: () => ({ Authorization: `Bearer ${token}` }), refresh: async () => { refreshes++; token = 'new'; return true; } };
  const api = createAppAnalyticsClient({ auth, apiUrl: 'https://api.example.invalid/', projectPath: '/jobs-2/', environment: 'sbx', fetchImpl: async (url, init) => {
    requests.push({ url, ...init, body: JSON.parse(init.body) });
    return options.respond ? options.respond(requests.length) : Response.json({ totalCount: 0, items: [] });
  }, ...options });
  return { api, requests, refreshes: () => refreshes };
}

test('all analytics requests use the IdP bearer token and the configured app scope', async () => {
  const f = fixture();
  await f.api.overview(5);
  await f.api.pages({ timePeriod: 2, skip: 20, take: 10, projectPath: 'other', environment: 'prod' });
  await f.api.sessions({ timePeriod: 2, skip: 10, take: 10, pagePath: '/account' });
  assert.deepEqual(f.requests.map(r => r.url), ['overview', 'pages', 'sessions'].map(s => `https://api.example.invalid/api/idp/jobs%20tenant/admin/analytics/${s}`));
  for (const request of f.requests) {
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.Authorization, 'Bearer old');
    assert.equal(request.body.projectPath, 'jobs-2');
    assert.equal(request.body.environment, 'sbx');
    assert.equal(request.body.webAppId, undefined);
  }
  assert.deepEqual(f.requests[1].body, { timePeriod: 2, skip: 20, take: 10, projectPath: 'jobs-2', environment: 'sbx' });
  assert.equal(f.requests[2].body.pagePath, '/account');
});

test('published metadata selects the same website and traffic environment as its beacons', async () => {
  const f = fixture({ resolvePublishedApp: async () => ({ webAppId, isProduction: true }) });
  await f.api.overview();
  assert.equal(f.requests[0].body.publishedWebAppId, webAppId);
  assert.equal(f.requests[0].body.environment, 'prod');
});

test('expired sessions refresh once and retry with the new token', async () => {
  const f = fixture({ respond: n => n === 1 ? Response.json({}, { status: 401 }) : Response.json({ result: { summary: { viewCount: 15 } } }) });
  assert.equal((await f.api.overview()).summary.viewCount, 15);
  assert.equal(f.refreshes(), 1);
  assert.deepEqual(f.requests.map(r => r.headers.Authorization), ['Bearer old', 'Bearer new']);
});

test('a failed refresh retry is bounded and requires an Admin sign-in', async () => {
  const f = fixture({ respond: () => Response.json({}, { status: 401 }) });
  await assert.rejects(f.api.overview(), e => e instanceof AppAnalyticsError && e.code === 'forbidden');
  assert.equal(f.requests.length, 2);
  assert.equal(f.refreshes(), 1);
});

test('missing installation, old server, and server failures give actionable errors without stack details', async () => {
  for (const [status, body, code] of [[404, { code: 'not-installed', message: 'No matching installation.' }, 'not-installed'], [404, {}, 'unavailable'], [403, {}, 'forbidden'], [500, { message: 'SECRET STACK TRACE' }, 'error']]) {
    const f = fixture({ respond: () => Response.json(body, { status }) });
    await assert.rejects(f.api.overview(), e => e.code === code && !e.message.includes('SECRET STACK TRACE'));
  }
});

test('a missing site in an ABP response is not reported as a missing API', async () => {
  const message = 'No matching web app was found in this Cloudgate tenant.';
  const f = fixture({ respond: () => Response.json({ result: { code: 'not-installed', message }, success: true, __abp: true }, { status: 404 }) });
  await assert.rejects(f.api.overview(), e => e.code === 'not-installed' && e.message === message);
});

test('preview does not request analytics or published metadata', async () => {
  const f = fixture({ preview: true, resolvePublishedApp: () => assert.fail('Preview must not resolve a live site') });
  await assert.rejects(f.api.overview(), e => e.code === 'unavailable');
  assert.equal(f.requests.length, 0);
});

test('cancelled filters do not become network errors or make an API call', async () => {
  const controller = new AbortController(); controller.abort();
  const f = fixture();
  await assert.rejects(f.api.overview(3, { signal: controller.signal }), e => e.name === 'AbortError');
  assert.equal(f.requests.length, 0);
});

test('HTML responses and network failures are not mistaken for zero traffic', async () => {
  const html = fixture({ respond: () => new Response('<html>SPA fallback</html>', { status: 200 }) });
  await assert.rejects(html.api.overview(), /unexpected analytics response/);
  const network = fixture({ fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(network.api.overview(), e => e.code === 'network');
});

test('injected analytics metadata is reused without exposing the beacon token', async () => {
  const resolve = createPublishedAnalyticsResolver({ readWindow: () => ({ webAppId, isProduction: true, analyticsToken: 'public-beacon-token', tenantId: 999 }), fetchImpl: () => assert.fail('No fetch needed') });
  assert.deepEqual(await resolve(), { webAppId, isProduction: true });
});

test('the separate admin document reads published metadata once, without authentication', async () => {
  let calls = 0;
  const resolve = createPublishedAnalyticsResolver({ readWindow: () => null, fetchImpl: async (url, init) => {
    calls++; assert.equal(url, '/cg-analytics.json'); assert.equal(init.credentials, 'omit');
    assert.equal(init.headers.Authorization, undefined);
    return Response.json({ webAppId, isProduction: false, analyticsToken: 'ignore' });
  } });
  const results = await Promise.all([resolve(), resolve(), resolve()]);
  assert.equal(calls, 1);
  for (const result of results) assert.deepEqual(result, { webAppId, isProduction: false });
});

test('missing or invalid public metadata falls back to the App Store mapping', async () => {
  for (const response of [() => new Response('<html>Local SPA</html>'), () => Response.json({ webAppId: 'bad-id', isProduction: true }), () => new Response('', { status: 404 })]) {
    const resolve = createPublishedAnalyticsResolver({ readWindow: () => null, fetchImpl: async () => response() });
    assert.equal(await resolve(), null);
  }
});

test('UTC reporting windows match Hub calendar bounds including month end', () => {
  const now = new Date('2026-03-31T12:45:00.000Z');
  assert.deepEqual(analyticsDateRange(0, now), {});
  assert.deepEqual(analyticsDateRange(4, now), { startDate: '2026-03-30T00:00:00.000Z', endDate: '2026-03-30T23:59:59.999Z' });
  assert.equal(analyticsDateRange(2, now).startDate, '2026-02-28T00:00:00.000Z');
  assert.equal(analyticsDateRange(1, now).startDate, '2025-12-31T00:00:00.000Z');
  assert.equal(analyticsDateRange(3, now).startDate, '2026-03-25T00:00:00.000Z');
  assert.equal(analyticsDateRange(5, now).startDate, '2026-03-31T00:00:00.000Z');
  assert.equal(analyticsDateRange(6, now).startDate, '2026-03-31T11:45:00.000Z');
});

test('zero, missing comparisons, durations, and anonymous visitors have clear labels', () => {
  assert.match(comparison(15, 0).text, /New activity/);
  assert.match(comparison(0, null).text, /No comparison/);
  assert.equal(comparison(5, 10).text, '-50.0% vs previous period');
  assert.equal(duration(59999), '1m 0s'); assert.equal(duration(null), '—');
  assert.equal(percent(0.42), '42.0%');
  assert.equal(visitorName({}), 'Anonymous visitor');
  assert.equal(visitorName({ idpUserName: 'Ada', idpUserSurname: 'Lovelace' }), 'Ada Lovelace');
});
