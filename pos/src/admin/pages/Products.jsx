import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Camera, FileUp, Package, Tag } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, Badge, PageHead, Pager, SearchBar, EmptyState, SelectionBar, Img } from '@/shared/ui/ui';
import { SkeletonTable } from '@/shared/ui/skeleton';
import { Modal, Notice } from '@/shared/ui/forms';
import { fmtCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { LabelSheet } from '@/admin/components/LabelSheet';
import { BarcodeScanner } from '@/pos/components/BarcodeScanner';
import { useScannerInput } from '@/pos/components/useScannerInput';

const PAGE = 50;

/** Parse a CSV/TSV of products: name, sku, barcode, price, cost, stock, category (header row required). */
const parseSheet = (text) => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const split = (l) => {
    const out = []; let cur = ''; let quoted = false;
    for (let i = 0; i < l.length; i += 1) {
      const ch = l[i];
      if (quoted) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i += 1; } else if (ch === '"') quoted = false; else cur += ch; }
      else if (ch === '"') quoted = true;
      else if (ch === sep) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const head = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  const col = (names) => head.findIndex((h) => names.includes(h));
  const ix = { name: col(['name', 'product', 'productname', 'description']), sku: col(['sku', 'code', 'itemcode']), barcode: col(['barcode', 'ean', 'upc', 'gtin']), price: col(['price', 'sellingprice', 'retail']), cost: col(['cost', 'costprice']), stock: col(['stock', 'qty', 'quantity', 'onhand']), category: col(['category', 'department', 'group']) };
  return lines.slice(1).map((l) => { const c = split(l); const g = (i) => (i >= 0 ? c[i] ?? '' : ''); return { name: g(ix.name), sku: g(ix.sku), barcode: g(ix.barcode), price: g(ix.price), cost: g(ix.cost), stock: g(ix.stock), category: g(ix.category) }; }).filter((r) => r.name);
};

const ImportDialog = ({ open, onClose, onDone }) => {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const read = (file) => { const r = new FileReader(); r.onload = () => setRows(parseSheet(String(r.result || ''))); r.readAsText(file); };
  const run = async () => {
    setBusy(true);
    try { const r = await adminApi.products.importRows(rows); toast.success(`Imported. ${r.total} products in the catalogue.`); setRows([]); onDone(); onClose(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Import products" description="CSV or tab-separated, with a header row" size="lg"
      footer={<><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn-primary" disabled={!rows.length || busy} onClick={run}>{busy ? 'Importing…' : `Import ${rows.length} row${rows.length === 1 ? '' : 's'}`}</button></>}>
      <Notice tone="info">Columns recognised: <b>name</b>, sku, barcode, price, cost, stock, category. Existing products are matched by barcode, then SKU, then name, and updated; new ones are created. Prices in major units (e.g. 24.99).</Notice>
      <div className="mt-3 flex items-center gap-2">
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
        <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4" /> Choose file</button>
        <span className="text-xs text-mist-dim">or paste below</span>
      </div>
      <textarea className="textarea mt-2 h-28 w-full font-mono text-xs" placeholder={'name,sku,barcode,price,cost,stock,category\nCoke 330ml,CK330,5449000000996,14.99,9.50,48,Drinks'} onChange={(e) => setRows(parseSheet(e.target.value))} />
      {rows.length ? (
        <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-ink-700">
          <table className="w-full text-xs"><thead className="bg-ink-900 text-left text-mist-dim"><tr><th className="px-2 py-1">Name</th><th className="px-2 py-1">SKU</th><th className="px-2 py-1">Barcode</th><th className="px-2 py-1 text-right">Price</th><th className="px-2 py-1 text-right">Stock</th><th className="px-2 py-1">Category</th></tr></thead>
            <tbody>{rows.slice(0, 200).map((r, i) => <tr key={i} className="border-t border-ink-700"><td className="px-2 py-1">{r.name}</td><td className="px-2 py-1 font-mono">{r.sku}</td><td className="px-2 py-1 font-mono">{r.barcode}</td><td className="px-2 py-1 text-right">{r.price}</td><td className="px-2 py-1 text-right">{r.stock}</td><td className="px-2 py-1">{r.category}</td></tr>)}</tbody></table>
        </div>
      ) : null}
    </Modal>
  );
};

const Products = () => {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') || 0);
  const search = params.get('q') || '';
  const status = params.get('status') || '';
  const categoryId = params.get('category') || '';
  const lowStock = params.get('low') === '1';
  const sort = params.get('sort') || 'name';
  const [draft, setDraft] = useState(search);
  const [selected, setSelected] = useState(new Set());
  const [labels, setLabels] = useState(null);
  const [importing, setImporting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const setParam = (patch) => { const next = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v === '' || v == null || v === false ? next.delete(k) : next.set(k, String(v)))); if (!('page' in patch)) next.delete('page'); setParams(next); };

  const { data, loading, error, reload } = useAsync(() => adminApi.products.list({ search, status, categoryId, lowStock, sort, skip: page * PAGE, take: PAGE }), [search, status, categoryId, lowStock, sort, page]);
  const categories = useAsync(() => adminApi.categories.list(), []);
  const settings = useAsync(() => adminApi.settings.get(), []);
  const currency = settings.data?.currency || 'ZAR';
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  // A scanned barcode (camera or wedge scanner) filters the list to that product.
  const onScan = (code) => { setDraft(code); setParam({ q: code }); setScanning(false); };
  useScannerInput(onScan, { enabled: !labels && !importing });

  const printLabels = async (ids) => {
    try { setLabels(await adminApi.products.labels(ids)); } catch (err) { toast.error(errorMessage(err)); }
  };
  const bulkStatus = async (st) => {
    try { await Promise.all([...selected].map((id) => adminApi.products.setStatus(id, st))); toast.success(`${selected.size} product${selected.size === 1 ? '' : 's'} ${st === 'active' ? 'activated' : 'deactivated'}.`); setSelected(new Set()); reload(); } catch (err) { toast.error(errorMessage(err)); }
  };

  const columns = useMemo(() => [
    { key: 'Name', label: 'Product', mobile: 'title', render: (p) => (
      <span className="flex items-center gap-3">
        {p.ImageUrl ? <Img src={p.ImageUrl} alt="" wrapClassName="h-9 w-9 shrink-0 rounded-lg border border-ink-700" className="h-9 w-9 object-cover" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-800 text-mist-dim"><Package className="h-4 w-4" /></span>}
        <span className="min-w-0"><Link to={`/products/${p.Id}`} className="block truncate font-medium text-mist hover:text-accent">{p.Name}</Link><span className="block truncate font-mono text-[11px] text-mist-dim">{[p.Sku, p.Barcode].filter(Boolean).join(' · ') || '—'}</span></span>
      </span>) },
    { key: 'CategoryName', label: 'Category', mobile: 'meta', render: (p) => <span className="text-mist-muted">{p.CategoryName || '—'}</span> },
    { key: 'PriceCents', label: 'Price', align: 'right', render: (p) => <span className="tabular-nums text-mist">{fmtCents(p.PriceCents, currency)}{p.IsWeighed ? <span className="text-xs text-mist-dim">/{p.Unit}</span> : null}</span> },
    { key: 'StockQty', label: 'Stock', align: 'right', render: (p) => (p.TrackInventory ? <span className={`tabular-nums ${Number(p.StockQty) <= 0 ? 'text-red-600' : Number(p.StockQty) <= Number(p.LowStockThreshold ?? 5) ? 'text-amber-600' : 'text-mist'}`}>{Number(p.StockQty)}{p.Unit !== 'each' ? ` ${p.Unit}` : ''}</span> : <span className="text-xs text-mist-dim">not tracked</span>) },
    { key: 'Status', label: 'Status', render: (p) => <Badge tone={p.Status === 'active' ? 'green' : 'gray'} dot>{p.Status}</Badge> },
    { key: 'actions', label: '', mobile: 'actions', render: (p) => <span className="flex gap-1"><button type="button" onClick={() => printLabels([p.Id])} className="btn-ghost btn-sm" title="Print label"><Tag className="h-4 w-4" /></button><Link to={`/products/${p.Id}`} className="btn-ghost btn-sm">Edit</Link></span> },
  ], [currency]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Products" subtitle="Everything the tills can sell. Scan a barcode to find a product.">
        <button type="button" onClick={() => setImporting(true)} className="btn-ghost"><FileUp className="h-4 w-4" /> Import</button>
        <button type="button" onClick={() => setScanning((v) => !v)} className={`btn-ghost ${scanning ? '!bg-accent-soft !text-accent-600' : ''}`}><Camera className="h-4 w-4" /> Scan</button>
        <Link to="/products/new" className="btn-primary">New product</Link>
      </PageHead>
      {scanning ? <BarcodeScanner active onScan={onScan} compact className="max-w-md" /> : null}

      <SearchBar value={draft} onChange={(e) => setDraft(e.target.value)} onSubmit={(e) => { e.preventDefault(); setParam({ q: draft.trim() }); }} onClear={() => { setDraft(''); setParam({ q: '' }); }} placeholder="Search name, SKU or barcode…">
        <select value={categoryId} onChange={(e) => setParam({ category: e.target.value })} className="select"><option value="">All categories</option>{(categories.data ?? []).map((c) => <option key={c.Id} value={c.Id}>{c.Name}</option>)}</select>
        <select value={status} onChange={(e) => setParam({ status: e.target.value })} className="select"><option value="">Active + inactive</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <select value={sort} onChange={(e) => setParam({ sort: e.target.value })} className="select"><option value="name">Name</option><option value="price">Price</option><option value="stock">Stock (low first)</option><option value="updated">Recently updated</option><option value="created">Newest</option></select>
        <label className="flex items-center gap-2 text-sm text-mist-muted"><input type="checkbox" checked={lowStock} onChange={(e) => setParam({ low: e.target.checked ? '1' : '' })} className="accent-accent" /> Low stock</label>
      </SearchBar>

      <ErrorNote error={error} />
      {selected.size ? (
        <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
          <button type="button" className="btn-ghost btn-sm" onClick={() => printLabels([...selected])}><Tag className="h-4 w-4" /> Print labels</button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => bulkStatus('active')}>Activate</button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => bulkStatus('inactive')}>Deactivate</button>
        </SelectionBar>
      ) : null}
      {loading && !data ? <SkeletonTable columns={6} rows={8} /> : (
        <Table columns={columns} rows={rows} selectable selected={selected} onToggle={(id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })} onToggleAll={(ids) => setSelected((s) => (ids.every((id) => s.has(id)) ? new Set() : new Set(ids)))}
          empty={<EmptyState icon={<Package className="h-5 w-5" />} title={search ? `Nothing matches “${search}”` : 'No products yet'} text={search ? 'Try another name, SKU or barcode.' : 'Add your first product or import a spreadsheet.'} action={<Link to="/products/new" className="btn-primary">New product</Link>} />} />
      )}
      {total > PAGE ? <Pager page={page} pages={pages} total={total} from={page * PAGE + 1} to={Math.min(total, (page + 1) * PAGE)} noun="products" onPage={(p) => setParam({ page: p })} /> : null}

      <LabelSheet open={!!labels} onClose={() => setLabels(null)} products={labels ?? []} defaultSize={settings.data?.label_size} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} onDone={() => { reload(); categories.reload(); }} />
    </div>
  );
};

export { Products };
