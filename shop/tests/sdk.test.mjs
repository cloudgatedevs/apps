import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { normalizeSettings, parseCustomPalette } from '@cloudgatedevs/cloudgate-client-react/platform';
import { protectShopMedia } from '../src/shared/services/media-guard.js';

test('Shop rollout uses matching catalogue metadata, SDK settings and separate build modes', async () => {
  const template = JSON.parse(await readFile(new URL('../template.json', import.meta.url), 'utf8'));
  const catalogue = JSON.parse(await readFile(new URL('../../apps.json', import.meta.url), 'utf8'));
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(catalogue.apps.find(app => app.id === 'shop'), template);
  assert.equal(template.version, pkg.version);
  assert.equal(template.appSettings.enable_public_website, 'true');
  assert.equal(template.appSettings.require_public_website_login, 'false');
  assert.equal(template.appSettings.app_name, undefined);
  assert.equal(parseCustomPalette(template.appSettings.theme_custom_palette).name, 'Shop Classic');
  for (const [key, value] of Object.entries(template.appSettings)) assert.equal(normalizeSettings(template.appSettings)[key], value);
  assert.equal(template.build.devBuildCommand, 'npm run build:dev');
  assert.equal(pkg.scripts['build:dev'], 'vite build --mode development');
  assert.match(await readFile(new URL('../.env.example', import.meta.url), 'utf8'), /^VITE_CLOUDGATE_WEB_APP_ID=\{\{webAppId\}\}$/m);
});

function fixture({ refs = { fileIds: [], urls: [], texts: [] }, appearance = {}, pages, failReferences = false } = {}) {
  const deleted = [], listed = [];
  const image = { id: 'abc', name: 'product.jpg', url: 'https://cdn.example/File/GetPublicFileById?id=ABC' };
  const client = {
    files: { async list(query) { listed.push(query); return pages ? pages(query) : { items: query.path === 'media' ? [image] : [], total: query.path === 'media' ? 1 : 0 }; }, async delete(...args) { deleted.push(args); } },
    appearance: { async getPublic() { return { values: appearance }; } },
  };
  let references = refs;
  protectShopMedia(client, async () => { if (failReferences) throw new Error('Workflow unavailable'); return references; });
  return { client, deleted, listed, image, setReferences: value => { references = value; } };
}

test('media deletion checks fresh references, including inactive product IDs', async () => {
  const f = fixture();
  f.setReferences({ fileIds: ['ABC'], urls: [], texts: [] });
  await assert.rejects(f.client.files.delete('abc'), /in use/);
  assert.equal(f.deleted.length, 0);
});
test('full and thumbnail file URLs protect the same product or appearance image', async () => {
  for (const config of [
    { refs: { fileIds: [], texts: [], urls: ['https://cdn.example/File/GetPublicFileByIdSmall?id=abc'] } },
    { appearance: { app_logo_url: 'https://other.example/File/GetPublicFileById?id=abc' } },
  ]) {
    const f = fixture(config); await assert.rejects(f.client.files.delete('abc'), /in use/); assert.equal(f.deleted.length, 0);
  }
});
test('unused images can be deleted and preserve cancellation options', async () => {
  const f = fixture(), options = { signal: new AbortController().signal };
  await f.client.files.delete('abc', options);
  assert.deepEqual(f.deleted, [['abc', options]]);
  assert.deepEqual(f.listed.map(query => query.path), ['media', 'branding']);
});
test('media deletion fails closed when references, file membership or pagination cannot be verified', async () => {
  for (const config of [
    { failReferences: true }, { refs: {} },
    { pages: () => ({ items: [], total: 1 }) },
    { pages: () => ({ items: [], total: 0 }) },
    { pages: () => ({ items: [], total: 'unknown' }) },
  ]) {
    const f = fixture(config); await assert.rejects(f.client.files.delete('abc')); assert.equal(f.deleted.length, 0);
  }
});
test('media deletion follows pagination before checking the requested file', async () => {
  const f = fixture({ pages: ({ path, skip }) => path === 'branding' ? { items: [], total: 0 } : { items: [{ id: skip ? 'abc' : 'first', name: 'photo.jpg' }], total: 2 } });
  await f.client.files.delete('abc');
  assert.deepEqual(f.listed.map(query => query.skip), [0, 1, 0]);
});

test('category and Markdown images are protected across file URL variants', async () => {
  for (const refs of [
    { fileIds: [], urls: ['https://cdn.example/File/GetPublicFileByIdSmall?id=abc'], texts: [] },
    { fileIds: [], urls: [], texts: ['![Photo](https://cdn.example/File/GetPublicFileById?id=abc)'] },
    { fileIds: [], urls: [], texts: ['<img src="https://cdn.example/File/GetPublicFileByIdSmall?size=100&amp;id=ABC">'] },
  ]) {
    const f = fixture({ refs }); await assert.rejects(f.client.files.delete('abc'), /in use/); assert.equal(f.deleted.length, 0);
  }
});
