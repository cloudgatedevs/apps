import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminReturnUrl } from '../src/booking/admin-login.js';

test('admin login returns to the configured workspace without query or fragment credentials', () => {
  assert.equal(adminReturnUrl('http://localhost:3002','http://127.0.0.1:3002/admin#settings'),'http://localhost:3002/admin');
  assert.equal(adminReturnUrl('https://bloom.example/','https://bloom.example/admin?access_token=old#calendar'),'https://bloom.example/admin');
  assert.equal(adminReturnUrl('', 'https://bloom.example/admin#settings?access_token=old&refresh_token=old'),'https://bloom.example/admin');
});
test('admin login uses the current origin when no return URL is configured', () => {
  assert.equal(adminReturnUrl('', 'http://127.0.0.1:3002/admin'),'http://127.0.0.1:3002/admin');
});
