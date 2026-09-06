import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Banknote, CreditCard } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, StatCard, Table, Badge, PageHead, EmptyState, fmtRelative } from '@/shared/ui/ui';
import { SkeletonStats, SkeletonTable, Skeleton } from '@/shared/ui/skeleton';
import { fmtCents } from '@/shared/lib/money';
import { useLiveEvents, liveEnabled } from '@/admin/services/live';
import { Sparkline, Bars } from '@/admin/components/charts';
import { SetupChecklist } from '@/admin/components/SetupChecklist';
import { WalletGate, useWalletStatus } from '@/admin/components/WalletGate';
import { Receipt } from 'lucide-react';

const PERIODS = [[7, '7 days'], [30, '30 days'], [90, '90 days']];
export const SALE_TONE = { completed: 'green', refunded: 'amber', partially_refunded: 'amber', voided: 'red', open: 'blue', held: 'gray', discarded: 'gray' };

const fillDays = (rows, days) => {
  const byDay = new Map((rows ?? []).map((r) => [String(r.Day).slice(0, 10), r]));
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const r = byDay.get(key);
    out.push({ key, label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: Number(r?.RevenueCents ?? 0), sales: Number(r?.Sales ?? 0) });
  }
  return out;
};

const Dashboard = () => {
  const [days, setDays] = useState(30);
  const stats = useAsync(() => adminApi.dashboard.stats(), []);
  const recent = useAsync(() => adminApi.dashboard.recent(8), []);
  const byDay = useAsync(() => adminApi.dashboard.byDay(days), [days]);
  const top = useAsync(() => adminApi.dashboard.top(days, 6), [days]);
  const tellers = useAsync(() => adminApi.dashboard.byTeller(days), [days]);
  const low = useAsync(() => adminApi.inventory.levels({ lowStock: true, take: 8 }), []);
  const registers = useAsync(() => adminApi.registers.list(), []);
  const tellerList = useAsync(() => adminApi.tellers.list(), []);
  const currency = stats.data?.Currency || 'ZAR';
  const wallet = useWalletStatus();

  const reloadAll = () => { stats.reload(); recent.reload(); byDay.reload(); top.reload(); tellers.reload(); low.reload(); };
  useLiveEvents(useCallback((e) => {
    if (e.type === 'sale.completed' || e.type === 'sale.refunded') { stats.reload(); recent.reload(); byDay.reload(); top.reload(); tellers.reload(); }
    if (e.type === 'stock.adjusted' || e.type === 'sale.completed') low.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []), ['sale.completed', 'sale.refunded', 'stock.adjusted']);

  const series = fillDays(byDay.data, days);
  const periodRevenue = series.reduce((s, d) => s + d.value, 0);
  const periodSales = series.reduce((s, d) => s + d.sales, 0);
  const s = stats.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Dashboard" subtitle={liveEnabled ? 'How the store is doing right now. Updates live as the tills ring up sales.' : 'How the store is doing right now.'}>
        <button onClick={reloadAll} className="btn-ghost">Refresh</button>
      </PageHead>

      <WalletGate status={wallet.data} />
      <SetupChecklist activeProducts={s?.ActiveProducts} walletReady={wallet.data?.ready} registers={registers.data?.length} tellers={tellerList.data?.length} />
      <ErrorNote error={stats.error} />

      {stats.loading ? <SkeletonStats count={4} /> : s ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Today" value={fmtCents(s.TodayCents, currency)} sub={`${s.TodayCount} sale${s.TodayCount === 1 ? '' : 's'}${Number(s.TodayRefundsCents) ? ` · ${fmtCents(s.TodayRefundsCents, currency)} refunded` : ''}`}>
            <div className="mt-2 flex gap-3 text-xs text-mist-muted"><span className="inline-flex items-center gap-1"><Banknote className="h-3.5 w-3.5" /> {fmtCents(s.TodayCashCents, currency)}</span><span className="inline-flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> {fmtCents(s.TodayCardCents, currency)}</span></div>
          </StatCard>
          <StatCard label="Last 30 days" value={fmtCents(s.Month30Cents, currency)} sub={`${s.Month30Count} sales · 7 days ${fmtCents(s.Week7Cents, currency)}`} />
          <StatCard label="Tills" value={`${s.OpenShifts} open`} sub={`${s.HeldSales} parked sale${s.HeldSales === 1 ? '' : 's'}`} />
          <StatCard label="Stock" value={`${s.LowStock} low`} sub={`${s.OutOfStock} out of stock · value ${fmtCents(s.StockValueCents, currency)}`} />
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-[15px] font-semibold text-mist">Takings</h2><p className="text-xs text-mist-muted">{fmtCents(periodRevenue, currency)} from {periodSales} sales</p></div>
            <div className="flex gap-1 rounded-lg bg-ink-800 p-0.5">{PERIODS.map(([d, l]) => <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${days === d ? 'bg-white text-mist shadow-panel' : 'text-mist-muted'}`}>{l}</button>)}</div>
          </div>
          <div className="mt-3">{byDay.loading ? <Skeleton className="h-[120px] w-full rounded-lg" /> : <Sparkline data={series} format={(v) => fmtCents(v, currency)} />}</div>
        </section>
        <section className="card p-4">
          <h2 className="text-[15px] font-semibold text-mist">Top products</h2>
          <div className="mt-3">{top.loading ? <Skeleton className="h-32 w-full rounded-lg" /> : <Bars data={(top.data ?? []).map((p) => ({ label: p.Name, value: Number(p.RevenueCents), sub: `${Number(p.UnitsSold)} sold` }))} format={(v) => fmtCents(v, currency)} />}</div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3"><h2 className="text-[15px] font-semibold text-mist">Recent sales</h2><Link to="/sales" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-600">All sales <ArrowRight className="h-3.5 w-3.5" /></Link></div>
          {recent.loading ? <div className="p-4"><SkeletonTable columns={4} rows={5} /></div> : (
            <Table rows={recent.data ?? []} rowHref={(r) => `/sales/${r.Id}`} empty={<EmptyState icon={<Receipt className="h-5 w-5" />} title="No sales yet" text="Sales from the tills appear here as they happen." compact />}
              columns={[
                { key: 'Reference', label: 'Receipt', mobile: 'title', render: (r) => <span className="font-mono text-mist">{r.Reference}</span> },
                { key: 'TellerName', label: 'Teller', mobile: 'meta' },
                { key: 'Methods', label: 'Paid', render: (r) => <span className="capitalize">{String(r.Methods || '').replace(',', ' + ')}</span> },
                { key: 'Status', label: 'Status', render: (r) => <Badge tone={SALE_TONE[r.Status] ?? 'gray'} dot>{String(r.Status).replace('_', ' ')}</Badge> },
                { key: 'CompletedAt', label: 'When', mobile: 'meta', render: (r) => <span className="text-mist-muted">{fmtRelative(r.CompletedAt)}</span> },
                { key: 'TotalCents', label: 'Total', align: 'right', render: (r) => <span className="tabular-nums font-medium text-mist">{fmtCents(r.TotalCents, r.Currency || currency)}</span> },
              ]} />
          )}
        </section>
        <div className="flex flex-col gap-4">
          <section className="card p-4">
            <h2 className="text-[15px] font-semibold text-mist">Tellers · {days} days</h2>
            <ul className="mt-2 divide-y divide-ink-700">
              {(tellers.data ?? []).map((t) => <li key={t.TellerUserId} className="flex items-center justify-between py-1.5 text-sm"><span className="text-mist">{t.TellerName}</span><span className="text-xs text-mist-dim">{t.Sales} sales</span><span className="tabular-nums font-medium text-mist">{fmtCents(t.RevenueCents, currency)}</span></li>)}
              {!tellers.loading && !tellers.data?.length ? <li className="py-2 text-sm text-mist-dim">No sales in this period.</li> : null}
            </ul>
          </section>
          <section className="card p-4">
            <div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold text-mist">Low stock</h2><Link to="/inventory?low=1" className="text-xs font-medium text-accent hover:text-accent-600">Inventory</Link></div>
            <ul className="mt-2 divide-y divide-ink-700">
              {(low.data?.items ?? []).map((p) => <li key={p.Id} className="flex items-center justify-between py-1.5 text-sm"><Link to={`/products/${p.Id}`} className="truncate text-mist hover:text-accent">{p.Name}</Link><span className={`tabular-nums text-xs font-medium ${Number(p.StockQty) <= 0 ? 'text-red-600' : 'text-amber-600'}`}>{Number(p.StockQty)} {p.Unit !== 'each' ? p.Unit : 'left'}</span></li>)}
              {!low.loading && !low.data?.items?.length ? <li className="py-2 text-sm text-mist-dim">Everything is in stock.</li> : null}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export { Dashboard };
