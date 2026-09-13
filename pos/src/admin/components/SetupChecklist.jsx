// "Set up your store" card on the dashboard: one line per thing a real store needs, each linking to
// where it is edited, ticked off as soon as the value exists. Hides itself once everything is done.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, usePreference } from '@/shared/ui/ui';
import { Skeleton } from '@/shared/ui/skeleton';
import { walletUrl } from '@/admin/components/WalletGate';
import { Check } from 'lucide-react';

const has = (v) => String(v ?? '').trim().length > 0;

const ITEMS = (s, counts) => [
  { key: 'name', label: 'Store name and address', done: has(s.store_name) && has(s.store_address), to: '/settings?tab=store', hint: 'Printed at the top of every receipt.' },
  { key: 'logo', label: 'Logo and icon', done: has(s.store_logo_url) || has(s.store_icon_url), to: '/settings?tab=store', hint: 'Shown on the till, the back office and receipts.' },
  { key: 'tax', label: 'Tax rate and VAT number', done: has(s.tax_number) && Number(s.tax_rate_bp) >= 0, to: '/settings?tab=money', hint: 'Receipts must show the tax they include.' },
  { key: 'receipt', label: 'Receipt header and footer', done: has(s.receipt_footer), to: '/settings?tab=receipt', hint: 'Returns policy, thank-you line, opening hours.' },
  { key: 'registers', label: 'A register for each till', done: (counts.registers ?? 0) > 0, to: '/registers', hint: 'Tellers open a shift on a register before selling.' },
  { key: 'products', label: 'Products with barcodes', done: (counts.activeProducts ?? 0) > 0, to: '/products', hint: 'Scan them in with the camera or import a spreadsheet.' },
  { key: 'tellers', label: 'Teller accounts', done: (counts.tellers ?? 0) > 0, to: '/tellers', hint: 'Create a user for each cashier in the Cloudgate hub; any role can use the till.' },
  { key: 'wallet', label: 'Cloudgate Wallet activated', done: counts.walletReady === true, to: walletUrl(), external: true, hint: 'Card payments run through the tenant wallet.' },
  { key: 'url', label: 'Public address of this app', done: has(s.store_url), to: '/settings?tab=store', hint: 'Card payments return the customer here.' },
];

const SetupChecklist = ({ activeProducts, walletReady, registers, tellers }) => {
  const settings = useAsync(() => adminApi.settings.get(), []);
  const [dismissed, setDismissed] = usePreference('admin.setup.dismissed', false);
  const [skipped, setSkipped] = usePreference('admin.setup.skipped', []);
  const skip = (key, on) => setSkipped((list) => (on ? [...new Set([...(list ?? []), key])] : (list ?? []).filter((k) => k !== key)));
  const items = useMemo(() => (settings.data ? ITEMS(settings.data, { activeProducts, walletReady, registers, tellers }).map((it) => ({ ...it, skipped: !it.done && (skipped ?? []).includes(it.key), done: it.done || (skipped ?? []).includes(it.key) })) : []), [settings.data, activeProducts, walletReady, registers, tellers, skipped]);
  const done = items.filter((i) => i.done).length;
  const complete = items.length > 0 && done === items.length;

  if (settings.error) return null;
  if (settings.loading) return <div className="card p-4"><Skeleton className="h-4 w-40 rounded" /><Skeleton className="mt-3 h-2 w-full rounded-full" /></div>;
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
          <p className="text-xs text-mist-muted">{done} of {items.length} done. Steps that do not apply can be skipped.</p>
        </div>
        <button type="button" onClick={() => setDismissed(true)} className="btn-ghost btn-sm">Hide for now</button>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.round((done / Math.max(1, items.length)) * 100)}%` }} /></div>
      <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.key} className="group relative">
            <Link to={it.to} {...(it.external ? { reloadDocument: true, target: '_blank', rel: 'noreferrer' } : {})} className={`flex items-start gap-3 rounded-lg px-2.5 py-2 pr-16 transition hover:bg-ink-900 ${it.done ? 'opacity-70' : ''}`}>
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${it.skipped ? 'bg-ink-600 text-white' : it.done ? 'bg-emerald-500 text-white' : 'border border-ink-600 bg-white'}`}>{it.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}</span>
              <span className="min-w-0"><span className={`block text-sm ${it.done ? 'text-mist-muted line-through decoration-ink-500' : 'font-medium text-mist'}`}>{it.label}</span><span className="block text-xs text-mist-dim">{it.skipped ? 'Skipped.' : it.hint}</span></span>
            </Link>
            {it.skipped ? <button type="button" onClick={() => skip(it.key, false)} className="absolute right-2 top-2 text-xs text-accent hover:text-accent-600">Undo</button>
              : !it.done ? <button type="button" onClick={() => skip(it.key, true)} title="Does not apply to this store" className="absolute right-2 top-2 text-xs text-mist-dim opacity-0 transition hover:text-mist focus:opacity-100 group-hover:opacity-100">Skip</button> : null}
          </li>
        ))}
      </ul>
    </section>
  );
};

export { SetupChecklist };
