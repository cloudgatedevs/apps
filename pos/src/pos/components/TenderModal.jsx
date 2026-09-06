import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Banknote, CreditCard, ExternalLink, Loader2, XCircle } from 'lucide-react';
import { Modal, Notice } from '@/shared/ui/forms';
import { Keypad } from '@/pos/components/Keypad';
import { fmtCents, toCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { posApi } from '@/pos/services/posApi';
import { useTill } from '@/pos/state/TillProvider';

const cartPayload = (cart) => ({
  lines: cart.lines.map((l) => ({ productId: l.productId, qty: l.qty, discountCents: l.discountCents || 0 })),
  discountCents: cart.discountCents || 0, customer: cart.customer, note: cart.note, heldSaleId: cart.heldSaleId,
});

const quickAmounts = (settings, total) => {
  const base = String(settings.quick_cash_amounts || '20,50,100,200').split(',').map((s) => Math.round(Number(s.trim()) * 100)).filter((n) => n > 0);
  const roundUps = [10, 50, 100, 500, 1000].map((step) => Math.ceil(total / (step * 100)) * step * 100).filter((n) => n > total);
  return Array.from(new Set([total, ...roundUps, ...base.filter((n) => n >= total)])).sort((a, b) => a - b).slice(0, 6);
};

/**
 * Take payment for the cart. Cash: tendered amount and change, one call. Card: the sale is
 * created open, a Cloudgate Wallet checkout is started and shown as a QR code / link for the
 * customer's phone, and the till polls until it is paid or the cashier cancels.
 */
const TenderModal = ({ open, onClose, onCompleted }) => {
  const { cart, totals, currency, settings, cashEnabled, cardEnabled } = useTill();
  const [method, setMethod] = useState('cash');
  const [tendered, setTendered] = useState('');
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState(null); // { sale, qr }
  const pollRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setMethod(cashEnabled ? 'cash' : 'card');
    setTendered('');
    setCard(null);
    setBusy(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- polling for the card payment
  useEffect(() => {
    if (!card?.sale?.Id || !open) return undefined;
    let stopped = false;
    const tick = async () => {
      try {
        const s = await posApi.payment.status(card.sale.Id);
        if (stopped) return;
        if (s.Status === 'completed') { stopped = true; toast.success('Card payment received'); onCompleted?.(s); return; }
        const pending = s.PendingCardPayment;
        if (!pending) { setCard((c) => ({ ...c, sale: s, failed: (s.Payments ?? []).slice(-1)[0]?.Status || 'failed' })); return; }
      } catch (err) { console.warn('[tender] status', err); }
      if (!stopped) pollRef.current = setTimeout(tick, 2500);
    };
    pollRef.current = setTimeout(tick, 2500);
    return () => { stopped = true; clearTimeout(pollRef.current); };
  }, [card?.sale?.Id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const total = totals.total;
  const tenderedCents = toCents(tendered) ?? 0;
  const change = tenderedCents - total;

  const payCash = async (amount = tenderedCents) => {
    if (amount < total) { toast.error('The amount tendered is less than the total.'); return; }
    setBusy(true);
    try {
      const sale = await posApi.sale.complete({ ...cartPayload(cart), payments: [{ method: 'cash', tenderedCents: amount }] });
      onCompleted?.(sale);
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  const startCard = async () => {
    setBusy(true);
    try {
      const created = cart.openSaleId ? await posApi.sale.get(cart.openSaleId) : await posApi.sale.create(cartPayload(cart));
      const sale = await posApi.payment.start(created.Id);
      const url = sale.PendingCardPayment?.PaymentUrl;
      if (!url) throw new Error('The payment link could not be created.');
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 280, color: { dark: '#0f172a' } });
      setCard({ sale, qr, url });
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  const cancelCard = async () => {
    if (!card?.sale?.Id) { setCard(null); return; }
    setBusy(true);
    try { await posApi.payment.cancel(card.sale.Id); toast.message('Card payment cancelled'); setCard(null); }
    catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  const retryCard = async () => {
    setBusy(true);
    try {
      const sale = await posApi.payment.start(card.sale.Id);
      const url = sale.PendingCardPayment?.PaymentUrl;
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 280, color: { dark: '#0f172a' } });
      setCard({ sale, qr, url });
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={busy || card ? undefined : onClose} title="Take payment" description={`${totals.count} item${totals.count === 1 ? '' : 's'}`} size="md">
      <div className="mb-4 flex items-baseline justify-between rounded-2xl px-5 py-4 text-white" style={{ background: 'rgb(var(--c-primary))' }}>
        <span className="text-sm opacity-80">Total due</span>
        <span className="text-3xl font-bold tabular-nums">{fmtCents(total, currency)}</span>
      </div>

      {!card ? (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button type="button" disabled={!cashEnabled} onClick={() => setMethod('cash')} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition disabled:opacity-40 ${method === 'cash' ? 'border-transparent pos-accent-bg' : 'border-ink-600 bg-white text-mist'}`}><Banknote className="h-5 w-5" /> Cash</button>
          <button type="button" disabled={!cardEnabled} onClick={() => setMethod('card')} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition disabled:opacity-40 ${method === 'card' ? 'border-transparent pos-accent-bg' : 'border-ink-600 bg-white text-mist'}`}><CreditCard className="h-5 w-5" /> Card</button>
        </div>
      ) : null}

      {method === 'cash' && !card ? (
        <div>
          <div className="mb-2 grid grid-cols-3 gap-2">
            {quickAmounts(settings, total).map((a) => (
              <button key={a} type="button" disabled={busy} onClick={() => payCash(a)} className="rounded-xl border border-ink-600 bg-white px-2 py-2.5 text-sm font-semibold tabular-nums text-mist shadow-panel transition active:scale-[0.98] active:bg-ink-800">{fmtCents(a, currency)}</button>
            ))}
          </div>
          <div className="mb-3 flex items-baseline justify-between rounded-xl border border-ink-700 bg-ink-900 px-4 py-3">
            <div><p className="text-[11px] uppercase tracking-wide text-mist-dim">Tendered</p><p className="text-2xl font-semibold tabular-nums text-mist">{tendered || '0.00'}</p></div>
            <div className="text-right"><p className="text-[11px] uppercase tracking-wide text-mist-dim">Change</p><p className={`text-2xl font-semibold tabular-nums ${change < 0 ? 'text-mist-dim' : 'text-emerald-700'}`}>{change >= 0 ? fmtCents(change, currency) : '—'}</p></div>
          </div>
          <Keypad value={tendered} onChange={setTendered} onEnter={() => payCash()} enterLabel={busy ? 'Completing…' : `Complete sale`} />
        </div>
      ) : null}

      {method === 'card' && !card ? (
        <div className="space-y-3">
          <Notice tone="info">A secure Cloudgate Wallet payment page opens for the customer. Show the QR code on this screen or open the link on a customer-facing display.</Notice>
          <button type="button" disabled={busy} onClick={startCard} className="pos-primary w-full">{busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Starting…</> : <><CreditCard className="h-5 w-5" /> Start card payment</>}</button>
        </div>
      ) : null}

      {card ? (
        <div className="text-center">
          {card.failed ? (
            <div className="space-y-3">
              <Notice tone="warn">The payment was {card.failed}. You can try again or cancel and take cash.</Notice>
              <div className="flex justify-center gap-2">
                <button type="button" className="btn-ghost" disabled={busy} onClick={cancelCard}>Cancel</button>
                <button type="button" className="btn-primary" disabled={busy} onClick={retryCard}>Try again</button>
              </div>
            </div>
          ) : (
            <>
              <img src={card.qr} alt="Payment QR code" className="mx-auto h-56 w-56 rounded-xl border border-ink-700 bg-white p-2" />
              <p className="mt-3 text-sm text-mist">Ask the customer to scan and pay <span className="font-semibold">{fmtCents(card.sale.OutstandingCents ?? total, currency)}</span></p>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-mist-dim"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for the payment… {card.sale.Reference}</p>
              <div className="mt-4 flex justify-center gap-2">
                <a href={card.url} target="_blank" rel="noreferrer" className="btn-ghost"><ExternalLink className="h-4 w-4" /> Open on this device</a>
                <button type="button" className="btn-ghost text-red-600" disabled={busy} onClick={cancelCard}><XCircle className="h-4 w-4" /> Cancel payment</button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </Modal>
  );
};

export { TenderModal };
