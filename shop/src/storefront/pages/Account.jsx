import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuthContext, redirectToLogin } from '@/shared/auth';
import { shopApi } from '@/storefront/services/shopApi';
import { useAsync, Img, fmtDate } from '@/shared/ui/ui';
import { Skeleton, SkeletonLines, SkeletonText } from '@/shared/ui/skeleton';
import { fmtCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { Package } from 'lucide-react';
import { Breadcrumb } from '@/storefront/components/Breadcrumb';

const TONES = {
  paid: 'bg-emerald-100 text-emerald-800', processing: 'bg-sky-100 text-sky-800', shipped: 'bg-sky-100 text-sky-800',
  delivered: 'bg-emerald-100 text-emerald-800', pending: 'bg-amber-100 text-amber-800', cancelled: 'bg-zinc-200 text-zinc-700', refunded: 'bg-red-100 text-red-800',
};
const Status = ({ s }) => <span className={`badge capitalize ${TONES[s] ?? 'bg-zinc-100 text-zinc-700'}`}>{s}</span>;

const STAGES = ['paid', 'processing', 'shipped', 'delivered'];

/** Where the order is on its way: paid → processing → shipped → delivered. */
const Progress = ({ status }) => {
  const idx = STAGES.indexOf(status);
  if (idx < 0) return null;
  return (
    <ol className="flex items-center gap-1" aria-label="Order progress">
      {STAGES.map((s, i) => (
        <li key={s} className="flex flex-1 flex-col gap-1.5">
          <span className={`h-1.5 rounded-full ${i <= idx ? 'bg-emerald-600' : 'bg-zinc-200'}`} />
          <span className={`text-[11px] capitalize ${i <= idx ? 'text-zinc-900' : 'text-zinc-400'}`}>{s}</span>
        </li>
      ))}
    </ol>
  );
};

const SignInPrompt = () => (
  <div className="container-x py-16">
    <div className="card mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">Your orders</h1>
      <p className="mt-2 text-sm text-zinc-600">Sign in to see your order history and track deliveries.</p>
      <button type="button" onClick={() => redirectToLogin(window.location.href)} className="btn-primary mt-6">Sign in</button>
    </div>
  </div>
);

const OrderList = () => {
  const [page, setPage] = useState(0);
  const take = 20;
  const res = useAsync(() => shopApi.account.orders({ skip: page * take, take }), [page]);
  const items = res.data?.items ?? [];
  const total = res.data?.total ?? 0;
  return (
    <div className="container-x flex flex-col gap-6 py-8">
      <div className="flex flex-col gap-2"><Breadcrumb items={[['Your orders']]} /><h1 className="font-display text-3xl tracking-tight">Your orders</h1></div>
      {res.error ? <p className="text-sm text-red-600">{errorMessage(res.error)}</p> : null}
      {res.loading ? <div className="card px-4"><SkeletonLines count={3} /></div> : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-zinc-100 text-zinc-500"><Package className="h-6 w-6" aria-hidden="true" /></span>
          <p className="text-lg font-medium text-zinc-900">No orders yet</p>
          <p className="text-sm text-zinc-500">Your purchases and their delivery status will show up here.</p>
          <Link to="/shop" className="btn-primary mt-3">Start shopping</Link>
        </div>
      ) : (
        <ul className="card divide-y divide-zinc-100">
          {items.map((o) => (
            <li key={o.Id}>
              <Link to={`/account/orders/${o.Reference}`} className="flex items-center gap-4 p-4 transition hover:bg-zinc-50">
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">{o.ImageUrl ? <Img src={o.ImageUrl} alt="" wrapClassName="h-full w-full" className="h-full w-full object-cover" /> : null}</span>
                <span className="min-w-0 grow">
                  <span className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-medium">{o.Reference}</span><Status s={o.Status} /></span>
                  <span className="block truncate text-sm text-zinc-600">{o.FirstTitle}{o.Items > 1 ? ` and ${o.Items - 1} more` : ''}</span>
                  <span className="block text-xs text-zinc-500">{fmtDate(o.CreatedAt)}</span>
                </span>
                <span className="tabular-nums font-semibold">{fmtCents(o.TotalCents, o.Currency)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > take ? (
        <div className="flex items-center justify-center gap-2">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="btn-ghost btn-sm">‹ Prev</button>
          <span className="text-sm text-zinc-600">{page + 1} / {Math.ceil(total / take)}</span>
          <button type="button" disabled={(page + 1) * take >= total} onClick={() => setPage(page + 1)} className="btn-ghost btn-sm">Next ›</button>
        </div>
      ) : null}
    </div>
  );
};

const OrderDetail = ({ reference }) => {
  const res = useAsync(() => shopApi.account.order(reference), [reference]);
  const o = res.data;
  if (res.loading) {
    return (
      <div className="container-x flex flex-col gap-6 py-8">
        <Skeleton className="h-3 w-40 rounded" /><Skeleton className="h-8 w-64 rounded" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><div className="card px-5"><SkeletonLines count={3} /></div><div className="flex flex-col gap-6"><div className="card p-5"><SkeletonText lines={4} /></div><div className="card p-5"><SkeletonText lines={3} /></div></div></div>
      </div>
    );
  }
  if (res.error || !o) return <div className="container-x py-16 text-center"><p>{errorMessage(res.error)}</p><Link to="/account" className="btn-ghost mt-6"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5 h-4 w-4" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg><span>Back to orders</span></Link></div>;
  const a = o.ShippingAddress;
  return (
    <div className="container-x flex flex-col gap-6 py-8">
      <Breadcrumb items={[['Your orders', '/account'], [o.Reference]]} />
      <div className="flex flex-wrap items-center gap-3"><h1 className="font-display text-3xl tracking-tight">Order {o.Reference}</h1><Status s={o.Status} /></div>
      <Progress status={o.Status} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="card p-5">
          <ul className="divide-y divide-zinc-100">
            {o.Items.map((i, n) => (
              <li key={n} className="flex items-center gap-3 py-3 text-sm">
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">{i.ImageUrl ? <Img src={i.ImageUrl} alt="" wrapClassName="h-full w-full" className="h-full w-full object-cover" /> : null}</span>
                <span className="min-w-0 grow"><span className="block">{i.Title}</span><span className="text-xs text-zinc-500">{i.VariantTitle && i.VariantTitle !== 'Default' ? `${i.VariantTitle} · ` : ''}× {i.Qty}</span></span>
                <span className="tabular-nums">{fmtCents(i.LineTotalCents, o.Currency)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-1 border-t border-zinc-200 pt-3 text-sm">
            <div className="flex justify-between"><span className="text-zinc-600">Subtotal</span><span className="tabular-nums">{fmtCents(o.SubtotalCents, o.Currency)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-600">Shipping</span><span className="tabular-nums">{o.ShippingCents ? fmtCents(o.ShippingCents, o.Currency) : 'Free'}</span></div>
            <div className="flex justify-between"><span className="text-zinc-600">Tax (included)</span><span className="tabular-nums">{fmtCents(o.TaxCents, o.Currency)}</span></div>
            <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="tabular-nums">{fmtCents(o.TotalCents, o.Currency)}</span></div>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div className="card p-5 text-sm">
            <h2 className="mb-2 font-semibold">Delivery</h2>
            <p className="whitespace-pre-line text-zinc-600">{[[o.Name, o.Surname].filter(Boolean).join(' '), a?.line1, a?.line2, [a?.city, a?.region].filter(Boolean).join(', '), [a?.postalCode, a?.country].filter(Boolean).join(' ')].filter(Boolean).join('\n')}</p>
            <p className="mt-2 text-xs text-zinc-500">{o.FulfillmentStatus === 'fulfilled' ? `Shipped ${fmtDate(o.ShippedAt)}` : 'Not shipped yet'}</p>
          </div>
          <div className="card p-5 text-sm">
            <h2 className="mb-2 font-semibold">History</h2>
            <ul className="flex flex-col gap-2">
              {o.Events.map((e, n) => <li key={n} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-900" /><span><span className="block">{e.Message}</span><span className="text-xs text-zinc-500">{fmtDate(e.CreatedAt)}</span></span></li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const Account = () => {
  const { loading, auth } = useAuthContext();
  const { reference } = useParams();
  if (loading) return <div className="container-x py-8"><div className="card px-4"><SkeletonLines count={3} /></div></div>;
  if (!auth?.accessToken) return <SignInPrompt />;
  return reference ? <OrderDetail reference={reference} /> : <OrderList />;
};

export { Account };
