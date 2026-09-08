import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { RefundRequests } from '@/shared/ui/RefundRequests';
import { refundMessage } from '@/shared/services/refunds';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Badge, PageHead, Img, fmtDate, fmtRelative } from '@/shared/ui/ui';
import { SkeletonDetail } from '@/shared/ui/skeleton';
import { Field, Modal } from '@/shared/ui/forms';
import { Dropdown, Tooltip } from '@/shared/ui/menus';
import { fromCents, toCents } from '@/shared/lib/money';
import { fmtCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { orderStatusTone, paymentStatusTone } from '@/admin/pages/Orders';
import { useLiveEvents } from '@/admin/services/live';
import { ExternalLink } from 'lucide-react';

const NEXT = {
  pending: ['cancelled'],
  paid: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
};

const Address = ({ a }) => {
  if (!a || typeof a !== 'object') return <span className="text-mist-dim">—</span>;
  const lines = [a.line1, a.line2, [a.city, a.region].filter(Boolean).join(', '), [a.postalCode, a.country].filter(Boolean).join(' ')].filter(Boolean);
  return <span className="whitespace-pre-line text-mist-muted">{lines.join('\n') || '—'}</span>;
};

const OrderDetail = () => {
  const { id } = useParams();
  const order = useAsync(() => adminApi.orders.get(Number(id)), [id]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [refund, setRefund] = useState(null); // { amount, reason, restock }
  const [ship, setShip] = useState(null); // { carrier, trackingNumber, trackingUrl, note, notify }
  const o = order.data;

  // Another admin (or the payment flow) changed this order: pick up the new state.
  useLiveEvents(useCallback((e) => { if (Number(e.orderId) === Number(id)) order.reload(); }, [id, order.reload]), ['order.status', 'order.paid']);

  // Optimistic status change: the badge flips at once; the server copy replaces it or the
  // previous state returns with an error toast.
  const run = async (fn, { optimistic, success } = {}) => {
    const previous = order.data;
    setBusy(true);
    if (optimistic) order.setData((d) => ({ ...d, ...optimistic }));
    try {
      const next = await fn();
      if (next) order.setData(next);
      if (next?.RefundResult) toast[next.RefundResult.Status === 'succeeded' ? 'success' : 'info'](refundMessage(next.RefundResult));
      else if (success) toast.success(success);
      return true;
    } catch (err) {
      order.setData(previous);
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (order.loading && !o) return <SkeletonDetail />;
  if (order.error && !o) return <ErrorNote error={order.error} />;
  if (!o) return null;
  const refundable = (o.Payments ?? []).find((p) => p.Status === 'succeeded' || p.Status === 'partially_refunded');
  const remainingCents = refundable ? (refundable.AmountCents - (refundable.RefundedCents || 0)) : 0;
  const nextStatuses = NEXT[o.Status] ?? [];
  const primary = nextStatuses.find((s) => s !== 'cancelled');
  const setStatus = (s) => (s === 'shipped'
    ? setShip({ carrier: '', trackingNumber: '', trackingUrl: '', note: '', notify: true })
    : run(() => adminApi.orders.setStatus(o.Id, s), { optimistic: { Status: s }, success: `${o.Reference} marked ${s}.` }));

  const moreActions = [
    ...nextStatuses.filter((s) => s !== primary).map((s) => ({ label: `Mark ${s}`, danger: s === 'cancelled', onSelect: () => setStatus(s) })),
    refundable && remainingCents > 0 ? { label: 'Refund…', onSelect: () => setRefund({ amount: fromCents(remainingCents), reason: '', restock: true }) } : null,
    { separator: true },
    { label: 'Copy reference', hint: o.Reference, onSelect: () => navigator.clipboard?.writeText(o.Reference).then(() => toast.success('Reference copied.')) },
    { label: 'Email customer', onSelect: () => window.open(`mailto:${o.Email}?subject=${encodeURIComponent(`Your order ${o.Reference}`)}`) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHead title={o.Reference} subtitle={<span className="inline-flex flex-wrap items-center gap-2">Placed {fmtDate(o.CreatedAt)} <Badge tone={orderStatusTone(o.Status)} dot>{o.Status}</Badge> <Badge tone={paymentStatusTone(o.PaymentStatus)}>payment {o.PaymentStatus}</Badge> <Badge tone="gray">{o.FulfillmentStatus}</Badge></span>}>
        <Link to="/orders" className="btn-ghost"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5 h-4 w-4" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg><span>Back</span></Link>
        <Dropdown trigger={<button type="button" className="btn-ghost" disabled={busy}>More ▾</button>} items={moreActions} />
        {primary ? <button type="button" disabled={busy} onClick={() => setStatus(primary)} className="btn-primary">Mark {primary}{primary === 'shipped' ? '…' : ''}</button> : null}
      </PageHead>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <section className="card overflow-hidden">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-ink-700 text-left text-[11px] uppercase tracking-[0.08em] text-mist-dim"><th className="px-4 py-2.5">Item</th><th className="px-4 py-2.5">Qty</th><th className="px-4 py-2.5">Unit</th><th className="px-4 py-2.5 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-ink-700/70">
                {(o.Items ?? []).map((i) => (
                  <tr key={i.Id}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        {i.ImageUrl ? <Img src={i.ImageUrl} alt="" wrapClassName="h-10 w-10 shrink-0 rounded-lg border border-ink-700" className="h-10 w-10 object-cover" /> : null}
                        <div className="leading-tight"><Link to={`/products/${i.ProductId}`} className="text-mist hover:text-accent">{i.Title}</Link><p className="text-xs text-mist-dim">{i.VariantTitle}{i.Sku ? ` · ${i.Sku}` : ''}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{i.Qty}</td>
                    <td className="px-4 py-2.5 tabular-nums">{fmtCents(i.UnitPriceCents, o.Currency)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-mist">{fmtCents(i.LineTotalCents, o.Currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-ink-700 text-sm">
                <tr><td colSpan={3} className="px-4 py-1.5 text-right text-mist-muted">Subtotal</td><td className="px-4 py-1.5 text-right tabular-nums">{fmtCents(o.SubtotalCents, o.Currency)}</td></tr>
                {o.DiscountCents ? <tr><td colSpan={3} className="px-4 py-1.5 text-right text-mist-muted">Discount</td><td className="px-4 py-1.5 text-right tabular-nums">−{fmtCents(o.DiscountCents, o.Currency)}</td></tr> : null}
                <tr><td colSpan={3} className="px-4 py-1.5 text-right text-mist-muted">Shipping</td><td className="px-4 py-1.5 text-right tabular-nums">{fmtCents(o.ShippingCents, o.Currency)}</td></tr>
                <tr><td colSpan={3} className="px-4 py-1.5 text-right text-mist-muted">Tax (included)</td><td className="px-4 py-1.5 text-right tabular-nums">{fmtCents(o.TaxCents, o.Currency)}</td></tr>
                <tr className="text-base font-semibold text-mist"><td colSpan={3} className="px-4 py-2.5 text-right">Total</td><td className="px-4 py-2.5 text-right tabular-nums">{fmtCents(o.TotalCents, o.Currency)}</td></tr>
              </tfoot>
            </table>
          </section>

          <section className="card flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold text-mist">Timeline</h2>
            <ul className="flex flex-col gap-3">
              {(o.Events ?? []).map((e) => (
                <li key={e.Id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  <div>
                    <p className="text-mist">{e.Message || e.Type}</p>
                    {e.Data?.trackingUrl ? <a href={e.Data.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-600">Track parcel <ExternalLink className="h-3 w-3" aria-hidden="true" /></a> : null}
                    <Tooltip text={fmtDate(e.CreatedAt)}><p className="text-xs text-mist-dim">{fmtRelative(e.CreatedAt)} · {e.CreatedBy}{e.Data?.notifyCustomer === false ? ' · customer not emailed' : ''}</p></Tooltip>
                  </div>
                </li>
              ))}
              {!(o.Events ?? []).length ? <li className="text-sm text-mist-dim">No events yet.</li> : null}
            </ul>
            <form onSubmit={(e) => { e.preventDefault(); if (note.trim()) run(() => adminApi.orders.addNote(o.Id, note.trim()), { success: 'Note added.' }).then((ok) => ok && setNote('')); }} className="flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} className="input grow" placeholder="Add an internal note…" />
              <button type="submit" disabled={busy || !note.trim()} className="btn-ghost">Add</button>
            </form>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-3 p-4 text-sm">
            <h2 className="text-sm font-semibold text-mist">Customer</h2>
            <p className="text-mist">{o.CustomerId ? <Link to={`/customers/${o.CustomerId}`} className="hover:text-accent">{[o.Name, o.Surname].filter(Boolean).join(' ') || o.Email}</Link> : ([o.Name, o.Surname].filter(Boolean).join(' ') || '—')}</p>
            <p className="break-all text-mist-muted">{o.Email}</p>
            {o.Phone ? <p className="text-mist-muted">{o.Phone}</p> : null}
            {o.IdpUserId ? <Badge tone="blue">account #{o.IdpUserId}</Badge> : <Badge tone="gray">guest</Badge>}
            {o.CustomerNote ? <Field label="Customer note"><p className="text-mist-muted">{o.CustomerNote}</p></Field> : null}
          </section>
          <section className="card flex flex-col gap-3 p-4 text-sm">
            <h2 className="text-sm font-semibold text-mist">Shipping address</h2>
            <Address a={o.ShippingAddress} />
          </section>
          <section className="card flex flex-col gap-3 p-4 text-sm">
            <h2 className="text-sm font-semibold text-mist">Payments</h2>
            {(o.Payments ?? []).map((p) => (
              <div key={p.Id} className="rounded-xl border border-ink-700 p-3">
                <div className="flex items-center justify-between"><span className="tabular-nums text-mist">{fmtCents(p.AmountCents, p.Currency)}</span><Badge tone={paymentStatusTone(p.Status === 'succeeded' ? 'paid' : p.Status)}>{p.Status}</Badge></div>
                <p className="mt-1 text-xs text-mist-dim">{p.Provider} · wallet payment #{p.ConnectPaymentId ?? '—'} · {p.IsProduction ? 'production' : 'sandbox'}</p>
                {p.PaidAt ? <p className="text-xs text-mist-dim">paid {fmtDate(p.PaidAt)}</p> : null}
                {p.RefundedCents ? <p className="text-xs text-red-600">refunded {fmtCents(p.RefundedCents, p.Currency)}</p> : null}
              </div>
            ))}
            {!(o.Payments ?? []).length ? <p className="text-mist-dim">No payment attempts.</p> : null}
          </section>
        </div>
      </div>

      <Modal open={!!ship} title={`Ship ${o.Reference}`} onClose={() => setShip(null)} size="sm"
        footer={(
          <>
            <button type="button" onClick={() => setShip(null)} className="btn-ghost">Cancel</button>
            <button type="submit" form="ship-form" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Mark shipped'}</button>
          </>
        )}
      >
        {ship ? (
          <form id="ship-form" className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault();
            run(() => adminApi.orders.setStatus(o.Id, 'shipped', { carrier: ship.carrier, trackingNumber: ship.trackingNumber, trackingUrl: ship.trackingUrl, note: ship.note, notifyCustomer: ship.notify }), { optimistic: { Status: 'shipped', FulfillmentStatus: 'fulfilled' }, success: ship.notify ? `${o.Reference} shipped. The customer has been emailed.` : `${o.Reference} shipped.` }).then((ok) => ok && setShip(null));
          }}>
            <p className="text-sm text-mist-muted">Tracking details go on the order timeline and into the shipping email.</p>
            <Field label="Carrier" htmlFor="s-carrier"><input id="s-carrier" value={ship.carrier} onChange={(e) => setShip((s) => ({ ...s, carrier: e.target.value }))} className="input" maxLength={60} placeholder="The Courier Guy, Aramex, PostNet…" autoFocus /></Field>
            <Field label="Tracking number" htmlFor="s-tracking"><input id="s-tracking" value={ship.trackingNumber} onChange={(e) => setShip((s) => ({ ...s, trackingNumber: e.target.value }))} className="input font-mono" maxLength={80} /></Field>
            <Field label="Tracking link" hint="Optional. Must start with http(s)://" htmlFor="s-url"><input id="s-url" type="url" value={ship.trackingUrl} onChange={(e) => setShip((s) => ({ ...s, trackingUrl: e.target.value }))} className="input" maxLength={500} placeholder="https://…" /></Field>
            <Field label="Note to customer" htmlFor="s-note"><input id="s-note" value={ship.note} onChange={(e) => setShip((s) => ({ ...s, note: e.target.value }))} className="input" maxLength={500} placeholder="Delivery usually takes 2–4 working days." /></Field>
            <label className="flex items-center gap-3 text-sm text-mist-muted"><input type="checkbox" checked={ship.notify} onChange={(e) => setShip((s) => ({ ...s, notify: e.target.checked }))} className="accent-accent" /> Email the customer</label>
          </form>
        ) : null}
      </Modal>

      <RefundRequests id={o.Id} onResolved={async () => order.setData(await adminApi.orders.get(o.Id))} />
      <Modal open={!!refund} title={`Refund ${o.Reference}`} onClose={() => setRefund(null)} size="sm"
        footer={(
          <>
            <button type="button" onClick={() => setRefund(null)} className="btn-ghost">Cancel</button>
            <button type="submit" form="refund-form" disabled={busy} className="btn-danger">{busy ? 'Refunding…' : 'Refund'}</button>
          </>
        )}
      >
        {refund && refundable ? (
          <form id="refund-form" className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault();
            const cents = toCents(refund.amount);
            if (!cents || cents <= 0 || cents > remainingCents) { toast.error(`Enter an amount up to ${fmtCents(remainingCents, o.Currency)}.`); return; }
            run(() => adminApi.orders.refund(o.Id, { amountCents: cents === remainingCents ? undefined : cents, reason: refund.reason, restock: refund.restock })).then((ok) => ok && setRefund(null));
          }}>
            <p className="text-sm text-mist-muted">Paid {fmtCents(refundable.AmountCents, o.Currency)}{refundable.RefundedCents ? <>, already refunded {fmtCents(refundable.RefundedCents, o.Currency)}</> : null}. The money goes back to the customer's card through Cloudgate Wallet; the wallet ledger updates when the provider confirms.</p>
            <Field label={`Amount (${o.Currency}) — max ${fmtCents(remainingCents, o.Currency)}`} htmlFor="r-amount"><input id="r-amount" value={refund.amount} onChange={(e) => setRefund((r) => ({ ...r, amount: e.target.value }))} className="input tabular-nums" inputMode="decimal" required autoFocus /></Field>
            <Field label="Reason" htmlFor="r-reason"><input id="r-reason" value={refund.reason} onChange={(e) => setRefund((r) => ({ ...r, reason: e.target.value }))} className="input" maxLength={120} placeholder="Customer return, damaged in transit…" /></Field>
            <label className="flex items-center gap-3 text-sm text-mist-muted"><input type="checkbox" checked={refund.restock} onChange={(e) => setRefund((r) => ({ ...r, restock: e.target.checked }))} className="accent-accent" /> Put the items back into stock</label>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export { OrderDetail };
