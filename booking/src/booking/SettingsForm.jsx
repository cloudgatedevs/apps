import React, { useState } from 'react';
import { Button, ErrorBox, Field } from './ui';
import BrandingEditor from './BrandingEditor';
import { BRAND_DEFAULTS, imageUrl } from './branding-model';

const groups = [
  ['Your studio', [['name','Business name'],['tagline','Tagline'],['description','About your studio'],['address','Address'],['phone','Phone'],['email','Contact email'],['website_url','Live website URL']]],
  ['Booking rules', [['timezone','IANA timezone'],['currency','Currency code'],['lead_minutes','Minimum notice (minutes)'],['horizon_days','Book ahead (days)'],['cancel_hours','Cancellation cutoff (hours)'],['hold_minutes','Payment hold (minutes)'],['slot_minutes','Time slot interval (minutes)'],['reminder_hours','Reminder before visit (hours)'],['cancellation_policy','Cancellation policy']]],
  ['Outgoing email', [['smtp_host','SMTP host'],['smtp_port','SMTP port'],['smtp_user','SMTP username'],['smtp_password','SMTP password (blank keeps existing)'],['smtp_from','From email'],['smtp_mode','Security: starttls or ssl']]]
];
export default function SettingsForm({ data, save, busy }) {
  const [value, setValue] = useState(() => ({ ...BRAND_DEFAULTS, ...data, smtp_password: '' })), [error, setError] = useState('');
  const change = (key, next) => setValue(previous => ({ ...previous, [key]: next }));
  const submit = async e => {
    e.preventDefault(); setError('');
    try {
      for (const key of ['logo_url','icon_url','favicon_url']) if (value[key].trim() && !imageUrl(value[key])) throw new Error('Use an HTTPS image URL or a path starting with /.');
      const keys = [...Object.keys(BRAND_DEFAULTS), ...groups.flatMap(([,fields]) => fields.map(([key]) => key))];
      await save(Object.fromEntries(keys.map(key => [key, value[key] ?? '']))); change('smtp_password', '');
    } catch (err) { setError(err); }
  };
  const group = ([title, fields]) => <section className="panel settings-group" key={title}><h3>{title}</h3><div className="form-grid">{fields.map(([key,label]) => <Field key={key} label={label}>{['description','cancellation_policy'].includes(key) ? <textarea name={key} value={value[key] || ''} onChange={e => change(key, e.target.value)}/> : <input name={key} required={key==='name'} maxLength={key==='name'?120:undefined} type={key==='smtp_password'?'password':'text'} value={value[key] || ''} onChange={e => change(key, e.target.value)} autoComplete={key==='smtp_password'?'new-password':undefined}/>}</Field>)}</div></section>;
  return <form onSubmit={submit}>{group(groups[0])}<BrandingEditor value={value} change={change}/>{groups.slice(1).map(group)}<ErrorBox error={error}/><Button busy={busy}>Save studio settings</Button></form>;
}
