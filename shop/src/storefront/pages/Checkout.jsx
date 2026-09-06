import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/shared/auth';
import { useCart } from '@/storefront/cart/CartProvider';
import { useStore } from '@/storefront/store/StoreProvider';
import { shopApi } from '@/storefront/services/shopApi';
import { Img } from '@/shared/ui/ui';
import { Skeleton, SkeletonLines } from '@/shared/ui/skeleton';
import { PaymentsNotice, usePaymentsReady } from '@/storefront/components/PaymentsNotice';
import { fmtCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { Check } from 'lucide-react';
import { Breadcrumb } from '@/storefront/components/Breadcrumb';
import { VerifiedLink } from '@/storefront/components/VerifiedBadge';

const STORAGE_KEY = 'shop.checkout.details';
const COUNTRIES = [['ZA', 'South Africa'], ['NA', 'Namibia'], ['BW', 'Botswana'], ['GB', 'United Kingdom'], ['US', 'United States']];
const STEPS = [['contact', 'Contact'], ['delivery', 'Delivery'], ['review', 'Review & pay']];

const empty = { email: '', name: '', surname: '', phone: '', line1: '', line2: '', city: '', region: '', postalCode: '', country: 'ZA', customerNote: '' };

const readSaved = () => {
  try {
    return { ...empty, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')) };
  } catch {
    return empty;
  }
};

const Field = ({ label, children, className = '' }) => (
  <label className={`flex flex-col gap-1.5 ${className}`}>
    <span className="label">{label}</span>
    {children}
  </label>
);

const Stepper = ({ step, onStep }) => (
  <ol className="flex items-center gap-2 text-sm" aria-label="Checkout progress">
    {STEPS.map(([key, label], i) => {
      const done = STEPS.findIndex(([k]) => k === step) > i;
      const active = key === step;
      return (
        <li key={key} className="flex items-center gap-2">
          <button type="button" onClick={() => done && onStep(key)} disabled={!done} className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition ${active ? 'bg-primary text-primary-fg' : done ? 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200' : 'text-zinc-400'}`}>
            <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${active ? 'bg-white text-zinc-900' : done ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-500'}`}>{done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}</span>
            <span className={active ? 'font-medium' : ''}>{label}</span>
          </button>
          {i < STEPS.length - 1 ? <span className="h-px w-6 bg-zinc-300" aria-hidden="true" /> : null}
        </li>
      );
    })}
  </ol>
);

const Checkout = () => {
  const navigate = useNavigate();
  const { items, subtotalCents, issues, token, loading, refresh } = useCart();
  const { currency, settings, shippingFlatCents, freeShippingThresholdCents } = useStore();
  const { currentUser } = useAuthContext();
  const [form, setForm] = useState(readSaved);
  const [step, setStep] = useState('contact');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const sectionRef = useRef(null);

  // Prefill from the signed-in customer once.
  useEffect(() => {
    const u = currentUser?.user;
    if (!u) return;
    setForm((f) => ({ ...f, email: f.email || u.emailAddress || '', name: f.name || u.name || '', surname: f.surname || u.surname || '' }));
  }, [currentUser]);

  useEffect(() => {
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const shipping = items.length === 0 ? 0 : freeShippingThresholdCents > 0 && subtotalCents >= freeShippingThresholdCents ? 0 : shippingFlatCents;
  const total = subtotalCents + shipping;
  const payments = usePaymentsReady();
  const blocking = issues.some((i) => i.code === 'unavailable' || i.code === 'out_of_stock' || i.code === 'reduced') || payments?.ready === false;

  // Validate only the visible section's fields before moving on.
  const next = (to) => {
    const inputs = sectionRef.current?.querySelectorAll('input, select, textarea') ?? [];
    for (const el of inputs) {
      if (!el.checkValidity()) { el.reportValidity(); return; }
    }
    setError(null);
    setStep(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (step !== 'review') return next(step === 'contact' ? 'delivery' : 'review');
    setError(null);
    if (!items.length) return setError('Your cart is empty.');
    if (blocking) return setError('Please fix the items flagged in your cart first.');
    setSubmitting(true);
    try {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...form, customerNote: '' })); } catch { /* ignore */ }
      const res = await shopApi.checkout.start(token, {
        email: form.email.trim(), name: form.name.trim(), surname: form.surname.trim(), phone: form.phone.trim(),
        shippingAddress: { line1: form.line1, line2: form.line2, city: form.city, region: form.region, postalCode: form.postalCode, country: form.country },
        customerNote: form.customerNote,
      });
      try { localStorage.setItem('shop.lastOrder', JSON.stringify({ reference: res.reference, token, at: Date.now() })); } catch { /* ignore */ }
      if (res?.paymentUrl) window.location.assign(res.paymentUrl);
      else navigate(`/checkout/return?ref=${encodeURIComponent(res.reference)}`);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
      refresh().catch(() => {});
    }
    return undefined;
  };

  if (loading) {
    return (
      <div className="container-x grid gap-8 py-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6"><Skeleton className="h-8 w-40 rounded" /><Skeleton className="h-8 w-80 rounded-full" /><div className="card flex flex-col gap-4 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}</div></div>
        <div className="card p-5"><SkeletonLines count={2} /><Skeleton className="mt-4 h-11 w-full rounded-xl" /></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-x py-16 text-center">
        <p className="text-lg font-medium">Your cart is empty.</p>
        <Link to="/shop" className="btn-primary mt-6">Start shopping</Link>
      </div>
    );
  }

  const addressLines = [form.line1, form.line2, [form.city, form.region].filter(Boolean).join(', '), [form.postalCode, COUNTRIES.find(([c]) => c === form.country)?.[1]].filter(Boolean).join(' ')].filter(Boolean);

  return (
    <form onSubmit={submit} noValidate={false} className="container-x grid gap-8 py-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2"><Breadcrumb items={[['Cart', '/cart'], ['Checkout']]} /><h1 className="font-display text-3xl tracking-tight">Checkout</h1></div>
          <Stepper step={step} onStep={setStep} />
        </div>
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p> : null}
        <PaymentsNotice />
        {issues.length ? <ul className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{issues.map((i, n) => <li key={n}>{i.message}</li>)}</ul> : null}

        <div key={step} ref={sectionRef} className="ui-page flex flex-col gap-6">
          {step === 'contact' ? (
            <section className="card flex flex-col gap-4 p-5">
              <h2 className="font-semibold">Contact</h2>
              <Field label="Email (order confirmation and receipt)"><input type="email" required value={form.email} onChange={set('email')} className="input" autoComplete="email" autoFocus /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name"><input required value={form.name} onChange={set('name')} className="input" autoComplete="given-name" /></Field>
                <Field label="Last name"><input required value={form.surname} onChange={set('surname')} className="input" autoComplete="family-name" /></Field>
              </div>
              <Field label="Phone (for the courier)"><input value={form.phone} onChange={set('phone')} className="input" autoComplete="tel" inputMode="tel" /></Field>
              <div className="flex justify-end"><button type="button" onClick={() => next('delivery')} className="btn-primary">Continue to delivery</button></div>
            </section>
          ) : null}

          {step === 'delivery' ? (
            <section className="card flex flex-col gap-4 p-5">
              <h2 className="font-semibold">Delivery address</h2>
              <Field label="Street address"><input required value={form.line1} onChange={set('line1')} className="input" autoComplete="address-line1" autoFocus /></Field>
              <Field label="Apartment, suite, etc. (optional)"><input value={form.line2} onChange={set('line2')} className="input" autoComplete="address-line2" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City"><input required value={form.city} onChange={set('city')} className="input" autoComplete="address-level2" /></Field>
                <Field label="Province / region"><input value={form.region} onChange={set('region')} className="input" autoComplete="address-level1" /></Field>
                <Field label="Postal code"><input required value={form.postalCode} onChange={set('postalCode')} className="input" autoComplete="postal-code" /></Field>
                <Field label="Country">
                  <select required value={form.country} onChange={set('country')} className="select" autoComplete="country">
                    {COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Order note (optional)"><textarea value={form.customerNote} onChange={set('customerNote')} className="textarea" rows={2} maxLength={1000} /></Field>
              <div className="flex justify-between"><button type="button" onClick={() => setStep('contact')} className="btn-ghost">Back</button><button type="button" onClick={() => next('review')} className="btn-primary">Review order</button></div>
            </section>
          ) : null}

          {step === 'review' ? (
            <section className="card flex flex-col gap-5 p-5">
              <h2 className="font-semibold">Review</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 p-4 text-sm">
                  <div className="mb-1 flex items-center justify-between"><span className="label">Contact</span><button type="button" onClick={() => setStep('contact')} className="text-xs text-zinc-500 underline hover:text-zinc-900">Edit</button></div>
                  <p className="text-zinc-900">{form.name} {form.surname}</p><p className="text-zinc-600">{form.email}</p>{form.phone ? <p className="text-zinc-600">{form.phone}</p> : null}
                </div>
                <div className="rounded-xl border border-zinc-200 p-4 text-sm">
                  <div className="mb-1 flex items-center justify-between"><span className="label">Delivery</span><button type="button" onClick={() => setStep('delivery')} className="text-xs text-zinc-500 underline hover:text-zinc-900">Edit</button></div>
                  <p className="whitespace-pre-line text-zinc-600">{addressLines.join('\n')}</p>
                </div>
              </div>
              {form.customerNote ? <p className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600"><span className="label mr-2">Note</span>{form.customerNote}</p> : null}
              <div className="flex items-center justify-between"><button type="button" onClick={() => setStep('delivery')} className="btn-ghost">Back</button><button type="submit" disabled={submitting || blocking} className="btn-primary h-11">{submitting ? 'Preparing secure payment…' : `Pay ${fmtCents(total, currency)}`}</button></div>
            </section>
          ) : null}
        </div>
      </div>

      <aside className="card flex h-fit flex-col gap-3 p-5 lg:sticky lg:top-24">
        <h2 className="font-semibold">Order summary</h2>
        <ul className="flex flex-col divide-y divide-zinc-100">
          {items.map((it) => (
            <li key={it.variantId} className="flex items-center gap-3 py-3 text-sm">
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">{it.imageUrl ? <Img src={it.imageUrl} alt="" wrapClassName="h-full w-full" className="h-full w-full object-cover" /> : null}</span>
              <span className="min-w-0 grow"><span className="block truncate text-zinc-900">{it.title}</span><span className="text-xs text-zinc-500">{it.variantTitle && it.variantTitle !== 'Default' ? `${it.variantTitle} · ` : ''}× {it.qty}</span></span>
              <span className="tabular-nums">{fmtCents(it.lineTotalCents, currency)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between text-sm"><span className="text-zinc-600">Subtotal</span><span className="tabular-nums">{fmtCents(subtotalCents, currency)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-zinc-600">Shipping</span><span className="tabular-nums">{shipping === 0 ? 'Free' : fmtCents(shipping, currency)}</span></div>
        <div className="flex justify-between border-t border-zinc-200 pt-3 text-base font-semibold"><span>Total</span><span className="tabular-nums">{fmtCents(total, currency)}</span></div>
        {step === 'review' ? <button type="submit" disabled={submitting || loading || blocking} className="btn-primary mt-2 h-11">{submitting ? 'Preparing secure payment…' : `Pay ${fmtCents(total, currency)}`}</button> : <p className="mt-1 text-xs text-zinc-500">Complete the steps to pay.</p>}
        <p className="text-xs text-zinc-500">You will be taken to a secure card payment page powered by Cloudgate Wallet, then brought back here.</p>
        <VerifiedLink />
        {settings.checkout_note ? <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">{settings.checkout_note}</p> : null}
        <Link to="/cart" className="text-xs text-zinc-500 hover:text-zinc-900"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5 h-4 w-4" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg><span>Back to cart</span></Link>
      </aside>
    </form>
  );
};

export { Checkout };
