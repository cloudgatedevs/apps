/**
 * IdP profile API (get / update the signed-in user's profile).
 *
 * Token storage, refresh and login redirects live in
 * @cloudgatedevs/cloudgate-client (see src/services/auth.js) — this file only
 * covers the profile endpoints, which are outside the package's scope.
 */
import { auth } from '@/shared/services/auth';

const idpApiUrl = (
  String(import.meta.env.VITE_IDP_API_URL ?? '').trim() ||
  String(import.meta.env.VITE_IDP_BASE_URL ?? '').trim()
).replace(/\/$/, '');

function profileUrl(tenancyName) {
  return `${idpApiUrl}/api/idp/${encodeURIComponent(tenancyName)}/profile`;
}

function normalizeProfile(raw) {
  const r = raw?.result ?? raw;
  if (!r || typeof r !== 'object') return null;
  return {
    id: r.id ?? r.Id,
    email: r.email ?? r.Email ?? undefined,
    name: r.name ?? r.Name ?? undefined,
    surname: r.surname ?? r.Surname ?? undefined,
    photoUrl: r.photoUrl ?? r.PhotoUrl ?? null,
    role: r.role ?? r.Role ?? null,
  };
}

/** @returns {string} */
export function getProfileDisplayName(profile) {
  const name = String(profile?.name ?? '').trim();
  const surname = String(profile?.surname ?? '').trim();
  // Some IdP profiles store the full name in `name` and the surname again in `surname`
  // ("Niel Olivier" + "Olivier"): do not append a surname the name already ends with.
  const namePart = surname && !name.toLowerCase().endsWith(surname.toLowerCase()) ? `${name} ${surname}`.trim() : name;
  return namePart || profile?.email || 'User';
}

/** @returns {string | undefined} */
export function getProfilePictureSrc(profile) {
  const photoUrl = profile?.photoUrl ?? profile?.PhotoUrl;
  return photoUrl && typeof photoUrl === 'string' ? photoUrl.trim() || undefined : undefined;
}

/**
 * @param {string} accessToken
 * @param {string} [tenancyName]
 */
export const PROFILE_REJECTED = Symbol('profile-rejected');

/**
 * Resolves the profile, `null` when it is unavailable (network, server error), or
 * PROFILE_REJECTED when the IdP refused the token (401/403), e.g. a session from another
 * API host after switching environments. Callers must sign out on PROFILE_REJECTED.
 */
export async function getIdpProfile(accessToken, tenancyName = auth.tenancyName) {
  if (!idpApiUrl || !tenancyName || !accessToken) return null;
  try {
    const res = await fetch(profileUrl(tenancyName), {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 401 || res.status === 403) return PROFILE_REJECTED;
    if (!res.ok) return null;
    const profile = normalizeProfile(await res.json());
    return profile && profile.id != null ? profile : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} accessToken
 * @param {string} tenancyName
 * @param {{ name?: string; surname?: string; email?: string }} input
 */
export async function updateIdpProfile(accessToken, tenancyName, input) {
  if (!idpApiUrl || !tenancyName || !accessToken) return null;
  try {
    const res = await fetch(profileUrl(tenancyName), {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const profile = normalizeProfile(await res.json());
    if (!profile) return null;
    if (profile.id == null && profile.name == null && profile.email == null) return null;
    return { ...profile, id: profile.id ?? 0 };
  } catch {
    return null;
  }
}
