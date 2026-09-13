import {SmtpSettings} from '@/shared/CloudgateSmtpSettings';
import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/admin/services/adminApi';
import { announceSettingsChanged } from '@/admin/services/storeBrand';
import { useAsync, ErrorNote, PageHead, Img } from '@/shared/ui/ui';
import { SkeletonForm } from '@/shared/ui/skeleton';
import { Field, Notice } from '@/shared/ui/forms';
import { ImageUploader } from '@/shared/ui/ImageUploader';
import { MediaPicker } from '@/shared/ui/MediaPicker';
import { fromCents, toCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { useAuthContext } from '@/shared/auth';


const icon = (paths) => (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>{paths}</svg>
);
const IconStore = icon(<><path d="M3 9l1.5-5h15L21 9" /><path d="M3 9h18v3a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9z" /><path d="M5 14v6h14v-6" /></>);
const IconContact = icon(<><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>);
const IconStorefront = icon(<><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18M8 22h8" /></>);
const IconMoney = icon(<><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M7 12h.01M17 12h.01" /></>);
const IconShipping = icon(<><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>);
const IconMail = icon(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>);
const IconCheckout = icon(<><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h5" /></>);

const TABS = [
  { key: 'store', label: 'Store', icon: IconStore, hint: 'Identity: name, tagline, description, logo, icon and public address.', fields: ['store_name', 'store_tagline', 'store_description', 'store_logo_url', 'store_icon_url', 'store_url'] },
  { key: 'contact', label: 'Contact', icon: IconContact, hint: 'How customers reach you: email, phone, address, hours and social links. Shown in the footer, on the Contact page and on any page with the contact block enabled.', fields: ['support_email', 'contact_phone', 'contact_hours', 'contact_address', 'social_instagram', 'social_facebook', 'social_x', 'social_tiktok'] },
  { key: 'storefront', label: 'Storefront', icon: IconStorefront, hint: 'Theme colours, announcement bar, cookie notice and the footer line.', fields: ['theme_primary', 'theme_secondary', 'announcement_text', 'announcement_url', 'cookie_consent_enabled', 'cookie_consent_text', 'footer_note'] },
  { key: 'money', label: 'Money', icon: IconMoney, hint: 'Currency and tax.', fields: ['currency', 'tax_rate', 'prices_include_tax'] },
  { key: 'shipping', label: 'Shipping', icon: IconShipping, hint: 'What customers pay for delivery.', fields: ['shipping_flat', 'free_shipping_threshold'] },
  { key: 'email', label: 'Email', icon: IconMail, hint: 'Cloudgate delivery with optional custom SMTP.', fields: [] },
  { key: 'checkout', label: 'Checkout', icon: IconCheckout, hint: 'Order numbering and the note shown at checkout.', fields: ['order_reference_prefix', 'checkout_note'] },
];

/** Accessible tab strip: arrow keys move between tabs, Home/End jump, the active tab lives in the URL. */
const Tabs = ({ active, onChange, dirtyTabs }) => {
  const refs = useRef([]);
  const onKey = (e, i) => {
    const moves = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: TABS.length - 1 - i };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = (i + moves[e.key] + TABS.length) % TABS.length;
    onChange(TABS[next].key);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-ink-700 px-1 pb-px">
      {TABS.map((t, i) => {
        const selected = t.key === active;
        const Icon = t.icon;
        return (
          <button key={t.key} ref={(el) => { refs.current[i] = el; }} role="tab" type="button" id={`settings-tab-${t.key}`} aria-selected={selected} aria-controls={`settings-panel-${t.key}`} tabIndex={selected ? 0 : -1} onClick={() => onChange(t.key)} onKeyDown={(e) => onKey(e, i)}
            className={`relative -mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${selected ? 'border-accent text-accent-600' : 'border-transparent text-mist-muted hover:text-mist'}`}>
            <Icon className={`h-4 w-4 ${selected ? 'text-accent' : 'text-mist-dim'}`} />
            {t.label}
            {dirtyTabs.has(t.key) ? <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="unsaved changes" /> : null}
          </button>
        );
      })}
    </div>
  );
};

/** Image field with preview, URL input, upload and remove. */
const THEME_PRESETS = [
  ['Classic', '#18181b', '#4f46e5'],
  ['Forest', '#14532d', '#d97706'],
  ['Ocean', '#0c4a6e', '#0ea5e9'],
  ['Berry', '#4a044e', '#db2777'],
  ['Terracotta', '#7c2d12', '#ea580c'],
  ['Slate', '#1e293b', '#10b981'],
];

const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v ?? '').trim());
const contrastText = (hex) => {
  if (!isHex(hex)) return '#fff';
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.4 ? '#18181b' : '#ffffff';
};

/** Colour swatch + hex text, kept in sync. */
const ColorField = ({ id, label, value, onChange }) => (
  <Field label={label} htmlFor={id} error={value && !isHex(value) ? 'Use a 6-digit hex colour, e.g. #18181b.' : undefined}>
    <div className="flex items-center gap-3">
      <label className="relative h-10 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-ink-600 shadow-panel" style={{ background: isHex(value) ? value : '#fff' }}>
        <input type="color" value={isHex(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`${label} colour picker`} />
      </label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input font-mono uppercase" maxLength={7} placeholder="#18181b" spellCheck={false} />
    </div>
  </Field>
);

/** A miniature of the storefront in the chosen colours, so the choice is visible before saving. */
const ThemePreview = ({ primary, secondary, storeName }) => {
  const p = isHex(primary) ? primary : '#18181b';
  const s = isHex(secondary) ? secondary : '#4f46e5';
  return (
    <div className="overflow-hidden rounded-xl border border-ink-600 bg-white text-[11px]" aria-hidden="true">
      <div className="py-1 text-center text-[10px] font-semibold" style={{ background: s, color: contrastText(s) }}>Free shipping on orders over R1 000</div>
      <div className="flex items-center gap-2 border-b border-ink-700 px-3 py-2">
        <span className="grid h-5 w-5 place-items-center rounded-md text-[10px] font-bold" style={{ background: p, color: contrastText(p) }}>{(storeName || 'S').slice(0, 1)}</span>
        <span className="font-semibold text-mist">{storeName || 'Your store'}</span>
        <span className="ml-auto grid h-4 min-w-[1rem] place-items-center rounded-full px-1 text-[9px] font-bold" style={{ background: s, color: contrastText(s) }}>2</span>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: s }}>New in</p>
          <p className="mt-0.5 font-semibold text-mist">Everyday Hoodie</p>
          <p className="text-mist-muted">R 799,00 <span className="ml-1 rounded px-1 text-[9px] font-semibold" style={{ background: s, color: contrastText(s) }}>−15%</span></p>
        </div>
        <span className="rounded-lg px-3 py-1.5 font-semibold" style={{ background: p, color: contrastText(p) }}>Add to cart</span>
      </div>
    </div>
  );
};

const ImageField = ({ id, label, hint, value, onChange, onUpload, onChoose, shape = 'rounded-lg' }) => (
  <Field label={label} hint={hint} htmlFor={id}>
    <div className="flex items-center gap-3">
      {value ? <Img src={value} alt="" wrapClassName={`h-14 w-14 shrink-0 ${shape} border border-ink-700`} className="h-14 w-14 object-cover" /> : <span className={`grid h-14 w-14 shrink-0 place-items-center ${shape} border border-dashed border-ink-600 text-[10px] text-mist-dim`}>none</span>}
      <div className="flex min-w-0 grow flex-col gap-2">
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input" placeholder="https://… or upload" />
        <div className="flex gap-2">
          <button type="button" onClick={onChoose} className="btn-ghost btn-sm">Choose…</button>
          <button type="button" onClick={onUpload} className="btn-ghost btn-sm">Upload…</button>
          {value ? <button type="button" onClick={() => onChange('')} className="btn-ghost btn-sm" aria-label="Remove image" title="Remove image"><Trash2 className="h-4 w-4" aria-hidden="true" /></button> : null}
        </div>
      </div>
    </div>
  </Field>
);

const Settings = () => {
  const { data, loading, error } = useAsync(() => adminApi.settings.get(), []);
  const [params, setParams] = useSearchParams();
  const active = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'store';
  const setActive = (key) => { const next = new URLSearchParams(params); next.set('tab', key); setParams(next, { replace: true }); };

  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const { headerUser: user } = useAuthContext();
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [uploading, setUploading] = useState(null); // 'store_logo_url' | 'store_icon_url'
  const [choosing, setChoosing] = useState(null); // which image field the media picker fills

  useEffect(() => {
    if (user?.user?.emailAddress && !testTo) setTestTo(user.user.emailAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user?.emailAddress]);

  useEffect(() => {
    if (data) {
      const next = {
        store_name: data.store_name ?? '', store_tagline: data.store_tagline ?? '', store_description: data.store_description ?? '', support_email: data.support_email ?? '',
        store_logo_url: data.store_logo_url ?? '', store_icon_url: data.store_icon_url ?? '', store_url: data.store_url ?? '',
        currency: data.currency ?? 'ZAR', prices_include_tax: data.prices_include_tax === '1', tax_rate: String((Number(data.tax_rate_bp ?? 0) / 100).toFixed(2)),
        shipping_flat: fromCents(data.shipping_flat_cents ?? 0), free_shipping_threshold: fromCents(data.free_shipping_threshold_cents ?? 0),
        order_reference_prefix: data.order_reference_prefix ?? 'SO-', checkout_note: data.checkout_note ?? '',
        theme_primary: data.theme_primary || '#18181b', theme_secondary: data.theme_secondary || '#4f46e5',
        announcement_text: data.announcement_text ?? '', announcement_url: data.announcement_url ?? '', cookie_consent_enabled: data.cookie_consent_enabled === '1', cookie_consent_text: data.cookie_consent_text ?? '',
        contact_phone: data.contact_phone ?? '', contact_address: data.contact_address ?? '', contact_hours: data.contact_hours ?? '',
        social_instagram: data.social_instagram ?? '', social_facebook: data.social_facebook ?? '', social_x: data.social_x ?? '', social_tiktok: data.social_tiktok ?? '', footer_note: data.footer_note ?? '',
      };
      setForm(next);
      setSaved(next);
    }
  }, [data]);

  const dirtyTabs = new Set(form && saved ? TABS.filter((t) => t.fields.some((f) => form[f] !== saved[f])).map((t) => t.key) : []);
  const dirty = dirtyTabs.size > 0;

  useEffect(() => {
    if (!dirty) return undefined;
    const onUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setValue = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const payload = () => ({
    store_name: form.store_name, store_tagline: form.store_tagline, store_description: form.store_description.trim(), support_email: form.support_email,
    store_logo_url: form.store_logo_url, store_icon_url: form.store_icon_url, store_url: form.store_url,
    currency: form.currency.toUpperCase(), prices_include_tax: form.prices_include_tax, tax_rate_bp: Math.round(Number(form.tax_rate || 0) * 100),
    shipping_flat_cents: toCents(form.shipping_flat) ?? 0, free_shipping_threshold_cents: toCents(form.free_shipping_threshold) ?? 0,
    order_reference_prefix: form.order_reference_prefix, checkout_note: form.checkout_note,
    theme_primary: form.theme_primary.trim().toLowerCase(), theme_secondary: form.theme_secondary.trim().toLowerCase(),
    announcement_text: form.announcement_text.trim(), announcement_url: form.announcement_url.trim(), cookie_consent_enabled: form.cookie_consent_enabled, cookie_consent_text: form.cookie_consent_text.trim(),
    contact_phone: form.contact_phone.trim(), contact_address: form.contact_address, contact_hours: form.contact_hours.trim(),
    social_instagram: form.social_instagram.trim(), social_facebook: form.social_facebook.trim(), social_x: form.social_x.trim(), social_tiktok: form.social_tiktok.trim(), footer_note: form.footer_note.trim(),
  });

  const validate = () => {
    const url = (v) => !v || /^https?:\/\//i.test(v);
    const problems = [
      !form.store_name.trim() && ['store', 'Give the store a name.'],
      !url(form.store_url.trim()) && ['store', 'The store URL must start with http:// or https://.'],
      form.support_email.trim() && !form.support_email.includes('@') && ['contact', 'The support email is not a valid address.'],
      ['theme_primary', 'theme_secondary'].some((k) => !/^#[0-9a-f]{6}$/i.test(form[k].trim())) && ['storefront', 'Theme colours must be 6-digit hex values like #18181b.'],
      ['social_instagram', 'social_facebook', 'social_x', 'social_tiktok'].some((k) => !url(form[k].trim())) && ['contact', 'Social links must be full URLs starting with https://.'],
      !/^[A-Za-z]{3}$/.test(form.currency.trim()) && ['money', 'Currency must be a 3-letter ISO code.'],
      form.tax_rate !== '' && Number.isNaN(Number(form.tax_rate)) && ['money', 'Tax rate must be a number.'],
      toCents(form.shipping_flat) == null && ['shipping', 'Enter a valid flat shipping fee.'],
      form.free_shipping_threshold !== '' && toCents(form.free_shipping_threshold) == null && ['shipping', 'Enter a valid free-shipping threshold.'],
    ].filter(Boolean);
    if (problems.length) {
      setActive(problems[0][0]);
      toast.error(problems[0][1]);
      return false;
    }
    return true;
  };

  const persist = async () => {
    const result = await adminApi.settings.set(payload());
    announceSettingsChanged(result); // sidebar brand, tab title and favicon follow immediately
    setForm((f) => {
      const next = { ...f };
      setSaved(next);
      return next;
    });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await persist();
      toast.success('Settings saved.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await adminApi.settings.sendTest(testTo.trim());
      setTestResult(r?.sent ? { tone: 'success', text: `Test email sent to ${testTo.trim()} via ${r.via}. Check the inbox (and spam folder).` } : { tone: 'error', text: r?.reason || 'The test email could not be sent.' });
    } catch (err) {
      setTestResult({ tone: 'error', text: errorMessage(err) });
    } finally {
      setTesting(false);
    }
  };

  const discard = () => { setForm(saved); toast('Changes discarded.'); };

  if (error && !form) return <ErrorNote error={error} />;
  const tab = TABS.find((t) => t.key === active);
  if (loading || !form) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHead title="Settings" subtitle="Everything customers see about the store is configured here." />
        <div className="flex gap-4 border-b border-ink-700 pb-2">{TABS.map((t) => <span key={t.key} className="skeleton h-5 w-20 rounded" />)}</div>
        <SkeletonForm fields={5} />
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHead title="Settings" subtitle="Everything customers see about the store is configured here. Legal and information pages live under Pages.">
        {dirty ? <button type="button" onClick={discard} className="btn-ghost">Discard</button> : null}
        <button type="submit" disabled={saving || !dirty} className="btn-primary">{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
      </PageHead>

      <Tabs active={active} onChange={setActive} dirtyTabs={dirtyTabs} />

      <div key={active} id={`settings-panel-${active}`} role="tabpanel" aria-labelledby={`settings-tab-${active}`} className="ui-page flex flex-col gap-5">
        <p className="text-sm text-mist-muted">{tab.hint}</p>

        {active === 'store' ? (
          <>
            <section className="card flex flex-col gap-4 p-4">
              <h3 className="text-sm font-semibold text-mist">Identity</h3>
              <Field label="Store name" hint="Header, browser tab, emails and receipts." htmlFor="s-name"><input id="s-name" value={form.store_name} onChange={set('store_name')} className="input" required autoFocus /></Field>
              <Field label="Tagline" hint="The headline on the home page." htmlFor="s-tag"><input id="s-tag" value={form.store_tagline} onChange={set('store_tagline')} className="input" maxLength={200} /></Field>
              <Field label="Short description" hint="One or two sentences under the headline, and the description search engines show." htmlFor="s-desc"><textarea id="s-desc" value={form.store_description} onChange={set('store_description')} className="textarea" rows={2} maxLength={300} /></Field>
            </section>
            <section className="card flex flex-col gap-4 p-4">
              <h3 className="text-sm font-semibold text-mist">Brand images</h3>
              <ImageField id="s-logo" label="Logo" hint="Shown in the storefront header and on emails. Square works best." value={form.store_logo_url} onChange={(v) => setValue('store_logo_url', v)} onUpload={() => setUploading('store_logo_url')} onChoose={() => setChoosing('store_logo_url')} />
              <ImageField id="s-icon" label="Store icon (favicon)" hint="The small icon in the browser tab and on phone home screens. Square, at least 180×180. Falls back to the logo." value={form.store_icon_url} onChange={(v) => setValue('store_icon_url', v)} onUpload={() => setUploading('store_icon_url')} onChoose={() => setChoosing('store_icon_url')} shape="rounded-full" />
            </section>
            <section className="card flex flex-col gap-4 p-4">
              <h3 className="text-sm font-semibold text-mist">Addresses</h3>
              <Field label="Public store URL" hint="Where the storefront lives. Payment providers send customers back here and emails link to it." htmlFor="s-url"><input id="s-url" value={form.store_url} onChange={set('store_url')} className="input" placeholder="https://shop.example.com" /></Field>
            </section>
          </>
        ) : null}

        {active === 'contact' ? (
          <>
            <section className="card flex flex-col gap-4 p-4">
              <h3 className="text-sm font-semibold text-mist">Reach us</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Support email" hint="Contact-form messages are forwarded here; also the default sender." htmlFor="s-mail"><input id="s-mail" type="email" value={form.support_email} onChange={set('support_email')} className="input" autoFocus /></Field>
                <Field label="Phone" htmlFor="s-phone"><input id="s-phone" value={form.contact_phone} onChange={set('contact_phone')} className="input" maxLength={60} placeholder="+27 21 000 0000" /></Field>
              </div>
              <Field label="Hours" htmlFor="s-hours"><input id="s-hours" value={form.contact_hours} onChange={set('contact_hours')} className="input" maxLength={120} placeholder="Monday to Friday, 9:00-17:00" /></Field>
              <Field label="Store address" hint="One line per row. Shown in the footer, on the Contact page and on pages with the contact block." htmlFor="s-address"><textarea id="s-address" value={form.contact_address} onChange={set('contact_address')} className="textarea" rows={3} maxLength={400} placeholder={'12 Long Street\nCape Town, 8001'} /></Field>
            </section>
            <section className="card flex flex-col gap-4 p-4">
              <h3 className="text-sm font-semibold text-mist">Social media</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Instagram" htmlFor="s-ig"><input id="s-ig" value={form.social_instagram} onChange={set('social_instagram')} className="input" placeholder="https://instagram.com/yourstore" /></Field>
                <Field label="Facebook" htmlFor="s-fb"><input id="s-fb" value={form.social_facebook} onChange={set('social_facebook')} className="input" placeholder="https://facebook.com/yourstore" /></Field>
                <Field label="X" htmlFor="s-x"><input id="s-x" value={form.social_x} onChange={set('social_x')} className="input" placeholder="https://x.com/yourstore" /></Field>
                <Field label="TikTok" htmlFor="s-tt"><input id="s-tt" value={form.social_tiktok} onChange={set('social_tiktok')} className="input" placeholder="https://tiktok.com/@yourstore" /></Field>
              </div>
              <p className="text-xs text-mist-dim">Only links you fill in are shown. The About page can show all of these details under its text: enable “Show the store's contact details” in <Link to="/pages" className="text-accent">Pages</Link>.</p>
            </section>
          </>
        ) : null}

        {active === 'storefront' ? (
          <>
            <section className="card flex flex-col gap-4 p-4">
              <div>
                <h3 className="text-sm font-semibold text-mist">Theme colours</h3>
                <p className="text-xs text-mist-muted">Primary paints buttons, dark panels and the active filter. Secondary is the accent: announcement bar, sale badges, section labels, links and the cart count. Text on each is chosen automatically for contrast.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ColorField id="s-theme-primary" label="Primary" value={form.theme_primary} onChange={(v) => setValue('theme_primary', v)} />
                <ColorField id="s-theme-secondary" label="Secondary (accent)" value={form.theme_secondary} onChange={(v) => setValue('theme_secondary', v)} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-mist-dim">Presets:</span>
                {THEME_PRESETS.map(([name, p, s]) => (
                  <button key={name} type="button" onClick={() => { setValue('theme_primary', p); setValue('theme_secondary', s); }} className="chip text-xs" title={`${p} / ${s}`}>
                    <span className="inline-flex overflow-hidden rounded-full border border-ink-600"><span className="h-3 w-3" style={{ background: p }} /><span className="h-3 w-3" style={{ background: s }} /></span>{name}
                  </button>
                ))}
              </div>
              <ThemePreview primary={form.theme_primary} secondary={form.theme_secondary} storeName={form.store_name} />
            </section>
            <section className="card flex flex-col gap-4 p-4">
              <h3 className="text-sm font-semibold text-mist">Announcement bar</h3>
              <Field label="Text" hint="Shown in a slim bar above the header. Leave blank to hide it." htmlFor="s-ann"><input id="s-ann" value={form.announcement_text} onChange={set('announcement_text')} className="input" maxLength={160} placeholder="Free shipping on orders over R1 000" autoFocus /></Field>
              <Field label="Link" hint="Optional. A path like /shop/sale or a full URL." htmlFor="s-ann-url"><input id="s-ann-url" value={form.announcement_url} onChange={set('announcement_url')} className="input" maxLength={500} /></Field>
            </section>
            <section className="card flex flex-col gap-4 p-4">
              <h3 className="text-sm font-semibold text-mist">Cookie notice</h3>
              <label className="flex items-center gap-3 text-sm text-mist-muted"><input type="checkbox" checked={form.cookie_consent_enabled} onChange={set('cookie_consent_enabled')} className="accent-accent" /> Show a cookie notice to new visitors</label>
              <Field label="Notice text" hint="The privacy policy page is linked automatically when it exists." htmlFor="s-cookie"><textarea id="s-cookie" value={form.cookie_consent_text} onChange={set('cookie_consent_text')} className="textarea" rows={3} maxLength={400} /></Field>
            </section>
            <section className="card flex flex-col gap-4 p-4">
              <h3 className="text-sm font-semibold text-mist">Footer</h3>
              <Field label="Footer note" hint="Replaces the default 'All rights reserved.' next to the copyright line." htmlFor="s-foot"><input id="s-foot" value={form.footer_note} onChange={set('footer_note')} className="input" maxLength={300} /></Field>
              <p className="text-xs text-mist-dim">Terms, privacy, FAQ and other information pages are managed under <Link to="/pages" className="text-accent">Pages</Link>; published ones marked “show in footer” appear automatically.</p>
            </section>
          </>
        ) : null}

        {active === 'money' ? (
          <section className="card flex flex-col gap-4 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Currency" hint="ISO code. Must match your Cloudgate Wallet currency." htmlFor="s-cur"><input id="s-cur" value={form.currency} onChange={set('currency')} className="input font-mono uppercase" maxLength={3} required autoFocus /></Field>
              <Field label="Tax rate (%)" hint="Used to show the tax portion on orders and receipts." htmlFor="s-tax"><input id="s-tax" value={form.tax_rate} onChange={set('tax_rate')} className="input tabular-nums" inputMode="decimal" /></Field>
            </div>
            <label className="flex items-center gap-3 text-sm text-mist-muted"><input type="checkbox" checked={form.prices_include_tax} onChange={set('prices_include_tax')} className="accent-accent" /> Prices include tax (tax is shown as a portion of the total)</label>
          </section>
        ) : null}

        {active === 'shipping' ? (
          <section className="card flex flex-col gap-4 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={`Flat shipping fee (${form.currency || 'ZAR'})`} hint="Charged on every order below the free-shipping threshold." htmlFor="s-ship"><input id="s-ship" value={form.shipping_flat} onChange={set('shipping_flat')} className="input tabular-nums" inputMode="decimal" autoFocus /></Field>
              <Field label={`Free shipping from (${form.currency || 'ZAR'})`} hint="Subtotal at which shipping becomes free. 0 disables free shipping." htmlFor="s-free"><input id="s-free" value={form.free_shipping_threshold} onChange={set('free_shipping_threshold')} className="input tabular-nums" inputMode="decimal" /></Field>
            </div>
            <Notice tone="info">One flat rate applies to every destination for now. The wording customers read lives on the Shipping & returns page under <Link to="/pages" className="underline">Pages</Link>.</Notice>
          </section>
        ) : null}

        {active === 'email' ? <><SmtpSettings/><section className="card p-4"><Field label="Send a test to" htmlFor="s-test-to"><input id="s-test-to" type="email" value={testTo} onChange={e=>setTestTo(e.target.value)} className="input"/></Field><button type="button" onClick={sendTest} disabled={testing || !testTo.trim()} className="btn-ghost">{testing?'Sending…':'Send test using saved Cloudgate settings'}</button>{testResult ? <Notice tone={testResult.tone}>{testResult.text}</Notice> : null}</section></> : null}

        {active === 'checkout' ? (
          <section className="card flex flex-col gap-4 p-4">
            <Field label="Order number prefix" hint="New orders continue the sequence with this prefix, e.g. SO-100042." htmlFor="s-prefix"><input id="s-prefix" value={form.order_reference_prefix} onChange={set('order_reference_prefix')} className="input font-mono" maxLength={10} autoFocus /></Field>
            <Field label="Checkout note" hint="Shown to customers on the checkout page (delivery times, returns…)." htmlFor="s-note"><textarea id="s-note" value={form.checkout_note} onChange={set('checkout_note')} className="textarea" rows={3} /></Field>
          </section>
        ) : null}
      </div>

      <MediaPicker open={!!choosing} onClose={() => setChoosing(null)} preferFolder="shop/branding" title={choosing === 'store_icon_url' ? 'Choose store icon' : 'Choose logo'}
        onUploadInstead={() => setUploading(choosing)}
        onPick={(files) => { if (choosing && files[0]?.url) { setValue(choosing, files[0].url); toast.success('Image selected. Save to apply it.'); } }} />
      <ImageUploader open={!!uploading} onClose={() => setUploading(null)} path="shop/branding" aspect={1} maxFiles={1} title={uploading === 'store_icon_url' ? 'Store icon' : 'Store logo'}
        onUploaded={(done) => { const f = done[0]; if (f?.url && uploading) { setValue(uploading, f.url); toast.success('Image uploaded. Save to apply it.'); } setUploading(null); }} />
    </form>
  );
};

export { Settings };
