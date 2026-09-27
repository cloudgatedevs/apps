import assert from 'node:assert/strict';
import { test } from 'node:test';
import { protectAcademyMedia } from '../src/academy/media-guard.js';

const file = { id: '12345678-1234-4234-8234-123456789abc', name: 'Course cover', path: 'courses/media', url: 'https://media.example/cover.png' };
const workspace = () => ({ role: 'admin', services: [], staff: [], settings: {}, mediaReferences: [] });
function setup(data = workspace(), appearance = {}) {
  const deleted = [];
  const client = { files: {
    list: async ({ path }) => ({ items: path === 'media' ? [file] : [], total: path === 'media' ? 1 : 0 }),
    delete: async id => { deleted.push(id); },
  }, appearance: { getPublic: async () => ({ values: appearance }) } };
  protectAcademyMedia(client, async () => data);
  return { client, deleted };
}
test('SDK media cannot remove a course image retained by a published curriculum', async () => {
  const data = workspace(); data.mediaReferences = [{ url: file.url, label: 'Original enrolment curriculum' }];
  const { client, deleted } = setup(data);
  await assert.rejects(client.files.delete(file.id), /in use/); assert.deepEqual(deleted, []);
});
test('SDK media protects draft courses, homepage assets and native branding', async () => {
  for (const use of ['draft', 'homepage', 'logo']) {
    const data = workspace();
    if (use === 'draft') data.services = [{ name: 'Draft course', image_url: file.url, active: false }];
    if (use === 'homepage') data.settings.hero_image_url = file.url;
    const { client, deleted } = setup(data, use === 'logo' ? { app_logo_url: file.url } : {});
    await assert.rejects(client.files.delete(file.id), /in use/); assert.deepEqual(deleted, []);
  }
});
test('deletion needs a complete administrator reference check and a known file', async () => {
  const limited = setup({ ...workspace(), role: 'instructor' });
  await assert.rejects(limited.client.files.delete(file.id), /administrator access/);
  const complete = setup();
  await assert.rejects(complete.client.files.delete('missing'), /no longer/);
  await complete.client.files.delete(file.id); assert.deepEqual(complete.deleted, [file.id]);
});
