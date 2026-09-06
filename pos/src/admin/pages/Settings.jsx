import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Store, Receipt as ReceiptIcon, Coins, Monitor, Mail, Palette } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { announceSettingsChanged } from '@/admin/services/storeBrand';
import { useAsync, ErrorNote, PageHead, Img } from '@/shared/ui/ui';
import { SkeletonForm } from '@/shared/ui/skeleton';
import { Field, Notice } from '@/shared/ui/forms';
import { ImageUploader } from '@/shared/ui/ImageUploader';
import { MediaPicker } from '@/shared/ui/MediaPicker';
import { errorMessage } from '@/shared/lib/errors';
import { useAuthContext } from '@/shared/auth';
import { LABEL_SIZES } from '@/admin/components/LabelSheet';

const SMTP_PRESETS = [
  ['', 'Custom'], ['smtp.gmail.com|587|starttls', 'Gmail / Google Workspace'], ['smtp.office365.com|587|starttls', 'Microsoft 365 / Outlook'],
  ['smtp.sendgrid.net|587|starttls', 'SendGrid (user "apikey")'], ['smtp.mailgun.org|587|starttls', 'Mailgun'], ['email-smtp.eu-west-1.amazonaws.com|587|starttls', 'Amazon SES (eu-west-1)'],
];

const TABS = [
  { key: 'store', label: 'Store', icon: Store, hint: 'Who you are: name, address, contact details, logo and the public address of this app.', fields: ['store_name', 'store_tagline', 'store_address', 'store_phone', 'support_email', 'store_url', 'store_logo_url', 'store_icon_url'] },
  { key: 'receipt', label: 'Receipts', icon: ReceiptIcon, hint: 'What is printed on every receipt, receipt numbering and the label size for your printer.', fields: ['receipt_header', 'receipt_footer', 'tax_number', 'sale_reference_prefix', 'label_size'] },
  { key: 'money', label: 'Money', icon: Coins, hint: 'Currency and tax.', fields: ['currency', 'tax_rate', 'prices_include_tax'] },
  { key: 'till', label: 'Till', icon: Monitor, hint: 'How the tills behave: payment methods, shifts, stock rules and the quick-cash buttons.', fields: ['payment_cash_enabled', 'payment_card_enabled', 'require_shift', 'allow_negative_stock', 'low_stock_threshold', 'quick_cash_amounts'] },
  { key: 'email', label: 'Email', icon: Mail, hint: 'Outgoing mail server for e-mailed receipts, and a test send.', fields: ['smtp_host', 'smtp_port', 'smtp_security', 'smtp_user', 'smtp_password', 'smtp_from_email', 'smtp_from_name'] },
  { key: 'theme', label: 'Theme', icon: Palette, hint: 'Colours for the till screens.', fields: ['theme_primary', 'theme_secondary'] },
];

const Tabs = ({ active, onChange, dirtyTabs }) => {
  const refs = useRef([]);
  const onKey = (e, i) => {
    const moves = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: TABS.length - 1 - i };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = (i + moves[e.key] + TABS.length) % TABS.length;
    onChange(TABS[next].key); refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-ink-700 px-1 pb-px">
      {TABS.map((t, i) => { const selected = t.key === active; const Icon = t.icon; return (
        <button key={t.key} ref={(el) => { refs.current[i] = el; }} role="tab" type="button" id={`settings-tab-${t.key}`} aria-selected={selected} aria-controls={`settings-panel-${t.key}`} tabIndex={selected ? 0 : -1} onClick={() => onChange(t.key)} onKeyDown={(e) => onKey(e, i)}
          className={`relative -mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${selected ? 'border-accent text-accent-600' : 'border-transparent text-mist-muted hover:text-mist'}`}>
          <Icon className={`h-4 w-4 ${selected ? 'text-accent' : 'text-mist-dim'}`} />{t.label}
          {dirtyTabs.has(t.key) ? <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="unsaved changes" /> : null}
        </button>); })}
    </div>
  );
};

const THEME_PRESETS = [['Slate', '#0f172a', '#2563eb'], ['Forest', '#14532d', '#d97706'], ['Ocean', '#0c4a6e', '#0ea5e9'], ['Berry', '#4a044e', '#db2777'], ['Terracotta', '#7c2d12', '#ea580c'], ['Graphite', '#18181b', '#10b981']];
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v ?? '').trim());
const contrastText = (hex) => { if (!isHex(hex)) return '#fff'; const n = parseInt(hex.slice(1), 16); const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255) > 0.4 ? '#18181b' : '#ffffff'; };

const ColorField = ({ id, label, value, onChange }) => (
  <Field label={label} htmlFor={id} error={value && !isHex(value) ? 'Use a 6-digit hex colour, e.g. #0f172a.' : undefined}>
    <div className="flex items-center gap-3">
      <label className="relative h-10 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-ink-600 shadow-panel" style={{ background: isHex(value) ? value : '#fff' }}>
        <input type="color" value={isHex(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`${label} colour picker`} />
      </label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input font-mono uppercase" maxLength={7} placeholder="#0f172a" spellCheck={false} />
    </div>
  </Field>
);

/** A miniature of the till in the chosen colours. */
const TillPreview = ({ primary, secondary, storeName }) => {
  const p = isHex(primary) ? primary : '#0f172a'; const s = isHex(secondary) ? secondary : '#2563eb';
  return (
    <div className="overflow-hidden rounded-xl border border-ink-600 bg-ink-950 text-[11px]" aria-hidden="true">
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: p, color: contrastText(p) }}><span className="grid h-5 w-5 place-items-center rounded-md bg-white/20 text-[10px] font-bold">{(storeName || 'P').slice(0, 1)}</span><span className="font-semibold">{storeName || 'Your store'}</span><span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[9px]">Till 1 · 2h 10m</span></div>
      <div className="grid grid-cols-[1fr_auto] gap-3 p-3">
        <div className="grid grid-cols-3 gap-1.5">{['Coffee', 'Muffin', 'Water'].map((n, i) => <span key={n} className="rounded-lg border border-ink-700 bg-white p-1.5 text-mist"><span className="mb-1 block h-4 w-4 rounded" style={{ background: i === 1 ? s : p }} />{n}</span>)}</div>
        <div className="flex w-28 flex-col justify-between rounded-lg border border-ink-700 bg-white p-2 text-mist"><span className="text-[10px] text-mist-dim">Total</span><span className="text-sm font-bold">R 64,00</span><span className="mt-1 rounded-md py-1 text-center font-semibold" style={{ background: p, color: contrastText(p) }}>Pay</span><span className="mt-1 rounded-md py-0.5 text-center text-[9px] font-semibold" style={{ background: s, color: contrastText(s) }}>Cash</span></div>
      </div>
    </div>
  );
};

const ImageField = ({ id, label, hint, value, onChange, onUpload, onChoose, shape = 'rounded-lg' }) => (
  <Field label={label} hint={hint} htmlFor={id}>
    <div className="flex items-center gap-3">
      {value ? <Img src={value} alt="" wrapClassName={`h-14 w-14 shrink-0 ${shape} border border-ink-700`} className="h-14 w-14 object-contain" /> : <span className={`grid h-14 w-14 shrink-0 place-items-center ${shape} border border-dashed border-ink-600 text-[10px] text-mist-dim`}>none</span>}
      <div className="flex min-w-0 grow flex-col gap-2">
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input" placeholder="https://… or upload" />
        <div className="flex gap-2"><button type="button" onClick={onChoose} className="btn-ghost btn-sm">Choose…</button><button type="button" onClick={onUpload} className="btn-ghost btn-sm">Upload…</button>{value ? <button type="button" onClick={() => onChange('')} className="btn-ghost btn-sm">Remove</button> : null}</div>
      </div>
    </div>
  </Field>
);

const Toggle = ({ checked, onChange, children, hint }) => (
  <label className="flex items-start gap-3 text-sm text-mist"><input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 accent-accent" /><span>{children}{hint ? <span className="block text-xs text-mist-dim">{hint}</span> : null}</span></label>
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
  const [uploading, setUploading] = useState(null);
  const [choosing, setChoosing] = useState(null);

  useEffect(() => { if (user?.user?.emailAddress && !testTo) setTestTo(user.user.emailAddress); }, [user?.user?.emailAddress]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!data) return;
    const next = {
      store_name: data.store_name ?? '', store_tagline: data.store_tagline ?? '', store_address: data.store_address ?? '', store_phone: data.store_phone ?? '', support_email: data.support_email ?? '', store_url: data.store_url ?? '',
      store_logo_url: data.store_logo_url ?? '', store_icon_url: data.store_icon_url ?? '',
      receipt_header: data.receipt_header ?? '', receipt_footer: data.receipt_footer ?? '', tax_number: data.tax_number ?? '', sale_reference_prefix: data.sale_reference_prefix ?? 'R-', label_size: LABEL_SIZES[data.label_size] ? data.label_size : 'medium',
      currency: data.currency ?? 'ZAR', prices_include_tax: data.prices_include_tax !== '0', tax_rate: String((Number(data.tax_rate_bp ?? 0) / 100).toFixed(2)),
      payment_cash_enabled: data.payment_cash_enabled !== '0', payment_card_enabled: data.payment_card_enabled !== '0', require_shift: data.require_shift !== '0', allow_negative_stock: data.allow_negative_stock === '1',
      low_stock_threshold: data.low_stock_threshold ?? '5', quick_cash_amounts: data.quick_cash_amounts ?? '20,50,100,200',
      smtp_host: data.smtp_host ?? '', smtp_port: data.smtp_port ?? '', smtp_security: data.smtp_security ?? 'starttls', smtp_user: data.smtp_user ?? '', smtp_password: '', smtp_password_set: data.smtp_password_set === '1', smtp_from_email: data.smtp_from_email ?? '', smtp_from_name: data.smtp_from_name ?? '',
      theme_primary: data.theme_primary || '#0f172a', theme_secondary: data.theme_secondary || '#2563eb',
    };
    setForm(next); setSaved(next);
  }, [data]);

  const dirtyTabs = new Set(form && saved ? TABS.filter((t) => t.fields.some((f) => form[f] !== saved[f])).map((t) => t.key) : []);
  const dirty = dirtyTabs.size > 0;
  useEffect(() => { if (!dirty) return undefined; const h = (e) => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setValue = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const payload = () => ({
    store_name: form.store_name.trim(), store_tagline: form.store_tagline.trim(), store_address: form.store_address, store_phone: form.store_phone.trim(), support_email: form.support_email.trim(), store_url: form.store_url.trim(),
    store_logo_url: form.store_logo_url, store_icon_url: form.store_icon_url,
    receipt_header: form.receipt_header, receipt_footer: form.receipt_footer, tax_number: form.tax_number.trim(), sale_reference_prefix: form.sale_reference_prefix.trim() || 'R-', label_size: form.label_size,
    currency: form.currency.trim().toUpperCase(), prices_include_tax: form.prices_include_tax, tax_rate_bp: Math.round(Number(form.tax_rate || 0) * 100),
    payment_cash_enabled: form.payment_cash_enabled, payment_card_enabled: form.payment_card_enabled, require_shift: form.require_shift, allow_negative_stock: form.allow_negative_stock,
    low_stock_threshold: Math.max(0, Math.round(Number(form.low_stock_threshold || 0))), quick_cash_amounts: form.quick_cash_amounts.split(',').map((s) => s.trim()).filter((s) => s && !Number.isNaN(Number(s))).join(','),
    smtp_host: form.smtp_host.trim(), smtp_port: form.smtp_port || (form.smtp_security === 'ssl' ? 465 : 587), smtp_security: form.smtp_security, smtp_user: form.smtp_user.trim(), smtp_password: form.smtp_password, smtp_from_email: form.smtp_from_email.trim(), smtp_from_name: form.smtp_from_name.trim(),
    theme_primary: form.theme_primary.trim().toLowerCase(), theme_secondary: form.theme_secondary.trim().toLowerCase(),
  });

  const validate = () => {
    const url = (v) => !v || /^https?:\/\//i.test(v);
    const problems = [
      !form.store_name.trim() && ['store', 'Give the store a name.'],
      !url(form.store_url.trim()) && ['store', 'The app URL must start with http:// or https://.'],
      form.support_email.trim() && !form.support_email.includes('@') && ['store', 'The support e-mail is not a valid address.'],
      !/^[A-Za-z]{3}$/.test(form.currency.trim()) && ['money', 'Currency must be a 3-letter ISO code.'],
      form.tax_rate !== '' && Number.isNaN(Number(form.tax_rate)) && ['money', 'Tax rate must be a number.'],
      !form.payment_cash_enabled && !form.payment_card_enabled && ['till', 'Enable at least one payment method.'],
      ['theme_primary', 'theme_secondary'].some((k) => !isHex(form[k].trim())) && ['theme', 'Theme colours must be 6-digit hex values like #0f172a.'],
      form.smtp_from_email.trim() && !form.smtp_from_email.includes('@') && ['email', 'The From e-mail is not a valid address.'],
    ].filter(Boolean);
    if (problems.length) { setActive(problems[0][0]); toast.error(problems[0][1]); return false; }
    return true;
  };

  const persist = async () => {
    const result = await adminApi.settings.set(payload());
    announceSettingsChanged(result);
    setForm((f) => { const next = { ...f, smtp_password: '', smtp_password_set: result.smtp_password_set === '1' }; setSaved(next); return next; });
  };
  const save = async (e) => { e.preventDefault(); if (!validate()) return; setSaving(true); try { await persist(); toast.success('Settings saved.'); } catch (err) { toast.error(errorMessage(err)); } finally { setSaving(false); } };
  const sendTest = async () => {
    if (!validate()) return;
    setTesting(true); setTestResult(null);
    try { await persist(); const r = await adminApi.settings.sendTest(testTo.trim()); setTestResult(r?.sent ? { tone: 'success', text: `Test e-mail sent to ${testTo.trim()} via ${r.via}. Check the inbox (and spam folder).` } : { tone: 'error', text: r?.reason || 'The test e-mail could not be sent.' }); }
    catch (err) { setTestResult({ tone: 'error', text: errorMessage(err) }); } finally { setTesting(false); }
  };
  const applyPreset = (value) => { if (!value) return; const [host, port, security] = value.split('|'); setForm((f) => ({ ...f, smtp_host: host, smtp_port: port, smtp_security: security })); };
  const discard = () => { setForm(saved); toast('Changes discarded.'); };

  if (error && !form) return <ErrorNote error={error} />;
  const tab = TABS.find((t) => t.key === active);
  if (loading || !form) return <div className="mx-auto flex w-full max-w-3xl flex-col gap-6"><PageHead title="Settings" /><SkeletonForm fields={5} /></div>;

  return (
    <form onSubmit={save} className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHead title="Settings" subtitle="Everything tellers and customers see is configured here, not in code.">
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
              <Field label="Store name" hint="Till header, back office and receipts." htmlFor="s-name"><input id="s-name" value={form.store_name} onChange={set('store_name')} className="input" required autoFocus /></Field>
              <Field label="Tagline" htmlFor="s-tag"><input id="s-tag" value={form.store_tagline} onChange={set('store_tagline')} className="input" maxLength={200} /></Field>
              <Field label="Address" hint="Printed under the store name on receipts." htmlFor="s-address"><textarea id="s-address" value={form.store_address} onChange={set('store_address')} className="textarea" rows={3} maxLength={400} placeholder={'12 Long Street\nCape Town, 8001'} /></Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Phone" htmlFor="s-phone"><input id="s-phone" value={form.store_phone} onChange={set('store_phone')} className="input" maxLength={60} /></Field>
                <Field label="Support e-mail" hint="Default sender for e-mailed receipts." htmlFor="s-mail"><input id="s-mail" type="email" value={form.support_email} onChange={set('support_email')} className="input" /></Field>
              </div>
            </section>
            <section className="card flex flex-col gap-4 p-4">
              <h3 className="text-sm font-semibold text-mist">Brand images</h3>
              <ImageField id="s-logo" label="Logo" hint="On receipts and the till header. PNG with transparency works best." value={form.store_logo_url} onChange={(v) => setValue('store_logo_url', v)} onUpload={() => setUploading('store_logo_url')} onChoose={() => setChoosing('store_logo_url')} />
              <ImageField id="s-icon" label="Icon (favicon)" hint="Square; falls back to the logo." value={form.store_icon_url} onChange={(v) => setValue('store_icon_url', v)} onUpload={() => setUploading('store_icon_url')} onChoose={() => setChoosing('store_icon_url')} shape="rounded-full" />
            </section>
            <section className="card flex flex-col gap-4 p-4">
              <h3 className="text-sm font-semibold text-mist">Public address</h3>
              <Field label="URL of this app" hint="Card payments send the customer's phone back here after paying." htmlFor="s-url"><input id="s-url" value={form.store_url} onChange={set('store_url')} className="input" placeholder="https://pos.example.com" /></Field>
            </section>
          </>
        ) : null}

        {active === 'receipt' ? (
          <>
            <section className="card flex flex-col gap-4 p-4">
              <Field label="Header" hint="Under the address, e.g. opening hours or a slogan." htmlFor="s-rh"><textarea id="s-rh" value={form.receipt_header} onChange={set('receipt_header')} className="textarea" rows={2} maxLength={300} autoFocus /></Field>
              <Field label="Footer" hint="At the bottom: returns policy, thank-you line, website." htmlFor="s-rf"><textarea id="s-rf" value={form.receipt_footer} onChange={set('receipt_footer')} className="textarea" rows={3} maxLength={600} /></Field>
              <Field label="VAT / tax number" htmlFor="s-taxno"><input id="s-taxno" value={form.tax_number} onChange={set('tax_number')} className="input font-mono" maxLength={60} /></Field>
            </section>
            <section className="card flex flex-col gap-4 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Receipt number prefix" hint="e.g. R-100042" htmlFor="s-prefix"><input id="s-prefix" value={form.sale_reference_prefix} onChange={set('sale_reference_prefix')} className="input font-mono" maxLength={10} /></Field>
                <Field label="Label size" hint="Default for printed shelf and product labels." htmlFor="s-label"><select id="s-label" value={form.label_size} onChange={set('label_size')} className="select">{Object.entries(LABEL_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
              </div>
            </section>
          </>
        ) : null}

        {active === 'money' ? (
          <section className="card flex flex-col gap-4 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Currency" hint="ISO code. Must match your Cloudgate Wallet currency." htmlFor="s-cur"><input id="s-cur" value={form.currency} onChange={set('currency')} className="input font-mono uppercase" maxLength={3} required autoFocus /></Field>
              <Field label="Default tax rate (%)" hint="Products can override it or be exempt." htmlFor="s-tax"><input id="s-tax" value={form.tax_rate} onChange={set('tax_rate')} className="input tabular-nums" inputMode="decimal" /></Field>
            </div>
            <Toggle checked={form.prices_include_tax} onChange={set('prices_include_tax')} hint="Off means tax is added on top at the till.">Prices include tax</Toggle>
          </section>
        ) : null}

        {active === 'till' ? (
          <>
            <section className="card flex flex-col gap-3 p-4">
              <h3 className="text-sm font-semibold text-mist">Payments</h3>
              <Toggle checked={form.payment_cash_enabled} onChange={set('payment_cash_enabled')}>Accept cash</Toggle>
              <Toggle checked={form.payment_card_enabled} onChange={set('payment_card_enabled')} hint="Card payments open a Cloudgate Wallet page the customer pays on; the wallet must be activated.">Accept card (Cloudgate Wallet)</Toggle>
              <Field label="Quick cash buttons" hint="Comma-separated amounts offered at the cash screen, on top of the exact total and rounded-up options." htmlFor="s-quick"><input id="s-quick" value={form.quick_cash_amounts} onChange={set('quick_cash_amounts')} className="input font-mono" placeholder="20,50,100,200" /></Field>
            </section>
            <section className="card flex flex-col gap-3 p-4">
              <h3 className="text-sm font-semibold text-mist">Shifts and stock</h3>
              <Toggle checked={form.require_shift} onChange={set('require_shift')} hint="Recommended: every sale is tied to a register and cash-up.">Tellers must open a shift before selling</Toggle>
              <Toggle checked={form.allow_negative_stock} onChange={set('allow_negative_stock')} hint="When off, the till refuses to sell more than is on hand for tracked products.">Allow selling below zero stock</Toggle>
              <Field label="Low-stock alert" hint="Products at or below this quantity are flagged unless they set their own threshold." htmlFor="s-low"><input id="s-low" value={form.low_stock_threshold} onChange={set('low_stock_threshold')} className="input w-32 tabular-nums" inputMode="numeric" /></Field>
            </section>
          </>
        ) : null}

        {active === 'email' ? (
          <section className="card flex flex-col gap-4 p-4">
            <p className="text-sm text-mist-muted">E-mailed receipts go out through your own mail server or provider. Nothing is sent until this is set up.</p>
            <Field label="Provider preset" hint="Fills in the server details; you still need your own username and password." htmlFor="s-preset"><select id="s-preset" defaultValue="" onChange={(e) => applyPreset(e.target.value)} className="select">{SMTP_PRESETS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}</select></Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <Field label="SMTP server" htmlFor="s-smtp-host"><input id="s-smtp-host" value={form.smtp_host} onChange={set('smtp_host')} className="input" placeholder="smtp.example.com" autoComplete="off" /></Field>
              <Field label="Port" htmlFor="s-smtp-port"><input id="s-smtp-port" value={form.smtp_port} onChange={set('smtp_port')} className="input tabular-nums" inputMode="numeric" placeholder={form.smtp_security === 'ssl' ? '465' : '587'} /></Field>
              <Field label="Security" htmlFor="s-smtp-sec"><select id="s-smtp-sec" value={form.smtp_security} onChange={set('smtp_security')} className="select"><option value="starttls">STARTTLS (587)</option><option value="ssl">SSL/TLS (465)</option><option value="none">None</option></select></Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Username" htmlFor="s-smtp-user"><input id="s-smtp-user" value={form.smtp_user} onChange={set('smtp_user')} className="input" autoComplete="off" /></Field>
              <Field label="Password" hint={form.smtp_password_set ? 'A password is saved. Leave blank to keep it.' : 'Stored on the server; never shown again.'} htmlFor="s-smtp-pass"><input id="s-smtp-pass" type="password" value={form.smtp_password} onChange={set('smtp_password')} className="input" autoComplete="new-password" placeholder={form.smtp_password_set ? '••••••••' : ''} /></Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="From e-mail" hint="Defaults to the support e-mail. Most providers require a verified sender." htmlFor="s-smtp-from"><input id="s-smtp-from" type="email" value={form.smtp_from_email} onChange={set('smtp_from_email')} className="input" placeholder={form.support_email || 'receipts@example.com'} /></Field>
              <Field label="From name" htmlFor="s-smtp-from-name"><input id="s-smtp-from-name" value={form.smtp_from_name} onChange={set('smtp_from_name')} className="input" placeholder={form.store_name} /></Field>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900 p-3 sm:flex-row sm:items-end">
              <Field label="Send a test to" htmlFor="s-test-to" className="grow"><input id="s-test-to" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} className="input" /></Field>
              <button type="button" onClick={sendTest} disabled={testing || saving || !form.smtp_host.trim() || !testTo.trim()} className="btn-ghost whitespace-nowrap">{testing ? 'Sending…' : dirty ? 'Save & send test' : 'Send test'}</button>
            </div>
            {testResult ? <Notice tone={testResult.tone}>{testResult.text}</Notice> : null}
          </section>
        ) : null}

        {active === 'theme' ? (
          <section className="card flex flex-col gap-4 p-4">
            <div><h3 className="text-sm font-semibold text-mist">Till colours</h3><p className="text-xs text-mist-muted">Primary paints the till header and the Pay button; secondary is the accent for selected options and keypad confirms. Text on each is chosen automatically for contrast.</p></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ColorField id="s-theme-primary" label="Primary" value={form.theme_primary} onChange={(v) => setValue('theme_primary', v)} />
              <ColorField id="s-theme-secondary" label="Secondary (accent)" value={form.theme_secondary} onChange={(v) => setValue('theme_secondary', v)} />
            </div>
            <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-mist-dim">Presets:</span>{THEME_PRESETS.map(([name, p, s]) => <button key={name} type="button" onClick={() => { setValue('theme_primary', p); setValue('theme_secondary', s); }} className="chip text-xs" title={`${p} / ${s}`}><span className="inline-flex overflow-hidden rounded-full border border-ink-600"><span className="h-3 w-3" style={{ background: p }} /><span className="h-3 w-3" style={{ background: s }} /></span>{name}</button>)}</div>
            <TillPreview primary={form.theme_primary} secondary={form.theme_secondary} storeName={form.store_name} />
          </section>
        ) : null}
      </div>

      <MediaPicker open={!!choosing} onClose={() => setChoosing(null)} preferFolder="pos/branding" title={choosing === 'store_icon_url' ? 'Choose store icon' : 'Choose logo'} onUploadInstead={() => setUploading(choosing)}
        onPick={(files) => { if (choosing && files[0]?.url) { setValue(choosing, files[0].url); toast.success('Image selected. Save to apply it.'); } }} />
      <ImageUploader open={!!uploading} onClose={() => setUploading(null)} path="pos/branding" aspect={1} maxFiles={1} title={uploading === 'store_icon_url' ? 'Store icon' : 'Store logo'}
        onUploaded={(done) => { const f = done[0]; if (f?.url && uploading) { setValue(uploading, f.url); toast.success('Image uploaded. Save to apply it.'); } setUploading(null); }} />
    </form>
  );
};

export { Settings };
