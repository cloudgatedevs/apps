// Image upload for IdP-authenticated admins.
//
// Talks to the Cloudgate host directly (not a workflow): POST
// {IDP_API_URL}/api/idp/{tenancy}/files/upload with the IdP bearer token.
// Only admin-like IdP roles may upload; the host validates the image and
// returns public URLs that the storefront can render without any token.
import { auth } from './auth';

const idpApiUrl = (
  String(import.meta.env.VITE_IDP_API_URL ?? '').trim() ||
  String(import.meta.env.VITE_IDP_BASE_URL ?? '').trim()
).replace(/\/$/, '');

function unwrap(raw) {
  if (raw && typeof raw === 'object' && 'result' in raw) return raw.result;
  return raw;
}

async function readError(res) {
  let message = res.status === 404 ? 'The file service is not available on this Cloudgate host (404).' : `Request failed (${res.status})`;
  try {
    const data = await res.json();
    message = data?.error?.message || data?.Message || data?.message || message;
  } catch {
    /* non-JSON body */
  }
  const err = new Error(message);
  err.status = res.status;
  return err;
}

/** Absolute upload URL for a folder — used by the Uppy uploader's XHR plugin. */
export function uploadEndpoint(path = 'uploads') {
  if (!idpApiUrl || !auth.tenancyName) throw new Error('IdP is not configured.');
  return `${idpApiUrl}/api/idp/${encodeURIComponent(auth.tenancyName)}/files/upload?path=${encodeURIComponent(path)}`;
}

/** Bearer header for direct host calls, evaluated per request so a refreshed token is picked up. */
export function authHeaders() {
  const token = auth.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * @param {File} file
 * @param {{ path?: string }} [opts]  folder shown in the hub Files grid, e.g. "shop/products"
 * @returns {Promise<{ id: string, fileId: string, url: string, thumbUrl: string, name: string, size: number }>}
 */
export async function uploadImage(file, { path = 'shop/products' } = {}) {
  const token = auth.getAccessToken();
  if (!idpApiUrl || !auth.tenancyName) throw new Error('IdP is not configured.');
  if (!token) throw new Error('Sign in to upload images.');

  const form = new FormData();
  form.append('file', file, file.name);
  const url = `${idpApiUrl}/api/idp/${encodeURIComponent(auth.tenancyName)}/files/upload?path=${encodeURIComponent(path)}`;
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  if (!res.ok) throw await readError(res);
  return unwrap(await res.json());
}

/**
 * List stored images (newest first). `path` is the folder given at upload; '*' lists every folder.
 * @returns {Promise<{ total: number, items: Array<{ id: string, fileId: string, name: string, path: string, createdAt: string, url: string, thumbUrl: string }> }>}
 */
export async function listImages({ path = 'shop/products', skip = 0, take = 100 } = {}) {
  const token = auth.getAccessToken();
  if (!idpApiUrl || !auth.tenancyName || !token) throw new Error('Sign in to manage images.');
  const qs = new URLSearchParams({ path, skip: String(skip), take: String(take) });
  const url = `${idpApiUrl}/api/idp/${encodeURIComponent(auth.tenancyName)}/files?${qs}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw await readError(res);
  return unwrap(await res.json());
}

export async function deleteImage(dataFileId) {
  const token = auth.getAccessToken();
  if (!idpApiUrl || !auth.tenancyName || !token) throw new Error('Sign in to manage images.');
  const url = `${idpApiUrl}/api/idp/${encodeURIComponent(auth.tenancyName)}/files/${encodeURIComponent(dataFileId)}`;
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw await readError(res);
  return unwrap(await res.json());
}
