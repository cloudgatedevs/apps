import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Banknote, CreditCard, Ban } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, PageHead, Badge, fmtDate } from '@/shared/ui/ui';
import { SkeletonDetail } from '@/shared/ui/skeleton';
import { Modal, Field, Notice } from '@/shared/ui/forms';
import { useConfirm } from '@/shared/ui/confirm';
import { fmtCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { Receipt } from '@/pos/components/Receipt';
import { SALE_TONE } from '@/admin/pages/Dashboard';

const RefundDialog = ({ sale, open, onClose, onDone }) => {
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const cur = sale.Currency;
  const items = (sale.Items ?? []).map((i) => ({ ...i, left: Number(i.Qty) - Number(i.RefundedQty || 0) }));
  const chosen = items.filter((i) => Number(qty[i.Id]) > 0).map((i) => ({ saleItemId: i.Id, qty: Math.min(i.left, Number(qty[i.Id])) }));
  const estimate = items.reduce((s, i) => { const q = Math.min(i.left, Number(qty[i.Id]) || 0); return s + (q > 0 ? Math.round(Number(i.LineTotalCents) * q / Number(i.Qty)) : 0); }, 0);
  const byCard = (sale.Payments ?? []).some((p) => p.Method === 'card' && p.Status === 'succeeded');
  const byCash = (sale.Payments ?? []).some((p) => p.Method === 'cash' && p.Status === 'succeeded');
  const refund = async (method) => {
    if (!chosen.length) { toast.error('Choose the items to refund.'); return; }
    setBusy(true);
    try { const s = await adminApi.sales.refund(sale.Id, { items: chosen, reason, method }); toast.success('Refund recorded.'); onDone(s); onClose(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title={`Refund ${sale.Reference}`} size="md"
      footer={<><span className="grow text-sm text-mist">Refund <b className="tabular-nums">{fmtCents(estimate, cur)}</b></span>{byCash ? <button type="button" className="btn-ghost" disabled={busy || !chosen.length} onClick={() => refund('cash')}><Banknote className="h-4 w-4" /> Cash</button> : null}{byCard ? <button type="button" className="btn-primary" disabled={busy || !chosen.length} onClick={() => refund('card')}><CreditCard className="h-4 w-4" /> To card</button> : null}</>}>
      <Notice tone="info">Cash refunds are recorded against the till without a shift; card refunds go back through the Cloudgate Wallet payment.</Notice>
      <ul className="mt-3 divide-y divide-ink-700">
        {items.map((i) => (
          <li key={i.Id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 grow"><p className="truncate text-sm text-mist">{i.Name}</p><p className="text-xs text-mist-dim">{Number(i.Qty)} × {fmtCents(i.UnitPriceCents, cur)}{Number(i.RefundedQty) ? ` · ${Number(i.RefundedQty)} refunded` : ''}</p></div>
            {i.left > 0 ? <div className="flex items-center gap-1"><input type="number" min="0" max={i.left} value={qty[i.Id] ?? ''} onChange={(e) => setQty({ ...qty, [i.Id]: e.target.value })} className="input w-20 text-right" placeholder="0" /><button type="button" className="chip" onClick={() => setQty({ ...qty, [i.Id]: i.left })}>all</button></div> : <span className="text-xs text-mist-dim">refunded</span>}
          </li>
        ))}
      </ul>
      <Field label="Reason" className="mt-3"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </Modal>
  );
};

const SaleDetail = () => {
  const confirm = useConfirm();
  const { id } = useParams();
  const { data, loading, error, setData } = useAsync(() => adminApi.sales.get(Number(id)), [id]);
  const [refunding, setRefunding] = useState(false);
  const [busy, setBusy] = useState(false);
  if (loading) return <SkeletonDetail />;
  if (error) return <ErrorNote error={error} />;
  const s = data;
  const cur = s.Currency;
  const refundable = ['completed', 'partially_refunded'].includes(s.Status);
  const voidable = ['open', 'held'].includes(s.Status);
  const doVoid = async () => {
    const reason = await confirm({ title: 'Void this sale', text: 'The sale is cancelled and any held stock is released.', confirmLabel: 'Void sale', tone: 'danger', input: { label: 'Reason', placeholder: 'Why is this sale being voided?' } });
    if (reason === null) return;
    setBusy(true);
    try { setData(await adminApi.sales.void(s.Id, reason)); toast.success('Sale voided.'); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHead title={s.Reference} subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone={SALE_TONE[s.Status] ?? 'gray'} dot>{String(s.Status).replace('_', ' ')}</Badge><span>{fmtDate(s.CompletedAt || s.CreatedAt)} · {s.TellerName} on {s.RegisterName || 'no register'}{s.ShiftId ? <> · <Link to={`/shifts/${s.ShiftId}`} className="text-accent hover:text-accent-600">shift #{s.ShiftId}</Link></> : null}</span></span>}>
        <Link to="/sales" className="btn-ghost">Back</Link>
        {voidable ? <button type="button" onClick={doVoid} disabled={busy} className="btn-danger"><Ban className="h-4 w-4" /> Void</button> : null}
        {refundable ? <button type="button" onClick={() => setRefunding(true)} className="btn-primary">Refund…</button> : null}
      </PageHead>
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-5">
          <section className="card p-4">
            <h2 className="text-[15px] font-semibold text-mist">Items</h2>
            <table className="mt-2 w-full text-sm">
              <thead className="text-left text-xs text-mist-dim"><tr><th className="pb-1">Product</th><th className="pb-1 text-right">Qty</th><th className="pb-1 text-right">Price</th><th className="pb-1 text-right">Discount</th><th className="pb-1 text-right">Tax</th><th className="pb-1 text-right">Total</th></tr></thead>
              <tbody>{(s.Items ?? []).map((i) => <tr key={i.Id} className="border-t border-ink-700"><td className="py-1.5"><Link to={`/products/${i.ProductId}`} className="text-mist hover:text-accent">{i.Name}</Link>{Number(i.RefundedQty) ? <span className="ml-2 text-xs text-amber-700">{Number(i.RefundedQty)} refunded</span> : null}</td><td className="py-1.5 text-right tabular-nums">{Number(i.Qty)}{i.Unit !== 'each' ? ` ${i.Unit}` : ''}</td><td className="py-1.5 text-right tabular-nums">{fmtCents(i.UnitPriceCents, cur)}</td><td className="py-1.5 text-right tabular-nums text-mist-muted">{i.DiscountCents ? `−${fmtCents(i.DiscountCents, cur)}` : ''}</td><td className="py-1.5 text-right tabular-nums text-mist-muted">{fmtCents(i.TaxCents, cur)}</td><td className="py-1.5 text-right tabular-nums font-medium">{fmtCents(i.LineTotalCents, cur)}</td></tr>)}</tbody>
              <tfoot className="text-mist">
                {s.DiscountCents ? <tr className="border-t border-ink-700"><td className="pt-2" colSpan={5}>Sale discount</td><td className="pt-2 text-right tabular-nums">−{fmtCents(s.DiscountCents, cur)}</td></tr> : null}
                <tr className="border-t border-ink-700 font-semibold"><td className="pt-2" colSpan={5}>Total</td><td className="pt-2 text-right tabular-nums">{fmtCents(s.TotalCents, cur)}</td></tr>
                <tr className="text-mist-muted"><td colSpan={5}>Tax included</td><td className="text-right tabular-nums">{fmtCents(s.TaxCents, cur)}</td></tr>
                {Number(s.RefundedCents) ? <tr className="text-amber-700"><td colSpan={5}>Refunded</td><td className="text-right tabular-nums">−{fmtCents(s.RefundedCents, cur)}</td></tr> : null}
              </tfoot>
            </table>
          </section>
          <section className="card p-4">
            <h2 className="text-[15px] font-semibold text-mist">Payments</h2>
            <ul className="mt-2 divide-y divide-ink-700 text-sm">
              {(s.Payments ?? []).map((p) => <li key={p.Id} className="flex items-center gap-3 py-2"><span className="capitalize text-mist">{p.Method}</span><Badge tone={p.Status === 'succeeded' ? 'green' : p.Status === 'pending' ? 'amber' : 'gray'}>{p.Status}</Badge><span className="text-xs text-mist-dim">{fmtDate(p.CreatedAt)}{p.ConnectPaymentId ? ` · ${p.ConnectPaymentId}` : ''}</span><span className="ml-auto tabular-nums">{fmtCents(p.AmountCents, cur)}{p.Method === 'cash' && p.ChangeCents ? <span className="ml-1 text-xs text-mist-dim">(tendered {fmtCents(p.TenderedCents, cur)}, change {fmtCents(p.ChangeCents, cur)})</span> : null}</span></li>)}
              {(s.Refunds ?? []).map((r) => <li key={`r${r.Id}`} className="flex items-center gap-3 py-2 text-amber-800"><span>Refund · {r.Method}</span><span className="font-mono text-xs">{r.Reference}</span><span className="text-xs text-mist-dim">{fmtDate(r.CreatedAt)}{r.Reason ? ` · ${r.Reason}` : ''}</span><span className="ml-auto tabular-nums">−{fmtCents(r.AmountCents, cur)}</span></li>)}
              {!s.Payments?.length ? <li className="py-2 text-mist-dim">No payment recorded.</li> : null}
            </ul>
          </section>
          {s.CustomerName || s.CustomerEmail || s.Note ? <section className="card p-4 text-sm"><h2 className="text-[15px] font-semibold text-mist">Customer</h2><p className="mt-1 text-mist">{s.CustomerName}{s.CustomerId ? <> · <Link to={`/customers/${s.CustomerId}`} className="text-accent">profile</Link></> : null}</p><p className="text-mist-muted">{s.CustomerEmail}</p>{s.Note ? <p className="mt-2 text-mist-muted">{s.Note}</p> : null}</section> : null}
        </div>
        <div><Receipt sale={s} /></div>
      </div>
      <RefundDialog sale={s} open={refunding} onClose={() => setRefunding(false)} onDone={setData} />
    </div>
  );
};

export { SaleDetail };
