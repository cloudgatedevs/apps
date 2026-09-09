import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Copy, Plus } from 'lucide-react';
import { call, dateLabel, money, preview } from './api';
import { Button, Field, ErrorBox, Modal, Badge } from './ui';
import { SlotPicker } from './SlotPicker';
import { useQuote, PriceReview } from './pricing';

const storageKey = 'studio.frontdesk.pending';
function pendingRequest() {
  try { return JSON.parse(sessionStorage.getItem(storageKey) || 'null'); }
  catch { return null; }
}

export default function FrontDeskBooking({ data, close, refresh }) {
  const catalog = useMemo(() => ({ settings: data.settings,
    services: data.services.filter(s => s.active && !s.deleted),
    staff: data.staff.filter(s => s.active).map(s => ({ ...s, service_ids: JSON.parse(s.service_ids) })) }), [data]);
  const [pending, setPending] = useState(pendingRequest);
  const [ids, setIds] = useState([]), [staffId, setStaffId] = useState(0), [slot, setSlot] = useState(null);
  const [clientId, setClientId] = useState(''), [client, setClient] = useState({ name: '', email: '', phone: '' });
  const [query, setQuery] = useState(''), [promo, setPromo] = useState(''), [notes, setNotes] = useState('');
  const [step, setStep] = useState(0), [held, setHeld] = useState(null), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [copied, setCopied] = useState(false);
  const pricing = useQuote(ids, promo);
  const customers = data.customers.filter(c => (c.name + ' ' + c.email).toLowerCase().includes(query.toLowerCase()));
  const selectClient = id => {
    setClientId(id);
    const c = data.customers.find(c => String(c.Id) === id);
    setClient(c ? { name: c.name, email: c.email, phone: c.phone || '' } : { name: '', email: '', phone: '' });
  };
  const create = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const request = pending || { ...client, service_ids: ids, staff_id: slot.staff_id, starts: slot.starts,
        promo, notes, quote: pricing.quote, consent: true, marketing: false,
        token: crypto.randomUUID() + crypto.randomUUID(), request_key: crypto.randomUUID() };
      // Save before the request so a lost response can only retry the same intent.
      sessionStorage.setItem(storageKey, JSON.stringify(request)); setPending(request);
      const result = await call('admin-hold', request, true);
      setHeld(result); await refresh();
    } catch (err) { setError(err); }
    finally { setBusy(false); }
  };
  const finish = () => { sessionStorage.removeItem(storageKey); close(); };
  const base = preview ? window.location.origin : data.settings.website_url?.replace(/\/$/, '');
  const link = held && pending && base ? `${base}/appointments?ref=${encodeURIComponent(held.reference)}#token=${encodeURIComponent(pending.token)}` : '';
  return <Modal title="Book an appointment for a client" wide close={busy ? () => {} : close}>
    {held ? <div className="frontdesk-result">
      <Badge>{held.status}</Badge><h3>{held.customer.name} · {held.reference}</h3>
      <p>{dateLabel(held.starts, data.settings.timezone)}</p>
      <PriceReview pricing={pricing} held={held}/>
      <p>Payment is required to confirm. This reservation expires at <strong>{dateLabel(held.expires, data.settings.timezone)}</strong>.</p>
      {link ? <><Field label="Private booking and payment link" hint="Share this only with the client. It also lets them manage their appointment."><input readOnly value={link}/></Field>
        <div className="actions"><Button onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError('Select and copy the private link above.'); } }}><Copy size={16}/>{copied ? 'Link copied' : 'Copy private link'}</Button>
          <a className="button secondary" href={link} target="_blank" rel="noreferrer">Open booking <ArrowUpRight size={16}/></a></div></> : <ErrorBox error="Set the live website URL in Settings to create a shareable payment link."/>}
      {preview && <p className="muted">This local link works on this computer only and uses test payments.</p>}
      <ErrorBox error={error}/><Button secondary onClick={finish}>Done</Button>
    </div> : pending ? <form onSubmit={create}>
      <h3>Recover this reservation</h3><p>A reservation was submitted for {pending.name}. Check its result before creating another booking.</p>
      <p>{dateLabel(pending.starts, data.settings.timezone)} · {money(pending.quote?.due, data.settings.currency)} due to confirm</p>
      <ErrorBox error={error}/><Button busy={busy}>Check reservation result</Button>
      <p className="muted">This reuses the original request and cannot create a second reservation.</p>
      <Button type="button" secondary disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try {
          await call('admin-abandon-hold', { request_key: pending.request_key }, true);
          sessionStorage.removeItem(storageKey); setPending(null); await refresh();
        } catch (err) { setError(err); }
        finally { setBusy(false); }
      }}>Resolve and release reservation</Button>
    </form> : <>
      <div className="tabs" aria-label="New booking steps">{['Client & services', 'Time & team member', 'Review & payment link'].map((label, i) =>
        <button key={label} disabled={i > step || busy} className={i === step ? 'active' : ''} onClick={() => setStep(i)}>{label}</button>)}</div>
      {step === 0 ? <form onSubmit={e => { e.preventDefault(); setStep(1); }}>
        <div className="form-grid"><Field label="Search existing clients"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or email"/></Field>
          <Field label="Client"><select value={clientId} onChange={e => selectClient(e.target.value)}><option value="">New client</option>{customers.map(c => <option key={c.Id} value={c.Id}>{c.name} · {c.email}</option>)}</select></Field></div>
        <div className="form-grid">{[['name', 'Client name', 'text'], ['email', 'Client email', 'email'], ['phone', 'Client phone', 'tel']].map(([key, label, type]) =>
          <Field key={key} label={label}><input type={type} required value={client[key]} minLength={key === 'name' ? 2 : undefined} onChange={e => setClient({ ...client, [key]: e.target.value })}/></Field>)}</div>
        <h3>Services</h3><p className="muted">Up to four services with one qualified team member.</p>
        <div className="checkbox-grid">{catalog.services.map(s => <label className="checkbox" key={s.Id}><input type="checkbox" checked={ids.includes(s.Id)} disabled={!ids.includes(s.Id) && ids.length >= 4} onChange={e => { setIds(e.target.checked ? [...ids, s.Id] : ids.filter(id => id !== s.Id)); setSlot(null); setStaffId(0); }}/>{s.name} · {money(s.price, data.settings.currency)}</label>)}</div>
        <Button disabled={!ids.length}>Choose a time</Button>
      </form> : step === 1 ? <><SlotPicker catalog={catalog} ids={ids} staffId={staffId} setStaffId={setStaffId} slot={slot} setSlot={setSlot}/><Button disabled={!slot} onClick={() => setStep(2)}>Review reservation</Button></> :
        <form onSubmit={create}><h3>{client.name}</h3><p>{client.email} · {client.phone}</p><p>{dateLabel(slot.starts, data.settings.timezone)} with {slot.staff_name}</p>
          <Field label="Promotion code"><input value={promo} onChange={e => setPromo(e.target.value)}/></Field><PriceReview pricing={pricing}/>
          <Field label="Appointment notes"><textarea value={notes} maxLength={2000} onChange={e => setNotes(e.target.value)}/></Field>
          <p className="muted">{data.settings.cancellation_policy}</p>
          <label className="checkbox"><input type="checkbox" required/> The client agreed to the booking and cancellation policy.</label>
          <p>Reserve this time for {data.settings.hold_minutes} minutes and share the private payment link. The appointment is confirmed after successful payment.</p>
          <ErrorBox error={error}/><Button busy={busy} disabled={!pricing.quote || pricing.loading || !!pricing.error || (!preview && !base)}><Plus size={16}/> Create reservation & payment link</Button>
          {!preview && !base && <ErrorBox error="Configure your live website URL in Settings first."/>}
        </form>}
    </>}
  </Modal>;
}
