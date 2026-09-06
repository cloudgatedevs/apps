import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, PageHead, fmtDate } from '@/shared/ui/ui';
import { SkeletonDetail } from '@/shared/ui/skeleton';
import { Field } from '@/shared/ui/forms';
import { fmtCents, fromCents, toCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { ProductPicker } from '@/admin/components/ProductPicker';

const useCurrency = () => { const s = useAsync(() => adminApi.settings.get(), []); return s.data?.currency || 'ZAR'; };

/** Goods received: scan each product off the delivery note, enter quantities and cost, book it in. */
const ReceiveStock = () => {
  const navigate = useNavigate();
  const currency = useCurrency();
  const suppliers = useAsync(() => adminApi.suppliers.list(), []);
  const [lines, setLines] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const add = (p) => setLines((ls) => {
    const i = ls.findIndex((l) => l.productId === p.Id);
    if (i >= 0) { const next = [...ls]; next[i] = { ...next[i], qty: Number(next[i].qty || 0) + 1 }; return next; }
    return [...ls, { productId: p.Id, name: p.Name, sku: p.Sku, unit: p.Unit || 'each', qty: 1, cost: p.CostCents != null ? fromCents(p.CostCents) : '' }];
  });
  const patch = (i, k, v) => setLines((ls) => ls.map((l, n) => (n === i ? { ...l, [k]: v } : l)));
  const total = lines.reduce((s, l) => s + Math.round(Number(l.qty || 0) * (toCents(l.cost) ?? 0)), 0);

  const save = async () => {
    const items = lines.filter((l) => Number(l.qty) > 0).map((l) => ({ productId: l.productId, qty: Number(l.qty), unitCostCents: toCents(l.cost) ?? 0 }));
    if (!items.length) { toast.error('Add at least one line.'); return; }
    setBusy(true);
    try { const r = await adminApi.inventory.receive({ supplierId: supplierId ? Number(supplierId) : null, reference: reference || undefined, note, items }); toast.success(`${r.Reference} booked in.`); navigate(`/inventory/receipts/${r.Id}`); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Receive stock" subtitle="Scan each product on the delivery note. Quantities are added to the shelf count and the cost price is updated.">
        <Link to="/inventory" className="btn-ghost">Cancel</Link>
        <button type="button" onClick={save} disabled={busy || !lines.length} className="btn-primary">{busy ? 'Booking in…' : 'Book in'}</button>
      </PageHead>
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <section className="card p-4">
          <ProductPicker onPick={add} currency={currency} />
          {lines.length ? (
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs text-mist-dim"><tr><th className="pb-2">Product</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Unit cost</th><th className="pb-2 text-right">Line</th><th /></tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.productId} className="border-t border-ink-700">
                    <td className="py-2"><span className="block text-mist">{l.name}</span><span className="block font-mono text-[11px] text-mist-dim">{l.sku}</span></td>
                    <td className="py-2 text-right"><input value={l.qty} onChange={(e) => patch(i, 'qty', e.target.value)} className="input w-20 text-right" inputMode="decimal" /></td>
                    <td className="py-2 text-right"><input value={l.cost} onChange={(e) => patch(i, 'cost', e.target.value)} className="input w-24 text-right" inputMode="decimal" placeholder="0.00" /></td>
                    <td className="py-2 text-right tabular-nums text-mist">{fmtCents(Math.round(Number(l.qty || 0) * (toCents(l.cost) ?? 0)), currency)}</td>
                    <td className="py-2 text-right"><button type="button" onClick={() => setLines((ls) => ls.filter((_, n) => n !== i))} className="btn-ghost btn-sm text-red-600" aria-label="Remove"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t border-ink-700 font-semibold text-mist"><td className="pt-2" colSpan={3}>Total cost</td><td className="pt-2 text-right tabular-nums">{fmtCents(total, currency)}</td><td /></tr></tfoot>
            </table>
          ) : <p className="mt-6 text-center text-sm text-mist-dim">Scan or search for the first product on the delivery.</p>}
        </section>
        <section className="card flex flex-col gap-3 p-4">
          <Field label="Supplier"><select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="select"><option value="">—</option>{(suppliers.data ?? []).map((s) => <option key={s.Id} value={s.Id}>{s.Name}</option>)}</select></Field>
          <Field label="Delivery note / invoice no." hint="Blank generates a GRV number."><input value={reference} onChange={(e) => setReference(e.target.value)} className="input font-mono" /></Field>
          <Field label="Note"><textarea value={note} onChange={(e) => setNote(e.target.value)} className="textarea" rows={3} /></Field>
        </section>
      </div>
    </div>
  );
};

/** Stock take: scan or pick products, enter the counted quantity, and the differences are booked as count movements. */
const StockTake = () => {
  const navigate = useNavigate();
  const currency = useCurrency();
  const [lines, setLines] = useState([]);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const add = (p) => setLines((ls) => (ls.some((l) => l.productId === p.Id) ? ls : [...ls, { productId: p.Id, name: p.Name, sku: p.Sku, unit: p.Unit || 'each', onHand: Number(p.StockQty ?? 0), counted: '' }]));
  const loadAll = async () => {
    try { const r = await adminApi.inventory.levels({ take: 500 }); setLines((r.items ?? []).map((p) => ({ productId: p.Id, name: p.Name, sku: p.Sku, unit: p.Unit || 'each', onHand: Number(p.StockQty ?? 0), counted: '' }))); } catch (err) { toast.error(errorMessage(err)); }
  };
  const save = async () => {
    const items = lines.filter((l) => l.counted !== '').map((l) => ({ productId: l.productId, countedQty: Number(l.counted) }));
    if (!items.length) { toast.error('Enter at least one counted quantity.'); return; }
    if (!window.confirm(`Apply the count for ${items.length} product${items.length === 1 ? '' : 's'}? Differences are written to the stock ledger.`)) return;
    setBusy(true);
    try { const r = await adminApi.inventory.count({ items, reference: reference || undefined }); toast.success(`Count applied. ${r.counted} product${r.counted === 1 ? '' : 's'} adjusted.`); navigate('/inventory?tab=movements'); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  const diffs = lines.filter((l) => l.counted !== '' && Number(l.counted) !== l.onHand).length;
  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Stock take" subtitle="Count what is on the shelf. Only rows with a count are applied; blank rows are left alone.">
        <button type="button" onClick={loadAll} className="btn-ghost">Load every tracked product</button>
        <Link to="/inventory" className="btn-ghost">Cancel</Link>
        <button type="button" onClick={save} disabled={busy || !lines.length} className="btn-primary">{busy ? 'Applying…' : 'Apply count'}</button>
      </PageHead>
      <section className="card p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
          <ProductPicker onPick={add} currency={currency} />
          <input value={reference} onChange={(e) => setReference(e.target.value)} className="input font-mono" placeholder="Count reference (optional)" />
        </div>
        {lines.length ? (
          <>
            <p className="mt-3 text-xs text-mist-dim">{lines.length} product{lines.length === 1 ? '' : 's'} · {diffs} with a difference</p>
            <table className="mt-2 w-full text-sm">
              <thead className="text-left text-xs text-mist-dim"><tr><th className="pb-2">Product</th><th className="pb-2 text-right">On hand</th><th className="pb-2 text-right">Counted</th><th className="pb-2 text-right">Difference</th></tr></thead>
              <tbody>
                {lines.map((l, i) => { const d = l.counted === '' ? null : Number(l.counted) - l.onHand; return (
                  <tr key={l.productId} className="border-t border-ink-700">
                    <td className="py-1.5"><span className="block text-mist">{l.name}</span><span className="block font-mono text-[11px] text-mist-dim">{l.sku}</span></td>
                    <td className="py-1.5 text-right tabular-nums text-mist-muted">{l.onHand}</td>
                    <td className="py-1.5 text-right"><input value={l.counted} onChange={(e) => setLines((ls) => ls.map((x, n) => (n === i ? { ...x, counted: e.target.value } : x)))} className="input w-24 text-right" inputMode="decimal" /></td>
                    <td className={`py-1.5 text-right tabular-nums font-medium ${d === null ? 'text-mist-dim' : d === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{d === null ? '—' : d > 0 ? `+${d}` : d}</td>
                  </tr>); })}
              </tbody>
            </table>
          </>
        ) : <p className="mt-6 text-center text-sm text-mist-dim">Scan products as you count them, or load every tracked product.</p>}
      </section>
    </div>
  );
};

const ReceiptDetail = () => {
  const { id } = useParams();
  const currency = useCurrency();
  const { data, loading, error } = useAsync(() => adminApi.inventory.receipt(Number(id)), [id]);
  if (loading) return <SkeletonDetail />;
  if (error) return <ErrorNote error={error} />;
  return (
    <div className="flex flex-col gap-5">
      <PageHead title={data.Reference} subtitle={`${data.SupplierName || 'No supplier'} · received ${fmtDate(data.CreatedAt)} by ${data.CreatedBy}`}><Link to="/inventory?tab=receipts" className="btn-ghost">Back</Link></PageHead>
      <section className="card p-4">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-mist-dim"><tr><th className="pb-2">Product</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Unit cost</th><th className="pb-2 text-right">Line</th></tr></thead>
          <tbody>{(data.Items ?? []).map((i) => <tr key={i.Id} className="border-t border-ink-700"><td className="py-2"><Link to={`/products/${i.ProductId}`} className="text-mist hover:text-accent">{i.Name}</Link><span className="ml-2 font-mono text-[11px] text-mist-dim">{i.Sku}</span></td><td className="py-2 text-right tabular-nums">{Number(i.Qty)}</td><td className="py-2 text-right tabular-nums">{fmtCents(i.UnitCostCents, currency)}</td><td className="py-2 text-right tabular-nums">{fmtCents(Math.round(Number(i.Qty) * Number(i.UnitCostCents)), currency)}</td></tr>)}</tbody>
          <tfoot><tr className="border-t border-ink-700 font-semibold text-mist"><td className="pt-2" colSpan={3}>Total</td><td className="pt-2 text-right tabular-nums">{fmtCents(data.TotalCostCents, currency)}</td></tr></tfoot>
        </table>
        {data.Note ? <p className="mt-3 text-sm text-mist-muted">{data.Note}</p> : null}
      </section>
    </div>
  );
};

export { ReceiveStock, StockTake, ReceiptDetail };
