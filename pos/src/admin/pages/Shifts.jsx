import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Clock, Lock, Printer } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, Badge, PageHead, Pager, EmptyState, fmtDate } from '@/shared/ui/ui';
import { SkeletonTable, SkeletonDetail } from '@/shared/ui/skeleton';
import { Modal, Field, Notice } from '@/shared/ui/forms';
import { fmtCents, toCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';

const PAGE = 50;
const useCurrency = () => { const s = useAsync(() => adminApi.settings.get(), []); return s.data?.currency || 'ZAR'; };
const diffTone = (d) => (d == null ? 'text-mist-dim' : Number(d) === 0 ? 'text-emerald-700' : 'text-amber-700');

/** Every register session: who, where, takings and whether the cash balanced. */
const Shifts = () => {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') || 0);
  const status = params.get('status') || '';
  const registerId = params.get('register') || '';
  const setParam = (patch) => { const next = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v === '' || v == null ? next.delete(k) : next.set(k, String(v)))); if (!('page' in patch)) next.delete('page'); setParams(next); };
  const { data, loading, error, reload } = useAsync(() => adminApi.shifts.list({ status, registerId, skip: page * PAGE, take: PAGE }), [status, registerId, page]);
  const registers = useAsync(() => adminApi.registers.list(), []);
  const currency = useCurrency();
  const total = data?.total ?? 0;
  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Shifts" subtitle="Register sessions with their cash-up. Open shifts can be closed from here if a teller forgot."><button onClick={reload} className="btn-ghost">Refresh</button></PageHead>
      <div className="flex flex-wrap gap-2">
        <select value={status} onChange={(e) => setParam({ status: e.target.value })} className="select"><option value="">Open + closed</option><option value="open">Open</option><option value="closed">Closed</option></select>
        <select value={registerId} onChange={(e) => setParam({ register: e.target.value })} className="select"><option value="">All registers</option>{(registers.data ?? []).map((r) => <option key={r.Id} value={r.Id}>{r.Name}</option>)}</select>
      </div>
      <ErrorNote error={error} />
      {loading && !data ? <SkeletonTable columns={7} rows={8} /> : (
        <Table rows={data?.items ?? []} rowHref={(s) => `/shifts/${s.Id}`} empty={<EmptyState icon={<Clock className="h-5 w-5" />} title="No shifts yet" text="Tellers open a shift on the till before selling." />}
          columns={[
            { key: 'Id', label: '#', mobile: 'hide', render: (s) => <span className="font-mono text-mist-dim">{s.Id}</span> },
            { key: 'TellerName', label: 'Teller', mobile: 'title', render: (s) => <Link to={`/shifts/${s.Id}`} className="font-medium text-mist hover:text-accent">{s.TellerName}</Link> },
            { key: 'RegisterName', label: 'Register', mobile: 'meta' },
            { key: 'OpenedAt', label: 'Opened', mobile: 'meta', render: (s) => <span className="text-mist-muted">{fmtDate(s.OpenedAt)}</span> },
            { key: 'ClosedAt', label: 'Closed', mobile: 'hide', render: (s) => <span className="text-mist-muted">{s.ClosedAt ? fmtDate(s.ClosedAt) : '—'}</span> },
            { key: 'SalesCount', label: 'Sales', align: 'right' },
            { key: 'SalesTotalCents', label: 'Takings', align: 'right', render: (s) => <span className="tabular-nums font-medium">{fmtCents(s.SalesTotalCents, currency)}</span> },
            { key: 'DifferenceCents', label: 'Cash diff', align: 'right', render: (s) => <span className={`tabular-nums ${diffTone(s.DifferenceCents)}`}>{s.DifferenceCents == null ? '—' : fmtCents(s.DifferenceCents, currency)}</span> },
            { key: 'Status', label: 'Status', render: (s) => <Badge tone={s.Status === 'open' ? 'green' : 'gray'} dot>{s.Status}</Badge> },
          ]} />
      )}
      {total > PAGE ? <Pager page={page} pages={Math.ceil(total / PAGE)} total={total} from={page * PAGE + 1} to={Math.min(total, (page + 1) * PAGE)} noun="shifts" onPage={(p) => setParam({ page: p })} /> : null}
    </div>
  );
};

const Row = ({ l, r, bold, tone = '' }) => <div className={`flex justify-between py-1 text-sm ${bold ? 'font-semibold text-mist' : 'text-mist-muted'} ${tone}`}><span>{l}</span><span className="tabular-nums">{r}</span></div>;

/** Z-report for one shift, with an administrator force-close for shifts left open. */
const ShiftDetail = () => {
  const { id } = useParams();
  const { data: s, loading, error, setData } = useAsync(() => adminApi.shifts.get(Number(id)), [id]);
  const currency = useCurrency();
  const [closing, setClosing] = useState(false);
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (loading) return <SkeletonDetail />;
  if (error) return <ErrorNote error={error} />;
  const expected = s.Status === 'open' ? s.ExpectedCashNowCents : s.ExpectedCashCents;
  const forceClose = async () => {
    setBusy(true);
    try { setData(await adminApi.shifts.forceClose(s.Id, { countedCents: toCents(counted), note })); toast.success('Shift closed.'); setClosing(false); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-5">
      <PageHead title={`Shift #${s.Id} · ${s.RegisterName}`} subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone={s.Status === 'open' ? 'green' : 'gray'} dot>{s.Status}</Badge><span>{s.TellerName} · opened {fmtDate(s.OpenedAt)}{s.ClosedAt ? ` · closed ${fmtDate(s.ClosedAt)} by ${s.ClosedBy}` : ''}</span></span>}>
        <Link to="/shifts" className="btn-ghost">Back</Link>
        <Link to={`/sales?shift=${s.Id}`} className="btn-ghost">Sales on this shift</Link>
        <button type="button" onClick={() => window.print()} className="btn-ghost"><Printer className="h-4 w-4" /> Print</button>
        {s.Status === 'open' ? <button type="button" onClick={() => setClosing(true)} className="btn-danger"><Lock className="h-4 w-4" /> Force close</button> : null}
      </PageHead>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card pos-receipt p-5">
          <h2 className="text-[15px] font-semibold text-mist">Z report</h2>
          <div className="mt-2 divide-y divide-ink-700">
            <Row l="Sales" r={`${s.SalesCount} · ${fmtCents(s.SalesTotalCents, currency)}`} bold />
            <Row l="Cash sales" r={fmtCents(s.CashSalesCents, currency)} />
            <Row l="Card sales" r={fmtCents(s.CardSalesCents, currency)} />
            <Row l="Cash refunds" r={`− ${fmtCents(s.CashRefundsCents, currency)}`} />
            <Row l="Card refunds" r={`− ${fmtCents(s.CardRefundsCents, currency)}`} />
            <Row l="Cash in / out" r={fmtCents(s.CashMovementsCents, currency)} />
            <Row l="Opening float" r={fmtCents(s.OpeningFloatCents, currency)} />
            <Row l="Expected in drawer" r={fmtCents(expected, currency)} bold />
            {s.Status === 'closed' ? <><Row l="Counted" r={fmtCents(s.CountedCashCents, currency)} bold /><Row l="Difference" r={s.DifferenceCents == null ? '—' : fmtCents(s.DifferenceCents, currency)} bold tone={diffTone(s.DifferenceCents)} /></> : null}
          </div>
          {s.Note ? <p className="mt-3 text-sm text-mist-muted">{s.Note}</p> : null}
        </section>
        <section className="card p-5">
          <h2 className="text-[15px] font-semibold text-mist">Cash movements</h2>
          {!s.Movements?.length ? <p className="mt-2 text-sm text-mist-dim">None.</p> : (
            <ul className="mt-2 divide-y divide-ink-700 text-sm">{s.Movements.map((m) => <li key={m.Id} className="flex items-center gap-2 py-2"><span className="capitalize text-mist">{m.Type === 'payin' ? 'Cash in' : m.Type === 'payout' ? 'Cash out' : 'Safe drop'}</span><span className="truncate text-xs text-mist-dim">{m.Note} · {m.CreatedBy} · {fmtDate(m.CreatedAt)}</span><span className={`ml-auto tabular-nums ${m.Type === 'payin' ? 'text-emerald-700' : ''}`}>{m.Type === 'payin' ? '+' : '−'} {fmtCents(m.AmountCents, currency)}</span></li>)}</ul>
          )}
        </section>
      </div>
      <Modal open={closing} onClose={busy ? undefined : () => setClosing(false)} title="Force close shift" size="sm" footer={<><button type="button" className="btn-ghost" onClick={() => setClosing(false)}>Cancel</button><button type="button" className="btn-danger" disabled={busy} onClick={forceClose}>{busy ? 'Closing…' : 'Close shift'}</button></>}>
        <Notice tone="warn">The teller will not be able to sell on this shift any more. Leave the count blank if the drawer was not counted.</Notice>
        <Field label={`Counted cash (expected ${fmtCents(expected, currency)})`} className="mt-3"><input value={counted} onChange={(e) => setCounted(e.target.value)} className="input" inputMode="decimal" placeholder="0.00" /></Field>
        <Field label="Note" className="mt-3"><input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="Closed by administrator" /></Field>
      </Modal>
    </div>
  );
};

export { Shifts, ShiftDetail };
