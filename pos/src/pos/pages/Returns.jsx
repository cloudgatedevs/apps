import { useState } from 'react';
import { toast } from 'sonner';
import { Banknote, Camera, CameraOff, CreditCard, RotateCcw, Search } from 'lucide-react';
import { Notice, Field } from '@/shared/ui/forms';
import { useConfirm } from '@/shared/ui/confirm';
import { Badge } from '@/shared/ui/ui';
import { fmtCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { posApi } from '@/pos/services/posApi';
import { useTill } from '@/pos/state/TillProvider';
import { useScannerInput } from '@/pos/components/useScannerInput';
import { BarcodeScanner } from '@/pos/components/BarcodeScanner';
import { Receipt } from '@/pos/components/Receipt';

/**
 * Refund items from a completed sale. Cash refunds come out of the till; card refunds go back
 * to the customer's card through the Cloudgate Wallet payment the sale was paid with.
 */
const Returns = () => {
  const { currency, shift, requireShift, reloadShift } = useTill();
  const confirm = useConfirm();
  const [ref, setRef] = useState('');
  const [sale, setSale] = useState(null);
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [camera, setCamera] = useState(false);
  const [finding, setFinding] = useState(false);

  const find = async (reference) => {
    const r = String(reference || ref).trim().toUpperCase();
    if (!r) return;
    setDone(null);
    setFinding(true);
    try {
      const s = await posApi.sale.byReference(r);
      setSale(s); setQty({}); setRef(r);
      setCamera(false);
    } catch (err) { toast.error(errorMessage(err)); } finally { setFinding(false); }
  };
  useScannerInput((code) => find(code));

  const paidByCard = (sale?.Payments ?? []).some((p) => p.Method === 'card' && p.Status === 'succeeded');
  const paidByCash = (sale?.Payments ?? []).some((p) => p.Method === 'cash' && p.Status === 'succeeded');
  const items = (sale?.Items ?? []).map((i) => ({ ...i, left: Number(i.Qty) - Number(i.RefundedQty || 0) }));
  const chosen = items.filter((i) => Number(qty[i.Id]) > 0).map((i) => ({ saleItemId: i.Id, qty: Math.min(i.left, Number(qty[i.Id])) }));
  const estimate = items.reduce((s, i) => { const q = Math.min(i.left, Number(qty[i.Id]) || 0); return s + (q > 0 ? Math.round(Number(i.LineTotalCents) * q / Number(i.Qty)) : 0); }, 0);
  const refundable = sale && ['completed', 'partially_refunded'].includes(sale.Status);

  const refund = async (method) => {
    if (!chosen.length) { toast.error('Choose the items to refund.'); return; }
    if (method === 'cash' && requireShift && !shift) { toast.error('Open a shift to refund cash from the till.'); return; }
    if (!(await confirm({ title: 'Confirm refund', text: `Refund ${fmtCents(estimate, currency)} ${method === 'cash' ? 'in cash from the till' : 'to the original card'}?`, confirmLabel: 'Refund' }))) return;
    setBusy(true);
    try {
      const s = method === 'cash' ? await posApi.sale.refundCash(sale.Id, chosen, reason) : await posApi.payment.refundCard(sale.Id, chosen, reason);
      setDone(s); setSale(null); setQty({}); setReason('');
      toast.success('Refund recorded');
      void reloadShift();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col overflow-y-auto p-3 sm:p-5">
      {/* The receipt slip carries the sale number as a CODE128 barcode: a USB scanner types it
          here, the camera reads it, or the teller keys in the number printed under it. */}
      <form onSubmit={(e) => { e.preventDefault(); find(); }} className="mb-4 flex shrink-0 gap-2">
        <div className="relative min-w-0 grow">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-dim" />
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Scan the receipt barcode or type its number (R-100001)" className="input h-11 w-full pl-9 font-mono" autoFocus disabled={finding} />
        </div>
        <button type="button" onClick={() => setCamera((v) => !v)} className={`btn-ghost h-11 shrink-0 ${camera ? 'pos-accent-bg border-transparent' : ''}`} aria-pressed={camera}>{camera ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}<span className="hidden sm:inline">{camera ? 'Stop camera' : 'Scan with camera'}</span></button>
        <button type="submit" className="btn-primary h-11 shrink-0" disabled={finding || !ref.trim()}>{finding ? 'Finding…' : 'Find'}</button>
      </form>
      {camera ? <div className="mb-4 shrink-0 overflow-hidden rounded-xl bg-zinc-950 p-2"><BarcodeScanner active={camera} onScan={(code) => find(code)} compact className="mx-auto max-w-xl" /></div> : null}

      {done ? (
        <div className="card p-4">
          <Notice tone="success" className="mb-4">Refund of {fmtCents(Number(done.Refunds?.slice(-1)[0]?.AmountCents || 0), currency)} recorded on {done.Reference}.</Notice>
          <Receipt sale={done} />
          <button type="button" className="btn-ghost mt-4 w-full justify-center" onClick={() => setDone(null)}>Another return</button>
        </div>
      ) : !sale ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center text-mist-dim">
          <RotateCcw className="h-8 w-8" />
          <p className="text-sm">Find the original sale to start a return.</p>
        </div>
      ) : (
        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="font-mono text-base font-semibold text-mist">{sale.Reference}</p>
            <Badge tone={refundable ? 'green' : 'red'}>{String(sale.Status).replace('_', ' ')}</Badge>
            <span className="text-xs text-mist-dim">{sale.TellerName} · paid {paidByCard ? 'by card' : ''}{paidByCard && paidByCash ? ' and ' : ''}{paidByCash ? 'in cash' : ''}</span>
            <span className="ml-auto text-sm font-semibold tabular-nums">{fmtCents(sale.TotalCents, currency)}</span>
          </div>
          {!refundable ? <Notice tone="warn">This sale cannot be refunded (status {sale.Status}).</Notice> : (
            <>
              <ul className="divide-y divide-ink-700">
                {items.map((i) => (
                  <li key={i.Id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 grow">
                      <p className="truncate text-sm font-medium text-mist">{i.Name}</p>
                      <p className="text-xs text-mist-dim">{Number(i.Qty)} {i.Unit !== 'each' ? i.Unit : '×'} · {fmtCents(i.LineTotalCents, currency)}{Number(i.RefundedQty) ? ` · ${Number(i.RefundedQty)} refunded` : ''}</p>
                    </div>
                    {i.left > 0 ? (
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" max={i.left} step={i.Unit !== 'each' ? '0.001' : '1'} value={qty[i.Id] ?? ''} onChange={(e) => setQty({ ...qty, [i.Id]: e.target.value })} className="input w-20 text-right" placeholder="0" />
                        <button type="button" className="chip" onClick={() => setQty({ ...qty, [i.Id]: i.left })}>all</button>
                      </div>
                    ) : <span className="text-xs text-mist-dim">refunded</span>}
                  </li>
                ))}
              </ul>
              <Field label="Reason" className="mt-3"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Damaged, wrong size, changed mind…" /></Field>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <p className="grow text-sm text-mist">Refund <span className="text-lg font-bold tabular-nums">{fmtCents(estimate, currency)}</span></p>
                {paidByCash ? <button type="button" disabled={busy || !chosen.length} onClick={() => refund('cash')} className="btn-primary"><Banknote className="h-4 w-4" /> Refund cash</button> : null}
                {paidByCard ? <button type="button" disabled={busy || !chosen.length} onClick={() => refund('card')} className="btn-primary"><CreditCard className="h-4 w-4" /> Refund to card</button> : null}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export { Returns };
