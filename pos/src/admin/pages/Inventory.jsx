import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Boxes, ClipboardList, PackagePlus } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, PageHead, Pager, SearchBar, EmptyState, fmtDate } from '@/shared/ui/ui';
import { SkeletonTable } from '@/shared/ui/skeleton';
import { Field, Modal } from '@/shared/ui/forms';
import { fmtCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { useLiveEvents } from '@/admin/services/live';

const PAGE = 100;
const REASONS = { adjust: 'Adjustment', count: 'Stock take', receive: 'Received', damage: 'Damaged / written off', void: 'Void', sale: 'Sale', refund: 'Refund' };

const AdjustDialog = ({ product, onClose, onDone }) => {
  const [mode, setMode] = useState('delta');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('adjust');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMode('delta'); setQty(''); setReason('adjust'); setNote(''); }, [product?.Id]);
  const save = async () => {
    if (qty === '' || Number.isNaN(Number(qty))) { toast.error('Enter a quantity.'); return; }
    setBusy(true);
    try { await adminApi.inventory.adjust({ productId: product.Id, ...(mode === 'delta' ? { delta: Number(qty) } : { newQty: Number(qty) }), reason, note }); toast.success('Stock updated.'); onDone(); onClose(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!product} onClose={busy ? undefined : onClose} title={product?.Name} description={product ? `${Number(product.StockQty)} ${product.Unit !== 'each' ? product.Unit : ''} on hand` : ''} size="sm"
      footer={<><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-ink-800 p-1">
        {[['delta', 'Add / remove'], ['set', 'Set to']].map(([k, l]) => <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-lg py-1.5 text-sm font-medium ${mode === k ? 'bg-white text-mist shadow-panel' : 'text-mist-muted'}`}>{l}</button>)}
      </div>
      <Field label={mode === 'delta' ? 'Change (use − to remove)' : 'New quantity'}><input value={qty} onChange={(e) => setQty(e.target.value)} className="input" inputMode="decimal" placeholder={mode === 'delta' ? '+12 or -3' : '0'} autoFocus /></Field>
      <Field label="Reason" className="mt-3"><select value={reason} onChange={(e) => setReason(e.target.value)} className="select">{['adjust', 'count', 'receive', 'damage'].map((r) => <option key={r} value={r}>{REASONS[r]}</option>)}</select></Field>
      <Field label="Note" className="mt-3"><input value={note} onChange={(e) => setNote(e.target.value)} className="input" /></Field>
    </Modal>
  );
};

/** Stock levels, the movement ledger and goods-received notes. */
const Inventory = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'levels';
  const page = Number(params.get('page') || 0);
  const search = params.get('q') || '';
  const low = params.get('low') === '1';
  const productId = params.get('product') || '';
  const [draft, setDraft] = useState(search);
  const [adjusting, setAdjusting] = useState(null);
  const setParam = (patch) => { const next = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v === '' || v == null || v === false ? next.delete(k) : next.set(k, String(v)))); if (!('page' in patch)) next.delete('page'); setParams(next); };

  const levels = useAsync(() => (tab === 'levels' ? adminApi.inventory.levels({ search, lowStock: low, skip: page * PAGE, take: PAGE }) : Promise.resolve(null)), [tab, search, low, page]);
  const movements = useAsync(() => (tab === 'movements' ? adminApi.inventory.movements({ productId: productId || undefined, skip: page * 50, take: 50 }) : Promise.resolve(null)), [tab, productId, page]);
  const receipts = useAsync(() => (tab === 'receipts' ? adminApi.inventory.receipts({ skip: page * 50, take: 50 }) : Promise.resolve(null)), [tab, page]);
  const settings = useAsync(() => adminApi.settings.get(), []);
  const currency = settings.data?.currency || 'ZAR';
  useLiveEvents(useCallback(() => { levels.reload(); movements.reload(); }, [levels, movements]), ['stock.adjusted', 'sale.completed', 'sale.refunded']);

  // Deep link from a product page: open the adjust dialog for it.
  useEffect(() => { if (productId && tab === 'levels') adminApi.products.get(Number(productId)).then(setAdjusting).catch(() => {}); }, [productId, tab]);

  const current = tab === 'levels' ? levels : tab === 'movements' ? movements : receipts;
  const total = current.data?.total ?? 0;
  const size = tab === 'levels' ? PAGE : 50;

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Inventory" subtitle="What is on the shelf, how it got there, and what came in from suppliers.">
        <Link to="/inventory/count" className="btn-ghost"><ClipboardList className="h-4 w-4" /> Stock take</Link>
        <Link to="/inventory/receive" className="btn-primary"><PackagePlus className="h-4 w-4" /> Receive stock</Link>
      </PageHead>
      <div className="flex gap-1 border-b border-ink-700">
        {[['levels', 'Stock levels'], ['movements', 'Movements'], ['receipts', 'Goods received']].map(([k, l]) => <button key={k} type="button" onClick={() => setParam({ tab: k, page: '', product: '' })} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === k ? 'border-accent text-accent-600' : 'border-transparent text-mist-muted hover:text-mist'}`}>{l}</button>)}
      </div>

      {tab === 'levels' ? (
        <>
          <SearchBar value={draft} onChange={(e) => setDraft(e.target.value)} onSubmit={(e) => { e.preventDefault(); setParam({ q: draft.trim() }); }} onClear={() => { setDraft(''); setParam({ q: '' }); }} placeholder="Search name, SKU or barcode…">
            <label className="flex items-center gap-2 text-sm text-mist-muted"><input type="checkbox" checked={low} onChange={(e) => setParam({ low: e.target.checked ? '1' : '' })} className="accent-accent" /> Low stock only</label>
          </SearchBar>
          <ErrorNote error={levels.error} />
          {levels.loading && !levels.data ? <SkeletonTable columns={5} rows={8} /> : (
            <Table rows={levels.data?.items ?? []} empty={<EmptyState icon={<Boxes className="h-5 w-5" />} title="Nothing tracked" text="Products with stock tracking switched on appear here." />}
              columns={[
                { key: 'Name', label: 'Product', mobile: 'title', render: (p) => <span><Link to={`/products/${p.Id}`} className="font-medium text-mist hover:text-accent">{p.Name}</Link><span className="block font-mono text-[11px] text-mist-dim">{[p.Sku, p.Barcode].filter(Boolean).join(' · ')}</span></span> },
                { key: 'CategoryName', label: 'Category', mobile: 'meta', render: (p) => <span className="text-mist-muted">{p.CategoryName || '—'}</span> },
                { key: 'StockQty', label: 'On hand', align: 'right', render: (p) => <span className={`tabular-nums font-medium ${Number(p.StockQty) <= 0 ? 'text-red-600' : Number(p.StockQty) <= Number(p.Threshold) ? 'text-amber-600' : 'text-mist'}`}>{Number(p.StockQty)}{p.Unit !== 'each' ? ` ${p.Unit}` : ''}</span> },
                { key: 'Threshold', label: 'Alert at', align: 'right', render: (p) => <span className="tabular-nums text-mist-dim">{Number(p.Threshold)}</span> },
                { key: 'Value', label: 'Value', align: 'right', render: (p) => <span className="tabular-nums text-mist-muted">{fmtCents(Math.round(Number(p.StockQty) * Number(p.CostCents || 0)), currency)}</span> },
                { key: 'actions', label: '', mobile: 'actions', render: (p) => <button type="button" onClick={() => setAdjusting(p)} className="btn-ghost btn-sm">Adjust</button> },
              ]} />
          )}
        </>
      ) : null}

      {tab === 'movements' ? (
        <>
          <ErrorNote error={movements.error} />
          {movements.loading && !movements.data ? <SkeletonTable columns={5} rows={8} /> : (
            <Table rows={movements.data?.items ?? []} empty="No stock movements yet."
              columns={[
                { key: 'CreatedAt', label: 'When', mobile: 'meta', render: (m) => <span className="text-mist-muted">{fmtDate(m.CreatedAt)}</span> },
                { key: 'ProductName', label: 'Product', mobile: 'title', render: (m) => <Link to={`/products/${m.ProductId}`} className="font-medium text-mist hover:text-accent">{m.ProductName}</Link> },
                { key: 'Reason', label: 'Reason', render: (m) => <span className="text-mist-muted">{REASONS[m.Reason] ?? m.Reason}{m.Reference ? <span className="ml-1 font-mono text-[11px] text-mist-dim">{m.Reference}</span> : null}</span> },
                { key: 'Note', label: 'Note', mobile: 'hide', render: (m) => <span className="text-mist-dim">{m.Note || ''}</span> },
                { key: 'Delta', label: 'Change', align: 'right', render: (m) => <span className={`tabular-nums font-medium ${Number(m.Delta) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{Number(m.Delta) > 0 ? '+' : ''}{Number(m.Delta)}</span> },
                { key: 'CreatedBy', label: 'By', mobile: 'hide', render: (m) => <span className="text-mist-dim">{m.CreatedBy}</span> },
              ]} />
          )}
        </>
      ) : null}

      {tab === 'receipts' ? (
        <>
          <ErrorNote error={receipts.error} />
          {receipts.loading && !receipts.data ? <SkeletonTable columns={5} rows={6} /> : (
            <Table rows={receipts.data?.items ?? []} rowHref={(r) => `/inventory/receipts/${r.Id}`} empty={<EmptyState icon={<PackagePlus className="h-5 w-5" />} title="No deliveries recorded" text="Receive stock to book a delivery in and update the shelf counts." action={<Link to="/inventory/receive" className="btn-primary">Receive stock</Link>} />}
              columns={[
                { key: 'Reference', label: 'Reference', mobile: 'title', render: (r) => <span className="font-mono text-mist">{r.Reference}</span> },
                { key: 'SupplierName', label: 'Supplier', mobile: 'meta', render: (r) => <span className="text-mist-muted">{r.SupplierName || '—'}</span> },
                { key: 'LineCount', label: 'Lines', align: 'right' },
                { key: 'TotalCostCents', label: 'Cost', align: 'right', render: (r) => <span className="tabular-nums">{fmtCents(r.TotalCostCents, currency)}</span> },
                { key: 'CreatedAt', label: 'Received', render: (r) => <span className="text-mist-muted">{fmtDate(r.CreatedAt)}</span> },
              ]} />
          )}
        </>
      ) : null}

      {total > size ? <Pager page={page} pages={Math.ceil(total / size)} total={total} from={page * size + 1} to={Math.min(total, (page + 1) * size)} noun="rows" onPage={(p) => setParam({ page: p })} /> : null}
      <AdjustDialog product={adjusting} onClose={() => { setAdjusting(null); if (productId) setParam({ product: '' }); }} onDone={() => { levels.reload(); movements.reload(); }} />
    </div>
  );
};

export { Inventory };
