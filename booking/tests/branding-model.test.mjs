import test from 'node:test';
import assert from 'node:assert/strict';
import { brandIdentity, imageUrl } from '../src/booking/branding-model.js';

test('identity preserves the business name and falls back after assets are removed', () => {
  assert.equal(brandIdentity({name:'Niel’s Nail Studio'}).name, 'Niel’s Nail Studio');
  const s = {name:'Business',app_name:'Bloom',app_short_name:'BL',logo_url:'/logo.png',icon_url:'/app.png',favicon_url:'/fav.ico',logo_show_name:'0'};
  assert.deepEqual(brandIdentity(s), {name:'Bloom',shortName:'BL',logo:'/logo.png',icon:'/app.png',favicon:'/fav.ico',showName:false});
  assert.equal(brandIdentity({...s,favicon_url:''}).favicon, '/app.png');
  assert.equal(brandIdentity({...s,logo_url:'',icon_url:'',favicon_url:''}).favicon, '/booking-icon.svg');
  assert.equal(brandIdentity({...s,logo_url:''}).showName,true);
});
test('image URLs reject unsafe schemes', () => {
  for (const value of ['javascript:alert(1)','data:image/svg+xml,test','//evil.test/img','/\\evil.test','https://user:pass@host/img','http://public.test/x','https://host/x y']) assert.equal(imageUrl(value), '');
  for (const value of ['/api/image.png','https://cdn.test/logo.png?size=512','http://127.0.0.1:3002/logo.png']) assert.equal(imageUrl(value), value);
});
