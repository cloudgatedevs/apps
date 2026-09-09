import test from 'node:test';
import assert from 'node:assert/strict';
import { brandIdentity, brandSettings, imageUrl, readableText, themeTokens } from '../src/booking/branding-model.js';

test('identity preserves the business name and falls back after assets are removed', () => {
  assert.equal(brandIdentity({name:'Niel’s Nail Studio'}).name, 'Niel’s Nail Studio');
  const s = {name:'Business',app_name:'Bloom',app_short_name:'BL',logo_url:'/logo.png',icon_url:'/app.png',favicon_url:'/fav.ico',logo_show_name:'0'};
  assert.deepEqual(brandIdentity(s), {name:'Bloom',shortName:'BL',logo:'/logo.png',icon:'/app.png',favicon:'/fav.ico',showName:false});
  assert.equal(brandIdentity({...s,favicon_url:''}).favicon, '/app.png');
  assert.equal(brandIdentity({...s,logo_url:'',icon_url:'',favicon_url:''}).favicon, '/booking-icon.svg');
  assert.equal(brandIdentity({...s,logo_url:''}).showName,true);
});
test('public cache excludes credentials and image URLs reject unsafe schemes', () => {
  for (const value of ['javascript:alert(1)','data:image/svg+xml,test','//evil.test/img','/\\evil.test','https://user:pass@host/img','http://public.test/x','https://host/x y']) assert.equal(imageUrl(value), '');
  for (const value of ['/api/image.png','https://cdn.test/logo.png?size=512','http://127.0.0.1:3002/logo.png']) assert.equal(imageUrl(value), value);
  const cached = brandSettings({smtp_password:'secret',_revision:'12',theme_primary:'red'});
  assert.equal(cached.smtp_password,undefined); assert.equal(cached._revision,undefined); assert.equal(cached.theme_primary,'#000000');
});
const luminance = hex => {
  const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
};
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
test('arbitrary palettes keep primary labels and body text at WCAG AA contrast', () => {
  for (let r=0;r<256;r+=17) for(let g=0;g<256;g+=17) for(let b=0;b<256;b+=17) {
    const hex='#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
    assert.ok(contrast(hex,readableText(hex))>=4.5,hex);
    assert.ok(contrast(hex,themeTokens({theme_background:hex})['--ink'])>=4.5,hex);
  }
});
