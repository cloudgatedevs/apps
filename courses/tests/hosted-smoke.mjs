import assert from 'node:assert/strict';
import {loadEnv} from 'vite';
import {createCloudgateClient} from '@cloudgatedevs/cloudgate-client';
const env=loadEnv('development',process.cwd(),'VITE_');
assert.equal(env.VITE_CLOUDGATE_API_ENV,'sbx','Smoke tests must target sandbox.');
const client=createCloudgateClient({baseUrl:`${env.VITE_CLOUDGATE_API_URL}/sbx/${env.VITE_CLOUDGATE_API_PROJECT}`,apiKey:env.VITE_API_KEY,apiSecret:env.VITE_API_SECRET,timeoutMs:20000});
const catalog=await client.post('/catalog',{op:'catalog'});
assert.ok(catalog.courses.length>=3);
for(const c of catalog.courses) for(const l of c.lessons){assert.equal(l.questions,undefined);assert.equal(l.body,undefined);}
const course=catalog.courses.find(c=>c.lessons.some(l=>l.preview));
const lesson=course.lessons.find(l=>l.preview);
const preview=await client.post('/catalog',{op:'preview-lesson',course:course.ref,lesson:lesson.ref});
assert.ok(preview.body);
for(const route of ['workspace','courses','enrollments','learning','sessions','settings','checkout','payment-status','refund']){
 let denied=false;try{await client.post('/'+route,{op:'admin-data'});}catch(e){denied=true;assert.equal(e.status,401,route+' should require authentication');}
 assert.ok(denied,route+' accepted anonymous access');
}
for(const route of ['reconcile','refund-reconcile','notifications']){
 let denied=false;try{await client.post('/'+route,{});}catch(e){denied=true;assert.notEqual(e.status,404,route+' is not deployed');}
 assert.ok(denied,route+' accepted a public worker call');
}
console.log('PASS: sandbox catalogue, lesson preview, 9 protected routes and 3 scheduler-only routes.');
