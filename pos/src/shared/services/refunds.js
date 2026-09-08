import { api, apiBaseUrl } from './api';

const terminal = (r) => ['succeeded', 'failed'].includes(r?.Status);
const slot = (id) => `cloudgate-refund:${apiBaseUrl}:${id}`;
const read = (id) => JSON.parse(localStorage.getItem(slot(id)) || 'null');
const settle = (id, result) => {
  const saved = read(id);
  const row = result.items?.find((r) => r.RequestKey === saved?.requestKey);
  if (saved && row) {
    // Keep the key until the caller has also refreshed the order/sale. A failed
    // detail reload must never turn the next click into a second refund.
    localStorage.setItem(slot(id), JSON.stringify({ ...saved, Status: row.Status }));
  }
  window.dispatchEvent(new Event('refunds-changed'));
  return result;
};

// Persist the intent BEFORE sending. A timeout or reload keeps the same key and
// details; the server also exposes unfinished requests to other devices.
export const refundApi = {
  async submit(id, details) {
    const payload = JSON.parse(JSON.stringify(details));
    let saved = read(id);
    if (saved && JSON.stringify(saved.payload) !== JSON.stringify(payload)) {
      throw new Error('Resolve the earlier refund using Check status or Retry same request before changing its details.');
    }
    if (!saved) {
      saved = { requestKey: crypto.randomUUID(), payload };
      localStorage.setItem(slot(id), JSON.stringify(saved));
    }
    try {
      return settle(id, await api.post('/refunds', { ...saved.payload, id, op: 'refund', requestKey: saved.requestKey }));
    } finally { window.dispatchEvent(new Event('refunds-changed')); }
  },
  async list(id) {
    const result = await api.post('/refunds', { id, op: 'list' });
    const saved = read(id);
    result.items = (result.items || []).map((r) => ({ ...r, requiresRefresh: r.RequestKey === saved?.requestKey && terminal(r) }));
    // A lost response before the claim is visible still has a recoverable intent.
    if (saved && !result.items?.some((r) => r.RequestKey === saved.requestKey)) {
      result.items = [{ RequestKey: saved.requestKey, Status: 'unconfirmed', Method: saved.payload.method || 'card', localOnly: true }, ...(result.items || [])];
    }
    return result.items || [];
  },
  async recover(id, row, retry = false) {
    const saved = read(id);
    if (row.localOnly) {
      if (!retry) return { request: row };
      if (!saved || saved.requestKey !== row.RequestKey) throw new Error('Reload the refund requests.');
      return refundApi.submit(id, saved.payload);
    }
    return settle(id, await api.post('/refunds', { id, requestKey: row.RequestKey, op: retry ? 'retry' : 'refund-status' }));
  },
  async discardUnsent(id) {
    const saved = read(id);
    if (!saved) throw new Error('Reload the refund requests.');
    return settle(id, await api.post('/refunds', { ...saved.payload, id, requestKey: saved.requestKey, op: 'discard-unsent' }));
  },
  acknowledge(id, requestKey) {
    const saved = read(id);
    if (saved?.requestKey === requestKey && terminal(saved)) {
      localStorage.removeItem(slot(id));
      window.dispatchEvent(new Event('refunds-changed'));
    }
  },
};

export const refundMessage = (r) => r?.Status === 'succeeded' ? 'Refund confirmed and recorded.'
  : r?.Status === 'failed' ? 'The refund failed. No refund or stock return was recorded.'
  : 'Refund awaiting confirmation. Check its status before starting another refund.';
