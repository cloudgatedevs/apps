import test from 'node:test';
import assert from 'node:assert/strict';
import { deletionCandidates, isBookingFolder, loadMediaPages, mediaRows } from '../src/booking/media-model.js';

const id = '1272111a-7037-4b91-e1a0-08df0e196a29';
const url = `http://booking.localhost:44301/File/GetPublicFileById?id=${id}`;
const file = { id, name: 'service.png', path: 'booking/services', url, thumbUrl: url.replace('GetPublicFileById', 'GetPublicFileByIdSmall') };
const data = { settings: {}, services: [] };

test('the library only manages genuine Booking folders', () => {
  for (const path of ['booking/services', 'booking/branding', 'booking/library', 'booking/events/photos']) assert.equal(isBookingFolder(path), true);
  for (const path of ['', 'uploads', 'shop/products', 'pos/products', 'booking-other/photos', 'booking', 'booking/', 'booking/../shop', 'booking/./photos', 'booking//photos', 'booking/..\\shop', undefined]) assert.equal(isBookingFolder(path), false);
  assert.deepEqual(mediaRows([file, { ...file, id: 'other', path: 'shop/products' }], data).map(row => row.id), [id]);
});

test('full image and thumbnail URLs match DataFile identity across host changes', () => {
  const current = { services: [{ name: 'Consultation', active: 1, image_url: `https://files.example/File/GetPublicFileByIdSmall?width=100&id=${id.toUpperCase()}#preview` }], settings: { logo_url: url, icon_url: url, favicon_url: url, hero_image_url: url, about_image_url: url } };
  const row = mediaRows([file], current)[0];
  assert.equal(row.inUse, true);
  assert.deepEqual(row.usages.map(use => use.label), ['Consultation', 'Logo', 'App icon', 'Favicon', 'Homepage banner', 'About image']);
  assert.equal(row.usages[0].page, 'services');
  assert.equal(row.usages[1].page, 'settings');
});

test('hidden services protect images; retired services release them for cleanup', () => {
  const row = mediaRows([file], { ...data, services: [{ name: 'Hidden', active: 0, image_url: url }, { name: 'Retired', active: 0, deleted: 1, image_url: url }] })[0];
  assert.deepEqual(row.usages, [{ label: 'Hidden (hidden)', page: 'services' }]);
  assert.equal(mediaRows([file], { ...data, services: [{ name: 'Retired', deleted: 1, image_url: url }] })[0].inUse, false);
});

test('team photos remain protected even when the team member is inactive', () => {
  const current = { ...data, staff: [{ name: 'Consultant', active: 0, image_url: url }] };
  assert.deepEqual(mediaRows([file], current)[0].usages, [{ label: 'Consultant (team)', page: 'team' }]);
  assert.throws(() => deletionCandidates([id], [file], current), /now in use/);
});

test('local URLs and canonical remote URLs detect use without substring collisions', () => {
  const local = '/api/branding-media/' + 'a'.repeat(64) + '.png';
  const files = [{ ...file, id: 'local', url: local, thumbUrl: '' }, { ...file, id: 'remote', url: 'https://cdn.example/photo.png?a=1&b=2', thumbUrl: '' }, { ...file, id: 'other', url: 'https://cdn.example/photo.png?a=1&b=20', thumbUrl: '' }];
  assert.deepEqual(mediaRows(files, { services: [], settings: { logo_url: 'http://127.0.0.1:3002' + local + '#logo', hero_image_url: 'https://cdn.example/photo.png?b=2&a=1' } }).map(row => row.inUse), [true, true, false]);
});

test('deletion revalidates all requested IDs, scope and fresh usage before deleting anything', () => {
  assert.deepEqual(deletionCandidates([id, id], [file], data).map(row => row.id), [id]);
  assert.throws(() => deletionCandidates([id], [file], { ...data, settings: { logo_url: url } }), /now in use/);
  assert.throws(() => deletionCandidates([id, 'unknown'], [file], data), /no longer/);
  assert.throws(() => deletionCandidates([id], [{ ...file, path: 'shop/products' }], data), /no longer/);
  assert.throws(() => deletionCandidates([id], [file], {}), /Reload booking data/);
});

test('pagination includes Booking files after multiple host-capped pages', async () => {
  const calls = [];
  const source = [...Array.from({ length: 205 }, (_, n) => ({ ...file, id: String(n), path: 'shop/products' })), file];
  const files = await loadMediaPages(async args => { calls.push(args); return { items: source.slice(args.skip, args.skip + 36), total: source.length }; });
  assert.deepEqual(calls.map(args => args.skip), [0, 36, 72, 108, 144, 180]);
  assert.equal(files.length, 206);
  assert.deepEqual(mediaRows(files, data).map(row => row.id), [id]);
});

test('pagination rejects incomplete, repeated or invalid file lists', async () => {
  for (const page of [{ items: [], total: 10 }, { items: [file], total: 10 }, { total: 1 }, { items: [{}], total: 1 }, { items: [], total: -1 }]) await assert.rejects(loadMediaPages(async () => page));
  assert.deepEqual(await loadMediaPages(async () => ({ items: [], total: 0 })), []);
});
