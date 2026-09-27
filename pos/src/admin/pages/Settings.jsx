import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Store, Receipt as ReceiptIcon, Coins, Monitor } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, PageHead } from '@/shared/ui/ui';
import { SkeletonForm } from '@/shared/ui/skeleton';
import { Field, Notice } from '@/shared/ui/forms';
import { errorMessage } from '@/shared/lib/errors';
import { LABEL_SIZES } from '@/admin/components/LabelSheet';


const TABS = [
  { key: 'store', label: 'Store', icon: Store, hint: 'Who you are: legal store name, address, contact details and payment-return address.', fields: ['store_name', 'store_tagline', 'store_address', 'store_phone', 'support_email', 'store_url'] },
  { key: 'receipt', label: 'Receipts', icon: ReceiptIcon, hint: 'What is printed on every receipt, receipt numbering and the label size for your printer.', fields: ['receipt_header', 'receipt_footer', 'tax_number', 'sale_reference_prefix', 'label_size'] },
  { key: 'money', label: 'Money', icon: Coins, hint: 'Currency and tax.', fields: ['currency', 'tax_rate', 'prices_include_tax'] },
  { key: 'till', label: 'Till', icon: Monitor, hint: 'How the tills behave: payment methods, shifts, stock rules and the quick-cash buttons.', fields: ['payment_cash_enabled', 'payment_card_enabled', 'require_shift', 'allow_negative_stock', 'low_stock_threshold', 'quick_cash_amounts'] },
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

  useEffect(() => {
    if (!data) return;
    const next = {
      store_name: data.store_name ?? '', store_tagline: data.store_tagline ?? '', store_address: data.store_address ?? '', store_phone: data.store_phone ?? '', support_email: data.support_email ?? '', store_url: data.store_url ?? '',
      receipt_header: data.receipt_header ?? '', receipt_footer: data.receipt_footer ?? '', tax_number: data.tax_number ?? '', sale_reference_prefix: data.sale_reference_prefix ?? 'R-', label_size: LABEL_SIZES[data.label_size] ? data.label_size : 'medium',
      currency: data.currency ?? 'ZAR', prices_include_tax: data.prices_include_tax !== '0', tax_rate: String((Number(data.tax_rate_bp ?? 0) / 100).toFixed(2)),
      payment_cash_enabled: data.payment_cash_enabled !== '0', payment_card_enabled: data.payment_card_enabled !== '0', require_shift: data.require_shift !== '0', allow_negative_stock: data.allow_negative_stock === '1',
      low_stock_threshold: data.low_stock_threshold ?? '5', quick_cash_amounts: data.quick_cash_amounts ?? '20,50,100,200',
    };
    setForm(next); setSaved(next);
  }, [data]);

  const dirtyTabs = new Set(form && saved ? TABS.filter((t) => t.fields.some((f) => form[f] !== saved[f])).map((t) => t.key) : []);
  const dirty = dirtyTabs.size > 0;
  useEffect(() => { if (!dirty) return undefined; const h = (e) => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const payload = () => ({
    store_name: form.store_name.trim(), store_tagline: form.store_tagline.trim(), store_address: form.store_address, store_phone: form.store_phone.trim(), support_email: form.support_email.trim(), store_url: form.store_url.trim(),
    receipt_header: form.receipt_header, receipt_footer: form.receipt_footer, tax_number: form.tax_number.trim(), sale_reference_prefix: form.sale_reference_prefix.trim() || 'R-', label_size: form.label_size,
    currency: form.currency.trim().toUpperCase(), prices_include_tax: form.prices_include_tax, tax_rate_bp: Math.round(Number(form.tax_rate || 0) * 100),
    payment_cash_enabled: form.payment_cash_enabled, payment_card_enabled: form.payment_card_enabled, require_shift: form.require_shift, allow_negative_stock: form.allow_negative_stock,
    low_stock_threshold: Math.max(0, Math.round(Number(form.low_stock_threshold || 0))), quick_cash_amounts: form.quick_cash_amounts.split(',').map((s) => s.trim()).filter((s) => s && !Number.isNaN(Number(s))).join(','),
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
    ].filter(Boolean);
    if (problems.length) { setActive(problems[0][0]); toast.error(problems[0][1]); return false; }
    return true;
  };

  const persist = async () => {
    await adminApi.settings.set(payload());
    setForm((f) => { const next = { ...f }; setSaved(next); return next; });
  };
  const save = async (e) => { e.preventDefault(); if (!validate()) return; setSaving(true); try { await persist(); toast.success('Settings saved.'); } catch (err) { toast.error(errorMessage(err)); } finally { setSaving(false); } };
  const discard = () => { setForm(saved); toast('Changes discarded.'); };

  if (error && !form) return <ErrorNote error={error} />;
  const tab = TABS.find((t) => t.key === active);
  if (loading || !form) return <div className="mx-auto flex w-full max-w-3xl flex-col gap-6"><PageHead title="POS settings" /><SkeletonForm fields={5} /></div>;

  return (
    <form onSubmit={save} className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHead title="POS settings" subtitle="Store details, receipts, tax and till rules.">
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
              <Field label="Store name" hint="Legal business name printed on receipts. Appearance controls the app name." htmlFor="s-name"><input id="s-name" value={form.store_name} onChange={set('store_name')} className="input" required autoFocus /></Field>
              <Field label="Tagline" htmlFor="s-tag"><input id="s-tag" value={form.store_tagline} onChange={set('store_tagline')} className="input" maxLength={200} /></Field>
              <Field label="Address" hint="Printed under the store name on receipts." htmlFor="s-address"><textarea id="s-address" value={form.store_address} onChange={set('store_address')} className="textarea" rows={3} maxLength={400} placeholder={'12 Long Street\nCape Town, 8001'} /></Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Phone" htmlFor="s-phone"><input id="s-phone" value={form.store_phone} onChange={set('store_phone')} className="input" maxLength={60} /></Field>
                <Field label="Support e-mail" hint="Default sender for e-mailed receipts." htmlFor="s-mail"><input id="s-mail" type="email" value={form.support_email} onChange={set('support_email')} className="input" /></Field>
              </div>
            </section>
            <section className="card flex flex-col gap-4 p-4">
              <h3 className="text-sm font-semibold text-mist">Public address</h3>
              <Field label="URL of this app" hint="Optional. Payments return to the current website automatically. Set this to override the return address, for example when the till uses a different address." htmlFor="s-url"><input id="s-url" value={form.store_url} onChange={set('store_url')} className="input" placeholder="https://pos.example.com" /></Field>
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

      </div>
    </form>
  );
};

export { Settings };
