import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, PageHead, StatCard, fmtDate } from '@/shared/ui/ui';
import { SkeletonTable, SkeletonStats } from '@/shared/ui/skeleton';
import { fmtCents } from '@/shared/lib/money';
import { Sparkline } from '@/admin/components/charts';

const iso = (d) => d.toISOString().slice(0, 10);
const PRESETS = [
  ['Today', () => { const t = iso(new Date()); return [t, t]; }],
  ['Yesterday', () => { const d = new Date(); d.setDate(d.getDate() - 1); return [iso(d), iso(d)]; }],
  ['This week', () => { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return [iso(d), iso(new Date())]; }],
  ['This month', () => { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date())]; }],
  ['Last 30 days', () => { const d = new Date(); d.setDate(d.getDate() - 29); return [iso(d), iso(new Date())]; }],
];
const TABS = [['summary', 'Daily summary'], ['products', 'Products'], ['categories', 'Categories'], ['tellers', 'Tellers'], ['methods', 'Payment methods'], ['tax', 'Tax'], ['z', 'Z reports']];

const csv = (rows, columns, name) => {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const text = [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(c.csv ? c.csv(r) : r[c.key])).join(','))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(a.href);
};

const Grid = ({ rows, columns, foot }) => (
  <div className="card overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-ink-900 text-left text-xs text-mist-dim"><tr>{columns.map((c) => <th key={c.key} className={`px-3 py-2 font-semibold ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-ink-700">{columns.map((c) => <td key={c.key} className={`px-3 py-1.5 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}{!rows.length ? <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-mist-dim">Nothing in this period.</td></tr> : null}</tbody>
      {foot ? <tfoot className="border-t-2 border-ink-600 font-semibold text-mist"><tr>{columns.map((c) => <td key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>{foot[c.key] ?? ''}</td>)}</tr></tfoot> : null}
    </table>
  </div>
);

const sum = (rows, k) => rows.reduce((s, r) => s + Number(r[k] || 0), 0);

/** Sales, margin, tax and cash-up reports for any date range, exportable as CSV. */
const Reports = () => {
  const [[from, to], setRange] = useState(PRESETS[4][1]());
  const [tab, setTab] = useState('summary');
  const settings = useAsync(() => adminApi.settings.get(), []);
  const cur = settings.data?.currency || 'ZAR';
  const range = { from, to };
  const summary = useAsync(() => adminApi.reports.summary(range), [from, to]);
  const detail = useAsync(() => (tab === 'summary' ? Promise.resolve(null) : tab === 'z' ? adminApi.reports.zReports(range) : adminApi.reports[tab](range)), [tab, from, to]);
  const money = (k) => (r) => fmtCents(r[k], cur);
  const M = (v) => fmtCents(v, cur);

  const totals = useMemo(() => { const r = summary.data ?? []; return { sales: sum(r, 'Sales'), revenue: sum(r, 'RevenueCents'), tax: sum(r, 'TaxCents'), discount: sum(r, 'DiscountCents'), refunded: sum(r, 'RefundedCents'), cost: sum(r, 'CostCents') }; }, [summary.data]);
  const margin = totals.revenue ? Math.round(((totals.revenue - totals.tax - totals.cost) / (totals.revenue - totals.tax || 1)) * 100) : 0;

  const columns = {
    summary: [{ key: 'Day', label: 'Day' }, { key: 'Sales', label: 'Sales', align: 'right' }, { key: 'SubtotalCents', label: 'Subtotal', align: 'right', render: money('SubtotalCents'), csv: (r) => r.SubtotalCents / 100 }, { key: 'DiscountCents', label: 'Discounts', align: 'right', render: money('DiscountCents'), csv: (r) => r.DiscountCents / 100 }, { key: 'TaxCents', label: 'Tax', align: 'right', render: money('TaxCents'), csv: (r) => r.TaxCents / 100 }, { key: 'RevenueCents', label: 'Revenue', align: 'right', render: money('RevenueCents'), csv: (r) => r.RevenueCents / 100 }, { key: 'RefundedCents', label: 'Refunded', align: 'right', render: money('RefundedCents'), csv: (r) => r.RefundedCents / 100 }, { key: 'CostCents', label: 'Cost', align: 'right', render: money('CostCents'), csv: (r) => r.CostCents / 100 }],
    products: [{ key: 'Name', label: 'Product', render: (r) => <Link to={`/products/${r.ProductId}`} className="text-mist hover:text-accent">{r.Name}</Link> }, { key: 'Sku', label: 'SKU' }, { key: 'Units', label: 'Units', align: 'right', render: (r) => Number(r.Units) }, { key: 'RefundedUnits', label: 'Refunded', align: 'right', render: (r) => Number(r.RefundedUnits) }, { key: 'RevenueCents', label: 'Revenue', align: 'right', render: money('RevenueCents'), csv: (r) => r.RevenueCents / 100 }, { key: 'CostCents', label: 'Cost', align: 'right', render: money('CostCents'), csv: (r) => r.CostCents / 100 }, { key: 'Margin', label: 'Margin', align: 'right', render: (r) => `${fmtCents(r.RevenueCents - r.TaxCents - r.CostCents, cur)}`, csv: (r) => (r.RevenueCents - r.TaxCents - r.CostCents) / 100 }],
    categories: [{ key: 'Category', label: 'Category' }, { key: 'Units', label: 'Units', align: 'right', render: (r) => Number(r.Units) }, { key: 'RevenueCents', label: 'Revenue', align: 'right', render: money('RevenueCents'), csv: (r) => r.RevenueCents / 100 }, { key: 'CostCents', label: 'Cost', align: 'right', render: money('CostCents'), csv: (r) => r.CostCents / 100 }],
    tellers: [{ key: 'TellerName', label: 'Teller' }, { key: 'Sales', label: 'Sales', align: 'right' }, { key: 'AvgCents', label: 'Average sale', align: 'right', render: money('AvgCents'), csv: (r) => Math.round(r.AvgCents) / 100 }, { key: 'RevenueCents', label: 'Revenue', align: 'right', render: money('RevenueCents'), csv: (r) => r.RevenueCents / 100 }, { key: 'RefundedCents', label: 'Refunded', align: 'right', render: money('RefundedCents'), csv: (r) => r.RefundedCents / 100 }],
    methods: [{ key: 'Method', label: 'Method', render: (r) => <span className="capitalize">{r.Method}</span> }, { key: 'Payments', label: 'Payments', align: 'right' }, { key: 'AmountCents', label: 'Amount', align: 'right', render: money('AmountCents'), csv: (r) => r.AmountCents / 100 }],
    tax: [{ key: 'TaxRateBp', label: 'Rate', render: (r) => `${Number(r.TaxRateBp) / 100}%` }, { key: 'NetCents', label: 'Net', align: 'right', render: money('NetCents'), csv: (r) => r.NetCents / 100 }, { key: 'TaxCents', label: 'Tax', align: 'right', render: money('TaxCents'), csv: (r) => r.TaxCents / 100 }, { key: 'GrossCents', label: 'Gross', align: 'right', render: money('GrossCents'), csv: (r) => r.GrossCents / 100 }],
    z: [{ key: 'Id', label: '#', render: (r) => <Link to={`/shifts/${r.Id}`} className="font-mono text-accent">{r.Id}</Link> }, { key: 'RegisterName', label: 'Register' }, { key: 'TellerName', label: 'Teller' }, { key: 'OpenedAt', label: 'Opened', render: (r) => fmtDate(r.OpenedAt) }, { key: 'ClosedAt', label: 'Closed', render: (r) => fmtDate(r.ClosedAt) }, { key: 'SalesCount', label: 'Sales', align: 'right' }, { key: 'SalesTotalCents', label: 'Takings', align: 'right', render: money('SalesTotalCents'), csv: (r) => r.SalesTotalCents / 100 }, { key: 'ExpectedCashCents', label: 'Expected cash', align: 'right', render: money('ExpectedCashCents'), csv: (r) => r.ExpectedCashCents / 100 }, { key: 'CountedCashCents', label: 'Counted', align: 'right', render: (r) => (r.CountedCashCents == null ? '—' : M(r.CountedCashCents)), csv: (r) => (r.CountedCashCents ?? '') / 100 }, { key: 'DifferenceCents', label: 'Difference', align: 'right', render: (r) => <span className={r.DifferenceCents == null ? '' : Number(r.DifferenceCents) === 0 ? 'text-emerald-700' : 'text-amber-700'}>{r.DifferenceCents == null ? '—' : M(r.DifferenceCents)}</span>, csv: (r) => (r.DifferenceCents ?? '') / 100 }],
  };
  const rows = tab === 'summary' ? summary.data ?? [] : detail.data ?? [];
  const cols = columns[tab];
  const foot = tab === 'summary' ? { Day: 'Total', Sales: totals.sales, SubtotalCents: M(sum(rows, 'SubtotalCents')), DiscountCents: M(totals.discount), TaxCents: M(totals.tax), RevenueCents: M(totals.revenue), RefundedCents: M(totals.refunded), CostCents: M(totals.cost) }
    : ['products', 'categories', 'tellers', 'methods', 'tax'].includes(tab) ? Object.fromEntries(cols.filter((c) => c.align === 'right' && c.key !== 'AvgCents' && c.key !== 'Margin').map((c) => [c.key, /Cents$/.test(c.key) ? M(sum(rows, c.key)) : sum(rows, c.key)])) : null;
  const series = (summary.data ?? []).map((r) => ({ label: r.Day, value: Number(r.RevenueCents) }));

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Reports" subtitle="Pick a period, then slice it by product, category, teller, payment method or tax rate.">
        <button type="button" onClick={() => csv(rows, cols, `${tab}-${from}-${to}`)} className="btn-ghost" disabled={!rows.length}><Download className="h-4 w-4" /> CSV</button>
      </PageHead>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(([l, fn]) => <button key={l} type="button" onClick={() => setRange(fn())} className="chip">{l}</button>)}
        <input type="date" value={from} onChange={(e) => setRange([e.target.value, to])} className="input" aria-label="From" />
        <span className="text-mist-dim">to</span>
        <input type="date" value={to} onChange={(e) => setRange([from, e.target.value])} className="input" aria-label="To" />
      </div>
      <ErrorNote error={summary.error || detail.error} />
      {summary.loading ? <SkeletonStats count={4} /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Revenue" value={M(totals.revenue)} sub={`${totals.sales} sales · ${M(totals.sales ? Math.round(totals.revenue / totals.sales) : 0)} average`} />
          <StatCard label="Refunded" value={M(totals.refunded)} sub={`Discounts ${M(totals.discount)}`} />
          <StatCard label="Tax collected" value={M(totals.tax)} sub={`Net ${M(totals.revenue - totals.tax)}`} />
          <StatCard label="Gross margin" value={`${margin}%`} sub={`Cost of goods ${M(totals.cost)}`} />
        </div>
      )}
      <section className="card p-4"><Sparkline data={series} format={M} height={100} empty="No sales in this period." /></section>
      <div className="flex gap-1 overflow-x-auto border-b border-ink-700">{TABS.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${tab === k ? 'border-accent text-accent-600' : 'border-transparent text-mist-muted hover:text-mist'}`}>{l}</button>)}</div>
      {(tab === 'summary' ? summary.loading : detail.loading) ? <SkeletonTable columns={cols.length} rows={6} /> : <Grid rows={rows} columns={cols} foot={foot} />}
    </div>
  );
};

export { Reports };
