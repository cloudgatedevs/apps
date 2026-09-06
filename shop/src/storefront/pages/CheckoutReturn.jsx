import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '@/storefront/cart/CartProvider';
import { shopApi } from '@/storefront/services/shopApi';
import { fmtCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { Check, X } from 'lucide-react';

const POLL_MS = 2500;
const MAX_POLLS = 40; // ~100 seconds; after that the customer gets a "check again" button

const readLastOrder = () => {
  try {
    return JSON.parse(localStorage.getItem('shop.lastOrder') || 'null');
  } catch {
    return null;
  }
};

/**
 * Landing page after the hosted payment page. Polls payment-status, which
 * re-reads the wallet and finalises the order the moment it is paid.
 */
const CheckoutReturn = () => {
  const [params] = useSearchParams();
  const reference = params.get('ref') || readLastOrder()?.reference || '';
  const { token, reset } = useCart();
  const cartToken = token || readLastOrder()?.token || null;
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [polls, setPolls] = useState(0);
  const timer = useRef(null);

  const check = async () => {
    try {
      const o = await shopApi.checkout.status(reference, cartToken);
      setOrder(o);
      setError(null);
      if (o.paymentStatus === 'paid') {
        reset();
        return true;
      }
      if (o.status === 'cancelled') return true;
      return false;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  };

  useEffect(() => {
    if (!reference) return undefined;
    let cancelled = false;
    const loop = async () => {
      const done = await check();
      if (cancelled || done) return;
      setPolls((p) => p + 1);
    };
    loop();
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  useEffect(() => {
    if (!order || order.paymentStatus === 'paid' || order.status === 'cancelled' || polls === 0 || polls > MAX_POLLS) return undefined;
    timer.current = setTimeout(async () => {
      const done = await check();
      if (!done) setPolls((p) => p + 1);
    }, POLL_MS);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polls]);

  if (!reference) {
    return <div className="container-x py-16 text-center"><p className="text-lg font-medium">No order reference.</p><Link to="/shop" className="btn-primary mt-6"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5 h-4 w-4" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg><span>Back to the shop</span></Link></div>;
  }

  const paid = order?.paymentStatus === 'paid';
  const cancelled = order?.status === 'cancelled';
  const waiting = !order || (!paid && !cancelled);

  return (
    <div className="container-x flex flex-col gap-6 py-10">
      <div className="card mx-auto w-full max-w-2xl p-8 text-center">
        {paid ? (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-7 w-7" aria-hidden="true" /></div>
            <h1 className="font-display mt-4 text-3xl tracking-tight">Thank you, your order is confirmed</h1>
            <p className="mt-2 text-zinc-600">Order <span className="font-mono font-medium text-zinc-900">{order.reference}</span>. A confirmation is on its way to {order.email}.</p>
          </>
        ) : cancelled ? (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-100 text-red-700"><X className="h-7 w-7" aria-hidden="true" /></div>
            <h1 className="font-display mt-4 text-3xl tracking-tight">Payment was not completed</h1>
            <p className="mt-2 text-zinc-600">Order {order.reference} was cancelled and nothing was charged. Your cart is still here if you want to try again.</p>
            <Link to="/cart" className="btn-primary mt-6"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5 h-4 w-4" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg><span>Back to cart</span></Link>
          </>
        ) : (
          <>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900" />
            <h1 className="font-display mt-4 text-3xl tracking-tight">Confirming your payment…</h1>
            <p className="mt-2 text-zinc-600">Order <span className="font-mono">{reference}</span>. This usually takes a few seconds.</p>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            {polls > MAX_POLLS ? (
              <div className="mt-6 flex flex-col items-center gap-3">
                <p className="text-sm text-zinc-600">Still waiting for the payment provider. If you completed payment, it will be confirmed shortly.</p>
                <button type="button" onClick={() => { setPolls(1); check(); }} className="btn-ghost">Check again</button>
                {order?.paymentUrl ? <a href={order.paymentUrl} className="text-sm text-zinc-600 underline">Return to the payment page</a> : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      {order?.items?.length ? (
        <div className="card mx-auto w-full max-w-2xl p-6">
          <h2 className="mb-3 font-semibold">Order details</h2>
          <ul className="divide-y divide-zinc-100">
            {order.items.map((i, n) => (
              <li key={n} className="flex items-center gap-3 py-3 text-sm">
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">{i.ImageUrl ? <img src={i.ImageUrl} alt="" className="h-full w-full object-cover" /> : null}</span>
                <span className="min-w-0 grow"><span className="block truncate">{i.Title}</span><span className="text-xs text-zinc-500">{i.VariantTitle && i.VariantTitle !== 'Default' ? `${i.VariantTitle} · ` : ''}× {i.Qty}</span></span>
                <span className="tabular-nums">{fmtCents(i.LineTotalCents, order.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-1 border-t border-zinc-200 pt-3 text-sm">
            <div className="flex justify-between"><span className="text-zinc-600">Subtotal</span><span className="tabular-nums">{fmtCents(order.subtotalCents, order.currency)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-600">Shipping</span><span className="tabular-nums">{order.shippingCents ? fmtCents(order.shippingCents, order.currency) : 'Free'}</span></div>
            <div className="flex justify-between"><span className="text-zinc-600">Tax (included)</span><span className="tabular-nums">{fmtCents(order.taxCents, order.currency)}</span></div>
            <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="tabular-nums">{fmtCents(order.totalCents, order.currency)}</span></div>
          </div>
          {order.shippingAddress ? (
            <p className="mt-4 whitespace-pre-line text-sm text-zinc-600">
              Delivering to {order.name}
              {'\n'}{[order.shippingAddress.line1, order.shippingAddress.line2, [order.shippingAddress.city, order.shippingAddress.region].filter(Boolean).join(', '), [order.shippingAddress.postalCode, order.shippingAddress.country].filter(Boolean).join(' ')].filter(Boolean).join('\n')}
            </p>
          ) : null}
        </div>
      ) : null}

      {paid ? <div className="text-center"><Link to="/shop" className="btn-ghost">Continue shopping</Link></div> : null}
    </div>
  );
};

export { CheckoutReturn };
