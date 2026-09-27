import assert from 'node:assert/strict';
import { test } from 'node:test';
import { protectEventsMedia } from '../src/events/media-guard.js';

const file = { id: '12345678-1234-4234-8234-123456789abc', name: 'Event artwork', path: 'events/media', url: 'https://media.example/event.png' };
const workspace = () => ({ role: 'admin', services: [], staff: [], settings: {}, mediaReferences: [] });
function setup(data = workspace(), appearance = {}) {
  const deleted = [];
  const client = { files: {
    list: async ({ path }) => ({ items: path === 'media' ? [file] : [], total: path === 'media' ? 1 : 0 }),
    delete: async id => { deleted.push(id); },
  }, appearance: { getPublic: async () => ({ values: appearance }) } };
  protectEventsMedia(client, async () => data);
  return { client, deleted };
}
test('SDK media protects published and unlisted event artwork', async () => {
  for (const active of [true, false]) {
    const data = workspace(); data.services = [{ name: 'Event', active, image_url: file.url }];
    const { client, deleted } = setup(data);
    await assert.rejects(client.files.delete(file.id), /in use/); assert.deepEqual(deleted, []);
  }
});
test('SDK media protects homepage, editorial and native appearance images', async () => {
  for (const use of ['hero_image_url', 'about_image_url', 'app_logo_url', 'app_icon_url']) {
    const data = workspace(); data.settings[use] = file.url;
    const { client, deleted } = setup(data, { [use]: file.url });
    await assert.rejects(client.files.delete(file.id), /in use/); assert.deepEqual(deleted, []);
  }
});
test('partial staff snapshots cannot authorise deletion; unused known images can be removed', async () => {
  const limited = setup({ ...workspace(), role: 'staff' });
  await assert.rejects(limited.client.files.delete(file.id), /administrator access/);
  const complete = setup();
  await assert.rejects(complete.client.files.delete('missing'), /no longer/);
  await complete.client.files.delete(file.id); assert.deepEqual(complete.deleted, [file.id]);
});
