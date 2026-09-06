import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Breadcrumb } from '@/storefront/components/Breadcrumb';
import { shopApi } from '@/storefront/services/shopApi';
import { useStore } from '@/storefront/store/StoreProvider';
import { useAsync } from '@/shared/ui/ui';
import { SkeletonCards } from '@/shared/ui/skeleton';
import { Modal } from '@/shared/ui/forms';
import { ProductCard } from '@/storefront/components/ProductCard';
import { errorMessage } from '@/shared/lib/errors';
import { fmtCents, fromCents, toCents } from '@/shared/lib/money';
import { SearchX, X } from 'lucide-react';

const PAGE_SIZE = 24;
const SORTS = [['featured', 'Featured'], ['newest', 'Newest'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['name', 'Name']];

/** Category list, stock toggle and price range; used in the desktop sidebar and the mobile drawer. */
const Filters = ({ category, categories, inStock, min, max, bounds, currency, onChange, onCategory }) => {
  const [lo, setLo] = useState(min ? fromCents(min) : '');
  const [hi, setHi] = useState(max ? fromCents(max) : '');
  useEffect(() => { setLo(min ? fromCents(min) : ''); setHi(max ? fromCents(max) : ''); }, [min, max]);
  const applyPrice = (e) => { e?.preventDefault(); onChange({ min: toCents(lo) || '', max: toCents(hi) || '' }); };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="label mb-1">Category</p>
        <button type="button" onClick={() => onCategory(null)} className={`rounded-lg px-3 py-2 text-left text-sm ${!category ? 'bg-primary text-primary-fg' : 'text-zinc-700 hover:bg-zinc-100'}`}>All products</button>
        {categories.filter((c) => !c.ParentId).map((c) => (
          <button key={c.Id} type="button" onClick={() => onCategory(c.Slug)} className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${c.Slug === category ? 'bg-primary text-primary-fg' : 'text-zinc-700 hover:bg-zinc-100'}`}>
            <span>{c.Name}</span><span className={`text-xs ${c.Slug === category ? 'text-zinc-300' : 'text-zinc-400'}`}>{c.ProductCount}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <p className="label">Availability</p>
        <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={inStock} onChange={(e) => onChange({ inStock: e.target.checked ? '1' : '' })} className="accent-zinc-900" /> In stock only</label>
      </div>
      <form onSubmit={applyPrice} className="flex flex-col gap-2">
        <p className="label">Price</p>
        {bounds?.maxCents ? <p className="text-xs text-zinc-500">{fmtCents(bounds.minCents, currency)} – {fmtCents(bounds.maxCents, currency)}</p> : null}
        <div className="flex items-center gap-2">
          <input value={lo} onChange={(e) => setLo(e.target.value)} placeholder="Min" inputMode="decimal" aria-label="Minimum price" className="input py-2 text-sm" />
          <span className="text-zinc-400">–</span>
          <input value={hi} onChange={(e) => setHi(e.target.value)} placeholder="Max" inputMode="decimal" aria-label="Maximum price" className="input py-2 text-sm" />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-ghost btn-sm grow">Apply</button>
          {min || max ? <button type="button" onClick={() => onChange({ min: '', max: '' })} className="btn-ghost btn-sm">Clear</button> : null}
        </div>
      </form>
    </div>
  );
};

const Catalog = () => {
  const { category } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q') ?? '';
  const sort = params.get('sort') ?? 'featured';
  const inStock = params.get('inStock') === '1';
  const min = Number(params.get('min') ?? 0) || 0;
  const max = Number(params.get('max') ?? 0) || 0;
  const page = Number(params.get('page') ?? 0) || 0;
  const { categories, currency } = useStore();
  const current = categories.find((c) => c.Slug === category);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const setParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === '' || v == null || v === false ? next.delete(k) : next.set(k, String(v))));
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };
  // Category is part of the path; keep the query (sort, stock, price) and navigate client-side so nothing reloads.
  const goCategory = (slug) => { const qs = params.toString(); navigate(`${slug ? `/shop/${slug}` : '/shop'}${qs ? `?${qs}` : ''}`); };

  const res = useAsync(() => shopApi.products({ category, search: q || undefined, sort, inStock, minCents: min, maxCents: max, skip: page * PAGE_SIZE, take: PAGE_SIZE }), [category, q, sort, inStock, min, max, page]);
  const bounds = useAsync(() => shopApi.priceBounds(category), [category]);
  const items = res.data?.items ?? [];
  const total = res.data?.total ?? 0;
  // First visit shows skeletons; every later filter change keeps the old grid on screen (faded) until
  // the new one lands, then the new cards fade in with a short stagger. The key changes with the set
  // and order of products, so the entrance replays only when the results actually change.
  const firstLoad = res.loading && !res.data;
  const stale = res.loading && !!res.data;
  const gridKey = items.map((p) => p.Id).join(',');
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilters = [inStock ? 'In stock' : null, min || max ? `${min ? fmtCents(min, currency) : '…'} – ${max ? fmtCents(max, currency) : '…'}` : null].filter(Boolean);

  const filters = (
    <Filters category={category} categories={categories} inStock={inStock} min={min} max={max} bounds={bounds.data} currency={currency}
      onChange={(patch) => { setParam(patch); setFiltersOpen(false); }} onCategory={(slug) => { setFiltersOpen(false); goCategory(slug); }} />
  );

  return (
    <div className="container-x flex flex-col gap-6 py-8">
      <div className="flex flex-col gap-2">
        <Breadcrumb items={current ? [['Shop', '/shop'], [current.Name]] : [['Shop']]} />
        <h1 className="font-display text-3xl tracking-tight">{q ? `Results for “${q}”` : current?.Name ?? 'All products'}</h1>
        {current?.Description ? <p className="max-w-2xl text-sm text-zinc-600">{current.Description}</p> : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="hidden lg:block"><div className="sticky top-24">{filters}</div></aside>

        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setFiltersOpen(true)} className="chip lg:hidden">Filters{activeFilters.length ? ` (${activeFilters.length})` : ''}</button>
            {activeFilters.map((f) => <span key={f} className="chip chip-active">{f}</span>)}
            {q ? <button type="button" onClick={() => setParam({ q: '' })} className="chip">“{q}” <X className="h-3.5 w-3.5" aria-hidden="true" /></button> : null}
            <span className="grow" />
            {res.data ? <p className={`text-xs text-zinc-500 transition-opacity duration-200 ${stale ? 'opacity-40' : ''}`}>{total} product{total === 1 ? '' : 's'}</p> : null}
            <select value={sort} onChange={(e) => setParam({ sort: e.target.value })} className="select w-auto py-1.5 text-sm" aria-label="Sort by">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>

          {res.error ? <p className="text-sm text-red-600">{errorMessage(res.error)}</p> : firstLoad ? (
            <SkeletonCards count={8} className="lg:grid-cols-3 xl:grid-cols-4" />
          ) : items.length === 0 ? (
            <div key="empty" className={`ui-page card flex flex-col items-center gap-3 p-12 text-center transition-opacity duration-200 ${stale ? 'opacity-40' : ''}`} aria-busy={stale}>
              <span className="grid h-14 w-14 place-items-center rounded-full bg-zinc-100 text-zinc-500"><SearchX className="h-6 w-6" aria-hidden="true" /></span>
              <p className="font-medium text-zinc-900">Nothing matches</p>
              <p className="text-sm text-zinc-500">Try another category, widen the price range or clear the search.</p>
              <button type="button" onClick={() => setParam({ q: '', inStock: '', min: '', max: '' })} className="btn-ghost btn-sm">Clear filters</button>
            </div>
          ) : (
            <>
              <div key={gridKey} className={`ui-grid-in grid grid-cols-2 gap-5 transition-opacity duration-200 md:grid-cols-3 xl:grid-cols-4 ${stale ? 'pointer-events-none opacity-40' : ''}`} aria-busy={stale}>
                {items.map((p, i) => <div key={p.Id} style={{ animationDelay: `${Math.min(i, 11) * 35}ms` }}><ProductCard p={p} currency={currency} eager={i < 4} /></div>)}
              </div>
              {pages > 1 ? (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button type="button" disabled={page === 0} onClick={() => setParam({ page: page - 1 })} className="btn-ghost btn-sm">‹ Prev</button>
                  <span className="text-sm tabular-nums text-zinc-600">{page + 1} / {pages}</span>
                  <button type="button" disabled={page >= pages - 1} onClick={() => setParam({ page: page + 1 })} className="btn-ghost btn-sm">Next ›</button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" variant="drawer-left">{filters}</Modal>
    </div>
  );
};

export { Catalog };
