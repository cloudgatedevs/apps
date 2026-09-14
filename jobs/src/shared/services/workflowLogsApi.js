// Workflow logs for THIS installed app, read from Cloudgate's own log store through the
// IdP admin API (POST /api/idp/{tenant}/admin/workflow-logs/*). Same file in every App Store
// app, next to CloudgateSmtpSettings.jsx.
//
// The scope is the controller the app's workflows live under and the gateway environment the
// build targets — both already in .env for the workflow client:
//   VITE_CLOUDGATE_API_PROJECT  -> projectPath   (e.g. "shop", suffixed by the App Store when taken)
//   VITE_CLOUDGATE_API_ENV      -> environment   ("sbx" | "prod")
// The backend resolves that pair through the tenant's App Store installs, so an app admin can
// only ever read the calls made to this app's own controller.
//
// Requires an active IdP user with the Admin role (the same gate as email settings and user
// management) and a Cloudgate host that ships the workflow-logs admin API; older hosts answer
// 404 and the page explains that instead of breaking.
import { auth } from './auth';

const trim = (v) => String(v ?? '').trim().replace(/^\/+|\/+$/g, '');

const idpApiUrl = (String(import.meta.env.VITE_IDP_API_URL ?? '').trim() || String(import.meta.env.VITE_IDP_BASE_URL ?? '').trim()).replace(/\/$/, '');

/** What this build is scoped to. `configured` is false in the local preview or when .env is incomplete. */
export const workflowLogsScope = {
  projectPath: trim(import.meta.env.VITE_CLOUDGATE_API_PROJECT),
  environment: trim(import.meta.env.VITE_CLOUDGATE_API_ENV) || 'sbx',
  get isProduction() {
    return /^prod/i.test(this.environment);
  },
  get configured() {
    return import.meta.env.MODE !== 'preview' && Boolean(idpApiUrl && auth.tenancyName && this.projectPath);
  },
};

export class WorkflowLogsError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'WorkflowLogsError';
    this.status = status;
    /** 'unavailable' (API not deployed), 'forbidden', 'not-installed', 'network' or 'error'. */
    this.code = code;
  }
}

async function request(action, body) {
  if (!workflowLogsScope.configured) throw new WorkflowLogsError('Workflow logs need a connected Cloudgate environment.', 0, 'unavailable');
  const url = `${idpApiUrl}/api/idp/${encodeURIComponent(auth.tenancyName)}/admin/workflow-logs/${action}`;
  const payload = { projectPath: workflowLogsScope.projectPath, environment: workflowLogsScope.environment, ...body };
  const run = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...auth.authHeader() }, body: JSON.stringify(payload) });
  let response;
  try {
    response = await run();
    if (response.status === 401 && (await auth.refresh())) response = await run();
  } catch {
    throw new WorkflowLogsError('Could not reach Cloudgate. Check your connection and try again.', 0, 'network');
  }
  let raw = null;
  try { raw = await response.json(); } catch { /* empty or non-JSON body */ }
  if (!response.ok) {
    const message = raw?.error?.message || raw?.message || (typeof raw === 'string' ? raw : '');
    if (response.status === 404 && /no installed app/i.test(message)) throw new WorkflowLogsError(message, 404, 'not-installed');
    if (response.status === 404) throw new WorkflowLogsError('The workflow logs API is not deployed on this Cloudgate server yet.', 404, 'unavailable');
    if (response.status === 401 || response.status === 403) throw new WorkflowLogsError('An active tenant Admin account is required to view workflow logs.', response.status, 'forbidden');
    throw new WorkflowLogsError(message || `Cloudgate answered ${response.status}.`, response.status, 'error');
  }
  return raw?.result ?? raw;
}

export const workflowLogsApi = {
  /**
   * Paged calls, newest first. `{ scope, totalCount, items[] }` where each item carries route, op, outcome
   * (success | unauthorized | error), durationMs, idpUserEmail, country and payload sizes — never the payloads.
   */
  list: ({ skip = 0, take = 50, route, outcome, minDurationMs, idpUserId, sessionId, startDate, endDate } = {}) =>
    request('list', {
      skip,
      take,
      ...(route ? { route } : {}),
      ...(outcome ? { outcome } : {}),
      ...(minDurationMs ? { minDurationMs } : {}),
      ...(idpUserId ? { idpUserId } : {}),
      ...(sessionId ? { sessionId } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    }),
  /** Totals with previous-period comparison, per-action stats and hourly/daily buckets. periodHours: 24 | 168 | 720. */
  summary: (periodHours = 24) => request('summary', { periodHours }),
  /** One call with its request and response (masked when the action masks data). */
  get: (id) => request('get', { id }),
  /** Node-by-node session logs for one call. */
  nodes: (sessionId) => request('nodes', { sessionId }).then((r) => r?.items ?? []),
};
