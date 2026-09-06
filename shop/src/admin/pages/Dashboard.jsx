import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, StatCard, Table, Badge, PageHead, EmptyState, fmtDateShort } from '@/shared/ui/ui';
import { Skeleton, SkeletonStats, SkeletonTable } from '@/shared/ui/skeleton';
import { fmtCents } from '@/shared/lib/money';
import { orderStatusTone } from '@/admin/pages/Orders';
import { useLiveEvents, liveEnabled } from '@/admin/services/live';
import { Sparkline, Bars } from '@/admin/components/charts';
import { IconOrders } from '@/admin/components/navConfig';
import { SetupChecklist } from '@/admin/components/SetupChecklist';
import { WalletGate, useWalletStatus } from '@/admin/components/WalletGate';
import { ArrowRight, ExternalLink } from 'lucide-react';

const PERIODS = [[7, '7 days'], [30, '30 days'], [90, '90 days']];

const fillDays = (rows, days) => {
  const byDay = new Map((rows ?? []).map((r) => [String(r.Day).slice(0, 10), r]));
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const r = byDay.get(key);
    out.push({ key, label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: Number(r?.RevenueCents ?? 0), orders: Number(r?.Orders ?? 0) });
  }
  return out;
};

const Dashboard = () => {
  const [days, setDays] = useState(30);
  const stats = useAsync(() => adminApi.dashboard.stats(), []);
  const recent = useAsync(() => adminApi.dashboard.recentOrders(8), []);
  const low = useAsync(() => adminApi.inventory.lowStock(8), []);
  const sales = useAsync(() => adminApi.dashboard.salesByDay(days), [days]);
  const top = useAsync(() => adminApi.dashboard.topProducts(days, 6), [days]);
  const currency = stats.data?.Currency || 'ZAR';
  const wallet = useWalletStatus();

  // Live: a paid order or a stock change anywhere refreshes the numbers without a reload.
  useLiveEvents(useCallback((e) => {
    if (e.type === 'order.paid') { stats.reload(); recent.reload(); low.reload(); sales.reload(); top.reload(); }
    if (e.type === 'order.status') { stats.reload(); recent.reload(); }
    if (e.type === 'stock.adjusted') { stats.reload(); low.reload(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []), ['order.paid', 'order.status', 'stock.adjusted']);

  const series = fillDays(sales.data, days);
  const periodRevenue = series.reduce((s, d) => s + d.value, 0);
  const periodOrders = series.reduce((s, d) => s + d.orders, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Dashboard" subtitle={liveEnabled ? 'How the store is doing right now. Updates live as orders are paid.' : 'How the store is doing right now.'}>
        <button onClick={() => { stats.reload(); recent.reload(); low.reload(); sales.reload(); top.reload(); }} className="btn-ghost">Refresh</button>
      </PageHead>

      <WalletGate status={wallet.data} />
      <SetupChecklist activeProducts={stats.data?.ActiveProducts} walletReady={wallet.data?.ready} />

      <ErrorNote error={stats.error} />
      {stats.loading ? (
        <SkeletonStats count={8} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Revenue (30d)" value={fmtCents(stats.data?.Revenue30dCents, currency)} sub={`${stats.data?.Orders30d ?? 0} paid orders`} />
          <StatCard label="Today" value={fmtCents(stats.data?.RevenueTodayCents, currency)} sub={`${stats.data?.OrdersToday ?? 0} paid orders`} />
          <StatCard label="Awaiting fulfilment" value={stats.data?.AwaitingFulfillment} sub={`${stats.data?.PendingOrders ?? 0} unpaid pending`} />
          <StatCard label="Low stock" value={stats.data?.LowStockVariants} sub={`${stats.data?.OutOfStockVariants ?? 0} out of stock`} />
          <StatCard label="Active products" value={stats.data?.ActiveProducts} sub={`${stats.data?.DraftProducts ?? 0} drafts`} />
          <StatCard label="Stock value" value={fmtCents(stats.data?.StockValueCents, currency)} sub="at cost" />
          <StatCard label="Customers" value={stats.data?.Customers} sub="accounts + guests" />
          <StatCard label="Open carts (7d)" value={stats.data?.OpenCarts7d} sub="not yet checked out" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="card flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold text-mist">Sales</h2>
              <p className="text-xs text-mist-muted">{sales.loading ? 'Loading…' : `${fmtCents(periodRevenue, currency)} from ${periodOrders} paid order${periodOrders === 1 ? '' : 's'} in the last ${days} days`}</p>
            </div>
            <div className="flex rounded-lg border border-ink-600 bg-white p-0.5">
              {PERIODS.map(([d, label]) => (
                <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-md px-2.5 py-1 text-xs ${days === d ? 'bg-accent-soft text-accent-600' : 'text-mist-muted'}`} aria-pressed={days === d}>{label}</button>
              ))}
            </div>
          </div>
          {sales.loading ? <Skeleton className="h-[120px] w-full rounded-lg" /> : <Sparkline data={series} format={(v) => fmtCents(v, currency)} />}
        </section>
        <section className="card flex flex-col gap-4 p-4">
          <div>
            <h2 className="text-[15px] font-semibold text-mist">Top products</h2>
            <p className="text-xs text-mist-muted">By revenue, last {days} days.</p>
          </div>
          {top.loading ? <div className="flex flex-col gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full rounded" />)}</div> : (
            <Bars data={(top.data ?? []).map((p) => ({ key: p.ProductId, label: p.Title, sub: `${p.UnitsSold} sold`, value: Number(p.RevenueCents || 0) }))} format={(v) => fmtCents(v, currency)} />
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-mist">Recent orders</h2>
            <Link to="/orders" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-600">View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
          </div>
          <ErrorNote error={recent.error} />
          {recent.loading ? (
            <SkeletonTable columns={5} rows={5} />
          ) : (
            <Table
              rowHref={(r) => `/orders/${r.Id}`}
              columns={[
                { key: 'Reference', label: 'Order', mobile: 'title', render: (r) => <Link to={`/orders/${r.Id}`} className="whitespace-nowrap font-mono text-[13px] font-medium text-mist hover:text-accent">{r.Reference}</Link> },
                { key: 'Email', label: 'Customer', mobile: 'meta', render: (r) => <span className="block max-w-[9rem] truncate text-mist-muted">{[r.Name, r.Surname].filter(Boolean).join(' ') || r.Email}</span> },
                { key: 'TotalCents', label: 'Total', render: (r) => <span className="font-semibold tabular-nums text-mist">{fmtCents(r.TotalCents, r.Currency)}</span> },
                { key: 'Status', label: 'Status', render: (r) => <Badge tone={orderStatusTone(r.Status)}>{r.Status}</Badge> },
                { key: 'CreatedAt', label: 'Placed', mobile: 'hide', render: (r) => <span className="whitespace-nowrap text-mist-dim">{fmtDateShort(r.CreatedAt)}</span> },
              ]}
              rows={recent.data}
              empty={<EmptyState compact icon={<IconOrders className="h-5 w-5" />} title="No orders yet" text="They appear here the moment a customer checks out." action={<a href="/" target="_blank" rel="noreferrer" className="btn-ghost btn-sm">Open the shop <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>} />}
            />
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-mist">Low stock</h2>
            <Link to="/inventory?lowStock=1" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-600">Inventory <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
          </div>
          <ErrorNote error={low.error} />
          {low.loading ? (
            <SkeletonTable columns={3} rows={4} />
          ) : (
            <Table
              rowHref={(r) => `/products/${r.ProductId}`}
              columns={[
                { key: 'ProductName', label: 'Product', mobile: 'title', render: (r) => <Link to={`/products/${r.ProductId}`} className="text-mist hover:text-accent">{r.ProductName}</Link> },
                { key: 'Title', label: 'Variant', mobile: 'meta', render: (r) => <span className="text-mist-muted">{r.Title}{r.Sku ? <span className="ml-2 font-mono text-xs text-mist-dim">{r.Sku}</span> : null}</span> },
                { key: 'AvailableQty', label: 'Available', align: 'right', render: (r) => <span className={`font-semibold tabular-nums ${r.AvailableQty <= 0 ? 'text-red-600' : 'text-amber-600'}`}>{r.AvailableQty}</span> },
              ]}
              rows={low.data}
              empty={<EmptyState compact title="Stock looks healthy" text="Every variant is above its low-stock threshold." />}
            />
          )}
        </section>
      </div>
    </div>
  );
};

export { Dashboard };
