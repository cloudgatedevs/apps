import React, { useState } from 'react';
import { Search, Pencil, Trash2 } from 'lucide-react';
import { Button, Badge, Empty } from './ui';
import { money } from './api';
import ServicePhoto from './ServicePhoto';

export default function ServicesPanel({ data, edit }) {
  const [query,setQuery]=useState(''),[category,setCategory]=useState(''),[status,setStatus]=useState('');
  const all=data.services.filter(s=>!s.deleted), categories=[...new Set(all.map(s=>s.category))];
  const services=all.filter(s=>(!category||s.category===category)&&(!status||Boolean(s.active)===(status==='published'))&&`${s.name} ${s.category} ${s.description}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className="service-toolbar"><label className="search-box"><Search size={17}/><input aria-label="Search services" placeholder="Search services…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter category" value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select><select aria-label="Filter service status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option><option value="published">Published</option><option value="hidden">Hidden</option></select></div><div className="admin-card-grid">{services.map(service=>{
    const people=data.staff.filter(p=>p.active&&JSON.parse(p.service_ids).includes(service.Id));
    return <article className="panel service-admin-card" key={service.Id}><ServicePhoto service={service}/><div className="service-admin-body"><div className="service-card-label"><span>{service.category}</span><Badge>{service.active?'Published':'Hidden'}</Badge></div><h3>{service.name}</h3><p>{service.description||'No description yet.'}</p><div className="summary-line"><span>{service.duration} min{service.buffer>0&&` + ${service.buffer} min buffer`}</span><strong>{money(service.price,data.settings.currency)}</strong></div><small>{service.deposit_percent}% payment to confirm · {people.length} team {people.length===1?'member':'members'}</small>{!people.length&&<p className="service-warning">Assign an active team member to offer bookable times.</p>}<div className="actions"><Button secondary onClick={()=>edit(service)}><Pencil size={14}/> Edit service</Button><button type="button" className="icon-button danger-link" aria-label={'Delete '+service.name} onClick={()=>edit(service,true)}><Trash2 size={17}/></button></div></div></article>;
  })}</div>{!services.length&&<Empty title={all.length?'No matching services':'Create your first service'}>{all.length?'Try another search or filter.':'Add a consultation, lesson, repair, appointment or another service your business offers.'}</Empty>}</>;
}
