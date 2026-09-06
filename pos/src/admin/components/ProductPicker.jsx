import { useEffect, useState } from 'react';
import { Camera, Search } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { BarcodeScanner } from '@/pos/components/BarcodeScanner';
import { useScannerInput } from '@/pos/components/useScannerInput';
import { fmtCents } from '@/shared/lib/money';

/**
 * Search-or-scan box that hands a product to `onPick(product)`. Exact barcode/SKU hits are picked
 * straight away (so a USB scanner just works); otherwise a dropdown shows matches.
 */
const ProductPicker = ({ onPick, currency = 'ZAR', autoFocus = true, placeholder = 'Scan a barcode or search…' }) => {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [camera, setCamera] = useState(false);

  const pickCode = async (code) => {
    const owner = await adminApi.products.barcodeOwner(code).catch(() => null);
    if (owner) { onPick(await adminApi.products.get(owner.Id)); setQ(''); setHits([]); return true; }
    return false;
  };
  useScannerInput((code) => pickCode(code).then((ok) => { if (!ok) setQ(code); }));

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); return undefined; }
    const t = setTimeout(() => adminApi.products.list({ search: term, take: 8 }).then((r) => setHits(r?.items ?? [])).catch(() => setHits([])), 200);
    return () => clearTimeout(t);
  }, [q]);

  const submit = async (e) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    if (await pickCode(term)) return;
    if (hits.length === 1) { onPick(hits[0]); setQ(''); setHits([]); }
  };

  return (
    <div className="relative">
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative grow">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-dim" />
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-9" placeholder={placeholder} autoFocus={autoFocus} />
        </div>
        <button type="button" onClick={() => setCamera((v) => !v)} className={`btn-ghost ${camera ? '!bg-accent-soft !text-accent-600' : ''}`}><Camera className="h-4 w-4" /></button>
      </form>
      {camera ? <BarcodeScanner active onScan={(code) => pickCode(code).then((ok) => { if (!ok) setQ(code); })} compact className="mt-2 max-w-md" /> : null}
      {hits.length ? (
        <ul className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-ink-700 bg-white p-1 shadow-pop">
          {hits.map((p) => (
            <li key={p.Id}><button type="button" onClick={() => { onPick(p); setQ(''); setHits([]); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-ink-900">
              <span className="min-w-0 grow"><span className="block truncate text-sm text-mist">{p.Name}</span><span className="block font-mono text-[11px] text-mist-dim">{[p.Sku, p.Barcode].filter(Boolean).join(' · ')}</span></span>
              <span className="text-xs text-mist-dim">{Number(p.StockQty)} on hand</span><span className="text-sm tabular-nums text-mist">{fmtCents(p.PriceCents, currency)}</span>
            </button></li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export { ProductPicker };
