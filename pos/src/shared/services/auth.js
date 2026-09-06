// IdP auth — powered by @cloudgatedevs/cloudgate-client.
//
// The package owns the whole hosted-login session flow: consuming the
// ?access_token=… redirect params, localStorage token storage, silent
// refresh via POST /api/idp/{tenant}/Refresh, and the login redirect.
//
// Tenancy resolution (inside the package): ?idp_tenant= / ?tenant= query,
// then VITE_IDP_TENANCY_NAME, then the subdomain.

import { createCloudgateAuth } from '@cloudgatedevs/cloudgate-client';

const configuredReturnUrl = String(import.meta.env.VITE_IDP_RETURN_URL ?? '').trim();

export const auth = createCloudgateAuth({
  idpBaseUrl: import.meta.env.VITE_IDP_BASE_URL,
  idpApiUrl: import.meta.env.VITE_IDP_API_URL,
  tenancyName: import.meta.env.VITE_IDP_TENANCY_NAME,
});

/** Hosted login URL. Prefers VITE_IDP_RETURN_URL, falling back to the current page. */
export function loginUrl(returnUrl) {
  return auth.loginUrl(returnUrl ?? (configuredReturnUrl || undefined));
}

/** Redirect the browser to the hosted login page. */
export function redirectToLogin(returnUrl) {
  const url = loginUrl(returnUrl);
  if (url) window.location.assign(url);
}
