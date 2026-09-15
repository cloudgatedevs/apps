import { auth } from '../shared/services/auth';
import { preview } from './api';

export async function adminUsersRequest(action, body = {}) {
  if (preview) throw new Error('Connect to Cloudgate and sign in as an administrator to manage app users.');
  const base = String(import.meta.env.VITE_IDP_API_URL || import.meta.env.VITE_IDP_BASE_URL || '').replace(/\/$/, '');
  const run = () => fetch(`${base}/api/idp/${encodeURIComponent(auth.tenancyName)}/admin/users/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth.authHeader() }, body: JSON.stringify(body),
  });
  let response = await run();
  if (response.status === 401 && await auth.refresh()) response = await run();
  let result; try { result = await response.json(); } catch { result = null; }
  if (!response.ok || result?.success === false) throw new Error(result?.error?.message || result?.message || 'Unable to manage users. An active Cloudgate tenant administrator is required.');
  return result?.result ?? result;
}
