import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, Badge, PageHead, Pager, SearchBar, EmptyState, sortRows, fmtDateShort } from '@/shared/ui/ui';
import { SkeletonTable } from '@/shared/ui/skeleton';
import { fmtCents } from '@/shared/lib/money';
import { IconCustomers } from '@/admin/components/navConfig';

const PAGE_SIZE = 50;

export const customerName = (c) => [c?.Name, c?.Surname].filter(Boolean).join(' ') || c?.Email || '—';

const Customers = () => {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const kind = params.get('kind') ?? '';
  const sortKey = params.get('sort') ?? 'recent';
  const page = Number(params.get('page') ?? 0) || 0;
  const [search, setSearch] = useState(query);
  const [sort, setSort] = useState(null);
  const setParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === '' || v == null ? next.delete(k) : next.set(k, String(v))));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  const { data, loading, error, reload } = useAsync(
    () => adminApi.customers.list({ search: query || undefined, kind: kind || undefined, sort: sortKey, skip: page * PAGE_SIZE, take: PAGE_SIZE }),
    [query, kind, sortKey, page],
  );
  const rows = useMemo(() => sortRows(data?.items ?? [], sort), [data, sort]);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pager = <Pager page={page} pages={pages} total={total} from={total === 0 ? 0 : page * PAGE_SIZE + 1} to={Math.min(total, (page + 1) * PAGE_SIZE)} noun="customers" onPage={(p) => setParam({ page: p })} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Customers" subtitle="Everyone who has checked out — registered accounts and guests — with what they have spent.">
        <select value={kind} onChange={(e) => setParam({ kind: e.target.value })} className="select grow py-2 sm:grow-0 sm:py-1.5" aria-label="Customer type">
          <option value="">Accounts and guests</option>
          <option value="accounts">Accounts only</option>
          <option value="guests">Guests only</option>
        </select>
        <select value={sortKey} onChange={(e) => setParam({ sort: e.target.value })} className="select grow py-2 sm:grow-0 sm:py-1.5" aria-label="Sort">
          <option value="recent">Most recent order</option>
          <option value="spent">Highest spend</option>
          <option value="name">Name</option>
          <option value="newest">Newest customers</option>
        </select>
        <button onClick={reload} className="btn-ghost">Refresh</button>
      </PageHead>

      <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} onSubmit={(e) => { e.preventDefault(); setParam({ q: search.trim() }); }}
        onClear={query ? () => { setSearch(''); setParam({ q: '' }); } : undefined} placeholder="Search by name, email or phone…" />

      <ErrorNote error={error} />
      {loading ? (
        <SkeletonTable columns={6} rows={8} />
      ) : (
        <>
          {pager}
          <Table
            rowHref={(r) => `/customers/${r.Id}`}
            sort={sort}
            onSort={setSort}
            columns={[
              { key: 'Name', label: 'Customer', mobile: 'title', sortable: true, render: (r) => <div className="flex flex-col leading-tight"><Link to={`/customers/${r.Id}`} className="font-medium text-mist hover:text-accent">{customerName(r)}</Link><span className="break-all text-xs text-mist-dim">{r.Email}</span></div> },
              { key: 'IdpUserId', label: 'Type', mobile: 'meta', render: (r) => (r.IdpUserId ? <Badge tone="blue">account</Badge> : <Badge tone="gray">guest</Badge>) },
              { key: 'Orders', label: 'Paid orders', sortable: true, align: 'right', render: (r) => <span className="tabular-nums">{r.Orders ?? 0}</span> },
              { key: 'SpentCents', label: 'Lifetime value', sortable: true, align: 'right', render: (r) => <span className="font-semibold tabular-nums text-mist">{fmtCents(r.SpentCents ?? 0, r.Currency || 'ZAR')}</span> },
              { key: 'LastOrderAt', label: 'Last order', mobile: 'hide', sortable: true, render: (r) => <span className="whitespace-nowrap text-mist-dim">{r.LastOrderAt ? fmtDateShort(r.LastOrderAt) : '—'}</span> },
              { key: 'CreatedAt', label: 'Since', mobile: 'hide', sortable: true, render: (r) => <span className="whitespace-nowrap text-mist-dim">{fmtDateShort(r.CreatedAt)}</span> },
            ]}
            rows={rows}
            empty={query || kind
              ? <EmptyState compact title="No customers match this view" action={<button type="button" onClick={() => { setSearch(''); setParam({ q: '', kind: '' }); }} className="btn-ghost btn-sm">Clear filters</button>} />
              : <EmptyState icon={<IconCustomers className="h-5 w-5" />} title="No customers yet" text="Customers appear here after their first checkout, whether they sign in or buy as a guest." />}
          />
          {pager}
        </>
      )}
    </div>
  );
};

export { Customers };
