// "Set up your store" card on the dashboard: one line per thing a real store needs, each linking to
// where it is edited, ticked off as soon as the value exists. Hides itself once everything is done
// (a "show again" toggle lives in the collapsed footer).
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, usePreference } from '@/shared/ui/ui';
import { Skeleton } from '@/shared/ui/skeleton';
import { walletUrl } from '@/admin/components/WalletGate';

const has = (v) => String(v ?? '').trim().length > 0;

const ITEMS = (s, pages, counts) => {
  const page = (slug) => pages.find((p) => p.Slug === slug);
  const edited = (slug) => { const p = page(slug); return !!p && p.UpdatedAt !== p.CreatedAt && p.Status === 'published'; };
  return [
    { key: 'name', label: 'Store name and tagline', done: has(s.store_name) && has(s.store_tagline), to: '/settings?tab=store', hint: 'Shown in the header, emails and the browser tab.' },
    { key: 'logo', label: 'Logo and store icon', done: has(s.store_logo_url) || has(s.store_icon_url), to: '/settings?tab=store', hint: 'Header mark and the browser favicon.' },
    { key: 'url', label: 'Public store address', done: has(s.store_url), to: '/settings?tab=store', hint: 'Payment providers return customers here.' },
    { key: 'contact', label: 'Contact details', done: has(s.support_email) && (has(s.contact_phone) || has(s.contact_address)), to: '/settings?tab=contact', hint: 'Support email, phone, address and hours.' },
    { key: 'social', label: 'Social media links', done: ['social_instagram', 'social_facebook', 'social_x', 'social_tiktok'].some((k) => has(s[k])), to: '/settings?tab=contact', hint: 'Shown in the footer and on About pages.' },
    { key: 'about', label: 'About us page', done: edited('about'), to: page('about') ? `/pages/${page('about').Id}` : '/pages', hint: 'Ticks once you save your own wording over the template.' },
    { key: 'terms', label: 'Terms of service', done: edited('terms'), to: page('terms') ? `/pages/${page('terms').Id}` : '/pages', hint: 'Ticks once you save the template with your own wording.' },
    { key: 'privacy', label: 'Privacy policy', done: edited('privacy'), to: page('privacy') ? `/pages/${page('privacy').Id}` : '/pages', hint: 'Ticks once you save what you collect and why.' },
    { key: 'shipping', label: 'Shipping & returns page and rates', done: edited('shipping-returns') && has(s.shipping_flat_cents), to: page('shipping-returns') ? `/pages/${page('shipping-returns').Id}` : '/pages', hint: 'Save the page with your delivery promise; rates live under Settings › Shipping.' },
    { key: 'wallet', label: 'Cloudgate Wallet activated', done: counts.walletReady === true, to: walletUrl(), external: true, hint: 'Card payments run through the tenant wallet; onboarding happens in the Cloudgate hub.' },
    { key: 'products', label: 'First product published', done: (counts.activeProducts ?? 0) > 0, to: '/products', hint: 'At least one active product with a photo.' },
  ];
};

const IconCheck = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12l5 5L20 7" /></svg>;

const SetupChecklist = ({ activeProducts, walletReady }) => {
  const settings = useAsync(() => adminApi.settings.get(), []);
  const pages = useAsync(() => adminApi.pages.list(), []);
  const [dismissed, setDismissed] = usePreference('admin.setup.dismissed', false);
  // Steps the owner cannot or does not want to do (no social accounts, no logo yet) can be skipped
  // per item; a skipped step counts as done but stays visible with an Undo.
  const [skipped, setSkipped] = usePreference('admin.setup.skipped', []);
  const skip = (key, on) => setSkipped((list) => (on ? [...new Set([...(list ?? []), key])] : (list ?? []).filter((k) => k !== key)));
  const items = useMemo(() => (settings.data && pages.data ? ITEMS(settings.data, pages.data, { activeProducts, walletReady }).map((it) => ({ ...it, skipped: !it.done && (skipped ?? []).includes(it.key), done: it.done || (skipped ?? []).includes(it.key) })) : []), [settings.data, pages.data, activeProducts, walletReady, skipped]);
  const done = items.filter((i) => i.done).length;
  const complete = items.length > 0 && done === items.length;

  if (settings.error || pages.error) return null;
  if (settings.loading || pages.loading) return <div className="card p-4"><Skeleton className="h-4 w-40 rounded" /><Skeleton className="mt-3 h-2 w-full rounded-full" /></div>;
  if (dismissed || complete) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-dashed border-ink-600 px-4 py-2 text-xs text-mist-dim">
        <span>{complete ? 'Store setup complete.' : `Store setup: ${done} of ${items.length} done.`}</span>
        {!complete ? <button type="button" onClick={() => setDismissed(false)} className="text-accent hover:text-accent-600">Show checklist</button> : null}
      </div>
    );
  }

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-mist">Set up your store</h2>
          <p className="text-xs text-mist-muted">{done} of {items.length} done. Everything a customer sees is configured here, not in code. Steps that do not apply to your store can be skipped.</p>
        </div>
        <button type="button" onClick={() => setDismissed(true)} className="btn-ghost btn-sm">Hide for now</button>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.round((done / Math.max(1, items.length)) * 100)}%` }} /></div>
      <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.key} className="group relative">
            <Link to={it.to} {...(it.external ? { reloadDocument: true, target: '_blank', rel: 'noreferrer' } : {})} className={`flex items-start gap-3 rounded-lg px-2.5 py-2 pr-16 transition hover:bg-ink-900 ${it.done ? 'opacity-70' : ''}`}>
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${it.skipped ? 'bg-ink-600 text-white' : it.done ? 'bg-emerald-500 text-white' : 'border border-ink-600 bg-white'}`}>{it.done ? <IconCheck className="h-3 w-3" /> : null}</span>
              <span className="min-w-0"><span className={`block text-sm ${it.done ? 'text-mist-muted line-through decoration-ink-500' : 'font-medium text-mist'}`}>{it.label}</span><span className="block text-xs text-mist-dim">{it.skipped ? 'Skipped.' : it.hint}</span></span>
            </Link>
            {it.skipped ? (
              <button type="button" onClick={() => skip(it.key, false)} className="absolute right-2 top-2 text-xs text-accent hover:text-accent-600">Undo</button>
            ) : !it.done ? (
              <button type="button" onClick={() => skip(it.key, true)} title="Does not apply to this store" className="absolute right-2 top-2 text-xs text-mist-dim opacity-0 transition hover:text-mist focus:opacity-100 group-hover:opacity-100">Skip</button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
};

export { SetupChecklist };
