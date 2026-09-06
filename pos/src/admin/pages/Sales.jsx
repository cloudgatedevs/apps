import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, Badge, PageHead, Pager, SearchBar, EmptyState, fmtDate } from '@/shared/ui/ui';
import { SkeletonTable } from '@/shared/ui/skeleton';
import { fmtCents } from '@/shared/lib/money';
import { useLiveEvents } from '@/admin/services/live';
import { SALE_TONE } from '@/admin/pages/Dashboard';

const PAGE = 50;
const STATUSES = [['', 'All'], ['completed', 'Completed'], ['partially_refunded', 'Partly refunded'], ['refunded', 'Refunded'], ['held', 'Parked'], ['open', 'Open (awaiting card)'], ['voided', 'Voided']];

/** Every sale from every till, filterable by status, date, teller and register. */
const Sales = () => {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') || 0);
  const search = params.get('q') || '';
  const status = params.get('status') || '';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const registerId = params.get('register') || '';
  const tellerUserId = params.get('teller') || '';
  const shiftId = params.get('shift') || '';
  const [draft, setDraft] = useState(search);
  const setParam = (patch) => { const next = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v === '' || v == null ? next.delete(k) : next.set(k, String(v)))); if (!('page' in patch)) next.delete('page'); setParams(next); };

  const { data, loading, error, reload } = useAsync(() => adminApi.sales.list({ search, status, from, to, registerId, tellerUserId, shiftId, skip: page * PAGE, take: PAGE }), [search, status, from, to, registerId, tellerUserId, shiftId, page]);
  const registers = useAsync(() => adminApi.registers.list(), []);
  const tellers = useAsync(() => adminApi.tellers.list(), []);
  useLiveEvents(useCallback(() => reload(), [reload]), ['sale.completed', 'sale.refunded']);
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Sales" subtitle={shiftId ? `Sales on shift #${shiftId}` : 'Every receipt from every till.'}>
        {shiftId ? <Link to={`/shifts/${shiftId}`} className="btn-ghost">Back to shift</Link> : null}
        <button onClick={reload} className="btn-ghost">Refresh</button>
      </PageHead>
      <SearchBar value={draft} onChange={(e) => setDraft(e.target.value)} onSubmit={(e) => { e.preventDefault(); setParam({ q: draft.trim() }); }} onClear={() => { setDraft(''); setParam({ q: '' }); }} placeholder="Receipt number, customer or teller…" mono>
        <select value={status} onChange={(e) => setParam({ status: e.target.value })} className="select">{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select value={registerId} onChange={(e) => setParam({ register: e.target.value })} className="select"><option value="">All registers</option>{(registers.data ?? []).map((r) => <option key={r.Id} value={r.Id}>{r.Name}</option>)}</select>
        <select value={tellerUserId} onChange={(e) => setParam({ teller: e.target.value })} className="select"><option value="">All tellers</option>{(tellers.data ?? []).map((t) => <option key={t.TellerUserId} value={t.TellerUserId}>{t.TellerName}</option>)}</select>
        <input type="date" value={from} onChange={(e) => setParam({ from: e.target.value })} className="input" aria-label="From" />
        <input type="date" value={to} onChange={(e) => setParam({ to: e.target.value })} className="input" aria-label="To" />
      </SearchBar>
      <ErrorNote error={error} />
      {loading && !data ? <SkeletonTable columns={7} rows={10} /> : (
        <Table rows={data?.items ?? []} rowHref={(s) => `/sales/${s.Id}`} empty={<EmptyState icon={<Receipt className="h-5 w-5" />} title="No sales" text="Nothing matches these filters yet." />}
          columns={[
            { key: 'Reference', label: 'Receipt', mobile: 'title', render: (s) => <Link to={`/sales/${s.Id}`} className="font-mono font-medium text-mist hover:text-accent">{s.Reference}</Link> },
            { key: 'CompletedAt', label: 'When', mobile: 'meta', render: (s) => <span className="text-mist-muted">{fmtDate(s.CompletedAt || s.CreatedAt)}</span> },
            { key: 'TellerName', label: 'Teller', mobile: 'meta', render: (s) => <span>{s.TellerName}<span className="ml-1 text-xs text-mist-dim">{s.RegisterName}</span></span> },
            { key: 'CustomerName', label: 'Customer', mobile: 'hide', render: (s) => <span className="text-mist-muted">{s.CustomerName || '—'}</span> },
            { key: 'ItemCount', label: 'Items', align: 'right' },
            { key: 'Methods', label: 'Paid', render: (s) => <span className="capitalize text-mist-muted">{String(s.Methods || '—').replace(',', ' + ')}</span> },
            { key: 'Status', label: 'Status', render: (s) => <Badge tone={SALE_TONE[s.Status] ?? 'gray'} dot>{String(s.Status).replace('_', ' ')}</Badge> },
            { key: 'TotalCents', label: 'Total', align: 'right', render: (s) => <span className="tabular-nums font-medium text-mist">{fmtCents(s.TotalCents, s.Currency)}{Number(s.RefundedCents) ? <span className="block text-[11px] font-normal text-amber-700">−{fmtCents(s.RefundedCents, s.Currency)}</span> : null}</span> },
          ]} />
      )}
      {total > PAGE ? <Pager page={page} pages={Math.ceil(total / PAGE)} total={total} from={page * PAGE + 1} to={Math.min(total, (page + 1) * PAGE)} noun="sales" onPage={(p) => setParam({ page: p })} /> : null}
    </div>
  );
};

export { Sales };
