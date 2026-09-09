import { auth } from '../shared/services/auth';

async function request(path = '', options = {}) {
  const base = String(import.meta.env.VITE_IDP_API_URL || import.meta.env.VITE_IDP_BASE_URL || '').replace(/\/$/, '');
  const token = auth.getAccessToken();
  if (!base || !auth.tenancyName || !token) throw new Error('Sign in to manage your profile picture.');
  const response = await fetch(`${base}/api/idp/${encodeURIComponent(auth.tenancyName)}/profile${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } });
  let raw;
  try { raw = await response.json(); } catch { raw = null; }
  if (!response.ok) throw new Error(raw?.error?.message || raw?.message || raw?.Message || (response.status === 404 ? 'Profile photo uploads are not available yet. Please contact your administrator.' : 'Unable to update your profile. Please try again.'));
  return raw?.result ?? raw;
}

export async function getSelfProfile() {
  const value = await request();
  return { id: value.id ?? value.Id, name: value.name ?? value.Name ?? '', surname: value.surname ?? value.Surname ?? '', email: value.email ?? value.Email ?? '', photoUrl: value.photoUrl ?? value.PhotoUrl ?? '' };
}

export async function uploadProfilePicture(blob, name) {
  const body = new FormData();
  body.append('file', blob, name.replace(/\.[^.]+$/, '') + '.png');
  const result = await request('/picture', { method: 'PUT', body });
  return { url: result.photoUrl ?? result.PhotoUrl ?? '' };
}

export async function removeProfilePicture() { return request('/picture', { method: 'DELETE' }); }
