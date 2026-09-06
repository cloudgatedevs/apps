import { useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, Badge, PageHead, Pager, SearchBar, EmptyState, SelectionBar, Img, sortRows, fmtDateShort } from '@/shared/ui/ui';
import { SkeletonTable } from '@/shared/ui/skeleton';
import { Dropdown } from '@/shared/ui/menus';
import { fmtCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { IconProducts } from '@/admin/components/navConfig';

const PAGE_SIZE = 50;

export const productStatusTone = (s) => ({ active: 'green', draft: 'amber', archived: 'gray' }[String(s ?? '').toLowerCase()] ?? 'gray');

const Thumb = ({ src, alt }) =>
  src ? (
    <Img src={src} alt={alt ?? ''} wrapClassName="h-10 w-10 shrink-0 rounded-lg border border-ink-700" className="h-10 w-10 object-cover" />
  ) : (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-dashed border-ink-600 text-[10px] text-mist-dim">no img</span>
  );

/** Run one admin call per id with a progress toast; returns the number that succeeded. */
export async function runBulk(ids, label, fn) {
  const id = toast.loading(`${label} 0 / ${ids.length}…`);
  let ok = 0;
  const failed = [];
  for (const [i, target] of ids.entries()) {
    try { await fn(target); ok += 1; } catch (err) { failed.push(errorMessage(err)); }
    toast.loading(`${label} ${i + 1} / ${ids.length}…`, { id });
  }
  if (failed.length) toast.error(`${ok} done, ${failed.length} failed: ${failed[0]}`, { id, duration: 6000 });
  else toast.success(`${label} ${ok} item${ok === 1 ? '' : 's'}.`, { id });
  return ok;
}

const Products = () => {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const status = params.get('status') ?? '';
  const lowStock = params.get('lowStock') === '1';
  const query = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 0) || 0;
  const [search, setSearch] = useState(query);
  const [sort, setSort] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  const setParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === '' || v == null || v === false ? next.delete(k) : next.set(k, String(v))));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
    setSelected(new Set());
  };

  const { data, loading, error, reload } = useAsync(
    () => adminApi.products.list({ search: query || undefined, status: status || undefined, lowStock, skip: page * PAGE_SIZE, take: PAGE_SIZE }),
    [query, status, lowStock, page],
  );
  useMemo(() => { if (location.state?.notice) toast.success(location.state.notice); }, [location.state]);

  const rows = useMemo(() => sortRows(data?.items ?? [], sort), [data, sort]);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const pager = <Pager page={page} pages={pages} total={total} from={from} to={to} noun="products" onPage={(p) => setParam({ page: p })} />;
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bulkStatus = async (next) => {
    const ids = [...selected];
    await runBulk(ids, next === 'active' ? 'Published' : next === 'draft' ? 'Unpublished' : 'Archived', (id) => adminApi.products.setStatus(id, next));
    setSelected(new Set());
    reload();
  };
  const bulkDelete = async () => {
    const ids = [...selected];
    await runBulk(ids, 'Deleted', (id) => adminApi.products.remove(id));
    setSelected(new Set());
    reload();
  };

  const rowActions = (r) => [
    { label: 'Edit', onSelect: () => window.location.assign(`/admin/products/${r.Id}`) },
    r.Status !== 'active' ? { label: 'Publish', onSelect: () => adminApi.products.setStatus(r.Id, 'active').then(() => { toast.success(`${r.Name} is live.`); reload(); }).catch((e) => toast.error(errorMessage(e))) } : { label: 'Unpublish', onSelect: () => adminApi.products.setStatus(r.Id, 'draft').then(() => { toast.success(`${r.Name} unpublished.`); reload(); }).catch((e) => toast.error(errorMessage(e))) },
    r.Status !== 'archived' ? { label: 'Archive', onSelect: () => adminApi.products.setStatus(r.Id, 'archived').then(() => { toast.success(`${r.Name} archived.`); reload(); }).catch((e) => toast.error(errorMessage(e))) } : null,
    { separator: true },
    { label: 'View in store', onSelect: () => window.open(`/p/${r.Slug}`, '_blank'), disabled: r.Status !== 'active' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Products" subtitle="Everything you sell — drafts, live listings and archived items.">
        <select value={status} onChange={(e) => setParam({ status: e.target.value })} className="select grow py-2 sm:grow-0 sm:py-1.5" aria-label="Status filter">
          <option value="">Live + drafts</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
        <label className="chip cursor-pointer select-none">
          <input type="checkbox" checked={lowStock} onChange={(e) => setParam({ lowStock: e.target.checked ? '1' : '' })} className="accent-accent" />
          Low stock
        </label>
        <button onClick={reload} className="btn-ghost">Refresh</button>
        <Link to="/products/new" className="btn-primary">New product</Link>
      </PageHead>

      <SearchBar
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onSubmit={(e) => { e.preventDefault(); setParam({ q: search.trim() }); }}
        onClear={query ? () => { setSearch(''); setParam({ q: '' }); } : undefined}
        placeholder="Search by name, SKU, brand or tag…"
      />

      <ErrorNote error={error} />
      {loading ? (
        <SkeletonTable columns={6} rows={8} />
      ) : (
        <>
          {pager}
          <Table
            rowHref={(r) => `/products/${r.Id}`}
            sort={sort}
            onSort={setSort}
            selectable
            selected={selected}
            onToggle={toggle}
            onToggleAll={(ids) => setSelected(new Set(ids))}
            columns={[
              {
                key: 'Name', label: 'Product', mobile: 'title', sortable: true,
                render: (r) => (
                  <div className="flex items-center gap-3">
                    <Thumb src={r.ThumbUrl || r.ImageUrl} alt={r.Name} />
                    <div className="min-w-0 leading-tight">
                      <Link to={`/products/${r.Id}`} className="font-medium text-mist hover:text-accent">{r.Name}</Link>
                      <p className="truncate text-xs text-mist-dim">{[r.Sku, r.Brand].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                  </div>
                ),
              },
              { key: 'CategoryName', label: 'Category', mobile: 'meta', sortable: true, render: (r) => <span className="text-mist-muted">{r.CategoryName || '—'}</span> },
              { key: 'PriceCents', label: 'Price', sortable: true, align: 'right', render: (r) => <span className="tabular-nums text-mist">{fmtCents(r.PriceCents, r.Currency)}</span> },
              {
                key: 'StockQty', label: 'Stock', sortable: true, align: 'right',
                render: (r) => (
                  <span className={`tabular-nums ${r.LowStockVariants > 0 ? 'text-amber-600' : 'text-mist'}`}>
                    {r.TrackInventory ? r.StockQty : '∞'}
                    {r.VariantCount > 1 ? <span className="ml-1 text-xs text-mist-dim">/ {r.VariantCount} variants</span> : null}
                  </span>
                ),
              },
              { key: 'Status', label: 'Status', sortable: true, render: (r) => <Badge tone={productStatusTone(r.Status)} dot>{r.Status}</Badge> },
              { key: 'UpdatedAt', label: 'Updated', mobile: 'hide', sortable: true, render: (r) => <span className="whitespace-nowrap text-mist-dim">{fmtDateShort(r.UpdatedAt)}</span> },
              { key: 'actions', label: '', mobile: 'actions', render: (r) => <Dropdown trigger={<button type="button" onClick={(e) => e.stopPropagation()} className="btn-ghost btn-sm" aria-label="Row actions">⋯</button>} items={rowActions(r)} /> },
            ]}
            rows={rows}
            empty={
              query || status || lowStock
                ? <EmptyState compact title="No products match this view" text="Try clearing the search or the filters." action={<button type="button" onClick={() => { setSearch(''); setParam({ q: '', status: '', lowStock: '' }); }} className="btn-ghost btn-sm">Clear filters</button>} />
                : <EmptyState icon={<IconProducts className="h-5 w-5" />} title="No products yet" text="Create your first product, add photos and variants, then publish it to the store." action={<Link to="/products/new" className="btn-primary">New product</Link>} />
            }
          />
          {pager}
          <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
            <button type="button" onClick={() => bulkStatus('active')} className="btn-ghost btn-sm">Publish</button>
            <button type="button" onClick={() => bulkStatus('draft')} className="btn-ghost btn-sm">Unpublish</button>
            <button type="button" onClick={() => bulkStatus('archived')} className="btn-ghost btn-sm">Archive</button>
            <button type="button" onClick={bulkDelete} className="btn-danger btn-sm">Delete</button>
          </SelectionBar>
        </>
      )}
    </div>
  );
};

export { Products };
