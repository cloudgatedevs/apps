export class AppAnalyticsError extends Error {
  constructor(message, status = 0, code = 'error') {
    super(message); this.name = 'AppAnalyticsError'; this.status = status; this.code = code;
  }
}

/** Same IdP admin authentication as Logs; the server resolves the installed web app. */
export function createAppAnalyticsClient({ auth, apiUrl, projectPath, environment = 'sbx', preview = false, fetchImpl = fetch, resolvePublishedApp = async () => null }) {
  const base = String(apiUrl || '').trim().replace(/\/+$/, '');
  const path = String(projectPath || '').trim().replace(/^\/+|\/+$/g, '');
  const env = String(environment || 'sbx').trim().toLowerCase();
  const scope = Object.freeze({ projectPath: path, environment: env, isProduction: /^prod/.test(env), configured: !preview && Boolean(base && auth.tenancyName && path) });
  async function request(section, body, signal) {
    if (!scope.configured) throw new AppAnalyticsError('Connect this app to Cloudgate and deploy it through the App Store to see its website analytics.', 0, 'unavailable');
    const url = `${base}/api/idp/${encodeURIComponent(auth.tenancyName)}/admin/analytics/${section}`;
    let response;
    try {
      const published = await resolvePublishedApp();
      signal?.throwIfAborted();
      const payload = { ...body, projectPath: path, environment: published ? (published.isProduction ? 'prod' : 'sbx') : env, ...(published ? { publishedWebAppId: published.webAppId } : {}) };
      const run = () => fetchImpl(url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...auth.authHeader() }, body: JSON.stringify(payload) });
      response = await run();
      if (response.status === 401 && await auth.refresh()) response = await run();
    } catch (error) {
      if (signal?.aborted || error.name === 'AbortError') throw error;
      throw new AppAnalyticsError('Could not reach Cloudgate. Check your connection and try again.', 0, 'network');
    }
    let raw;
    try { raw = await response.json(); } catch { raw = null; }
    const data = raw?.result ?? raw;
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new AppAnalyticsError('Sign in with an active Cloudgate Admin account to view analytics.', response.status, 'forbidden');
      if (response.status === 404 && data?.code === 'not-installed') throw new AppAnalyticsError(data.message, 404, 'not-installed');
      if (response.status === 404) throw new AppAnalyticsError('The Analytics API is not available on this Cloudgate server yet. Deploy the server update, then refresh this page.', 404, 'unavailable');
      throw new AppAnalyticsError(response.status >= 500 ? 'Cloudgate could not load analytics. Please try again.' : raw?.error?.message || data?.message || 'Cloudgate could not load analytics.', response.status);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppAnalyticsError('Cloudgate returned an unexpected analytics response. Please try again.');
    return data;
  }
  return {
    scope,
    overview: (timePeriod = 3, { signal } = {}) => request('overview', { timePeriod }, signal),
    pages: ({ timePeriod = 3, skip = 0, take = 10, signal } = {}) => request('pages', { timePeriod, skip, take }, signal),
    sessions: ({ timePeriod = 3, skip = 0, take = 10, pagePath = '', signal } = {}) => request('sessions', { timePeriod, skip, take, ...(pagePath ? { pagePath } : {}) }, signal),
  };
}
