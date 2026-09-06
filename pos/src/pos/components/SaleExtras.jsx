import { useEffect, useState } from 'react';
import { Modal, Field } from '@/shared/ui/forms';
import { Keypad } from '@/pos/components/Keypad';
import { fmtCents, toCents } from '@/shared/lib/money';
import { useTill } from '@/pos/state/TillProvider';

/** Customer name / e-mail on the sale (for the receipt and the e-mailed copy). */
const CustomerDialog = ({ open, onClose }) => {
  const { cart, setCartMeta } = useTill();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { if (open) { setName(cart.customer?.name || ''); setEmail(cart.customer?.email || ''); setNote(cart.note || ''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => { setCartMeta({ customer: name || email ? { name: name.trim(), email: email.trim() } : null, note: note.trim() }); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title="Customer" size="sm"
      footer={<><button type="button" className="btn-ghost" onClick={() => { setCartMeta({ customer: null, note: '' }); onClose(); }}>Clear</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="space-y-3">
        <Field label="Name"><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="E-mail" hint="The receipt can be e-mailed here after payment"><input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Note on the sale"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
};

/** Whole-sale discount in currency or percent of the subtotal. */
const DiscountDialog = ({ open, onClose }) => {
  const { cart, setCartMeta, totals, currency } = useTill();
  const [v, setV] = useState('');
  useEffect(() => { if (open) setV(cart.discountCents ? (cart.discountCents / 100).toFixed(2) : ''); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const apply = () => { setCartMeta({ discountCents: Math.max(0, Math.min(totals.subtotal, toCents(v) ?? 0)) }); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title="Discount on the sale" description={`Subtotal ${fmtCents(totals.subtotal, currency)}`} size="sm">
      <div className="mb-3 flex items-baseline justify-between rounded-xl border border-ink-700 bg-ink-900 px-4 py-3">
        <span className="text-3xl font-semibold tabular-nums text-mist">− {v || '0.00'}</span>
        <span className="text-sm text-mist-muted">total {fmtCents(Math.max(0, totals.subtotal - (toCents(v) ?? 0)), currency)}</span>
      </div>
      <div className="mb-2 flex gap-1.5">
        {[5, 10, 15, 20].map((p) => <button key={p} type="button" className="chip" onClick={() => setV((Math.round(totals.subtotal * p / 100) / 100).toFixed(2))}>{p}%</button>)}
        <button type="button" className="chip" onClick={() => setV('')}>None</button>
      </div>
      <Keypad value={v} onChange={setV} onEnter={apply} enterLabel="Apply" />
    </Modal>
  );
};

export { CustomerDialog, DiscountDialog };
