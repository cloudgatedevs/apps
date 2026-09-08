import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, beforeEach } from 'node:test';

const source = readFileSync(new URL('../src/shared/services/refunds.js', import.meta.url), 'utf8');
let calls, handle, refundApi;
beforeEach(async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
  globalThis.window = new EventTarget();
  calls = [];
  globalThis.testRefundApi = { post: async (url, body) => { calls.push({ url, body }); return handle(body); } };
  const code = source.replace("import { api, apiBaseUrl } from './api';", "const api=globalThis.testRefundApi; const apiBaseUrl='refund-test';") + `\n// ${crypto.randomUUID()}`;
  ({ refundApi } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64')));
});
const details = { amountCents: 500, method: 'card', reason: 'Returned' };
const result = (b, Status = 'pending') => {
  const request = { RequestKey: b.requestKey, Status, Method: b.method || 'card' };
  return { request, items: [request] };
};

test('network timeout and reload retain the original key and details', async () => {
  handle = () => { throw new Error('timeout'); };
  await assert.rejects(refundApi.submit(1, details), /timeout/);
  const first = calls[0].body;
  handle = () => ({ items: [] });
  const [saved] = await refundApi.list(1);
  assert.equal(saved.localOnly, true);
  handle = (b) => result(b);
  await refundApi.recover(1, saved, true);
  assert.deepEqual(calls.at(-1).body, first);
});

test('changed payload cannot reuse an outstanding request key', async () => {
  handle = (b) => result(b);
  await refundApi.submit(1, details);
  await assert.rejects(refundApi.submit(1, { ...details, amountCents: 400 }), /earlier refund/);
  assert.equal(calls.length, 1);
});

test('status checks are read-only and explicit retry uses the same key', async () => {
  handle = (b) => result(b);
  const { request } = await refundApi.submit(1, details);
  await refundApi.recover(1, request);
  assert.equal(calls.at(-1).body.op, 'refund-status');
  await refundApi.recover(1, request, true);
  assert.equal(calls.at(-1).body.op, 'retry');
  assert.equal(calls.at(-1).body.requestKey, request.RequestKey);
});

test('terminal confirmation requires a successful detail refresh before a new return', async () => {
  handle = (b) => result(b, 'succeeded');
  const first = await refundApi.submit(1, details);
  await assert.rejects(refundApi.submit(1, { ...details, amountCents: 400 }), /earlier refund/);
  const replay = await refundApi.submit(1, details);
  assert.equal(replay.request.RequestKey, first.request.RequestKey);
  refundApi.acknowledge(1, first.request.RequestKey);
  const second = await refundApi.submit(1, { ...details, amountCents: 400 });
  assert.notEqual(first.request.RequestKey, second.request.RequestKey);
});

test('unsent dismissal reserves a tombstone on the server before clearing', async () => {
  handle = () => { throw new Error('timeout'); };
  await assert.rejects(refundApi.submit(1, details));
  const original = calls[0].body;
  handle = (b) => result(b, 'failed');
  await refundApi.discardUnsent(1);
  assert.deepEqual(calls.at(-1).body, { ...original, op: 'discard-unsent' });
  refundApi.acknowledge(1, original.requestKey);
  handle = () => ({ items: [] });
  assert.deepEqual(await refundApi.list(1), []);
});

test('dismissal cannot clear a request that has reached the provider', async () => {
  handle = (b) => result(b);
  const first = await refundApi.submit(1, details);
  await refundApi.discardUnsent(1);
  await assert.rejects(refundApi.submit(1, { ...details, amountCents: 400 }), /earlier refund/);
  await refundApi.recover(1, first.request);
  assert.equal(calls.at(-1).body.requestKey, first.request.RequestKey);
});
