import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Mail, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { fmtCents } from '@/shared/lib/money';
import { fmtDate } from '@/shared/ui/ui';
import { errorMessage } from '@/shared/lib/errors';
import { posApi } from '@/pos/services/posApi';

const Line = ({ l, r, bold, muted }) => (
  <div className={`flex justify-between gap-2 ${bold ? 'font-bold' : ''} ${muted ? 'text-mist-dim' : ''}`}><span className="min-w-0 break-words">{l}</span><span className="shrink-0 tabular-nums">{r}</span></div>
);

const qtyText = (i) => (i.Unit && i.Unit !== 'each' ? `${Number(i.Qty)} ${i.Unit}` : `${Number(i.Qty)} ×`);

/** Receipt sheet (80mm layout when printed) with print and e-mail actions. */
const Receipt = ({ sale, showActions = true, className = '' }) => {
  const s = sale?.Settings ?? {};
  const cur = sale?.Currency || s.currency || 'ZAR';
  const barcode = useRef(null);
  const [email, setEmail] = useState(sale?.CustomerEmail || '');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!barcode.current || !sale?.Reference) return;
    try { JsBarcode(barcode.current, sale.Reference, { format: 'CODE128', displayValue: false, height: 36, width: 1.4, margin: 0 }); } catch { /* ignore */ }
  }, [sale?.Reference]);

  if (!sale) return null;
  const refunded = Number(sale.RefundedCents || 0);
  const send = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.error('Enter a valid e-mail address.'); return; }
    setSending(true);
    try { await posApi.receipt.email(sale.Id, email); toast.success(`Receipt sent to ${email}`); } catch (err) { toast.error(errorMessage(err)); } finally { setSending(false); }
  };

  return (
    <div className={className}>
      <div className="pos-receipt mx-auto w-full max-w-[22rem] rounded-xl border border-ink-700 bg-white p-5 text-[12px] leading-snug text-mist">
        <div className="text-center">
          {s.store_logo_url ? <img src={s.store_logo_url} alt="" className="mx-auto mb-2 h-10 object-contain" /> : null}
          <p className="text-[15px] font-bold">{s.store_name || 'Receipt'}</p>
          {s.store_address ? <p className="whitespace-pre-line text-mist-muted">{s.store_address}</p> : null}
          {s.store_phone ? <p className="text-mist-muted">{s.store_phone}</p> : null}
          {s.tax_number ? <p className="text-mist-muted">VAT {s.tax_number}</p> : null}
          {s.receipt_header ? <p className="mt-2 whitespace-pre-line">{s.receipt_header}</p> : null}
        </div>
        <div className="my-3 border-t border-dashed border-ink-500" />
        <Line l={`Receipt ${sale.Reference}`} r={fmtDate(sale.CompletedAt || sale.CreatedAt)} />
        <Line l={`Served by ${sale.TellerName || ''}`} r={sale.RegisterName || ''} muted />
        {sale.CustomerName ? <Line l={`Customer: ${sale.CustomerName}`} r="" muted /> : null}
        <div className="my-3 border-t border-dashed border-ink-500" />
        {(sale.Items ?? []).map((i) => (
          <div key={i.Id} className="mb-1.5">
            <Line l={i.Name} r={fmtCents(i.LineTotalCents, cur)} />
            <Line l={`  ${qtyText(i)} @ ${fmtCents(i.UnitPriceCents, cur)}${i.DiscountCents ? ` − ${fmtCents(i.DiscountCents, cur)}` : ''}`} r="" muted />
          </div>
        ))}
        <div className="my-3 border-t border-dashed border-ink-500" />
        {sale.DiscountCents ? <Line l="Subtotal" r={fmtCents(sale.SubtotalCents, cur)} /> : null}
        {sale.DiscountCents ? <Line l="Discount" r={`− ${fmtCents(sale.DiscountCents, cur)}`} /> : null}
        <Line l="TOTAL" r={fmtCents(sale.TotalCents, cur)} bold />
        <Line l={String(s.prices_include_tax ?? '1') === '1' ? 'Includes VAT' : 'VAT'} r={fmtCents(sale.TaxCents, cur)} muted />
        <div className="my-2" />
        {(sale.Payments ?? []).filter((p) => p.Status === 'succeeded').map((p) => (
          <div key={p.Id}>
            <Line l={p.Method === 'cash' ? 'Cash' : 'Card'} r={fmtCents(p.Method === 'cash' ? p.TenderedCents : p.AmountCents, cur)} />
            {p.Method === 'cash' && p.ChangeCents ? <Line l="Change" r={fmtCents(p.ChangeCents, cur)} /> : null}
          </div>
        ))}
        {refunded ? <Line l="Refunded" r={`− ${fmtCents(refunded, cur)}`} bold /> : null}
        {sale.Status === 'voided' ? <p className="mt-2 text-center font-bold">*** VOIDED ***</p> : null}
        <div className="my-3 border-t border-dashed border-ink-500" />
        <svg ref={barcode} className="mx-auto block h-9 w-full max-w-[14rem]" />
        <p className="mt-1 text-center font-mono text-[11px] tracking-wider">{sale.Reference}</p>
        {s.receipt_footer ? <p className="mt-3 whitespace-pre-line text-center text-mist-muted">{s.receipt_footer}</p> : null}
      </div>

      {showActions ? (
        <div className="mx-auto mt-4 flex w-full max-w-[22rem] flex-col gap-2">
          <button type="button" onClick={() => window.print()} className="btn-ghost justify-center"><Printer className="h-4 w-4" /> Print</button>
          <div className="flex gap-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" type="email" className="input grow" />
            <button type="button" onClick={send} disabled={sending} className="btn-ghost"><Mail className="h-4 w-4" /> {sending ? 'Sending…' : 'E-mail'}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export { Receipt };
