import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthContext } from '@/shared/auth';
import { shopApi } from '@/storefront/services/shopApi';
import { useStore } from '@/storefront/store/StoreProvider';
import { errorMessage } from '@/shared/lib/errors';
import { Check } from 'lucide-react';
import { Breadcrumb } from '@/storefront/components/Breadcrumb';

const Field = ({ label, children, hint }) => (
  <label className="flex flex-col gap-1.5">
    <span className="label">{label}</span>
    {children}
    {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
  </label>
);

const Contact = () => {
  const { storeName, settings, pages } = useStore();
  const { currentUser } = useAuthContext();
  const [form, setForm] = useState({ name: '', email: '', subject: '', orderReference: '', message: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => { document.title = `Contact · ${storeName}`; }, [storeName]);
  useEffect(() => {
    const u = currentUser?.user;
    if (u) setForm((f) => ({ ...f, name: f.name || [u.name, u.surname].filter(Boolean).join(' '), email: f.email || u.emailAddress || '' }));
  }, [currentUser]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await shopApi.contact.send(form);
      setSent(true);
      toast.success('Message sent. We will get back to you soon.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const faq = (pages.footer ?? []).find((p) => /faq/i.test(p.Slug));
  const shipping = (pages.footer ?? []).find((p) => /ship|return|deliver/i.test(p.Slug));

  return (
    <div className="container-x py-14">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-20">
        <div className="flex flex-col gap-8">
          <div>
            <Breadcrumb items={[['Contact']]} />
            <h1 className="font-display mt-4 text-4xl tracking-tight text-zinc-900 sm:text-5xl">We’d love to hear from you.</h1>
            <p className="mt-4 text-lg leading-8 text-zinc-500">Questions about an order, a product, or anything else: send a note and a real person will reply{settings.contact_hours ? ` during ${settings.contact_hours.replace(/^\s*monday/i, 'Monday')}` : ''}.</p>
          </div>
          <dl className="flex flex-col gap-4 text-sm">
            {settings.support_email ? <div><dt className="eyebrow mb-1">Email</dt><dd><a href={`mailto:${settings.support_email}`} className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900">{settings.support_email}</a></dd></div> : null}
            {settings.contact_phone ? <div><dt className="eyebrow mb-1">Phone</dt><dd><a href={`tel:${settings.contact_phone}`} className="text-zinc-900">{settings.contact_phone}</a></dd></div> : null}
            {settings.contact_hours ? <div><dt className="eyebrow mb-1">Hours</dt><dd className="text-zinc-700">{settings.contact_hours}</dd></div> : null}
            {settings.contact_address ? <div><dt className="eyebrow mb-1">Address</dt><dd className="whitespace-pre-line text-zinc-700">{settings.contact_address}</dd></div> : null}
          </dl>
          {faq || shipping ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm">
              <p className="font-medium text-zinc-900">Looking for a quick answer?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {faq ? <Link to={`/pages/${faq.Slug}`} className="chip">{faq.Title}</Link> : null}
                {shipping ? <Link to={`/pages/${shipping.Slug}`} className="chip">{shipping.Title}</Link> : null}
                <Link to="/account" className="chip">Track an order</Link>
              </div>
            </div>
          ) : null}
        </div>

        <div className="card p-6 sm:p-8">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-7 w-7" aria-hidden="true" /></span>
              <p className="font-display text-2xl text-zinc-900">Thanks, your message is on its way.</p>
              <p className="max-w-sm text-sm text-zinc-500">We reply to {form.email}. If it is urgent, the details on the left reach us fastest.</p>
              <Link to="/shop" className="btn-ghost mt-4">Continue shopping</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Your name"><input value={form.name} onChange={set('name')} className="input" autoComplete="name" /></Field>
                <Field label="Email"><input type="email" required value={form.email} onChange={set('email')} className="input" autoComplete="email" /></Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Subject"><input value={form.subject} onChange={set('subject')} className="input" maxLength={200} placeholder="What is it about?" /></Field>
                <Field label="Order number" hint="Optional, e.g. SO-100042"><input value={form.orderReference} onChange={set('orderReference')} className="input font-mono" maxLength={40} /></Field>
              </div>
              <Field label="Message"><textarea required minLength={10} maxLength={5000} value={form.message} onChange={set('message')} className="textarea min-h-[10rem]" placeholder="Tell us how we can help." /></Field>
              {/* Honeypot: hidden from people, filled in by bots. */}
              <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label></div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-zinc-500">By sending this you agree to our {(pages.footer ?? []).some((p) => /privacy/i.test(p.Slug)) ? <Link to="/pages/privacy" className="underline">privacy policy</Link> : 'privacy policy'}.</p>
                <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Sending…' : 'Send message'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export { Contact };
