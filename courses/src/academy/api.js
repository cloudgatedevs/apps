import {api} from '../shared/services/api';
export const preview=import.meta.env.DEV&&import.meta.env.MODE==='preview';
export const previewRole=()=>sessionStorage.getItem('courses.preview.role')||'';
const routes={'catalog':'catalog','preview-lesson':'catalog','certificate-verify':'catalog','workspace':'workspace','admin-data':'workspace','enroll':'enrollments','enrollment-status':'enrollments','learn':'learning','lesson-complete':'learning','quiz-submit':'learning','discussion-post':'learning','discussion-moderate':'learning','session-save':'sessions','attendance-save':'sessions','settings':'settings'};
export async function call(op,data={},admin=false,route){
 route=route||routes[op]||'courses';if(!preview)return api.post('/'+route,{...data,op});
 const r=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Academy-Preview':'1','X-Preview-Role':previewRole()},body:JSON.stringify({...data,op})});const value=await r.json();if(!r.ok||value.error)throw new Error(value.error||'Request failed.');return value;
}
export const money=(n,currency='USD')=>new Intl.NumberFormat('en',{style:'currency',currency}).format((n||0)/100);
export const dateLabel=(n,timezone='UTC')=>new Date(n*1000).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:timezone});
export function csv(rows,name){if(!rows.length)return;const keys=Object.keys(rows[0]);const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';const blob=new Blob([[keys,...rows.map(r=>keys.map(k=>r[k]))].map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name+'.csv';a.click();URL.revokeObjectURL(url);}
