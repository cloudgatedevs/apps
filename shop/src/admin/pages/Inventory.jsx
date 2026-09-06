import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, Badge, PageHead, Pager, SearchBar, EmptyState, Img, sortRows, fmtDateShort } from '@/shared/ui/ui';
import { SkeletonTable } from '@/shared/ui/skeleton';
import { Field, Modal } from '@/shared/ui/forms';
import { errorMessage } from '@/shared/lib/errors';
import { useLiveEvents } from '@/admin/services/live';
import { IconInventory } from '@/admin/components/navConfig';
import { X } from 'lucide-react';

const PAGE_SIZE = 100;
const REASONS = [
  ['receive', 'Received stock'], ['adjust', 'Stock count adjustment'], ['correction', 'Correction'],
  ['damaged', 'Damaged / written off'], ['returned', 'Customer return'],
];

const stockTone = (r) => (r.AvailableQty <= 0 ? 'red' : r.StockQty <= r.LowStockThreshold ? 'amber' : 'green');

const Inventory = () => {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') ?? 'stock';
  const query = params.get('q') ?? '';
  const lowStock = params.get('lowStock') === '1';
  const outOfStock = params.get('outOfStock') === '1';
  const productId = params.get('productId') ?? '';
  const page = Number(params.get('page') ?? 0) || 0;
  const [search, setSearch] = useState(query);
  const [adjusting, setAdjusting] = useState(null);
  const [form, setForm] = useState({ mode: 'delta', delta: '', setTo: '', reason: 'receive', note: '', reference: '' });
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState(null);

  const setParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === '' || v == null || v === false ? next.delete(k) : next.set(k, String(v))));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  const stock = useAsync(
    () => (view === 'stock'
      ? adminApi.inventory.stock({ search: query || undefined, productId: productId || undefined, lowStock, outOfStock, skip: page * PAGE_SIZE, take: PAGE_SIZE })
      : adminApi.inventory.movements({ productId: productId || undefined, skip: page * 50, take: 50 })),
    [view, query, productId, lowStock, outOfStock, page],
  );

  useLiveEvents(useCallback(() => stock.reload(), [stock.reload]), ['stock.adjusted', 'order.paid']);
  const rows = useMemo(() => sortRows(stock.data?.items ?? [], sort), [stock.data, sort]);
  const total = stock.data?.total ?? 0;
  const size = view === 'stock' ? PAGE_SIZE : 50;
  const pages = Math.max(1, Math.ceil(total / size));
  const pager = <Pager page={page} pages={pages} total={total} from={total === 0 ? 0 : page * size + 1} to={Math.min(total, (page + 1) * size)} noun={view === 'stock' ? 'variants' : 'movements'} onPage={(p) => setParam({ page: p })} />;

  const openAdjust = (r) => {
    setAdjusting(r);
    setForm({ mode: 'delta', delta: '', setTo: String(r.StockQty ?? 0), reason: 'receive', note: '', reference: '' });
  };

  // Optimistic: the row updates the moment the dialog closes; the server row replaces it, or the
  // old value comes back with an error toast.
  const submitAdjust = async (e) => {
    e.preventDefault();
    const target = adjusting;
    const nextQty = form.mode === 'delta' ? (Number(target.StockQty) || 0) + (Number(form.delta) || 0) : Number(form.setTo) || 0;
    const previous = stock.data;
    setBusy(true);
    stock.setData((d) => d && ({ ...d, items: d.items.map((r) => (r.Id === target.Id ? { ...r, StockQty: nextQty, AvailableQty: nextQty - (r.ReservedQty || 0) } : r)) }));
    setAdjusting(null);
    try {
      const updated = await adminApi.inventory.adjust({
        variantId: target.Id,
        ...(form.mode === 'delta' ? { delta: Number(form.delta) } : { setTo: Number(form.setTo) }),
        reason: form.reason, note: form.note, reference: form.reference,
      });
      if (updated?.Id) stock.setData((d) => d && ({ ...d, items: d.items.map((r) => (r.Id === updated.Id ? { ...r, ...updated } : r)) }));
      toast.success(`Stock updated for ${target.ProductName} · ${target.Title}.`, { description: `${target.StockQty} → ${nextQty} on hand` });
    } catch (err) {
      stock.setData(previous);
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Inventory" subtitle="Stock per variant. Every change is written to the movement ledger.">
        <div className="flex rounded-lg border border-ink-600 bg-white p-0.5">
          {[['stock', 'Stock'], ['movements', 'Movements']].map(([v, label]) => (
            <button key={v} type="button" onClick={() => setParam({ view: v })} className={`rounded-md px-3 py-1 text-sm ${view === v ? 'bg-accent-soft text-accent-600' : 'text-mist-muted'}`} aria-pressed={view === v}>{label}</button>
          ))}
        </div>
        {view === 'stock' ? (
          <>
            <label className="chip cursor-pointer select-none"><input type="checkbox" checked={lowStock} onChange={(e) => setParam({ lowStock: e.target.checked ? '1' : '' })} className="accent-accent" /> Low</label>
            <label className="chip cursor-pointer select-none"><input type="checkbox" checked={outOfStock} onChange={(e) => setParam({ outOfStock: e.target.checked ? '1' : '' })} className="accent-accent" /> Out</label>
          </>
        ) : null}
        {productId ? <button type="button" onClick={() => setParam({ productId: '' })} className="chip">Product #{productId} <X className="h-3.5 w-3.5" aria-hidden="true" /></button> : null}
        <button onClick={stock.reload} className="btn-ghost">Refresh</button>
      </PageHead>

      {view === 'stock' ? (
        <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} onSubmit={(e) => { e.preventDefault(); setParam({ q: search.trim() }); }}
          onClear={query ? () => { setSearch(''); setParam({ q: '' }); } : undefined} placeholder="Search by product, SKU, variant or barcode…" />
      ) : null}

      <ErrorNote error={stock.error} />
      {stock.loading ? (
        <SkeletonTable columns={view === 'stock' ? 7 : 7} rows={8} />
      ) : view === 'stock' ? (
        <>
          {pager}
          <Table
            sort={sort}
            onSort={setSort}
            columns={[
              {
                key: 'ProductName', label: 'Product', mobile: 'title', sortable: true,
                render: (r) => (
                  <div className="flex items-center gap-3">
                    {r.ThumbUrl ? <Img src={r.ThumbUrl} alt="" wrapClassName="h-9 w-9 shrink-0 rounded-lg border border-ink-700" className="h-9 w-9 object-cover" /> : null}
                    <div className="min-w-0 leading-tight">
                      <Link to={`/products/${r.ProductId}`} className="font-medium text-mist hover:text-accent">{r.ProductName}</Link>
                      <p className="text-xs text-mist-dim">{r.Title}{r.Sku ? <span className="ml-2 font-mono">{r.Sku}</span> : null}</p>
                    </div>
                  </div>
                ),
              },
              { key: 'StockQty', label: 'On hand', sortable: true, align: 'right', render: (r) => <span className="tabular-nums text-mist">{r.TrackInventory ? r.StockQty : '∞'}</span> },
              { key: 'ReservedQty', label: 'Reserved', mobile: 'hide', align: 'right', render: (r) => <span className="tabular-nums">{r.ReservedQty}</span> },
              { key: 'AvailableQty', label: 'Available', sortable: true, render: (r) => <Badge tone={r.TrackInventory ? stockTone(r) : 'gray'}>{r.TrackInventory ? r.AvailableQty : 'not tracked'}</Badge> },
              { key: 'LowStockThreshold', label: 'Low at', mobile: 'hide', align: 'right', render: (r) => <span className="tabular-nums">{r.LowStockThreshold}</span> },
              { key: 'UpdatedAt', label: 'Updated', mobile: 'hide', sortable: true, render: (r) => <span className="whitespace-nowrap text-mist-dim">{fmtDateShort(r.UpdatedAt)}</span> },
              { key: 'actions', label: '', mobile: 'actions', render: (r) => <button type="button" onClick={() => openAdjust(r)} className="btn-ghost btn-sm">Adjust</button> },
            ]}
            rows={rows}
            empty={query || lowStock || outOfStock || productId
              ? <EmptyState compact title="No variants match this view" action={<button type="button" onClick={() => { setSearch(''); setParam({ q: '', lowStock: '', outOfStock: '', productId: '' }); }} className="btn-ghost btn-sm">Clear filters</button>} />
              : <EmptyState icon={<IconInventory className="h-5 w-5" />} title="Nothing to count yet" text="Variants appear here as soon as you create a product." action={<Link to="/products/new" className="btn-primary">New product</Link>} />}
          />
          {pager}
        </>
      ) : (
        <>
          {pager}
          <Table
            sort={sort}
            onSort={setSort}
            columns={[
              { key: 'CreatedAt', label: 'When', mobile: 'meta', sortable: true, render: (r) => <span className="whitespace-nowrap text-mist-dim">{fmtDateShort(r.CreatedAt)}</span> },
              { key: 'ProductName', label: 'Product', mobile: 'title', sortable: true, render: (r) => <span className="text-mist">{r.ProductName}<span className="ml-2 text-xs text-mist-dim">{r.VariantTitle}{r.Sku ? ` · ${r.Sku}` : ''}</span></span> },
              { key: 'Delta', label: 'Change', sortable: true, align: 'right', render: (r) => <span className={`font-semibold tabular-nums ${r.Delta < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{r.Delta > 0 ? `+${r.Delta}` : r.Delta}</span> },
              { key: 'Reason', label: 'Reason', sortable: true, render: (r) => <Badge tone="blue">{r.Reason}</Badge> },
              { key: 'Reference', label: 'Reference', mobile: 'hide', render: (r) => <span className="font-mono text-xs">{r.Reference || '—'}</span> },
              { key: 'Note', label: 'Note', mobile: 'hide', render: (r) => <span className="text-mist-muted">{r.Note || '—'}</span> },
              { key: 'CreatedBy', label: 'By', mobile: 'hide', render: (r) => <span className="text-xs text-mist-dim">{r.CreatedBy}</span> },
            ]}
            rows={rows}
            empty={<EmptyState compact title="No movements recorded yet" text="Every receive, adjustment, sale and return shows up here." />}
          />
          {pager}
        </>
      )}

      <Modal open={!!adjusting} title="Adjust stock" onClose={() => setAdjusting(null)} size="sm"
        footer={(
          <>
            <button type="button" onClick={() => setAdjusting(null)} className="btn-ghost">Cancel</button>
            <button type="submit" form="adjust-form" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Apply'}</button>
          </>
        )}
      >
        {adjusting ? (
          <form id="adjust-form" onSubmit={submitAdjust} className="flex flex-col gap-4">
            <p className="text-sm text-mist-muted">
              <span className="text-mist">{adjusting.ProductName}</span> · {adjusting.Title}
              <span className="ml-2 tabular-nums">on hand {adjusting.StockQty}</span>
            </p>
            <div className="flex rounded-lg border border-ink-600 p-0.5 text-sm">
              {[['delta', 'Add / remove'], ['set', 'Set count']].map(([m, label]) => (
                <button key={m} type="button" onClick={() => setForm((f) => ({ ...f, mode: m }))} className={`grow rounded-md px-3 py-1.5 ${form.mode === m ? 'bg-accent-soft text-accent-600' : 'text-mist-muted'}`} aria-pressed={form.mode === m}>{label}</button>
              ))}
            </div>
            {form.mode === 'delta' ? (
              <Field label="Quantity change" hint="Positive to receive, negative to remove." htmlFor="delta"><input id="delta" type="number" value={form.delta} onChange={(e) => setForm((f) => ({ ...f, delta: e.target.value }))} className="input tabular-nums" required autoFocus /></Field>
            ) : (
              <Field label="New count" htmlFor="setTo"><input id="setTo" type="number" min="0" value={form.setTo} onChange={(e) => setForm((f) => ({ ...f, setTo: e.target.value }))} className="input tabular-nums" required autoFocus /></Field>
            )}
            <Field label="Reason" htmlFor="reason">
              <select id="reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className="select">
                {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Reference" hint="PO number, RMA, etc." htmlFor="ref"><input id="ref" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} className="input" /></Field>
            <Field label="Note" htmlFor="note"><input id="note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className="input" /></Field>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export { Inventory };
