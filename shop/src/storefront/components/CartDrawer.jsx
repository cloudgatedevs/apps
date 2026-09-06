import { Link } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { useCart } from '@/storefront/cart/CartProvider';
import { useStore } from '@/storefront/store/StoreProvider';
import { fmtCents } from '@/shared/lib/money';
import { QtyStepper } from '@/storefront/components/QtyStepper';
import { Img } from '@/shared/ui/ui';
import { PaymentsNotice } from '@/storefront/components/PaymentsNotice';
import { PartyPopper, ShoppingBag, X } from 'lucide-react';

/** Progress towards free shipping, shown in the drawer and on the cart page. */
export const FreeShippingBar = ({ subtotalCents, className = '' }) => {
  const { currency, freeShippingThresholdCents } = useStore();
  if (!freeShippingThresholdCents) return null;
  const pct = Math.min(100, Math.round((subtotalCents / freeShippingThresholdCents) * 100));
  const left = freeShippingThresholdCents - subtotalCents;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <p className="text-xs text-zinc-600">{left > 0 ? <>Add <span className="font-medium text-zinc-900">{fmtCents(left, currency)}</span> more for free shipping</> : <span className="inline-flex items-center gap-1 font-medium text-emerald-700"><PartyPopper className="h-3.5 w-3.5" aria-hidden="true" />You have free shipping</span>}</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200"><div className={`h-full rounded-full transition-[width] duration-500 ${left > 0 ? 'bg-zinc-900' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
};

const CartDrawer = () => {
  const { items, count, subtotalCents, update, remove, open, setOpen } = useCart();
  const { currency } = useStore();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-overlay fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-[2px]" />
        <Dialog.Content aria-label="Cart" className="ui-drawer-right fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col bg-white shadow-2xl outline-none" style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}>
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
            <Dialog.Title className="text-base font-semibold">Your cart {count ? `(${count})` : ''}</Dialog.Title>
            <Dialog.Description className="sr-only">Items in your cart</Dialog.Description>
            <Dialog.Close asChild><button type="button" className="btn-ghost btn-sm">Close</button></Dialog.Close>
          </div>
          <div className="min-h-0 grow overflow-y-auto px-5 py-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-zinc-100 text-zinc-500"><ShoppingBag className="h-5 w-5" aria-hidden="true" /></span>
                <p className="text-sm font-medium text-zinc-900">Your cart is empty</p>
                <p className="text-sm text-zinc-500">Find something you love and it will show up here.</p>
                <Link to="/shop" onClick={() => setOpen(false)} className="btn-primary mt-2">Browse the shop</Link>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100">
                {items.map((it) => (
                  <li key={it.variantId} className="ui-page flex gap-3 py-4">
                    <Link to={`/p/${it.slug}`} onClick={() => setOpen(false)} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                      {it.imageUrl ? <Img src={it.imageUrl} alt="" wrapClassName="h-full w-full" className="h-full w-full object-cover" /> : null}
                    </Link>
                    <div className="flex min-w-0 grow flex-col gap-1">
                      <Link to={`/p/${it.slug}`} onClick={() => setOpen(false)} className="truncate text-sm font-medium text-zinc-900">{it.title}</Link>
                      {it.variantTitle && it.variantTitle !== 'Default' ? <p className="text-xs text-zinc-500">{it.variantTitle}</p> : null}
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <QtyStepper value={it.qty} max={it.availableQty} onChange={(q) => update(it.variantId, q)} />
                        <span className="text-sm font-semibold tabular-nums">{fmtCents(it.qty * it.unitPriceCents, currency)}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => remove(it.variantId)} aria-label={`Remove ${it.title}`} className="self-start rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"><X className="h-4 w-4" aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {items.length ? (
            <div className="border-t border-zinc-200 px-5 py-4">
              <PaymentsNotice className="mb-4" />
              <FreeShippingBar subtotalCents={subtotalCents} className="mb-4" />
              <div className="mb-3 flex items-center justify-between text-sm"><span className="text-zinc-600">Subtotal</span><span className="font-semibold tabular-nums">{fmtCents(subtotalCents, currency)}</span></div>
              <p className="mb-3 text-xs text-zinc-500">Shipping and tax are calculated at checkout.</p>
              <div className="flex flex-col gap-2">
                <Link to="/checkout" onClick={() => setOpen(false)} className="btn-primary w-full">Checkout</Link>
                <Link to="/cart" onClick={() => setOpen(false)} className="btn-ghost w-full">Review cart</Link>
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export { CartDrawer };
