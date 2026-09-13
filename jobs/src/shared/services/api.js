// Cloudgate workflow-API access — powered by @cloudgatedevs/cloudgate-client.
//
// The React client talks ONLY to Cloudgate workflow endpoints — never to any
// backend service or database directly.
//
// The request base is composed from three .env keys rather than one hardcoded
// URL, so moving between publish slots is a one-value change:
//
//   {VITE_CLOUDGATE_API_URL}/{VITE_CLOUDGATE_API_ENV}/{VITE_CLOUDGATE_API_PROJECT}
//
// Set VITE_CLOUDGATE_API_ENV to "sbx" (sandbox) or "prod" (production).
//
// The package handles everything else:
//   - HMAC-SHA512 request signing (X-Api-Key / X-Timestamp / X-Authentication-Signature)
//   - response coercion + { result } / { data } envelope unwrapping
//   - the IdP bearer token, attached per request via auth.authHeader()
//
// Usage:
//   import { api } from '@/shared/services/api';
//   const data   = await api.get('/example/list', { take: 20 });
//   const result = await api.post('/example/create', { name: 'Acme' });

import { CloudgateError, createCloudgateClient } from '@cloudgatedevs/cloudgate-client';
import { auth } from './auth';

const trimSlashes = (value) => String(value ?? '').trim().replace(/^\/+|\/+$/g, '');

const GATEWAY_URL = String(import.meta.env.VITE_CLOUDGATE_API_URL ?? '')
  .trim()
  .replace(/\/+$/, '');

/** Publish slot the app is pointed at — "sbx" or "prod". */
export const apiEnv = trimSlashes(import.meta.env.VITE_CLOUDGATE_API_ENV) || 'sbx';

const API_PROJECT = trimSlashes(import.meta.env.VITE_CLOUDGATE_API_PROJECT) || 'api';

/** Fully composed request base, e.g. https://apps.example.com/sbx/api */
export const apiBaseUrl = GATEWAY_URL ? [GATEWAY_URL, apiEnv, API_PROJECT].join('/') : '';

export const apiConfigured = Boolean(apiBaseUrl);

const cloudgate = apiConfigured
  ? createCloudgateClient({
      baseUrl: apiBaseUrl,
      apiKey: import.meta.env.VITE_API_KEY,
      apiSecret: import.meta.env.VITE_API_SECRET,
      timeoutMs: 20000,
      headers: () => auth.authHeader(), // evaluated per request — always the current token
    })
  : null;

export const signingEnabled = Boolean(cloudgate?.signingEnabled);

function ensureConfigured() {
  if (!cloudgate) throw new Error('VITE_CLOUDGATE_API_URL is not configured.');
}

// On a 401, silently refresh the IdP session once and retry the request.
async function withAuthRetry(run) {
  try {
    return await run();
  } catch (err) {
    if (err instanceof CloudgateError && err.status === 401 && auth.enabled) {
      const refreshed = await auth.refresh();
      if (refreshed) return run();
    }
    throw err;
  }
}

export const api = {
  /** GET {base}{path}?...params -> unwrapped workflow result. */
  async get(path, params, opts) {
    ensureConfigured();
    return withAuthRetry(() => cloudgate.get(path, { ...opts, params }));
  },
  /** POST {base}{path} with a JSON body -> unwrapped workflow result. */
  async post(path, body, opts) {
    ensureConfigured();
    return withAuthRetry(() => cloudgate.post(path, body, opts));
  },
  /** PUT {base}{path} with a JSON body -> unwrapped workflow result. */
  async put(path, body, opts) {
    ensureConfigured();
    return withAuthRetry(() => cloudgate.put(path, body, opts));
  },
  /** DELETE {base}{path} -> unwrapped workflow result. */
  async del(path, opts) {
    ensureConfigured();
    return withAuthRetry(() => cloudgate.delete(path, opts));
  },
  /** The underlying @cloudgatedevs/cloudgate-client instance, for advanced cases. */
  get client() {
    ensureConfigured();
    return cloudgate;
  },
};
