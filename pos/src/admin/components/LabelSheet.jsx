import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer } from 'lucide-react';
import { Modal } from '@/shared/ui/forms';
import { fmtCents } from '@/shared/lib/money';

const SIZES = {
  small: { label: 'Small · 38 × 21 mm', w: 38, h: 21, cols: 5 },
  medium: { label: 'Medium · 50 × 30 mm', w: 50, h: 30, cols: 4 },
  large: { label: 'Large · 70 × 40 mm', w: 70, h: 40, cols: 3 },
};

const Label = ({ p, size, currency }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !p.Barcode) return;
    const ean = /^\d{13}$/.test(p.Barcode) ? 'EAN13' : /^\d{8}$/.test(p.Barcode) ? 'EAN8' : 'CODE128';
    try { JsBarcode(ref.current, p.Barcode, { format: ean, displayValue: true, fontSize: 10, height: size.h * 1.2, width: size.w > 50 ? 1.6 : 1.1, margin: 0, textMargin: 1 }); } catch { /* invalid code for format */ }
  }, [p.Barcode, size]);
  return (
    <div className="pos-label flex flex-col items-center justify-between overflow-hidden border border-dashed border-ink-500 bg-white p-1 text-center" style={{ width: `${size.w}mm`, height: `${size.h}mm` }}>
      <p className="line-clamp-1 w-full text-[9px] font-semibold leading-tight text-black">{p.Name}</p>
      {p.Barcode ? <svg ref={ref} className="max-h-[60%] w-full" /> : <p className="text-[8px] text-zinc-500">no barcode</p>}
      <p className="text-[10px] font-bold leading-tight text-black">{fmtCents(p.PriceCents, currency)}{p.Unit && p.Unit !== 'each' ? <span className="font-normal">/{p.Unit}</span> : null}</p>
    </div>
  );
};

/** Print barcode/price labels for the chosen products (copies per product, three label sizes). */
const LabelSheet = ({ open, onClose, products, defaultSize = 'medium' }) => {
  const [size, setSize] = useState(SIZES[defaultSize] ? defaultSize : 'medium');
  const [copies, setCopies] = useState(1);
  const s = SIZES[size];
  const currency = products?.[0]?.Currency || 'ZAR';
  const list = (products ?? []).flatMap((p) => Array.from({ length: Math.max(1, Math.min(50, Number(copies) || 1)) }, () => p));
  return (
    <Modal open={open} onClose={onClose} title="Print labels" description={`${products?.length ?? 0} product${products?.length === 1 ? '' : 's'}`} size="lg"
      footer={<><button type="button" className="btn-ghost" onClick={onClose}>Close</button><button type="button" className="btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button></>}>
      <div className="mb-3 flex flex-wrap items-end gap-3 no-print">
        <label className="flex flex-col gap-1 text-xs text-mist-muted">Size<select value={size} onChange={(e) => setSize(e.target.value)} className="select">{Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs text-mist-muted">Copies of each<input type="number" min="1" max="50" value={copies} onChange={(e) => setCopies(e.target.value)} className="input w-24" /></label>
        <p className="text-xs text-mist-dim">Use the browser print dialog to pick the label printer and set margins to none.</p>
      </div>
      <div className="pos-receipt pos-labels flex flex-wrap gap-[2mm] bg-ink-900 p-2">
        {list.map((p, i) => <Label key={`${p.Id}-${i}`} p={p} size={s} currency={currency} />)}
      </div>
    </Modal>
  );
};

export { LabelSheet, SIZES as LABEL_SIZES };
