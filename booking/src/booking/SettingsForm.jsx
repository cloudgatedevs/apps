import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Button, ErrorBox, Field } from './ui';
import BrandingEditor, { Asset } from './BrandingEditor';
import { BRAND_DEFAULTS, imageUrl } from './branding-model';

const groups = [
  ['Your business', [['name','Business name'],['tagline','Tagline'],['description','About your business'],['address','Address'],['phone','Phone'],['email','Contact email'],['website_url','Live website URL']]],
  ['Booking rules', [['timezone','IANA timezone'],['currency','Currency code'],['lead_minutes','Minimum notice (minutes)'],['horizon_days','Book ahead (days)'],['cancel_hours','Cancellation cutoff (hours)'],['hold_minutes','Payment hold (minutes)'],['slot_minutes','Time slot interval (minutes)'],['reminder_hours','Reminder before visit (hours)'],['cancellation_policy','Cancellation policy']]],
  ['Outgoing email', [['smtp_host','SMTP host'],['smtp_port','SMTP port'],['smtp_user','SMTP username'],['smtp_password','SMTP password (blank keeps existing)'],['smtp_from','From email'],['smtp_mode','Security: starttls or ssl']]]
];
export default function SettingsForm({ data, save, busy }) {
  const [value, setValue] = useState(() => ({ ...BRAND_DEFAULTS, hero_image_url:'', about_image_url:'', hero_kicker:'BOOK ONLINE', hero_title:'Book your next appointment.', hero_subtitle:'Choose a service. Find a time that works for you.', services_title:'Explore our services.', services_intro:'Browse services, compare options and book your preferred time.', ...data, smtp_password: '' })), [error, setError] = useState('');
  const change = (key, next) => setValue(previous => ({ ...previous, [key]: next }));
  const submit = async e => {
    e.preventDefault(); setError('');
    try {
      for (const key of ['logo_url','icon_url','favicon_url','hero_image_url','about_image_url']) if (value[key].trim() && !imageUrl(value[key])) throw new Error('Use an HTTPS image URL or a path starting with /.');
      const keys = [...Object.keys(BRAND_DEFAULTS), 'hero_image_url','about_image_url','hero_kicker','hero_title','hero_subtitle','services_title','services_intro', ...groups.flatMap(([,fields]) => fields.map(([key]) => key))];
      await save(Object.fromEntries(keys.map(key => [key, value[key] ?? '']))); change('smtp_password', '');
    } catch (err) { setError(err); }
  };
  const group = ([title, fields]) => <section className="panel settings-group" key={title}><h3>{title}</h3><div className="form-grid">{fields.map(([key,label]) => <Field key={key} label={label}>{['description','cancellation_policy'].includes(key) ? <textarea name={key} value={value[key] || ''} onChange={e => change(key, e.target.value)}/> : <input name={key} required={key==='name'} maxLength={key==='name'?120:undefined} type={key==='smtp_password'?'password':'text'} value={value[key] || ''} onChange={e => change(key, e.target.value)} autoComplete={key==='smtp_password'?'new-password':undefined}/>}</Field>)}</div></section>;
  return <form onSubmit={submit}>
    <section className="panel settings-group homepage-settings" aria-label="Homepage settings">
      <div className="panel-heading"><h3>Homepage</h3><a className="text-link" href="/" target="_blank" rel="noreferrer">Open homepage <ArrowUpRight size={15}/></a></div>
      <div className="homepage-background"><Asset label="Homepage background image" hint="The large image behind your booking heading and search bar. Upload a wide photo, crop it to fit, or choose one from your media library." value={value.hero_image_url} change={v=>change('hero_image_url',v)} aspect={3} path="booking/branding"/></div>
      <div className="homepage-save"><p className="muted">Save to show this image on your homepage. Remove it to use your theme background.</p><Button busy={busy}>Save changes</Button></div>
      <ErrorBox error={error}/>
      <details className="homepage-other-settings"><summary>Homepage text and about photo</summary><div className="form-grid">{[['hero_kicker','Banner label'],['hero_title','Banner heading'],['hero_subtitle','Banner description'],['services_title','Services heading'],['services_intro','Services introduction']].map(([key,label])=><Field key={key} label={label}><input value={value[key]} maxLength={key==='hero_title'?90:200} onChange={e=>change(key,e.target.value)}/></Field>)}</div><Asset label="About photo" hint="The image in your About section further down the homepage." value={value.about_image_url} change={v=>change('about_image_url',v)} aspect={1.5} path="booking/branding"/></details>
    </section>
    {group(groups[0])}<BrandingEditor value={value} change={change}/>{groups.slice(1).map(group)}<ErrorBox error={error}/><Button busy={busy}>Save business settings</Button>
  </form>;
}
