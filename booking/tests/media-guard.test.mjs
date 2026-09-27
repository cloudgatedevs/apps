import test from 'node:test';
import assert from 'node:assert/strict';
import { protectBookingMedia } from '../src/booking/media-guard.js';
const file = { id: 'photo', name: 'Service photo', path: 'booking/media', url: 'https://cdn.example/photo.png' };
function fixture({ service = '', logo = '', broken = false } = {}) {
  const removed = [];
  const client = { files: { list: async ({ path }) => ({ items: path === 'media' ? [file] : [], total: path === 'media' ? 1 : 0 }), delete: async id => removed.push(id) }, appearance: { getPublic: async () => ({ values: { app_logo_url: logo } }) } };
  protectBookingMedia(client, async () => { if (broken) throw new Error('Booking unavailable'); return { settings: {}, staff: [], services: [{ name: 'Massage', active: 1, image_url: service }] }; });
  return { client, removed };
}
test('SDK media deletion preserves photos referenced by Booking and SDK appearance', async () => {
  for (const options of [{ service: file.url }, { logo: file.url }, { broken: true }]) {
    const { client, removed } = fixture(options);
    await assert.rejects(client.files.delete('photo'));
    assert.deepEqual(removed, []);
  }
});
test('unused Booking files can be deleted, but out-of-scope identifiers cannot', async () => {
  const { client, removed } = fixture();
  await assert.rejects(client.files.delete('other'), /no longer/);
  await client.files.delete('photo');
  assert.deepEqual(removed, ['photo']);
});
