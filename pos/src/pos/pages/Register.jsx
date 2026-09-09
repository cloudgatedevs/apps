import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Camera, CameraOff, Clock, Minus, PauseCircle, Percent, Plus, RotateCcw, ScanLine, Search, ShoppingCart, Trash2, User, X } from 'lucide-react';
import { EmptyState, Img, useAsync } from '@/shared/ui/ui';
import { Modal } from '@/shared/ui/forms';
import { useConfirm } from '@/shared/ui/confirm';
import { fmtCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { posApi } from '@/pos/services/posApi';
import { useTill } from '@/pos/state/TillProvider';
import { useScannerInput } from '@/pos/components/useScannerInput';
import { BarcodeScanner } from '@/pos/components/BarcodeScanner';
import { LineEditor } from '@/pos/components/LineEditor';
import { HoldDialog, RecallDialog } from '@/pos/components/HeldSales';
import { CustomerDialog, DiscountDialog } from '@/pos/components/SaleExtras';
import { TenderModal } from '@/pos/components/TenderModal';
import { Receipt } from '@/pos/components/Receipt';
import { useLiveEvents } from '@/admin/services/live';

const tileColor = (p) => p.Color || p.CategoryColor || null;

const ProductTile = ({ p, currency, onPick }) => (
  <button type="button" onClick={() => onPick(p)} className="pos-tile group" disabled={p.TrackInventory && Number(p.StockQty) <= 0 && !p.AllowNegative}>
    <div className="flex items-start gap-2">
      {p.ImageUrl
        ? <Img small src={p.ImageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" wrapClassName="shrink-0" />
        : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-bold text-white" style={{ background: tileColor(p) || 'rgb(var(--c-secondary))' }}>{(p.Name || '?').slice(0, 2).toUpperCase()}</span>}
      <span className="line-clamp-2 text-[13px] font-medium leading-snug text-mist">{p.Name}</span>
    </div>
    <div className="mt-2 flex items-end justify-between">
      <span className="text-sm font-semibold tabular-nums text-mist">{fmtCents(p.PriceCents, currency)}{p.IsWeighed ? <span className="text-[11px] font-normal text-mist-dim">/{p.Unit}</span> : null}</span>
      {p.TrackInventory ? <span className={`text-[11px] tabular-nums ${Number(p.StockQty) <= 0 ? 'text-red-600' : Number(p.StockQty) <= Number(p.LowStockThreshold || 0) ? 'text-amber-600' : 'text-mist-dim'}`}>{Number(p.StockQty)} left</span> : null}
    </div>
  </button>
);

const CartLine = ({ l, currency, onEdit, onInc, onDec }) => {
  const gross = Math.round(l.qty * l.unitPriceCents);
  return (
    <li className="flex items-center gap-2 py-2">
      <button type="button" onClick={() => onEdit(l)} className="min-w-0 grow text-left">
        <p className="truncate text-[13px] font-medium text-mist">{l.name}</p>
        <p className="text-xs text-mist-dim">{l.isWeighed ? `${l.qty} ${l.unit}` : `${l.qty} ×`} {fmtCents(l.unitPriceCents, currency)}{l.discountCents ? <span className="text-emerald-700"> · −{fmtCents(l.discountCents, currency)}</span> : null}</p>
      </button>
      {!l.isWeighed ? (
        <div className="flex items-center rounded-lg border border-ink-600 bg-white">
          <button type="button" onClick={() => onDec(l)} aria-label="Less" className="grid h-8 w-8 place-items-center text-mist-muted active:bg-ink-800"><Minus className="h-3.5 w-3.5" /></button>
          <span className="w-7 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
          <button type="button" onClick={() => onInc(l)} aria-label="More" className="grid h-8 w-8 place-items-center text-mist-muted active:bg-ink-800"><Plus className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}
      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-mist">{fmtCents(gross - (l.discountCents || 0), currency)}</span>
    </li>
  );
};

/** Main till screen: catalogue on the left, the sale on the right, scanners feeding both. */
const Register = () => {
  const till = useTill();
  const confirm = useConfirm();
  const { settings, categories, currency, shift, requireShift, cart, totals, addProduct, setLine, removeLine, clearCart, reloadShift } = till;
  const [categoryId, setCategoryId] = useState(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [camera, setCamera] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dialog, setDialog] = useState(null); // hold | recall | customer | discount | tender
  const [receipt, setReceipt] = useState(null);
  const [mobileTab, setMobileTab] = useState('items');
  const searchRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 200); return () => clearTimeout(t); }, [search]);
  const { data: products, loading, reload } = useAsync(() => posApi.catalog.products({ categoryId, search: query }), [categoryId, query]);
  useLiveEvents(useCallback(() => reload(), [reload]), ['stock.adjusted', 'product.changed', 'sale.completed']);

  const allowNegative = String(settings.allow_negative_stock ?? '0') === '1';
  const list = useMemo(() => (products ?? []).map((p) => ({ ...p, AllowNegative: allowNegative })), [products, allowNegative]);

  const pick = useCallback((p, qty = 1) => {
    if (requireShift && !shift) { toast.error('Open a shift before ringing up a sale.'); return; }
    addProduct(p, qty);
    if (p.IsWeighed) setTimeout(() => setEditing((cur) => cur ?? { pending: p.Id }), 0);
    setMobileTab('cart');
  }, [addProduct, requireShift, shift]);

  // When a weighed product was just added, open its line for the weight.
  useEffect(() => {
    if (editing?.pending) {
      const line = [...cart.lines].reverse().find((l) => l.productId === editing.pending);
      setEditing(line ?? null);
    }
  }, [editing, cart.lines]);

  const onScan = useCallback(async (code) => {
    try {
      const r = await posApi.catalog.lookup(code);
      if (!r?.found) { toast.error(`No product with barcode ${code}`); return; }
      const qty = Number(r.product.PackQty || 1);
      pick(r.product, qty);
      toast.success(`${r.product.Name}${qty > 1 ? ` × ${qty}` : ''}`, { duration: 1200 });
    } catch (err) { toast.error(errorMessage(err)); }
  }, [pick]);
  useScannerInput(onScan, { enabled: !dialog && !editing });

  const submitSearch = async (e) => {
    e.preventDefault();
    const code = search.trim();
    if (!code) return;
    // Exact barcode/SKU wins; otherwise a single search hit is added directly.
    const r = await posApi.catalog.lookup(code).catch(() => null);
    if (r?.found) { pick(r.product, Number(r.product.PackQty || 1)); setSearch(''); return; }
    if (list.length === 1) { pick(list[0]); setSearch(''); }
  };

  const completed = (sale) => { setDialog(null); clearCart(); setReceipt(sale); void reloadShift(); };

  const noShift = requireShift && !shift;
  const cartEmpty = cart.lines.length === 0;

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Mobile tab switch */}
      <div className="grid shrink-0 grid-cols-2 border-b border-ink-700 bg-white lg:hidden">
        {[['items', 'Items'], ['cart', `Sale${totals.count ? ` (${totals.count})` : ''}`]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setMobileTab(k)} className={`py-2.5 text-sm font-semibold ${mobileTab === k ? 'border-b-2 border-secondary text-mist' : 'text-mist-dim'}`}>{l}</button>
        ))}
      </div>

      {/* Catalogue */}
      <section className={`min-h-0 grow flex-col lg:flex ${mobileTab === 'items' ? 'flex' : 'hidden'}`}>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-700 bg-white px-3 py-2">
          <form onSubmit={submitSearch} className="relative min-w-[12rem] grow">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-dim" />
            <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search or scan a barcode…" className="input h-10 pl-9 pr-9" />
            {search ? <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-mist-dim" aria-label="Clear"><X className="h-4 w-4" /></button> : null}
          </form>
          <button type="button" onClick={() => setCamera((v) => !v)} className={`btn-ghost h-10 ${camera ? 'pos-accent-bg border-transparent' : ''}`}>{camera ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}<span className="hidden sm:inline">{camera ? 'Stop camera' : 'Scan with camera'}</span></button>
        </div>
        {camera ? (
          <div className="shrink-0 border-b border-ink-700 bg-zinc-950 p-2"><BarcodeScanner active={camera} onScan={onScan} compact className="mx-auto max-w-xl" /></div>
        ) : null}
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-ink-700 bg-white px-3 py-2 [scrollbar-width:none]">
          <button type="button" onClick={() => setCategoryId(null)} className={`chip shrink-0 ${categoryId === null ? '!bg-mist !text-white' : ''}`}>All</button>
          {categories.map((c) => (
            <button key={c.Id} type="button" onClick={() => setCategoryId(c.Id)} className={`chip shrink-0 ${categoryId === c.Id ? '!bg-mist !text-white' : ''}`}>
              {c.Color ? <span className="h-2 w-2 rounded-full" style={{ background: c.Color }} /> : null}{c.Name}
            </button>
          ))}
        </div>
        <div className="min-h-0 grow overflow-y-auto p-3">
          {noShift ? (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <Clock className="h-5 w-5 shrink-0" /><span className="grow">You need an open shift on a register before you can ring up sales.</span>
              <Link to="/shift" className="btn-primary btn-sm">Open a shift</Link>
            </div>
          ) : null}
          {loading && !products ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-[5.5rem] animate-pulse rounded-2xl bg-ink-800" />)}</div>
            : list.length === 0 ? <EmptyState icon={<ScanLine className="h-6 w-6" />} title={query ? `Nothing matches “${query}”` : 'No products yet'} text={query ? 'Try another name, SKU or barcode.' : 'Products are added in the back office.'} />
            : <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{list.map((p) => <ProductTile key={p.Id} p={p} currency={currency} onPick={pick} />)}</div>}
        </div>
      </section>

      {/* Sale */}
      <aside className={`w-full shrink-0 flex-col border-l border-ink-700 bg-white lg:flex lg:w-[24rem] xl:w-[26rem] ${mobileTab === 'cart' ? 'flex min-h-0 grow' : 'hidden'}`}>
        <div className="flex shrink-0 items-center gap-2 border-b border-ink-700 px-3 py-2">
          <ShoppingCart className="h-4 w-4 text-mist-dim" />
          <p className="grow text-sm font-semibold text-mist">Current sale {cart.heldSaleId ? <span className="chip ml-1">recalled</span> : null}</p>
          <button type="button" onClick={() => setDialog('customer')} className={`btn-ghost btn-sm ${cart.customer ? 'text-secondary' : ''}`}><User className="h-4 w-4" />{cart.customer?.name ? <span className="max-w-[7rem] truncate">{cart.customer.name}</span> : null}</button>
          <button type="button" disabled={cartEmpty} onClick={async () => { if (await confirm({ title: 'Clear this sale?', text: 'All items on the till are removed.', confirmLabel: 'Clear sale', tone: 'danger' })) clearCart(); }} className="btn-ghost btn-sm text-red-600" aria-label="Clear sale"><Trash2 className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 grow overflow-y-auto px-3">
          {cartEmpty ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-mist-dim">
              <ScanLine className="h-8 w-8" />
              <p className="text-sm">Scan a barcode or tap a product</p>
            </div>
          ) : (
            <ul className="divide-y divide-ink-700">
              {cart.lines.map((l) => <CartLine key={l.key} l={l} currency={currency} onEdit={setEditing} onInc={(x) => setLine(x.key, { qty: x.qty + 1 })} onDec={(x) => (x.qty > 1 ? setLine(x.key, { qty: x.qty - 1 }) : removeLine(x.key))} />)}
            </ul>
          )}
        </div>
        <div className="shrink-0 border-t border-ink-700 p-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-mist-muted"><span>Subtotal</span><span className="tabular-nums">{fmtCents(totals.subtotal, currency)}</span></div>
            {totals.discount ? <div className="flex justify-between text-emerald-700"><span>Discount</span><span className="tabular-nums">− {fmtCents(totals.discount, currency)}</span></div> : null}
            <div className="flex justify-between text-mist-dim"><span>{String(settings.prices_include_tax ?? '1') === '1' ? 'Includes VAT' : 'VAT'}</span><span className="tabular-nums">{fmtCents(totals.tax, currency)}</span></div>
            <div className="flex items-baseline justify-between pt-1 text-mist"><span className="font-semibold">Total</span><span className="text-2xl font-bold tabular-nums">{fmtCents(totals.total, currency)}</span></div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button type="button" disabled={cartEmpty} onClick={() => setDialog('discount')} className="btn-ghost justify-center"><Percent className="h-4 w-4" /> Discount</button>
            <button type="button" disabled={cartEmpty} onClick={() => setDialog('hold')} className="btn-ghost justify-center"><PauseCircle className="h-4 w-4" /> Park</button>
            <button type="button" onClick={() => setDialog('recall')} className="btn-ghost justify-center"><RotateCcw className="h-4 w-4" /> Recall</button>
          </div>
          <button type="button" disabled={cartEmpty || noShift} onClick={() => setDialog('tender')} className="pos-primary mt-2 w-full">Pay {totals.total ? fmtCents(totals.total, currency) : ''}</button>
        </div>
      </aside>

      <LineEditor line={editing?.pending ? null : editing} onClose={() => setEditing(null)} />
      <HoldDialog open={dialog === 'hold'} onClose={() => setDialog(null)} />
      <RecallDialog open={dialog === 'recall'} onClose={() => setDialog(null)} />
      <CustomerDialog open={dialog === 'customer'} onClose={() => setDialog(null)} />
      <DiscountDialog open={dialog === 'discount'} onClose={() => setDialog(null)} />
      <TenderModal open={dialog === 'tender'} onClose={() => setDialog(null)} onCompleted={completed} />
      <Modal open={!!receipt} onClose={() => setReceipt(null)} title="Sale complete" description={receipt?.Reference} size="sm"
        footer={<button type="button" className="btn-primary" onClick={() => { setReceipt(null); searchRef.current?.focus(); }}>New sale</button>}>
        {receipt?.ChangeCents ? <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-center text-emerald-800"><p className="text-xs uppercase tracking-wide">Change due</p><p className="text-3xl font-bold tabular-nums">{fmtCents(receipt.ChangeCents, currency)}</p></div> : null}
        <Receipt sale={receipt} />
      </Modal>
    </div>
  );
};

export { Register };
