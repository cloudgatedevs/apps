import { cloudgate, workflow, preview } from './platform';
export { preview } from './platform';
export const previewRole=()=>sessionStorage.getItem('events.preview.role')||'';
const routes={catalog:'catalog',workspace:'workspace',reserve:'orders','order-cancel':'orders','waitlist-join':'waitlist','waitlist-notify':'waitlist','check-in':'checkin','check-in-undo':'checkin','staff-save':'staff',settings:'settings'};
export async function call(op,data={},admin=false,route){
 route=route||routes[op]||'events';if(!preview){
  if(!workflow)throw new Error('Configure the Events workflow gateway before connecting.');
  try{return await workflow.post('/'+route,{...data,op});}
  catch(error){if(error.status===401&&cloudgate.auth.enabled&&await cloudgate.auth.refresh())return workflow.post('/'+route,{...data,op});throw error;}
 }
 const r=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Events-Preview':'1','X-Preview-Role':previewRole()},body:JSON.stringify({...data,op})});const value=await r.json();if(!r.ok||value.error)throw new Error(value.error||'Request failed.');return value;
}
export const money=(n,currency='USD')=>new Intl.NumberFormat('en',{style:'currency',currency}).format((n||0)/100);
export const dateLabel=(n,timezone='UTC')=>new Date(n*1000).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:timezone})+' '+timezone;
export function csv(rows,name){if(!rows.length)return;const keys=Object.keys(rows[0]);const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';const blob=new Blob([[keys,...rows.map(r=>keys.map(k=>r[k]))].map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name+'.csv';a.click();URL.revokeObjectURL(url);}
