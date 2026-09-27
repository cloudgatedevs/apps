// Development-only adapter for the isolated Academy simulator; never included in release builds.
import { createCloudgateAuth } from '@cloudgatedevs/cloudgate-client-react';
import { DEFAULT_SETTINGS, BACKOFFICE_PERMISSION_KEYS } from '@cloudgatedevs/cloudgate-client-react/platform';
import metadata from '../../template.json';
const APP_ID = '00000000-0000-4000-8000-000000000002';
export function configurePreview(config) {
  if (!import.meta.env.DEV) throw new Error('The local simulator is only available during development.');
  const role = sessionStorage.getItem('courses.preview.role') || '';
  const identities = { admin: ['1', 'Alex', 'Morgan'], learner: ['2', 'Jordan', 'Williams'], instructor: ['3', 'Alex', 'Morgan'] };
  const identity = identities[role];
  const storage = new Map();
  const auth = createCloudgateAuth({ idpBaseUrl: location.origin, tenancyName: 'preview',
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } });
  if (identity) auth.setSession({ accessToken: `e30.${btoa(JSON.stringify({ sub: identity[0], exp: Math.floor(Date.now() / 1000) + 86400 })).replaceAll('=', '')}.preview` });
  let values = { ...DEFAULT_SETTINGS, ...metadata.appSettings, app_name: 'Academy preview', app_tagline: 'Local simulator' };
  let revision = APP_ID;
  const localMedia = async (op, data = {}) => {
    const response = await fetch('/api/branding-media', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Academy-Preview': '1', 'X-Preview-Role': role }, body: JSON.stringify({ ...data, op }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Local media request failed.');
    return result;
  };
  return { ...config, idpBaseUrl: location.origin, apiUrl: location.origin, tenancyName: 'preview', webAppId: APP_ID, environment: 'sbx', auth,
    resolvePublishedApp: async () => null,
    fetch: async (input, init = {}) => {
      const url = new URL(input, location.origin), route = url.pathname.replace('/api/idp/preview/', '');
      if (route === 'website') return Response.json({ values, revision, allowSelfRegistration: false });
      if (route === 'profile' && identity) return Response.json({ id: identity[0], name: identity[1], surname: identity[2], email: role + '@example.invalid', role: role === 'admin' ? 'Admin' : 'User', isEmailConfirmed: true,
        rolePermissions: (role === 'admin' ? BACKOFFICE_PERMISSION_KEYS : role === 'instructor' ? ['backoffice.access'] : []).map(key => ({ key, value: 'true' })) });
      if (route.startsWith('admin/appearance/') && role === 'admin') {
        if (route.endsWith('/update')) { values = { ...values, ...JSON.parse(init.body).values }; revision = crypto.randomUUID(); }
        return Response.json({ values, revision });
      }
      if (route === 'notifications/unread-count') return Response.json({ unreadCount: 0 });
      if (route.startsWith('notifications/')) return Response.json({ items: [], totalCount: 0 });
      if (route === 'files') return Response.json(await localMedia('list', Object.fromEntries(url.searchParams)));
      if (route === 'files/upload') {
        const file = init.body.get('file'), bytes = new Uint8Array(await file.arrayBuffer());
        let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
        return Response.json(await localMedia('upload', { name: file.name, path: url.searchParams.get('path'), content: btoa(binary) }));
      }
      if (route.startsWith('files/') && init.method === 'DELETE') return Response.json(await localMedia('delete', { id: decodeURIComponent(route.slice(6)) }));
      return Response.json({ message: 'This platform feature needs a connected Cloudgate tenant.' }, { status: 503 });
    },
  };
}
