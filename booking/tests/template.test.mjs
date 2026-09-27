import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Booking catalogue and folder agree on SDK rollout settings and application scope', async () => {
  const template = JSON.parse(await readFile(new URL('../template.json', import.meta.url), 'utf8'));
  const catalogue = JSON.parse(await readFile(new URL('../../apps.json', import.meta.url), 'utf8'));
  assert.deepEqual(catalogue.apps.find(app => app.id === 'booking'), template);
  assert.equal(template.appSettings.enable_public_website, 'true');
  assert.equal(template.appSettings.require_public_website_login, 'false');
  assert.equal(template.appSettings.app_name, undefined, 'use the name chosen by the owner');
  for (const value of Object.values(template.appSettings)) assert.equal(typeof value, 'string');
  const env = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(env, /^VITE_CLOUDGATE_WEB_APP_ID=\{\{webAppId\}\}$/m);
});
