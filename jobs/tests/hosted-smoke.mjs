import assert from 'node:assert/strict';
const gateway=(process.env.JOBS_GATEWAY||'http://jobs.localhost:44301').replace(/\/$/,'');
const project=process.env.JOBS_PROJECT||'jobs';
async function post(slot,route,body={}) {
  return fetch(`${gateway}/${slot}/${project}/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
}
for(const slot of ['sbx','prod']) {
  const response=await post(slot,'catalog',{op:'catalog'});
  assert.equal(response.status,200,`${slot} catalog is public`);
  const body=await response.json();
  assert.ok(Array.isArray(body.services),`${slot} catalog contains services`);
  console.log(`${slot}: public catalog OK (${body.services.length} services)`);
  for(const route of ['workspace','jobs','requests','quotes','checkout','payment-status','refund','invoices','attachments','documents','settings']) {
    const r=await post(slot,route,{op:'workspace'});
    assert.ok([401,403].includes(r.status),`${slot}/${route} must require authentication; got ${r.status}`);
  }
  for(const route of ['automation','reconcile','refund-reconcile','notifications']) {
    const r=await post(slot,route);
    assert.ok([400,401,403].includes(r.status),`${slot}/${route} must reject external calls; got ${r.status}`);
  }
  console.log(`${slot}: 11 protected routes and 4 scheduler guards OK`);
}
console.log('Hosted read-only checks passed. No payments, email, or database writes requested.');
