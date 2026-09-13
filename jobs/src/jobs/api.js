import { api } from '../shared/services/api';
export const preview=import.meta.env.DEV&&(import.meta.env.MODE==='preview'||!import.meta.env.VITE_CLOUDGATE_API_URL);
export const previewRole=()=>sessionStorage.getItem('jobs.preview.role')||'';
const routes={catalog:'catalog',workspace:'workspace','admin-data':'workspace',settings:'settings','quote-preview':'quotes','quote-save':'quotes','quote-send':'quotes','quote-accept':'quotes','quote-decline':'quotes','document':'documents','attachment-add':'attachments','attachment-read':'attachments','attachment-visibility':'attachments'};
export async function call(op,data={},admin=false,route){
  route=route||routes[op]||(op.startsWith('invoice')?'invoices':op.startsWith('request')?'requests':'jobs');
  let result;
  if(!preview)result=await api.post('/'+route,{...data,op});
  else{const response=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Jobs-Preview':'1','X-Preview-Role':previewRole()},body:JSON.stringify({...data,op})});result=await response.json();if(!response.ok)throw new Error(result.error||'Request failed.');}
  if(result?.error)throw new Error(result.error);return result;
}
export const money=(n,currency='ZAR')=>new Intl.NumberFormat('en-ZA',{style:'currency',currency}).format((n||0)/100);
export const dateLabel=(n,tz='Africa/Johannesburg',opts={})=>new Intl.DateTimeFormat('en-GB',{timeZone:tz,day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',...opts}).format(new Date(n*1000));
export function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function csv(rows,name){if(!rows.length)return;const keys=Object.keys(rows[0]);const safe=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';download(new Blob(['\ufeff'+[keys,...rows.map(r=>keys.map(k=>r[k]))].map(r=>r.map(safe).join(',')).join('\r\n')],{type:'text/csv'}),name+'.csv');}
