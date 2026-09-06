import { useState } from 'react';
import { toast } from 'sonner';
import { PauseCircle, Trash2 } from 'lucide-react';
import { Modal, Field, ConfirmButton } from '@/shared/ui/forms';
import { EmptyState, fmtRelative, useAsync, Spinner } from '@/shared/ui/ui';
import { fmtCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { posApi } from '@/pos/services/posApi';
import { useTill } from '@/pos/state/TillProvider';

/** Park the current sale with a label. */
const HoldDialog = ({ open, onClose }) => {
  const { cart, clearCart } = useTill();
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const hold = async () => {
    setBusy(true);
    try {
      const lines = cart.lines.map((l) => ({ productId: l.productId, qty: l.qty, discountCents: l.discountCents || 0 }));
      await posApi.sale.hold({ lines, discountCents: cart.discountCents, customer: cart.customer, note: cart.note, holdLabel: label, heldSaleId: cart.heldSaleId });
      clearCart(); setLabel(''); toast.success('Sale parked'); onClose();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Park this sale" description="Recall it from any till later." size="sm"
      footer={<><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn-primary" disabled={busy} onClick={hold}>{busy ? 'Parking…' : 'Park sale'}</button></>}>
      <Field label="Label (optional)" hint="A name or a note so you can find it again">
        <input autoFocus className="input" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && hold()} placeholder="e.g. Blue jacket, Mrs Dlamini" />
      </Field>
    </Modal>
  );
};

/** List of parked sales to recall or discard. */
const RecallDialog = ({ open, onClose }) => {
  const { loadSale, currency, cart } = useTill();
  const { data, loading, error, reload } = useAsync(() => (open ? posApi.sale.held() : Promise.resolve([])), [open]);
  const recall = async (id) => {
    if (cart.lines.length && !window.confirm('Replace the items currently on the till with this parked sale?')) return;
    try { loadSale(await posApi.sale.recall(id)); onClose(); } catch (err) { toast.error(errorMessage(err)); }
  };
  const discard = async (id) => { try { await posApi.sale.discard(id); reload(); } catch (err) { toast.error(errorMessage(err)); } };
  return (
    <Modal open={open} onClose={onClose} title="Parked sales" size="md">
      {loading ? <div className="flex justify-center py-8"><Spinner /></div>
        : error ? <p className="text-sm text-red-600">{errorMessage(error)}</p>
        : !data?.length ? <EmptyState icon={<PauseCircle className="h-6 w-6" />} title="Nothing parked" text="Use Park to put a sale aside while you serve someone else." compact />
        : (
          <ul className="divide-y divide-ink-700">
            {data.map((s) => (
              <li key={s.Id} className="flex items-center gap-3 py-2.5">
                <button type="button" onClick={() => recall(s.Id)} className="min-w-0 grow text-left">
                  <p className="truncate text-sm font-medium text-mist">{s.HoldLabel || s.CustomerName || s.Reference}</p>
                  <p className="text-xs text-mist-dim">{s.ItemCount} item{s.ItemCount === 1 ? '' : 's'} · {s.TellerName} · {fmtRelative(s.CreatedAt)}</p>
                </button>
                <span className="text-sm font-semibold tabular-nums text-mist">{fmtCents(s.TotalCents, currency)}</span>
                <ConfirmButton className="btn-ghost btn-sm text-red-600" confirmLabel="Discard?" onConfirm={() => discard(s.Id)}><Trash2 className="h-4 w-4" /></ConfirmButton>
              </li>
            ))}
          </ul>
        )}
    </Modal>
  );
};

export { HoldDialog, RecallDialog };
