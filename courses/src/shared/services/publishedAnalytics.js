// Cloudgate emits this public metadata beside every published site. Only the site ID
// and traffic environment are used; the beacon token is not an admin credential.
export function createPublishedAnalyticsResolver({ readWindow = () => globalThis.window?.__CG_ANALYTICS__, fetchImpl = fetch } = {}) {
  let pending;
  const normalize = data => typeof data?.webAppId === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(data.webAppId) && typeof data.isProduction === 'boolean'
    ? { webAppId: data.webAppId, isProduction: data.isProduction } : null;
  return () => pending ||= (async () => {
    const injected = normalize(readWindow());
    if (injected) return injected;
    try {
      // admin.html has no beacon injection; read its same-origin published config.
      const response = await fetchImpl('/cg-analytics.json', { credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' } });
      return response.ok ? normalize(await response.json()) : null;
    } catch { return null; } // Local dev has no published config: use App Store scope.
  })();
}
