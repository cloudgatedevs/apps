import test from 'node:test';
import assert from 'node:assert/strict';
import {THEME_PRESETS,THEME_KEYS,matchingPreset,brandSettings,themeTokens,readableText} from '../src/academy/branding-model.js';
const luminance=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
test('Each preset produces readable body and button text',()=>{
 for(const p of THEME_PRESETS){const t=themeTokens(p);assert.ok(contrast(t['--ink'],p.theme_background)>=4.5,p.name);assert.ok(contrast(readableText(p.theme_primary),p.theme_primary)>=4.5,p.name);assert.equal(matchingPreset(p)?.name,p.name);}
});
test('Each colour can be overridden independently without losing the others',()=>{
 for(const k of THEME_KEYS){const custom={...THEME_PRESETS[0],[k]:'#456789'};assert.equal(matchingPreset(custom),undefined);const saved=brandSettings(custom);for(const field of THEME_KEYS)assert.equal(saved[field],custom[field]);}
});
test('Invalid colours fall back safely and preset matching ignores case',()=>{
 assert.doesNotThrow(()=>themeTokens({theme_primary:'broken',theme_background:'#bad'}));assert.equal(matchingPreset({...THEME_PRESETS[0],theme_primary:THEME_PRESETS[0].theme_primary.toUpperCase()})?.name,'Midnight');
});
