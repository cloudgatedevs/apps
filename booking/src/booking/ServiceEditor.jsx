import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Field, ErrorBox, Modal } from './ui';
import { Asset } from './BrandingEditor';
import { imageUrl } from './branding-model';
import './services.css';

export default function ServiceEditor({ record, data, close, save, remove, busy, initialDelete = false }) {
  const [value, setValue] = useState(() => ({ name:'', category:'', description:'', duration:60, buffer:0, price:0, deposit_percent:100, resource_type:'', active:1, color:'#d4ddce', intake:'', image_url:'', ...record,
    staff_ids:data.staff.filter(p => JSON.parse(p.service_ids).includes(record.Id)).map(p => p.Id) }));
  const [price, setPrice] = useState(record.Id ? String(record.price / 100) : '');
  const [customCategory, setCustomCategory] = useState(false);
  const [error, setError] = useState(''), [deleting, setDeleting] = useState(initialDelete);
  const change = (key, next) => setValue(old => ({ ...old, [key]:next }));
  const categories = [...new Set([...data.services.filter(s => !s.deleted).map(s => s.category), record.category].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const number = (key, label, min, max) => <Field label={label}><input name={key} type="number" min={min} max={max} step="1" value={value[key]} required onChange={e => change(key, e.target.value === '' ? '' : Number(e.target.value))}/></Field>;
  const upcoming = data.bookings.filter(b => ['held','confirmed','arrived','payment_review'].includes(b.status) && b.items.some(i => i.service_id === record.Id)).length;
  const submit = async e => {
    e.preventDefault(); setError('');
    try {
      if (value.image_url.trim() && !imageUrl(value.image_url)) throw new Error('Use an HTTPS image URL or a path starting with /.');
      const amount = Math.round(Number(price) * 100);
      if (!Number.isFinite(amount) || amount < 1) throw new Error('Enter a price greater than zero.');
      await save({ ...value, price:amount });
    } catch (err) { setError(err); }
  };
  return <Modal title={record.Id ? 'Edit service' : 'Add service'} wide close={() => { if (!busy) close(); }}>
    {deleting ? <div><p>Delete <strong>{record.name}</strong> from your service catalog?</p><p>Customers will no longer be able to book this service. Existing appointments, payments and reporting history are kept. The uploaded photo stays in your media library.</p>{upcoming > 0 && <p>{upcoming} existing {upcoming === 1 ? 'appointment will' : 'appointments will'} remain scheduled.</p>}<ErrorBox error={error}/><div className="actions"><Button className="danger-button" busy={busy} onClick={async () => { setError(''); try { await remove(record.Id); } catch (err) { setError(err); } }}><Trash2 size={16}/> Delete service</Button><Button secondary disabled={busy} onClick={() => { setDeleting(false); setError(''); }}>Keep service</Button></div></div> : <form onSubmit={submit}>
      <p className="muted">Create any appointment-based service, such as a consultation, lesson, repair or personal care appointment.</p>
      <div className="form-grid"><Field label="Service name"><input name="name" value={value.name} required minLength={2} maxLength={120} placeholder="e.g. Initial consultation" onChange={e => change('name', e.target.value)}/></Field><Field label="Category" hint="Choose a category or add a new one."><select name="category_choice" value={customCategory ? 'new' : value.category ? 'category:' + value.category : ''} required onChange={e => { const adding = e.target.value === 'new'; setCustomCategory(adding); change('category', adding ? '' : e.target.value.slice('category:'.length)); }}><option value="" disabled>Select a category</option>{categories.map(c => <option key={c} value={'category:' + c}>{c}</option>)}<option value="new">Add new category…</option></select></Field>{customCategory && <Field label="New category"><input name="category" value={value.category} required maxLength={80} placeholder="e.g. Consulting, Lessons, Repairs" autoFocus onChange={e => change('category', e.target.value)}/></Field>}</div>
      <Field label="Description"><textarea name="description" value={value.description} maxLength={3000} placeholder="Explain what is included and what customers can expect." onChange={e => change('description', e.target.value)}/></Field>
      <Asset label="Service photo" hint="Upload, crop or reuse a photo from your library. It appears in the catalog and booking page." value={value.image_url} change={url => change('image_url', url)} aspect={1.5} path="booking/services"/>
      <h3 className="spaced">Pricing & timing</h3><div className="form-grid"><Field label={'Price (' + data.settings.currency + ')'} hint="Enter the full service price in currency units."><input name="price" type="number" min="0.01" max="1000000" step="0.01" value={price} required onChange={e => setPrice(e.target.value)}/></Field>{number('deposit_percent','Payment to confirm (%)',1,100)}{number('duration','Duration (minutes)',5,480)}{number('buffer','Buffer after appointment (minutes)',0,120)}<Field label="Required resource" hint="Optional room, workstation, equipment or vehicle. Create resource types under Rooms & resources."><select name="resource_type" value={value.resource_type} onChange={e => change('resource_type',e.target.value)}><option value="">No resource required</option>{[...new Set(data.resources.map(r => r.type))].map(t => <option key={t}>{t}</option>)}</select></Field><Field label="Service colour"><input type="color" value={value.color} onChange={e => change('color',e.target.value)}/></Field></div>
      <h3>Team members</h3><p className="muted">Choose who can deliver this service. Their working hours determine available times.</p><div className="checkbox-grid">{data.staff.map(p => <label className="checkbox" key={p.Id}><input type="checkbox" checked={value.staff_ids.includes(p.Id)} onChange={e => change('staff_ids', e.target.checked ? [...value.staff_ids,p.Id] : value.staff_ids.filter(id => id !== p.Id))}/>{p.name}{!p.active && ' (inactive)'}</label>)}</div>{!data.staff.length && <p className="muted">Add a team member under Team & hours. You can save this service as hidden until then.</p>}
      <Field label="Question before booking (optional)" hint="For example, ask about the project, vehicle, learning goals or preparation."><textarea name="intake" value={value.intake} maxLength={1000} onChange={e => change('intake',e.target.value)}/></Field>
      <label className="checkbox"><input type="checkbox" checked={!!value.active} onChange={e => change('active',Number(e.target.checked))}/> Published and available for new bookings</label><p className="muted">Hide a service to pause new bookings temporarily. Changes apply to new bookings; existing appointments keep their booked price and duration.</p>
      <ErrorBox error={error}/><div className="service-editor-actions"><Button busy={busy}>Save service</Button><Button type="button" secondary disabled={busy} onClick={close}>Cancel</Button>{record.Id && <button type="button" className="text-link danger-link" disabled={busy} onClick={() => { setDeleting(true); setError(''); }}><Trash2 size={16}/> Delete service</button>}</div>
    </form>}
  </Modal>;
}
