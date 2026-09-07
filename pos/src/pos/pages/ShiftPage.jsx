import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowDownToLine, ArrowUpFromLine, Clock, Lock, Vault } from 'lucide-react';
import { Modal, Field, Notice } from '@/shared/ui/forms';
import { useConfirm } from '@/shared/ui/confirm';
import { Spinner, fmtDate, useAsync } from '@/shared/ui/ui';
import { fmtCents, toCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { posApi } from '@/pos/services/posApi';
import { useTill } from '@/pos/state/TillProvider';
import { Keypad } from '@/pos/components/Keypad';

const Row = ({ l, r, bold, tone = '' }) => <div className={`flex justify-between py-1 text-sm ${bold ? 'font-semibold text-mist' : 'text-mist-muted'} ${tone}`}><span>{l}</span><span className="tabular-nums">{r}</span></div>;

const OpenShift = () => {
  const { setShift, teller } = useTill();
  const { data: registers, loading, error, reload } = useAsync(() => posApi.shift.registers(), []);
  const [registerId, setRegisterId] = useState(null);
  const [flt, setFlt] = useState('');
  const [busy, setBusy] = useState(false);
  const open = async () => {
    if (!registerId) { toast.error('Choose a register.'); return; }
    setBusy(true);
    try { setShift(await posApi.shift.open(registerId, toCents(flt) ?? 0)); toast.success('Shift opened'); } catch (err) { toast.error(errorMessage(err)); reload(); } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-lg">
      <div className="card p-5">
        <h2 className="text-base font-semibold text-mist">Open a shift</h2>
        <p className="mt-1 text-sm text-mist-muted">Pick your register and count the opening float. Sales, cash and refunds are tracked against this shift until you close it.</p>
        {loading ? <Spinner /> : error ? <Notice tone="error" className="mt-4">{errorMessage(error)}</Notice> : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(registers ?? []).map((r) => {
              const mine = r.OpenShiftUserId && String(r.OpenShiftUserId) === String(teller?.id ?? teller?.userId);
              const taken = !!r.OpenShiftId && !mine;
              return (
                <button key={r.Id} type="button" disabled={taken} onClick={() => setRegisterId(r.Id)} className={`rounded-xl border p-3 text-left transition disabled:opacity-50 ${registerId === r.Id ? 'border-secondary ring-2 ring-secondary/30' : 'border-ink-600 bg-white'}`}>
                  <p className="text-sm font-semibold text-mist">{r.Name}</p>
                  <p className="text-xs text-mist-dim">{taken ? `In use by ${r.OpenShiftTeller}` : r.Location || 'Available'}</p>
                </button>
              );
            })}
            {!registers?.length ? <p className="col-span-2 text-sm text-mist-dim">No registers are set up. An administrator adds them in the back office.</p> : null}
          </div>
        )}
        <Field label="Opening float" className="mt-4">
          <div className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-2xl font-semibold tabular-nums text-mist">{flt || '0.00'}</div>
        </Field>
        <Keypad className="mt-2" value={flt} onChange={setFlt} onEnter={open} enterLabel={busy ? 'Opening…' : 'Open shift'} />
      </div>
    </div>
  );
};

const MovementDialog = ({ type, onClose }) => {
  const { setShift } = useTill();
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const labels = { payin: 'Cash in', payout: 'Cash out', drop: 'Safe drop' };
  const save = async () => {
    const c = toCents(amt);
    if (!c || c <= 0) { toast.error('Enter an amount.'); return; }
    setBusy(true);
    try { setShift(await posApi.shift.movement(type, c, note)); toast.success(`${labels[type]} recorded`); onClose(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!type} onClose={busy ? undefined : onClose} title={labels[type] || ''} size="sm">
      <div className="mb-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-2xl font-semibold tabular-nums text-mist">{amt || '0.00'}</div>
      <Field label="Note" className="mb-3"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'payout' ? 'e.g. Milk for the staff room' : ''} /></Field>
      <Keypad value={amt} onChange={setAmt} onEnter={save} enterLabel={busy ? 'Saving…' : 'Record'} />
    </Modal>
  );
};

const CloseDialog = ({ open, onClose, onClosed }) => {
  const { shift, currency } = useTill();
  const confirm = useConfirm();
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const expected = shift?.ExpectedCashNowCents ?? 0;
  const diff = (toCents(counted) ?? 0) - expected;
  const close = async () => {
    if (toCents(counted) === null) { toast.error('Count the cash in the drawer first.'); return; }
    if (!(await confirm({ title: 'Close this shift?', text: 'You will not be able to ring up sales until you open a new one.', confirmLabel: 'Close shift', tone: 'danger' }))) return;
    setBusy(true);
    try { onClosed(await posApi.shift.close(toCents(counted), note)); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Close shift" description="Count everything in the drawer, including the float." size="sm">
      <div className="mb-3 flex items-baseline justify-between rounded-xl border border-ink-700 bg-ink-900 px-4 py-3">
        <span className="text-2xl font-semibold tabular-nums text-mist">{counted || '0.00'}</span>
        <span className={`text-sm tabular-nums ${counted === '' ? 'text-mist-dim' : diff === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{counted === '' ? `expected ${fmtCents(expected, currency)}` : diff === 0 ? 'balanced' : `${diff > 0 ? 'over' : 'short'} ${fmtCents(Math.abs(diff), currency)}`}</span>
      </div>
      <Field label="Note" className="mb-3"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <Keypad value={counted} onChange={setCounted} onEnter={close} enterLabel={busy ? 'Closing…' : 'Close shift'} />
    </Modal>
  );
};

/** Open / run / close the teller's shift, with a Z-style summary once it is closed. */
const ShiftPage = () => {
  const { shift, setShift, currency, reloadShift } = useTill();
  const navigate = useNavigate();
  // The provider's copy can be stale (sales rung up since it loaded); refresh on entry.
  useEffect(() => { void reloadShift(); }, [reloadShift]);
  const [movement, setMovement] = useState(null);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(null);

  if (closed) {
    const s = closed;
    return (
      <div className="mx-auto max-w-lg p-3 sm:p-5">
        <div className="card pos-print p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-mist"><Lock className="h-4 w-4" /> Shift closed · {s.RegisterName}</h2>
          <p className="text-xs text-mist-dim">{fmtDate(s.OpenedAt)} → {fmtDate(s.ClosedAt)}</p>
          <div className="mt-3 divide-y divide-ink-700">
            <Row l="Sales" r={`${s.SalesCount} · ${fmtCents(s.SalesTotalCents, currency)}`} bold />
            <Row l="Cash sales" r={fmtCents(s.CashSalesCents, currency)} />
            <Row l="Card sales" r={fmtCents(s.CardSalesCents, currency)} />
            <Row l="Cash refunds" r={`− ${fmtCents(s.CashRefundsCents, currency)}`} />
            <Row l="Cash in / out" r={fmtCents(s.CashMovementsCents, currency)} />
            <Row l="Opening float" r={fmtCents(s.OpeningFloatCents, currency)} />
            <Row l="Expected in drawer" r={fmtCents(s.ExpectedCashCents, currency)} bold />
            <Row l="Counted" r={fmtCents(s.CountedCashCents, currency)} bold />
            <Row l="Difference" r={fmtCents(s.DifferenceCents, currency)} bold tone={Number(s.DifferenceCents) === 0 ? 'text-emerald-700' : 'text-amber-700'} />
          </div>
          <div className="mt-4 flex gap-2 no-print">
            <button type="button" className="btn-ghost" onClick={() => window.print()}>Print</button>
            <button type="button" className="btn-primary" onClick={() => { setClosed(null); }}>Open a new shift</button>
          </div>
        </div>
      </div>
    );
  }

  if (!shift) return <div className="h-full overflow-y-auto p-3 sm:p-5"><OpenShift /></div>;

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-5">
      <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-mist"><Clock className="h-4 w-4 text-emerald-600" /> {shift.RegisterName}</h2>
            <span className="text-xs text-mist-dim">opened {fmtDate(shift.OpenedAt)}</span>
            <button type="button" onClick={() => setClosing(true)} className="btn-danger ml-auto"><Lock className="h-4 w-4" /> Close shift</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Sales', `${shift.SalesCount}`], ['Takings', fmtCents(shift.SalesTotalCents, currency)], ['Cash', fmtCents(shift.CashSalesCents, currency)], ['Card', fmtCents(shift.CardSalesCents, currency)]].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-ink-700 bg-ink-900 p-3"><p className="text-[11px] uppercase tracking-wide text-mist-dim">{l}</p><p className="text-lg font-semibold tabular-nums text-mist">{v}</p></div>
            ))}
          </div>
          <div className="mt-4 divide-y divide-ink-700">
            <Row l="Opening float" r={fmtCents(shift.OpeningFloatCents, currency)} />
            <Row l="Cash sales" r={`+ ${fmtCents(shift.CashSalesCents, currency)}`} />
            <Row l="Cash refunds" r={`− ${fmtCents(shift.CashRefundsCents, currency)}`} />
            <Row l="Cash in / out" r={fmtCents(shift.CashMovementsCents, currency)} />
            <Row l="Expected in drawer" r={fmtCents(shift.ExpectedCashNowCents, currency)} bold />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button type="button" className="btn-ghost justify-center" onClick={() => setMovement('payin')}><ArrowDownToLine className="h-4 w-4" /> Cash in</button>
            <button type="button" className="btn-ghost justify-center" onClick={() => setMovement('payout')}><ArrowUpFromLine className="h-4 w-4" /> Cash out</button>
            <button type="button" className="btn-ghost justify-center" onClick={() => setMovement('drop')}><Vault className="h-4 w-4" /> Safe drop</button>
          </div>
        </div>
        <div className="card p-4">
          <p className="text-sm font-semibold text-mist">Cash movements</p>
          {!shift.Movements?.length ? <p className="mt-2 text-sm text-mist-dim">None yet.</p> : (
            <ul className="mt-2 divide-y divide-ink-700">
              {shift.Movements.map((m) => (
                <li key={m.Id} className="flex items-center gap-2 py-2 text-sm">
                  <div className="min-w-0 grow"><p className="capitalize text-mist">{m.Type === 'payin' ? 'Cash in' : m.Type === 'payout' ? 'Cash out' : 'Safe drop'}</p>{m.Note ? <p className="truncate text-xs text-mist-dim">{m.Note}</p> : null}</div>
                  <span className={`tabular-nums ${m.Type === 'payin' ? 'text-emerald-700' : 'text-mist'}`}>{m.Type === 'payin' ? '+' : '−'} {fmtCents(m.AmountCents, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <MovementDialog type={movement} onClose={() => setMovement(null)} />
      <CloseDialog open={closing} onClose={() => setClosing(false)} onClosed={(s) => { setClosing(false); setClosed(s); setShift(null); }} />
      {!shift ? null : <button type="button" className="sr-only" onClick={() => navigate('/')}>Back</button>}
    </div>
  );
};

export { ShiftPage };
