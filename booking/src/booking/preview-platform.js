// Development-only adapter for the existing loopback Booking simulator. No hosted credentials are used.
import { createCloudgateAuth } from '@cloudgatedevs/cloudgate-client-react';
import { DEFAULT_SETTINGS } from '@cloudgatedevs/cloudgate-client-react/platform';
const APP_ID = '00000000-0000-4000-8000-000000000001';
export function configurePreview(config) {
  if (!import.meta.env.DEV) throw new Error('The local simulator is only available during development.');
  const storage = new Map();
  const auth = createCloudgateAuth({ idpBaseUrl: location.origin, tenancyName: 'preview',
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } });
  if (location.pathname.startsWith('/admin')) auth.setSession({ accessToken: `e30.${btoa(JSON.stringify({ sub: 'preview-admin', exp: Math.floor(Date.now() / 1000) + 86400 })).replaceAll('=', '')}.preview` });
  let values = { ...DEFAULT_SETTINGS, app_name: 'Booking preview', app_tagline: 'Local simulator', theme_density: 'flex' };
  let revision = APP_ID;
  const permissionKeys = ['backoffice.access', 'backoffice.media.view', 'backoffice.media.upload', 'backoffice.media.delete', 'backoffice.branding.view', 'backoffice.branding.edit', 'backoffice.theme.view', 'backoffice.theme.edit'];
  const localMedia = async (op, data = {}) => {
    const response = await fetch('/api/branding-media', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Studio-Preview': '1', 'X-Preview-Role': 'admin' }, body: JSON.stringify({ ...data, op }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Local media request failed.');
    return result;
  };
  return { ...config, idpBaseUrl: location.origin, apiUrl: location.origin, tenancyName: 'preview', webAppId: APP_ID, environment: 'sbx', auth,
    resolvePublishedApp: async () => null,
    fetch: async (input, init = {}) => {
      const url = new URL(input, location.origin), route = url.pathname.replace('/api/idp/preview/', '');
      if (route === 'website') return Response.json({ values, revision, allowSelfRegistration: false });
      if (route === 'profile') return Response.json({ id: 'preview-admin', name: 'Preview', surname: 'Admin', email: 'preview@example.invalid', role: 'Admin', isEmailConfirmed: true, rolePermissions: permissionKeys.map(key => ({ key, value: 'true' })) });
      if (route.startsWith('admin/appearance/')) {
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
      return Response.json({ message: 'This Cloudgate feature requires the connected app. The local simulator supports Booking workflows, appearance and media.' }, { status: 503 });
    },
  };
}
