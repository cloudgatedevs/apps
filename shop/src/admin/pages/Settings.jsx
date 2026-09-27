import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, PageHead } from '@/shared/ui/ui';
import { SkeletonForm } from '@/shared/ui/skeleton';
import { Field, Notice } from '@/shared/ui/forms';
import { fromCents, toCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';


const icon = (paths) => (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>{paths}</svg>
);
const IconStore = icon(<><path d="M3 9l1.5-5h15L21 9" /><path d="M3 9h18v3a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9z" /><path d="M5 14v6h14v-6" /></>);
const IconContact = icon(<><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>);
const IconStorefront = icon(<><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18M8 22h8" /></>);
const IconMoney = icon(<><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M7 12h.01M17 12h.01" /></>);
const IconShipping = icon(<><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>);
const IconCheckout = icon(<><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h5" /></>);

const TABS = [
  { key: 'store', label: 'Store', icon: IconStore, hint: 'Legal business name for order emails and the payment-return address. Appearance controls the website name and branding.', fields: ['store_name', 'store_url'] },
  { key: 'contact', label: 'Contact', icon: IconContact, hint: 'How customers reach you: email, phone, address, hours and social links. Shown in the footer, on the Contact page and on any page with the contact block enabled.', fields: ['support_email', 'contact_phone', 'contact_hours', 'contact_address', 'social_instagram', 'social_facebook', 'social_x', 'social_tiktok'] },
  { key: 'storefront', label: 'Storefront', icon: IconStorefront, hint: 'Announcement bar and cookie notice. Appearance controls colours and the footer line.', fields: ['announcement_text', 'announcement_url', 'cookie_consent_enabled', 'cookie_consent_text'] },
  { key: 'money', label: 'Money', icon: IconMoney, hint: 'Currency and tax.', fields: ['currency', 'tax_rate', 'prices_include_tax'] },
  { key: 'shipping', label: 'Shipping', icon: IconShipping, hint: 'What customers pay for delivery.', fields: ['shipping_flat', 'free_shipping_threshold'] },
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

const Settings = () => {
  const { data, loading, error } = useAsync(() => adminApi.settings.get(), []);
  const [params, setParams] = useSearchParams();
  const active = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'store';
  const setActive = (key) => { const next = new URLSearchParams(params); next.set('tab', key); setParams(next, { replace: true }); };

  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data) {
      const next = {
        store_name: data.store_name ?? '', support_email: data.support_email ?? '',
        store_url: data.store_url ?? '',
        currency: data.currency ?? 'ZAR', prices_include_tax: data.prices_include_tax === '1', tax_rate: String((Number(data.tax_rate_bp ?? 0) / 100).toFixed(2)),
        shipping_flat: fromCents(data.shipping_flat_cents ?? 0), free_shipping_threshold: fromCents(data.free_shipping_threshold_cents ?? 0),
        order_reference_prefix: data.order_reference_prefix ?? 'SO-', checkout_note: data.checkout_note ?? '',
        announcement_text: data.announcement_text ?? '', announcement_url: data.announcement_url ?? '', cookie_consent_enabled: data.cookie_consent_enabled === '1', cookie_consent_text: data.cookie_consent_text ?? '',
        contact_phone: data.contact_phone ?? '', contact_address: data.contact_address ?? '', contact_hours: data.contact_hours ?? '',
        social_instagram: data.social_instagram ?? '', social_facebook: data.social_facebook ?? '', social_x: data.social_x ?? '', social_tiktok: data.social_tiktok ?? '',
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

  const payload = () => ({
    store_name: form.store_name, support_email: form.support_email,
    store_url: form.store_url,
    currency: form.currency.toUpperCase(), prices_include_tax: form.prices_include_tax, tax_rate_bp: Math.round(Number(form.tax_rate || 0) * 100),
    shipping_flat_cents: toCents(form.shipping_flat) ?? 0, free_shipping_threshold_cents: toCents(form.free_shipping_threshold) ?? 0,
    order_reference_prefix: form.order_reference_prefix, checkout_note: form.checkout_note,
    announcement_text: form.announcement_text.trim(), announcement_url: form.announcement_url.trim(), cookie_consent_enabled: form.cookie_consent_enabled, cookie_consent_text: form.cookie_consent_text.trim(),
    contact_phone: form.contact_phone.trim(), contact_address: form.contact_address, contact_hours: form.contact_hours.trim(),
    social_instagram: form.social_instagram.trim(), social_facebook: form.social_facebook.trim(), social_x: form.social_x.trim(), social_tiktok: form.social_tiktok.trim(),
  });

  const validate = () => {
    const url = (v) => !v || /^https?:\/\//i.test(v);
    const problems = [
      !form.store_name.trim() && ['store', 'Give the store a name.'],
      !url(form.store_url.trim()) && ['store', 'The store URL must start with http:// or https://.'],
      form.support_email.trim() && !form.support_email.includes('@') && ['contact', 'The support email is not a valid address.'],
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
    await adminApi.settings.set(payload());
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


  const discard = () => { setForm(saved); toast('Changes discarded.'); };

  if (error && !form) return <ErrorNote error={error} />;
  const tab = TABS.find((t) => t.key === active);
  if (loading || !form) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHead title="Shop settings" subtitle="Commerce, contact details and storefront content." />
        <div className="flex gap-4 border-b border-ink-700 pb-2">{TABS.map((t) => <span key={t.key} className="skeleton h-5 w-20 rounded" />)}</div>
        <SkeletonForm fields={5} />
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHead title="Shop settings" subtitle="Commerce, contact details and storefront content. Legal and information pages live under Pages.">
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
              <Field label="Store name" hint="Legal business name for order emails. The SDK Appearance page controls the website name." htmlFor="s-name"><input id="s-name" value={form.store_name} onChange={set('store_name')} className="input" required autoFocus /></Field>
            </section>
            <section className="card flex flex-col gap-4 p-4">
              <h3 className="text-sm font-semibold text-mist">Addresses</h3>
              <Field label="Public store URL" hint="Optional. Payments return to the current website automatically. Set this to override the return address and provide a fixed address for email links." htmlFor="s-url"><input id="s-url" value={form.store_url} onChange={set('store_url')} className="input" placeholder="https://shop.example.com" /></Field>
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
              <p className="text-xs text-mist-dim">Only links you fill in are shown. The About page can show all of these details under its text: enable “Show the store's contact details” in <Link to="/admin/pages" className="text-accent">Pages</Link>.</p>
            </section>
          </>
        ) : null}

        {active === 'storefront' ? (
          <>
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
            <Notice tone="info">One flat rate applies to every destination for now. The wording customers read lives on the Shipping & returns page under <Link to="/admin/pages" className="underline">Pages</Link>.</Notice>
          </section>
        ) : null}


        {active === 'checkout' ? (
          <section className="card flex flex-col gap-4 p-4">
            <Field label="Order number prefix" hint="New orders continue the sequence with this prefix, e.g. SO-100042." htmlFor="s-prefix"><input id="s-prefix" value={form.order_reference_prefix} onChange={set('order_reference_prefix')} className="input font-mono" maxLength={10} autoFocus /></Field>
            <Field label="Checkout note" hint="Shown to customers on the checkout page (delivery times, returns…)." htmlFor="s-note"><textarea id="s-note" value={form.checkout_note} onChange={set('checkout_note')} className="textarea" rows={3} /></Field>
          </section>
        ) : null}
      </div>

    </form>
  );
};

export { Settings };
