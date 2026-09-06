import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, Badge, PageHead, Pager, SearchBar, EmptyState, SelectionBar, sortRows, fmtDateShort } from '@/shared/ui/ui';
import { SkeletonTable } from '@/shared/ui/skeleton';
import { Dropdown } from '@/shared/ui/menus';
import { fmtCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { useLiveEvents } from '@/admin/services/live';
import { IconOrders } from '@/admin/components/navConfig';
import { runBulk } from '@/admin/pages/Products';
import { ExternalLink } from 'lucide-react';

const PAGE_SIZE = 50;

export const orderStatusTone = (s) => {
  const v = String(s ?? '').toLowerCase();
  if (v === 'paid' || v === 'delivered') return 'green';
  if (v === 'pending') return 'amber';
  if (v === 'processing' || v === 'shipped') return 'blue';
  if (v === 'cancelled' || v === 'refunded' || v === 'failed') return 'red';
  return 'gray';
};
export const paymentStatusTone = (s) => ({ paid: 'green', pending: 'amber', unpaid: 'gray', failed: 'red', refunded: 'red', partially_refunded: 'violet' }[String(s ?? '').toLowerCase()] ?? 'gray');

const NEXT = { pending: ['cancelled'], paid: ['processing', 'shipped', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['delivered'] };

const Orders = () => {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const query = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 0) || 0;
  const [search, setSearch] = useState(query);
  const [sort, setSort] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const setParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === '' || v == null ? next.delete(k) : next.set(k, String(v))));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
    setSelected(new Set());
  };

  const { data, loading, error, reload } = useAsync(
    () => adminApi.orders.list({ search: query || undefined, status: status || undefined, skip: page * PAGE_SIZE, take: PAGE_SIZE }),
    [query, status, page],
  );
  useLiveEvents(useCallback(() => reload(), [reload]), ['order.paid', 'order.status']);
  const rows = useMemo(() => sortRows(data?.items ?? [], sort), [data, sort]);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pager = <Pager page={page} pages={pages} total={total} from={total === 0 ? 0 : page * PAGE_SIZE + 1} to={Math.min(total, (page + 1) * PAGE_SIZE)} noun="orders" onPage={(p) => setParam({ page: p })} />;
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const setStatus = (r, next) =>
    adminApi.orders.setStatus(r.Id, next).then(() => { toast.success(`${r.Reference} marked ${next}.`); reload(); }).catch((e) => toast.error(errorMessage(e)));

  const bulk = async (next) => {
    const ids = [...selected].filter((id) => (NEXT[rows.find((r) => r.Id === id)?.Status] ?? []).includes(next));
    if (!ids.length) { toast.info(`None of the selected orders can be marked ${next}.`); return; }
    await runBulk(ids, `Marked ${next}`, (id) => adminApi.orders.setStatus(id, next, next === 'shipped' ? { notifyCustomer: true } : {}));
    setSelected(new Set());
    reload();
  };

  const rowActions = (r) => [
    { label: 'Open', onSelect: () => window.location.assign(`/admin/orders/${r.Id}`) },
    ...(NEXT[r.Status] ?? []).map((s) => ({ label: `Mark ${s}`, danger: s === 'cancelled', onSelect: () => setStatus(r, s) })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Orders" subtitle="Every order placed in the store — who ordered, for how much, and where it stands.">
        <select value={status} onChange={(e) => setParam({ status: e.target.value })} className="select grow py-2 sm:grow-0 sm:py-1.5" aria-label="Status filter">
          <option value="">All statuses</option>
          {['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={reload} className="btn-ghost">Refresh</button>
      </PageHead>

      <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} onSubmit={(e) => { e.preventDefault(); setParam({ q: search.trim() }); }}
        onClear={query ? () => { setSearch(''); setParam({ q: '' }); } : undefined} placeholder="Search by reference, customer name, email or phone…" />

      <ErrorNote error={error} />
      {loading ? (
        <SkeletonTable columns={7} rows={8} />
      ) : (
        <>
          {pager}
          <Table
            rowHref={(r) => `/orders/${r.Id}`}
            sort={sort}
            onSort={setSort}
            selectable
            selected={selected}
            onToggle={toggle}
            onToggleAll={(ids) => setSelected(new Set(ids))}
            columns={[
              { key: 'Reference', label: 'Order', mobile: 'title', sortable: true, render: (r) => <Link to={`/orders/${r.Id}`} className="whitespace-nowrap font-mono text-[13px] font-medium text-mist hover:text-accent">{r.Reference}</Link> },
              { key: 'Email', label: 'Customer', mobile: 'meta', sortable: true, render: (r) => <div className="flex flex-col leading-tight"><span className="text-mist">{[r.Name, r.Surname].filter(Boolean).join(' ') || '—'}</span><span className="break-all text-xs text-mist-dim">{r.Email}</span></div> },
              { key: 'Items', label: 'Items', mobile: 'hide', align: 'right', render: (r) => <span className="tabular-nums">{r.Items}</span> },
              { key: 'TotalCents', label: 'Total', sortable: true, align: 'right', render: (r) => <span className="font-semibold tabular-nums text-mist">{fmtCents(r.TotalCents, r.Currency)}</span> },
              { key: 'PaymentStatus', label: 'Payment', sortable: true, render: (r) => <Badge tone={paymentStatusTone(r.PaymentStatus)}>{r.PaymentStatus}</Badge> },
              { key: 'Status', label: 'Status', sortable: true, render: (r) => <Badge tone={orderStatusTone(r.Status)} dot>{r.Status}</Badge> },
              { key: 'CreatedAt', label: 'Placed', sortable: true, render: (r) => <span className="whitespace-nowrap text-mist-dim">{fmtDateShort(r.CreatedAt)}</span> },
              { key: 'actions', label: '', mobile: 'actions', render: (r) => <Dropdown trigger={<button type="button" onClick={(e) => e.stopPropagation()} className="btn-ghost btn-sm" aria-label="Row actions">⋯</button>} items={rowActions(r)} /> },
            ]}
            rows={rows}
            empty={
              query || status
                ? <EmptyState compact title="No orders match this view" text="Try another status or clear the search." action={<button type="button" onClick={() => { setSearch(''); setParam({ q: '', status: '' }); }} className="btn-ghost btn-sm">Clear filters</button>} />
                : <EmptyState icon={<IconOrders className="h-5 w-5" />} title="No orders yet" text="They appear here the moment a customer checks out. Share the store link to get the first one." action={<a href="/" target="_blank" rel="noreferrer" className="btn-ghost">Open the shop <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>} />
            }
          />
          {pager}
          <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
            <button type="button" onClick={() => bulk('processing')} className="btn-ghost btn-sm">Mark processing</button>
            <button type="button" onClick={() => bulk('shipped')} className="btn-ghost btn-sm">Mark shipped</button>
            <button type="button" onClick={() => bulk('delivered')} className="btn-ghost btn-sm">Mark delivered</button>
            <button type="button" onClick={() => bulk('cancelled')} className="btn-danger btn-sm">Cancel</button>
          </SelectionBar>
        </>
      )}
    </div>
  );
};

export { Orders };
