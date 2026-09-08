import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customerReturnUrl, accountDestination, signupUrl } from '../src/booking/customer-auth-model.js';
test('customer auth callback has no fragment or previous credentials', () => {
 assert.equal(customerReturnUrl('http://localhost:3002/admin#settings','http://127.0.0.1:3002/'), 'http://localhost:3002/account/callback');
 assert.equal(customerReturnUrl('', 'https://studio.example/book?access_token=secret#token=private'), 'https://studio.example/account/callback');
});
test('only safe customer destinations survive the login round trip', () => {
 for (const bad of ['https://evil.example/book','//evil.example/account','/admin','javascript:alert(1)',null]) assert.equal(accountDestination(bad),'/account');
 assert.equal(accountDestination('/appointments?ref=ST-123&token=secret#token=private'),'/appointments?ref=ST-123');
 assert.equal(accountDestination('/book?service=2'),'/book?service=2');
});
test('signup uses hosted tenant route and preserves validated callback request', () => {
 const url=new URL(signupUrl('http://localhost:5173/idp/booking/login?returnUrl=http%3A%2F%2Flocalhost%3A3002%2Faccount%2Fcallback'));
 assert.equal(url.pathname,'/idp/booking/signup');
 assert.equal(url.searchParams.get('returnUrl'),'http://localhost:3002/account/callback');
 assert.throws(()=>signupUrl('https://idp.example/unexpected'));
});
