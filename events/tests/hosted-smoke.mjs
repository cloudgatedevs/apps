import assert from 'node:assert/strict';
const gateway=(process.env.EVENTS_GATEWAY||'http://events.localhost:44301').replace(/\/$/,'');
const project=process.env.EVENTS_PROJECT||'events';
async function post(slot,route,body={}) {
  return fetch(`${gateway}/${slot}/${project}/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
}
for(const slot of ['sbx','prod']) {
  const response=await post(slot,'catalog',{op:'catalog'});
  assert.equal(response.status,200,`${slot} catalog is public`);
  const body=await response.json();
  assert.ok(Array.isArray(body.events),`${slot} catalog contains events`);
  console.log(`${slot}: public catalog OK (${body.events.length} events)`);
  for(const route of ['workspace','events','orders','checkout','payment-status','refund','waitlist','checkin','staff','settings']) {
    const r=await post(slot,route,{op:'workspace'});
    assert.ok([401,403].includes(r.status),`${slot}/${route} must require authentication; got ${r.status}`);
  }
  for(const route of ['reconcile','refund-reconcile','notifications']) {
    const r=await post(slot,route);
    assert.ok([400,401,403].includes(r.status),`${slot}/${route} must reject external calls; got ${r.status}`);
  }
  console.log(`${slot}: 10 protected routes and 3 scheduler guards OK`);
}
console.log('Hosted read-only checks passed. No payments, email, or database writes requested.');
