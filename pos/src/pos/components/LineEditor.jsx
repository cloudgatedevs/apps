import { useEffect, useState } from 'react';
import { Modal } from '@/shared/ui/forms';
import { Keypad } from '@/pos/components/Keypad';
import { fmtCents, toCents } from '@/shared/lib/money';
import { useTill } from '@/pos/state/TillProvider';

/** Edit a cart line: quantity (or weight), line discount, or remove it. */
const LineEditor = ({ line, onClose }) => {
  const { setLine, removeLine, currency } = useTill();
  const [tab, setTab] = useState('qty');
  const [qty, setQty] = useState('');
  const [disc, setDisc] = useState('');

  useEffect(() => {
    if (!line) return;
    setTab('qty');
    setQty(line.isWeighed ? (line.qty === 1 ? '' : String(line.qty)) : String(line.qty));
    setDisc(line.discountCents ? (line.discountCents / 100).toFixed(2) : '');
  }, [line?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!line) return null;
  const gross = Math.round(Number(qty || line.qty) * line.unitPriceCents);
  const apply = () => {
    const q = Number(qty);
    const d = toCents(disc) ?? 0;
    if (tab === 'qty') {
      if (!(q > 0)) { removeLine(line.key); onClose(); return; }
      setLine(line.key, { qty: line.isWeighed ? Math.round(q * 1000) / 1000 : Math.round(q) });
    } else {
      setLine(line.key, { discountCents: Math.max(0, Math.min(gross, d)) });
    }
    onClose();
  };

  return (
    <Modal open={!!line} onClose={onClose} title={line.name} description={`${fmtCents(line.unitPriceCents, currency)} per ${line.unit || 'each'}`} size="sm">
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-ink-800 p-1">
        {[['qty', line.isWeighed ? 'Weight' : 'Quantity'], ['disc', 'Discount']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg py-1.5 text-sm font-medium transition ${tab === k ? 'bg-white text-mist shadow-panel' : 'text-mist-muted'}`}>{l}</button>
        ))}
      </div>
      {tab === 'qty' ? (
        <>
          <div className="mb-3 flex items-baseline justify-between rounded-xl border border-ink-700 bg-ink-900 px-4 py-3">
            <span className="text-3xl font-semibold tabular-nums text-mist">{qty || '0'}<span className="ml-1 text-base text-mist-dim">{line.isWeighed ? line.unit : '×'}</span></span>
            <span className="text-sm text-mist-muted">= {fmtCents(gross, currency)}</span>
          </div>
          <Keypad value={qty} onChange={setQty} onEnter={apply} decimals={line.isWeighed ? 3 : 0} enterLabel="Update" />
        </>
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between rounded-xl border border-ink-700 bg-ink-900 px-4 py-3">
            <span className="text-3xl font-semibold tabular-nums text-mist">− {disc || '0.00'}</span>
            <span className="text-sm text-mist-muted">line {fmtCents(Math.max(0, gross - (toCents(disc) ?? 0)), currency)}</span>
          </div>
          <div className="mb-2 flex gap-1.5">
            {[5, 10, 25, 50].map((p) => <button key={p} type="button" className="chip" onClick={() => setDisc((Math.round(gross * p / 100) / 100).toFixed(2))}>{p}%</button>)}
          </div>
          <Keypad value={disc} onChange={setDisc} onEnter={apply} decimals={2} enterLabel="Apply discount" />
        </>
      )}
      <button type="button" onClick={() => { removeLine(line.key); onClose(); }} className="btn-danger mt-3 w-full justify-center">Remove from sale</button>
    </Modal>
  );
};

export { LineEditor };
