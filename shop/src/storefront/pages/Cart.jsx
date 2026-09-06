import { Link } from 'react-router-dom';
import { useCart } from '@/storefront/cart/CartProvider';
import { useStore } from '@/storefront/store/StoreProvider';
import { QtyStepper } from '@/storefront/components/QtyStepper';
import { FreeShippingBar } from '@/storefront/components/CartDrawer';
import { Img } from '@/shared/ui/ui';
import { Skeleton, SkeletonLines } from '@/shared/ui/skeleton';
import { PaymentsNotice, usePaymentsReady } from '@/storefront/components/PaymentsNotice';
import { fmtCents } from '@/shared/lib/money';
import { ShoppingBag } from 'lucide-react';
import { Breadcrumb } from '@/storefront/components/Breadcrumb';

const Cart = () => {
  const { items = [], subtotalCents = 0, issues = [], error, busy, loading, update, remove, clear } = useCart();
  const { currency, shippingFlatCents, freeShippingThresholdCents } = useStore();
  const shipping = items.length === 0 ? 0 : freeShippingThresholdCents > 0 && subtotalCents >= freeShippingThresholdCents ? 0 : shippingFlatCents;
  const total = subtotalCents + shipping;
  const payments = usePaymentsReady();
  const blocking = issues.some((i) => i.code === 'unavailable' || i.code === 'out_of_stock') || payments?.ready === false;

  return (
    <div className="container-x flex flex-col gap-6 py-8">
      <div className="flex flex-col gap-2"><Breadcrumb items={[['Cart']]} /><h1 className="font-display text-3xl tracking-tight">Your cart</h1></div>
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p> : null}
      <PaymentsNotice />
      {issues.length ? (
        <ul className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          {issues.map((i, n) => <li key={n}>{i.message}</li>)}
        </ul>
      ) : null}
      {loading ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="card px-4"><SkeletonLines count={3} /></div>
          <div className="card flex flex-col gap-3 p-5"><Skeleton className="h-4 w-24 rounded" /><Skeleton className="h-3 w-full rounded" /><Skeleton className="h-3 w-full rounded" /><Skeleton className="h-11 w-full rounded-xl" /></div>
        </div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-zinc-100 text-zinc-500"><ShoppingBag className="h-6 w-6" aria-hidden="true" /></span>
          <p className="text-lg font-medium text-zinc-900">Your cart is empty</p>
          <p className="text-sm text-zinc-500">Find something you love and it will show up here.</p>
          <Link to="/shop" className="btn-primary mt-3">Start shopping</Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ul className="card divide-y divide-zinc-100">
            {items.map((it) => (
              <li key={it.variantId} className={`ui-page flex gap-4 p-4 ${!it.isActive || it.availableQty <= 0 ? 'opacity-60' : ''}`}>
                <Link to={`/p/${it.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">{it.imageUrl ? <Img src={it.imageUrl} alt="" wrapClassName="h-full w-full" className="h-full w-full object-cover" /> : null}</Link>
                <div className="flex min-w-0 grow flex-col gap-1">
                  <Link to={`/p/${it.slug}`} className="font-medium text-zinc-900">{it.title}</Link>
                  {!it.isActive ? <p className="text-xs text-red-600">No longer available</p> : it.availableQty <= 0 ? <p className="text-xs text-red-600">Out of stock</p> : null}
                  {it.variantTitle && it.variantTitle !== 'Default' ? <p className="text-sm text-zinc-500">{it.variantTitle}</p> : null}
                  <p className="text-sm tabular-nums text-zinc-600">{fmtCents(it.unitPriceCents, currency)} each</p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                    <QtyStepper value={it.qty} max={it.availableQty} onChange={(q) => update(it.variantId, q)} />
                    <div className="flex items-center gap-4"><span className="font-semibold tabular-nums">{fmtCents(it.qty * it.unitPriceCents, currency)}</span><button type="button" onClick={() => remove(it.variantId)} className="text-sm text-zinc-500 hover:text-zinc-900">Remove</button></div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="card flex h-fit flex-col gap-3 p-5 lg:sticky lg:top-24">
            <h2 className="font-semibold">Summary</h2>
            <FreeShippingBar subtotalCents={subtotalCents} />
            <div className="flex justify-between text-sm"><span className="text-zinc-600">Subtotal</span><span className="tabular-nums">{fmtCents(subtotalCents, currency)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-zinc-600">Shipping</span><span className="tabular-nums">{shipping === 0 ? 'Free' : fmtCents(shipping, currency)}</span></div>
            <div className="flex justify-between border-t border-zinc-200 pt-3 text-base font-semibold"><span>Total</span><span className="tabular-nums">{fmtCents(total, currency)}</span></div>
            <Link to="/checkout" aria-disabled={busy || blocking} className={`btn-primary mt-2 h-11 ${busy || blocking ? 'pointer-events-none opacity-40' : ''}`} title={payments?.ready === false ? 'Payments are not available yet' : blocking ? 'Remove unavailable items first' : undefined}>{payments?.ready === false ? 'Checkout unavailable' : 'Checkout'}</Link>
            <p className="text-xs text-zinc-500">Secure card payment through Cloudgate Wallet. Prices include tax.</p>
            <button type="button" onClick={clear} className="text-xs text-zinc-500 hover:text-zinc-900">Empty cart</button>
          </aside>
        </div>
      )}
    </div>
  );
};

export { Cart };
